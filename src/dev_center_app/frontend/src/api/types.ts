// Mirrors backend Pydantic models (_CamelModel with alias_generator=to_camel)

// â”€â”€ Session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SessionState {
  pid: number;
  workspace: string;
  startedAt: string;       // ISO-8601 UTC
  expiresAt: string;       // ISO-8601 UTC
  autoRenew: boolean;
  claudeProjectHash: string;
}

// â”€â”€ Schedule â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface TimeRange {
  start: string;           // "HH:MM"
  end: string;             // "HH:MM" â€” "00:00" = midnight
}

export interface ScheduleConfig {
  enabled: boolean;
  ranges: TimeRange[];
  days: string[];          // ["mon","tue",...] â€” empty = all days
}

// â”€â”€ Project â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Session responses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SessionResponse {
  projectId: string;
  session: SessionState;
}

// â”€â”€ Memory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface MemoryFile {
  name: string;
  content: string;
  updatedAt: string;       // ISO-8601 UTC
}

export interface MemoryResponse {
  files: MemoryFile[];
  hashDiscovered: boolean;
}

// â”€â”€ Rules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface RulesResponse {
  content: string;
  globalRulesOutOfSync: boolean;
}

export interface RulesFile {
  filename: string;
  size: number;
}

export interface RulesFilesResponse {
  files: RulesFile[];
}

// â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface AuthStatusResponse {
  authenticated: boolean;
  email: string | null;
}

export interface HealthResponse {
  status: string;
  serverTime: string;
  timezone: string;
  utcOffset: string;
}

// â”€â”€ Monitoring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Model options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const MODEL_OPTIONS: { provider: string; model: string; label: string }[] = [
  { provider: 'anthropic', model: 'claude-opus-4-6',   label: 'Claude Opus 4.6' },
  { provider: 'anthropic', model: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { provider: 'anthropic', model: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5' },
];

