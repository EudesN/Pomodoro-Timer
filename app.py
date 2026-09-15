#!/usr/bin/env python3
"""
Pomus - Aplicativo Desktop de Foco e Produtividade
Inicia o servidor local integrado e renderiza a aplicação em uma janela desktop nativa (GTK3 + WebKit2).
Inclui suporte completo a tela cheia (F11), bridge de som nativo (PipeWire / PulseAudio),
notificações nativas do Linux (libnotify), bandeja do sistema (AppIndicator),
sincronização de persistência em disco e integração XDG.
"""

import argparse
import http.server
import json
import os
import shutil
import signal
import socket
import socketserver
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser

# Previne telas brancas no WebKitGTK sob Wayland, compositores modernos e drivers Mesa/Nvidia
if "WEBKIT_DISABLE_DMABUF_RENDERER" not in os.environ:
    os.environ["WEBKIT_DISABLE_DMABUF_RENDERER"] = "1"

# ── Identidade do processo para Wayland / KDE Plasma / Docks ──
# CRUCIAL: Definir prgname antes de qualquer chamada ao GLib/GTK para que
# o app_id da janela Wayland seja 'pomus', correspondendo ao pomus.desktop
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

# ─── XDG Data Directory ───────────────────────────────────────────────────────
XDG_DATA_HOME = os.environ.get("XDG_DATA_HOME", os.path.join(os.path.expanduser("~"), ".local", "share"))
XDG_POMUS_DIR = os.path.join(XDG_DATA_HOME, "pomus")
XDG_RUNTIME_DIR = os.environ.get("XDG_RUNTIME_DIR")
SOCKET_DIR = XDG_RUNTIME_DIR if (XDG_RUNTIME_DIR and os.path.isdir(XDG_RUNTIME_DIR)) else XDG_POMUS_DIR
SOCKET_PATH = os.path.join(SOCKET_DIR, "pomus.sock")

_main_window = None


def _show_and_present_window(window):
    """Traz a janela do Pomus para o primeiro plano, desminimiza e foca."""
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


def try_activate_existing_instance():
    """
    Verifica se já existe uma instância do Pomus rodando.
    Se existir, envia comando para focar a janela e retorna True.
    """
    # Tentativa 1: Unix Domain Socket
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

    # Tentativa 2: Endpoint HTTP local /api/show
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
    """Inicia um socket UNIX em segundo plano para escutar solicitações de foco de novas instâncias."""
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
                            GLib.idle_add(_show_and_present_window, window)
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
        print(f"[POMUS] Aviso ao iniciar socket de instância única: {e}")
        return None


def get_data_file_path():
    """Retorna o caminho do arquivo de dados, migrando para XDG se necessário."""
    xdg_data_file = os.path.join(XDG_POMUS_DIR, "pomus_data.json")

    # Se já existe no diretório XDG, usar ele
    if os.path.isfile(xdg_data_file):
        return xdg_data_file

    # Se existe o arquivo local legado, migrar para XDG
    if os.path.isfile(DATA_FILE):
        try:
            os.makedirs(XDG_POMUS_DIR, exist_ok=True)
            shutil.copy2(DATA_FILE, xdg_data_file)
            print(f"[POMUS] Dados migrados para: {xdg_data_file}")
            return xdg_data_file
        except Exception as e:
            print(f"[POMUS] Falha ao migrar dados para XDG ({e}), usando arquivo local.")
            return DATA_FILE

    # Nenhum arquivo existe ainda, criar no diretório XDG
    os.makedirs(XDG_POMUS_DIR, exist_ok=True)
    return xdg_data_file


# Resolve o caminho de dados na inicialização
ACTIVE_DATA_FILE = get_data_file_path()


def ensure_desktop_integration():
    """Garante que ícones e .desktop estejam instalados no ambiente do usuário (XDG)."""
    try:
        apps_dir = os.path.join(XDG_DATA_HOME, "applications")
        pixmaps_dir = os.path.join(XDG_DATA_HOME, "pixmaps")
        icons_base = os.path.join(XDG_DATA_HOME, "icons", "hicolor")

        os.makedirs(apps_dir, exist_ok=True)
        os.makedirs(pixmaps_dir, exist_ok=True)

        # 1. Copiar para pixmaps (fallback universal para docks no KDE, GNOME, XFCE)
        if os.path.isfile(ICON_PATH):
            shutil.copy2(ICON_PATH, os.path.join(pixmaps_dir, "pomus.png"))
        if os.path.isfile(ICON_SVG_PATH):
            shutil.copy2(ICON_SVG_PATH, os.path.join(pixmaps_dir, "pomus.svg"))

        # 2. Instalar no tema hicolor (scalable e 512x512)
        if os.path.isfile(ICON_SVG_PATH):
            scalable_dir = os.path.join(icons_base, "scalable", "apps")
            os.makedirs(scalable_dir, exist_ok=True)
            shutil.copy2(ICON_SVG_PATH, os.path.join(scalable_dir, "pomus.svg"))

        if os.path.isfile(ICON_PATH):
            hicolor_512 = os.path.join(icons_base, "512x512", "apps")
            os.makedirs(hicolor_512, exist_ok=True)
            shutil.copy2(ICON_PATH, os.path.join(hicolor_512, "pomus.png"))

        # 3. Gerar/Atualizar pomus.desktop
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

        # 4. Atualizar caches se ferramentas existirem
        for cmd in [["update-desktop-database", apps_dir], ["gtk-update-icon-cache", "-f", "-t", icons_base]]:
            if shutil.which(cmd[0]):
                try:
                    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass
    except Exception as e:
        print(f"[POMUS] Aviso na integração desktop: {e}")


# ─── Notificações Nativas do Linux ────────────────────────────────────────────
_notify_initialized = False


def init_native_notifications():
    """Inicializa o sistema de notificações nativas via libnotify (gi.repository.Notify)."""
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
    """Envia uma notificação nativa do Linux usando libnotify ou fallback para notify-send."""
    icon = icon_path or ICON_PATH

    # Tentativa 1: libnotify via GObject Introspection
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

    # Tentativa 2: fallback para notify-send CLI
    notify_bin = shutil.which("notify-send")
    if notify_bin:
        try:
            cmd = [notify_bin, "--app-name=Popomus", "-i", icon, title, body]
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except Exception:
            pass

    return False


# ─── Reprodução de Áudio Nativo ───────────────────────────────────────────────

def play_sound_native(sound_name, volume=0.8):
    """Reproduz som nativo no Linux utilizando pw-play, paplay ou canberra."""
    if volume <= 0:
        return

    sound_file = os.path.join(SOUNDS_DIR, f"{sound_name}.wav")
    if not os.path.isfile(sound_file):
        if sound_name in ("click", "pop", "tap"):
            sound_file = os.path.join(SOUNDS_DIR, "tick.wav")
        else:
            sound_file = os.path.join(SOUNDS_DIR, "bell.wav")
    if not os.path.isfile(sound_file):
        return

    players = [
        ["pw-play", sound_file],
        ["paplay", sound_file],
        ["canberra-gtk-play", "-f", sound_file],
        ["mpv", "--no-video", "--volume=" + str(max(1, int(volume * 100))), sound_file]
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


# ─── Servidor HTTP Integrado ──────────────────────────────────────────────────

class PomusHTTPHandler(http.server.SimpleHTTPRequestHandler):
    """Servidor HTTP integrado com API de áudio, notificações e persistência em disco."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Mantém o console limpo
        pass

    def end_headers(self):
        # Adiciona cabeçalhos CORS e no-cache para requisições de API
        if self.path.startswith("/api/"):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # Endpoint de áudio nativo: /api/play-sound?sound=bell&volume=0.8
        if parsed.path == "/api/play-sound":
            params = urllib.parse.parse_qs(parsed.query)
            sound_name = params.get("sound", ["bell"])[0]
            try:
                vol = float(params.get("volume", ["0.8"])[0])
            except ValueError:
                vol = 0.8
            threading.Thread(target=play_sound_native, args=(sound_name, vol), daemon=True).start()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            return

        # Endpoint de sincronização (leitura): /api/sync
        if parsed.path == "/api/sync":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            if os.path.isfile(ACTIVE_DATA_FILE):
                try:
                    with open(ACTIVE_DATA_FILE, "rb") as f:
                        self.wfile.write(f.read())
                    return
                except Exception:
                    pass
            self.wfile.write(b'{}')
            return

        # Arquivos estáticos comuns
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # Endpoint de sincronização (gravação): /api/sync
        if parsed.path == "/api/sync":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                with open(ACTIVE_DATA_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status":"saved"}')
                return
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                return

        # Endpoint de notificação nativa: /api/notify
        if parsed.path == "/api/notify":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                title = data.get("title", "Popomus")
                msg = data.get("body", "")
                threading.Thread(
                    target=send_native_notification,
                    args=(title, msg),
                    daemon=True
                ).start()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status":"ok"}')
                return
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                return

        # Endpoint para focar janela existente (instância única): /api/show
        if parsed.path == "/api/show":
            global _main_window
            if _main_window:
                try:
                    from gi.repository import GLib
                    GLib.idle_add(_show_and_present_window, _main_window)
                except Exception:
                    pass
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"focused"}')
            return

        self.send_response(404)
        self.end_headers()


def find_available_port(start_port=DEFAULT_PORT, max_tries=30):
    """Encontra uma porta TCP local disponível."""
    for port in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start_port


class PomusTCPServer(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


def start_local_server(port):
    """Inicia o servidor HTTP multithreaded em segundo plano em uma thread daemon."""
    server = PomusTCPServer(("127.0.0.1", port), PomusHTTPHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    return server


# ─── Bandeja do Sistema (System Tray / AppIndicator) ──────────────────────────

_tray_indicator = None


def setup_system_tray(window=None, gtk_module=None):
    """
    Configura ícone na bandeja do sistema com menu de contexto.
    Usa AyatanaAppIndicator3 com fallback para AppIndicator3.
    Retorna True se a bandeja foi inicializada com sucesso.
    """
    global _tray_indicator
    try:
        import gi
        Gtk = gtk_module
        if Gtk is None:
            gi.require_version("Gtk", "3.0")
            from gi.repository import Gtk

        # Tenta AyatanaAppIndicator3 (padrão moderno) ou AppIndicator3
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

        # Usa o ícone SVG ou PNG do projeto
        icon_for_tray = ICON_SVG_PATH if os.path.isfile(ICON_SVG_PATH) else ICON_PATH

        indicator = AppIndicator.Indicator.new(
            "pomus",
            icon_for_tray,
            AppIndicator.IndicatorCategory.APPLICATION_STATUS
        )
        indicator.set_status(AppIndicator.IndicatorStatus.ACTIVE)
        indicator.set_title("Popomus")

        # Menu de contexto
        menu = Gtk.Menu()

        item_show = Gtk.MenuItem(label="Abrir Popomus")
        item_show.connect("activate", lambda _: _tray_show_window(window))
        menu.append(item_show)

        item_hide = Gtk.MenuItem(label="Minimizar para Bandeja")
        item_hide.connect("activate", lambda _: _tray_hide_window(window))
        menu.append(item_hide)

        menu.append(Gtk.SeparatorMenuItem())

        item_quit = Gtk.MenuItem(label="Sair")
        item_quit.connect("activate", lambda _: _tray_quit(Gtk))
        menu.append(item_quit)

        menu.show_all()
        indicator.set_menu(menu)

        _tray_indicator = indicator
        return True

    except Exception as e:
        print(f"[POMUS] Bandeja do sistema não disponível ({e}).")
        return False


def _tray_show_window(window):
    """Mostra e foca a janela do Pomus."""
    if window:
        window.present()
        window.show_all()


def _tray_hide_window(window):
    """Oculta a janela do Pomus (mantém na bandeja)."""
    if window:
        window.hide()


def _tray_quit(Gtk):
    """Encerra a aplicação pela bandeja."""
    Gtk.main_quit()


# ─── Janela Nativa GTK3 + WebKit2 ────────────────────────────────────────────

def launch_gtk_webkit(url, start_minimized=False, enable_tray=True):
    """
    Inicializa e exibe a janela nativa do desktop utilizando PyGObject (GTK3 + WebKit2).
    Suporta F11 para tela cheia, bridge de som integrado, notificações nativas e
    bandeja do sistema.
    """
    try:
        import gi
        gi.require_version("Gtk", "3.0")
        from gi.repository import Gtk, Gdk, GdkPixbuf, GLib

        # ── Identidade do processo para Wayland / KDE Plasma ──
        GLib.set_prgname("pomus")
        GLib.set_application_name("Popomus")

        # Tenta carregar WebKit2 4.1 ou 4.0
        try:
            gi.require_version("WebKit2", "4.1")
            from gi.repository import WebKit2
        except (ValueError, ImportError):
            gi.require_version("WebKit2", "4.0")
            from gi.repository import WebKit2

        # Inicialização do GTK
        if not Gtk.init_check()[0]:
            print("[POMUS] Falha ao inicializar display GTK.")
            return False

        # Configurar caminhos do tema de ícones
        icon_theme = Gtk.IconTheme.get_default()
        if icon_theme:
            icon_theme.append_search_path(ASSETS_DIR)
            icon_theme.append_search_path(os.path.join(XDG_DATA_HOME, "icons"))
            icon_theme.append_search_path(os.path.join(XDG_DATA_HOME, "pixmaps"))

        # Configurar ícone padrão global da aplicação
        Gtk.Window.set_default_icon_name("pomus")
        if os.path.isfile(ICON_PATH):
            try:
                Gtk.Window.set_default_icon_from_file(ICON_PATH)
            except Exception:
                pass

        # ── Tema escuro para combinar com a interface do Pomus ──
        gtk_settings = Gtk.Settings.get_default()
        if gtk_settings:
            gtk_settings.set_property("gtk-application-prefer-dark-theme", True)

        # Inicializar notificações nativas
        init_native_notifications()

        window = Gtk.Window(title="Popomus")
        window.set_default_size(600, 840)
        window.set_position(Gtk.WindowPosition.CENTER)
        window._is_fullscreen = False

        # ── Identidade da janela para o gerenciador de tarefas / dock ──
        window.set_role("pomus")
        window.set_wmclass("pomus", "pomus")
        window.set_icon_name("pomus")

        # Ícone nativo da aplicação com lista multi-resolução para docks
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

        # Configuração de persistência de dados do WebKit
        data_dir = os.path.join(XDG_POMUS_DIR, "webkit_data")
        cache_dir = os.path.join(XDG_POMUS_DIR, "webkit_cache")
        os.makedirs(data_dir, exist_ok=True)
        os.makedirs(cache_dir, exist_ok=True)

        try:
            data_manager = WebKit2.WebsiteDataManager(
                base_data_directory=data_dir,
                base_cache_directory=cache_dir,
                local_storage_directory=os.path.join(data_dir, "localstorage"),
                disk_cache_directory=os.path.join(cache_dir, "diskcache"),
            )
            context = WebKit2.WebContext.new_with_website_data_manager(data_manager)
            webview = WebKit2.WebView.new_with_context(context)
        except Exception:
            webview = WebKit2.WebView()

        settings = webview.get_settings()
        settings.set_enable_developer_extras(True)
        settings.set_enable_webgl(True)
        settings.set_enable_html5_local_storage(True)
        settings.set_enable_html5_database(True)
        # O backend Python nativo (/api/play-sound com PipeWire/PulseAudio) é responsável pelo áudio
        # Desativar webaudio/media interno do WebKit previne crashes do GStreamer no Linux
        settings.set_enable_webaudio(False)
        settings.set_enable_media(False)
        settings.set_enable_smooth_scrolling(True)

        def on_load_failed(wv, event, failing_uri, error):
            print(f"[POMUS] Erro ao carregar {failing_uri}: {error.message if hasattr(error, 'message') else error}")

        def on_web_process_terminated(wv, reason):
            print(f"[POMUS] Processo web finalizado ({reason}). Recarregando...")
            try:
                wv.reload()
            except Exception:
                wv.load_uri(url)

        webview.connect("load-failed", on_load_failed)
        webview.connect("web-process-terminated", on_web_process_terminated)

        webview.load_uri(url)
        window.add(webview)

        # Atalho F11 para alternar Tela Cheia na janela nativa
        def on_key_press(widget, event):
            if event.keyval == Gdk.KEY_F11:
                if window._is_fullscreen:
                    window.unfullscreen()
                    window._is_fullscreen = False
                else:
                    window.fullscreen()
                    window._is_fullscreen = True
                return True
            return False

        window.connect("key-press-event", on_key_press)

        # ── Bandeja do sistema ──
        tray_active = False
        if enable_tray:
            tray_active = setup_system_tray(window, Gtk)

        # Comportamento ao fechar: minimizar para bandeja se ativa, senão sair
        def on_delete_event(widget, event):
            if tray_active:
                widget.hide()
                return True  # Impede destruição, mantém na bandeja
            return False  # Permite destruir normalmente

        def on_destroy(widget):
            Gtk.main_quit()

        window.connect("delete-event", on_delete_event)
        window.connect("destroy", on_destroy)

        # ── Instância única e socket listener ──
        global _main_window
        _main_window = window
        start_single_instance_listener(window)

        # ── Exibir janela ──
        if start_minimized and tray_active:
            # Iniciar minimizado para bandeja
            pass
        else:
            window.show_all()

        tray_msg = " + Bandeja" if tray_active else ""
        print(f"[POMUS] Janela nativa iniciada com sucesso (GTK3 + WebKit2{tray_msg}).")
        print("[POMUS] Dica: Pressione F11 a qualquer momento para Tela Cheia.")
        Gtk.main()
        return True

    except Exception as e:
        print(f"[POMUS] GTK/WebKit2 não disponível ({e}). Ativando fallback...")
        return False


def launch_browser_app_mode(url):
    """
    Fallback: tenta abrir em modo de janela de aplicativo (--app)
    utilizando Brave, Chrome, Chromium ou Edge.
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
                print(f"[POMUS] Abrindo janela de aplicativo via {browser_name}...")
                proc = subprocess.Popen(
                    [browser_bin, f"--app={url}"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                proc.wait()
                return True
            except Exception:
                continue

    # Último recurso: navegador web padrão
    print(f"[POMUS] Abrindo no navegador padrão: {url}")
    webbrowser.open(url)
    return True


# ─── Comandos de Instalação/Desinstalação Integrados ─────────────────────────

def run_install():
    """Executa install.sh a partir do diretório do projeto."""
    script = os.path.join(DIRECTORY, "install.sh")
    if not os.path.isfile(script):
        print("[POMUS] Erro: install.sh não encontrado.")
        sys.exit(1)
    os.execv("/bin/bash", ["/bin/bash", script])


def run_uninstall():
    """Executa uninstall.sh a partir do diretório do projeto."""
    script = os.path.join(DIRECTORY, "uninstall.sh")
    if not os.path.isfile(script):
        print("[POMUS] Erro: uninstall.sh não encontrado.")
        sys.exit(1)
    os.execv("/bin/bash", ["/bin/bash", script])


# ─── Ponto de Entrada Principal ───────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Pomus - Foco e Produtividade")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Porta do servidor local")
    parser.add_argument("--browser", action="store_true", help="Forçar abertura em navegador comum")
    parser.add_argument("--minimized", action="store_true", help="Iniciar minimizado na bandeja do sistema")
    parser.add_argument("--no-tray", action="store_true", help="Desabilitar ícone na bandeja do sistema")
    parser.add_argument("--install", action="store_true", help="Instalar Pomus como aplicativo do sistema")
    parser.add_argument("--uninstall", action="store_true", help="Desinstalar Pomus do sistema")
    args = parser.parse_args()

    # Comandos de instalação/desinstalação
    if args.install:
        run_install()
        return
    if args.uninstall:
        run_uninstall()
        return

    # Garante instância única: se o Pomus já estiver rodando, traz a janela existente para frente e sai
    if try_activate_existing_instance():
        print("[POMUS] Aplicativo já está em execução. Trazendo janela para o primeiro plano.")
        return

    # Garante integração XDG (ícones em hicolor e pixmaps, pomus.desktop)
    ensure_desktop_integration()

    port = find_available_port(args.port)
    url = f"http://127.0.0.1:{port}"

    print("-" * 55)
    print("POMUS - FOCO E PRODUTIVIDADE")
    print("-" * 55)
    print(f"Servidor local ativo em: {url}")
    print(f"Dados armazenados em:    {ACTIVE_DATA_FILE}")
    print("Pressione Ctrl+C a qualquer momento para encerrar.")
    print("-" * 55)

    server = start_local_server(port)

    # Graceful shutdown com SIGTERM/SIGINT
    def handle_signal(signum, frame):
        print("\n[POMUS] Sinal recebido. Encerrando...")
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
        print("\n[POMUS] Encerrando servidor e aplicacao.")
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
