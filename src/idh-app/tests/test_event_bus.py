# ====== Code Summary ======
# Unit tests for the EventBus asyncio pub/sub bus.

# ====== Standard Library Imports ======
import asyncio

# ====== Third-Party Library Imports ======
import pytest

# ====== Internal Project Imports ======
from libs.event_bus.event_bus import EventBus


@pytest.mark.asyncio
async def test_publish_delivers_event_to_subscriber() -> None:
    """A subscriber receives events published after it started listening."""
    bus = EventBus()
    received: list[dict] = []

    async def consume() -> None:
        async for event in bus.subscribe():
            received.append(event)
            break  # stop after first event

    task = asyncio.create_task(consume())
    await asyncio.sleep(0)  # yield control so the task registers its queue
    await bus.publish("test.event", {"key": "value"}, group_id="-123")
    await task

    assert len(received) == 1
    assert received[0]["type"] == "test.event"
    assert received[0]["group_id"] == "-123"
    assert received[0]["payload"] == {"key": "value"}
    assert "ts" in received[0]


@pytest.mark.asyncio
async def test_publish_delivers_to_multiple_subscribers() -> None:
    """All active subscribers receive the same event."""
    bus = EventBus()
    results: list[list[str]] = [[], []]

    async def consume(idx: int) -> None:
        async for event in bus.subscribe():
            results[idx].append(event["type"])
            break

    t1 = asyncio.create_task(consume(0))
    t2 = asyncio.create_task(consume(1))
    await asyncio.sleep(0)
    await bus.publish("broadcast", {})
    await t1
    await t2

    assert results[0] == ["broadcast"]
    assert results[1] == ["broadcast"]


@pytest.mark.asyncio
async def test_subscribe_removes_queue_on_exit() -> None:
    """subscribe() cleans up its queue from _queues when the generator exits."""
    bus = EventBus()

    async def consume_one() -> None:
        async for _ in bus.subscribe():
            break

    task = asyncio.create_task(consume_one())
    await asyncio.sleep(0)
    assert len(bus._queues) == 1
    await bus.publish("cleanup.test", {})
    await task
    assert len(bus._queues) == 0


@pytest.mark.asyncio
async def test_publish_with_no_subscribers_does_not_raise() -> None:
    """publish() is a no-op when there are no subscribers."""
    bus = EventBus()
    await bus.publish("orphan.event", {"x": 1})  # must not raise
