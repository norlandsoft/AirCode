import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentEventDto } from "@aircode/shared";
import { aircodeApi } from "./lib/api";

interface ChatItem {
  id: string;
  kind: "user" | "assistant" | "tool" | "error";
  text: string;
}

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cwd, setCwd] = useState<string>("");
  const [input, setInput] = useState("列出当前目录的文件");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("正在初始化会话…");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const assistantBuffer = useRef("");
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    async function boot(): Promise<void> {
      const result = await aircodeApi.createSession({ cwd: "" });
      if (disposed) {
        if (result.ok) {
          void aircodeApi.dispose({ sessionId: result.data.sessionId });
        }
        return;
      }
      if (!result.ok) {
        setError(result.error);
        setStatus("会话创建失败");
        return;
      }

      sessionIdRef.current = result.data.sessionId;
      setSessionId(result.data.sessionId);
      setCwd(result.data.cwd);
      unsubscribe = aircodeApi.subscribeEvents(result.data.sessionId, (event) => {
        handleEvent(event);
      });
      setStatus("就绪");
    }

    void boot();

    return () => {
      disposed = true;
      unsubscribe?.();
      const id = sessionIdRef.current;
      if (id) {
        void aircodeApi.dispose({ sessionId: id });
      }
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, streaming]);

  const canSend = useMemo(
    () => Boolean(sessionId) && !streaming && input.trim().length > 0,
    [sessionId, streaming, input],
  );

  function handleEvent(event: AgentEventDto): void {
    switch (event.type) {
      case "agent_start":
        setStreaming(true);
        break;
      case "message_start":
        if (event.role === "assistant") {
          assistantBuffer.current = "";
          setItems((prev) => [
            ...prev,
            { id: nextId(), kind: "assistant", text: "" },
          ]);
        }
        break;
      case "message_update":
        if (event.delta) {
          assistantBuffer.current += event.delta;
          const text = assistantBuffer.current;
          setItems((prev) => {
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i -= 1) {
              if (next[i]?.kind === "assistant") {
                next[i] = { ...next[i]!, text };
                break;
              }
            }
            return next;
          });
        }
        break;
      case "tool_execution_start":
        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            kind: "tool",
            text: `▶ ${event.toolName}\n${safeJson(event.args)}`,
          },
        ]);
        break;
      case "tool_execution_end":
        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            kind: "tool",
            text: `■ ${event.toolName}${event.isError ? " (error)" : ""}${
              event.resultText ? `\n${truncate(event.resultText, 800)}` : ""
            }`,
          },
        ]);
        break;
      case "agent_end":
        setStreaming(false);
        setStatus("就绪");
        break;
      case "error":
        setStreaming(false);
        setItems((prev) => [
          ...prev,
          { id: nextId(), kind: "error", text: event.message },
        ]);
        break;
      default:
        break;
    }
  }

  async function onSend(): Promise<void> {
    if (!sessionId || !canSend) {
      return;
    }
    const text = input.trim();
    setInput("");
    setError(null);
    setStatus("运行中…");
    setItems((prev) => [...prev, { id: nextId(), kind: "user", text }]);

    const result = await aircodeApi.prompt({ sessionId, text });
    if (!result.ok) {
      setStreaming(false);
      setError(result.error);
      setStatus("出错");
      setItems((prev) => [
        ...prev,
        { id: nextId(), kind: "error", text: result.error },
      ]);
    }
  }

  async function onAbort(): Promise<void> {
    if (!sessionId) {
      return;
    }
    const result = await aircodeApi.abort({ sessionId });
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>AirCode</h1>
          <p>基于 Pi Agent 的通用智能体平台</p>
        </div>
        <div className="meta">
          <div>{status}</div>
          <div>{cwd || "—"}</div>
          <div>{sessionId ? sessionId.slice(0, 8) : "无会话"}</div>
        </div>
      </header>

      <section className="transcript">
        {items.length === 0 ? (
          <div className="empty">发送一条消息，开始与智能体协作。</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`bubble ${item.kind}`}>
              <span className="role">{labelFor(item.kind)}</span>
              {item.text || (item.kind === "assistant" && streaming ? "…" : "")}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </section>

      <footer className="composer">
        {error ? <div className="bubble error">{error}</div> : null}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入任务，例如：阅读 README 并总结要点"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void onSend();
            }
          }}
        />
        <div className="actions">
          <button type="button" onClick={() => void onAbort()} disabled={!streaming}>
            中断
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => void onSend()}
            disabled={!canSend}
          >
            发送
          </button>
        </div>
      </footer>
    </div>
  );
}

function labelFor(kind: ChatItem["kind"]): string {
  switch (kind) {
    case "user":
      return "用户";
    case "assistant":
      return "助手";
    case "tool":
      return "工具";
    case "error":
      return "错误";
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
