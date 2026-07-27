import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@air/design';
import type { FileTreeNodeDto } from '@aircode/shared';

interface Props {
  tree: FileTreeNodeDto[];
  rootLabel?: string;
  activePath?: string;
  onOpen: (path: string) => void;
  onRefresh?: () => void;
}

/** 展开文件路径的全部祖先目录 */
function ancestorsOf(filePath: string): string[] {
  const parts = filePath.split(/[/\\]/).filter(Boolean);
  const result: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    result.push(parts.slice(0, i).join('/'));
  }
  return result;
}

function Node({
  node,
  depth,
  activePath,
  expanded,
  onToggle,
  onOpen,
}: {
  node: FileTreeNodeDto;
  depth: number;
  activePath?: string;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onOpen: (path: string) => void;
}) {
  const pad = 8 + depth * 14;

  if (node.type === 'directory') {
    const open = expanded.has(node.path);
    const children = node.children ?? [];
    return (
      <div className="ac-tree-dir">
        <button
          type="button"
          className="ac-tree-row dir"
          style={{ paddingLeft: pad }}
          aria-expanded={open}
          onClick={() => onToggle(node.path)}
        >
          <span className="ac-tree-chevron" aria-hidden>
            <Icon name={open ? 'arrow_down' : 'arrow_right'} size={12} color="currentColor" />
          </span>
          <Icon name="folder" size={14} color="currentColor" className="ac-tree-icon" />
          <span className="ac-tree-name">{node.name}</span>
        </button>
        {open
          ? children.map((child) => (
              <Node
                key={child.path}
                node={child}
                depth={depth + 1}
                activePath={activePath}
                expanded={expanded}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            ))
          : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`ac-tree-row file ${activePath === node.path ? 'active' : ''}`}
      style={{ paddingLeft: pad }}
      onClick={() => onOpen(node.path)}
    >
      <span className="ac-tree-chevron ac-tree-chevron-spacer" aria-hidden />
      <Icon name="file" size={14} color="currentColor" className="ac-tree-icon" />
      <span className="ac-tree-name">{node.name}</span>
    </button>
  );
}

export function FileTree({ tree, rootLabel, activePath, onOpen, onRefresh }: Props) {
  const topDirs = useMemo(
    () => tree.filter((n) => n.type === 'directory').map((n) => n.path),
    [tree],
  );

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(topDirs));

  // 树异步到达或刷新后：若尚未展开任何节点，默认展开顶层
  useEffect(() => {
    setExpanded((prev) => (prev.size === 0 && topDirs.length > 0 ? new Set(topDirs) : prev));
  }, [topDirs]);

  // 打开文件时自动展开祖先目录
  useEffect(() => {
    if (!activePath) return;
    const ancestors = ancestorsOf(activePath);
    if (ancestors.length === 0) return;
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const p of ancestors) {
        if (!next.has(p)) {
          next.add(p);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activePath]);

  const onToggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const expandTop = useCallback(() => {
    setExpanded(new Set(topDirs));
  }, [topDirs]);

  const title = rootLabel || '资源管理器';

  return (
    <div className="ac-filetree">
      <div className="ac-filetree-head">
        <span className="ac-filetree-title" title={title}>
          {title}
        </span>
        <div className="ac-filetree-actions">
          <button
            type="button"
            className="ac-filetree-action"
            title="展开顶层"
            aria-label="展开顶层"
            onClick={expandTop}
          >
            <Icon name="toggle_open" size={14} color="currentColor" />
          </button>
          <button
            type="button"
            className="ac-filetree-action"
            title="全部折叠"
            aria-label="全部折叠"
            onClick={collapseAll}
          >
            <Icon name="toggle_close" size={14} color="currentColor" />
          </button>
          {onRefresh ? (
            <button
              type="button"
              className="ac-filetree-action"
              title="刷新"
              aria-label="刷新"
              onClick={onRefresh}
            >
              <Icon name="refresh" size={14} color="currentColor" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="ac-filetree-body">
        {tree.length === 0 ? (
          <div className="ac-filetree-empty">暂无文件</div>
        ) : (
          tree.map((n) => (
            <Node
              key={n.path}
              node={n}
              depth={0}
              activePath={activePath}
              expanded={expanded}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </div>
  );
}
