// ====== Code Summary ======
// before_model_resolve hook — overrides provider/model per Telegram group.
// Uses the StateReader cache to avoid per-message API calls.

import { extractGroupId } from "../utils/helpers";
import type { StateReader } from "../state/state-reader";

interface ModelResolveCtx {
  sessionKey: string;
  provider: string;
  model: string;
}

/**
 * Build the before_model_resolve hook bound to the given state reader.
 *
 * Returns a hook function ready to pass to api.registerHook().
 */
export function buildModelResolverHook(reader: StateReader) {
  return async (ctx: ModelResolveCtx): Promise<void> => {
    // 1. Extract the Telegram group ID from the session key
    const groupId = extractGroupId(ctx.sessionKey);
    if (!groupId) return;

    // 2. Look up the project in the cache (auto-refreshes if stale)
    const cache = await reader.getOrRefresh();
    const project = cache.get(groupId);

    // 3. Apply model override if configured
    if (project?.modelOverride) {
      ctx.provider = project.modelOverride.provider;
      ctx.model = project.modelOverride.model;
    }
  };
}
