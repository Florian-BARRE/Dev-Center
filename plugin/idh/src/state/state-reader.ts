// ====== Code Summary ======
// Read-only project state cache. Fetches from sidecar and serves
// cached results to hooks (before_model_resolve, before_prompt_build).
// Avoids per-message API calls while staying reasonably fresh.

import type { Project } from "../types/idh";

type FetchProjects = () => Promise<Project[]>;

export class StateReader {
  private _cache: Map<string, Project> = new Map();
  private _lastFetchedAt = 0;

  /**
   * Read-only cached view of the idh-app project state.
   *
   * @param fetchProjects - Async function that fetches the full project list.
   * @param ttlMs - Cache TTL in milliseconds (default: 30 000 ms).
   */
  constructor(
    private readonly fetchProjects: FetchProjects,
    private readonly ttlMs: number = 30_000,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /** Force a cache refresh from the sidecar. */
  async refresh(): Promise<void> {
    // 1. Fetch fresh project list from idh-app
    const projects = await this.fetchProjects();

    // 2. Rebuild the groupId → Project map
    this._cache = new Map(projects.map((p) => [p.groupId, p]));
    this._lastFetchedAt = Date.now();
  }

  /**
   * Refresh the cache if the TTL has expired, then return it.
   * Used by hooks — automatically keeps data fresh without blocking.
   */
  async getOrRefresh(): Promise<Map<string, Project>> {
    // 1. Re-fetch if cache is stale
    if (Date.now() - this._lastFetchedAt > this.ttlMs) {
      await this.refresh();
    }
    return this._cache;
  }

  /** Synchronous lookup by Telegram groupId (uses current cache). */
  getByGroupId(groupId: string): Project | undefined {
    return this._cache.get(groupId);
  }
}
