import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export interface AirCodeSettingsFile {
  defaultModelRef?: string;
  /** Model refs that the user has explicitly disabled. Missing = enabled. */
  disabledModelRefs: string[];
}

export interface AirCodeSecretsFile {
  /** Provider id → API key. */
  apiKeys: Record<string, string>;
}

const DEFAULT_SETTINGS: AirCodeSettingsFile = {
  disabledModelRefs: [],
};

function aircodeDir(): string {
  return join(homedir(), ".aircode");
}

function settingsPath(): string {
  return join(aircodeDir(), "settings.json");
}

function secretsPath(): string {
  return join(aircodeDir(), "secrets.json");
}

export async function loadSettings(): Promise<AirCodeSettingsFile> {
  try {
    const raw = await readFile(settingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AirCodeSettingsFile>;
    return {
      defaultModelRef: parsed.defaultModelRef,
      disabledModelRefs: Array.isArray(parsed.disabledModelRefs)
        ? parsed.disabledModelRefs.filter((x): x is string => typeof x === "string")
        : [],
    };
  } catch {
    return { ...DEFAULT_SETTINGS, disabledModelRefs: [] };
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
        : {};
    return { apiKeys };
  } catch {
    return { apiKeys: {} };
  }
}

export async function saveSecrets(secrets: AirCodeSecretsFile): Promise<void> {
  await mkdir(aircodeDir(), { recursive: true });
  await writeFile(secretsPath(), `${JSON.stringify(secrets, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}
