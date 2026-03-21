// ====== Code Summary ======
// /menu — shows the project status summary with quick action buttons.

import { sidecar } from "../client/sidecar";

/**
 * Handle the /menu command — show project status and quick action list.
 *
 * @param ctx - Command context containing the Telegram group ID.
 * @returns Text response for the group.
 */
export async function menuHandler(ctx: { groupId: string }): Promise<{ text: string }> {
  // 1. Fetch current project state for this group
  let project;
  try {
    project = await sidecar.getProject(ctx.groupId);
  } catch {
    return { text: "No project found for this group. Use /add_project to create one." };
  }

  // 2. Build status summary
  const bridgeStatus = project.bridge
    ? `✅ Active — expires <t:${Math.floor(new Date(project.bridge.expiresAt).getTime() / 1000)}:R>`
    : "⭕ Idle";
  const model = project.modelOverride
    ? `${project.modelOverride.provider}/${project.modelOverride.model}`
    : "default";

  return {
    text: [
      `📁 **${project.projectId}**`,
      `Bridge: ${bridgeStatus}`,
      `Model: ${model}`,
      ``,
      `Commands: /bridge · /agent · /monitoring · /info`,
    ].join("\n"),
  };
}
