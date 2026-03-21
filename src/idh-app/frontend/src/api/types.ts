// Mirrors backend Pydantic models (camelCase from _CamelModel alias_generator)

export interface BridgeState {
  pid: number;
  workspace: string;
  expiresAt: string;  // ISO-8601 UTC
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
