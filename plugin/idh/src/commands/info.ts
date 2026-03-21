// ====== Code Summary ======
// /info — shows detailed project information.

import { sidecar } from "../client/sidecar";

/**
 * Handle the /info command — show detailed project information.
 *
 * @param ctx - Command context containing the Telegram group ID.
 * @returns Text response for the group.
 */
export async function infoHandler(ctx: { groupId: string }): Promise<{ text: string }> {
  // 1. Fetch project details
  let project;
  try {
    project = await sidecar.getProject(ctx.groupId);
  } catch {
    return { text: "No project found for this group." };
  }

  // 2. Format detailed info
  return {
    text: [
      `ℹ️ **Project Info**`,
      `ID: \`${project.projectId}\``,
      `Group: \`${project.groupId}\``,
      `Repo: \`${project.repoUrl}\``,
      `Model: ${project.modelOverride ? `${project.modelOverride.provider}/${project.modelOverride.model}` : "default"}`,
      `Bridge PID: ${project.bridge?.pid ?? "none"}`,
    ].join("\n"),
  };
}
