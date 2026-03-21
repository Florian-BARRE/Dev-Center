// ====== Code Summary ======
// /monitoring — full project status: git, agent, bridge, watchdog state.

import { sidecar } from "../client/sidecar";

/**
 * Handle the /monitoring command — full project status snapshot.
 *
 * @param ctx - Command context containing the Telegram group ID.
 * @returns Text response for the group.
 */
export async function monitoringHandler(ctx: { groupId: string }): Promise<{ text: string }> {
  // 1. Fetch current state
  let project;
  try {
    project = await sidecar.getProject(ctx.groupId);
  } catch {
    return { text: "No project found for this group." };
  }

  // 2. Build monitoring output
  const bridge = project.bridge;
  const expiresAt = bridge
    ? new Date(bridge.expiresAt).toISOString()
    : "—";

  return {
    text: [
      `📊 **Monitoring — ${project.projectId}**`,
      ``,
      `**Bridge**`,
      bridge
        ? [`PID: ${bridge.pid}`, `Workspace: \`${bridge.workspace}\``, `Expires: ${expiresAt}`].join("\n")
        : "Not active",
      ``,
      `**Agent**`,
      project.modelOverride
        ? `${project.modelOverride.provider}/${project.modelOverride.model}`
        : "Default model",
    ].join("\n"),
  };
}
