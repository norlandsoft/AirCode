import { useEffect, useRef } from "react";
import { Empty, Tag, Typography } from "antd";

export type RunLogLevel = "info" | "success" | "warn" | "error" | "debug";

export interface RunLogEntry {
  id: string;
  time: string;
  level: RunLogLevel;
  source: string;
  message: string;
}

export interface RunLogPanelProps {
  logs: RunLogEntry[];
}

const LEVEL_COLOR: Record<RunLogLevel, string> = {
  info: "blue",
  success: "green",
  warn: "orange",
  error: "red",
  debug: "default",
};

export function RunLogPanel({ logs }: RunLogPanelProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="run-log-panel">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无运行日志" />
      </div>
    );
  }

  return (
    <div className="run-log-panel">
      {logs.map((log) => (
        <div key={log.id} className={`run-log-line level-${log.level}`}>
          <Typography.Text type="secondary" className="run-log-time">
            {log.time}
          </Typography.Text>
          <Tag color={LEVEL_COLOR[log.level]}>{log.level}</Tag>
          <Typography.Text className="run-log-source">{log.source}</Typography.Text>
          <Typography.Text className="run-log-message">{log.message}</Typography.Text>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

export function formatLogTime(date = new Date()): string {
  return date.toLocaleTimeString("zh-CN", { hour12: false });
}
