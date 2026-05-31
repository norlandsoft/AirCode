import logging
import os
import sys
from pathlib import Path

import webview

# Add project root to Python path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.api import Api

logging.basicConfig(
    level=logging.DEBUG if os.environ.get("AIRCODE_DEV") else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DEV_MODE = os.environ.get("AIRCODE_DEV") == "1"


def get_frontend_url() -> str:
    if DEV_MODE:
        return "http://localhost:5173"
    return str(PROJECT_ROOT / "frontend" / "dist" / "index.html")


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
