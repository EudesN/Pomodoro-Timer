"""Tests for the local HTTP server in app.py: API protection, static file whitelist and persistence."""

import http.client
import json
import os
import sys
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# app.py resolves its data paths at import time: point them at a throwaway directory first
_TMP = tempfile.TemporaryDirectory()
os.environ["XDG_DATA_HOME"] = os.path.join(_TMP.name, "data")
os.environ["XDG_RUNTIME_DIR"] = _TMP.name
sys.path.insert(0, ROOT)

import app  # noqa: E402


class ServerTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = app.start_local_server(0)
        cls.port = cls.server.server_address[1]
        cls.origin = f"http://127.0.0.1:{cls.port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def request(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        all_headers = {"Host": f"127.0.0.1:{self.port}"}
        all_headers.update(headers or {})
        conn.request(method, path, body=body, headers=all_headers)
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        return resp, data

    def post_json(self, path, payload, headers=None):
        all_headers = {"Content-Type": "application/json", "Origin": self.origin}
        all_headers.update(headers or {})
        return self.request("POST", path, json.dumps(payload).encode(), all_headers)


class StaticFilesTest(ServerTestCase):
    def test_serves_the_web_app(self):
        for path in ("/", "/index.html", "/js/app.js", "/css/styles.css", "/assets/icon.svg"):
            with self.subTest(path=path):
                resp, _ = self.request("GET", path)
                self.assertEqual(resp.status, 200)

    def test_does_not_expose_project_files(self):
        for path in ("/app.py", "/.git/config", "/install.sh", "/README.md"):
            with self.subTest(path=path):
                resp, _ = self.request("GET", path)
                self.assertEqual(resp.status, 404)

    def test_blocks_path_traversal(self):
        for path in ("/js/../app.py", "/js/%2e%2e/app.py", "/css/../.git/config"):
            with self.subTest(path=path):
                resp, _ = self.request("GET", path)
                self.assertEqual(resp.status, 404)

    def test_no_directory_listing(self):
        resp, _ = self.request("GET", "/js/")
        self.assertEqual(resp.status, 404)

    def test_fonts_have_a_font_mime_type(self):
        resp, _ = self.request("GET", "/assets/fonts/manrope-latin-wght-normal.woff2")
        self.assertEqual(resp.status, 200)
        self.assertEqual(resp.getheader("Content-Type"), "font/woff2")


class ApiProtectionTest(ServerTestCase):
    def test_rejects_foreign_host_header(self):
        # DNS rebinding: another site's hostname resolving to 127.0.0.1
        resp, _ = self.request("GET", "/api/sync", headers={"Host": f"evil.example:{self.port}"})
        self.assertEqual(resp.status, 403)

    def test_rejects_cross_origin_writes(self):
        resp, _ = self.post_json("/api/sync", {"tasks": []}, headers={"Origin": "https://evil.example"})
        self.assertEqual(resp.status, 403)

    def test_sends_no_cors_headers(self):
        resp, _ = self.request("GET", "/api/sync")
        self.assertIsNone(resp.getheader("Access-Control-Allow-Origin"))

    def test_rejects_invalid_payloads(self):
        for body in (b"not json", b"[1, 2]", b""):
            with self.subTest(body=body):
                resp, _ = self.request("POST", "/api/sync", body, {"Content-Type": "application/json", "Origin": self.origin})
                self.assertEqual(resp.status, 400)


class PersistenceTest(ServerTestCase):
    def test_sync_round_trip(self):
        payload = {"tasks": [{"id": "t1", "title": "Ação ✓"}], "settings": {"workTime": 30}}
        resp, _ = self.post_json("/api/sync", payload)
        self.assertEqual(resp.status, 200)

        resp, data = self.request("GET", "/api/sync")
        self.assertEqual(resp.status, 200)
        self.assertEqual(json.loads(data), payload)

    def test_atomic_write_leaves_no_temp_files(self):
        self.post_json("/api/sync", {"tasks": []})
        leftovers = [f for f in os.listdir(os.path.dirname(app.ACTIVE_DATA_FILE)) if f.endswith(".tmp")]
        self.assertEqual(leftovers, [])


class SoundNameTest(unittest.TestCase):
    def test_only_simple_sound_names_are_accepted(self):
        self.assertTrue(app.SOUND_NAME_RE.match("bell"))
        for name in ("../../etc/passwd", "a/b", "", "x" * 40):
            with self.subTest(name=name):
                self.assertIsNone(app.SOUND_NAME_RE.match(name))


if __name__ == "__main__":
    unittest.main()
