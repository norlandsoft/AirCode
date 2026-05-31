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
        add_result = self._run_git(["add", "-A"], project_path)
        if "error" in add_result:
            return add_result
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
