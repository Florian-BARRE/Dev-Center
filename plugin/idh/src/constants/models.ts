// ====== Code Summary ======
// Shared AI model definitions used across plugin commands.

/** A single available coding model option. */
export interface ModelOption {
  provider: string;
  model: string;
  label: string;
}

/**
 * Available AI model options shown in the model selection UI.
 * Used by /add_project wizard and /agent command.
 */
export const MODELS: ModelOption[] = [
  { provider: "anthropic", model: "claude-opus-4-6",   label: "Claude Opus 4.6" },
  { provider: "anthropic", model: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { provider: "anthropic", model: "claude-haiku-4-5",  label: "Claude Haiku 4.5" },
];
