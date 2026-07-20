import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Form,
  Input,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import type { ModelsSettingsDto } from "@aircode/shared";
import { aircodeApi } from "../lib/api";

const { Title, Text } = Typography;

interface ConnectionFormValues {
  providerId: string;
  apiType: string;
  baseUrl: string;
  token?: string;
}

export function ModelsSettingsPanel() {
  const [form] = Form.useForm<ConnectionFormValues>();
  const [data, setData] = useState<ModelsSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

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
    syncForm(result.data);
  }

  function syncForm(settings: ModelsSettingsDto): void {
    const connection = settings.connection;
    if (connection) {
      form.setFieldsValue({
        providerId: connection.providerId,
        apiType: connection.apiType,
        baseUrl: connection.baseUrl,
        token: "",
      });
      return;
    }

    const first = settings.providers[0];
    form.setFieldsValue({
      providerId: first?.id,
      apiType: first?.defaultApiType ?? settings.apiTypes[0]?.id,
      baseUrl: first?.defaultBaseUrl ?? "",
      token: "",
    });
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, []);

  function onProviderChange(providerId: string): void {
    const provider = data?.providers.find((p) => p.id === providerId);
    form.setFieldsValue({
      providerId,
      apiType: provider?.defaultApiType ?? form.getFieldValue("apiType"),
      baseUrl: provider?.defaultBaseUrl ?? "",
    });
  }

  async function onSave(values: ConnectionFormValues): Promise<void> {
    setSaving(true);
    const result = await aircodeApi.saveModelConnection({
      providerId: values.providerId,
      apiType: values.apiType,
      baseUrl: values.baseUrl ?? "",
      token: values.token?.trim() ? values.token : undefined,
    });
    setSaving(false);
    if (!result.ok) {
      message.error(result.error);
      return;
    }
    setData(result.data);
    syncForm(result.data);
    message.success("模型连接已保存");
  }

  async function onClear(): Promise<void> {
    setClearing(true);
    const result = await aircodeApi.clearModelConnection();
    setClearing(false);
    if (!result.ok) {
      message.error(result.error);
      return;
    }
    setData(result.data);
    syncForm(result.data);
    message.success("已清除模型连接");
  }

  async function onDefaultModelChange(modelRef: string | null): Promise<void> {
    const result = await aircodeApi.setDefaultModel({ modelRef });
    if (!result.ok) {
      message.error(result.error);
      return;
    }
    setData(result.data);
  }

  if (loading && !data) {
    return <Text type="secondary">加载模型设置…</Text>;
  }

  if (error && !data) {
    return (
      <Alert
        type="error"
        showIcon
        message={error}
        action={
          <Button onClick={() => void reload()}>重试</Button>
        }
      />
    );
  }

  if (!data) return null;

  const hasConnection = Boolean(data.connection);

  return (
    <div className="settings-section">
      <Title level={3} className="settings-page-title">
        模型
      </Title>
      <Text type="secondary" className="settings-page-desc">
        选择供应商并填写接口类型、Base URL 与 Token，用于新建会话调用模型。
      </Text>

      <div className="settings-block">
        <div className="settings-block-title">连接配置</div>
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          onFinish={(values) => void onSave(values)}
          className="model-connection-form"
        >
          <Form.Item
            label="供应商"
            name="providerId"
            rules={[{ required: true, message: "请选择供应商" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择供应商"
              options={data.providers.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
              onChange={onProviderChange}
            />
          </Form.Item>

          <Form.Item
            label="接口类型"
            name="apiType"
            rules={[{ required: true, message: "请选择接口类型" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择接口类型"
              options={data.apiTypes.map((t) => ({
                value: t.id,
                label: t.label,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Base URL"
            name="baseUrl"
            rules={[{ required: true, message: "请输入 Base URL" }]}
          >
            <Input placeholder="https://api.example.com" allowClear />
          </Form.Item>

          <Form.Item
            label="Token"
            name="token"
            rules={
              hasConnection && data.connection?.hasToken
                ? []
                : [{ required: true, message: "请输入 Token" }]
            }
            extra={
              hasConnection && data.connection?.hasToken
                ? "已保存 Token；留空则保持不变"
                : undefined
            }
          >
            <Input.Password
              placeholder={
                hasConnection && data.connection?.hasToken ? "••••••••（留空不修改）" : "sk-…"
              }
              autoComplete="off"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                保存
              </Button>
              <Button
                danger
                disabled={!hasConnection}
                loading={clearing}
                onClick={() => void onClear()}
              >
                清除
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>

      <div className="settings-block">
        <div className="settings-block-title">默认模型</div>
        <div className="settings-row">
          <div className="settings-row-copy">
            <div className="settings-row-title">新建会话使用的模型</div>
            <div className="settings-row-desc">
              {hasConnection
                ? "来自当前已配置供应商的模型列表"
                : "请先保存连接配置"}
            </div>
          </div>
          <Select
            allowClear
            placeholder={hasConnection ? "选择默认模型" : "先配置连接"}
            style={{ minWidth: 280 }}
            disabled={!hasConnection || data.models.length === 0}
            value={data.defaultModelRef}
            options={data.models.map((m) => ({
              value: m.ref,
              label: m.name,
            }))}
            onChange={(value) => void onDefaultModelChange(value ?? null)}
          />
        </div>
      </div>
    </div>
  );
}
