import { useEffect, useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';

interface Props {
  path: string;
  language: string;
  original: string;
  modified: string;
  subtitle?: string;
}

export function GitDiffPane({ path, language, original, modified, subtitle }: Props) {
  const [rootPx, setRootPx] = useState(16);

  useEffect(() => {
    const read = () =>
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    setRootPx(read());
  }, []);

  return (
    <div className="ac-git-diff-pane">
      <div className="ac-git-diff-head">
        <span className="ac-git-diff-path" title={path}>
          {path}
        </span>
        {subtitle ? <span className="ac-git-diff-sub">{subtitle}</span> : null}
      </div>
      <div className="ac-git-diff-body">
        <DiffEditor
          key={`${path}|${subtitle ?? ''}|${original.length}|${modified.length}`}
          original={original}
          modified={modified}
          language={language || 'plaintext'}
          theme="light"
          width="100%"
          height="100%"
          loading={<div className="ac-muted-block">加载 Diff…</div>}
          options={{
            readOnly: true,
            renderSideBySide: false,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            fontSize: Math.round((13 / 16) * rootPx),
            lineHeight: Math.round((20 / 16) * rootPx),
            fontFamily: 'var(--ac-mono), ui-monospace, monospace',
            renderIndicators: true,
            originalEditable: false,
            folding: false,
            wordWrap: 'off',
            unicodeHighlight: { ambiguousCharacters: false },
          }}
        />
      </div>
    </div>
  );
}
