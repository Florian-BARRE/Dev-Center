import { apiFetch } from './client';
import type { FileContentResponse, FileWriteResponse, TelegramPromptResponse, ModelResponse, TelegramModelResponse, ContextSizeResponse, ScheduleConfig, GlobalDefaults } from './types';

// Global settings
export function getGlobalCodingRules(): Promise<FileContentResponse> {
  return apiFetch('/api/v1/settings/global/coding-rules', { method: 'GET' });
}

export function putGlobalCodingRules(content: string): Promise<FileWriteResponse> {
  return apiFetch('/api/v1/settings/global/coding-rules', {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export function getGlobalCommonContext(): Promise<FileContentResponse> {
  return apiFetch('/api/v1/settings/global/common-context', { method: 'GET' });
}

export function putGlobalCommonContext(content: string): Promise<FileWriteResponse> {
  return apiFetch('/api/v1/settings/global/common-context', {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

// Per-project settings
export function getClaudeMd(groupId: string): Promise<FileContentResponse> {
  return apiFetch(`/api/v1/settings/${groupId}/claude-md`, { method: 'GET' });
}

export function putClaudeMd(groupId: string, content: string): Promise<FileWriteResponse> {
  return apiFetch(`/api/v1/settings/${groupId}/claude-md`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export function getTelegramPrompt(groupId: string): Promise<TelegramPromptResponse> {
  return apiFetch(`/api/v1/settings/${groupId}/telegram-prompt`, { method: 'GET' });
}

export function putTelegramPrompt(_groupId: string, agentId: string, systemPrompt: string): Promise<FileWriteResponse> {
  return apiFetch(`/api/v1/settings/telegram/prompt/${agentId}`, {
    method: 'PUT',
    body: JSON.stringify({ systemPrompt }),
  });
}

export function getModel(groupId: string): Promise<ModelResponse> {
  return apiFetch(`/api/v1/settings/${groupId}/model`, { method: 'GET' });
}

export function putModel(groupId: string, provider: string, model: string): Promise<FileWriteResponse> {
  return apiFetch(`/api/v1/settings/${groupId}/model`, {
    method: 'PUT',
    body: JSON.stringify({ provider, model }),
  });
}

export function getTelegramModel(groupId: string): Promise<TelegramModelResponse> {
  return apiFetch(`/api/v1/settings/${groupId}/telegram-model`, { method: 'GET' });
}

export function putTelegramModel(groupId: string, provider: string, model: string): Promise<FileWriteResponse> {
  return apiFetch(`/api/v1/settings/${groupId}/telegram-model`, {
    method: 'PUT',
    body: JSON.stringify({ provider, model }),
  });
}

// ── Per-project schedule + context size ──────────────────────────────────

export function getContextSize(groupId: string): Promise<ContextSizeResponse> {
  return apiFetch(`/api/v1/settings/${groupId}/context-size`, { method: 'GET' });
}

export function getProjectSchedule(groupId: string): Promise<ScheduleConfig> {
  return apiFetch(`/api/v1/settings/${groupId}/schedule`, { method: 'GET' });
}

export function putProjectSchedule(groupId: string, config: ScheduleConfig | null): Promise<FileWriteResponse> {
  return apiFetch(`/api/v1/settings/${groupId}/schedule`, {
    method: 'PUT',
    body: JSON.stringify(config),   // null body = revert to inherit global
  });
}

// ── Global defaults + scheduling ─────────────────────────────────────────

export function getGlobalDefaults(): Promise<GlobalDefaults> {
  return apiFetch('/api/v1/settings/global/defaults', { method: 'GET' });
}

export function putGlobalDefaults(defaults: GlobalDefaults): Promise<FileWriteResponse> {
  return apiFetch('/api/v1/settings/global/defaults', {
    method: 'PUT',
    body: JSON.stringify(defaults),
  });
}

export function getGlobalScheduling(): Promise<ScheduleConfig> {
  return apiFetch('/api/v1/settings/global/scheduling', { method: 'GET' });
}

export function putGlobalScheduling(config: ScheduleConfig): Promise<FileWriteResponse> {
  return apiFetch('/api/v1/settings/global/scheduling', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}
