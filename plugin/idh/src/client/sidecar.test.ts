import { describe, it, expect, vi, beforeEach } from "vitest";
import { SidecarClient } from "./sidecar";

const mockProject = {
  groupId: "-100111",
  projectId: "repo",
  repoUrl: "git@github.com:u/repo.git",
  bridge: null,
  modelOverride: null,
};

describe("SidecarClient", () => {
  let client: SidecarClient;

  beforeEach(() => {
    client = new SidecarClient("http://idh-app:8000");
  });

  it("getProjects calls GET /api/v1/projects", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ projects: [mockProject] }),
    } as Response);

    const result = await client.getProjects();
    expect(result).toHaveLength(1);
    expect(result[0].groupId).toBe("-100111");
    expect(fetch).toHaveBeenCalledWith(
      "http://idh-app:8000/api/v1/projects",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("startBridge calls POST /api/v1/bridge/{groupId}/start", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "started" }),
    } as Response);

    await client.startBridge("-100111");
    expect(fetch).toHaveBeenCalledWith(
      "http://idh-app:8000/api/v1/bridge/-100111/start",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("stopBridge calls POST /api/v1/bridge/{groupId}/stop", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "stopped" }),
    } as Response);

    await client.stopBridge("-100111");
    expect(fetch).toHaveBeenCalledWith(
      "http://idh-app:8000/api/v1/bridge/-100111/stop",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "not found",
    } as Response);

    await expect(client.getProject("-100999")).rejects.toThrow("404");
  });
});
