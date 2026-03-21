import { describe, it, expect, vi } from "vitest";
import { buildWebhookHandler } from "./webhook";
import type { WebhookEvent } from "../types/idh";

const SECRET = "test-secret-abc";

const makeReq = (event: WebhookEvent, token = SECRET) => ({
  headers: { authorization: `Bearer ${token}` },
  body: event,
});

describe("buildWebhookHandler", () => {
  it("calls onEvent with parsed event when token is valid", async () => {
    const onEvent = vi.fn();
    const handler = buildWebhookHandler(SECRET, onEvent);
    const req = makeReq({ type: "bridge_warning", groupId: "-100111", projectId: "repo", minutesRemaining: 60 });

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req as never, res as never);

    expect(onEvent).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 401 when token is wrong", async () => {
    const onEvent = vi.fn();
    const handler = buildWebhookHandler(SECRET, onEvent);
    const req = makeReq({ type: "bridge_warning", groupId: "-100111", projectId: "repo" }, "wrong");

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req as never, res as never);

    expect(onEvent).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
