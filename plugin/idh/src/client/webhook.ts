// ====== Code Summary ======
// Inbound webhook handler for events sent by the idh-app watchdog.
// Validates the Bearer token, parses the event, and dispatches to the event handler.

import type { WebhookEvent } from "../types/idh";

type EventHandler = (event: WebhookEvent) => Promise<void>;

interface HttpRequest {
  headers: Record<string, string>;
  body: WebhookEvent;
}

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): void;
}

/**
 * Build the OpenClaw HTTP route handler for inbound watchdog events.
 *
 * @param secret - The shared Bearer token (IDH_WEBHOOK_SECRET).
 * @param onEvent - Async callback invoked with each verified event.
 * @returns An async HTTP handler function `(req, res) => void`.
 */
export function buildWebhookHandler(secret: string, onEvent: EventHandler) {
  return async (req: HttpRequest, res: HttpResponse): Promise<void> => {
    // 1. Validate Bearer token
    const authHeader = req.headers["authorization"] ?? req.headers["Authorization"] ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (token !== secret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 2. Dispatch event to handler
    await onEvent(req.body);

    // 3. Return success
    res.status(200).json({ ok: true });
  };
}
