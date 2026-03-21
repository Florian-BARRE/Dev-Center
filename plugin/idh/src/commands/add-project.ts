// ====== Code Summary ======
// /add_project wizard — 3 steps: repo URL → model selection → confirmation.
// Uses WizardEngine for state. Calls sidecar.createProject on confirm.

import type { WizardEngine } from "../wizard/engine";

/** Available model options shown in the model selection step. */
const MODELS = [
  { provider: "anthropic", model: "claude-opus-4-6",   label: "Claude Opus 4.6" },
  { provider: "anthropic", model: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { provider: "anthropic", model: "claude-haiku-4-5",  label: "Claude Haiku 4.5" },
];

type CreateProjectFn = (groupId: string, repoUrl: string, provider: string, model: string) => Promise<unknown>;
type SendMessageFn = (groupId: string, text: string) => Promise<void>;

interface CommandCtx {
  groupId: string;
  text?: string;
  callbackData?: string;
}

/**
 * Build the /add_project command handler, injecting dependencies for testability.
 *
 * @param engine - Wizard engine instance.
 * @param createProject - Async function to create the project via sidecar.
 * @param sendMessage - Async function to send a Telegram message to the group.
 */
export function buildAddProjectCommand(
  engine: WizardEngine,
  createProject: CreateProjectFn,
  sendMessage: SendMessageFn,
) {
  return async (ctx: CommandCtx): Promise<{ text: string } | void> => {
    const { groupId } = ctx;

    // 1. If wizard not active, start it and show step 1
    if (!engine.isActive(groupId)) {
      engine.start(groupId, [
        // Step 0: ask for repo URL
        async () => { await sendMessage(groupId, "Step 1/3 — Enter the Git repo URL (SSH or HTTPS):"); },
        // Step 1: show model selection
        async () => {
          const options = MODELS.map((m, i) => `${i + 1}. ${m.label}`).join("\n");
          await sendMessage(groupId, `Step 2/3 — Choose the coding model:\n${options}\n\nReply with the number.`);
        },
        // Step 2: show confirmation
        async () => {
          const data = engine.getData(groupId);
          await sendMessage(groupId, `Step 3/3 — Confirm:\nRepo: ${data.repoUrl}\nModel: ${data.model}\n\nReply "confirm" or "cancel".`);
        },
      ], {});
      await engine.currentStep(groupId)(groupId, {});
      return;
    }

    // 2. Handle cancel
    if (ctx.text === "cancel" || ctx.callbackData === "cancel") {
      engine.cancel(groupId);
      return { text: "❌ Project creation cancelled." };
    }

    const stepIndex = engine.currentStepIndex(groupId);

    // 3. Step 0: collect repo URL
    if (stepIndex === 0) {
      const repoUrl = ctx.text?.trim();
      if (!repoUrl) {
        await sendMessage(groupId, "Please enter a valid repo URL.");
        return;
      }
      engine.advance(groupId, { repoUrl });
      await engine.currentStep(groupId)(groupId, engine.getData(groupId));
      return;
    }

    // 4. Step 1: collect model selection — accepts callbackData "model:provider:model"
    if (stepIndex === 1) {
      let selected = MODELS.find(
        (m) => ctx.callbackData === `model:${m.provider}:${m.model}`
      );
      if (!selected) {
        const idx = parseInt(ctx.text ?? "0", 10) - 1;
        selected = MODELS[idx];
      }
      if (!selected) {
        await sendMessage(groupId, `Invalid selection. Enter 1–${MODELS.length} or tap a button.`);
        return;
      }
      engine.advance(groupId, { provider: selected.provider, model: selected.model });
      await engine.currentStep(groupId)(groupId, engine.getData(groupId));
      return;
    }

    // 5. Step 2: confirmation
    if (stepIndex === 2) {
      if (ctx.text !== "confirm" && ctx.callbackData !== "confirm") {
        await sendMessage(groupId, 'Reply "confirm" to proceed or "cancel" to abort.');
        return;
      }
      const data = engine.getData(groupId);
      engine.advance(groupId, {});

      try {
        await createProject(
          groupId,
          data.repoUrl as string,
          data.provider as string,
          data.model as string,
        );
        await sendMessage(groupId, `✅ Project **${(data.repoUrl as string).split("/").pop()?.replace(".git", "")}** created! Bridge is starting.`);
      } catch (err) {
        await sendMessage(groupId, `❌ Error creating project: ${String(err)}`);
      }
    }
  };
}

// Default export wired to live dependencies
import { wizardEngine } from "../wizard/engine";
import { sidecar } from "../client/sidecar";

export async function addProjectHandler(ctx: CommandCtx): Promise<{ text: string } | void> {
  return buildAddProjectCommand(
    wizardEngine,
    (gId, url, prov, model) => sidecar.createProject(gId, url, prov, model),
    async (gId, text) => { void gId; void text; }, // replaced with api.sendMessage in index.ts
  )(ctx);
}
