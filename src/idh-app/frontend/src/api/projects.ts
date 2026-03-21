import { apiFetch } from './client';
import type { Project, ProjectListResponse, CreateProjectRequest } from './types';

export function listProjects(): Promise<ProjectListResponse> {
  return apiFetch('/api/v1/projects', { method: 'GET' });
}

export function getProject(groupId: string): Promise<Project> {
  return apiFetch(`/api/v1/projects/${groupId}`, { method: 'GET' });
}

export function createProject(body: CreateProjectRequest): Promise<Project> {
  return apiFetch('/api/v1/projects/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteProject(groupId: string): Promise<Project> {
  return apiFetch(`/api/v1/projects/${groupId}`, { method: 'DELETE' });
}
