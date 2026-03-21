import { describe, it, expect, vi, beforeEach } from "vitest";
import * as sidecarModule from "../client/sidecar";
import { menuHandler } from "./menu";
import { infoHandler } from "./info";
import { monitoringHandler } from "./monitoring";
import type { Project } from "../types/idh";

const fakeProject: Project = {
  groupId: "-100111",
  projectId: "my-repo",
  repoUrl: "git@github.com:user/my-repo.git",
  bridge: { pid: 1234, workspace: "/workspaces/my-repo", expiresAt: "2026-03-22T10:00:00Z" },
  modelOverride: { provider: "anthropic", model: "claude-opus-4-6" },
};

describe("menuHandler", () => {
  beforeEach(() => {
    vi.spyOn(sidecarModule.sidecar, "getProject").mockResolvedValue(fakeProject);
  });

  it("includes project name in response", async () => {
    const result = await menuHandler({ groupId: "-100111" });
    expect(result.text).toContain("my-repo");
  });

  it("returns 'No project found' when sidecar throws", async () => {
    vi.spyOn(sidecarModule.sidecar, "getProject").mockRejectedValue(new Error("404"));
    const result = await menuHandler({ groupId: "-999" });
    expect(result.text).toContain("No project");
  });
});

describe("infoHandler", () => {
  beforeEach(() => {
    vi.spyOn(sidecarModule.sidecar, "getProject").mockResolvedValue(fakeProject);
  });

  it("includes projectId, groupId, and repoUrl", async () => {
    const result = await infoHandler({ groupId: "-100111" });
    expect(result.text).toContain("my-repo");
    expect(result.text).toContain("-100111");
    expect(result.text).toContain("git@github.com");
  });
});

describe("monitoringHandler", () => {
  beforeEach(() => {
    vi.spyOn(sidecarModule.sidecar, "getProject").mockResolvedValue(fakeProject);
  });

  it("includes bridge PID when bridge is active", async () => {
    const result = await monitoringHandler({ groupId: "-100111" });
    expect(result.text).toContain("1234");
  });

  it("shows 'Not active' when bridge is null", async () => {
    vi.spyOn(sidecarModule.sidecar, "getProject").mockResolvedValue({ ...fakeProject, bridge: null });
    const result = await monitoringHandler({ groupId: "-100111" });
    expect(result.text).toContain("Not active");
  });
});
