// Mirrors backend Pydantic models (camelCase from _CamelModel alias_generator)

export interface BridgeState {
  pid: number;
  workspace: string;
  expiresAt: string;  // ISO-8601 UTC
  autoRenew: boolean;
}

export interface ModelOverride {
  provider: string;
  model: string;
}

export interface Project {
  groupId: string;
  projectId: string;
  repoUrl: string;
  bridge: BridgeState | null;
  modelOverride: ModelOverride | null;
  schedule: ScheduleConfig | null;  // null = inherit global
}

export interface ProjectListResponse {
  projects: Project[];
}

export interface CreateProjectRequest {
  groupId: string;
  repoUrl: string;
  provider: string;
  model: string;
}

export interface BridgeStatusResponse {
  groupId: string;
  bridge: BridgeState | null;
}

export interface BridgeActionResponse {
  status: string;
}

export interface FileContentResponse {
  content: string;
}

export interface FileWriteResponse {
  status: string;
}

export interface SessionMemoryResponse {
  projectId: string;
  content: string;
}

export interface TranscriptResponse {
  projectId: string;
  content: string;
}

export interface TelegramPromptResponse {
  agentId: string;
  systemPrompt: string;
}

export interface ModelResponse {
  provider: string;
  model: string;
}

// Known provider/model combinations
export const MODEL_OPTIONS: { provider: string; model: string; label: string }[] = [
  { provider: 'openai-codex', model: 'gpt-5.3-codex',    label: 'Codex gpt-5.3' },
  { provider: 'openai-codex', model: 'gpt-5.1-codex',    label: 'Codex gpt-5.1' },
  { provider: 'anthropic',    model: 'claude-opus-4-6',   label: 'Claude Opus 4.6' },
  { provider: 'anthropic',    model: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { provider: 'anthropic',    model: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5' },
];

// ── Schedule types ────────────────────────────────────────────────────────

export interface ScheduleWindow {
  startTime: string;    // "HH:MM" 24h format
  endTime: string;      // "HH:MM" 24h format
  days: string[];       // ["mon","tue","wed","thu","fri","sat","sun"]
}

export interface ScheduleConfig {
  enabled: boolean;
  windows: ScheduleWindow[];
  warnLeadMinutes: number;
  warnIntervalMinutes: number;
  alertTemplate: string;
}

export interface GlobalDefaults {
  defaultProvider: string;
  defaultModel: string;
  defaultBridgeTtlHours: number;
  defaultTelegramPrompt: string;
}

// ── Context size ──────────────────────────────────────────────────────────

export interface ContextSizeResponse {
  total: number;
  claudeMd: number;
  systemPrompt: number;
  sessionMemory: number;
  estimatedMax: number;
}

// ── Monitoring types ──────────────────────────────────────────────────────

export interface TimelineWindow {
  start: string;    // ISO-8601 UTC
  end: string;      // ISO-8601 UTC
  status: 'active' | 'scheduled' | 'past';
}

export interface TimelineProject {
  groupId: string;
  projectId: string;
  windows: TimelineWindow[];
}

export interface TimelineResponse {
  projects: TimelineProject[];
}

export interface ActivityEntry {
  timestamp: string;
  groupId: string;
  projectId: string;
  event: string;
  level: 'info' | 'warning' | 'error';
}

export interface ActivityLogResponse {
  entries: ActivityEntry[];
}
