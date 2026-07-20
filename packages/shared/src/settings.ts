/** Provider + model settings DTOs for the settings UI. */

export interface ProviderSettingsDto {
  id: string;
  name: string;
  /** Whether auth is currently resolvable (env, stored key, oauth, …). */
  configured: boolean;
  /** Human-readable auth source label (e.g. ANTHROPIC_API_KEY). */
  authLabel?: string;
  authSource?: string;
  /** Whether a non-empty API key is stored in auth.json (not env-only). */
  hasStoredKey: boolean;
}

export interface ModelSettingsDto {
  /** Canonical ref: `provider/id`. */
  ref: string;
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  enabled: boolean;
  /** Provider auth is configured so the model can be used. */
  available: boolean;
  reasoning: boolean;
  contextWindow: number;
}

export interface ModelsSettingsDto {
  defaultModelRef?: string;
  providers: ProviderSettingsDto[];
  models: ModelSettingsDto[];
}

export interface SetDefaultModelRequest {
  modelRef: string | null;
}

export interface SetModelEnabledRequest {
  modelRef: string;
  enabled: boolean;
}

export interface SetProviderApiKeyRequest {
  apiKey: string;
}
