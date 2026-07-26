import { useCallback, useEffect, useState } from 'react';
import { Button, message } from '@air/design';
import type { AppSettingsDto } from '@aircode/shared';
import { api } from '../lib/api';

interface Props {
  onClose?: () => void;
  onSaved?: () => void;
}

export function SettingsPanel({ onClose, onSaved }: Props) {
  const [data, setData] = useState<AppSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providerId, setProviderId] = useState('anthropic');
  const [apiType, setApiType] = useState('anthropic-messages');
  const [baseUrl, setBaseUrl] = useState('');
  const [defaultModel, setDefaultModel] = useState('sonnet');
  const [customModel, setCustomModel] = useState('');
  const [apiKey, setApiKey] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await api.getSettings();
      setData(settings);
      setProviderId(settings.connection.providerId);
      setApiType(settings.connection.apiType);
      setBaseUrl(settings.connection.baseUrl);
      const model = settings.connection.defaultModel || 'sonnet';
      const known = settings.models.some((m) => m.id === model);
      if (known) {
        setDefaultModel(model);
        setCustomModel('');
      } else {
        setDefaultModel('__custom__');
        setCustomModel(model);
      }
      setApiKey('');
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function onProviderChange(id: string) {
    setProviderId(id);
    const provider = data?.providers.find((p) => p.id === id);
    if (provider?.defaultApiType) setApiType(provider.defaultApiType);
    if (provider?.defaultBaseUrl !== undefined) setBaseUrl(provider.defaultBaseUrl);
  }

  async function onSave() {
    const model =
      defaultModel === '__custom__' ? customModel.trim() : defaultModel.trim();
    if (!model) {
      message.error('请选择或填写默认模型');
      return;
    }
    setSaving(true);
    try {
      const next = await api.saveModelSettings({
        providerId,
        apiType,
        baseUrl,
        defaultModel: model,
        apiKey: apiKey.trim() || undefined,
      });
      setData(next);
      setApiKey('');
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
      setProviderId(next.connection.providerId);
      setApiType(next.connection.apiType);
      setBaseUrl(next.connection.baseUrl);
      setDefaultModel(next.connection.defaultModel);
      setCustomModel('');
      setApiKey('');
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
        <span>设置 · 模型</span>
        <div className="ac-panel-actions">
          {onClose ? (
            <Button size="sm" onClick={onClose}>
              关闭
            </Button>
          ) : null}
        </div>
      </div>

      <div className="ac-settings-body">
        <p className="ac-muted-block">
          模型与 API Key 保存在 SQLite
          {data?.dbPath ? `（${data.dbPath}）` : ''}；Claude Home：
          {data?.claudeHome ?? '…'}。项目工作目录请在「项目」中选择。.env 仅配置端口与
          CLAUDE_HOME。
        </p>

        <label className="ac-field">
          <span>供应商</span>
          <select
            className="ac-select"
            value={providerId}
            onChange={(e) => onProviderChange(e.target.value)}
          >
            {(data?.providers ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="ac-field">
          <span>接口类型</span>
          <select
            className="ac-select"
            value={apiType}
            onChange={(e) => setApiType(e.target.value)}
          >
            {(data?.apiTypes ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="ac-field">
          <span>Base URL</span>
          <input
            className="ac-input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.anthropic.com"
          />
        </label>

        <label className="ac-field">
          <span>API Key {data?.connection.hasApiKey ? '（已保存，留空则不变）' : ''}</span>
          <input
            className="ac-input"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={data?.connection.hasApiKey ? '••••••••' : 'sk-…'}
          />
        </label>

        <label className="ac-field">
          <span>默认模型</span>
          <select
            className="ac-select"
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
          >
            {(data?.models ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value="__custom__">自定义…</option>
          </select>
        </label>

        {defaultModel === '__custom__' ? (
          <label className="ac-field">
            <span>自定义模型 ID</span>
            <input
              className="ac-input"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="claude-…"
            />
          </label>
        ) : null}

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
    </div>
  );
}
