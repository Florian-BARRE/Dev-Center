// ====== Code Summary ======
// HTTP client wrapping all idh-app sidecar API calls.
// All mutations (create project, start/stop/renew bridge, switch model)
// go through this client. State reads use StateReader (cached layer above this).

import type { Project, BridgeState } from "../types/idh";

export class SidecarClient {
  /**
   * HTTP client for all idh-app API calls.
   *
   * @param baseUrl - Base URL of the idh-app service (e.g. http://idh-app:8000).
   */
  constructor(private readonly baseUrl: string) {}

  // ── Private helpers ──────────────────────────────────────────────────────

  private async _request<T>(method: string, path: string, body?: unknown): Promise<T> {
    // 1. Build request options
    const opts: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }

    // 2. Execute fetch and handle HTTP errors
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, opts);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`idh-app ${method} ${path} → ${res.status}: ${text}`);
    }

    // 3. Parse and return JSON
    return res.json() as Promise<T>;
  }

  // ── Projects ─────────────────────────────────────────────────────────────

  /** List all registered projects. */
  async getProjects(): Promise<Project[]> {
    const data = await this._request<{ projects: Project[] }>("GET", "/projects");
    return data.projects;
  }

  /** Get a single project by Telegram group ID. */
  async getProject(groupId: string): Promise<Project> {
    return this._request<Project>("GET", `/projects/${groupId}`);
  }

  /**
   * Create a new project via the plugin wizard.
   *
   * @param groupId - Telegram group ID.
   * @param repoUrl - Git repository SSH/HTTPS URL.
   * @param provider - AI provider slug (e.g. "anthropic").
   * @param model - Model identifier (e.g. "claude-opus-4-6").
   */
  async createProject(
    groupId: string,
    repoUrl: string,
    provider: string,
    model: string,
  ): Promise<Project> {
    return this._request<Project>("POST", "/projects/", {
      groupId,
      repoUrl,
      provider,
      model,
    });
  }

  // ── Bridge ────────────────────────────────────────────────────────────────

  /** Get bridge status for a project. */
  async getBridgeStatus(groupId: string): Promise<BridgeState | null> {
    // Route: GET /bridge/{group_id}/status  (spec §4.1)
    const data = await this._request<{ groupId: string; bridge: BridgeState | null }>(
      "GET",
      `/bridge/${groupId}/status`,
    );
    return data.bridge;
  }

  /** Start the coding bridge for a project. */
  async startBridge(groupId: string): Promise<void> {
    await this._request("POST", `/bridge/${groupId}/start`);
  }

  /** Stop the active bridge for a project. */
  async stopBridge(groupId: string): Promise<void> {
    // Route: POST /bridge/{group_id}/stop  (spec §4.1)
    await this._request("POST", `/bridge/${groupId}/stop`);
  }

  /** Renew (auto-summary + kill + respawn) the bridge. */
  async renewBridge(groupId: string): Promise<void> {
    await this._request("POST", `/bridge/${groupId}/renew`);
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  /** Switch the coding agent model for a project. */
  async updateModel(groupId: string, provider: string, model: string): Promise<void> {
    await this._request("PUT", `/settings/${groupId}/model`, { provider, model });
  }
}

/** Singleton sidecar client — reads IDH_APP_URL from environment. */
export const sidecar = new SidecarClient(
  process.env.IDH_APP_URL ?? "http://idh-app:8000",
);
