import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildModelResolverHook } from "./model-resolver";
import { buildPromptBuilderHook } from "./prompt-builder";
import type { StateReader } from "../state/state-reader";
import type { Project } from "../types/idh";

const makeProject = (override?: Partial<Project>): Project => ({
  groupId: "-100111",
  projectId: "repo",
  repoUrl: "git@github.com:u/repo.git",
  bridge: null,
  modelOverride: { provider: "anthropic", model: "claude-opus-4-6" },
  ...override,
});

// Mock StateReader
const makeReader = (project?: Project): StateReader => ({
  getOrRefresh: vi.fn().mockResolvedValue(
    project ? new Map([[project.groupId, project]]) : new Map()
  ),
  getByGroupId: vi.fn((id) => (project?.groupId === id ? project : undefined)),
  refresh: vi.fn(),
} as unknown as StateReader);

describe("model-resolver hook", () => {
  it("overrides provider and model when project has modelOverride", async () => {
    const reader = makeReader(makeProject());
    const hook = buildModelResolverHook(reader);
    const ctx = { sessionKey: "agent:abc:telegram:group:-100111", provider: "openai", model: "gpt-4o" };

    await hook(ctx);

    expect(ctx.provider).toBe("anthropic");
    expect(ctx.model).toBe("claude-opus-4-6");
  });

  it("does not modify ctx when no project found", async () => {
    const reader = makeReader();
    const hook = buildModelResolverHook(reader);
    const ctx = { sessionKey: "agent:abc:telegram:group:-999", provider: "openai", model: "gpt-4o" };

    await hook(ctx);

    expect(ctx.provider).toBe("openai");
    expect(ctx.model).toBe("gpt-4o");
  });
});

describe("prompt-builder hook", () => {
  it("prepends common context to systemPrompt", async () => {
    const reader = makeReader(makeProject());
    const hook = buildPromptBuilderHook(reader);
    const ctx = { sessionKey: "agent:abc:telegram:group:-100111", systemPrompt: "existing prompt" };

    await hook(ctx);

    expect(ctx.systemPrompt).toContain("repo");
    expect(ctx.systemPrompt).toContain("existing prompt");
    // Common context must come BEFORE existing prompt
    expect(ctx.systemPrompt.indexOf("repo")).toBeLessThan(ctx.systemPrompt.indexOf("existing prompt"));
  });
});
