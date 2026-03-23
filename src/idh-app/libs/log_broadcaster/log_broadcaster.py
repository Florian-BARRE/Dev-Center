# ====== Code Summary ======
# Provides LogBroadcaster — a thread-safe asyncio pub/sub broadcaster that
# distributes loggerplusplus log records to active WebSocket subscribers.

# ====== Standard Library Imports ======
import asyncio
from typing import Callable

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass


class LogBroadcaster(LoggerClass):
    """
    Thread-safe broadcaster that distributes log records to WebSocket subscribers.

    A loggerplusplus sink calls publish_sync() from any thread; that method
    uses loop.call_soon_threadsafe() to enqueue the record safely onto all
    subscriber asyncio.Queue instances.

    Usage::

        broadcaster = LogBroadcaster()

        # In lifespan (inside a running event loop):
        broadcaster.set_loop(asyncio.get_running_loop())
        loggerplusplus.add(broadcaster.make_sink())

        # In a WebSocket handler:
        async with broadcaster.subscribe() as sub:
            async for record in sub:
                await websocket.send_json(record)
    """

    def __init__(self) -> None:
        LoggerClass.__init__(self)
        self._queues: list[asyncio.Queue] = []
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """
        Store the running asyncio event loop for thread-safe publishing.

        Args:
            loop (asyncio.AbstractEventLoop): The running asyncio event loop.
        """
        # 1. Persist loop reference for later use by publish_sync()
        self._loop = loop
        self.logger.debug(f"LogBroadcaster event loop set")

    def publish_sync(self, record: dict) -> None:
        """
        Enqueue a log record to all active subscribers (thread-safe).

        Called from the loggerplusplus sink, which may run on any thread.
        Silently no-ops before the event loop is set or after shutdown.

        Args:
            record (dict): Serialisable log record dict to broadcast.
        """
        # 1. Skip if loop is not yet available (before lifespan or post-shutdown)
        if self._loop is None:
            return

        # 2. Push record to every subscriber's queue via the asyncio event loop
        for q in list(self._queues):
            try:
                self._loop.call_soon_threadsafe(q.put_nowait, record)
            except Exception:
                # Silently discard if the queue is full or the loop is closing
                pass

    def make_sink(self) -> Callable:
        """
        Return a loggerplusplus-compatible sink callable.

        The returned function extracts relevant fields from a loguru Message
        and calls publish_sync() with a serialisable dict.

        Returns:
            Callable: A sink function suitable for ``loggerplusplus.add()``.
        """
        def _sink(message) -> None:
            # 1. Extract structured fields from the loguru Message record
            rec = message.record
            self.publish_sync({
                "ts": rec["time"].isoformat(),
                "level": rec["level"].name,
                "message": rec["message"],
                "logger": rec["extra"].get("identifier", rec["name"]),
            })

        return _sink

    def subscribe(self) -> "_Subscription":
        """
        Return a subscription that yields log records as they arrive.

        Returns:
            _Subscription: Async context manager and async iterator.
        """
        return _Subscription(self)

    class _Subscription:
        """
        Async context manager and iterator for a single WebSocket subscriber.

        Registers a dedicated asyncio.Queue on entry and removes it on exit,
        preventing memory leaks when clients disconnect.
        """

        def __init__(self, broadcaster: "LogBroadcaster") -> None:
            # 1. Store reference to parent broadcaster and allocate queue
            self._broadcaster = broadcaster
            self._queue: asyncio.Queue = asyncio.Queue(maxsize=500)

        async def __aenter__(self) -> "LogBroadcaster._Subscription":
            # 1. Register queue so publish_sync() starts delivering records
            self._broadcaster._queues.append(self._queue)
            return self

        async def __aexit__(self, *_) -> None:
            # 1. Unregister queue to stop delivery and release memory
            self._cleanup()

        def _cleanup(self) -> None:
            """Remove this subscription's queue from the broadcaster registry."""
            try:
                self._broadcaster._queues.remove(self._queue)
            except ValueError:
                pass

        def __del__(self) -> None:
            # 1. Safety net: clean up if __aexit__ was never awaited
            self._cleanup()

        def __aiter__(self) -> "LogBroadcaster._Subscription":
            return self

        async def __anext__(self) -> dict:
            """
            Wait for and return the next log record.

            Returns:
                dict: The next log record from the queue.
            """
            return await self._queue.get()
