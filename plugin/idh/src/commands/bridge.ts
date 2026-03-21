// ====== Code Summary ======
// /bridge — shows bridge status with Start / Stop / Renew actions.

import { sidecar } from "../client/sidecar";

/**
 * Handle the /bridge command — show or control the coding bridge.
 *
 * @param ctx - Command context with group ID and optional callback data.
 * @returns Text response for the group.
 */
export async function bridgeHandler(ctx: { groupId: string; callbackData?: string }): Promise<{ text: string }> {
  const { groupId, callbackData } = ctx;

  // 1. Handle action callbacks
  if (callbackData === "bridge:start") {
    try {
      await sidecar.startBridge(groupId);
      return { text: "✅ Bridge starting… it may take a few seconds to come online." };
    } catch (err) {
      return { text: `❌ Failed to start bridge: ${String(err)}` };
    }
  }

  if (callbackData === "bridge:stop") {
    try {
      await sidecar.stopBridge(groupId);
      return { text: "⭕ Bridge stopped." };
    } catch (err) {
      return { text: `❌ Failed to stop bridge: ${String(err)}` };
    }
  }

  if (callbackData === "bridge:renew") {
    try {
      await sidecar.renewBridge(groupId);
      return { text: "🔄 Bridge renewal started — session memory is being saved." };
    } catch (err) {
      return { text: `❌ Failed to renew bridge: ${String(err)}` };
    }
  }

  // 2. Default: show current bridge status
  let bridge;
  try {
    bridge = await sidecar.getBridgeStatus(groupId);
  } catch {
    return { text: "No project found for this group." };
  }

  if (!bridge) {
    return { text: "⭕ No active bridge.\n\nReply /bridge start to start one." };
  }

  const expiresAt = new Date(bridge.expiresAt);
  return {
    text: [
      `✅ **Bridge Active**`,
      `PID: ${bridge.pid}`,
      `Expires: ${expiresAt.toISOString()}`,
      ``,
      `Actions: /bridge stop · /bridge renew`,
    ].join("\n"),
  };
}
