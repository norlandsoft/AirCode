import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Drawer, Flex, Layout, Tag, Typography } from "antd";
import { UnorderedListOutlined } from "@ant-design/icons";
import type { AgentEventDto } from "@aircode/shared";
import { aircodeApi } from "./lib/api";
import { SessionSidebar } from "./components/SessionSidebar";
import { ChatMessage, type ChatItem } from "./components/ChatMessage";
import { ComposerInput } from "./components/ComposerInput";
import {
  formatLogTime,
  RunLogPanel,
  type RunLogEntry,
  type RunLogLevel,
} from "./components/RunLogPanel";

const { Content } = Layout;
const { Text, Title } = Typography;

interface AgentSession {
  id: string;
  title: string;
  cwd: string;
  updatedAt: number;
  items: ChatItem[];
  logs: RunLogEntry[];
  streaming: boolean;
  status: string;
  error: string | null;
}

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeLog(level: RunLogLevel, source: string, message: string): RunLogEntry {
  return {
    id: nextId(),
    time: formatLogTime(),
    level,
    source,
    message,
  };
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function titleFromPrompt(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine ? truncate(oneLine, 36) : "新会话";
}

export function App() {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const assistantBuffers = useRef(new Map<string, string>());
  const unsubsRef = useRef(new Map<string, () => void>());
  const sessionsRef = useRef<AgentSession[]>([]);
  const createSessionRef = useRef<() => Promise<string | null>>(async () => null);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  );

  const patchSession = useCallback(
    (id: string, patch: Partial<AgentSession> | ((prev: AgentSession) => Partial<AgentSession>)) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const next = typeof patch === "function" ? patch(s) : patch;
          return { ...s, ...next, updatedAt: Date.now() };
        }),
      );
    },
    [],
  );

  const appendLog = useCallback(
    (id: string, level: RunLogLevel, source: string, message: string) => {
      patchSession(id, (s) => ({
        logs: [...s.logs, makeLog(level, source, message)],
      }));
    },
    [patchSession],
  );

  const handleEvent = useCallback(
    (sessionId: string, event: AgentEventDto) => {
      switch (event.type) {
        case "agent_start":
          patchSession(sessionId, { streaming: true, status: "运行中…" });
          appendLog(sessionId, "info", "agent", "开始处理任务");
          break;
        case "turn_start":
          appendLog(sessionId, "debug", "agent", "回合开始");
          break;
        case "turn_end":
          appendLog(sessionId, "debug", "agent", "回合结束");
          break;
        case "message_start":
          appendLog(sessionId, "debug", "message", `消息开始 role=${event.role}`);
          if (event.role === "assistant") {
            assistantBuffers.current.set(sessionId, "");
            patchSession(sessionId, (s) => ({
              items: [...s.items, { id: nextId(), kind: "assistant", text: "" }],
            }));
          }
          break;
        case "message_update":
          if (event.delta) {
            const prev = assistantBuffers.current.get(sessionId) ?? "";
            const text = prev + event.delta;
            assistantBuffers.current.set(sessionId, text);
            patchSession(sessionId, (s) => {
              const items = [...s.items];
              for (let i = items.length - 1; i >= 0; i -= 1) {
                if (items[i]?.kind === "assistant") {
                  items[i] = { ...items[i]!, text };
                  break;
                }
              }
              return { items };
            });
          }
          break;
        case "message_end":
          appendLog(
            sessionId,
            "info",
            "message",
            `消息结束 role=${event.role}${event.text ? ` (${event.text.length} 字符)` : ""}`,
          );
          break;
        case "tool_execution_start":
          appendLog(
            sessionId,
            "info",
            "tool",
            `${event.toolName} 开始 · ${event.toolCallId.slice(0, 8)}`,
          );
          patchSession(sessionId, (s) => ({
            items: [
              ...s.items,
              {
                id: nextId(),
                kind: "tool",
                toolName: event.toolName,
                language: "json",
                text: JSON.stringify(
                  { tool: event.toolName, args: event.args ?? null },
                  null,
                  2,
                ),
              },
            ],
          }));
          break;
        case "tool_execution_update":
          if (event.partialText) {
            appendLog(
              sessionId,
              "debug",
              "tool",
              `${event.toolName} 进度: ${truncate(event.partialText, 120)}`,
            );
          }
          break;
        case "tool_execution_end":
          appendLog(
            sessionId,
            event.isError ? "error" : "success",
            "tool",
            `${event.toolName} ${event.isError ? "失败" : "完成"}`,
          );
          if (event.resultText) {
            patchSession(sessionId, (s) => ({
              items: [
                ...s.items,
                {
                  id: nextId(),
                  kind: "tool",
                  toolName: event.toolName,
                  language: "plaintext",
                  text: truncate(event.resultText ?? "", 4000),
                },
              ],
            }));
          }
          break;
        case "agent_end":
          patchSession(sessionId, { streaming: false, status: "就绪" });
          appendLog(sessionId, "success", "agent", "任务结束");
          break;
        case "error":
          patchSession(sessionId, (s) => ({
            streaming: false,
            status: "出错",
            items: [...s.items, { id: nextId(), kind: "error", text: event.message }],
          }));
          appendLog(sessionId, "error", "agent", event.message);
          break;
        default:
          break;
      }
    },
    [appendLog, patchSession],
  );

  const ensureSubscribed = useCallback(
    (sessionId: string) => {
      if (unsubsRef.current.has(sessionId)) return;
      const unsub = aircodeApi.subscribeEvents(sessionId, (event) => {
        handleEvent(sessionId, event);
      });
      unsubsRef.current.set(sessionId, unsub);
    },
    [handleEvent],
  );

  const createSession = useCallback(async (): Promise<string | null> => {
    setCreating(true);
    setBootError(null);
    const result = await aircodeApi.createSession({ cwd: "" });
    setCreating(false);
    if (!result.ok) {
      setBootError(result.error);
      return null;
    }

    const session: AgentSession = {
      id: result.data.sessionId,
      title: "新会话",
      cwd: result.data.cwd,
      updatedAt: Date.now(),
      items: [],
      logs: [makeLog("success", "system", `会话已创建 · ${result.data.sessionId.slice(0, 8)}`)],
      streaming: false,
      status: "就绪",
      error: null,
    };

    setSessions((prev) => [session, ...prev]);
    setActiveId(session.id);
    ensureSubscribed(session.id);
    return session.id;
  }, [ensureSubscribed]);

  createSessionRef.current = createSession;

  useEffect(() => {
    void createSessionRef.current();
    return () => {
      for (const unsub of unsubsRef.current.values()) {
        unsub();
      }
      unsubsRef.current.clear();
      for (const session of sessionsRef.current) {
        void aircodeApi.dispose({ sessionId: session.id });
      }
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.items, active?.streaming]);

  function onSelectSession(id: string): void {
    if (id === activeId) return;
    setActiveId(id);
    ensureSubscribed(id);
  }

  async function onSend(): Promise<void> {
    if (!active || active.streaming) return;
    const text = input.trim();
    if (!text) return;

    setInput("");
    const isFirst = active.items.every((i) => i.kind !== "user");
    patchSession(active.id, (s) => ({
      title: isFirst ? titleFromPrompt(text) : s.title,
      status: "运行中…",
      error: null,
      items: [...s.items, { id: nextId(), kind: "user", text }],
      logs: [...s.logs, makeLog("info", "user", truncate(text, 200))],
    }));

    const result = await aircodeApi.prompt({ sessionId: active.id, text });
    if (!result.ok) {
      patchSession(active.id, (s) => ({
        streaming: false,
        status: "出错",
        error: result.error,
        items: [...s.items, { id: nextId(), kind: "error", text: result.error }],
        logs: [...s.logs, makeLog("error", "http", result.error)],
      }));
    }
  }

  async function onAbort(): Promise<void> {
    if (!active) return;
    appendLog(active.id, "warn", "user", "请求中断");
    const result = await aircodeApi.abort({ sessionId: active.id });
    if (!result.ok) {
      patchSession(active.id, {
        error: result.error,
      });
      appendLog(active.id, "error", "http", result.error);
    }
  }

  return (
    <Layout className="app-shell">
      <SessionSidebar
        sessions={sessions.map((s) => ({
          id: s.id,
          title: s.title,
          updatedAt: s.updatedAt,
          streaming: s.streaming,
        }))}
        activeId={activeId}
        onSelect={onSelectSession}
        onCreate={() => void createSession()}
        creating={creating}
      />

      <Content className="chat-pane">
        <header className="chat-header">
          <div className="chat-header-main">
            <Title level={5} style={{ margin: 0 }}>
              {active?.title ?? "AirCode"}
            </Title>
            <Flex gap={8} wrap>
              <Tag color={active?.streaming ? "processing" : "default"}>
                {active?.status ?? "—"}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {active?.cwd ?? ""}
              </Text>
            </Flex>
          </div>
          <button
            type="button"
            className="chat-header-action"
            onClick={() => setLogOpen(true)}
            title="运行日志"
          >
            <UnorderedListOutlined />
          </button>
        </header>

        <div className="chat-scroll">
          {bootError ? (
            <Alert type="error" showIcon message={bootError} style={{ marginBottom: 16 }} />
          ) : null}

          {!active || active.items.length === 0 ? (
            <div className="chat-empty">
              <Title level={3} style={{ fontWeight: 500, marginBottom: 8 }}>
                开始新的 Agent 任务
              </Title>
              <Text type="secondary">在下方输入框描述你的目标，按 ⌘/Ctrl + Enter 发送。</Text>
            </div>
          ) : (
            <div className="chat-thread">
              {active.items.map((item) => (
                <ChatMessage
                  key={item.id}
                  item={item}
                  streaming={active.streaming && item.kind === "assistant"}
                />
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        <div className="chat-composer-wrap">
          {active?.error ? (
            <Alert
              type="error"
              showIcon
              message={active.error}
              closable
              onClose={() => patchSession(active.id, { error: null })}
              style={{ marginBottom: 8 }}
            />
          ) : null}
          <ComposerInput
            value={input}
            onChange={setInput}
            onSend={() => void onSend()}
            onAbort={() => void onAbort()}
            disabled={!active}
            streaming={Boolean(active?.streaming)}
          />
        </div>
      </Content>

      <Drawer
        title="运行日志"
        placement="right"
        width={420}
        open={logOpen}
        onClose={() => setLogOpen(false)}
      >
        <RunLogPanel logs={active?.logs ?? []} />
      </Drawer>
    </Layout>
  );
}
