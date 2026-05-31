import fcntl
import logging
import os
import struct
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

            if not shell:
                shell = os.environ.get("SHELL", "/bin/zsh")

            master_fd, slave_fd = os.openpty()

            winsize = struct.pack("HHHH", 24, 80, 0, 0)
            fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, winsize)

            pid = os.fork()
            if pid == 0:
                # Child process
                os.close(master_fd)
                os.setsid()

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

                flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
                fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

                self._sessions[session_id] = {
                    "id": session_id,
                    "pid": pid,
                    "master_fd": master_fd,
                    "shell": shell,
                    "cwd": str(work_dir),
                }

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
        import json
        import time

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

                text = buf.decode("utf-8", errors="replace")
                buf = b""
                self._push_output(session_id, text)

            except BlockingIOError:
                time.sleep(0.01)
            except OSError:
                break

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
