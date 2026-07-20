import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export interface ProviderConnectionConfig {
  providerId: string;
  apiType: string;
  baseUrl: string;
}

export interface AirCodeSettingsFile {
  defaultModelRef?: string;
  connection?: ProviderConnectionConfig;
}

export interface AirCodeSecretsFile {
  /** Active provider API token (paired with settings.connection). */
  token?: string;
  /** Legacy map from earlier API-key UI; migrated on load. */
  apiKeys?: Record<string, string>;
}

const DEFAULT_SETTINGS: AirCodeSettingsFile = {};

function aircodeDir(): string {
  return join(homedir(), ".aircode");
}

function settingsPath(): string {
  return join(aircodeDir(), "settings.json");
}

function secretsPath(): string {
  return join(aircodeDir(), "secrets.json");
}

function isConnection(value: unknown): value is ProviderConnectionConfig {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.providerId === "string" &&
    typeof c.apiType === "string" &&
    typeof c.baseUrl === "string"
  );
}

export async function loadSettings(): Promise<AirCodeSettingsFile> {
  try {
    const raw = await readFile(settingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AirCodeSettingsFile>;
    return {
      defaultModelRef:
        typeof parsed.defaultModelRef === "string" ? parsed.defaultModelRef : undefined,
      connection: isConnection(parsed.connection) ? parsed.connection : undefined,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AirCodeSettingsFile): Promise<void> {
  await mkdir(aircodeDir(), { recursive: true });
  await writeFile(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

export async function loadSecrets(): Promise<AirCodeSecretsFile> {
  try {
    const raw = await readFile(secretsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AirCodeSecretsFile>;
    const apiKeys =
      parsed.apiKeys && typeof parsed.apiKeys === "object" && !Array.isArray(parsed.apiKeys)
        ? Object.fromEntries(
            Object.entries(parsed.apiKeys).filter(
              (entry): entry is [string, string] =>
                typeof entry[0] === "string" && typeof entry[1] === "string" && entry[1].length > 0,
            ),
          )
        : undefined;

    return {
      token: typeof parsed.token === "string" && parsed.token.length > 0 ? parsed.token : undefined,
      apiKeys,
    };
  } catch {
    return {};
  }
}

export async function saveSecrets(secrets: AirCodeSecretsFile): Promise<void> {
  await mkdir(aircodeDir(), { recursive: true });
  const payload: AirCodeSecretsFile = {};
  if (secrets.token) payload.token = secrets.token;
  await writeFile(secretsPath(), `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}
