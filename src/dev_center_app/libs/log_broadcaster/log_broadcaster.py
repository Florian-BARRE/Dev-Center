# ====== Code Summary ======
# LogBroadcaster — captures loggerplusplus sink output and fans it out to WebSocket subscribers.

from __future__ import annotations
import asyncio
from collections import deque

from loggerplusplus import LoggerClass


class LogBroadcaster(LoggerClass):
    """
    Captures loggerplusplus sink output and fans it out to WebSocket subscribers.

    Acts as a loggerplusplus sink (register via ``loggerplusplus.add(sink=broadcaster.sink, ...)``).
    Each log record is appended to an in-memory ring buffer and put into every active
    subscriber queue so WebSocket clients receive live lines.  New subscribers receive
    the full history buffer first, then live lines via their queue.

    Attributes:
        _max_history (int): Number of log lines to retain in the ring buffer.
        _history (deque[str]): Ring buffer of recent log lines.
        _subscribers (list[asyncio.Queue]): Per-WebSocket queues receiving live lines.
    """

    def __init__(self, max_history: int = 300) -> None:
        LoggerClass.__init__(self)
        self._max_history = max_history
        self._history: deque[str] = deque(maxlen=max_history)
        self._subscribers: list[asyncio.Queue] = []

    # ──────────────────────── Sink callable ──────────────────────────

    def sink(self, message: object) -> None:
        """
        Loggerplusplus/loguru sink entry point — called for every log record.

        Strips trailing whitespace, appends to history, and fans out to subscribers.

        Args:
            message: Log message object from loggerplusplus/loguru.
        """
        # 1. Stringify and strip trailing whitespace/newlines
        line = str(message).rstrip()

        # 2. Append to ring buffer
        self._history.append(line)

        # 3. Fan out to all active subscriber queues (non-blocking)
        dead: list[asyncio.Queue] = []
        for q in self._subscribers:
            try:
                q.put_nowait(line)
            except asyncio.QueueFull:
                # Subscriber is too slow — mark for cleanup
                dead.append(q)

        for q in dead:
            try:
                self._subscribers.remove(q)
            except ValueError:
                pass

    # ──────────────────────── Subscriber API ─────────────────────────

    def subscribe(self) -> tuple[list[str], asyncio.Queue]:
        """
        Register a new WebSocket subscriber.

        Returns a snapshot of the current history and a live queue.
        The caller should send history lines first, then drain the queue.

        Returns:
            tuple[list[str], asyncio.Queue]: (history_snapshot, live_queue).
        """
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        self._subscribers.append(q)
        return list(self._history), q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        """
        Remove a subscriber queue (call in WebSocket finally block).

        Args:
            q (asyncio.Queue): Queue to remove.
        """
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass


__all__ = ["LogBroadcaster"]
