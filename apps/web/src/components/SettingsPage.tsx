import { useState, type ReactNode } from "react";
import { Button, Input, Typography } from "antd";
import {
  ArrowLeftOutlined,
  CodeSandboxOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { ModelsSettingsPanel } from "./ModelsSettingsPanel";

export type SettingsSectionId = "models";

export interface SettingsPageProps {
  onBack: () => void;
}

const NAV_ITEMS: Array<{
  id: SettingsSectionId;
  label: string;
  icon: ReactNode;
}> = [{ id: "models", label: "模型", icon: <CodeSandboxOutlined /> }];

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [section, setSection] = useState<SettingsSectionId>("models");
  const [search, setSearch] = useState("");

  return (
    <div className="settings-shell">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-top">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            className="settings-back-btn"
            onClick={onBack}
          >
            返回
          </Button>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
            placeholder="搜索设置"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="settings-search"
          />
        </div>

        <nav className="settings-nav">
          {NAV_ITEMS.filter((item) =>
            search.trim()
              ? item.label.toLowerCase().includes(search.trim().toLowerCase())
              : true,
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`settings-nav-item${section === item.id ? " active" : ""}`}
              onClick={() => setSection(item.id)}
            >
              <span className="settings-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="settings-sidebar-footer">
          <div className="settings-profile">
            <div className="settings-avatar">A</div>
            <div className="settings-profile-text">
              <Typography.Text strong>AirCode</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                本地 Agent
              </Typography.Text>
            </div>
            <SettingOutlined className="settings-profile-gear" />
          </div>
        </div>
      </aside>

      <main className="settings-content">
        {section === "models" ? <ModelsSettingsPanel /> : null}
      </main>
    </div>
  );
}
