/** Provider connection + model settings DTOs. */

export interface ProviderOptionDto {
  id: string;
  name: string;
  defaultBaseUrl?: string;
  defaultApiType?: string;
}

export interface ApiTypeOptionDto {
  id: string;
  label: string;
}

export interface ModelConnectionDto {
  providerId: string;
  apiType: string;
  baseUrl: string;
  /** Whether a token is stored (never return the raw secret). */
  hasToken: boolean;
}

export interface ModelOptionDto {
  /** Canonical ref: `provider/id`. */
  ref: string;
  id: string;
  name: string;
  providerId: string;
}

export interface ModelsSettingsDto {
  providers: ProviderOptionDto[];
  apiTypes: ApiTypeOptionDto[];
  connection: ModelConnectionDto | null;
  defaultModelRef?: string;
  /** Models available for the currently configured provider (for default model). */
  models: ModelOptionDto[];
}

export interface SaveModelConnectionRequest {
  providerId: string;
  apiType: string;
  baseUrl: string;
  /** Omit or empty to keep the previously stored token. */
  token?: string;
}

export interface SetDefaultModelRequest {
  modelRef: string | null;
}
