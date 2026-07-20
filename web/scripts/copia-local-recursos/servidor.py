"""
Servidor de la copia local de Carnet B.

Sirve la web y sus datos en http://localhost:8724 y, además, regenera el
paquete descargable en /descargar/carnet-b-local.zip — así cualquier copia
puede a su vez compartirse: quien la reciba verá también el apartado
«Copia local» y podrá descargarse la suya.

Solo usa la biblioteca estándar de Python. Lo arrancan «Iniciar web.bat»
(Windows) o «iniciar-web.sh» (Linux/macOS/Android-Termux), pero también vale:

    python servidor.py
"""
import http.server
import mimetypes
import os
import socket
import tempfile
import threading
import zipfile

PUERTO = 8724
RAIZ = os.path.dirname(os.path.abspath(__file__))
RUTA_ZIP = "/descargar/carnet-b-local.zip"

mimetypes.add_type("image/webp", ".webp")

_candado_zip = threading.Lock()
_zip_generado = None


def generar_zip():
    """Empaqueta esta carpeta (una sola vez; se cachea en la carpeta temporal)."""
    global _zip_generado
    with _candado_zip:
        if _zip_generado and os.path.exists(_zip_generado):
            return _zip_generado
        destino = os.path.join(tempfile.gettempdir(), "carnet-b-local.zip")
        print("Generando el paquete descargable (solo la primera vez)...")
        with zipfile.ZipFile(destino, "w", zipfile.ZIP_STORED) as z:
            for base, _dirs, archivos in os.walk(RAIZ):
                for nombre in sorted(archivos):
                    ruta = os.path.join(base, nombre)
                    rel = os.path.relpath(ruta, RAIZ).replace(os.sep, "/")
                    z.write(ruta, rel)
        _zip_generado = destino
        return destino


class Manejador(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RAIZ, **kwargs)

    def do_GET(self):
        ruta = self.path.split("?")[0]
        if ruta == "/descargar/disponible":
            self.send_response(204)
            self.end_headers()
            return
        if ruta == RUTA_ZIP:
            self.enviar_zip()
            return
        super().do_GET()

    def enviar_zip(self):
        archivo = generar_zip()
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Length", str(os.path.getsize(archivo)))
        self.send_header("Content-Disposition", 'attachment; filename="carnet-b-local.zip"')
        self.end_headers()
        with open(archivo, "rb") as f:
            while True:
                trozo = f.read(256 * 1024)
                if not trozo:
                    break
                try:
                    self.wfile.write(trozo)
                except (ConnectionError, BrokenPipeError):
                    return  # descarga cancelada

    def log_message(self, formato, *args):
        pass  # sin ruido por cada archivo servido


def ip_de_red():
    """IP local para abrir la web desde otro dispositivo (móvil, tablet)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))  # no envía nada: solo elige interfaz
            return s.getsockname()[0]
    except OSError:
        return None


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("", PUERTO), Manejador) as servidor:
        print(f"Carnet B sirviéndose en http://localhost:{PUERTO} (Ctrl+C para parar)")
        ip = ip_de_red()
        if ip:
            print(f"Desde otro dispositivo de tu red (móvil, tablet): http://{ip}:{PUERTO}")
        try:
            servidor.serve_forever()
        except KeyboardInterrupt:
            pass
