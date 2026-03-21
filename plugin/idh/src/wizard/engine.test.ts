// plugin/idh/src/wizard/engine.test.ts
import { describe, it, expect, vi } from "vitest";
import { WizardEngine } from "./engine";

describe("WizardEngine", () => {
  it("starts a wizard and tracks the current step index", () => {
    const engine = new WizardEngine();
    const steps = [vi.fn(), vi.fn(), vi.fn()];
    engine.start("-100111", steps, {});
    expect(engine.currentStepIndex("-100111")).toBe(0);
  });

  it("advance moves to the next step", () => {
    const engine = new WizardEngine();
    const steps = [vi.fn(), vi.fn()];
    engine.start("-100111", steps, {});
    engine.advance("-100111", { repo: "url" });
    expect(engine.currentStepIndex("-100111")).toBe(1);
    expect(engine.getData("-100111")).toMatchObject({ repo: "url" });
  });

  it("back moves to the previous step", () => {
    const engine = new WizardEngine();
    const steps = [vi.fn(), vi.fn()];
    engine.start("-100111", steps, {});
    engine.advance("-100111", {});
    engine.back("-100111");
    expect(engine.currentStepIndex("-100111")).toBe(0);
  });

  it("cancel clears the wizard state", () => {
    const engine = new WizardEngine();
    engine.start("-100111", [vi.fn()], {});
    engine.cancel("-100111");
    expect(engine.isActive("-100111")).toBe(false);
  });

  it("advance on the last step completes the wizard", () => {
    const engine = new WizardEngine();
    const steps = [vi.fn()];
    engine.start("-100111", steps, {});
    engine.advance("-100111", {});
    expect(engine.isActive("-100111")).toBe(false);
  });

  it("isActive returns false for unknown groupId", () => {
    const engine = new WizardEngine();
    expect(engine.isActive("-9999")).toBe(false);
  });
});
