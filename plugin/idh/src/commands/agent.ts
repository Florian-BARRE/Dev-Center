// ====== Code Summary ======
// /agent — inline model switch wizard. Updates modelOverride in state.

import { sidecar } from "../client/sidecar";
import { MODELS } from "../constants/models";

/**
 * Handle the /agent command — show current model and allow switching.
 *
 * @param ctx - Command context with group ID and optional callback data.
 * @returns Text response for the group.
 */
export async function agentHandler(ctx: { groupId: string; callbackData?: string }): Promise<{ text: string }> {
  const { groupId, callbackData } = ctx;

  // 1. Handle model selection callback
  if (callbackData?.startsWith("agent:model:")) {
    const [, , provider, model] = callbackData.split(":");
    try {
      await sidecar.updateModel(groupId, provider, model);
      return { text: `✅ Model updated to **${provider}/${model}**.\nNext message will use the new model.` };
    } catch (err) {
      return { text: `❌ Failed to update model: ${String(err)}` };
    }
  }

  // 2. Default: show current model + selection options
  let project;
  try {
    project = await sidecar.getProject(groupId);
  } catch {
    return { text: "No project found for this group." };
  }

  const current = project.modelOverride
    ? `${project.modelOverride.provider}/${project.modelOverride.model}`
    : "default";

  const options = MODELS.map((m, i) => `${i + 1}. ${m.label} — /agent:model:${m.provider}:${m.model}`).join("\n");

  return {
    text: [
      `🤖 **Current model:** ${current}`,
      ``,
      `Select a new model:`,
      options,
    ].join("\n"),
  };
}
