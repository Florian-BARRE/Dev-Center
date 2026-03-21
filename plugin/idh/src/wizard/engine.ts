// ====== Code Summary ======
// Generic multi-step wizard state machine.
// State is stored in-process (Map<groupId, WizardState>).
// Wizard flows are ephemeral: they do not survive a plugin restart.

export type WizardStepHandler = (groupId: string, data: Record<string, unknown>) => Promise<void>;

interface WizardState {
  steps: WizardStepHandler[];
  currentIndex: number;
  data: Record<string, unknown>;
}

/**
 * Generic multi-step wizard state machine keyed by Telegram groupId.
 *
 * Commands start a wizard via `start()`, collect input step-by-step via
 * `advance()`, and may navigate backward with `back()` or abort with `cancel()`.
 * The singleton `wizardEngine` is shared across all commands.
 */
export class WizardEngine {
  private _state: Map<string, WizardState> = new Map();

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Start a new wizard for a group. Replaces any existing wizard for the same group.
   *
   * @param groupId - Telegram group ID.
   * @param steps - Ordered list of step handler functions.
   * @param initialData - Initial wizard data (accumulates across steps).
   */
  start(groupId: string, steps: WizardStepHandler[], initialData: Record<string, unknown>): void {
    // 1. Register wizard state for this group
    this._state.set(groupId, { steps, currentIndex: 0, data: { ...initialData } });
  }

  /**
   * Advance the wizard to the next step, merging stepData into accumulated data.
   * If already on the last step, the wizard is completed and cleared.
   *
   * @param groupId - Telegram group ID.
   * @param stepData - Data collected by the current step to merge in.
   */
  advance(groupId: string, stepData: Record<string, unknown>): void {
    const state = this._require(groupId);

    // 1. Merge step data into wizard accumulator
    Object.assign(state.data, stepData);

    // 2. Advance or complete
    if (state.currentIndex >= state.steps.length - 1) {
      this._state.delete(groupId);
    } else {
      state.currentIndex++;
    }
  }

  /**
   * Move back to the previous step. No-op if already on step 0.
   *
   * @param groupId - Telegram group ID.
   */
  back(groupId: string): void {
    const state = this._require(groupId);
    // 1. Decrement index, floor at 0
    if (state.currentIndex > 0) {
      state.currentIndex--;
    }
  }

  /**
   * Cancel and clear the wizard for a group.
   *
   * @param groupId - Telegram group ID.
   */
  cancel(groupId: string): void {
    this._state.delete(groupId);
  }

  // ── State queries ──────────────────────────────────────────────────────────

  /** Return true if a wizard is currently active for the given group. */
  isActive(groupId: string): boolean {
    return this._state.has(groupId);
  }

  /** Return the current step index (0-based) for an active wizard. */
  currentStepIndex(groupId: string): number {
    return this._require(groupId).currentIndex;
  }

  /** Return the accumulated wizard data for an active wizard. */
  getData(groupId: string): Record<string, unknown> {
    return this._require(groupId).data;
  }

  /** Return the current step handler for an active wizard. */
  currentStep(groupId: string): WizardStepHandler {
    const state = this._require(groupId);
    return state.steps[state.currentIndex];
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _require(groupId: string): WizardState {
    const state = this._state.get(groupId);
    if (!state) throw new Error(`No active wizard for group ${groupId}`);
    return state;
  }
}

/** Singleton wizard engine shared across all commands. */
export const wizardEngine = new WizardEngine();
