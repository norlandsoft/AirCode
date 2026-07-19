#!/usr/bin/env node
import { AgentHost } from "@aircode/runtime";

async function main(): Promise<void> {
  const promptText = process.argv.slice(2).join(" ").trim() || "List files in the current directory.";
  const cwd = process.cwd();

  const host = new AgentHost();
  host.onEvent((event) => {
    if (event.type === "message_update" && event.delta) {
      process.stdout.write(event.delta);
    } else if (event.type === "tool_execution_start") {
      process.stderr.write(`\n[tool:${event.toolName}] start\n`);
    } else if (event.type === "tool_execution_end") {
      process.stderr.write(`[tool:${event.toolName}] end${event.isError ? " (error)" : ""}\n`);
    } else if (event.type === "error") {
      process.stderr.write(`\n[error] ${event.message}\n`);
    }
  });

  const { sessionId } = await host.createSession({ cwd });
  process.stderr.write(`session=${sessionId} cwd=${cwd}\n`);
  process.stderr.write(`prompt: ${promptText}\n\n`);

  try {
    await host.prompt(sessionId, promptText);
    process.stdout.write("\n");
  } finally {
    host.dispose(sessionId);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
