import { useMemo, useState } from 'react';
import { Icon } from '@air/design';
import type { SessionSummaryDto } from '@aircode/shared';

interface Props {
  sessions: SessionSummaryDto[];
  activeId: string | null;
  projectLabel?: string;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

/** 相对时间：1m / 2h / 3d */
function formatRelativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

function projectInitial(label: string): string {
  const name = label.split(/[/\\]/).filter(Boolean).pop() || 'A';
  return name.slice(0, 1).toUpperCase();
}

export function SessionSidebar({
  sessions,
  activeId,
  projectLabel = '本地项目',
  onNew,
  onSelect,
  onDelete,
}: Props) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  const shortLabel = projectLabel.split(/[/\\]/).filter(Boolean).pop() || projectLabel;

  return (
    <aside className="ac-sidebar">
      <nav className="ac-sidebar-nav" aria-label="会话操作">
        <button type="button" className="ac-sidebar-nav-item" onClick={onNew}>
          <Icon name="add" size={16} color="currentColor" />
          <span>新建会话</span>
        </button>
        <button
          type="button"
          className={`ac-sidebar-nav-item ${searchOpen ? 'active' : ''}`}
          onClick={() => setSearchOpen((v) => !v)}
        >
          <Icon name="search" size={16} color="currentColor" />
          <span>搜索</span>
        </button>
      </nav>

      {searchOpen ? (
        <div className="ac-sidebar-search">
          <Icon name="search" size={14} color="currentColor" />
          <input
            className="ac-sidebar-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索会话…"
            autoFocus
          />
          {query ? (
            <button
              type="button"
              className="ac-sidebar-search-clear"
              aria-label="清除"
              onClick={() => setQuery('')}
            >
              <Icon name="close" size={12} color="currentColor" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="ac-sidebar-section">
        <div className="ac-sidebar-section-head">
          <span className="ac-sidebar-section-title">会话</span>
        </div>

        <ul className="ac-session-list">
          {filtered.map((s) => (
            <li key={s.id} className={s.id === activeId ? 'active' : ''}>
              <button type="button" className="ac-session-item" onClick={() => onSelect(s.id)}>
                <Icon name="chat" size={15} color="currentColor" className="ac-session-icon" />
                <span className="ac-session-title">{s.title}</span>
                {s.streaming ? <span className="ac-dot" /> : null}
                <span className="ac-session-time">{formatRelativeTime(s.updatedAt)}</span>
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
                <Icon name="close" size={12} color="currentColor" />
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="ac-empty">{sessions.length === 0 ? '暂无会话' : '无匹配会话'}</li>
          ) : null}
        </ul>
      </div>

      <div className="ac-sidebar-footer">
        <div className="ac-sidebar-avatar" aria-hidden>
          {projectInitial(shortLabel)}
        </div>
        <div className="ac-sidebar-user">
          <div className="ac-sidebar-user-name" title={projectLabel}>
            {shortLabel}
          </div>
          <div className="ac-sidebar-user-plan">本地项目</div>
        </div>
      </div>
    </aside>
  );
}
