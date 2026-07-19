import { Button, Flex, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";

export interface SessionListItem {
  id: string;
  title: string;
  updatedAt: number;
  streaming?: boolean;
}

export interface SessionSidebarProps {
  sessions: SessionListItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  creating?: boolean;
}

export function SessionSidebar({
  sessions,
  activeId,
  onSelect,
  onCreate,
  creating,
}: SessionSidebarProps) {
  return (
    <aside className="session-sidebar">
      <div className="session-sidebar-top">
        <Button
          type="text"
          block
          icon={<PlusOutlined />}
          className="session-new-btn"
          loading={creating}
          onClick={onCreate}
        >
          新建会话
        </Button>
      </div>

      <div className="session-sidebar-label">会话</div>

      <div className="session-list">
        {sessions.length === 0 ? (
          <Typography.Text type="secondary" className="session-empty">
            还没有会话
          </Typography.Text>
        ) : (
          sessions.map((session) => {
            const active = session.id === activeId;
            return (
              <button
                key={session.id}
                type="button"
                className={`session-item${active ? " active" : ""}`}
                onClick={() => onSelect(session.id)}
              >
                <Flex justify="space-between" align="center" gap={8}>
                  <span className="session-item-title">
                    {session.streaming ? "● " : ""}
                    {session.title}
                  </span>
                  <span className="session-item-time">{formatRelative(session.updatedAt)}</span>
                </Flex>
              </button>
            );
          })
        )}
      </div>

      <div className="session-sidebar-footer">
        <Typography.Text strong>AirCode</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Agent 工作区
        </Typography.Text>
      </div>
    </aside>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
