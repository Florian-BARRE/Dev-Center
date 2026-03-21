// ====== Code Summary ======
// Pure utility functions shared across commands and hooks.

import type { Project } from "../types/idh";

/**
 * Extract the bare Telegram groupId from an OpenClaw session key.
 *
 * Session key format: "agent:<agentId>:telegram:group:<groupId>"
 * Returns empty string if the key does not match the expected format.
 */
export function extractGroupId(sessionKey: string): string {
  // 1. Match the group segment at the end of the session key
  const match = sessionKey.match(/group:(-?\d+)$/);
  return match ? match[1] : "";
}

/**
 * Build a minimal common context string to inject as a system prompt prefix.
 *
 * Provides Claude with project identity and workspace path so it has
 * basic orientation without requiring a full template file fetch.
 */
export function renderCommonContext(project: Project): string {
  // 1. Build a concise context block from project fields
  return [
    `You are working on project **${project.projectId}**.`,
    `- Repository: \`${project.repoUrl}\``,
    `- Workspace: \`/workspaces/${project.projectId}\``,
    ``,
    `Read \`SESSION_MEMORY.md\` at the start of every session — it contains your working memory.`,
  ].join("\n");
}
