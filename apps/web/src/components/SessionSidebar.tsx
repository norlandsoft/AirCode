import { Button, Icon } from '@air/design';
import type { SessionSummaryDto } from '@aircode/shared';

interface Props {
  sessions: SessionSummaryDto[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SessionSidebar({ sessions, activeId, onNew, onSelect, onDelete }: Props) {
  return (
    <aside className="ac-sidebar">
      <div className="ac-sidebar-head">
        <Button type="primary" block onClick={onNew}>
          <Icon name="plus" size={14} /> 新会话
        </Button>
      </div>
      <ul className="ac-session-list">
        {sessions.map((s) => (
          <li key={s.id} className={s.id === activeId ? 'active' : ''}>
            <button type="button" className="ac-session-item" onClick={() => onSelect(s.id)}>
              <span className="ac-session-title">{s.title}</span>
              {s.streaming ? <span className="ac-dot" /> : null}
            </button>
            <button
              type="button"
              className="ac-session-del"
              title="删除"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
            >
              ×
            </button>
          </li>
        ))}
        {sessions.length === 0 ? <li className="ac-empty">暂无会话</li> : null}
      </ul>
    </aside>
  );
}
