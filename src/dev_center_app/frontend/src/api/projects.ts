import { apiFetch } from './client';
import type {
  ProjectListResponse, Project,
  CreateProjectRequest, UpdateProjectRequest,
} from './types';

const BASE = '/api';

export async function listProjects(): Promise<Project[]> {
  const res = await apiFetch<ProjectListResponse>(`${BASE}/projects`);
  return res.projects;
}

export async function getProject(id: string): Promise<Project> {
  return apiFetch<Project>(`${BASE}/projects/${id}`);
}

export async function createProject(body: CreateProjectRequest): Promise<Project> {
  return apiFetch<Project>(`${BASE}/projects`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateProject(id: string, body: UpdateProjectRequest): Promise<Project> {
  return apiFetch<Project>(`${BASE}/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await apiFetch<void>(`${BASE}/projects/${id}`, { method: 'DELETE' });
}

