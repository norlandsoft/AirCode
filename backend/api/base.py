import logging
import os
import platform
from pathlib import Path

import webview

logger = logging.getLogger(__name__)


class Api:
    """Root API class exposed to frontend via pywebview.api."""

    def __init__(self) -> None:
        self._window: webview.Window | None = None
        from .project import ProjectApi
        from .editor import EditorApi
        from .terminal import TerminalApi
        from .git import GitApi
        from .settings import SettingsApi
        self.project = ProjectApi(self)
        self.editor = EditorApi(self)
        self.terminal = TerminalApi(self)
        self.git = GitApi(self)
        self.settings = SettingsApi()

    def set_window(self, window: webview.Window) -> None:
        self._window = window

    def get_platform(self) -> dict:
        return {
            "system": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
            "python_version": platform.python_version(),
        }

    def get_app_info(self) -> dict:
        return {
            "name": "AirCode",
            "version": "0.1.0",
            "dev_mode": os.environ.get("AIRCODE_DEV", "") == "1",
        }

    def open_file_dialog(self) -> dict:
        if not self._window:
            return {"error": "Window not initialized"}
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            directory=str(Path.home()),
        )
        if result and len(result) > 0:
            return {"path": result[0]}
        return {"path": None}

    def open_folder_dialog(self) -> dict:
        if not self._window:
            return {"error": "Window not initialized"}
        result = self._window.create_file_dialog(
            webview.FOLDER_DIALOG,
            directory=str(Path.home()),
        )
        if result and len(result) > 0:
            return {"path": result[0]}
        return {"path": None}

    def _evaluate_js(self, code: str) -> None:
        if self._window:
            self._window.evaluate_js(code)
