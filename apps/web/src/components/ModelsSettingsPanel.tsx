import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Flex,
  Input,
  Select,
  Space,
  Switch,
  Typography,
  message,
} from "antd";
import type { ModelsSettingsDto, ModelSettingsDto, ProviderSettingsDto } from "@aircode/shared";
import { aircodeApi } from "../lib/api";

const { Title, Text } = Typography;

export function ModelsSettingsPanel() {
  const [data, setData] = useState<ModelsSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload(): Promise<void> {
    setLoading(true);
    setError(null);
    const result = await aircodeApi.getModelsSettings();
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setData(result.data);
  }

  useEffect(() => {
    void reload();
  }, []);

  const filteredModels = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.models;
    return data.models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.providerName.toLowerCase().includes(q) ||
        m.ref.toLowerCase().includes(q),
    );
  }, [data, query]);

  const defaultOptions = useMemo(() => {
    if (!data) return [];
    return data.models
      .filter((m) => m.enabled && m.available)
      .map((m) => ({
        value: m.ref,
        label: `${m.name} · ${m.providerName}`,
      }));
  }, [data]);

  async function applyUpdate(
    action: () => Promise<{ ok: true; data: ModelsSettingsDto } | { ok: false; error: string }>,
  ): Promise<void> {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      message.error(result.error);
      return;
    }
    setData(result.data);
  }

  async function onSaveKey(provider: ProviderSettingsDto): Promise<void> {
    const apiKey = (keyDrafts[provider.id] ?? "").trim();
    if (!apiKey) {
      message.warning("请输入 API Key");
      return;
    }
    setSavingProvider(provider.id);
    const result = await aircodeApi.setProviderApiKey(provider.id, { apiKey });
    setSavingProvider(null);
    if (!result.ok) {
      message.error(result.error);
      return;
    }
    setData(result.data);
    setKeyDrafts((prev) => ({ ...prev, [provider.id]: "" }));
    message.success(`${provider.name} API Key 已保存`);
  }

  async function onClearKey(provider: ProviderSettingsDto): Promise<void> {
    setSavingProvider(provider.id);
    const result = await aircodeApi.clearProviderApiKey(provider.id);
    setSavingProvider(null);
    if (!result.ok) {
      message.error(result.error);
      return;
    }
    setData(result.data);
    message.success(`已清除 ${provider.name} 存储的 API Key`);
  }

  if (loading && !data) {
    return <Text type="secondary">加载模型设置…</Text>;
  }

  if (error && !data) {
    return <Alert type="error" showIcon message={error} action={<Button onClick={() => void reload()}>重试</Button>} />;
  }

  if (!data) return null;

  return (
    <div className="settings-section">
      <Title level={3} className="settings-page-title">
        模型
      </Title>
      <Text type="secondary" className="settings-page-desc">
        配置提供商 API Key、默认模型，以及可在会话中使用的模型列表。
      </Text>

      <div className="settings-block">
        <div className="settings-block-title">默认模型</div>
        <div className="settings-row">
          <div className="settings-row-copy">
            <div className="settings-row-title">新建会话使用的模型</div>
            <div className="settings-row-desc">仅可选择已启用且已配置认证的模型</div>
          </div>
          <Select
            allowClear
            placeholder="使用 Pi 默认"
            style={{ minWidth: 280 }}
            value={data.defaultModelRef}
            options={defaultOptions}
            disabled={busy}
            onChange={(value) =>
              void applyUpdate(() => aircodeApi.setDefaultModel({ modelRef: value ?? null }))
            }
          />
        </div>
      </div>

      <div className="settings-block">
        <div className="settings-block-title">API Keys</div>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {data.providers.map((provider) => (
            <div key={provider.id} className="settings-row settings-row-stack">
              <div className="settings-row-copy">
                <div className="settings-row-title">{provider.name}</div>
                <div className="settings-row-desc">
                  {provider.configured
                    ? `已配置${provider.authLabel ? ` · ${provider.authLabel}` : ""}`
                    : "未配置"}
                  {provider.hasStoredKey ? " · 已存储 Key" : ""}
                </div>
              </div>
              <Flex gap={8} wrap align="center" className="settings-row-controls">
                <Input.Password
                  placeholder={provider.hasStoredKey ? "输入新 Key 以覆盖" : "sk-…"}
                  value={keyDrafts[provider.id] ?? ""}
                  onChange={(e) =>
                    setKeyDrafts((prev) => ({ ...prev, [provider.id]: e.target.value }))
                  }
                  style={{ minWidth: 220, flex: 1 }}
                />
                <Button
                  type="primary"
                  loading={savingProvider === provider.id}
                  onClick={() => void onSaveKey(provider)}
                >
                  保存
                </Button>
                <Button
                  disabled={!provider.hasStoredKey || savingProvider === provider.id}
                  onClick={() => void onClearKey(provider)}
                >
                  清除
                </Button>
              </Flex>
            </div>
          ))}
        </Space>
      </div>

      <div className="settings-block">
        <Flex justify="space-between" align="center" gap={12} style={{ marginBottom: 12 }}>
          <div className="settings-block-title" style={{ margin: 0 }}>
            模型列表
          </div>
          <Input.Search
            allowClear
            placeholder="搜索模型"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ maxWidth: 260 }}
          />
        </Flex>
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {filteredModels.length === 0 ? (
            <Text type="secondary">没有匹配的模型</Text>
          ) : (
            filteredModels.map((model) => (
              <ModelRow
                key={model.ref}
                model={model}
                disabled={busy}
                onToggle={(enabled) =>
                  void applyUpdate(() =>
                    aircodeApi.setModelEnabled({ modelRef: model.ref, enabled }),
                  )
                }
              />
            ))
          )}
        </Space>
      </div>
    </div>
  );
}

function ModelRow({
  model,
  disabled,
  onToggle,
}: {
  model: ModelSettingsDto;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <div className="settings-row-title">{model.name}</div>
        <div className="settings-row-desc">
          {model.providerName}
          {model.available ? "" : " · 需配置 API Key"}
          {model.reasoning ? " · Reasoning" : ""}
          {` · ${Math.round(model.contextWindow / 1000)}k ctx`}
        </div>
      </div>
      <Switch checked={model.enabled} disabled={disabled} onChange={onToggle} />
    </div>
  );
}
