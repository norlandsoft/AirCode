/** Tauri command names follow `{module}_{action}` (Rust/JS invoke). */
export const TauriCommands = {
  sessionCreate: "session_create",
  sessionPrompt: "session_prompt",
  sessionSteer: "session_steer",
  sessionAbort: "session_abort",
  sessionDispose: "session_dispose",
  sessionGetState: "session_get_state",
} as const;

export type TauriCommand = (typeof TauriCommands)[keyof typeof TauriCommands];

/** Events emitted from Rust (relayed from Node agent host). */
export const TauriEvents = {
  sessionEvent: "session:event",
} as const;

/** @deprecated Use TauriCommands / TauriEvents. Kept as aliases during migration. */
export const IpcChannels = {
  sessionCreate: TauriCommands.sessionCreate,
  sessionPrompt: TauriCommands.sessionPrompt,
  sessionSteer: TauriCommands.sessionSteer,
  sessionAbort: TauriCommands.sessionAbort,
  sessionDispose: TauriCommands.sessionDispose,
  sessionGetState: TauriCommands.sessionGetState,
  sessionEvent: TauriEvents.sessionEvent,
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
