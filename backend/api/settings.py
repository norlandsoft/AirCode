import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Default values for a fresh settings.json
DEFAULT_SETTINGS: dict[str, Any] = {
    "version": 1,
    "theme": "dark",
    "fontSize": 16,
    "terminal": {
        "shell": "/bin/zsh",
        "fontSize": 14,
    },
    "editor": {
        "tabSize": 2,
        "wordWrap": True,
        "fontSize": 14,
    },
    "recentProjects": [],
    "window": {
        "width": 1400,
        "height": 900,
    },
}

DEFAULT_SECRETS: dict[str, Any] = {
    "gitTokens": {},
    "sshKeyPath": None,
    "customTokens": {},
}


def _deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge override into base, returning a new dict."""
    result = {**base}
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


class SettingsApi:
    """Manages persistent storage in ~/.aircode/ as JSON files."""

    def __init__(self) -> None:
        self._base_dir = Path.home() / ".aircode"

    # ---- Directory helpers ----

    def _ensure_dirs(self) -> None:
        """Create ~/.aircode/ and subdirectories if they don't exist."""
        for subdir in ("projects", "workspaces"):
            (self._base_dir / subdir).mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _hash_path(path: str) -> str:
        """Return first 12 chars of SHA256 hex digest of the path."""
        return hashlib.sha256(path.encode("utf-8")).hexdigest()[:12]

    # ---- JSON read/write ----

    def _read_json(self, file_path: Path) -> dict:
        """Read a JSON file. Return empty dict if it doesn't exist."""
        if not file_path.exists():
            return {}
        try:
            text = file_path.read_text(encoding="utf-8")
            return json.loads(text)
        except (json.JSONDecodeError, OSError) as e:
            logger.error("Failed to read %s: %s", file_path, e)
            return {}

    def _write_json(self, file_path: Path, data: dict) -> dict:
        """Atomically write a JSON file. Returns {"success": True} or {"error": "..."}."""
        try:
            self._ensure_dirs()
            file_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = file_path.with_suffix(".tmp")
            tmp_path.write_text(
                json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            os.replace(str(tmp_path), str(file_path))
            return {"success": True}
        except OSError as e:
            logger.error("Failed to write %s: %s", file_path, e)
            return {"error": str(e)}

    # ---- Global settings ----

    def get_settings(self) -> dict:
        """Read global settings. Returns defaults merged with saved values."""
        path = self._base_dir / "settings.json"
        saved = self._read_json(path)
        if not saved:
            return {**DEFAULT_SETTINGS}
        return _deep_merge(DEFAULT_SETTINGS, saved)

    def update_settings(self, values: dict) -> dict:
        """Deep-merge partial values into settings and save."""
        current = self.get_settings()
        merged = _deep_merge(current, values)
        return self._write_json(self._base_dir / "settings.json", merged)

    # ---- Project config ----

    def get_project_config(self, project_path: str) -> dict:
        """Read per-project config."""
        h = self._hash_path(project_path)
        path = self._base_dir / "projects" / f"{h}.json"
        return self._read_json(path)

    def update_project_config(self, project_path: str, values: dict) -> dict:
        """Deep-merge partial values into project config and save."""
        h = self._hash_path(project_path)
        path = self._base_dir / "projects" / f"{h}.json"
        current = self._read_json(path)
        merged = _deep_merge(current, values)
        return self._write_json(path, merged)

    # ---- Workspace state ----

    def get_workspace(self, project_path: str) -> dict:
        """Read workspace state for a project."""
        h = self._hash_path(project_path)
        path = self._base_dir / "workspaces" / f"{h}.json"
        return self._read_json(path)

    def save_workspace(self, project_path: str, data: dict) -> dict:
        """Overwrite workspace state for a project."""
        h = self._hash_path(project_path)
        path = self._base_dir / "workspaces" / f"{h}.json"
        payload = {**data, "projectPath": project_path}
        return self._write_json(path, payload)

    # ---- Secrets ----

    def get_secrets(self) -> dict:
        """Read secrets.json."""
        path = self._base_dir / "secrets.json"
        return self._read_json(path) or {**DEFAULT_SECRETS}

    def update_secrets(self, values: dict) -> dict:
        """Deep-merge partial values into secrets and save."""
        path = self._base_dir / "secrets.json"
        current = self.get_secrets()
        merged = _deep_merge(current, values)
        result = self._write_json(path, merged)
        # Ensure secrets file is only readable by owner
        try:
            os.chmod(str(path), 0o600)
        except OSError:
            pass
        return result
