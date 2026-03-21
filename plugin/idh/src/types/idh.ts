// ====== Code Summary ======
// TypeScript interfaces mirroring idh-app's Python state models (camelCase JSON).

export interface ModelOverride {
  provider: string;
  model: string;
}

export interface BridgeState {
  pid: number;
  workspace: string;
  expiresAt: string; // ISO-8601 UTC
}

export interface Project {
  groupId: string;
  projectId: string;
  repoUrl: string;
  bridge: BridgeState | null;
  modelOverride: ModelOverride | null;
}

export interface StateFile {
  projects: Record<string, Project>;
}

/** Inbound event types sent by idh-app watchdog to the plugin webhook. */
export type WebhookEventType = "bridge_warning" | "bridge_renewed" | "bridge_stopped";

export interface WebhookEvent {
  type: WebhookEventType;
  groupId: string;
  projectId: string;
  /** Present on bridge_warning: minutes remaining before expiry. */
  minutesRemaining?: number;
  /** Present on bridge_renewed: new bridge URL. */
  bridgeUrl?: string;
}
