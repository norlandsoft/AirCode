/** ChatView 内联工具标签（与 air-design segmentClaudeContent 对齐） */

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}

export function formatToolUseInlineTag(name: string, detail?: string): string {
  const safeName = escapeAttr(name);
  const inner = detail ?? '{}';
  return `\n<tool_use name="${safeName}">${inner}</tool_use>\n`;
}

export function formatToolResultInlineTag(detail: string): string {
  return `\n<tool_result>${detail}</tool_result>\n`;
}
