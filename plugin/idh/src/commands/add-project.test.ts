import { describe, it, expect, vi } from "vitest";
import { buildAddProjectCommand } from "./add-project";
import { WizardEngine } from "../wizard/engine";

const GROUP = "-100111";

describe("add-project command", () => {
  it("starts the wizard on first call", async () => {
    const engine = new WizardEngine();
    const sendMessage = vi.fn();
    const cmd = buildAddProjectCommand(engine, vi.fn(), sendMessage);

    await cmd({ groupId: GROUP });

    expect(sendMessage).toHaveBeenCalledWith(GROUP, expect.stringContaining("repo URL"));
    expect(engine.isActive(GROUP)).toBe(true);
  });

  it("advances to model step after repo URL is provided", async () => {
    const engine = new WizardEngine();
    const sendMessage = vi.fn();
    const cmd = buildAddProjectCommand(engine, vi.fn(), sendMessage);

    await cmd({ groupId: GROUP });
    await cmd({ groupId: GROUP, text: "git@github.com:u/repo.git" });

    expect(engine.currentStepIndex(GROUP)).toBe(1);
    expect(engine.getData(GROUP)).toMatchObject({ repoUrl: "git@github.com:u/repo.git" });
  });

  it("calls createProject on confirm step", async () => {
    const createProject = vi.fn().mockResolvedValue({ groupId: GROUP });
    const engine = new WizardEngine();
    const sendMessage = vi.fn();
    const cmd = buildAddProjectCommand(engine, createProject, sendMessage);

    await cmd({ groupId: GROUP });
    await cmd({ groupId: GROUP, text: "git@github.com:u/repo.git" });
    await cmd({ groupId: GROUP, callbackData: "model:anthropic:claude-opus-4-6" });
    await cmd({ groupId: GROUP, callbackData: "confirm" });

    expect(createProject).toHaveBeenCalledWith(GROUP, "git@github.com:u/repo.git", "anthropic", "claude-opus-4-6");
    expect(engine.isActive(GROUP)).toBe(false);
  });
});
