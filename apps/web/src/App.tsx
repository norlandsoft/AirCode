import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  ChatInput,
  ChatView,
  CodeEditor,
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

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceDto | null>(null);
  const [sessions, setSessions] = useState<SessionSummaryDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chatList, setChatList] = useState<ChatMessage[]>([]);
  const [lastContent, setLastContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [tree, setTree] = useState<FileTreeNodeDto[]>([]);
  const [openFile, setOpenFile] = useState<{ path: string; content: string; language?: string } | null>(
    null,
  );
  const [showFiles, setShowFiles] = useState(true);

  const viewRef = useRef<HTMLDivElement>(null);
  const [chatSize, setChatSize] = useState({ h: 480, w: 640 });

  const refreshSessions = useCallback(async () => {
    const list = await api.listSessions();
    setSessions(list);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [ws, list, files] = await Promise.all([
          api.workspace(),
          api.listSessions(),
          api.fileTree(),
        ]);
        setWorkspace(ws);
        setSessions(list);
        setTree(files.tree);
        if (!ws.hasApiKey) {
          message.warning('未检测到 ANTHROPIC_API_KEY，请在项目根目录配置 .env');
        }
      } catch (err) {
        message.error(err instanceof Error ? err.message : String(err));
      }
    })();
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
  }, [activeId]);

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
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSelectSession(id: string) {
    setActiveId(id);
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
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }

  const cwdLabel = workspace?.cwd ?? '…';

  return (
    <div className="ac-root">
      <header className="ac-topbar">
        <div className="ac-brand">
          <Icon name="code" size={18} />
          <span className="ac-brand-text">AirCode</span>
        </div>
        <div className="ac-topbar-path" title={cwdLabel}>
          {cwdLabel}
        </div>
        <div className="ac-topbar-actions">
          <Button
            size="sm"
            type={showFiles ? 'primary' : 'default'}
            onClick={() => setShowFiles((v) => !v)}
          >
            文件
          </Button>
          <span className={`ac-key-badge ${workspace?.hasApiKey ? 'ok' : 'warn'}`}>
            {workspace?.hasApiKey ? 'API Key' : '无 Key'}
          </span>
        </div>
      </header>

      <div className="ac-body">
        <SessionSidebar
          sessions={sessions}
          activeId={activeId}
          onNew={handleNewSession}
          onSelect={handleSelectSession}
          onDelete={handleDeleteSession}
        />

        <div className="ac-main">
          <Splitter layout="horizontal" style={{ height: '100%', width: '100%' }}>
            {showFiles ? (
              <Splitter.Panel defaultSize={220} min={160} max={360}>
                <FileTree tree={tree} onOpen={handleOpenFile} activePath={openFile?.path} />
              </Splitter.Panel>
            ) : null}

            <Splitter.Panel min={280}>
              {openFile ? (
                <div className="ac-editor-pane">
                  <div className="ac-editor-tab">
                    <span>{openFile.path}</span>
                    <button type="button" className="ac-icon-btn" onClick={() => setOpenFile(null)}>
                      ×
                    </button>
                  </div>
                  <div className="ac-editor-body">
                    <CodeEditor
                      language={openFile.language || 'plaintext'}
                      content={openFile.content}
                      width="100%"
                      height="100%"
                      readOnly
                      border={false}
                    />
                  </div>
                </div>
              ) : (
                <div className="ac-editor-empty">
                  <p>从左侧打开文件预览</p>
                  <p className="ac-muted">Agent 可直接读写工作区文件</p>
                </div>
              )}
            </Splitter.Panel>

            <Splitter.Panel defaultSize={420} min={320}>
              <div className="ac-chat">
                {!activeId && chatList.length === 0 && !loading ? (
                  <div className="ac-welcome">
                    <h1>AirCode</h1>
                    <p>基于 Claude Code SDK 的编程助手 · 无需登录</p>
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
            </Splitter.Panel>
          </Splitter>
        </div>
      </div>
    </div>
  );
}
