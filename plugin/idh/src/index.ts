// ====== Code Summary ======
// IDH Projects OpenClaw plugin — entry point.
// Registers a stub /idh_ping command. Full commands added in Plan 3.

import type { OpenClawPluginDefinition } from "openclaw/plugin-sdk";

const plugin: OpenClawPluginDefinition = {
  id: "idh-projects",
  name: "IDH Projects",
  register(api) {
    // Stub command confirms the plugin loads without errors.
    // All production commands registered in Plan 3.
    api.registerCommand({
      name: "idh_ping",
      description: "IDH plugin health check",
      handler: async () => ({ text: "IDH plugin loaded (ok)" }),
    });
  },
};

export default plugin;
