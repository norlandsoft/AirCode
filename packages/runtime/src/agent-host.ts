import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  AgentEventDto,
  ApiTypeOptionDto,
  ModelConnectionDto,
  ModelOptionDto,
  ModelsSettingsDto,
  ProviderOptionDto,
  SaveModelConnectionRequest,
  SessionStateDto,
} from "@aircode/shared";
import { mapSessionEvent } from "./map-event.js";
import {
  clearPiAuthFile,
  loadSecrets,
  loadSettings,
  piAuthPath,
  saveSecrets,
  saveSettings,
  writePiProviderApiKey,
  type AirCodeSecretsFile,
  type AirCodeSettingsFile,
  type ProviderConnectionConfig,
} from "./settings-store.js";

/** Providers offered in the connection form (excludes large aggregators). */
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
  "openrouter",
] as const;

const API_TYPE_OPTIONS: ApiTypeOptionDto[] = [
  { id: "anthropic-messages", label: "Anthropic Messages" },
  { id: "openai-completions", label: "OpenAI Completions" },
  { id: "openai-responses", label: "OpenAI Responses" },
  { id: "google-generative-ai", label: "Google Generative AI" },
  { id: "mistral-conversations", label: "Mistral Conversations" },
];

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
  private settings: AirCodeSettingsFile = {};
  private secrets: AirCodeSecretsFile = {};
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

    const model =
      this.resolveModel(modelRuntime, options.modelId) ?? this.resolveSessionModel(modelRuntime);

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
      await this.ensureSessionReady(hosted);
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

  async saveModelConnection(req: SaveModelConnectionRequest): Promise<ModelsSettingsDto> {
    const runtime = await this.getModelRuntime();
    await this.ensureConfig();

    const providerId = req.providerId.trim();
    const apiType = req.apiType.trim();
    const baseUrl = req.baseUrl.trim();
    if (!providerId) throw new Error("providerId is required");
    if (!apiType) throw new Error("apiType is required");
    if (!runtime.getProvider(providerId)) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    const nextToken = req.token?.trim();
    const token = nextToken || this.secrets.token;
    if (!token) {
      throw new Error("token is required");
    }

    const previousProvider = this.settings.connection?.providerId;
    if (previousProvider && previousProvider !== providerId) {
      await writePiProviderApiKey(previousProvider, null);
      await runtime.removeRuntimeApiKey(previousProvider);
      try {
        runtime.unregisterProvider(previousProvider);
      } catch {
        // ignore
      }
    }

    const connection: ProviderConnectionConfig = {
      providerId,
      apiType,
      baseUrl,
    };

    this.settings.connection = connection;
    if (
      this.settings.defaultModelRef &&
      !this.settings.defaultModelRef.startsWith(`${providerId}/`)
    ) {
      delete this.settings.defaultModelRef;
    }

    // Default to the first model of this provider when unset.
    if (!this.settings.defaultModelRef) {
      const first = runtime.getModels(providerId)[0];
      if (first) {
        this.settings.defaultModelRef = modelRef(first.provider, first.id);
      }
    }

    this.secrets = { token };
    await saveSettings(this.settings);
    await saveSecrets(this.secrets);
    await this.applyConnection(runtime, connection, token);
    await this.syncSessionsToDefaultModel(runtime);

    return this.buildModelsSettings(runtime);
  }

  async clearModelConnection(): Promise<ModelsSettingsDto> {
    const runtime = await this.getModelRuntime();
    await this.ensureConfig();

    const previous = this.settings.connection;
    if (previous) {
      try {
        runtime.unregisterProvider(previous.providerId);
      } catch {
        // Provider may not have been registered as an override.
      }
      await runtime.removeRuntimeApiKey(previous.providerId);
    }

    delete this.settings.connection;
    delete this.settings.defaultModelRef;
    this.secrets = {};
    await saveSettings(this.settings);
    await saveSecrets(this.secrets);
    await clearPiAuthFile();
    await runtime.refresh({ allowNetwork: false });

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
    await this.syncSessionsToDefaultModel(runtime);
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

    // Migrate legacy apiKeys map into the single connection token.
    if (!this.secrets.token && secrets.apiKeys) {
      if (this.settings.connection?.providerId) {
        const legacy = secrets.apiKeys[this.settings.connection.providerId];
        if (legacy) {
          this.secrets = { token: legacy };
          await saveSecrets(this.secrets);
        }
      } else {
        const first = Object.entries(secrets.apiKeys)[0];
        if (first) {
          const [providerId, token] = first;
          this.settings.connection = {
            providerId,
            apiType: "openai-completions",
            baseUrl: "",
          };
          this.secrets = { token };
          await saveSettings(this.settings);
          await saveSecrets(this.secrets);
        }
      }
    }

    this.configLoaded = true;
  }

  private resolveModel(
    runtime: ModelRuntime,
    ref: string | undefined,
  ): Model<any> | undefined {
    if (!ref) return undefined;
    const parsed = parseModelRef(ref);
    if (!parsed) return undefined;
    return runtime.getModel(parsed.providerId, parsed.modelId);
  }

  /** Prefer configured default, else first model of the connected provider. */
  private resolveSessionModel(runtime: ModelRuntime): Model<any> | undefined {
    const fromDefault = this.resolveModel(runtime, this.settings.defaultModelRef);
    if (fromDefault) return fromDefault;

    const providerId = this.settings.connection?.providerId;
    if (!providerId) return undefined;
    return runtime.getModels(providerId)[0];
  }

  private async ensureSessionReady(hosted: HostedSession): Promise<void> {
    const runtime = await this.getModelRuntime();
    await this.ensureConfig();

    if (this.settings.connection && this.secrets.token) {
      const providerId = this.settings.connection.providerId;
      const authOk =
        runtime.hasConfiguredAuth(providerId) ||
        (await runtime.checkAuth(providerId)) !== undefined;
      if (!authOk) {
        await this.applyConnection(runtime, this.settings.connection, this.secrets.token);
      }
    }

    const desired = this.resolveSessionModel(runtime);
    if (!desired) {
      throw new Error("未配置可用模型，请先在设置中保存模型连接并选择默认模型");
    }

    const current = hosted.session.model;
    if (!current || current.provider !== desired.provider || current.id !== desired.id) {
      await hosted.session.setModel(desired);
    }
  }

  private async syncSessionsToDefaultModel(runtime: ModelRuntime): Promise<void> {
    const desired = this.resolveSessionModel(runtime);
    if (!desired) return;

    for (const hosted of this.sessions.values()) {
      const current = hosted.session.model;
      if (current && current.provider === desired.provider && current.id === desired.id) {
        continue;
      }
      try {
        await hosted.session.setModel(desired);
      } catch {
        // Session may be streaming; prompt-time ensureSessionReady will retry.
      }
    }
  }

  private async applyConnection(
    runtime: ModelRuntime,
    connection: ProviderConnectionConfig,
    token: string,
  ): Promise<void> {
    // Persist into Pi AuthStorage-backed file so checkAuth/getAuth resolve natively.
    await writePiProviderApiKey(connection.providerId, token);

    runtime.registerProvider(connection.providerId, {
      baseUrl: connection.baseUrl || undefined,
      api: connection.apiType as Api,
      apiKey: token,
    });

    // Runtime overlay covers the already-constructed AuthStorage (file write alone
    // does not reload its in-memory cache).
    await runtime.setRuntimeApiKey(connection.providerId, token);
    await runtime.refresh({ allowNetwork: false });
  }

  private buildModelsSettings(runtime: ModelRuntime): ModelsSettingsDto {
    const providers: ProviderOptionDto[] = [];
    for (const providerId of SETTINGS_PROVIDER_IDS) {
      const provider = runtime.getProvider(providerId);
      if (!provider) continue;
      const firstModel = runtime.getModels(providerId)[0];
      providers.push({
        id: provider.id,
        name: provider.name,
        defaultBaseUrl: provider.baseUrl,
        defaultApiType: firstModel?.api,
      });
    }

    const connection = this.settings.connection
      ? ({
          providerId: this.settings.connection.providerId,
          apiType: this.settings.connection.apiType,
          baseUrl: this.settings.connection.baseUrl,
          hasToken: Boolean(this.secrets.token),
        } satisfies ModelConnectionDto)
      : null;

    const models: ModelOptionDto[] = [];
    const providerId = connection?.providerId;
    if (providerId) {
      const list = runtime.getModels(providerId);
      for (const model of list) {
        models.push({
          ref: modelRef(model.provider, model.id),
          id: model.id,
          name: model.name,
          providerId: model.provider,
        });
      }
    }

    let defaultModelRef = this.settings.defaultModelRef;
    if (defaultModelRef && !models.some((m) => m.ref === defaultModelRef)) {
      defaultModelRef = undefined;
    }

    return {
      providers,
      apiTypes: API_TYPE_OPTIONS,
      connection,
      defaultModelRef,
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

        // Ensure auth file exists before ModelRuntime loads AuthStorage.
        if (this.settings.connection && this.secrets.token) {
          await writePiProviderApiKey(this.settings.connection.providerId, this.secrets.token);
        } else {
          await clearPiAuthFile();
        }

        const runtime = await ModelRuntime.create({
          allowModelNetwork: false,
          authPath: piAuthPath(),
        });

        if (this.settings.connection && this.secrets.token) {
          await this.applyConnection(runtime, this.settings.connection, this.secrets.token);
        }

        this.modelRuntime = runtime;
        return runtime;
      })();
    }
    return this.modelRuntimePromise;
  }
}
