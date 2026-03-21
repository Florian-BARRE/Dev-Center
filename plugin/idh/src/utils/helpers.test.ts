// plugin/idh/src/utils/helpers.test.ts
import { describe, it, expect } from "vitest";
import { extractGroupId, renderCommonContext } from "./helpers";
import type { Project } from "../types/idh";

const fakeProject: Project = {
  groupId: "-1001234567890",
  projectId: "my-repo",
  repoUrl: "git@github.com:user/my-repo.git",
  bridge: null,
  modelOverride: null,
};

describe("extractGroupId", () => {
  it("extracts numeric groupId from a full session key", () => {
    expect(extractGroupId("agent:abc:telegram:group:-1001234567890"))
      .toBe("-1001234567890");
  });

  it("returns empty string for an unrecognised key format", () => {
    expect(extractGroupId("agent:abc:dm:123")).toBe("");
  });
});

describe("renderCommonContext", () => {
  it("includes project ID and repo URL in the output", () => {
    const ctx = renderCommonContext(fakeProject);
    expect(ctx).toContain("my-repo");
    expect(ctx).toContain("git@github.com:user/my-repo.git");
  });
});
