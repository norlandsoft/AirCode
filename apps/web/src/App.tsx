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

type NavTab = 'sessions' | 'files' | 'editor' | 'chat' | 'git' | 'jobs' | 'settings' | 'project';
type LayoutMode = 'phone' | 'pad' | 'desktop';

function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    if (w < 768) return 'phone';
    if (w < 1024) return 'pad';
    return 'desktop';
  });

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w < 768) setMode('phone');
      else if (w < 1024) setMode('pad');
      else setMode('desktop');
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return mode;
}

export function App() {
  const layout = useLayoutMode();
  const [workspace, setWorkspace] = useState<WorkspaceDto | null>(null);
  const [sessions, setSessions] = useState<SessionSummaryDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chatList, setChatList] = useState<ChatMessage[]>([]);
  const [lastContent, setLastContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [tree, setTree] = useState<FileTreeNodeDto[]>([]);
  const [openFile, setOpenFile] = useState<{
    path: string;
    content: string;
    language?: string;
  } | null>(null);
  const [nav, setNav] = useState<NavTab>('chat');
  const [leftTab, setLeftTab] = useState<'files' | 'git'>('files');

  const viewRef = useRef<HTMLDivElement>(null);
  const [chatSize, setChatSize] = useState({ h: 480, w: 640 });

  const refreshSessions = useCallback(async () => {
    const list = await api.listSessions();
    setSessions(list);
  }, []);

  const refreshTree = useCallback(async () => {
    const files = await api.fileTree(4);
    setTree(files.tree);
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const ws = await api.workspace();
      setWorkspace(ws);
      if (!ws.hasProject) {
        setNav('project');
        setSessions([]);
        setTree([]);
        return;
      }
      const [list, files] = await Promise.all([api.listSessions(), api.fileTree(4)]);
      setSessions(list);
      setTree(files.tree);
      if (!ws.hasApiKey) {
        message.warning('未配置 API Key，请打开「设置」填写');
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setChatSize({ h: Math.round(cr.height), w: Math.round(cr.width) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeId, nav, layout]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    void (async () => {
      try {
        const detail = await api.getSession(activeId);
        if (cancelled) return;
        setChatList(detail.messages);
        setLastContent(detail.streamingContent);
        setLoading(detail.streaming);
      } catch (err) {
        message.error(err instanceof Error ? err.message : String(err));
      }
    })();

    const unsub = api.subscribeSession(activeId, (envelope) => {
      applyEvent(envelope);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [activeId]);

  function applyEvent(envelope: AgentEventEnvelope) {
    const { event } = envelope;
    switch (event.type) {
      case 'user_message':
        setChatList((prev) => [
          ...prev,
          { id: event.messageId, role: 'user', content: event.content },
        ]);
        setLastContent('');
        break;
      case 'assistant_delta':
        setLastContent(event.content);
        setLoading(true);
        break;
      case 'assistant_done':
        setChatList((prev) => [
          ...prev,
          { id: event.messageId, role: 'assistant', content: event.content },
        ]);
        setLastContent('');
        setLoading(false);
        void refreshSessions();
        void refreshTree();
        break;
      case 'status':
        setLoading(event.streaming);
        break;
      case 'error':
        message.error(event.message);
        setLoading(false);
        break;
      case 'aborted':
        setLoading(false);
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
      setNav('chat');
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
      setNav('chat');
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
      setNav('editor');
      if (layout !== 'phone') setLeftTab('files');
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }

  const cwdLabel = workspace?.cwd ?? '未选择项目';
  const needsProject = !workspace?.hasProject;

  const chatPane = (
    <div className="ac-chat">
      {!activeId && chatList.length === 0 && !loading ? (
        <div className="ac-welcome">
          <h1>AirCode</h1>
          <p>远程开发 · Claude Code · Git · CI/CD</p>
          <ChatInput
            className="air-chat-input-full"
            onSend={handleSend}
            finished
            showAttachment={false}
            placeholder="描述你想完成的任务…"
          />
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
  );

  const editorPane = openFile ? (
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
      <p>从文件树打开文件进行编辑</p>
      <p className="ac-muted">支持 ⌘S / Ctrl+S 保存 · Agent 也可直接改文件</p>
      <Button size="sm" onClick={() => setNav(layout === 'phone' ? 'files' : 'chat')}>
        打开文件树
      </Button>
    </div>
  );

  const filesPane = (
    <div className="ac-left-stack">
      {layout === 'desktop' ? (
        <div className="ac-left-tabs">
          <button
            type="button"
            className={leftTab === 'files' ? 'active' : ''}
            onClick={() => setLeftTab('files')}
          >
            文件
          </button>
          <button
            type="button"
            className={leftTab === 'git' ? 'active' : ''}
            onClick={() => setLeftTab('git')}
          >
            Git
          </button>
        </div>
      ) : null}
      {layout === 'desktop' && leftTab === 'git' ? (
        <GitPanel onOpenFile={(p) => void handleOpenFile(p)} />
      ) : (
        <FileTree
          tree={tree}
          onOpen={(p) => void handleOpenFile(p)}
          activePath={openFile?.path}
          onRefresh={() => void refreshTree()}
        />
      )}
    </div>
  );

  function renderDesktop() {
    if (nav === 'project' || needsProject) {
      return (
        <div className="ac-body">
          <div className="ac-main ac-settings-full">
            <ProjectPicker
              onSelected={() => {
                void bootstrap().then(() => setNav('chat'));
              }}
            />
          </div>
        </div>
      );
    }
    if (nav === 'settings') {
      return (
        <div className="ac-body">
          <div className="ac-main ac-settings-full">
            <SettingsPanel
              onClose={() => setNav('chat')}
              onSaved={() => {
                void api.workspace().then(setWorkspace);
              }}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="ac-body">
        <SessionSidebar
          sessions={sessions}
          activeId={activeId}
          onNew={() => void handleNewSession()}
          onSelect={(id) => {
            setActiveId(id);
            setNav('chat');
          }}
          onDelete={(id) => void handleDeleteSession(id)}
        />
        <div className="ac-main">
          <Splitter layout="horizontal" style={{ height: '100%', width: '100%' }}>
            <Splitter.Panel defaultSize={240} min={180} max={400}>
              {filesPane}
            </Splitter.Panel>
            <Splitter.Panel min={240}>
              {nav === 'jobs' ? <JobsPanel /> : editorPane}
            </Splitter.Panel>
            <Splitter.Panel defaultSize={420} min={300}>
              {chatPane}
            </Splitter.Panel>
          </Splitter>
        </div>
      </div>
    );
  }

  function renderPad() {
    if (nav === 'project' || needsProject) {
      return (
        <div className="ac-body ac-body-pad">
          <div className="ac-main">
            <ProjectPicker
              onSelected={() => {
                void bootstrap().then(() => setNav('chat'));
              }}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="ac-body ac-body-pad">
        <div className="ac-main">
          {nav === 'sessions' ? (
            <SessionSidebar
              sessions={sessions}
              activeId={activeId}
              onNew={() => void handleNewSession()}
              onSelect={(id) => {
                setActiveId(id);
                setNav('chat');
              }}
              onDelete={(id) => void handleDeleteSession(id)}
            />
          ) : null}
          {nav === 'files' || nav === 'git' ? (
            nav === 'git' ? (
              <GitPanel onOpenFile={(p) => void handleOpenFile(p)} />
            ) : (
              <FileTree
                tree={tree}
                onOpen={(p) => void handleOpenFile(p)}
                activePath={openFile?.path}
                onRefresh={() => void refreshTree()}
              />
            )
          ) : null}
          {nav === 'editor' ? editorPane : null}
          {nav === 'chat' ? chatPane : null}
          {nav === 'jobs' ? <JobsPanel /> : null}
          {nav === 'settings' ? (
            <SettingsPanel
              onClose={() => setNav('chat')}
              onSaved={() => {
                void api.workspace().then(setWorkspace);
              }}
            />
          ) : null}
        </div>
      </div>
    );
  }

  function renderPhone() {
    return renderPad();
  }

  const tabs: { id: NavTab; label: string }[] = [
    { id: 'project', label: '项目' },
    { id: 'sessions', label: '会话' },
    { id: 'files', label: '文件' },
    { id: 'editor', label: '编辑' },
    { id: 'chat', label: '对话' },
    { id: 'git', label: 'Git' },
    { id: 'jobs', label: '任务' },
    { id: 'settings', label: '设置' },
  ];

  return (
    <div className={`ac-root ac-layout-${layout}`}>
      <header className="ac-topbar">
        <div className="ac-brand">
          <Icon name="code" size={18} />
          <span className="ac-brand-text">AirCode</span>
        </div>
        <div className="ac-topbar-path" title={cwdLabel}>
          {cwdLabel}
        </div>
        <div className="ac-topbar-actions">
          {layout === 'desktop' ? (
            <>
              <Button
                size="sm"
                type={nav === 'jobs' ? 'primary' : 'default'}
                onClick={() => setNav(nav === 'jobs' ? 'editor' : 'jobs')}
              >
                任务
              </Button>
              <Button
                size="sm"
                type={leftTab === 'git' ? 'primary' : 'default'}
                onClick={() => setLeftTab(leftTab === 'git' ? 'files' : 'git')}
              >
                Git
              </Button>
              <Button
                size="sm"
                type={nav === 'project' ? 'primary' : 'default'}
                onClick={() => setNav('project')}
              >
                项目
              </Button>
              <Button
                size="sm"
                type={nav === 'settings' ? 'primary' : 'default'}
                onClick={() => setNav(nav === 'settings' ? 'chat' : 'settings')}
              >
                设置
              </Button>
            </>
          ) : null}
          <span className={`ac-key-badge ${workspace?.hasApiKey ? 'ok' : 'warn'}`}>
            {workspace?.hasApiKey
              ? `Key · ${workspace.defaultModel ?? 'model'}`
              : '无 Key'}
          </span>
        </div>
      </header>

      {layout !== 'desktop' ? (
        <nav className="ac-mobile-nav">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={nav === t.id ? 'active' : ''}
              onClick={() => setNav(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      ) : null}

      {layout === 'desktop' ? renderDesktop() : layout === 'pad' ? renderPad() : renderPhone()}
    </div>
  );
}
