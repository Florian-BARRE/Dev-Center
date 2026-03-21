import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StateReader } from "./state-reader";
import type { Project } from "../types/idh";

const makeProject = (groupId: string): Project => ({
  groupId,
  projectId: "repo",
  repoUrl: "git@github.com:u/repo.git",
  bridge: null,
  modelOverride: null,
});

describe("StateReader", () => {
  let fetchProjects: ReturnType<typeof vi.fn>;
  let reader: StateReader;

  beforeEach(() => {
    fetchProjects = vi.fn().mockResolvedValue([makeProject("-100111")]);
    reader = new StateReader(fetchProjects, 5000); // 5s TTL
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it("getByGroupId returns the project on cache hit", async () => {
    await reader.refresh();
    const p = reader.getByGroupId("-100111");
    expect(p?.groupId).toBe("-100111");
  });

  it("getByGroupId returns undefined for unknown groupId", async () => {
    await reader.refresh();
    expect(reader.getByGroupId("-999")).toBeUndefined();
  });

  it("auto-refreshes after TTL expires", async () => {
    await reader.getOrRefresh();
    expect(fetchProjects).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(6000); // past 5s TTL
    await reader.getOrRefresh();
    expect(fetchProjects).toHaveBeenCalledTimes(2);
  });

  it("does not re-fetch within TTL", async () => {
    await reader.getOrRefresh();
    await reader.getOrRefresh();
    expect(fetchProjects).toHaveBeenCalledTimes(1);
  });
});
