import { useCallback, useEffect, useState } from 'react';
import { Button, message } from '@air/design';
import type { AppSettingsDto } from '@aircode/shared';
import { api } from '../lib/api';

interface Props {
  onClose?: () => void;
  onSaved?: () => void;
}

/** 设置子 Tab；后续可扩展其它配置页 */
type SettingsSubTab = 'model';

const SUB_TABS: { id: SettingsSubTab; label: string }[] = [
  { id: 'model', label: '模型' },
];

export function SettingsPanel({ onClose, onSaved }: Props) {
  const [data, setData] = useState<AppSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subTab, setSubTab] = useState<SettingsSubTab>('model');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [token, setToken] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await api.getSettings();
      setData(settings);
      setBaseUrl(settings.connection.baseUrl);
      setModel(settings.connection.model);
      setToken('');
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSave() {
    if (!model.trim()) {
      message.error('请填写模型 ID');
      return;
    }
    setSaving(true);
    try {
      const next = await api.saveModelSettings({
        baseUrl,
        model: model.trim(),
        token: token.trim() || undefined,
      });
      setData(next);
      setToken('');
      message.success('模型设置已保存');
      onSaved?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onClear() {
    setSaving(true);
    try {
      const next = await api.clearModelSettings();
      setData(next);
      setBaseUrl(next.connection.baseUrl);
      setModel(next.connection.model);
      setToken('');
      message.success('已重置模型设置');
      onSaved?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="ac-panel">
        <div className="ac-panel-head">
          <span>设置</span>
        </div>
        <p className="ac-muted-block">加载中…</p>
      </div>
    );
  }

  return (
    <div className="ac-panel ac-settings-panel">
      <div className="ac-panel-head">
        <span>设置</span>
        <div className="ac-panel-actions">
          {onClose ? (
            <Button size="sm" onClick={onClose}>
              关闭
            </Button>
          ) : null}
        </div>
      </div>

      <nav className="ac-settings-subtabs" aria-label="设置分类">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={subTab === t.id ? 'active' : ''}
            onClick={() => setSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {subTab === 'model' ? (
        <div className="ac-settings-body">
          <p className="ac-muted-block">
            填写 Base URL、Token、模型 ID 即可对接任意兼容服务，不绑定固定供应商。保存在
            SQLite
            {data?.dbPath ? `（${data.dbPath}）` : ''}。
          </p>

          <label className="ac-field">
            <span>Base URL</span>
            <input
              className="ac-input"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.anthropic.com 或兼容网关地址"
              autoComplete="off"
            />
          </label>

          <label className="ac-field">
            <span>Token {data?.connection.hasToken ? '（已保存，留空则不变）' : ''}</span>
            <input
              className="ac-input"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={data?.connection.hasToken ? '••••••••' : 'API Token / Key'}
            />
          </label>

          <label className="ac-field">
            <span>Model</span>
            <input
              className="ac-input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="如 sonnet、claude-sonnet-4-… 或网关模型名"
              autoComplete="off"
            />
          </label>

          <div className="ac-settings-actions">
            <Button type="primary" disabled={saving} onClick={() => void onSave()}>
              {saving ? '保存中…' : '保存'}
            </Button>
            <Button disabled={saving} onClick={() => void onClear()}>
              重置
            </Button>
            <Button disabled={saving} onClick={() => void reload()}>
              刷新
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
