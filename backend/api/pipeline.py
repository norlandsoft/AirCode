import hashlib
import json
import logging
import subprocess
import threading
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def _hash_path(path: str) -> str:
    """Hash a project path to create a safe filename key."""
    return hashlib.sha256(path.encode()).hexdigest()[:12]


class PipelineApi:
    """Manage pipeline definitions and execution."""

    def __init__(self, root_api) -> None:
        self._api = root_api
        self._pipelines_dir = Path.home() / ".aircode" / "pipelines"
        self._pipelines_dir.mkdir(parents=True, exist_ok=True)
        self._runs: dict[str, dict] = {}
        self._processes: dict[str, subprocess.Popen] = {}

    def _pipeline_file(self, project_path: str) -> Path:
        return self._pipelines_dir / f"{_hash_path(project_path)}.json"

    def get_pipeline(self, project_path: str) -> dict:
        """Load pipeline definition for a project."""
        try:
            file_path = self._pipeline_file(project_path)
            if not file_path.exists():
                return {"pipeline": None}
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {"pipeline": data}
        except Exception as e:
            logger.exception("Failed to load pipeline")
            return {"error": str(e)}

    def save_pipeline(self, project_path: str, pipeline: dict) -> dict:
        """Save or update pipeline definition."""
        try:
            file_path = self._pipeline_file(project_path)
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(pipeline, f, indent=2, ensure_ascii=False)
            return {"success": True}
        except Exception as e:
            logger.exception("Failed to save pipeline")
            return {"error": str(e)}

    def run_pipeline(self, project_path: str) -> dict:
        """Start pipeline execution in a background thread."""
        try:
            result = self.get_pipeline(project_path)
            if result.get("error"):
                return result
            pipeline = result.get("pipeline")
            if not pipeline or not pipeline.get("nodes"):
                return {"error": "No pipeline nodes defined"}

            run_id = f"run_{int(time.time() * 1000)}"
            nodes = pipeline.get("nodes", [])
            run: dict[str, Any] = {
                "id": run_id,
                "pipelineId": pipeline.get("id", ""),
                "status": "running",
                "startedAt": time.time(),
                "nodeRuns": [
                    {"nodeId": node["id"], "status": "pending", "output": ""}
                    for node in nodes
                ],
            }
            self._runs[run_id] = run

            thread = threading.Thread(
                target=self._execute_pipeline,
                args=(run_id, pipeline, project_path),
                daemon=True,
            )
            thread.start()

            return {"run_id": run_id}
        except Exception as e:
            logger.exception("Failed to start pipeline")
            return {"error": str(e)}

    def stop_pipeline(self, run_id: str) -> dict:
        """Stop a running pipeline."""
        try:
            run = self._runs.get(run_id)
            if not run:
                return {"error": f"Run not found: {run_id}"}
            if run["status"] != "running":
                return {"error": "Pipeline is not running"}

            proc = self._processes.pop(run_id, None)
            if proc:
                try:
                    proc.terminate()
                except ProcessLookupError:
                    pass

            for nr in run["nodeRuns"]:
                if nr["status"] == "running":
                    nr["status"] = "failed"
                elif nr["status"] == "pending":
                    nr["status"] = "skipped"

            run["status"] = "cancelled"
            run["finishedAt"] = time.time()
            return {"success": True}
        except Exception as e:
            logger.exception("Failed to stop pipeline")
            return {"error": str(e)}

    def get_run_status(self, run_id: str) -> dict:
        """Get current execution status."""
        run = self._runs.get(run_id)
        if not run:
            return {"error": f"Run not found: {run_id}"}
        return {"run": run}

    def _execute_pipeline(self, run_id: str, pipeline: dict, project_path: str) -> None:
        """Execute pipeline nodes sequentially. Runs in a background thread."""
        nodes = pipeline.get("nodes", [])
        run = self._runs.get(run_id)
        if not run:
            return

        work_dir = project_path

        for i, node in enumerate(nodes):
            if run["status"] != "running":
                break

            node_run = run["nodeRuns"][i]

            if not node.get("command", "").strip():
                node_run["status"] = "skipped"
                self._push_event(run_id, "node_status", node["id"], "skipped")
                continue

            node_run["status"] = "running"
            node_run["startedAt"] = time.time()
            self._push_event(run_id, "node_status", node["id"], "running")

            node_work_dir = node.get("workDir") or work_dir
            node_env = None
            if node.get("env"):
                import os
                node_env = {**os.environ, **node["env"]}

            try:
                # Resolve shell executable based on node preference
                shell_type = node.get("shell", "zsh")
                shell_executable = "/bin/zsh" if shell_type == "zsh" else "/bin/bash"
                # Use login shell (-l) so user's profile (.zshrc/.bash_profile)
                # is sourced, making tools like npm/node available via PATH.
                proc = subprocess.Popen(
                    [shell_executable, "-l", "-c", node["command"]],
                    shell=False,
                    cwd=node_work_dir,
                    env=node_env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                )
                self._processes[run_id] = proc

                import codecs
                decoder = codecs.getincrementaldecoder("utf-8")("replace")
                while True:
                    chunk = proc.stdout.read(4096)
                    if not chunk:
                        break
                    text = decoder.decode(chunk, final=False)
                    if text:
                        node_run["output"] += text
                        if len(node_run["output"]) > 500_000:
                            node_run["output"] = node_run["output"][-500_000:]
                        self._push_output(run_id, node["id"], text)

                proc.wait()
                self._processes.pop(run_id, None)
                exit_code = proc.returncode

            except Exception as e:
                node_run["output"] += f"\nError: {e}"
                self._push_output(run_id, node["id"], f"\nError: {e}")
                exit_code = 1

            node_run["exitCode"] = exit_code
            node_run["finishedAt"] = time.time()

            if exit_code == 0:
                node_run["status"] = "success"
                self._push_event(run_id, "node_status", node["id"], "success")
            else:
                node_run["status"] = "failed"
                self._push_event(run_id, "node_status", node["id"], "failed")
                for nr in run["nodeRuns"][i + 1:]:
                    nr["status"] = "skipped"
                    self._push_event(run_id, "node_status", nr["nodeId"], "skipped")
                break

        all_success = all(nr["status"] == "success" for nr in run["nodeRuns"])
        run["status"] = "success" if all_success else "failed"
        run["finishedAt"] = time.time()
        self._push_event(run_id, "pipeline_status", "", run["status"])

    def _push_event(self, run_id: str, event_type: str, node_id: str, status: str) -> None:
        """Push a status change event to the frontend."""
        escaped = json.dumps({"type": event_type, "nodeId": node_id, "status": status})
        js_code = (
            f"if(window.__aircode_on_pipeline_event)"
            f"window.__aircode_on_pipeline_event('{run_id}',{escaped})"
        )
        self._api._evaluate_js(js_code)

    def _push_output(self, run_id: str, node_id: str, data: str) -> None:
        """Push terminal output data to the frontend."""
        escaped_data = json.dumps(data)
        js_code = (
            f"if(window.__aircode_on_pipeline_event)"
            f"window.__aircode_on_pipeline_event('{run_id}',"
            f"{{'type':'node_output','nodeId':'{node_id}','data':{escaped_data}}})"
        )
        self._api._evaluate_js(js_code)
