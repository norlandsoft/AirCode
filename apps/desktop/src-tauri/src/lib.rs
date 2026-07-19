use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{Mutex, oneshot};
use uuid::Uuid;

const SESSION_EVENT: &str = "session:event";

#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub cwd: String,
    #[serde(rename = "modelId")]
    pub model_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSessionResponse {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub cwd: String,
}

#[derive(Debug, Deserialize)]
pub struct PromptRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub text: String,
}

#[derive(Debug, Deserialize)]
pub struct SteerRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub text: String,
}

#[derive(Debug, Deserialize)]
pub struct SessionIdRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionStateDto {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub cwd: String,
    #[serde(rename = "isStreaming")]
    pub is_streaming: bool,
    #[serde(rename = "modelId")]
    pub model_id: Option<String>,
    #[serde(rename = "thinkingLevel")]
    pub thinking_level: Option<String>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HostLine {
    id: Option<String>,
    result: Option<Value>,
    error: Option<String>,
    event: Option<String>,
    payload: Option<Value>,
}

struct PendingMap {
    inner: Mutex<HashMap<String, oneshot::Sender<Result<Value, String>>>>,
}

pub struct AgentHostState {
    stdin: Mutex<ChildStdin>,
    pending: Arc<PendingMap>,
    _child: Mutex<Child>,
}

impl AgentHostState {
    async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel();
        {
            let mut map = self.pending.inner.lock().await;
            map.insert(id.clone(), tx);
        }

        let req = serde_json::json!({
            "id": id,
            "method": method,
            "params": params,
        });
        let line = format!("{}\n", req);
        {
            let mut stdin = self.stdin.lock().await;
            stdin
                .write_all(line.as_bytes())
                .await
                .map_err(|e| format!("Failed to write to agent host: {e}"))?;
            stdin
                .flush()
                .await
                .map_err(|e| format!("Failed to flush agent host stdin: {e}"))?;
        }

        match tokio::time::timeout(Duration::from_secs(600), rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err("Agent host response channel closed".into()),
            Err(_) => Err("Agent host request timed out".into()),
        }
    }
}

fn host_script_path() -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("AIRCODE_HOST_JS") {
        return Ok(PathBuf::from(path));
    }
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidate = manifest_dir.join("../host-dist/index.js");
    if candidate.exists() {
        return Ok(candidate.canonicalize().map_err(|e| e.to_string())?);
    }
    Err(format!(
        "Agent host script not found at {}. Run `npm run build:host` first, or set AIRCODE_HOST_JS.",
        candidate.display()
    ))
}

async fn spawn_agent_host(app: AppHandle) -> Result<AgentHostState, String> {
    let script = host_script_path()?;
    let mut child = Command::new("node")
        .arg(&script)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn agent host (node {}): {e}", script.display()))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to open agent host stdin".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to open agent host stdout".to_string())?;

    let pending = Arc::new(PendingMap {
        inner: Mutex::new(HashMap::new()),
    });
    let pending_reader = Arc::clone(&pending);

    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            let parsed: HostLine = match serde_json::from_str(trimmed) {
                Ok(v) => v,
                Err(err) => {
                    eprintln!("[aircode-host] invalid JSON line: {err}: {trimmed}");
                    continue;
                }
            };

            if let Some(event_name) = parsed.event {
                if event_name == SESSION_EVENT {
                    if let Some(payload) = parsed.payload {
                        let _ = app.emit(SESSION_EVENT, payload);
                    }
                }
                continue;
            }

            if let Some(id) = parsed.id {
                let mut map = pending_reader.inner.lock().await;
                if let Some(tx) = map.remove(&id) {
                    let result = if let Some(error) = parsed.error {
                        Err(error)
                    } else {
                        Ok(parsed.result.unwrap_or(Value::Null))
                    };
                    let _ = tx.send(result);
                }
            }
        }
    });

    Ok(AgentHostState {
        stdin: Mutex::new(stdin),
        pending,
        _child: Mutex::new(child),
    })
}

#[tauri::command]
async fn session_create(
    state: State<'_, AgentHostState>,
    req: CreateSessionRequest,
) -> Result<CreateSessionResponse, String> {
    let params = serde_json::json!({
        "cwd": req.cwd,
        "modelId": req.model_id,
    });
    let value = state.call("session.create", params).await?;
    serde_json::from_value(value).map_err(|e| e.to_string())
}

#[tauri::command]
async fn session_prompt(
    state: State<'_, AgentHostState>,
    req: PromptRequest,
) -> Result<(), String> {
    let params = serde_json::json!({
        "sessionId": req.session_id,
        "text": req.text,
    });
    state.call("session.prompt", params).await?;
    Ok(())
}

#[tauri::command]
async fn session_steer(
    state: State<'_, AgentHostState>,
    req: SteerRequest,
) -> Result<(), String> {
    let params = serde_json::json!({
        "sessionId": req.session_id,
        "text": req.text,
    });
    state.call("session.steer", params).await?;
    Ok(())
}

#[tauri::command]
async fn session_abort(
    state: State<'_, AgentHostState>,
    req: SessionIdRequest,
) -> Result<(), String> {
    let params = serde_json::json!({ "sessionId": req.session_id });
    state.call("session.abort", params).await?;
    Ok(())
}

#[tauri::command]
async fn session_dispose(
    state: State<'_, AgentHostState>,
    req: SessionIdRequest,
) -> Result<(), String> {
    let params = serde_json::json!({ "sessionId": req.session_id });
    state.call("session.dispose", params).await?;
    Ok(())
}

#[tauri::command]
async fn session_get_state(
    state: State<'_, AgentHostState>,
    req: SessionIdRequest,
) -> Result<SessionStateDto, String> {
    let params = serde_json::json!({ "sessionId": req.session_id });
    let value = state.call("session.getState", params).await?;
    serde_json::from_value(value).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let host = spawn_agent_host(handle.clone()).await?;
                handle.manage(host);
                Ok::<(), String>(())
            })
            .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            session_create,
            session_prompt,
            session_steer,
            session_abort,
            session_dispose,
            session_get_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running AirCode");
}
