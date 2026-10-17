#!/usr/bin/env python3
"""
Pomus - Focus & Productivity Desktop App
Starts the built-in local server and renders the app in a native desktop window (GTK3 + WebKit2).
Includes full fullscreen support (F11), a native sound bridge (PipeWire / PulseAudio),
native Linux notifications (libnotify), a system tray icon (AppIndicator),
on-disk persistence sync and XDG integration.
"""

import argparse
import http.server
import json
import os
import posixpath
import re
import shutil
import tempfile
import signal
import socket
import socketserver
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser

# Prevents blank white screens in WebKitGTK under Wayland, modern compositors and Mesa/Nvidia drivers
if "WEBKIT_DISABLE_DMABUF_RENDERER" not in os.environ:
    os.environ["WEBKIT_DISABLE_DMABUF_RENDERER"] = "1"

# ── Process identity for Wayland / KDE Plasma / Docks ──
# CRUCIAL: set prgname before any GLib/GTK call so that the
# Wayland window app_id is 'pomus', matching pomus.desktop
try:
    import gi
    gi.require_version("GLib", "2.0")
    from gi.repository import GLib
    GLib.set_prgname("pomus")
    GLib.set_application_name("Popomus")
except Exception:
    pass

DEFAULT_PORT = 58241
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(DIRECTORY, "assets")
SOUNDS_DIR = os.path.join(ASSETS_DIR, "sounds")
ICON_PATH = os.path.join(ASSETS_DIR, "icon.png")
ICON_SVG_PATH = os.path.join(ASSETS_DIR, "icon.svg")
DATA_FILE = os.path.join(DIRECTORY, "pomus_data.json")

# XDG Data Directory
XDG_DATA_HOME = os.environ.get("XDG_DATA_HOME", os.path.join(os.path.expanduser("~"), ".local", "share"))
XDG_POMUS_DIR = os.path.join(XDG_DATA_HOME, "pomus")
XDG_RUNTIME_DIR = os.environ.get("XDG_RUNTIME_DIR")
SOCKET_DIR = XDG_RUNTIME_DIR if (XDG_RUNTIME_DIR and os.path.isdir(XDG_RUNTIME_DIR)) else XDG_POMUS_DIR
SOCKET_PATH = os.path.join(SOCKET_DIR, "pomus.sock")

# Only these paths are served as static files (avoids exposing .git, app.py, etc.)
STATIC_ALLOWED_PREFIXES = ("/css/", "/js/", "/assets/")
STATIC_ALLOWED_FILES = ("/", "/index.html")
MAX_BODY_BYTES = 20 * 1024 * 1024
SOUND_NAME_RE = re.compile(r"^[a-z0-9_-]{1,32}$")

_main_window = None
_main_webview = None


def _show_and_present_window(window):
    """Brings the Pomus window to the front, unminimizes and focuses it."""
    if window:
        try:
            window.show_all()
            window.deiconify()
            from gi.repository import Gdk
            window.present_with_time(Gdk.CURRENT_TIME)
        except Exception:
            try:
                window.present()
            except Exception:
                pass
    return False


def _handle_instance_show():
    """Brings the window to the front and, if the timer is not running, reloads to apply changes."""
    global _main_window, _main_webview
    if _main_window:
        _show_and_present_window(_main_window)
    if _main_webview:
        try:
            _main_webview.run_javascript(
                "if (window.timer && !window.timer.isRunning) { window.location.reload(); }",
                None, None, None
            )
        except Exception:
            pass
    return False


def try_activate_existing_instance():
    """
    Checks whether a Pomus instance is already running.
    If so, sends a command to focus its window and returns True.
    """
    # Attempt 1: Unix domain socket
    if os.path.exists(SOCKET_PATH):
        try:
            s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            s.settimeout(1.0)
            s.connect(SOCKET_PATH)
            s.sendall(b"SHOW\n")
            reply = s.recv(1024)
            s.close()
            if b"OK" in reply:
                return True
        except (ConnectionRefusedError, FileNotFoundError):
            try:
                os.remove(SOCKET_PATH)
            except Exception:
                pass
        except Exception:
            pass

    # Attempt 2: local HTTP endpoint /api/show
    try:
        import urllib.request
        req = urllib.request.Request(
            f"http://127.0.0.1:{DEFAULT_PORT}/api/show",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=1.0) as resp:
            if resp.status == 200:
                return True
    except Exception:
        pass

    return False


def start_single_instance_listener(window):
    """Starts a background UNIX socket that listens for focus requests from new instances."""
    try:
        if os.path.exists(SOCKET_PATH):
            try:
                os.remove(SOCKET_PATH)
            except Exception:
                pass

        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.bind(SOCKET_PATH)
        sock.listen(5)

        def listener_thread():
            while True:
                try:
                    conn, _ = sock.accept()
                    data = conn.recv(1024)
                    if b"SHOW" in data:
                        try:
                            from gi.repository import GLib
                            GLib.idle_add(_handle_instance_show)
                        except Exception:
                            pass
                        conn.sendall(b"OK\n")
                    conn.close()
                except Exception:
                    break

        t = threading.Thread(target=listener_thread, daemon=True)
        t.start()
        return sock
    except Exception as e:
        print(f"[POMUS] Warning starting single-instance socket: {e}")
        return None


def get_data_file_path():
    """Returns the data file path, migrating it to XDG if needed."""
    xdg_data_file = os.path.join(XDG_POMUS_DIR, "pomus_data.json")

    # If it already exists in the XDG directory, use it
    if os.path.isfile(xdg_data_file):
        return xdg_data_file

    # If the legacy local file exists, migrate it to XDG
    if os.path.isfile(DATA_FILE):
        try:
            os.makedirs(XDG_POMUS_DIR, exist_ok=True)
            shutil.copy2(DATA_FILE, xdg_data_file)
            print(f"[POMUS] Data migrated to: {xdg_data_file}")
            return xdg_data_file
        except Exception as e:
            print(f"[POMUS] Failed to migrate data to XDG ({e}), using local file.")
            return DATA_FILE

    # No file exists yet; create it in the XDG directory
    os.makedirs(XDG_POMUS_DIR, exist_ok=True)
    return xdg_data_file


# Resolve the data path at startup
ACTIVE_DATA_FILE = get_data_file_path()


def ensure_desktop_integration():
    """Ensures icons and the .desktop entry are installed in the user environment (XDG)."""
    try:
        apps_dir = os.path.join(XDG_DATA_HOME, "applications")
        pixmaps_dir = os.path.join(XDG_DATA_HOME, "pixmaps")
        icons_base = os.path.join(XDG_DATA_HOME, "icons", "hicolor")

        os.makedirs(apps_dir, exist_ok=True)
        os.makedirs(pixmaps_dir, exist_ok=True)

        # 1. Copy to pixmaps (universal fallback for docks on KDE, GNOME, XFCE)
        if os.path.isfile(ICON_PATH):
            shutil.copy2(ICON_PATH, os.path.join(pixmaps_dir, "pomus.png"))
        if os.path.isfile(ICON_SVG_PATH):
            shutil.copy2(ICON_SVG_PATH, os.path.join(pixmaps_dir, "pomus.svg"))

        # 2. Install into the hicolor theme (scalable and 512x512)
        if os.path.isfile(ICON_SVG_PATH):
            scalable_dir = os.path.join(icons_base, "scalable", "apps")
            os.makedirs(scalable_dir, exist_ok=True)
            shutil.copy2(ICON_SVG_PATH, os.path.join(scalable_dir, "pomus.svg"))

        if os.path.isfile(ICON_PATH):
            hicolor_512 = os.path.join(icons_base, "512x512", "apps")
            os.makedirs(hicolor_512, exist_ok=True)
            shutil.copy2(ICON_PATH, os.path.join(hicolor_512, "pomus.png"))

        # 3. Generate/update pomus.desktop
        desktop_dest = os.path.join(apps_dir, "pomus.desktop")
        bin_path = os.path.join(os.path.expanduser("~/.local/bin"), "pomus")
        exec_target = bin_path if os.path.isfile(bin_path) else os.path.join(DIRECTORY, "pomus")

        desktop_content = (
            "[Desktop Entry]\n"
            "Version=1.1\n"
            "Type=Application\n"
            "Name=Popomus\n"
            "GenericName=Focus Timer\n"
            "Comment=Pomodoro focus timer and productivity tracker\n"
            f"Exec={exec_target} %U\n"
            "Icon=pomus\n"
            "Terminal=false\n"
            "Categories=Utility;Clock;GTK;\n"
            "Keywords=pomodoro;timer;focus;productivity;\n"
            "StartupWMClass=pomus\n"
            "StartupNotify=true\n"
            "SingleMainWindow=true\n"
        )
        with open(desktop_dest, "w", encoding="utf-8") as f:
            f.write(desktop_content)
        os.chmod(desktop_dest, 0o644)

        # 4. Update caches if the tools are available
        for cmd in [["update-desktop-database", apps_dir], ["gtk-update-icon-cache", "-f", "-t", icons_base]]:
            if shutil.which(cmd[0]):
                try:
                    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass
    except Exception as e:
        print(f"[POMUS] Desktop integration warning: {e}")


# Native Linux Notifications
_notify_initialized = False


def init_native_notifications():
    """Initializes native notifications via libnotify (gi.repository.Notify)."""
    global _notify_initialized
    if _notify_initialized:
        return True
    try:
        import gi
        gi.require_version("Notify", "0.7")
        from gi.repository import Notify
        Notify.init("Popomus")
        _notify_initialized = True
        return True
    except Exception:
        return False


def send_native_notification(title, body, icon_path=None):
    """Sends a native Linux notification using libnotify, falling back to notify-send."""
    icon = icon_path or ICON_PATH

    # Attempt 1: libnotify via GObject Introspection
    try:
        import gi
        gi.require_version("Notify", "0.7")
        from gi.repository import Notify
        if not _notify_initialized:
            init_native_notifications()
        notification = Notify.Notification.new(title, body, icon)
        notification.set_urgency(Notify.Urgency.NORMAL)
        notification.show()
        return True
    except Exception:
        pass

    # Attempt 2: fall back to the notify-send CLI
    notify_bin = shutil.which("notify-send")
    if notify_bin:
        try:
            cmd = [notify_bin, "--app-name=Popomus", "-i", icon, title, body]
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except Exception:
            pass

    return False


# Native Audio Playback

def play_sound_native(sound_name, volume=0.8):
    """Plays a sound natively on Linux using pw-play, paplay or canberra."""
    if volume <= 0:
        return
    if not SOUND_NAME_RE.match(sound_name or ""):
        sound_name = "bell"

    sound_file = os.path.join(SOUNDS_DIR, f"{sound_name}.wav")
    if not os.path.isfile(sound_file):
        if sound_name in ("click", "pop", "tap"):
            sound_file = os.path.join(SOUNDS_DIR, "click.wav")
            if not os.path.isfile(sound_file):
                sound_file = os.path.join(SOUNDS_DIR, "tick.wav")
        else:
            sound_file = os.path.join(SOUNDS_DIR, "bell.wav")
    if not os.path.isfile(sound_file):
        return

    vol_float = max(0.01, min(1.0, float(volume)))
    pw_vol = f"{vol_float:.2f}"
    pa_vol = str(int(vol_float * 65536))
    mpv_vol = str(max(1, int(vol_float * 100)))

    players = [
        ["pw-play", f"--volume={pw_vol}", sound_file],
        ["paplay", f"--volume={pa_vol}", sound_file],
        ["canberra-gtk-play", "-f", sound_file],
        ["mpv", "--no-video", f"--volume={mpv_vol}", sound_file]
    ]

    for cmd in players:
        bin_path = shutil.which(cmd[0])
        if bin_path:
            try:
                subprocess.Popen(
                    [bin_path] + cmd[1:],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                return
            except Exception:
                continue


# Built-in HTTP Server

class PomusHTTPHandler(http.server.SimpleHTTPRequestHandler):
    """Built-in HTTP server with audio, notification and on-disk persistence APIs."""
    # Older Python versions don't know the web font type
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".woff2": "font/woff2"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Keep the console clean
        pass

    def end_headers(self):
        # Disable caching entirely so changes to local files show up instantly
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def list_directory(self, path):
        # No directory listings
        self.send_error(404)
        return None

    def _allowed_hosts(self):
        port = self.server.server_address[1]
        return {f"127.0.0.1:{port}", f"localhost:{port}"}

    def _is_trusted_request(self):
        """
        Blocks access from other sites open in the user's browser:
        - Host must be this server (protects against DNS rebinding);
        - Origin, when present, must be this application.
        """
        if self.headers.get("Host", "") not in self._allowed_hosts():
            return False
        origin = self.headers.get("Origin")
        if origin is not None:
            parsed = urllib.parse.urlparse(origin)
            if parsed.scheme != "http" or parsed.netloc not in self._allowed_hosts():
                return False
        return True

    def _send_json(self, status, payload):
        body = payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        """Reads and decodes the JSON request body. Returns None if invalid."""
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            return None
        if length <= 0 or length > MAX_BODY_BYTES:
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return None

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path.startswith("/api/") and not self._is_trusted_request():
            self._send_json(403, {"error": "forbidden"})
            return

        # Native audio endpoint: /api/play-sound?sound=bell&volume=0.8
        if parsed.path == "/api/play-sound":
            params = urllib.parse.parse_qs(parsed.query)
            sound_name = params.get("sound", ["bell"])[0]
            try:
                vol = float(params.get("volume", ["0.8"])[0])
            except ValueError:
                vol = 0.8
            threading.Thread(target=play_sound_native, args=(sound_name, vol), daemon=True).start()
            self._send_json(200, {"status": "ok"})
            return

        # Sync endpoint (read): /api/sync
        if parsed.path == "/api/sync":
            data = b"{}"
            if os.path.isfile(ACTIVE_DATA_FILE):
                try:
                    with open(ACTIVE_DATA_FILE, "rb") as f:
                        data = f.read() or b"{}"
                except OSError:
                    pass
            self._send_json(200, data)
            return

        if parsed.path.startswith("/api/"):
            self._send_json(404, {"error": "not found"})
            return

        # Static files: web UI only (path is normalized to block "/js/../app.py")
        static_path = posixpath.normpath(urllib.parse.unquote(parsed.path))
        if parsed.path.endswith("/") and static_path != "/":
            static_path += "/"
        if static_path not in STATIC_ALLOWED_FILES and not static_path.startswith(STATIC_ALLOWED_PREFIXES):
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        if not self._is_trusted_request():
            self._send_json(403, {"error": "forbidden"})
            return

        # Sync endpoint (write): /api/sync
        if parsed.path == "/api/sync":
            data = self._read_json_body()
            if not isinstance(data, dict):
                self._send_json(400, {"error": "invalid payload"})
                return
            try:
                write_json_atomic(ACTIVE_DATA_FILE, data)
            except OSError as e:
                self._send_json(500, {"error": str(e)})
                return
            self._send_json(200, {"status": "saved"})
            return

        # Native notification endpoint: /api/notify
        if parsed.path == "/api/notify":
            data = self._read_json_body()
            if not isinstance(data, dict):
                self._send_json(400, {"error": "invalid payload"})
                return
            title = str(data.get("title", "Popomus"))[:200]
            msg = str(data.get("body", ""))[:500]
            threading.Thread(target=send_native_notification, args=(title, msg), daemon=True).start()
            self._send_json(200, {"status": "ok"})
            return

        # Endpoint to focus the existing window (single instance): /api/show
        if parsed.path == "/api/show":
            try:
                from gi.repository import GLib
                GLib.idle_add(_handle_instance_show)
            except Exception:
                pass
            self._send_json(200, {"status": "focused"})
            return

        self._send_json(404, {"error": "not found"})


def write_json_atomic(path, data):
    """Writes JSON to a temp file and replaces the target, avoiding a corrupted file on failure."""
    directory = os.path.dirname(path) or "."
    fd, tmp_path = tempfile.mkstemp(prefix=".pomus_", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)
    except BaseException:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        raise


def find_available_port(start_port=DEFAULT_PORT, max_tries=30):
    """Finds an available local TCP port."""
    for port in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start_port


class PomusTCPServer(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


def start_local_server(port):
    """Starts the multithreaded HTTP server in the background on a daemon thread."""
    server = PomusTCPServer(("127.0.0.1", port), PomusHTTPHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    return server


# System Tray (AppIndicator)

_tray_indicator = None


def setup_system_tray(window=None, gtk_module=None):
    """
    Sets up the system tray icon with a context menu.
    Uses AyatanaAppIndicator3, falling back to AppIndicator3.
    Returns True if the tray was initialized successfully.
    """
    global _tray_indicator
    try:
        import gi
        Gtk = gtk_module
        if Gtk is None:
            gi.require_version("Gtk", "3.0")
            from gi.repository import Gtk

        # Try AyatanaAppIndicator3 (modern default) or AppIndicator3
        AppIndicator = None
        for lib_name in ("AyatanaAppIndicator3", "AppIndicator3"):
            try:
                gi.require_version(lib_name, "0.1")
                AppIndicator = getattr(__import__("gi.repository", fromlist=[lib_name]), lib_name)
                break
            except (ValueError, ImportError):
                continue

        if AppIndicator is None:
            return False

        # Use the project's SVG or PNG icon
        icon_for_tray = ICON_SVG_PATH if os.path.isfile(ICON_SVG_PATH) else ICON_PATH

        indicator = AppIndicator.Indicator.new(
            "pomus",
            icon_for_tray,
            AppIndicator.IndicatorCategory.APPLICATION_STATUS
        )
        indicator.set_status(AppIndicator.IndicatorStatus.ACTIVE)
        indicator.set_title("Popomus")

        # Context menu (English)
        menu = Gtk.Menu()

        item_show = Gtk.MenuItem(label="Open Popomus")
        item_show.connect("activate", lambda _: _tray_show_window(window))
        menu.append(item_show)

        item_hide = Gtk.MenuItem(label="Minimize to Tray")
        item_hide.connect("activate", lambda _: _tray_hide_window(window))
        menu.append(item_hide)

        item_reload = Gtk.MenuItem(label="Reload Application")
        item_reload.connect("activate", lambda _: _tray_reload_window())
        menu.append(item_reload)

        menu.append(Gtk.SeparatorMenuItem())

        item_quit = Gtk.MenuItem(label="Quit")
        item_quit.connect("activate", lambda _: _tray_quit(Gtk))
        menu.append(item_quit)

        menu.show_all()
        indicator.set_menu(menu)

        _tray_indicator = indicator
        return True

    except Exception as e:
        print(f"[POMUS] System tray not available ({e}).")
        return False


def _tray_show_window(window):
    """Shows and focuses the Pomus window."""
    if window:
        window.present()
        window.show_all()


def _tray_hide_window(window):
    """Hides the Pomus window (keeps it in the tray)."""
    if window:
        window.hide()


def _tray_reload_window():
    """Reloads the app, bypassing the cache."""
    global _main_webview
    if _main_webview:
        try:
            _main_webview.reload_bypass_cache()
        except Exception:
            try:
                _main_webview.reload()
            except Exception:
                pass


def _flush_persistence(webview, Gtk=None):
    """Ensures timer state and pending data are written to disk before closing."""
    if not webview:
        return
    try:
        webview.run_javascript(
            "if (window.persistAll) window.persistAll(); else if (window.Storage) Storage.syncWithDisk(true);",
            None, None, None
        )
        if Gtk:
            t0 = time.time()
            while time.time() - t0 < 0.25:
                while Gtk.events_pending():
                    Gtk.main_iteration_do(False)
                time.sleep(0.02)
        else:
            time.sleep(0.2)
    except Exception:
        pass


def _tray_quit(Gtk):
    """Quits the app from the tray, making sure timer state and data are persisted."""
    global _main_webview
    _flush_persistence(_main_webview, Gtk)
    Gtk.main_quit()


# Native GTK3 + WebKit2 Window

def launch_gtk_webkit(url, start_minimized=False, enable_tray=True):
    """
    Initializes and shows the native desktop window using PyGObject (GTK3 + WebKit2).
    Supports F11 fullscreen, the built-in sound bridge, native notifications and
    the system tray.
    """
    try:
        import gi
        gi.require_version("Gtk", "3.0")
        from gi.repository import Gtk, Gdk, GdkPixbuf, GLib

        # ── Process identity for Wayland / KDE Plasma ──
        GLib.set_prgname("pomus")
        GLib.set_application_name("Popomus")

        # Try loading WebKit2 4.1 or 4.0
        try:
            gi.require_version("WebKit2", "4.1")
            from gi.repository import WebKit2
        except (ValueError, ImportError):
            gi.require_version("WebKit2", "4.0")
            from gi.repository import WebKit2

        # GTK initialization
        if not Gtk.init_check()[0]:
            print("[POMUS] Failed to initialize GTK display.")
            return False

        # Set up icon theme search paths
        icon_theme = Gtk.IconTheme.get_default()
        if icon_theme:
            icon_theme.append_search_path(ASSETS_DIR)
            icon_theme.append_search_path(os.path.join(XDG_DATA_HOME, "icons"))
            icon_theme.append_search_path(os.path.join(XDG_DATA_HOME, "pixmaps"))

        # Set the global default application icon
        Gtk.Window.set_default_icon_name("pomus")
        if os.path.isfile(ICON_PATH):
            try:
                Gtk.Window.set_default_icon_from_file(ICON_PATH)
            except Exception:
                pass

        # ── Dark theme to match the Pomus UI ──
        gtk_settings = Gtk.Settings.get_default()
        if gtk_settings:
            gtk_settings.set_property("gtk-application-prefer-dark-theme", True)

        # Initialize native notifications
        init_native_notifications()

        window = Gtk.Window(title="Popomus")
        window.set_default_size(600, 840)
        window.set_position(Gtk.WindowPosition.CENTER)
        window._is_fullscreen = False

        # ── Window identity for the task manager / dock ──
        window.set_role("pomus")
        window.set_wmclass("pomus", "pomus")
        window.set_icon_name("pomus")

        # Native app icon with a multi-resolution list for docks
        if os.path.isfile(ICON_PATH):
            try:
                base_pixbuf = GdkPixbuf.Pixbuf.new_from_file(ICON_PATH)
                window.set_icon(base_pixbuf)
                icon_list = []
                for sz in [16, 24, 32, 48, 64, 128, 256, 512]:
                    scaled = base_pixbuf.scale_simple(sz, sz, GdkPixbuf.InterpType.BILINEAR)
                    if scaled:
                        icon_list.append(scaled)
                if icon_list:
                    window.set_icon_list(icon_list)
                    Gtk.Window.set_default_icon_list(icon_list)
            except Exception as e:
                pass

        # WebKit data persistence setup
        data_dir = os.path.join(XDG_POMUS_DIR, "webkit_data")
        cache_dir = os.path.join(XDG_POMUS_DIR, "webkit_cache")
        os.makedirs(data_dir, exist_ok=True)
        # Clear leftover WebKit disk cache so local files always refresh
        try:
            shutil.rmtree(cache_dir, ignore_errors=True)
        except Exception:
            pass
        os.makedirs(cache_dir, exist_ok=True)

        try:
            data_manager = WebKit2.WebsiteDataManager(
                base_data_directory=data_dir,
                base_cache_directory=cache_dir,
                local_storage_directory=os.path.join(data_dir, "localstorage"),
                disk_cache_directory=os.path.join(cache_dir, "diskcache"),
            )
            context = WebKit2.WebContext.new_with_website_data_manager(data_manager)
            try:
                context.set_cache_model(WebKit2.CacheModel.DOCUMENT_VIEWER)
            except Exception:
                pass
            webview = WebKit2.WebView.new_with_context(context)
        except Exception:
            webview = WebKit2.WebView()

        settings = webview.get_settings()
        settings.set_enable_developer_extras(True)
        settings.set_enable_webgl(True)
        settings.set_enable_html5_local_storage(True)
        settings.set_enable_html5_database(True)
        # The native Python backend (/api/play-sound with PipeWire/PulseAudio) handles audio
        # Disabling WebKit's built-in webaudio/media prevents GStreamer crashes on Linux
        settings.set_enable_webaudio(False)
        settings.set_enable_media(False)
        settings.set_enable_smooth_scrolling(True)
        if hasattr(settings, "set_enable_accelerated_2d_canvas"):
            try:
                settings.set_enable_accelerated_2d_canvas(True)
            except Exception:
                pass

        def on_load_failed(wv, event, failing_uri, error):
            print(f"[POMUS] Error loading {failing_uri}: {error.message if hasattr(error, 'message') else error}")

        def on_web_process_terminated(wv, reason):
            print(f"[POMUS] Web process terminated ({reason}). Reloading...")
            try:
                wv.reload()
            except Exception:
                wv.load_uri(url)

        webview.connect("load-failed", on_load_failed)
        webview.connect("web-process-terminated", on_web_process_terminated)

        webview.load_uri(url)
        window.add(webview)

        # Keyboard shortcuts: F11 fullscreen, F5 / Ctrl+R reload, F12 devtools
        def on_key_press(widget, event):
            if event.keyval == Gdk.KEY_F11:
                if window._is_fullscreen:
                    window.unfullscreen()
                    window._is_fullscreen = False
                else:
                    window.fullscreen()
                    window._is_fullscreen = True
                return True

            ctrl_pressed = bool(event.state & Gdk.ModifierType.CONTROL_MASK)

            # F5 or Ctrl+R: reload the app without cache
            if event.keyval == Gdk.KEY_F5 or (ctrl_pressed and event.keyval in (Gdk.KEY_r, Gdk.KEY_R)):
                webview.reload_bypass_cache()
                return True

            # F12 or Ctrl+Shift+I: open Web Inspector
            if event.keyval == Gdk.KEY_F12 or (ctrl_pressed and event.keyval in (Gdk.KEY_i, Gdk.KEY_I)):
                try:
                    inspector = webview.get_inspector()
                    if inspector:
                        inspector.show()
                        return True
                except Exception:
                    pass

            return False

        window.connect("key-press-event", on_key_press)

        # ── System tray ──
        tray_active = False
        if enable_tray:
            tray_active = setup_system_tray(window, Gtk)

        # Close behavior: minimize to tray if active, otherwise quit
        def on_delete_event(widget, event):
            _flush_persistence(webview, Gtk)
            if tray_active:
                widget.hide()
                return True  # Prevent destruction, keep in tray
            return False  # Allow normal destruction

        def on_destroy(widget):
            _flush_persistence(webview, Gtk)
            Gtk.main_quit()

        window.connect("delete-event", on_delete_event)
        window.connect("destroy", on_destroy)

        # ── Single instance and socket listener ──
        global _main_window, _main_webview
        _main_window = window
        _main_webview = webview
        start_single_instance_listener(window)

        # ── Show window ──
        if start_minimized and tray_active:
            # Start minimized to tray
            pass
        else:
            window.show_all()

        tray_msg = " + Tray" if tray_active else ""
        print(f"[POMUS] Native window started (GTK3 + WebKit2{tray_msg}).")
        print("[POMUS] Tip: press F11 at any time for fullscreen.")
        Gtk.main()
        return True

    except Exception as e:
        print(f"[POMUS] GTK/WebKit2 not available ({e}). Using fallback...")
        return False


def launch_browser_app_mode(url):
    """
    Fallback: tries to open in app window mode (--app)
    using Brave, Chrome, Chromium or Edge.
    """
    candidate_browsers = [
        "brave",
        "brave-browser",
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        "microsoft-edge"
    ]

    for browser_name in candidate_browsers:
        browser_bin = shutil.which(browser_name)
        if browser_bin:
            try:
                print(f"[POMUS] Opening app window via {browser_name}...")
                proc = subprocess.Popen(
                    [browser_bin, f"--app={url}"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                proc.wait()
                return True
            except Exception:
                continue

    # Last resort: default web browser
    print(f"[POMUS] Opening in default browser: {url}")
    webbrowser.open(url)
    return True


# Built-in Install/Uninstall Commands

def run_install():
    """Runs install.sh from the project directory."""
    script = os.path.join(DIRECTORY, "install.sh")
    if not os.path.isfile(script):
        print("[POMUS] Error: install.sh not found.")
        sys.exit(1)
    os.execv("/bin/bash", ["/bin/bash", script])


def run_uninstall():
    """Runs uninstall.sh from the project directory."""
    script = os.path.join(DIRECTORY, "uninstall.sh")
    if not os.path.isfile(script):
        print("[POMUS] Error: uninstall.sh not found.")
        sys.exit(1)
    os.execv("/bin/bash", ["/bin/bash", script])


# Main Entry Point

def main():
    parser = argparse.ArgumentParser(description="Pomus - Focus & Productivity")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Local server port")
    parser.add_argument("--browser", action="store_true", help="Force opening in a regular browser")
    parser.add_argument("--minimized", action="store_true", help="Start minimized to the system tray")
    parser.add_argument("--no-tray", action="store_true", help="Disable the system tray icon")
    parser.add_argument("--install", action="store_true", help="Install Pomus as a system application")
    parser.add_argument("--uninstall", action="store_true", help="Uninstall Pomus from the system")
    args = parser.parse_args()

    # Install/uninstall commands
    if args.install:
        run_install()
        return
    if args.uninstall:
        run_uninstall()
        return

    # Enforce single instance: if Pomus is already running, bring its window to the front and exit
    if try_activate_existing_instance():
        print("[POMUS] App is already running. Bringing its window to the front.")
        return

    # Ensure XDG integration (icons in hicolor and pixmaps, pomus.desktop)
    ensure_desktop_integration()

    port = find_available_port(args.port)
    url = f"http://127.0.0.1:{port}"

    print("-" * 55)
    print("POMUS - FOCUS & PRODUCTIVITY")
    print("-" * 55)
    print(f"Local server running at: {url}")
    print(f"Data stored at:          {ACTIVE_DATA_FILE}")
    print("Press Ctrl+C at any time to quit.")
    print("-" * 55)

    server = start_local_server(port)

    # Graceful shutdown on SIGTERM/SIGINT
    def handle_signal(signum, frame):
        print("\n[POMUS] Signal received. Shutting down and saving state...")
        _flush_persistence(_main_webview)
        if os.path.exists(SOCKET_PATH):
            try:
                os.remove(SOCKET_PATH)
            except Exception:
                pass
        try:
            server.shutdown()
        except Exception:
            pass
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    try:
        if not args.browser:
            success = launch_gtk_webkit(
                url,
                start_minimized=args.minimized,
                enable_tray=not args.no_tray
            )
            if not success:
                launch_browser_app_mode(url)
        else:
            time.sleep(0.3)
            webbrowser.open(url)
            while True:
                time.sleep(1)

    except KeyboardInterrupt:
        pass
    finally:
        print("\n[POMUS] Shutting down server and app.")
        _flush_persistence(_main_webview)
        if os.path.exists(SOCKET_PATH):
            try:
                os.remove(SOCKET_PATH)
            except Exception:
                pass
        try:
            server.shutdown()
        except Exception:
            pass
        sys.exit(0)


if __name__ == "__main__":
    main()
