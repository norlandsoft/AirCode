import logging
from pathlib import Path

logger = logging.getLogger(__name__)

LANGUAGE_MAP: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".jsx": "javascript",
    ".json": "json",
    ".md": "markdown",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".sql": "sql",
    ".sh": "shell",
    ".bash": "shell",
    ".zsh": "shell",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".toml": "ini",
    ".ini": "ini",
    ".cfg": "ini",
    ".conf": "ini",
    ".dockerfile": "dockerfile",
    ".makefile": "makefile",
}

MAX_PREVIEW_SIZE = 2 * 1024 * 1024  # 2MB


class EditorApi:
    """File editing operations for the code editor."""

    def __init__(self, root_api) -> None:
        self._api = root_api

    def read_file(self, file_path: str) -> dict:
        """Read file content with metadata for the editor."""
        try:
            path = Path(file_path).expanduser().resolve()
            if not path.exists():
                return {"error": f"File not found: {path}"}
            if not path.is_file():
                return {"error": f"Not a file: {path}"}

            stat = path.stat()
            if stat.st_size > MAX_PREVIEW_SIZE:
                return {"error": f"File too large: {stat.st_size} bytes (max {MAX_PREVIEW_SIZE})"}

            try:
                content = path.read_text(encoding="utf-8")
                encoding = "utf-8"
            except UnicodeDecodeError:
                content = path.read_text(encoding="latin-1")
                encoding = "latin-1"

            suffix = path.suffix.lower()
            if not suffix and path.name in ("Makefile", "Dockerfile", "Rakefile", "Gemfile"):
                language = LANGUAGE_MAP.get(f".{path.name.lower()}", "plaintext")
            else:
                language = LANGUAGE_MAP.get(suffix, "plaintext")

            return {
                "content": content,
                "path": str(path),
                "name": path.name,
                "language": language,
                "encoding": encoding,
                "size": stat.st_size,
                "modified": stat.st_mtime,
            }
        except PermissionError:
            return {"error": f"Permission denied: {file_path}"}
        except Exception as e:
            logger.exception("read_file failed")
            return {"error": str(e)}

    def write_file(self, file_path: str, content: str) -> dict:
        """Write content to a file."""
        try:
            path = Path(file_path).expanduser().resolve()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            stat = path.stat()
            return {
                "success": True,
                "path": str(path),
                "size": stat.st_size,
                "modified": stat.st_mtime,
            }
        except PermissionError:
            return {"error": f"Permission denied: {file_path}"}
        except Exception as e:
            logger.exception("write_file failed")
            return {"error": str(e)}

    def search_in_project(self, project_path: str, query: str, file_pattern: str = "*") -> dict:
        """Search for text in project files."""
        try:
            root = Path(project_path).expanduser().resolve()
            if not root.is_dir():
                return {"error": f"Not a directory: {root}"}

            results = []
            for path in root.rglob(file_pattern):
                parts = path.relative_to(root).parts
                if any(p.startswith(".") or p in ("node_modules", "__pycache__", "venv", ".venv") for p in parts):
                    continue
                if not path.is_file():
                    continue
                if path.stat().st_size > MAX_PREVIEW_SIZE:
                    continue

                try:
                    text = path.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue

                for line_no, line in enumerate(text.splitlines(), 1):
                    if query.lower() in line.lower():
                        results.append({
                            "file": str(path.relative_to(root)),
                            "path": str(path),
                            "line": line_no,
                            "text": line.strip(),
                        })
                        if len(results) >= 500:
                            return {"results": results, "truncated": True}

            return {"results": results, "truncated": False, "count": len(results)}
        except Exception as e:
            logger.exception("search_in_project failed")
            return {"error": str(e)}

    def get_language(self, file_path: str) -> dict:
        """Get Monaco language identifier for a file."""
        path = Path(file_path)
        suffix = path.suffix.lower()
        language = LANGUAGE_MAP.get(suffix, "plaintext")
        return {"language": language, "path": str(path)}
