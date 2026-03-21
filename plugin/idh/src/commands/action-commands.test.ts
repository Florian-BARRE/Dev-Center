import { describe, it, expect, vi, beforeEach } from "vitest";
import * as sidecarModule from "../client/sidecar";
import { bridgeHandler } from "./bridge";
import { agentHandler } from "./agent";
import type { Project } from "../types/idh";

const fakeProject: Project = {
  groupId: "-100111",
  projectId: "my-repo",
  repoUrl: "git@github.com:user/my-repo.git",
  bridge: { pid: 1234, workspace: "/workspaces/my-repo", expiresAt: "2026-03-22T10:00:00Z" },
  modelOverride: { provider: "anthropic", model: "claude-opus-4-6" },
};

describe("bridgeHandler", () => {
  beforeEach(() => {
    vi.spyOn(sidecarModule.sidecar, "getProject").mockResolvedValue(fakeProject);
    vi.spyOn(sidecarModule.sidecar, "getBridgeStatus").mockResolvedValue(fakeProject.bridge);
    vi.spyOn(sidecarModule.sidecar, "startBridge").mockResolvedValue();
    vi.spyOn(sidecarModule.sidecar, "stopBridge").mockResolvedValue();
    vi.spyOn(sidecarModule.sidecar, "renewBridge").mockResolvedValue();
  });

  it("shows bridge status when no callbackData", async () => {
    const result = await bridgeHandler({ groupId: "-100111" });
    expect(result.text).toContain("1234");
  });

  it("calls startBridge on bridge:start callback", async () => {
    await bridgeHandler({ groupId: "-100111", callbackData: "bridge:start" });
    expect(sidecarModule.sidecar.startBridge).toHaveBeenCalledWith("-100111");
  });

  it("calls stopBridge on bridge:stop callback", async () => {
    await bridgeHandler({ groupId: "-100111", callbackData: "bridge:stop" });
    expect(sidecarModule.sidecar.stopBridge).toHaveBeenCalledWith("-100111");
  });

  it("calls renewBridge on bridge:renew callback", async () => {
    await bridgeHandler({ groupId: "-100111", callbackData: "bridge:renew" });
    expect(sidecarModule.sidecar.renewBridge).toHaveBeenCalledWith("-100111");
  });
});

describe("agentHandler", () => {
  beforeEach(() => {
    vi.spyOn(sidecarModule.sidecar, "getProject").mockResolvedValue(fakeProject);
    vi.spyOn(sidecarModule.sidecar, "updateModel").mockResolvedValue();
  });

  it("shows current model when no callbackData", async () => {
    const result = await agentHandler({ groupId: "-100111" });
    expect(result.text).toContain("anthropic/claude-opus-4-6");
  });

  it("calls updateModel on agent:model callback", async () => {
    await agentHandler({ groupId: "-100111", callbackData: "agent:model:anthropic:claude-sonnet-4-6" });
    expect(sidecarModule.sidecar.updateModel).toHaveBeenCalledWith("-100111", "anthropic", "claude-sonnet-4-6");
  });
});
