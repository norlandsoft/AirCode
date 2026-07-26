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
        <button type="button" className="ac-sidebar-new-link" onClick={onNew}>
          新建会话
        </button>
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
              aria-label="删除会话"
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
