import { useEffect, useRef, useState } from 'react';
import { Button, CodeEditor, message } from '@air/design';
import { api } from '../lib/api';

interface Props {
  path: string;
  content: string;
  language?: string;
  onClose: () => void;
  onSaved: (path: string, content: string) => void;
}

export function EditorPane({ path, content, language, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState(content);
  const [saving, setSaving] = useState(false);
  const dirty = draft !== content;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    setDraft(content);
  }, [path, content]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const file = await api.writeFile(path, draftRef.current);
      onSaved(file.path, file.content);
      message.success('已保存');
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ac-editor-pane">
      <div className="ac-editor-tab">
        <span className="ac-editor-path">
          {path}
          {dirty ? <span className="ac-dirty"> ●</span> : null}
        </span>
        <div className="ac-editor-actions">
          <Button size="sm" type="primary" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? '保存中…' : '保存'}
          </Button>
          <button type="button" className="ac-icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
      </div>
      <div className="ac-editor-body">
        <CodeEditor
          language={language || 'plaintext'}
          content={draft}
          onChange={(v: string) => setDraft(v)}
          width="100%"
          height="100%"
          readOnly={false}
          border={false}
        />
      </div>
    </div>
  );
}
