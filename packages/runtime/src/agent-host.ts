import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import type { Model } from "@earendil-works/pi-ai";
import type {
  AgentEventDto,
  ModelsSettingsDto,
  ModelSettingsDto,
  ProviderSettingsDto,
  SessionStateDto,
} from "@aircode/shared";
import { mapSessionEvent } from "./map-event.js";
import {
  loadSecrets,
  loadSettings,
  saveSecrets,
  saveSettings,
  type AirCodeSecretsFile,
  type AirCodeSettingsFile,
} from "./settings-store.js";

/** Providers shown in the Models settings UI (excludes large aggregators). */
const SETTINGS_PROVIDER_IDS = [
  "anthropic",
  "openai",
  "google",
  "deepseek",
  "groq",
  "mistral",
  "xai",
  "moonshotai",
  "moonshotai-cn",
  "minimax",
  "minimax-cn",
  "kimi-coding",
  "cerebras",
  "ant-ling",
] as const;

export interface CreateHostSessionOptions {
  cwd: string;
  modelId?: string;
}

export type AgentEventListener = (event: AgentEventDto) => void;

interface HostedSession {
  id: string;
  cwd: string;
  session: AgentSession;
  unsubscribe: () => void;
}

function modelRef(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`;
}

function parseModelRef(ref: string): { providerId: string; modelId: string } | null {
  const slash = ref.indexOf("/");
  if (slash <= 0 || slash === ref.length - 1) return null;
  return { providerId: ref.slice(0, slash), modelId: ref.slice(slash + 1) };
}

/**
 * Platform runtime facade over Pi's createAgentSession SDK.
 * Keeps HTTP server / CLI free of direct Pi imports.
 */
export class AgentHost {
  private readonly sessions = new Map<string, HostedSession>();
  private readonly listeners = new Set<AgentEventListener>();
  private modelRuntime: ModelRuntime | undefined;
  private modelRuntimePromise: Promise<ModelRuntime> | undefined;
  private settings: AirCodeSettingsFile = { disabledModelRefs: [] };
  private secrets: AirCodeSecretsFile = { apiKeys: {} };
  private configLoaded = false;

  onEvent(listener: AgentEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async createSession(options: CreateHostSessionOptions): Promise<{ sessionId: string; cwd: string }> {
    const cwd = resolve(options.cwd);
    const modelRuntime = await this.getModelRuntime();
    await this.ensureConfig();

    const model = this.resolveModel(modelRuntime, options.modelId ?? this.settings.defaultModelRef);

    const { session } = await createAgentSession({
      cwd,
      sessionManager: SessionManager.inMemory(),
      modelRuntime,
      model,
    });

    const sessionId = randomUUID();
    const unsubscribe = session.subscribe((event) => {
      const dto = mapSessionEvent(sessionId, event);
      if (dto) {
        this.emit(dto);
      }
    });

    this.sessions.set(sessionId, { id: sessionId, cwd, session, unsubscribe });
    return { sessionId, cwd };
  }

  async prompt(sessionId: string, text: string): Promise<void> {
    const hosted = this.requireSession(sessionId);
    try {
      await hosted.session.prompt(text);
    } catch (error) {
      this.emit({
        type: "error",
        sessionId,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async steer(sessionId: string, text: string): Promise<void> {
    const hosted = this.requireSession(sessionId);
    await hosted.session.steer(text);
  }

  async abort(sessionId: string): Promise<void> {
    const hosted = this.requireSession(sessionId);
    await hosted.session.abort();
  }

  getState(sessionId: string): SessionStateDto {
    const hosted = this.requireSession(sessionId);
    const { session } = hosted;
    const model = session.model;
    return {
      sessionId,
      cwd: hosted.cwd,
      isStreaming: session.isStreaming,
      modelId: model ? modelRef(model.provider, model.id) : undefined,
      thinkingLevel: session.thinkingLevel,
      errorMessage: session.agent.state.errorMessage,
    };
  }

  async getModelsSettings(): Promise<ModelsSettingsDto> {
    const runtime = await this.getModelRuntime();
    await this.ensureConfig();
    return this.buildModelsSettings(runtime);
  }

  async setDefaultModel(modelRefValue: string | null): Promise<ModelsSettingsDto> {
    const runtime = await this.getModelRuntime();
    await this.ensureConfig();

    if (modelRefValue) {
      const parsed = parseModelRef(modelRefValue);
      if (!parsed || !runtime.getModel(parsed.providerId, parsed.modelId)) {
        throw new Error(`Unknown model: ${modelRefValue}`);
      }
      this.settings.defaultModelRef = modelRefValue;
    } else {
      delete this.settings.defaultModelRef;
    }

    await saveSettings(this.settings);
    return this.buildModelsSettings(runtime);
  }

  async setModelEnabled(modelRefValue: string, enabled: boolean): Promise<ModelsSettingsDto> {
    const runtime = await this.getModelRuntime();
    await this.ensureConfig();

    const parsed = parseModelRef(modelRefValue);
    if (!parsed || !runtime.getModel(parsed.providerId, parsed.modelId)) {
      throw new Error(`Unknown model: ${modelRefValue}`);
    }

    const disabled = new Set(this.settings.disabledModelRefs);
    if (enabled) {
      disabled.delete(modelRefValue);
    } else {
      disabled.add(modelRefValue);
      if (this.settings.defaultModelRef === modelRefValue) {
        delete this.settings.defaultModelRef;
      }
    }
    this.settings.disabledModelRefs = [...disabled];
    await saveSettings(this.settings);
    return this.buildModelsSettings(runtime);
  }

  async setProviderApiKey(providerId: string, apiKey: string): Promise<ModelsSettingsDto> {
    const runtime = await this.getModelRuntime();
    await this.ensureConfig();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      throw new Error("apiKey is required");
    }
    if (!runtime.getProvider(providerId)) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    this.secrets.apiKeys[providerId] = trimmed;
    await saveSecrets(this.secrets);
    await runtime.setRuntimeApiKey(providerId, trimmed);
    return this.buildModelsSettings(runtime);
  }

  async clearProviderApiKey(providerId: string): Promise<ModelsSettingsDto> {
    const runtime = await this.getModelRuntime();
    await this.ensureConfig();
    if (!runtime.getProvider(providerId)) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    delete this.secrets.apiKeys[providerId];
    await saveSecrets(this.secrets);
    await runtime.removeRuntimeApiKey(providerId);
    return this.buildModelsSettings(runtime);
  }

  dispose(sessionId: string): void {
    const hosted = this.sessions.get(sessionId);
    if (!hosted) {
      return;
    }
    hosted.unsubscribe();
    hosted.session.dispose();
    this.sessions.delete(sessionId);
  }

  disposeAll(): void {
    for (const sessionId of [...this.sessions.keys()]) {
      this.dispose(sessionId);
    }
  }

  private requireSession(sessionId: string): HostedSession {
    const hosted = this.sessions.get(sessionId);
    if (!hosted) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return hosted;
  }

  private emit(event: AgentEventDto): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener failures must not break the agent loop.
      }
    }
  }

  private async ensureConfig(): Promise<void> {
    if (this.configLoaded) return;
    const [settings, secrets] = await Promise.all([loadSettings(), loadSecrets()]);
    this.settings = settings;
    this.secrets = secrets;
    this.configLoaded = true;
  }

  private resolveModel(
    runtime: ModelRuntime,
    ref: string | undefined,
  ): Model<any> | undefined {
    if (!ref) return undefined;
    const parsed = parseModelRef(ref);
    if (!parsed) return undefined;
    if (this.settings.disabledModelRefs.includes(ref)) return undefined;
    return runtime.getModel(parsed.providerId, parsed.modelId);
  }

  private buildModelsSettings(runtime: ModelRuntime): ModelsSettingsDto {
    const disabled = new Set(this.settings.disabledModelRefs);
    const availableSet = new Set(
      runtime.getAvailableSnapshot().map((m) => modelRef(m.provider, m.id)),
    );

    const providers: ProviderSettingsDto[] = [];
    for (const providerId of SETTINGS_PROVIDER_IDS) {
      const provider = runtime.getProvider(providerId);
      if (!provider) continue;
      const status = runtime.getProviderAuthStatus(providerId);
      const hasStoredKey = Boolean(this.secrets.apiKeys[providerId]);

      providers.push({
        id: provider.id,
        name: provider.name,
        configured: status.configured,
        authLabel: status.label,
        authSource: status.source,
        hasStoredKey,
      });
    }

    const models: ModelSettingsDto[] = [];
    for (const providerId of SETTINGS_PROVIDER_IDS) {
      const provider = runtime.getProvider(providerId);
      if (!provider) continue;
      for (const model of runtime.getModels(providerId)) {
        const ref = modelRef(model.provider, model.id);
        models.push({
          ref,
          id: model.id,
          name: model.name,
          providerId: model.provider,
          providerName: provider.name,
          enabled: !disabled.has(ref),
          available: availableSet.has(ref),
          reasoning: model.reasoning,
          contextWindow: model.contextWindow,
        });
      }
    }

    models.sort((a, b) => {
      if (a.providerName !== b.providerName) return a.providerName.localeCompare(b.providerName);
      return a.name.localeCompare(b.name);
    });

    let defaultModelRef = this.settings.defaultModelRef;
    if (defaultModelRef && disabled.has(defaultModelRef)) {
      defaultModelRef = undefined;
    }

    return {
      defaultModelRef,
      providers,
      models,
    };
  }

  private async getModelRuntime(): Promise<ModelRuntime> {
    if (this.modelRuntime) {
      return this.modelRuntime;
    }
    if (!this.modelRuntimePromise) {
      this.modelRuntimePromise = (async () => {
        await this.ensureConfig();
        const runtime = await ModelRuntime.create({
          allowModelNetwork: false,
        });
        for (const [providerId, apiKey] of Object.entries(this.secrets.apiKeys)) {
          await runtime.setRuntimeApiKey(providerId, apiKey);
        }
        this.modelRuntime = runtime;
        return runtime;
      })();
    }
    return this.modelRuntimePromise;
  }
}
