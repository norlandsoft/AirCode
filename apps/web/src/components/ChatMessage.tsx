import { Alert, Typography } from "antd";
import { MarkdownView } from "./MarkdownView";
import { CodeViewer } from "./CodeViewer";

export interface ChatItem {
  id: string;
  kind: "user" | "assistant" | "tool" | "error";
  text: string;
  language?: string;
  toolName?: string;
}

export interface ChatMessageProps {
  item: ChatItem;
  streaming?: boolean;
}

export function ChatMessage({ item, streaming }: ChatMessageProps) {
  if (item.kind === "user") {
    return (
      <div className="msg msg-user">
        <div className="msg-user-bubble">
          <MarkdownView content={item.text} />
        </div>
      </div>
    );
  }

  if (item.kind === "error") {
    return (
      <div className="msg msg-assistant">
        <Alert type="error" showIcon message={item.text} />
      </div>
    );
  }

  if (item.kind === "tool") {
    return (
      <div className="msg msg-assistant">
        <div className="msg-meta">
          <Typography.Text type="secondary">
            工具{item.toolName ? ` · ${item.toolName}` : ""}
          </Typography.Text>
        </div>
        <div className="msg-tool-body">
          <CodeViewer value={item.text} language={item.language ?? "json"} />
        </div>
      </div>
    );
  }

  return (
    <div className="msg msg-assistant">
      <div className="msg-meta">
        <Typography.Text type="secondary">AirCode</Typography.Text>
      </div>
      <div className="msg-assistant-body">
        {item.text ? (
          <MarkdownView content={item.text} />
        ) : streaming ? (
          <Typography.Text type="secondary">正在思考…</Typography.Text>
        ) : null}
      </div>
    </div>
  );
}
