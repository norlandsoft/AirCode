import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  ChatInput,
  ChatView,
  Icon,
  Splitter,
  message,
  type ChatMessage,
} from '@air/design';
import type {
  AgentEventEnvelope,
  FileTreeNodeDto,
  SessionSummaryDto,
  WorkspaceDto,
} from '@aircode/shared';
import { api } from './lib/api';
import { SessionSidebar } from './components/SessionSidebar';
import { FileTree } from './components/FileTree';
import { EditorPane } from './components/EditorPane';
import { GitPanel } from './components/GitPanel';
import { JobsPanel } from './components/JobsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ProjectPicker } from './components/ProjectPicker';

/** 工作区主 Tab（手机额外含项目 / 设置） */
type WorkTab = 'chat' | 'git' | 'code' | 'cicd' | 'project' | 'settings';

/** 合并本地与服务端消息，避免 getSession 空快照覆盖已显示内容 */
function mergeChatMessages(local: ChatMessage[], remote: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of remote) byId.set(m.id, m);
  for (const m of local) {
    if (!byId.has(m.id)) byId.set(m.id, m);
  }
  const remoteIds = new Set(remote.map((m) => m.id));
  const merged = remote.map((m) => byId.get(m.id)!);
  for (const m of local) {
    if (!remoteIds.has(m.id)) merged.push(m);
  }
  return merged;
}

function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  useEffect(() => {
    const onResize = () => setPhone(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return phone;
}

export function App() {
  const isPhone = useIsPhone();
  const [workspace, setWorkspace] = useState<WorkspaceDto | null>(null);
  const [sessions, setSessions] = useState<SessionSummaryDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chatList, setChatList] = useState<ChatMessage[]>([]);
  const [lastContent, setLastContent] = useState('');
  const [loading, setLoading] = useState(false);
  const lastContentRef = useRef('');
  lastContentRef.current = lastContent;
  const loadingRef = useRef(false);
  loadingRef.current = loading;
  const [tree, setTree] = useState<FileTreeNodeDto[]>([]);
  const [openFile, setOpenFile] = useState<{
    path: string;
    content: string;
    language?: string;
  } | null>(null);
  const [workTab, setWorkTab] = useState<WorkTab>('chat');

  const viewRef = useRef<HTMLDivElement>(null);
  const [chatSize, setChatSize] = useState({ h: 480, w: 640 });

  const refreshSessions = useCallback(async () => {
    setSessions(await api.listSessions());
  }, []);

  const refreshTree = useCallback(async () => {
    setTree((await api.fileTree(8)).tree);
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const ws = await api.workspace();
      setWorkspace(ws);
      if (!ws.hasProject) {
        setWorkTab('project');
        setSessions([]);
        setTree([]);
        return;
      }
      const [list, files] = await Promise.all([api.listSessions(), api.fileTree(8)]);
      setSessions(list);
      setTree(files.tree);
      if (!ws.hasApiKey) {
        message.warning('未配置 Token，请打开设置填写');
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
  }, []);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setChatSize({ h: Math.round(cr.height), w: Math.round(cr.width) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeId, workTab]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;

    const hydrate = async () => {
      try {
        const detail = await api.getSession(activeId);
        if (cancelled) return;
        setChatList((prev) => mergeChatMessages(prev, detail.messages));
        if (detail.streaming) {
          setLastContent(detail.streamingContent || lastContentRef.current);
          setLoading(true);
        } else if (!loadingRef.current) {
          // 非流式且本地也未在生成：用服务端快照对齐，清空残留 lastContent
          setLastContent('');
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          message.error(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void hydrate();
    const unsub = api.subscribeSession(
      activeId,
      (envelope) => applyEvent(envelope),
      () => {
        // SSE 重连后拉齐快照，补回断线窗口内的 assistant_done
        void hydrate();
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [activeId]);

  /** 将仍停留在 lastContent 的流式正文写入 chatList，防止 loading=false 后气泡消失 */
  function commitLastContent() {
    const content = lastContentRef.current;
    if (!content.trim()) {
      setLastContent('');
      return;
    }
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setChatList((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant' && last.content === content) {
        return prev;
      }
      return [...prev, { id, role: 'assistant', content }];
    });
    setLastContent('');
  }

  function applyEvent(envelope: AgentEventEnvelope) {
    const { event } = envelope;
    switch (event.type) {
      case 'user_message':
        setChatList((prev) => {
          if (prev.some((m) => m.id === event.messageId)) return prev;
          return [...prev, { id: event.messageId, role: 'user', content: event.content }];
        });
        setLastContent('');
        break;
      case 'assistant_delta':
        setLastContent(event.content);
        setLoading(true);
        break;
      case 'assistant_done':
        setChatList((prev) => {
          if (prev.some((m) => m.id === event.messageId)) return prev;
          // 去掉可能已本地 commit 的同内容草稿
          const withoutDup = prev.filter(
            (m) => !(m.role === 'assistant' && m.content === event.content && m.id.startsWith('local-')),
          );
          return [...withoutDup, { id: event.messageId, role: 'assistant', content: event.content }];
        });
        setLastContent('');
        setLoading(false);
        void refreshSessions();
        void refreshTree();
        break;
      case 'status':
        if (!event.streaming) {
          commitLastContent();
        }
        setLoading(event.streaming);
        break;
      case 'error':
        message.error(event.message);
        // 流式中间错误（如 api_retry）：保留气泡与 loading；致命错误通常已先 assistant_done
        if (!lastContentRef.current) {
          setLoading(false);
        }
        break;
      case 'aborted':
        commitLastContent();
        setLoading(false);
        message.info('已停止生成，已保留已输出内容');
        void refreshSessions();
        break;
      case 'session_init':
        void refreshSessions();
        break;
      default:
        break;
    }
  }

  async function handleNewSession() {
    try {
      const s = await api.createSession();
      await refreshSessions();
      setActiveId(s.id);
      setChatList([]);
      setLastContent('');
      setLoading(false);
      setWorkTab('chat');
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      await api.deleteSession(id);
      if (activeId === id) {
        setActiveId(null);
        setChatList([]);
        setLastContent('');
      }
      await refreshSessions();
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSend(text: string) {
    try {
      let id = activeId;
      if (!id) {
        const s = await api.createSession();
        id = s.id;
        setActiveId(s.id);
        await refreshSessions();
      }
      await api.prompt(id, text);
      setLoading(true);
      setWorkTab('chat');
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  async function handleStop() {
    if (!activeId) return;
    try {
      await api.abort(activeId);
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleOpenFile(path: string) {
    try {
      const file = await api.fileContent(path);
      setOpenFile({ path: file.path, content: file.content, language: file.language });
      setWorkTab('code');
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }

  const cwdLabel = workspace?.cwd ?? '未选择项目';
  const projectName =
    workspace?.cwd?.split(/[/\\]/).filter(Boolean).pop() || cwdLabel;
  const needsProject = !workspace?.hasProject;
  const activeTab: WorkTab = needsProject && workTab !== 'settings' ? 'project' : workTab;

  const workTabs: { id: WorkTab; label: string }[] = isPhone
    ? [
        { id: 'chat', label: '对话' },
        { id: 'git', label: 'Git' },
        { id: 'code', label: '代码' },
        { id: 'cicd', label: 'CI/CD' },
        { id: 'project', label: '项目' },
        { id: 'settings', label: '设置' },
      ]
    : [
        { id: 'chat', label: '对话' },
        { id: 'git', label: 'Git' },
        { id: 'code', label: '代码' },
        { id: 'cicd', label: 'CI/CD' },
      ];

  const chatPane = (
    <div className="ac-chat-layout">
      {isPhone ? (
        <div className="ac-chat">
          <div className="ac-chat-mobile-sessions">
            <Button size="sm" type="primary" onClick={() => void handleNewSession()}>
              新会话
            </Button>
            <select
              className="ac-select"
              value={activeId ?? ''}
              onChange={(e) => setActiveId(e.target.value || null)}
            >
              <option value="">选择会话…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          {!activeId && chatList.length === 0 && !loading ? (
            <div className="ac-welcome">
              <h1>Claude Code</h1>
              <p>描述任务，Agent 将在当前项目目录中执行</p>
              <div className="ac-welcome-input">
                <ChatInput
                  className="air-chat-input-full"
                  onSend={handleSend}
                  finished
                  showAttachment={false}
                  placeholder="描述你想完成的任务…"
                />
              </div>
            </div>
          ) : (
            <>
              <div ref={viewRef} className="ac-chat-view">
                <ChatView
                  height={chatSize.h}
                  width={chatSize.w}
                  chatList={chatList}
                  lastContent={lastContent}
                  loading={loading}
                  assistantName="Claude"
                  contentPadding={12}
                />
              </div>
              <div className="ac-chat-input">
                <ChatInput
                  className="air-chat-input-full"
                  onSend={handleSend}
                  onStop={handleStop}
                  finished={!loading}
                  disabled={false}
                  showAttachment={false}
                  placeholder="继续对话…"
                />
              </div>
            </>
          )}
        </div>
      ) : (
        <Splitter layout="horizontal" style={{ height: '100%', width: '100%' }}>
          <Splitter.Panel defaultSize={260} min={200} max={400}>
            <SessionSidebar
              sessions={sessions}
              activeId={activeId}
              projectLabel={cwdLabel}
              onNew={() => void handleNewSession()}
              onSelect={(id) => setActiveId(id)}
              onDelete={(id) => void handleDeleteSession(id)}
            />
          </Splitter.Panel>
          <Splitter.Panel min={320}>
            <div className="ac-chat">
              {!activeId && chatList.length === 0 && !loading ? (
                <div className="ac-welcome">
                  <h1>Claude Code</h1>
                  <p>描述任务，Agent 将在当前项目目录中执行</p>
                  <div className="ac-welcome-input">
                    <ChatInput
                      className="air-chat-input-full"
                      onSend={handleSend}
                      finished
                      showAttachment={false}
                      placeholder="描述你想完成的任务…"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div ref={viewRef} className="ac-chat-view">
                    <ChatView
                      height={chatSize.h}
                      width={chatSize.w}
                      chatList={chatList}
                      lastContent={lastContent}
                      loading={loading}
                      assistantName="Claude"
                      contentPadding={12}
                    />
                  </div>
                  <div className="ac-chat-input">
                    <ChatInput
                      className="air-chat-input-full"
                      onSend={handleSend}
                      onStop={handleStop}
                      finished={!loading}
                      disabled={false}
                      showAttachment={false}
                      placeholder="继续对话…"
                    />
                  </div>
                </>
              )}
            </div>
          </Splitter.Panel>
        </Splitter>
      )}
    </div>
  );

  const codePane = (
    <div className="ac-code-layout">
      {isPhone ? (
        <>
          {!openFile ? (
            <FileTree
              key={workspace?.cwd ?? 'tree'}
              tree={tree}
              rootLabel={projectName}
              onOpen={(p) => void handleOpenFile(p)}
              onRefresh={() => void refreshTree()}
            />
          ) : (
            <EditorPane
              path={openFile.path}
              content={openFile.content}
              language={openFile.language}
              onClose={() => setOpenFile(null)}
              onSaved={(path, content) => {
                setOpenFile((prev) => (prev ? { ...prev, path, content } : prev));
                void refreshTree();
              }}
            />
          )}
        </>
      ) : (
        <Splitter layout="horizontal" style={{ height: '100%', width: '100%' }}>
          <Splitter.Panel defaultSize={260} min={180} max={420}>
            <FileTree
              key={workspace?.cwd ?? 'tree'}
              tree={tree}
              rootLabel={projectName}
              onOpen={(p) => void handleOpenFile(p)}
              activePath={openFile?.path}
              onRefresh={() => void refreshTree()}
            />
          </Splitter.Panel>
          <Splitter.Panel min={280}>
            {openFile ? (
              <EditorPane
                path={openFile.path}
                content={openFile.content}
                language={openFile.language}
                onClose={() => setOpenFile(null)}
                onSaved={(path, content) => {
                  setOpenFile((prev) => (prev ? { ...prev, path, content } : prev));
                  void refreshTree();
                }}
              />
            ) : (
              <div className="ac-editor-empty">
                <Icon name="code" size={28} color="currentColor" />
                <p>从左侧打开文件</p>
                <p className="ac-muted">支持 ⌘S / Ctrl+S 保存</p>
              </div>
            )}
          </Splitter.Panel>
        </Splitter>
      )}
    </div>
  );

  function renderWork() {
    switch (activeTab) {
      case 'chat':
        return chatPane;
      case 'git':
        return (
          <GitPanel
            key={workspace?.cwd ?? 'no-project'}
            projectCwd={workspace?.cwd ?? null}
            onOpenFile={(p) => void handleOpenFile(p)}
            onOpenChat={() => setWorkTab('chat')}
          />
        );
      case 'code':
        return codePane;
      case 'cicd':
        return <JobsPanel />;
      case 'project':
        return (
          <ProjectPicker
            onSelected={() => {
              void bootstrap().then(() => setWorkTab('chat'));
            }}
          />
        );
      case 'settings':
        return (
          <SettingsPanel
            onClose={isPhone ? undefined : () => setWorkTab('chat')}
            onSaved={() => {
              void api.workspace().then(setWorkspace);
            }}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className={`ac-root ${isPhone ? 'ac-phone' : 'ac-desktop'}`} data-theme="light">
      <header className="ac-topbar">
        <div className="ac-brand">
          <Icon name="workspace" size={18} color="currentColor" />
          <span className="ac-brand-text">AirCode</span>
        </div>

        <nav className="ac-work-tabs" aria-label="工作区">
          {workTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={activeTab === t.id ? 'active' : ''}
              onClick={() => setWorkTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="ac-topbar-spacer" />

        {!isPhone ? (
          <>
            <button
              type="button"
              className="ac-topbar-project"
              title={cwdLabel}
              onClick={() => setWorkTab('project')}
            >
              <Icon name="folder" size={14} color="currentColor" />
              <span>{cwdLabel}</span>
            </button>
            <div className="ac-topbar-actions">
              <span className={`ac-key-badge ${workspace?.hasApiKey ? 'ok' : 'warn'}`}>
                {workspace?.hasApiKey
                  ? workspace.defaultModel || '已配置'
                  : '无 Token'}
              </span>
              <button
                type="button"
                className={`ac-icon-btn ac-topbar-settings ${workTab === 'settings' ? 'active' : ''}`}
                aria-label="设置"
                title="设置"
                onClick={() => setWorkTab(workTab === 'settings' ? 'chat' : 'settings')}
              >
                <Icon name="settings" size={16} color="currentColor" />
              </button>
            </div>
          </>
        ) : (
          <div className="ac-topbar-actions">
            <span className={`ac-key-badge ${workspace?.hasApiKey ? 'ok' : 'warn'}`}>
              {workspace?.hasApiKey ? 'Token' : '无 Token'}
            </span>
          </div>
        )}
      </header>

      <main className="ac-work">{renderWork()}</main>
    </div>
  );
}
