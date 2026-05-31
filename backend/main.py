import functools
import http.server
import logging
import os
import sys
import threading
from pathlib import Path

import webview

# Resolve base path: PyInstaller bundle vs. source tree
if getattr(sys, "frozen", False):
    BASE_PATH = Path(sys._MEIPASS)
else:
    BASE_PATH = Path(__file__).parent.parent

sys.path.insert(0, str(BASE_PATH))

from backend.api import Api

logging.basicConfig(
    level=logging.DEBUG if os.environ.get("AIRCODE_DEV") else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DEV_MODE = os.environ.get("AIRCODE_DEV") == "1"


def start_static_server(directory: str, port: int = 0) -> int:
    """Start a local HTTP server to serve frontend static files."""
    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler, directory=directory
    )
    server = http.server.HTTPServer(("127.0.0.1", port), handler)
    actual_port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return actual_port


def get_frontend_url() -> str:
    if DEV_MODE:
        return "http://localhost:5173"
    dist_dir = str(BASE_PATH / "frontend" / "dist")
    port = start_static_server(dist_dir)
    logger.info("Static file server started on port %d", port)
    return f"http://127.0.0.1:{port}"


def main() -> None:
    api = Api()
    url = get_frontend_url()

    logger.info("Starting AirCode (dev=%s, url=%s)", DEV_MODE, url)

    window = webview.create_window(
        title="AirCode",
        url=url,
        js_api=api,
        width=1400,
        height=900,
        min_size=(900, 600),
    )
    api.set_window(window)

    webview.start(debug=DEV_MODE)
    logger.info("AirCode shut down")


if __name__ == "__main__":
    main()
