# ====== Code Summary ======
# EventBus — asyncio pub/sub bus for broadcasting real-time events to WebSocket clients.

# ====== Standard Library Imports ======
import asyncio
import datetime
from collections.abc import AsyncIterator

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass


class _Subscription:
    """
    Async iterator returned by ``EventBus.subscribe()``.

    Wraps a dedicated ``asyncio.Queue`` and removes it from the bus's registry
    when the iterator is closed — whether by ``break``, cancellation, or
    exhaustion.

    Cleanup uses two complementary mechanisms:

    - ``aclose()`` is an awaitable method called by ``async with`` wrappers or
      explicit closes, and also by asyncio's async-generator shutdown machinery.
    - ``__del__`` provides synchronous, reference-counting-based cleanup that
      fires immediately in CPython when the object goes out of scope (e.g. after
      ``break`` exits an ``async for`` loop), ensuring ``_queues`` is updated
      without requiring an extra ``await`` point after the loop.

    Both paths are guarded by ``_closed`` to prevent double-removal.

    Attributes:
        _bus (EventBus): The parent bus whose ``_queues`` list this subscription
            is registered in.
        _q (asyncio.Queue): The per-subscriber event queue.
        _closed (bool): Guard that prevents duplicate removal from ``_queues``.
    """

    def __init__(self, bus: "EventBus") -> None:
        """
        Register a new queue with the parent bus.

        Args:
            bus (EventBus): The EventBus instance this subscription belongs to.
        """
        # 1. Store the reference to the parent bus
        self._bus = bus

        # 2. Create the per-subscriber queue and register it with the bus
        self._q: asyncio.Queue = asyncio.Queue(maxsize=100)
        # Register immediately so publish() can enqueue events from this point on
        self._bus._queues.append(self._q)

        # 3. Mark the subscription as open
        self._closed: bool = False

    def __aiter__(self) -> "_Subscription":
        """
        Return self as the async iterator.

        Returns:
            _Subscription: The subscription instance itself.
        """
        return self

    async def __anext__(self) -> dict:
        """
        Wait for and return the next event from the queue.

        Returns:
            dict: Event envelope containing ``type``, ``ts``, ``group_id``, ``payload``.
        """
        return await self._q.get()

    def _cleanup(self) -> None:
        """
        Remove the queue from the bus registry if not already done.

        This is the single cleanup implementation shared by both ``aclose()`` and
        ``__del__``. The ``_closed`` flag ensures it is idempotent.
        """
        # 1. Guard against double-removal — do nothing if already cleaned up
        if not self._closed:
            # 2. Mark as closed before any removal to prevent re-entrant calls
            self._closed = True

            # 3. Remove the queue from the bus registry
            try:
                self._bus._queues.remove(self._q)
            except ValueError:
                # Queue was already removed (e.g. bus was reset) — safe to ignore
                pass

    async def aclose(self) -> None:
        """
        Remove the queue from the bus registry (async close path).

        Called by ``async for`` machinery when the iterator is explicitly closed,
        by ``async with`` blocks, or by asyncio's shutdown hooks.
        """
        self._cleanup()

    def __del__(self) -> None:
        """
        Remove the queue from the bus registry (synchronous GC path).

        In CPython, this fires immediately via reference counting when the
        ``_Subscription`` object goes out of scope — for example right after a
        ``break`` inside an ``async for`` loop. This guarantees cleanup without
        requiring an additional ``await`` point after the loop exits.
        """
        self._cleanup()


class EventBus(LoggerClass):
    """
    Asyncio pub/sub bus for broadcasting real-time events to WebSocket clients.

    Maintains one ``asyncio.Queue`` per connected subscriber. ``publish()``
    enqueues a copy of the event into every active queue. ``subscribe()``
    returns a ``_Subscription`` async iterator that registers its queue on
    creation and removes it when closed, preventing memory leaks when WebSocket
    clients disconnect.

    Attributes:
        _queues (list[asyncio.Queue]): One queue per active subscriber.
    """

    def __init__(self) -> None:
        """Initialise the EventBus with an empty subscriber list."""
        LoggerClass.__init__(self)
        self._queues: list[asyncio.Queue] = []

    # ──────────────────────────── Public API ────────────────────────────────

    async def publish(
        self,
        event_type: str,
        payload: dict,
        group_id: str | None = None,
    ) -> None:
        """
        Enqueue an event to all active subscribers.

        Silently drops the event for subscribers whose queue is full (maxsize=100)
        rather than blocking — a slow consumer should not block the publisher.

        Args:
            event_type (str): Event type string (e.g. ``"session.started"``).
            payload (dict): Event-specific data fields.
            group_id (str | None): Telegram group ID, if applicable.
        """
        # 1. Build the standard event envelope
        event: dict = {
            "type": event_type,
            "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "group_id": group_id,
            "payload": payload,
        }

        # 2. Non-blocking enqueue to all subscribers
        for q in list(self._queues):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                self.logger.warning(f"EventBus: queue full for event '{event_type}', dropping")

    def subscribe(self) -> AsyncIterator[dict]:
        """
        Return an async iterator that yields events as they arrive.

        Creates and registers a ``_Subscription`` whose queue is removed when
        the iterator is closed — ensuring cleanup even when the consumer uses
        ``break``, is cancelled, or raises.

        Returns:
            AsyncIterator[dict]: Yields event envelopes containing ``type``,
                ``ts``, ``group_id``, and ``payload``.
        """
        # 1. Create and register the per-subscriber subscription
        return _Subscription(self)
