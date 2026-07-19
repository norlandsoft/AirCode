import Editor from "@monaco-editor/react";

export interface CodeViewerProps {
  value: string;
  language?: string;
  height?: number | string;
  readOnly?: boolean;
}

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  tsx: "typescript",
  jsx: "javascript",
  py: "python",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  md: "markdown",
  yml: "yaml",
  "": "plaintext",
};

function resolveLanguage(language?: string): string {
  const key = (language ?? "").trim().toLowerCase();
  return LANGUAGE_ALIASES[key] ?? (key || "plaintext");
}

export function CodeViewer({
  value,
  language,
  height = 180,
  readOnly = true,
}: CodeViewerProps) {
  const lineCount = Math.max(1, value.split("\n").length);
  const resolvedHeight =
    typeof height === "number"
      ? Math.min(420, Math.max(96, lineCount * 18 + 24))
      : height;

  return (
    <div className="code-viewer">
      <Editor
        height={resolvedHeight}
        language={resolveLanguage(language)}
        value={value}
        theme="vs"
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineNumbers: "on",
          wordWrap: "on",
          automaticLayout: true,
          folding: false,
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          tabSize: 2,
        }}
      />
    </div>
  );
}
