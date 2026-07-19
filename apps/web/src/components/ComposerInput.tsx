import { Button, Flex, Input, Space } from "antd";
import {
  ArrowUpOutlined,
  PauseCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";

const { TextArea } = Input;

export interface ComposerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAbort: () => void;
  disabled?: boolean;
  streaming?: boolean;
  placeholder?: string;
}

export function ComposerInput({
  value,
  onChange,
  onSend,
  onAbort,
  disabled,
  streaming,
  placeholder = "描述任务，或询问代码问题…",
}: ComposerInputProps) {
  const canSend = !disabled && !streaming && value.trim().length > 0;

  return (
    <div className="composer">
      <div className="composer-box">
        <TextArea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoSize={{ minRows: 2, maxRows: 8 }}
          variant="borderless"
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
        />
        <Flex className="composer-toolbar" justify="space-between" align="center">
          <Space size={4}>
            <Button type="text" size="small" icon={<PlusOutlined />} disabled />
            <Button type="text" size="small" disabled>
              Auto
            </Button>
          </Space>
          <Space size={8}>
            {streaming ? (
              <Button
                type="default"
                shape="circle"
                icon={<PauseCircleOutlined />}
                onClick={onAbort}
                aria-label="中断"
              />
            ) : (
              <Button
                type="primary"
                shape="circle"
                icon={<ArrowUpOutlined />}
                onClick={onSend}
                disabled={!canSend}
                aria-label="发送"
              />
            )}
          </Space>
        </Flex>
      </div>
      <div className="composer-hint">⌘/Ctrl + Enter 发送 · Shift + Enter 换行</div>
    </div>
  );
}
