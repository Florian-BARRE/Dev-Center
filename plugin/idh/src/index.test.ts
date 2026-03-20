import { describe, it, expect } from "vitest";
import plugin from "./index";

describe("IDH plugin", () => {
  it("exports a plugin definition with an id", () => {
    expect(plugin.id).toBe("idh-projects");
  });

  it("exports a register function", () => {
    expect(typeof plugin.register).toBe("function");
  });
});
