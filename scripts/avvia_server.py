#!/usr/bin/env python3
"""
Avvia un server web locale per l'app "Lavoro & Concorsi per Me".
Uso: python scripts/avvia_server.py
"""

import http.server
import socket
import socketserver
import os
import sys
import webbrowser
import urllib.request
from pathlib import Path

PORTA_PREFERITA = 8080
PORTA_ALTERNATIVE = range(8765, 8786)
ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        percorso = self.path.split("?", 1)[0]
        if percorso in ("", "/"):
            self.path = "/index.html" + (("?" + self.path.split("?", 1)[1]) if "?" in self.path else "")
        return super().do_GET()


class AppTCPServer(socketserver.ThreadingTCPServer):
    # Multi-thread: serve più richieste insieme (browser + risorse) senza bloccarsi.
    allow_reuse_address = sys.platform != "win32"
    daemon_threads = True


def verifica_index():
    index = ROOT / "index.html"
    if not index.is_file():
        print(f"\n  ERRORE: manca {index}")
        print("  Avvia lo script dalla cartella principale del progetto.\n")
        sys.exit(1)


def e_nostra_app(porta):
    url = f"http://127.0.0.1:{porta}/index.html"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "LavoroConcorsi/1.0"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            if resp.status != 200:
                return False
            body = resp.read(12000)
            return b"Lavoro" in body or b"lista-offerte" in body
    except Exception:
        return False


def porta_bind_libera(porta):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if sys.platform == "win32":
            try:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            except AttributeError:
                pass
        else:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("", porta))
            return True
        except OSError:
            return False


def trova_server_gia_avviato():
    if e_nostra_app(PORTA_PREFERITA):
        return PORTA_PREFERITA
    for porta in PORTA_ALTERNATIVE:
        if e_nostra_app(porta):
            return porta
    return None


def trova_porta_libera():
    for porta in [PORTA_PREFERITA, *PORTA_ALTERNATIVE]:
        if not porta_bind_libera(porta):
            continue
        return AppTCPServer(("", porta), Handler), porta
    raise OSError("Impossibile avviare il server. Chiudi altre finestre del server o riavvia il PC.")


def apri_browser(porta):
    url = f"http://localhost:{porta}/index.html"
    try:
        webbrowser.open(url)
    except Exception:
        pass
    return url


def main():
    verifica_index()
    os.chdir(ROOT)

    esistente = trova_server_gia_avviato()
    if esistente is not None:
        url = apri_browser(esistente)
        print("\n  Lavoro & Concorsi per Me – server già attivo")
        print(f"  Apro il browser su: {url}")
        print("  (Chiudi la finestra nera del server per fermarlo)\n")
        return

    httpd, porta = trova_porta_libera()
    url = apri_browser(porta)

    print("\n  Lavoro & Concorsi per Me – server avviato")
    print(f"  Cartella servita: {ROOT}")
    print(f"  Apri nel browser: {url}")
    if porta != PORTA_PREFERITA:
        print(f"  (Porta {PORTA_PREFERITA} occupata, uso {porta})")
    print("\n  Premi Ctrl+C in questa finestra per fermare il server.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server arrestato.\n")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
