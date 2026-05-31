import logging
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)


class ProjectApi:
    """Manage projects — each project is a working directory."""

    def __init__(self, root_api) -> None:
        self._api = root_api

    def list_directory(self, dir_path: str) -> dict:
        """List contents of a directory with metadata."""
        try:
            path = Path(dir_path).expanduser().resolve()
            if not path.exists():
                return {"error": f"Path does not exist: {path}"}
            if not path.is_dir():
                return {"error": f"Path is not a directory: {path}"}

            entries = []
            for item in sorted(path.iterdir()):
                if item.name.startswith("."):
                    continue
                entries.append({
                    "name": item.name,
                    "path": str(item),
                    "is_dir": item.is_dir(),
                    "size": item.stat().st_size if item.is_file() else 0,
                    "modified": item.stat().st_mtime,
                })
            return {"entries": entries, "path": str(path)}
        except PermissionError:
            return {"error": f"Permission denied: {dir_path}"}
        except Exception as e:
            logger.exception("list_directory failed")
            return {"error": str(e)}

    def get_project_info(self, dir_path: str) -> dict:
        """Get metadata about a project directory."""
        try:
            path = Path(dir_path).expanduser().resolve()
            if not path.exists():
                return {"error": f"Path does not exist: {path}"}

            is_git = (path / ".git").exists()
            return {
                "name": path.name,
                "path": str(path),
                "is_git_repo": is_git,
                "exists": True,
            }
        except Exception as e:
            logger.exception("get_project_info failed")
            return {"error": str(e)}

    def create_file(self, dir_path: str, name: str, is_dir: bool = False) -> dict:
        """Create a new file or directory in a project."""
        try:
            target = Path(dir_path) / name
            if target.exists():
                return {"error": f"Already exists: {target}"}

            if is_dir:
                target.mkdir(parents=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.touch()
            return {"path": str(target), "name": name, "is_dir": is_dir}
        except Exception as e:
            logger.exception("create_file failed")
            return {"error": str(e)}

    def delete_item(self, item_path: str) -> dict:
        """Delete a file or directory."""
        try:
            path = Path(item_path).expanduser().resolve()
            if not path.exists():
                return {"error": f"Path does not exist: {path}"}

            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
            return {"success": True, "path": str(path)}
        except Exception as e:
            logger.exception("delete_item failed")
            return {"error": str(e)}

    def rename_item(self, old_path: str, new_name: str) -> dict:
        """Rename a file or directory."""
        try:
            old = Path(old_path).expanduser().resolve()
            if not old.exists():
                return {"error": f"Path does not exist: {old}"}
            new = old.parent / new_name
            if new.exists():
                return {"error": f"Target already exists: {new}"}
            old.rename(new)
            return {"old_path": str(old), "new_path": str(new)}
        except Exception as e:
            logger.exception("rename_item failed")
            return {"error": str(e)}
