# AirCode Python + PyWebView Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild AirCode as a Python + PyWebView desktop app with left project list panel and right tab workspace (terminal, editor, file viewer, git).

**Architecture:** Thin Python backend exposes system capabilities (file I/O, PTY, git) via `pywebview.api` bridge. React frontend owns all UI state via zustand stores. PyWebView window loads either Vite dev server (dev) or built static files (prod).

**Tech Stack:** Python 3.12, PyWebView, Vite, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Monaco Editor, xterm.js, PyInstaller

**Design Spec:** `docs/superpowers/specs/2026-05-31-python-pywebview-rebuild-design.md`

---

## File Map

### Backend (Python)

| File | Responsibility |
|------|---------------|
| `backend/main.py` | Entry point: create PyWebView window, wire up API |
| `backend/api/__init__.py` | Re-export Api class |
| `backend/api/base.py` | Root Api class, system dialogs, platform info |
| `backend/api/project.py` | ProjectApi: add/list/remove projects, folder picker |
| `backend/api/editor.py` | EditorApi: read/write/list files, search |
| `backend/api/terminal.py` | TerminalApi: PTY create/write/resize/destroy, streaming |
| `backend/api/git.py` | GitApi: status, log, diff, commit, branch |
| `backend/requirements.txt` | Python dependencies |

### Frontend (React + TypeScript)

| File | Responsibility |
|------|---------------|
| `frontend/src/main.tsx` | React entry point |
| `frontend/src/App.tsx` | Root layout: left panel + right panel |
| `frontend/src/lib/api.ts` | PyWebView bridge wrapper + mock API for dev |
| `frontend/src/lib/types.ts` | Shared TypeScript types (Tab, Project, etc.) |
| `frontend/src/stores/useProjectStore.ts` | Project list, current project |
| `frontend/src/stores/useTabStore.ts` | All open tabs, active tab |
| `frontend/src/stores/useEditorStore.ts` | Open file contents, dirty state |
| `frontend/src/stores/useTerminalStore.ts` | Terminal sessions |
| `frontend/src/components/layout/TitleBar.tsx` | Top title bar with app name |
| `frontend/src/components/layout/StatusBar.tsx` | Bottom status bar |
| `frontend/src/components/project/ProjectList.tsx` | Left panel: project list + add/remove |
| `frontend/src/components/workspace/TabBar.tsx` | Tab bar with close and add buttons |
| `frontend/src/components/workspace/Workspace.tsx` | Right panel container: TabBar + active tab content |
| `frontend/src/components/tabs/TerminalTab.tsx` | xterm.js terminal instance |
| `frontend/src/components/tabs/EditorTab.tsx` | Monaco Editor instance |
| `frontend/src/components/tabs/FileViewerTab.tsx` | File tree + read-only preview |
| `frontend/src/components/tabs/GitTab.tsx` | Git status/commit/log UI |
| `frontend/src/styles/index.css` | Tailwind imports + global styles |

### Build & Config

| File | Responsibility |
|------|---------------|
| `Makefile` | dev, build, clean targets |
| `scripts/setup.sh` | Init venv + install all deps |
| `.gitignore` | Ignore venv, node_modules, dist, release, __pycache__ |
| `CLAUDE.md` | Project conventions auto-generated |

---

## Task 1: Project Skeleton & Build Infrastructure

**Files:**
- Create: `.gitignore`
- Create: `backend/requirements.txt`
- Create: `backend/api/__init__.py`
- Create: `scripts/setup.sh`
- Create: `Makefile`

- [ ] **Step 1: Update .gitignore**

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/

# Node
node_modules/

# Build output
frontend/dist/
release/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store

# Misc
*.pem
.env
.env*.local
```

- [ ] **Step 2: Create backend/requirements.txt**

```txt
pywebview>=5.0
pyinstaller>=6.0
```

- [ ] **Step 3: Create backend/api/__init__.py**

```python
from .base import Api

__all__ = ["Api"]
```

- [ ] **Step 4: Create scripts/setup.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== AirCode Setup ==="

# Python virtual environment
if [ ! -d "$PROJECT_DIR/.venv/aircode" ]; then
    echo "Creating Python 3.12 virtual environment..."
    python3.12 -m venv "$PROJECT_DIR/.venv/aircode"
fi

echo "Installing Python dependencies..."
source "$PROJECT_DIR/.venv/aircode/bin/activate"
pip install --upgrade pip
pip install -r "$PROJECT_DIR/backend/requirements.txt"

# Frontend dependencies
if [ -f "$PROJECT_DIR/frontend/package.json" ]; then
    echo "Installing frontend dependencies..."
    cd "$PROJECT_DIR/frontend"
    npm install
fi

echo "=== Setup complete ==="
echo "Run 'make dev' to start development."
```

- [ ] **Step 5: Create Makefile**

```makefile
.PHONY: dev dev:fe dev:be build clean setup

PYTHON := .venv/aircode/bin/python
PIP    := .venv/aircode/bin/pip

setup:
	chmod +x scripts/setup.sh
	./scripts/setup.sh

dev: setup
	@echo "Starting development environment..."
	$(MAKE) dev:fe &
	$(MAKE) dev:be

dev:fe:
	@echo "Starting frontend dev server..."
	cd frontend && npm run dev

dev:be:
	@echo "Starting PyWebView backend..."
	AIRCODE_DEV=1 $(PYTHON) backend/main.py

build: setup
	@echo "Building frontend..."
	cd frontend && npm run build
	@echo "Building executable..."
	$(PYTHON) -m PyInstaller aircode.spec --noconfirm
	@echo "Build complete: release/"

clean:
	rm -rf frontend/dist
	rm -rf release
	rm -rf build
	rm -rf __pycache__
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
```

- [ ] **Step 6: Verify skeleton**

Run: `ls -la backend/ scripts/ Makefile .gitignore`
Expected: All files exist.

- [ ] **Step 7: Commit**

```bash
git add .gitignore Makefile scripts/ backend/requirements.txt backend/api/__init__.py
git commit -m "chore: add project skeleton and build infrastructure"
```

---

## Task 2: Python Backend Core — PyWebView Window + Base API

**Files:**
- Create: `backend/api/base.py`
- Create: `backend/main.py`

- [ ] **Step 1: Create backend/api/base.py**

```python
import logging
import platform
import sys

import webview

logger = logging.getLogger(__name__)


class Api:
    """Root API class exposed to frontend via pywebview.api."""

    def __init__(self) -> None:
        self._window: webview.Window | None = None
        self.project = ProjectApi(self)
        self.editor = EditorApi(self)
        self.terminal = TerminalApi(self)
        self.git = GitApi(self)

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
            "dev_mode": self._is_dev(),
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

    def _is_dev(self) -> bool:
        return os.environ.get("AIRCODE_DEV", "") == "1"

    def _evaluate_js(self, code: str) -> None:
        if self._window:
            self._window.evaluate_js(code)


# Late imports to avoid circular dependency issues
from pathlib import Path
import os

# These will be implemented in subsequent tasks
# Importing at module level so PyWebView serializes them
try:
    from .project import ProjectApi
    from .editor import EditorApi
    from .terminal import TerminalApi
    from .git import GitApi
except ImportError:
    # Allow partial loading during development
    ProjectApi = object  # type: ignore[misc,assignment]
    EditorApi = object  # type: ignore[misc,assignment]
    TerminalApi = object  # type: ignore[misc,assignment]
    GitApi = object  # type: ignore[misc,assignment]
```

- [ ] **Step 2: Create backend/main.py**

```python
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
```

- [ ] **Step 3: Create minimal frontend placeholder for testing**

```bash
mkdir -p frontend/dist
cat > frontend/dist/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>AirCode</title></head>
<body>
  <h1>AirCode Loading...</h1>
  <p>Frontend not built yet. Run <code>make dev:fe</code> first.</p>
  <div id="api-test"></div>
  <script>
    window.addEventListener('pywebviewready', function() {
      pywebview.api.get_app_info().then(function(info) {
        document.getElementById('api-test').innerHTML =
          '<pre>' + JSON.stringify(info, null, 2) + '</pre>';
      });
    });
  </script>
</body>
</html>
EOF
```

- [ ] **Step 4: Verify backend starts**

Run: `AIRCODE_DEV=0 .venv/aircode/bin/python backend/main.py` (after `make setup`)
Expected: PyWebView window opens showing "AirCode Loading..." with API test output.
Close the window to continue.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add Python backend core with PyWebView window and base API"
```

---

## Task 3: Backend — ProjectApi

**Files:**
- Create: `backend/api/project.py`

- [ ] **Step 1: Create backend/api/project.py**

```python
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
                # Skip hidden files/dirs
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
```

- [ ] **Step 2: Verify API is accessible**

Start backend (`AIRCODE_DEV=0 .venv/aircode/bin/python backend/main.py`).
In the PyWebView window console, test:
```javascript
pywebview.api.project.list_directory('/tmp').then(console.log)
```
Expected: Returns JSON with directory entries.

- [ ] **Step 3: Commit**

```bash
git add backend/api/project.py
git commit -m "feat: add ProjectApi with directory listing and file management"
```

---

## Task 4: Backend — EditorApi

**Files:**
- Create: `backend/api/editor.py`

- [ ] **Step 1: Create backend/api/editor.py**

```python
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Common language mappings for Monaco Editor
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

            # Try UTF-8 first, fallback to latin-1
            try:
                content = path.read_text(encoding="utf-8")
                encoding = "utf-8"
            except UnicodeDecodeError:
                content = path.read_text(encoding="latin-1")
                encoding = "latin-1"

            suffix = path.suffix.lower()
            # Special case for files without extension
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
                # Skip hidden dirs, node_modules, .git, __pycache__
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
```

- [ ] **Step 2: Verify via console**

```javascript
pywebview.api.editor.read_file('/etc/hosts').then(console.log)
```
Expected: Returns file content with language "plaintext".

- [ ] **Step 3: Commit**

```bash
git add backend/api/editor.py
git commit -m "feat: add EditorApi with read/write and project search"
```

---

## Task 5: Backend — TerminalApi

**Files:**
- Create: `backend/api/terminal.py`

- [ ] **Step 1: Create backend/api/terminal.py**

```python
import fcntl
import logging
import os
import struct
import sys
import termios
import threading
import uuid
from pathlib import Path

logger = logging.getLogger(__name__)


class TerminalApi:
    """Manage pseudo-terminal sessions for xterm.js."""

    def __init__(self, root_api) -> None:
        self._api = root_api
        self._sessions: dict[str, dict] = {}

    def create(self, cwd: str | None = None, shell: str | None = None) -> dict:
        """Create a new PTY session. Returns {id, pid}."""
        try:
            session_id = f"term_{uuid.uuid4().hex[:8]}"
            work_dir = Path(cwd).expanduser().resolve() if cwd else Path.home()

            if not work_dir.is_dir():
                work_dir = Path.home()

            # Determine shell
            if not shell:
                shell = os.environ.get("SHELL", "/bin/zsh")

            # Create PTY using os.openpty()
            master_fd, slave_fd = os.openpty()

            # Set initial terminal size
            winsize = struct.pack("HHHH", 24, 80, 0, 0)
            fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, winsize)

            # Fork process
            pid = os.fork()
            if pid == 0:
                # Child process
                os.close(master_fd)
                os.setsid()

                # Set slave as controlling terminal
                fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
                os.dup2(slave_fd, 0)
                os.dup2(slave_fd, 1)
                os.dup2(slave_fd, 2)
                if slave_fd > 2:
                    os.close(slave_fd)

                os.chdir(work_dir)
                os.execvp(shell, [shell])
            else:
                # Parent process
                os.close(slave_fd)

                # Set master FD to non-blocking
                flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
                fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

                self._sessions[session_id] = {
                    "id": session_id,
                    "pid": pid,
                    "master_fd": master_fd,
                    "shell": shell,
                    "cwd": str(work_dir),
                }

                # Start output reader thread
                reader = threading.Thread(
                    target=self._read_output,
                    args=(session_id,),
                    daemon=True,
                )
                reader.start()

                return {"id": session_id, "pid": pid, "cwd": str(work_dir)}
        except Exception as e:
            logger.exception("create terminal failed")
            return {"error": str(e)}

    def write(self, id: str, data: str) -> dict:
        """Write data to terminal stdin."""
        try:
            session = self._sessions.get(id)
            if not session:
                return {"error": f"Terminal not found: {id}"}
            os.write(session["master_fd"], data.encode("utf-8"))
            return {"success": True}
        except Exception as e:
            logger.exception("terminal write failed")
            return {"error": str(e)}

    def resize(self, id: str, cols: int, rows: int) -> dict:
        """Resize terminal PTY."""
        try:
            session = self._sessions.get(id)
            if not session:
                return {"error": f"Terminal not found: {id}"}
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(session["master_fd"], termios.TIOCSWINSZ, winsize)
            return {"success": True}
        except Exception as e:
            logger.exception("terminal resize failed")
            return {"error": str(e)}

    def destroy(self, id: str) -> dict:
        """Destroy a terminal session."""
        try:
            session = self._sessions.pop(id, None)
            if not session:
                return {"error": f"Terminal not found: {id}"}
            try:
                os.close(session["master_fd"])
            except OSError:
                pass
            try:
                os.kill(session["pid"], 9)
            except ProcessLookupError:
                pass
            return {"success": True}
        except Exception as e:
            logger.exception("terminal destroy failed")
            return {"error": str(e)}

    def _read_output(self, session_id: str) -> None:
        """Background thread: read PTY output and push to frontend."""
        session = self._sessions.get(session_id)
        if not session:
            return

        master_fd = session["master_fd"]
        buf = b""

        while session_id in self._sessions:
            try:
                data = os.read(master_fd, 4096)
                if not data:
                    break
                buf += data

                # Send complete chunks
                text = buf.decode("utf-8", errors="replace")
                buf = b""
                self._push_output(session_id, text)

            except BlockingIOError:
                # No data available, wait briefly
                import time
                time.sleep(0.01)
            except OSError:
                # PTY closed
                break

        # Notify frontend that terminal exited
        self._push_output(session_id, "\r\n\x1b[90m[Process exited]\x1b[0m\r\n")

    def _push_output(self, session_id: str, data: str) -> None:
        """Push terminal output to frontend via evaluate_js."""
        import json
        escaped = json.dumps(data)
        js_code = (
            f"if(window.__aircode_on_terminal_output)"
            f"window.__aircode_on_terminal_output('{session_id}',{escaped})"
        )
        self._api._evaluate_js(js_code)
```

- [ ] **Step 2: Verify terminal creation**

```javascript
pywebview.api.terminal.create({cwd: '/tmp'}).then(console.log)
```
Expected: Returns `{id: "term_xxxxxxxx", pid: 12345, cwd: "/tmp"}`.

- [ ] **Step 3: Commit**

```bash
git add backend/api/terminal.py
git commit -m "feat: add TerminalApi with PTY management and streaming output"
```

---

## Task 6: Backend — GitApi

**Files:**
- Create: `backend/api/git.py`

- [ ] **Step 1: Create backend/api/git.py**

```python
import json
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


class GitApi:
    """Git operations for project repositories."""

    def __init__(self, root_api) -> None:
        self._api = root_api

    def _run_git(self, args: list[str], cwd: str) -> dict:
        """Run a git command and return result."""
        try:
            result = subprocess.run(
                ["git"] + args,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0:
                return {"error": result.stderr.strip() or f"git {' '.join(args)} failed"}
            return {"output": result.stdout}
        except subprocess.TimeoutExpired:
            return {"error": "Git command timed out"}
        except FileNotFoundError:
            return {"error": "git not found"}
        except Exception as e:
            return {"error": str(e)}

    def status(self, project_path: str) -> dict:
        """Get git status as structured data."""
        result = self._run_git(["status", "--porcelain=v2", "--branch"], project_path)
        if "error" in result:
            return result

        branch = None
        staged = []
        unstaged = []
        untracked = []

        for line in result["output"].splitlines():
            if line.startswith("# branch.head"):
                branch = line.split()[-1] if line.split()[-1] != "(detached)" else None
            elif line.startswith("1 "):
                # Changed file: 1 <xy> <sub> <mH> <mI> <mW> <hH> <hI> <path>
                parts = line.split()
                xy = parts[1]
                file_path = parts[-1]
                if xy[0] != ".":
                    staged.append({"path": file_path, "status": xy[0]})
                if xy[1] != ".":
                    unstaged.append({"path": file_path, "status": xy[1]})
            elif line.startswith("? "):
                untracked.append(line[2:])

        return {
            "branch": branch,
            "staged": staged,
            "unstaged": unstaged,
            "untracked": untracked,
        }

    def log(self, project_path: str, count: int = 50) -> dict:
        """Get recent commit log."""
        result = self._run_git(
            ["log", f"-{count}", "--pretty=format:%H|%an|%ae|%at|%s"],
            project_path,
        )
        if "error" in result:
            return result

        commits = []
        for line in result["output"].splitlines():
            parts = line.split("|", 4)
            if len(parts) == 5:
                commits.append({
                    "hash": parts[0],
                    "author": parts[1],
                    "email": parts[2],
                    "timestamp": int(parts[3]),
                    "message": parts[4],
                })
        return {"commits": commits}

    def diff(self, project_path: str, file_path: str | None = None, staged: bool = False) -> dict:
        """Get diff output."""
        args = ["diff"]
        if staged:
            args.append("--staged")
        if file_path:
            args.extend(["--", file_path])
        result = self._run_git(args, project_path)
        if "error" in result:
            return result
        return {"diff": result["output"]}

    def commit(self, project_path: str, message: str) -> dict:
        """Stage all changes and commit."""
        # Stage all
        add_result = self._run_git(["add", "-A"], project_path)
        if "error" in add_result:
            return add_result
        # Commit
        result = self._run_git(["commit", "-m", message], project_path)
        if "error" in result:
            return result
        return {"success": True, "output": result["output"]}

    def branch_list(self, project_path: str) -> dict:
        """List all branches."""
        result = self._run_git(["branch", "-a", "--format=%(refname:short)|%(HEAD)"], project_path)
        if "error" in result:
            return result

        branches = []
        for line in result["output"].splitlines():
            parts = line.split("|")
            if len(parts) == 2:
                branches.append({
                    "name": parts[0],
                    "is_current": parts[1] == "*",
                })
        return {"branches": branches}

    def checkout(self, project_path: str, branch: str) -> dict:
        """Checkout a branch."""
        return self._run_git(["checkout", branch], project_path)

    def init(self, project_path: str) -> dict:
        """Initialize a git repository."""
        return self._run_git(["init"], project_path)
```

- [ ] **Step 2: Verify on a git repo**

```javascript
pywebview.api.git.status('/path/to/some/git/repo').then(console.log)
```
Expected: Returns branch name and file status arrays.

- [ ] **Step 3: Commit**

```bash
git add backend/api/git.py
git commit -m "feat: add GitApi with status, log, diff, commit, branch operations"
```

---

## Task 7: Frontend Scaffold — Vite + React + Tailwind + shadcn

**Files:**
- Create: `frontend/` directory with full Vite+React project

- [ ] **Step 1: Create Vite + React + TypeScript project**

```bash
cd /opt/AirCode
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: Install core dependencies**

```bash
cd /opt/AirCode/frontend
npm install zustand @monaco-editor/react @xterm/xterm @xterm/addon-fit lucide-react
npm install -D @types/node
```

- [ ] **Step 3: Install Tailwind CSS 4**

```bash
cd /opt/AirCode/frontend
npm install tailwindcss @tailwindcss/vite
```

- [ ] **Step 4: Configure vite.config.ts**

Write `frontend/vite.config.ts`:

```typescript
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
```

- [ ] **Step 5: Configure TypeScript path aliases**

Update `frontend/tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Add `baseUrl` and `paths` to `frontend/tsconfig.app.json` compilerOptions:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 6: Replace frontend/src/index.css with Tailwind**

Write `frontend/src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-panel-bg: #1e1e2e;
  --color-panel-border: #313244;
  --color-panel-hover: #45475a;
  --color-panel-active: #585b70;
  --color-text-primary: #cdd6f4;
  --color-text-secondary: #a6adc8;
  --color-text-muted: #6c7086;
  --color-accent: #89b4fa;
  --color-accent-hover: #74c7ec;
  --color-danger: #f38ba8;
  --color-success: #a6e3a1;
  --color-warning: #f9e2af;
}

html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: var(--color-panel-bg);
  color: var(--color-text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  font-size: 13px;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-panel-border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-panel-hover);
}

/* Prevent text selection during drag */
.select-none {
  -webkit-user-select: none;
  user-select: none;
}
```

- [ ] **Step 7: Initialize shadcn/ui**

```bash
cd /opt/AirCode/frontend
npx shadcn@latest init --defaults
```

- [ ] **Step 8: Add needed shadcn components**

```bash
cd /opt/AirCode/frontend
npx shadcn@latest add button scroll-area tooltip
```

- [ ] **Step 9: Verify frontend dev server starts**

```bash
cd /opt/AirCode/frontend && npm run dev
```
Expected: Vite dev server running at http://localhost:5173.

- [ ] **Step 10: Commit**

```bash
cd /opt/AirCode
git add frontend/
git commit -m "feat: scaffold Vite + React + TypeScript + Tailwind + shadcn frontend"
```

---

## Task 8: Frontend — Types, API Bridge, and Stores

**Files:**
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/stores/useProjectStore.ts`
- Create: `frontend/src/stores/useTabStore.ts`
- Create: `frontend/src/stores/useEditorStore.ts`
- Create: `frontend/src/stores/useTerminalStore.ts`

- [ ] **Step 1: Create frontend/src/lib/types.ts**

```typescript
export type TabType = "terminal" | "editor" | "file_viewer" | "git"

export interface Tab {
  id: string
  type: TabType
  title: string
  icon: string
  projectId: string
  filePath?: string
  isDirty?: boolean
}

export interface Project {
  id: string
  name: string
  path: string
  isGitRepo: boolean
}

export interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
  modified: number
}

export interface EditorFile {
  path: string
  name: string
  content: string
  language: string
  encoding: string
  size: number
  modified: number
  isDirty: boolean
}

export interface GitFileStatus {
  path: string
  status: string
}

export interface GitCommit {
  hash: string
  author: string
  email: string
  timestamp: number
  message: string
}

export interface TerminalSession {
  id: string
  pid: number
  cwd: string
}
```

- [ ] **Step 2: Create frontend/src/lib/api.ts**

```typescript
import type { FileEntry, GitCommit, GitFileStatus } from "./types"

// Type definitions for pywebview.api responses
interface ApiResponse<T = unknown> {
  error?: string
  [key: string]: unknown
}

// PyWebView global type
declare global {
  interface Window {
    pywebview?: {
      api: {
        get_platform(): Promise<ApiResponse>
        get_app_info(): Promise<ApiResponse>
        open_file_dialog(): Promise<ApiResponse>
        open_folder_dialog(): Promise<ApiResponse>
        project: {
          list_directory(dir_path: string): Promise<ApiResponse>
          get_project_info(dir_path: string): Promise<ApiResponse>
          create_file(dir_path: string, name: string, is_dir?: boolean): Promise<ApiResponse>
          delete_item(item_path: string): Promise<ApiResponse>
          rename_item(old_path: string, new_name: string): Promise<ApiResponse>
        }
        editor: {
          read_file(file_path: string): Promise<ApiResponse>
          write_file(file_path: string, content: string): Promise<ApiResponse>
          search_in_project(project_path: string, query: string, file_pattern?: string): Promise<ApiResponse>
          get_language(file_path: string): Promise<ApiResponse>
        }
        terminal: {
          create(cwd?: string): Promise<ApiResponse>
          write(id: string, data: string): Promise<ApiResponse>
          resize(id: string, cols: number, rows: number): Promise<ApiResponse>
          destroy(id: string): Promise<ApiResponse>
        }
        git: {
          status(project_path: string): Promise<ApiResponse>
          log(project_path: string, count?: number): Promise<ApiResponse>
          diff(project_path: string, file_path?: string, staged?: boolean): Promise<ApiResponse>
          commit(project_path: string, message: string): Promise<ApiResponse>
          branch_list(project_path: string): Promise<ApiResponse>
          checkout(project_path: string, branch: string): Promise<ApiResponse>
          init(project_path: string): Promise<ApiResponse>
        }
      }
    }
    __aircode_on_terminal_output?: (id: string, data: string) => void
  }
}

const isPyWebView = typeof window !== "undefined" && "pywebview" in window

// Mock API for standalone frontend development
const mockApi = {
  get_platform: async () => ({ system: "Darwin", machine: "arm64" }),
  get_app_info: async () => ({ name: "AirCode", version: "0.1.0", dev_mode: true }),
  open_file_dialog: async () => ({ path: null }),
  open_folder_dialog: async () => ({ path: "/tmp/mock-project" }),
  project: {
    list_directory: async (dir_path: string) => ({
      path: dir_path,
      entries: [
        { name: "src", path: `${dir_path}/src`, is_dir: true, size: 0, modified: Date.now() / 1000 },
        { name: "README.md", path: `${dir_path}/README.md`, is_dir: false, size: 256, modified: Date.now() / 1000 },
        { name: "package.json", path: `${dir_path}/package.json`, is_dir: false, size: 512, modified: Date.now() / 1000 },
      ] as FileEntry[],
    }),
    get_project_info: async (dir_path: string) => ({
      name: dir_path.split("/").pop(),
      path: dir_path,
      is_git_repo: true,
      exists: true,
    }),
    create_file: async () => ({}),
    delete_item: async () => ({ success: true }),
    rename_item: async () => ({}),
  },
  editor: {
    read_file: async (file_path: string) => ({
      content: `// ${file_path}\nconsole.log("Hello from mock editor")\n`,
      path: file_path,
      name: file_path.split("/").pop(),
      language: "javascript",
      encoding: "utf-8",
      size: 64,
      modified: Date.now() / 1000,
    }),
    write_file: async () => ({ success: true }),
    search_in_project: async () => ({ results: [], truncated: false, count: 0 }),
    get_language: async (file_path: string) => ({
      language: file_path.endsWith(".py") ? "python" : "javascript",
    }),
  },
  terminal: {
    create: async (cwd?: string) => ({ id: "term_mock", pid: 12345, cwd: cwd || "/tmp" }),
    write: async () => ({ success: true }),
    resize: async () => ({ success: true }),
    destroy: async () => ({ success: true }),
  },
  git: {
    status: async () => ({
      branch: "main",
      staged: [] as GitFileStatus[],
      unstaged: [] as GitFileStatus[],
      untracked: [] as string[],
    }),
    log: async () => ({
      commits: [
        { hash: "abc123", author: "dev", email: "dev@test.com", timestamp: Date.now() / 1000, message: "Initial commit" },
      ] as GitCommit[],
    }),
    diff: async () => ({ diff: "" }),
    commit: async () => ({ success: true }),
    branch_list: async () => ({
      branches: [{ name: "main", is_current: true }],
    }),
    checkout: async () => ({ output: "" }),
    init: async () => ({ output: "Initialized empty Git repository" }),
  },
}

async function getApi() {
  if (isPyWebView && window.pywebview) {
    return window.pywebview.api
  }
  // In dev mode without pywebview, wait for the bridge or return mock
  return new Promise<typeof window.pywebview.api>((resolve) => {
    if (window.pywebview) {
      resolve(window.pywebview.api)
      return
    }
    window.addEventListener("pywebviewready", () => {
      resolve(window.pywebview!.api)
    })
    // Timeout fallback to mock
    setTimeout(() => {
      resolve(mockApi as unknown as typeof window.pywebview.api)
    }, 2000)
  })
}

let _api: typeof window.pywebview.api | null = null

export async function api() {
  if (!_api) {
    _api = await getApi()
  }
  return _api
}

export { mockApi, isPyWebView }
```

- [ ] **Step 3: Create frontend/src/stores/useProjectStore.ts**

```typescript
import { create } from "zustand"
import type { Project, FileEntry } from "@/lib/types"
import { api } from "@/lib/api"

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  fileTree: FileEntry[]

  addProject: (path: string) => Promise<void>
  removeProject: (id: string) => void
  setActiveProject: (id: string) => void
  loadFileTree: (dirPath: string) => Promise<void>
  loadFromStorage: () => void
  saveToStorage: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  fileTree: [],

  addProject: async (path: string) => {
    const a = await api()
    const result = await a.project.get_project_info(path)
    if (result.error) return

    const project: Project = {
      id: path,
      name: (result.name as string) || path.split("/").pop() || path,
      path: path,
      isGitRepo: (result.is_git_repo as boolean) || false,
    }

    const exists = get().projects.some((p) => p.path === path)
    if (exists) return

    set((state) => ({
      projects: [...state.projects, project],
      activeProjectId: state.activeProjectId || project.id,
    }))

    get().saveToStorage()

    if (get().activeProjectId === project.id) {
      get().loadFileTree(path)
    }
  },

  removeProject: (id: string) => {
    set((state) => {
      const projects = state.projects.filter((p) => p.id !== id)
      const activeProjectId =
        state.activeProjectId === id
          ? projects[0]?.id || null
          : state.activeProjectId
      return { projects, activeProjectId }
    })
    get().saveToStorage()
  },

  setActiveProject: (id: string) => {
    set({ activeProjectId: id })
    const project = get().projects.find((p) => p.id === id)
    if (project) {
      get().loadFileTree(project.path)
    }
    get().saveToStorage()
  },

  loadFileTree: async (dirPath: string) => {
    const a = await api()
    const result = await a.project.list_directory(dirPath)
    if (result.error) return
    set({ fileTree: (result.entries as FileEntry[]) || [] })
  },

  loadFromStorage: () => {
    try {
      const data = localStorage.getItem("aircode_projects")
      if (data) {
        const parsed = JSON.parse(data)
        set({
          projects: parsed.projects || [],
          activeProjectId: parsed.activeProjectId || null,
        })
      }
    } catch {
      // Ignore parse errors
    }
  },

  saveToStorage: () => {
    const { projects, activeProjectId } = get()
    localStorage.setItem(
      "aircode_projects",
      JSON.stringify({ projects, activeProjectId })
    )
  },
}))
```

- [ ] **Step 4: Create frontend/src/stores/useTabStore.ts**

```typescript
import { create } from "zustand"
import type { Tab, TabType } from "@/lib/types"

interface TabState {
  tabs: Tab[]
  activeTabId: string | null

  addTab: (type: TabType, projectId: string, extra?: Partial<Tab>) => string
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTab: (id: string, updates: Partial<Tab>) => void
  getActiveTab: () => Tab | undefined
}

const TAB_ICONS: Record<TabType, string> = {
  terminal: "🖥️",
  editor: "📝",
  file_viewer: "📁",
  git: "🔀",
}

const TAB_TITLES: Record<TabType, string> = {
  terminal: "终端",
  editor: "编辑器",
  file_viewer: "文件",
  git: "Git",
}

let tabCounter = 0

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (type: TabType, projectId: string, extra?: Partial<Tab>) => {
    tabCounter++
    const id = `${type}_${tabCounter}_${Date.now()}`
    const tab: Tab = {
      id,
      type,
      title: extra?.title || TAB_TITLES[type],
      icon: TAB_ICONS[type],
      projectId,
      ...extra,
    }

    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: id,
    }))

    return id
  },

  removeTab: (id: string) => {
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== id)
      const activeTabId =
        state.activeTabId === id
          ? tabs[tabs.length - 1]?.id || null
          : state.activeTabId
      return { tabs, activeTabId }
    })
  },

  setActiveTab: (id: string) => {
    set({ activeTabId: id })
  },

  updateTab: (id: string, updates: Partial<Tab>) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }))
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get()
    return tabs.find((t) => t.id === activeTabId)
  },
}))
```

- [ ] **Step 5: Create frontend/src/stores/useEditorStore.ts**

```typescript
import { create } from "zustand"
import type { EditorFile } from "@/lib/types"
import { api } from "@/lib/api"

interface EditorState {
  files: Map<string, EditorFile>
  activeFile: EditorFile | null

  openFile: (filePath: string) => Promise<EditorFile | null>
  saveFile: (filePath: string) => Promise<boolean>
  updateContent: (filePath: string, content: string) => void
  closeFile: (filePath: string) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  files: new Map(),
  activeFile: null,

  openFile: async (filePath: string) => {
    const existing = get().files.get(filePath)
    if (existing) {
      set({ activeFile: existing })
      return existing
    }

    const a = await api()
    const result = await a.editor.read_file(filePath)
    if (result.error) return null

    const file: EditorFile = {
      path: result.path as string,
      name: result.name as string,
      content: result.content as string,
      language: result.language as string,
      encoding: result.encoding as string,
      size: result.size as number,
      modified: result.modified as number,
      isDirty: false,
    }

    set((state) => {
      const files = new Map(state.files)
      files.set(filePath, file)
      return { files, activeFile: file }
    })

    return file
  },

  saveFile: async (filePath: string) => {
    const file = get().files.get(filePath)
    if (!file) return false

    const a = await api()
    const result = await a.editor.write_file(filePath, file.content)
    if (result.error) return false

    const updated = { ...file, isDirty: false, modified: result.modified as number }
    set((state) => {
      const files = new Map(state.files)
      files.set(filePath, updated)
      return { files, activeFile: state.activeFile?.path === filePath ? updated : state.activeFile }
    })
    return true
  },

  updateContent: (filePath: string, content: string) => {
    set((state) => {
      const file = state.files.get(filePath)
      if (!file) return state
      const updated = { ...file, content, isDirty: true }
      const files = new Map(state.files)
      files.set(filePath, updated)
      return {
        files,
        activeFile: state.activeFile?.path === filePath ? updated : state.activeFile,
      }
    })
  },

  closeFile: (filePath: string) => {
    set((state) => {
      const files = new Map(state.files)
      files.delete(filePath)
      return {
        files,
        activeFile: state.activeFile?.path === filePath ? null : state.activeFile,
      }
    })
  },
}))
```

- [ ] **Step 6: Create frontend/src/stores/useTerminalStore.ts**

```typescript
import { create } from "zustand"
import type { TerminalSession } from "@/lib/types"
import { api } from "@/lib/api"

interface TerminalState {
  sessions: Map<string, TerminalSession>
  outputBuffers: Map<string, string>

  createSession: (cwd?: string) => Promise<TerminalSession | null>
  writeToSession: (id: string, data: string) => Promise<void>
  resizeSession: (id: string, cols: number, rows: number) => Promise<void>
  destroySession: (id: string) => Promise<void>
  appendOutput: (id: string, data: string) => void
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: new Map(),
  outputBuffers: new Map(),

  createSession: async (cwd?: string) => {
    const a = await api()
    const result = await a.terminal.create(cwd)
    if (result.error) return null

    const session: TerminalSession = {
      id: result.id as string,
      pid: result.pid as number,
      cwd: result.cwd as string,
    }

    set((state) => {
      const sessions = new Map(state.sessions)
      sessions.set(session.id, session)
      const outputBuffers = new Map(state.outputBuffers)
      outputBuffers.set(session.id, "")
      return { sessions, outputBuffers }
    })

    return session
  },

  writeToSession: async (id: string, data: string) => {
    const a = await api()
    await a.terminal.write(id, data)
  },

  resizeSession: async (id: string, cols: number, rows: number) => {
    const a = await api()
    await a.terminal.resize(id, cols, rows)
  },

  destroySession: async (id: string) => {
    const a = await api()
    await a.terminal.destroy(id)
    set((state) => {
      const sessions = new Map(state.sessions)
      sessions.delete(id)
      const outputBuffers = new Map(state.outputBuffers)
      outputBuffers.delete(id)
      return { sessions, outputBuffers }
    })
  },

  appendOutput: (id: string, data: string) => {
    set((state) => {
      const outputBuffers = new Map(state.outputBuffers)
      const existing = outputBuffers.get(id) || ""
      outputBuffers.set(id, existing + data)
      return { outputBuffers }
    })
  },
}))

// Register global callback for terminal output from Python
if (typeof window !== "undefined") {
  window.__aircode_on_terminal_output = (id: string, data: string) => {
    useTerminalStore.getState().appendOutput(id, data)
  }
}
```

- [ ] **Step 7: Verify stores compile**

```bash
cd /opt/AirCode/frontend && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 8: Commit**

```bash
cd /opt/AirCode
git add frontend/src/lib/ frontend/src/stores/
git commit -m "feat: add types, API bridge, and zustand stores for frontend"
```

---

## Task 9: Frontend — Layout, TitleBar, StatusBar, ProjectList, Workspace

**Files:**
- Create: `frontend/src/components/layout/TitleBar.tsx`
- Create: `frontend/src/components/layout/StatusBar.tsx`
- Create: `frontend/src/components/project/ProjectList.tsx`
- Create: `frontend/src/components/workspace/TabBar.tsx`
- Create: `frontend/src/components/workspace/Workspace.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create frontend/src/components/layout/TitleBar.tsx**

```typescript
export function TitleBar() {
  return (
    <div className="flex h-9 items-center justify-between border-b border-panel-border bg-panel-bg px-4 select-none">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-accent">AirCode</span>
        <span className="text-xs text-text-muted">v0.1.0</span>
      </div>
      <div className="text-xs text-text-muted">本地开发工作站</div>
    </div>
  )
}
```

- [ ] **Step 2: Create frontend/src/components/layout/StatusBar.tsx**

```typescript
import { useProjectStore } from "@/stores/useProjectStore"
import { useTabStore } from "@/stores/useTabStore"

export function StatusBar() {
  const activeProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )
  const activeTab = useTabStore((s) =>
    s.tabs.find((t) => t.id === s.activeTabId)
  )

  return (
    <div className="flex h-6 items-center justify-between border-t border-panel-border bg-panel-bg px-3 text-xs text-text-muted select-none">
      <div className="flex items-center gap-3">
        {activeProject && (
          <span className="flex items-center gap-1">
            <span>📁</span>
            <span>{activeProject.name}</span>
          </span>
        )}
        {activeProject?.isGitRepo && (
          <span className="flex items-center gap-1">
            <span>🔀</span>
            <span>git</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span>UTF-8</span>
        <span>LF</span>
        {activeTab && (
          <span className="text-text-secondary">{activeTab.title}</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create frontend/src/components/project/ProjectList.tsx**

```typescript
import { FolderOpen, Plus, Trash2 } from "lucide-react"
import { useProjectStore } from "@/stores/useProjectStore"
import { useTabStore } from "@/stores/useTabStore"
import { api, isPyWebView } from "@/lib/api"

export function ProjectList() {
  const projects = useProjectStore((s) => s.projects)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const removeProject = useProjectStore((s) => s.removeProject)
  const addProject = useProjectStore((s) => s.addProject)

  const handleAddProject = async () => {
    if (isPyWebView) {
      const a = await api()
      const result = await a.open_folder_dialog()
      if (result.path) {
        addProject(result.path as string)
      }
    } else {
      // Mock: add a test directory
      addProject("/tmp")
    }
  }

  return (
    <div className="flex h-full w-56 flex-col border-r border-panel-border bg-panel-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
          项目
        </span>
        <button
          onClick={handleAddProject}
          className="rounded p-1 text-text-muted hover:bg-panel-hover hover:text-text-primary"
          title="添加项目"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-text-muted">
            点击 + 添加项目目录
          </div>
        )}
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => setActiveProject(project.id)}
            className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm ${
              project.id === activeProjectId
                ? "bg-panel-active text-text-primary"
                : "text-text-secondary hover:bg-panel-hover hover:text-text-primary"
            }`}
            title={project.path}
          >
            <FolderOpen size={14} className="shrink-0 text-accent" />
            <span className="truncate flex-1">{project.name}</span>
            {project.isGitRepo && (
              <span className="text-[10px] text-text-muted">git</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                removeProject(project.id)
              }}
              className="hidden rounded p-0.5 text-text-muted hover:text-danger group-hover:block"
              title="移除项目"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create frontend/src/components/workspace/TabBar.tsx**

```typescript
import { Plus, X } from "lucide-react"
import { useTabStore } from "@/stores/useTabStore"
import { useProjectStore } from "@/stores/useProjectStore"
import type { TabType } from "@/lib/types"
import { useState, useRef, useEffect } from "react"

const TAB_TYPE_OPTIONS: { type: TabType; label: string; icon: string }[] = [
  { type: "terminal", label: "终端", icon: "🖥️" },
  { type: "editor", label: "编辑器", icon: "📝" },
  { type: "file_viewer", label: "文件", icon: "📁" },
  { type: "git", label: "Git", icon: "🔀" },
]

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const removeTab = useTabStore((s) => s.removeTab)
  const addTab = useTabStore((s) => s.addTab)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)

  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showMenu])

  const handleAddTab = (type: TabType) => {
    if (!activeProjectId) return
    addTab(type, activeProjectId)
    setShowMenu(false)
  }

  return (
    <div className="flex h-9 items-end border-b border-panel-border bg-panel-bg overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`group flex h-8 min-w-0 max-w-40 items-center gap-1.5 cursor-pointer border-r border-panel-border px-3 text-xs ${
            tab.id === activeTabId
              ? "border-b-2 border-b-accent bg-panel-bg text-text-primary"
              : "text-text-muted hover:bg-panel-hover hover:text-text-secondary"
          }`}
        >
          <span className="shrink-0">{tab.icon}</span>
          <span className="truncate">{tab.title}</span>
          {tab.isDirty && (
            <span className="shrink-0 h-2 w-2 rounded-full bg-warning" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeTab(tab.id)
            }}
            className="shrink-0 rounded p-0.5 opacity-0 hover:bg-panel-hover group-hover:opacity-100"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {/* Add tab button */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          disabled={!activeProjectId}
          className="flex h-8 w-8 items-center justify-center text-text-muted hover:bg-panel-hover hover:text-text-primary disabled:opacity-30"
          title="新建标签"
        >
          <Plus size={14} />
        </button>
        {showMenu && (
          <div className="absolute left-0 top-full z-50 mt-1 w-36 rounded border border-panel-border bg-panel-bg py-1 shadow-lg">
            {TAB_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                onClick={() => handleAddTab(opt.type)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-panel-hover hover:text-text-primary"
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create frontend/src/components/workspace/Workspace.tsx**

```typescript
import { TabBar } from "./TabBar"
import { useTabStore } from "@/stores/useTabStore"
import { useProjectStore } from "@/stores/useProjectStore"
import { TerminalTab } from "@/components/tabs/TerminalTab"
import { EditorTab } from "@/components/tabs/EditorTab"
import { FileViewerTab } from "@/components/tabs/FileViewerTab"
import { GitTab } from "@/components/tabs/GitTab"

export function Workspace() {
  const activeTab = useTabStore((s) =>
    s.tabs.find((t) => t.id === s.activeTabId)
  )
  const activeProjectId = useProjectStore((s) => s.activeProjectId)

  if (!activeProjectId) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-full items-center justify-center text-text-muted">
          <div className="text-center">
            <p className="text-lg">欢迎使用 AirCode</p>
            <p className="mt-2 text-sm">请在左侧面板添加一个项目目录开始使用</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <TabBar />
      <div className="flex-1 overflow-hidden">
        {!activeTab && (
          <div className="flex h-full items-center justify-center text-text-muted">
            <div className="text-center">
              <p>点击 + 创建标签页</p>
              <p className="mt-1 text-xs">终端 / 编辑器 / 文件 / Git</p>
            </div>
          </div>
        )}
        {activeTab?.type === "terminal" && <TerminalTab tabId={activeTab.id} />}
        {activeTab?.type === "editor" && <EditorTab tabId={activeTab.id} filePath={activeTab.filePath} />}
        {activeTab?.type === "file_viewer" && <FileViewerTab tabId={activeTab.id} />}
        {activeTab?.type === "git" && <GitTab tabId={activeTab.id} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Update frontend/src/App.tsx**

```typescript
import { useEffect } from "react"
import { TitleBar } from "@/components/layout/TitleBar"
import { StatusBar } from "@/components/layout/StatusBar"
import { ProjectList } from "@/components/project/ProjectList"
import { Workspace } from "@/components/workspace/Workspace"
import { useProjectStore } from "@/stores/useProjectStore"

export default function App() {
  const loadFromStorage = useProjectStore((s) => s.loadFromStorage)

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  return (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <ProjectList />
        <Workspace />
      </div>
      <StatusBar />
    </div>
  )
}
```

- [ ] **Step 7: Update frontend/src/main.tsx**

```typescript
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 8: Verify frontend renders**

```bash
cd /opt/AirCode/frontend && npm run dev
```
Open http://localhost:5173 in browser. Expected: Layout renders with TitleBar, empty ProjectList, Workspace placeholder, StatusBar.

- [ ] **Step 9: Commit**

```bash
cd /opt/AirCode
git add frontend/src/
git commit -m "feat: add layout components, project list, tab bar, and workspace shell"
```

---

## Task 10: Frontend — Tab Components (Placeholders + Terminal)

**Files:**
- Create: `frontend/src/components/tabs/TerminalTab.tsx`
- Create: `frontend/src/components/tabs/EditorTab.tsx`
- Create: `frontend/src/components/tabs/FileViewerTab.tsx`
- Create: `frontend/src/components/tabs/GitTab.tsx`

- [ ] **Step 1: Create frontend/src/components/tabs/TerminalTab.tsx**

```typescript
import { useEffect, useRef, useCallback } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { useTerminalStore } from "@/stores/useTerminalStore"
import { useTabStore } from "@/stores/useTabStore"
import { useProjectStore } from "@/stores/useProjectStore"

interface TerminalTabProps {
  tabId: string
}

export function TerminalTab({ tabId }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const createSession = useTerminalStore((s) => s.createSession)
  const writeToSession = useTerminalStore((s) => s.writeToSession)
  const resizeSession = useTerminalStore((s) => s.resizeSession)
  const destroySession = useTerminalStore((s) => s.destroySession)
  const outputBuffers = useTerminalStore((s) => s.outputBuffers)
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === tabId))
  const activeProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )
  const updateTab = useTabStore((s) => s.updateTab)

  // Track output for this terminal
  const sessionId = sessionIdRef.current
  const output = sessionId ? outputBuffers.get(sessionId) || "" : null
  const lastOutputLenRef = useRef(0)

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: {
        background: "#1e1e2e",
        foreground: "#cdd6f4",
        cursor: "#f5e0dc",
        selectionBackground: "#45475a",
      },
      fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      cursorBlink: true,
      scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Create PTY session
    const cwd = activeProject?.path
    createSession(cwd).then((session) => {
      if (session) {
        sessionIdRef.current = session.id
        updateTab(tabId, { title: `终端: ${session.id.replace("term_", "")}` })
      }
    })

    // Handle user input
    term.onData((data) => {
      const sid = sessionIdRef.current
      if (sid) {
        writeToSession(sid, data)
      }
    })

    // Handle resize
    const onResize = () => {
      fitAddon.fit()
      const sid = sessionIdRef.current
      if (sid) {
        resizeSession(sid, term.cols, term.rows)
      }
    }

    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      const sid = sessionIdRef.current
      if (sid) {
        destroySession(sid)
      }
      term.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Write new output to terminal
  useEffect(() => {
    if (!termRef.current || !output) return
    const newContent = output.slice(lastOutputLenRef.current)
    if (newContent) {
      termRef.current.write(newContent)
    }
    lastOutputLenRef.current = output.length
  }, [output])

  return <div ref={containerRef} className="h-full w-full" />
}
```

- [ ] **Step 2: Create frontend/src/components/tabs/EditorTab.tsx**

```typescript
import { useEffect, useState, useCallback } from "react"
import Editor from "@monaco-editor/react"
import { useEditorStore } from "@/stores/useEditorStore"
import { useTabStore } from "@/stores/useTabStore"
import type { editor } from "monaco-editor"

interface EditorTabProps {
  tabId: string
  filePath?: string
}

export function EditorTab({ tabId, filePath }: EditorTabProps) {
  const openFile = useEditorStore((s) => s.openFile)
  const saveFile = useEditorStore((s) => s.saveFile)
  const updateContent = useEditorStore((s) => s.updateContent)
  const activeFile = useEditorStore((s) => s.activeFile)
  const files = useEditorStore((s) => s.files)
  const updateTab = useTabStore((s) => s.updateTab)

  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!filePath || loaded) return
    openFile(filePath).then((file) => {
      if (file) {
        updateTab(tabId, { title: file.name })
        setLoaded(true)
      }
    })
  }, [filePath, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (!activeFile || !value) return
      updateContent(activeFile.path, value)
      updateTab(tabId, { isDirty: true })
    },
    [activeFile, tabId, updateContent, updateTab]
  )

  // Handle Ctrl+S save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        if (activeFile) {
          saveFile(activeFile.path).then((ok) => {
            if (ok) updateTab(tabId, { isDirty: false })
          })
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeFile, tabId, saveFile, updateTab])

  if (!activeFile) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        <p>选择或打开一个文件开始编辑</p>
      </div>
    )
  }

  return (
    <Editor
      height="100%"
      language={activeFile.language}
      value={activeFile.content}
      onChange={handleChange}
      theme="vs-dark"
      options={{
        fontSize: 13,
        fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 8 },
        lineNumbers: "on",
        renderLineHighlight: "line",
        wordWrap: "on",
        tabSize: 2,
      }}
    />
  )
}
```

- [ ] **Step 3: Create frontend/src/components/tabs/FileViewerTab.tsx**

```typescript
import { useState, useEffect, useCallback } from "react"
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react"
import { useProjectStore } from "@/stores/useProjectStore"
import { useTabStore } from "@/stores/useTabStore"
import { useEditorStore } from "@/stores/useEditorStore"
import type { FileEntry } from "@/lib/types"
import { api } from "@/lib/api"

interface FileViewerTabProps {
  tabId: string
}

export function FileViewerTab({ tabId }: FileViewerTabProps) {
  const fileTree = useProjectStore((s) => s.fileTree)
  const activeProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )
  const loadFileTree = useProjectStore((s) => s.loadFileTree)
  const addTab = useTabStore((s) => s.addTab)

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [subDirs, setSubDirs] = useState<Map<string, FileEntry[]>>(new Map())
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string>("")

  // Load root file tree
  useEffect(() => {
    if (activeProject) {
      loadFileTree(activeProject.path)
    }
  }, [activeProject]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDir = useCallback(async (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(dirPath)) {
        next.delete(dirPath)
      } else {
        next.add(dirPath)
        // Load subdirectory contents
        const a = await api()
        a.project.list_directory(dirPath).then((result) => {
          if (result.entries) {
            setSubDirs((prev) => {
              const next = new Map(prev)
              next.set(dirPath, result.entries as FileEntry[])
              return next
            })
          }
        })
      }
      return next
    })
  }, [])

  const handleFileClick = useCallback(async (filePath: string, fileName: string) => {
    const a = await api()
    const result = await a.editor.read_file(filePath)
    if (result.content) {
      setPreviewContent(result.content as string)
      setPreviewName(fileName)
    }
  }, [])

  const openInEditor = useCallback((filePath: string, fileName: string) => {
    if (!activeProject) return
    addTab("editor", activeProject.id, { filePath, title: fileName })
  }, [activeProject, addTab])

  const renderTree = (entries: FileEntry[], depth: number = 0) => {
    return entries.map((entry) => {
      const isExpanded = expandedDirs.has(entry.path)
      const subEntries = subDirs.get(entry.path)

      return (
        <div key={entry.path}>
          <div
            className="flex items-center gap-1 cursor-pointer py-0.5 hover:bg-panel-hover text-xs"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => {
              if (entry.is_dir) {
                toggleDir(entry.path)
              } else {
                handleFileClick(entry.path, entry.name)
              }
            }}
            onDoubleClick={() => {
              if (!entry.is_dir) {
                openInEditor(entry.path, entry.name)
              }
            }}
          >
            {entry.is_dir ? (
              <>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {isExpanded ? <FolderOpen size={14} className="text-accent" /> : <Folder size={14} className="text-accent" />}
              </>
            ) : (
              <>
                <span className="w-3" />
                <File size={14} className="text-text-muted" />
              </>
            )}
            <span className="ml-1 truncate text-text-secondary">{entry.name}</span>
          </div>
          {entry.is_dir && isExpanded && subEntries && renderTree(subEntries, depth + 1)}
        </div>
      )
    })
  }

  return (
    <div className="flex h-full">
      {/* File tree */}
      <div className="w-64 overflow-y-auto border-r border-panel-border p-1">
        {activeProject ? renderTree(fileTree) : (
          <div className="p-4 text-center text-xs text-text-muted">请先选择一个项目</div>
        )}
      </div>
      {/* Preview */}
      <div className="flex-1 overflow-auto p-4">
        {previewContent ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-text-muted">{previewName} (预览)</span>
              <button
                className="text-xs text-accent hover:text-accent-hover"
                onClick={() => {
                  /* find file path from previewName - simplified */
                }}
              >
                在编辑器中打开
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs text-text-secondary">
              {previewContent}
            </pre>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">
            单击文件预览，双击在编辑器中打开
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create frontend/src/components/tabs/GitTab.tsx**

```typescript
import { useState, useEffect, useCallback } from "react"
import { GitCommit as GitCommitIcon, GitBranch, RefreshCw } from "lucide-react"
import { useProjectStore } from "@/stores/useProjectStore"
import { api } from "@/lib/api"
import type { GitCommit, GitFileStatus } from "@/lib/types"

interface GitTabProps {
  tabId: string
}

export function GitTab({ tabId }: GitTabProps) {
  const activeProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )
  const loadFileTree = useProjectStore((s) => s.loadFileTree)

  const [branch, setBranch] = useState<string>("")
  const [staged, setStaged] = useState<GitFileStatus[]>([])
  const [unstaged, setUnstaged] = useState<GitFileStatus[]>([])
  const [untracked, setUntracked] = useState<string[]>([])
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [commitMessage, setCommitMessage] = useState("")
  const [diff, setDiff] = useState("")
  const [loading, setLoading] = useState(false)

  const refreshStatus = useCallback(async () => {
    if (!activeProject) return
    const a = await api()
    setLoading(true)
    try {
      const [statusResult, logResult] = await Promise.all([
        a.git.status(activeProject.path),
        a.git.log(activeProject.path, 20),
      ])
      if (statusResult.branch) setBranch(statusResult.branch as string)
      if (statusResult.staged) setStaged(statusResult.staged as GitFileStatus[])
      if (statusResult.unstaged) setUnstaged(statusResult.unstaged as GitFileStatus[])
      if (statusResult.untracked) setUntracked(statusResult.untracked as string[])
      if (logResult.commits) setCommits(logResult.commits as GitCommit[])
    } finally {
      setLoading(false)
    }
  }, [activeProject])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  const handleCommit = useCallback(async () => {
    if (!activeProject || !commitMessage.trim()) return
    const a = await api()
    const result = await a.git.commit(activeProject.path, commitMessage.trim())
    if (result.success) {
      setCommitMessage("")
      refreshStatus()
      loadFileTree(activeProject.path)
    }
  }, [activeProject, commitMessage, refreshStatus, loadFileTree])

  const handleViewDiff = useCallback(async (filePath?: string) => {
    if (!activeProject) return
    const a = await api()
    const result = await a.git.diff(activeProject.path, filePath, !filePath)
    if (result.diff) setDiff(result.diff as string)
  }, [activeProject])

  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        请先选择一个项目
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left: status + commit */}
      <div className="w-80 flex flex-col border-r border-panel-border">
        {/* Branch + refresh */}
        <div className="flex items-center justify-between border-b border-panel-border px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs">
            <GitBranch size={14} className="text-accent" />
            <span className="text-text-primary">{branch || "no branch"}</span>
          </div>
          <button
            onClick={refreshStatus}
            className="rounded p-1 text-text-muted hover:bg-panel-hover"
            title="刷新"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Changes */}
        <div className="flex-1 overflow-y-auto p-2">
          {(unstaged.length > 0 || untracked.length > 0) && (
            <div className="mb-3">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                更改 ({unstaged.length + untracked.length})
              </div>
              {[...unstaged.map((f) => ({ path: f.path, status: f.status })),
                ...untracked.map((f) => ({ path: f, status: "?" })),
              ].map((item) => (
                <div
                  key={item.path}
                  className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-panel-hover cursor-pointer"
                  onClick={() => handleViewDiff(item.path)}
                >
                  <span className={`w-4 text-center font-mono ${
                    item.status === "?" ? "text-warning" :
                    item.status === "M" ? "text-warning" :
                    item.status === "D" ? "text-danger" : "text-success"
                  }`}>
                    {item.status}
                  </span>
                  <span className="truncate text-text-secondary">{item.path}</span>
                </div>
              ))}
            </div>
          )}

          {staged.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                暂存 ({staged.length})
              </div>
              {staged.map((f) => (
                <div key={f.path} className="flex items-center gap-2 rounded px-2 py-1 text-xs">
                  <span className="w-4 text-center font-mono text-success">{f.status}</span>
                  <span className="truncate text-text-secondary">{f.path}</span>
                </div>
              ))}
            </div>
          )}

          {/* Commit log */}
          <div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
              最近提交
            </div>
            {commits.map((c) => (
              <div key={c.hash} className="flex items-start gap-2 rounded px-2 py-1.5 text-xs hover:bg-panel-hover">
                <GitCommitIcon size={14} className="mt-0.5 shrink-0 text-text-muted" />
                <div className="min-w-0">
                  <div className="truncate text-text-primary">{c.message}</div>
                  <div className="text-text-muted">
                    {c.author} · {new Date(c.timestamp * 1000).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Commit input */}
        <div className="border-t border-panel-border p-2">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="提交信息..."
            className="w-full resize-none rounded border border-panel-border bg-panel-bg px-2 py-1.5 text-xs text-text-primary placeholder-text-muted focus:border-accent focus:outline-none"
            rows={2}
          />
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim()}
            className="mt-1.5 w-full rounded bg-accent px-3 py-1.5 text-xs font-medium text-panel-bg hover:bg-accent-hover disabled:opacity-40"
          >
            提交全部更改
          </button>
        </div>
      </div>

      {/* Right: diff view */}
      <div className="flex-1 overflow-auto p-4">
        {diff ? (
          <pre className="whitespace-pre-wrap font-mono text-xs text-text-secondary">{diff}</pre>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">
            点击左侧文件查看差异
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify all tab components compile**

```bash
cd /opt/AirCode/frontend && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
cd /opt/AirCode
git add frontend/src/components/tabs/
git commit -m "feat: add Terminal, Editor, FileViewer, and Git tab components"
```

---

## Task 11: Clean Up Frontend Scaffold Files

**Files:**
- Delete: `frontend/src/App.css` (if exists from Vite template)
- Delete: `frontend/src/assets/` (if exists from Vite template)

- [ ] **Step 1: Remove Vite template boilerplate**

```bash
rm -f frontend/src/App.css frontend/src/assets/react.svg frontend/public/vite.svg
rmdir frontend/src/assets 2>/dev/null || true
```

- [ ] **Step 2: Verify dev server still works**

```bash
cd /opt/AirCode/frontend && npm run dev
```
Open http://localhost:5173. Expected: AirCode layout renders without errors.

- [ ] **Step 3: Commit**

```bash
git add -A frontend/
git commit -m "chore: remove Vite template boilerplate files"
```

---

## Task 12: Integrate Backend + Frontend in Dev Mode

**Files:**
- Modify: `backend/api/base.py` (fix import fallback)
- Verify: Full dev mode flow works

- [ ] **Step 1: Update backend/api/base.py to use proper imports**

Replace the late-import block in `backend/api/base.py` with clean top-level imports:

```python
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
        self.project = ProjectApi(self)
        self.editor = EditorApi(self)
        self.terminal = TerminalApi(self)
        self.git = GitApi(self)

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
```

- [ ] **Step 2: Test full integration**

Terminal 1: Start Vite dev server
```bash
cd /opt/AirCode/frontend && npm run dev
```

Terminal 2: Start PyWebView
```bash
cd /opt/AirCode && AIRCODE_DEV=1 .venv/aircode/bin/python backend/main.py
```

Expected: PyWebView window opens, loads React app from Vite, layout renders. Test:
1. Click + in project list → folder picker opens (or mock adds /tmp)
2. Click + in tab bar → select Terminal → terminal opens with shell
3. Verify API bridge: open browser console, run `pywebview.api.get_app_info().then(console.log)`

- [ ] **Step 3: Commit**

```bash
git add backend/
git commit -m "fix: clean up backend API imports and verify full integration"
```

---

## Task 13: Build & Package with PyInstaller

**Files:**
- Create: `aircode.spec` (PyInstaller spec file)
- Modify: `Makefile` (add build target details)

- [ ] **Step 1: Create aircode.spec**

```python
# -*- mode: python ; coding: utf-8 -*-
import sys
from pathlib import Path

block_cipher = None

PROJECT_ROOT = Path(SPECPATH)
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

a = Analysis(
    [str(PROJECT_ROOT / "backend" / "main.py")],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=[
        (str(FRONTEND_DIST), "frontend/dist"),
    ],
    hiddenimports=[
        "webview",
        "webview.platforms",
        "webview.platforms.cocoa",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "PyQt5",
        "PyQt6",
        "PySide2",
        "PySide6",
        "tkinter",
        "matplotlib",
        "numpy",
        "PIL",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="AirCode",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="AirCode",
)

app = BUNDLE(
    coll,
    name="AirCode.app",
    icon=None,
    bundle_identifier="com.aircode.app",
    version="0.1.0",
    info_plist={
        "CFBundleName": "AirCode",
        "CFBundleDisplayName": "AirCode",
        "CFBundleVersion": "0.1.0",
        "CFBundleShortVersionString": "0.1.0",
        "NSHighResolutionCapable": True,
        "LSMinimumSystemVersion": "12.0",
    },
)
```

- [ ] **Step 2: Update Makefile build target**

Replace the `build` target in Makefile:

```makefile
build:
	@echo "Building frontend..."
	cd frontend && npm run build
	@echo "Building macOS app..."
	$(PYTHON) -m PyInstaller aircode.spec --noconfirm --clean
	@echo "Build complete: release/AirCode.app"
```

- [ ] **Step 3: Test build (optional, slow)**

```bash
make build
```
Expected: `release/AirCode.app` created.

- [ ] **Step 4: Commit**

```bash
git add aircode.spec Makefile
git commit -m "feat: add PyInstaller spec and build target for macOS app bundle"
```

---

## Task 14: Generate CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write CLAUDE.md**

```markdown
# AirCode - CLAUDE.md

## Project Overview

AirCode is a local Mac desktop development workstation built with Python + PyWebView + React + TypeScript. It integrates code editing, terminal, file management, and Git operations into a single-window two-panel interface.

## Tech Stack

- **Runtime**: Python 3.12 + PyWebView 5.x
- **Frontend**: React 19 + TypeScript 5.x (Vite)
- **Styling**: Tailwind CSS 4.x + shadcn/ui
- **State**: zustand
- **Editor**: Monaco Editor (@monaco-editor/react)
- **Terminal**: xterm.js (@xterm/xterm)
- **Package Manager**: npm (frontend) + pip (backend)

## Architecture

Two-layer architecture:
- **Backend** (`backend/`): Python — PyWebView window, system APIs (file I/O, PTY, git), exposed via `pywebview.api` bridge
- **Frontend** (`frontend/`): React — UI components, zustand stores, all UI state

Communication: `window.pywebview.api` (JS→Python), `window.evaluate_js()` (Python→JS for terminal streaming)

## Layout

Left-right two-panel:
- **Left panel**: Project list (each project = a working directory)
- **Right panel**: Tab workspace with 4 tab types:
  - Terminal (xterm.js + PTY)
  - Editor (Monaco Editor)
  - File Viewer (file tree + preview)
  - Git (status/commit/log/diff)

## Commands

```bash
make setup      # Init Python venv + install all deps
make dev        # Start Vite + PyWebView in dev mode
make dev:fe     # Frontend only (mock API)
make dev:be     # Backend only
make build      # Build frontend + package macOS .app
make clean      # Clean all build artifacts
```

## Directory Structure

```
backend/
├── main.py              # Entry point
├── api/
│   ├── base.py          # Root Api class + system dialogs
│   ├── project.py       # Project/directory management
│   ├── editor.py        # File read/write/search
│   ├── terminal.py      # PTY sessions
│   └── git.py           # Git operations
└── requirements.txt

frontend/
├── src/
│   ├── lib/api.ts       # PyWebView bridge + mock API
│   ├── lib/types.ts     # Shared TypeScript types
│   ├── stores/          # zustand stores (project, tab, editor, terminal)
│   ├── components/
│   │   ├── layout/      # TitleBar, StatusBar
│   │   ├── project/     # ProjectList
│   │   ├── workspace/   # TabBar, Workspace
│   │   └── tabs/        # TerminalTab, EditorTab, FileViewerTab, GitTab
│   └── index.css        # Tailwind + global styles
├── vite.config.ts
└── package.json
```

## Python Backend Conventions

- Use `pathlib.Path` for all paths, never `os.path`
- API methods return native types; errors return `{"error": "message"}`, never throw
- One API class per module, method naming `{verb}_{noun}` (e.g., `read_file`, `list_directory`)
- Type annotations on all public methods
- Use `logging` module, never `print`
- Terminal streaming: `_push_output()` via `window.evaluate_js()`

## React Frontend Conventions

- Functional components + TypeScript
- All backend calls through `@/lib/api.ts` wrapper, never access `window.pywebview` directly
- One zustand store per concern (project, tab, editor, terminal)
- Tailwind CSS utility classes first; custom CSS only in `index.css`
- Components organized by feature: `components/{feature}/`
- Import alias `@/` maps to `frontend/src/`

## General Conventions

- Code and comments in English; user-facing UI strings in Chinese
- Method naming follows `{module}:{action}` pattern
- Security: never execute unverified user input, never concatenate shell commands
- Frontend can run independently with mock API for development
- Python runs in `.venv/aircode` virtual environment

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `pywebview` | Desktop window + JS-Python bridge |
| `pyinstaller` | Package macOS .app |
| `@monaco-editor/react` | Code editor component |
| `@xterm/xterm` | Terminal UI |
| `zustand` | State management |
| `lucide-react` | Icons |
| `tailwindcss` | Styling |

## Build Artifacts

- `frontend/dist/` — Built frontend (HTML + JS + CSS)
- `release/AirCode.app` — Packaged macOS application
- `.venv/aircode/` — Python virtual environment
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with Python + React development conventions"
```

---

## Task 15: Final Verification

- [ ] **Step 1: Verify frontend compiles**

```bash
cd /opt/AirCode/frontend && npx tsc --noEmit && npm run build
```
Expected: Build succeeds, `frontend/dist/` contains `index.html` and assets.

- [ ] **Step 2: Verify backend loads**

```bash
cd /opt/AirCode && AIRCODE_DEV=0 .venv/aircode/bin/python -c "from backend.api import Api; print('Backend OK')"
```
Expected: `Backend OK`

- [ ] **Step 3: Verify full app in production mode**

```bash
cd /opt/AirCode && AIRCODE_DEV=0 .venv/aircode/bin/python backend/main.py
```
Expected: PyWebView window opens loading built frontend files. Layout renders, all UI elements visible.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: initial AirCode Python + PyWebView implementation complete"
```
