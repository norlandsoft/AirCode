#!/usr/bin/env node
/**
 * Node agent bridge for Tauri.
 * Protocol: newline-delimited JSON over stdin/stdout.
 *
 * Request:  { "id": string, "method": string, "params"?: unknown }
 * Response: { "id": string, "result"?: unknown, "error"?: string }
 * Event:    { "event": "session:event", "payload": AgentEventDto }
 */
import { createInterface } from "node:readline";
import { AgentHost } from "@aircode/runtime";
import { TauriEvents, type AgentEventDto } from "@aircode/shared";

interface RpcRequest {
  id: string;
  method: string;
  params?: unknown;
}

const host = new AgentHost();

host.onEvent((payload: AgentEventDto) => {
  writeLine({ event: TauriEvents.sessionEvent, payload });
});

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  void handleLine(trimmed);
});

rl.on("close", () => {
  host.disposeAll();
  process.exit(0);
});

process.on("SIGINT", () => {
  host.disposeAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  host.disposeAll();
  process.exit(0);
});

writeLine({ event: "host:ready", payload: { ok: true } });

async function handleLine(line: string): Promise<void> {
  let req: RpcRequest;
  try {
    req = JSON.parse(line) as RpcRequest;
  } catch {
    writeLine({ id: "unknown", error: "Invalid JSON request" });
    return;
  }

  if (!req.id || !req.method) {
    writeLine({ id: req.id ?? "unknown", error: "Missing id or method" });
    return;
  }

  try {
    const result = await dispatch(req.method, req.params);
    writeLine({ id: req.id, result });
  } catch (error) {
    writeLine({
      id: req.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function dispatch(method: string, params: unknown): Promise<unknown> {
  const p = (params ?? {}) as Record<string, unknown>;

  switch (method) {
    case "session.create": {
      const cwd = typeof p.cwd === "string" && p.cwd ? p.cwd : process.cwd();
      const modelId = typeof p.modelId === "string" ? p.modelId : undefined;
      return host.createSession({ cwd, modelId });
    }
    case "session.prompt": {
      await host.prompt(String(p.sessionId), String(p.text ?? ""));
      return null;
    }
    case "session.steer": {
      await host.steer(String(p.sessionId), String(p.text ?? ""));
      return null;
    }
    case "session.abort": {
      await host.abort(String(p.sessionId));
      return null;
    }
    case "session.dispose": {
      host.dispose(String(p.sessionId));
      return null;
    }
    case "session.getState": {
      return host.getState(String(p.sessionId));
    }
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

function writeLine(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
