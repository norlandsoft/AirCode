import { useCallback, useEffect, useState } from 'react';
import { Button, message } from '@air/design';
import type { BrowseResultDto, ProjectInfoDto } from '@aircode/shared';
import { api } from '../lib/api';

interface Props {
  onSelected: (project: ProjectInfoDto) => void;
}

export function ProjectPicker({ onSelected }: Props) {
  const [info, setInfo] = useState<ProjectInfoDto | null>(null);
  const [browse, setBrowse] = useState<BrowseResultDto | null>(null);
  const [pathInput, setPathInput] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const project = await api.getProject();
      setInfo(project);
      setPathInput(project.cwd ?? '');
      const start = project.cwd ?? undefined;
      setBrowse(await api.browseProject(start));
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPath(path: string) {
    setBusy(true);
    try {
      const project = await api.setProject(path);
      setInfo(project);
      message.success(`已打开项目：${project.cwd}`);
      onSelected(project);
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function goBrowse(path?: string | null) {
    if (path === null) return;
    try {
      setBrowse(await api.browseProject(path));
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="ac-project-picker">
      <div className="ac-project-hero">
        <h1>选择项目</h1>
        <p>智能体工作目录 = 项目目录。模型与 API Key 在「设置」中配置（SQLite）。</p>
      </div>

      {info?.recent?.length ? (
        <div className="ac-project-recent">
          <div className="ac-panel-subhead">最近打开</div>
          <ul>
            {info.recent.map((p) => (
              <li key={p}>
                <button type="button" disabled={busy} onClick={() => void openPath(p)}>
                  {p}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="ac-project-path-row">
        <input
          className="ac-input"
          placeholder="绝对路径，如 /opt/MyApp 或 ~/code/app"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pathInput.trim()) void openPath(pathInput.trim());
          }}
        />
        <Button
          type="primary"
          disabled={busy || !pathInput.trim()}
          onClick={() => void openPath(pathInput.trim())}
        >
          打开
        </Button>
      </div>

      <div className="ac-project-browse">
        <div className="ac-panel-head">
          <span>{browse?.path ?? '…'}</span>
          <div className="ac-panel-actions">
            <Button
              size="sm"
              disabled={!browse?.parent}
              onClick={() => void goBrowse(browse?.parent)}
            >
              上级
            </Button>
            <Button
              size="sm"
              type="primary"
              disabled={busy || !browse?.path}
              onClick={() => browse?.path && void openPath(browse.path)}
            >
              选择当前目录
            </Button>
          </div>
        </div>
        <ul className="ac-project-dir-list">
          {(browse?.entries ?? []).map((e) => (
            <li key={e.path}>
              <button type="button" onClick={() => void goBrowse(e.path)}>
                {e.name}/
              </button>
            </li>
          ))}
          {(browse?.entries ?? []).length === 0 ? (
            <li className="ac-muted-block">无子目录</li>
          ) : null}
        </ul>
      </div>

      <p className="ac-muted-block">
        Claude Home：{info?.claudeHome ?? '…'} · 设置库：{info?.dbPath ?? '…'}
      </p>
    </div>
  );
}
