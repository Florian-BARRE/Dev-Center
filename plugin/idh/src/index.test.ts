import { describe, it, expect, vi } from "vitest";
import plugin from "./index";

describe("IDH plugin registration", () => {
  it("registers all expected commands", () => {
    const registered: string[] = [];
    const api = {
      registerCommand: vi.fn(({ name }) => registered.push(name)),
      registerHook: vi.fn(),
      registerHttpRoute: vi.fn(),
    };
    plugin.register(api as never);
    expect(registered).toContain("menu");
    expect(registered).toContain("add_project");
    expect(registered).toContain("bridge");
    expect(registered).toContain("agent");
    expect(registered).toContain("monitoring");
    expect(registered).toContain("info");
  });

  it("registers before_model_resolve hook", () => {
    const api = {
      registerCommand: vi.fn(),
      registerHook: vi.fn(),
      registerHttpRoute: vi.fn(),
    };
    plugin.register(api as never);
    expect(api.registerHook).toHaveBeenCalledWith("before_model_resolve", expect.any(Function));
  });

  it("registers before_prompt_build hook", () => {
    const api = {
      registerCommand: vi.fn(),
      registerHook: vi.fn(),
      registerHttpRoute: vi.fn(),
    };
    plugin.register(api as never);
    expect(api.registerHook).toHaveBeenCalledWith("before_prompt_build", expect.any(Function));
  });

  it("registers the inbound webhook HTTP route", () => {
    const api = {
      registerCommand: vi.fn(),
      registerHook: vi.fn(),
      registerHttpRoute: vi.fn(),
    };
    plugin.register(api as never);
    expect(api.registerHttpRoute).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/api/plugins/idh/events" })
    );
  });
});
