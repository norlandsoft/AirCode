import { Icon } from '@air/design';
import type { FileTreeNodeDto } from '@aircode/shared';

interface Props {
  tree: FileTreeNodeDto[];
  activePath?: string;
  onOpen: (path: string) => void;
}

function Node({
  node,
  depth,
  activePath,
  onOpen,
}: {
  node: FileTreeNodeDto;
  depth: number;
  activePath?: string;
  onOpen: (path: string) => void;
}) {
  const pad = 8 + depth * 12;
  if (node.type === 'directory') {
    return (
      <div className="ac-tree-dir">
        <div className="ac-tree-row dir" style={{ paddingLeft: pad }}>
          <Icon name="folder" size={14} />
          <span>{node.name}</span>
        </div>
        {(node.children ?? []).map((child) => (
          <Node
            key={child.path}
            node={child}
            depth={depth + 1}
            activePath={activePath}
            onOpen={onOpen}
          />
        ))}
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
      <Icon name="file" size={14} />
      <span>{node.name}</span>
    </button>
  );
}

export function FileTree({ tree, activePath, onOpen }: Props) {
  return (
    <div className="ac-filetree">
      <div className="ac-filetree-head">资源管理器</div>
      <div className="ac-filetree-body">
        {tree.map((n) => (
          <Node key={n.path} node={n} depth={0} activePath={activePath} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
