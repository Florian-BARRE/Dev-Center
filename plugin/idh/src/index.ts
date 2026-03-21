// ====== Code Summary ======
// IDH Projects OpenClaw plugin — entry point.
// Wires all commands, hooks, and the inbound webhook route.

// NOTE: The OpenClaw SDK type definitions do not model the full runtime API surface:
// command contexts lack groupId, hook event shapes differ, and sendMessage/registerHttpRoute
// use types that do not match the actual runtime signatures. Explicit `any` is used for `api`
// to reflect this type gap — the runtime contract is correct; the types are incomplete.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApi = any;

import { menuHandler }        from "./commands/menu";
import { infoHandler }        from "./commands/info";
import { monitoringHandler }  from "./commands/monitoring";
import { bridgeHandler }      from "./commands/bridge";
import { agentHandler }       from "./commands/agent";

import { buildAddProjectCommand } from "./commands/add-project";
import { wizardEngine }           from "./wizard/engine";
import { sidecar }                from "./client/sidecar";

import { buildModelResolverHook } from "./hooks/model-resolver";
import { buildPromptBuilderHook } from "./hooks/prompt-builder";
import { stateReader }            from "./state/state-reader";

import { buildWebhookHandler } from "./client/webhook";
import type { WebhookEvent }   from "./types/idh";

const WEBHOOK_SECRET = process.env.IDH_WEBHOOK_SECRET ?? "";

const plugin = {
  id: "idh-projects",
  name: "IDH Projects",

  register(api: AnyApi) {
    // ── Commands ──────────────────────────────────────────────────────────

    api.registerCommand({
      name: "menu",
      description: "IDH home — project status + quick actions",
      handler: menuHandler,
    });

    api.registerCommand({
      name: "info",
      description: "Detailed project info",
      handler: infoHandler,
    });

    api.registerCommand({
      name: "monitoring",
      description: "Full project status: git, bridge, agents",
      handler: monitoringHandler,
    });

    api.registerCommand({
      name: "bridge",
      description: "Claude Code bridge — start / stop / renew",
      handler: bridgeHandler,
    });

    api.registerCommand({
      name: "agent",
      description: "Switch coding model (session preserved)",
      handler: agentHandler,
    });

    // /add_project wired with real api.sendMessage
    const addProject = buildAddProjectCommand(
      wizardEngine,
      (gId, url, prov, model) => sidecar.createProject(gId, url, prov, model),
      async (gId, text) => {
        // NOTE: The OpenClaw SDK api parameter does not expose sendMessage in its
        // TypeScript type definition, but the runtime object includes it.
        // Cast to `never` to access the method until the SDK type is updated.
        await (api as never as { sendMessage(groupId: string, text: string): Promise<void> })
          .sendMessage(gId, text);
      },
    );

    api.registerCommand({
      name: "add_project",
      description: "Create a new IDH project (wizard)",
      handler: addProject as never,
    });

    // ── Hooks ─────────────────────────────────────────────────────────────

    api.registerHook("before_model_resolve", buildModelResolverHook(stateReader));
    api.registerHook("before_prompt_build", buildPromptBuilderHook(stateReader));

    // ── Inbound webhook ───────────────────────────────────────────────────

    const onEvent = async (event: WebhookEvent): Promise<void> => {
      const { type, groupId, minutesRemaining, bridgeUrl } = event;
      // NOTE: The OpenClaw SDK api parameter does not expose sendMessage in its
      // TypeScript type definition, but the runtime object includes it.
      // Cast to `never` to access the method until the SDK type is updated.
      const sendMsg = (api as never as { sendMessage(g: string, t: string): Promise<void> }).sendMessage.bind(api);

      if (type === "bridge_warning") {
        await sendMsg(groupId, `⚠️ Bridge expires in ${minutesRemaining} min. Use /bridge renew to extend.`);
      } else if (type === "bridge_renewed") {
        await sendMsg(groupId, `🔄 Bridge renewed!\n${bridgeUrl ? `URL: ${bridgeUrl}` : ""}`);
      } else if (type === "bridge_stopped") {
        await sendMsg(groupId, `⭕ Bridge stopped.`);
      }
    };

    api.registerHttpRoute({
      path: "/api/plugins/idh/events",
      auth: "plugin",
      match: "prefix",
      handler: buildWebhookHandler(WEBHOOK_SECRET, onEvent),
    });
  },
};

export default plugin;
