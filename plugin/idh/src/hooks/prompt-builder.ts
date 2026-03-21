// ====== Code Summary ======
// before_prompt_build hook — prepends rendered project context to the system prompt.

import { extractGroupId, renderCommonContext } from "../utils/helpers";
import type { StateReader } from "../state/state-reader";

interface PromptBuildCtx {
  sessionKey: string;
  systemPrompt: string;
}

/**
 * Build the before_prompt_build hook bound to the given state reader.
 */
export function buildPromptBuilderHook(reader: StateReader) {
  return async (ctx: PromptBuildCtx): Promise<void> => {
    // 1. Extract group ID from session key
    const groupId = extractGroupId(ctx.sessionKey);
    if (!groupId) return;

    // 2. Look up project state
    const cache = await reader.getOrRefresh();
    const project = cache.get(groupId);
    if (!project) return;

    // 3. Prepend rendered context — existing prompt follows after two newlines
    ctx.systemPrompt = renderCommonContext(project) + "\n\n" + (ctx.systemPrompt ?? "");
  };
}
