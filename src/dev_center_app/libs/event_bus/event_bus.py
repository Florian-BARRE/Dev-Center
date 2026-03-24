# ====== Code Summary ======
# EventBus — async in-process pub/sub for real-time monitoring events.

from __future__ import annotations
import asyncio
from collections import defaultdict
from typing import Any, Callable
from loggerplusplus import LoggerClass


class EventBus(LoggerClass):
    """
    Async in-process publish/subscribe bus.

    Subscribers register async callbacks for event types. Publishing
    an event calls all matching subscribers concurrently. Unmatched
    events are silently dropped.

    Attributes:
        _subscribers (dict[str, list[Callable]]): event_type → list of async callbacks.
    """

    def __init__(self) -> None:
        LoggerClass.__init__(self)
        self._subscribers: dict[str, list[Callable]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: Callable) -> None:
        """
        Register an async handler for an event type.

        Args:
            event_type (str): Event name to subscribe to (e.g. "session.started").
            handler (Callable): Async callable receiving (event_type, data).
        """
        self._subscribers[event_type].append(handler)
        self.logger.debug(f"Subscribed handler to '{event_type}'")

    def unsubscribe(self, event_type: str, handler: Callable) -> None:
        """
        Remove a previously registered handler.

        Args:
            event_type (str): Event name.
            handler (Callable): Handler to remove.
        """
        self._subscribers[event_type] = [
            h for h in self._subscribers[event_type] if h is not handler
        ]

    async def publish(self, event_type: str, data: dict[str, Any], **kwargs: Any) -> None:
        """
        Publish an event to all registered subscribers concurrently.

        Args:
            event_type (str): Event name.
            data (dict): Event payload.
            **kwargs: Additional fields merged into data before dispatch.
        """
        payload = {**data, **kwargs}
        handlers = self._subscribers.get(event_type, [])
        if not handlers:
            return
        self.logger.debug(f"Publishing '{event_type}' to {len(handlers)} subscriber(s)")
        await asyncio.gather(*(h(event_type, payload) for h in handlers), return_exceptions=True)
