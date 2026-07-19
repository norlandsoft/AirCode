import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  Alert,
  Button,
  Card,
  Flex,
  Input,
  Layout,
  Space,
  Splitter,
  Tag,
  Typography,
} from "antd";
import {
  ClearOutlined,
  PauseCircleOutlined,
  SendOutlined,
} from "@ant-design/icons";
import type { AgentEventDto } from "@aircode/shared";
import { aircodeApi } from "./lib/api";
import { MarkdownView } from "./components/MarkdownView";
import { CodeViewer } from "./components/CodeViewer";
import {
  formatLogTime,
  RunLogPanel,
  type RunLogEntry,
  type RunLogLevel,
} from "./components/RunLogPanel";

const { Header, Content, Footer } = Layout;
const { Text, Title } = Typography;
const { TextArea } = Input;

interface ChatItem {
  id: string;
  kind: "user" | "assistant" | "tool" | "error";
  text: string;
  language?: string;
}

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function appendLog(
  setLogs: Dispatch<SetStateAction<RunLogEntry[]>>,
  level: RunLogLevel,
  source: string,
  message: string,
): void {
  setLogs((prev) => [
    ...prev,
    {
      id: nextId(),
      time: formatLogTime(),
      level,
      source,
      message,
    },
  ]);
}

export function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cwd, setCwd] = useState<string>("");
  const [input, setInput] = useState("列出当前目录的文件");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [logs, setLogs] = useState<RunLogEntry[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("正在初始化会话…");
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const assistantBuffer = useRef("");
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    async function boot(): Promise<void> {
      appendLog(setLogs, "info", "system", "正在创建 Agent 会话…");
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
        appendLog(setLogs, "error", "system", `会话创建失败: ${result.error}`);
        return;
      }

      sessionIdRef.current = result.data.sessionId;
      setSessionId(result.data.sessionId);
      setCwd(result.data.cwd);
      unsubscribe = aircodeApi.subscribeEvents(result.data.sessionId, (event) => {
        handleEvent(event);
      });
      setStatus("就绪");
      appendLog(
        setLogs,
        "success",
        "system",
        `会话已就绪 (${result.data.sessionId.slice(0, 8)}) cwd=${result.data.cwd}`,
      );
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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, streaming]);

  const canSend = useMemo(
    () => Boolean(sessionId) && !streaming && input.trim().length > 0,
    [sessionId, streaming, input],
  );

  function handleEvent(event: AgentEventDto): void {
    switch (event.type) {
      case "agent_start":
        setStreaming(true);
        appendLog(setLogs, "info", "agent", "开始处理任务");
        break;
      case "turn_start":
        appendLog(setLogs, "debug", "agent", "回合开始");
        break;
      case "turn_end":
        appendLog(setLogs, "debug", "agent", "回合结束");
        break;
      case "message_start":
        appendLog(setLogs, "debug", "message", `消息开始 role=${event.role}`);
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
      case "message_end":
        appendLog(
          setLogs,
          "info",
          "message",
          `消息结束 role=${event.role}${event.text ? ` (${event.text.length} 字符)` : ""}`,
        );
        break;
      case "tool_execution_start":
        appendLog(
          setLogs,
          "info",
          "tool",
          `${event.toolName} 开始 · ${event.toolCallId.slice(0, 8)}`,
        );
        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            kind: "tool",
            language: "json",
            text: JSON.stringify(
              { tool: event.toolName, args: event.args ?? null },
              null,
              2,
            ),
          },
        ]);
        break;
      case "tool_execution_update":
        if (event.partialText) {
          appendLog(
            setLogs,
            "debug",
            "tool",
            `${event.toolName} 进度: ${truncate(event.partialText, 120)}`,
          );
        }
        break;
      case "tool_execution_end":
        appendLog(
          setLogs,
          event.isError ? "error" : "success",
          "tool",
          `${event.toolName} ${event.isError ? "失败" : "完成"}`,
        );
        if (event.resultText) {
          setItems((prev) => [
            ...prev,
            {
              id: nextId(),
              kind: "tool",
              language: "plaintext",
              text: truncate(event.resultText ?? "", 4000),
            },
          ]);
        }
        break;
      case "agent_end":
        setStreaming(false);
        setStatus("就绪");
        appendLog(setLogs, "success", "agent", "任务结束");
        break;
      case "error":
        setStreaming(false);
        appendLog(setLogs, "error", "agent", event.message);
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
    appendLog(setLogs, "info", "user", truncate(text, 200));

    const result = await aircodeApi.prompt({ sessionId, text });
    if (!result.ok) {
      setStreaming(false);
      setError(result.error);
      setStatus("出错");
      appendLog(setLogs, "error", "http", result.error);
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
    appendLog(setLogs, "warn", "user", "请求中断");
    const result = await aircodeApi.abort({ sessionId });
    if (!result.ok) {
      setError(result.error);
      appendLog(setLogs, "error", "http", result.error);
    }
  }

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <Flex align="center" justify="space-between" style={{ width: "100%" }}>
          <Space direction="vertical" size={0}>
            <Title level={4} style={{ margin: 0, color: "#fff" }}>
              AirCode
            </Title>
            <Text style={{ color: "rgba(255,255,255,0.75)" }}>
              基于 Pi Agent 的通用智能体平台
            </Text>
          </Space>
          <Space wrap>
            <Tag color={streaming ? "processing" : "success"}>{status}</Tag>
            <Tag>{cwd || "—"}</Tag>
            <Tag>{sessionId ? sessionId.slice(0, 8) : "无会话"}</Tag>
          </Space>
        </Flex>
      </Header>

      <Content className="app-content">
        <Splitter className="app-splitter">
          <Splitter.Panel defaultSize="62%" min="40%">
            <Card
              title="对话"
              size="small"
              className="panel-card"
              styles={{ body: { height: "100%", overflow: "auto" } }}
            >
              {items.length === 0 ? (
                <Flex align="center" justify="center" style={{ height: "100%" }}>
                  <Text type="secondary">发送一条消息，开始与智能体协作。</Text>
                </Flex>
              ) : (
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  {items.map((item) => (
                    <ChatBubble
                      key={item.id}
                      item={item}
                      streaming={streaming}
                    />
                  ))}
                  <div ref={chatEndRef} />
                </Space>
              )}
            </Card>
          </Splitter.Panel>
          <Splitter.Panel defaultSize="38%" min="28%">
            <Card
              title="运行日志"
              size="small"
              className="panel-card"
              extra={
                <Button
                  size="small"
                  icon={<ClearOutlined />}
                  onClick={() => setLogs([])}
                >
                  清空
                </Button>
              }
              styles={{ body: { height: "100%", overflow: "auto", padding: 8 } }}
            >
              <RunLogPanel logs={logs} />
            </Card>
          </Splitter.Panel>
        </Splitter>
      </Content>

      <Footer className="app-footer">
        {error ? (
          <Alert
            type="error"
            showIcon
            message={error}
            style={{ marginBottom: 8 }}
            closable
            onClose={() => setError(null)}
          />
        ) : null}
        <Space.Compact style={{ width: "100%" }}>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入任务，例如：阅读 README 并总结要点（Ctrl/⌘ + Enter 发送）"
            autoSize={{ minRows: 2, maxRows: 6 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void onSend();
              }
            }}
          />
        </Space.Compact>
        <Flex justify="flex-end" gap={8} style={{ marginTop: 8 }}>
          <Button
            icon={<PauseCircleOutlined />}
            onClick={() => void onAbort()}
            disabled={!streaming}
          >
            中断
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => void onSend()}
            disabled={!canSend}
            loading={streaming}
          >
            发送
          </Button>
        </Flex>
      </Footer>
    </Layout>
  );
}

function ChatBubble({
  item,
  streaming,
}: {
  item: ChatItem;
  streaming: boolean;
}) {
  const title =
    item.kind === "user"
      ? "用户"
      : item.kind === "assistant"
        ? "助手"
        : item.kind === "tool"
          ? "工具"
          : "错误";

  return (
    <Card
      size="small"
      type="inner"
      title={title}
      className={`chat-bubble kind-${item.kind}`}
    >
      {item.kind === "assistant" ? (
        item.text ? (
          <MarkdownView content={item.text} />
        ) : streaming ? (
          <Text type="secondary">…</Text>
        ) : null
      ) : item.kind === "tool" ? (
        <CodeViewer value={item.text} language={item.language ?? "json"} />
      ) : item.kind === "error" ? (
        <Alert type="error" showIcon message={item.text} />
      ) : (
        <MarkdownView content={item.text} />
      )}
    </Card>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
