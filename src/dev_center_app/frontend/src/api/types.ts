// Mirrors backend Pydantic models (_CamelModel with alias_generator=to_camel)

// ── Session ────────────────────────────────────────────────────────────────

export interface SessionState {
  pid: number;
  workspace: string;
  startedAt: string;       // ISO-8601 UTC
  expiresAt: string;       // ISO-8601 UTC
  autoRenew: boolean;
  claudeProjectHash: string;
}

// ── Schedule ───────────────────────────────────────────────────────────────

export interface TimeRange {
  start: string;           // "HH:MM"
  end: string;             // "HH:MM" — "00:00" = midnight
}

export interface ScheduleConfig {
  enabled: boolean;
  ranges: TimeRange[];
  days: string[];          // ["mon","tue",...] — empty = all days
}

// ── Project ────────────────────────────────────────────────────────────────

export type ProjectStatus = 'cloning' | 'ready' | 'active';

export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  workspacePath: string;
  provider: string;
  model: string;
  schedule: ScheduleConfig;
  session: SessionState | null;
  status: ProjectStatus;
}

export interface ProjectListResponse {
  projects: Project[];
}

export interface CreateProjectRequest {
  repoUrl: string;
  provider?: string;
  model?: string;
}

export interface UpdateProjectRequest {
  provider?: string;
  model?: string;
  schedule?: ScheduleConfig;
  autoRenew?: boolean;
}

// ── Session responses ──────────────────────────────────────────────────────

export interface SessionResponse {
  projectId: string;
  session: SessionState;
}

// ── Memory ─────────────────────────────────────────────────────────────────

export interface MemoryFile {
  name: string;
  content: string;
  updatedAt: string;       // ISO-8601 UTC
}

export interface MemoryResponse {
  files: MemoryFile[];
  hashDiscovered: boolean;
}

// ── Rules ──────────────────────────────────────────────────────────────────

export interface RulesResponse {
  content: string;
  globalRulesOutOfSync: boolean;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export interface AuthStatusResponse {
  authenticated: boolean;
  email: string | null;
}

// ── Monitoring ─────────────────────────────────────────────────────────────

export interface ProjectMonitorRow {
  id: string;
  name: string;
  status: ProjectStatus;
  pid: number | null;
  expiresAt: string | null;
  workspacePath: string;
}

export interface MonitoringResponse {
  projects: ProjectMonitorRow[];
}

export interface MonitoringEvent {
  type: string;              // "session.started" | "session.stopped" | etc.
  projectId: string;
  data: Record<string, unknown>;
}

// ── Settings ───────────────────────────────────────────────────────────────

export interface GlobalDefaults {
  defaultProvider: string;
  defaultModel: string;
  defaultTtlHours: number;
  renewThresholdMinutes: number;
}

export interface GlobalConfigResponse {
  defaults: GlobalDefaults;
  schedule: ScheduleConfig;
}

// ── Model options ──────────────────────────────────────────────────────────

export const MODEL_OPTIONS: { provider: string; model: string; label: string }[] = [
  { provider: 'anthropic', model: 'claude-opus-4-6',   label: 'Claude Opus 4.6' },
  { provider: 'anthropic', model: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { provider: 'anthropic', model: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5' },
];
