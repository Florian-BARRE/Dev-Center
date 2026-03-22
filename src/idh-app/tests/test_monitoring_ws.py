# ====== Code Summary ======
# Tests for the WS /api/v1/monitoring/ws WebSocket endpoint.

# ====== Standard Library Imports ======
import asyncio
import threading

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient


def test_monitoring_ws_connects_and_receives_events(client: TestClient) -> None:
    """WebSocket client connects and receives JSON events published on the bus."""
    from backend.context import CONTEXT

    received: list[dict] = []

    with client.websocket_connect("/api/v1/monitoring/ws") as ws:
        # Publish an event from a separate thread using asyncio.run() so it
        # creates its own event loop, independent of the TestClient's loop.
        # The EventBus.publish() enqueues events via put_nowait() — safe to call
        # from a different coroutine as long as the queue exists when called.
        def _publish() -> None:
            asyncio.run(CONTEXT.event_bus.publish("test.ws", {"hello": "world"}))

        t = threading.Thread(target=_publish)
        t.start()
        t.join(timeout=2)

        msg = ws.receive_json()
        received.append(msg)

    assert len(received) == 1
    assert received[0]["type"] == "test.ws"
    assert received[0]["payload"] == {"hello": "world"}


def test_monitoring_ws_accepts_connection(client: TestClient) -> None:
    """WebSocket endpoint accepts connections without error."""
    with client.websocket_connect("/api/v1/monitoring/ws") as ws:
        # Connection opened successfully — no assertion needed beyond no exception
        assert ws is not None
