# ====== Code Summary ======
# In-memory ring buffer for system-wide activity events.

# ====== Standard Library Imports ======
import collections
import datetime
import threading

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass

# ====== Local Project Imports ======
from libs.state.models import ActivityEntry


class ActivityLog(LoggerClass):
    """
    Thread-safe in-memory ring buffer of ActivityEntry records.

    Written to by BridgeManager, SchedulerService, and any service that
    wishes to surface events to the Monitoring page. Read by the monitoring
    router to serve GET /monitoring/activity.

    Attributes:
        _max_entries (int): Maximum number of entries before oldest are dropped.
        _buffer (collections.deque): The ring buffer.
        _lock (threading.Lock): Guards concurrent reads and writes.
    """

    def __init__(self, max_entries: int = 200) -> None:
        """
        Initialise the ActivityLog.

        Args:
            max_entries (int): Buffer capacity (default 200).
        """
        LoggerClass.__init__(self)
        self._max_entries = max_entries
        self._buffer: collections.deque[ActivityEntry] = collections.deque(maxlen=max_entries)
        self._lock = threading.Lock()

    # ──────────────────────────── Public API ────────────────────────────────

    def log(
        self,
        group_id: str,
        project_id: str,
        event: str,
        level: str = "info",
    ) -> None:
        """
        Append a new activity entry to the ring buffer.

        Args:
            group_id (str): Telegram group ID of the affected project.
            project_id (str): Project slug.
            event (str): Human-readable event description.
            level (str): Severity — "info" | "warning" | "error".
        """
        # 1. Build the entry with the current UTC timestamp
        entry = ActivityEntry(
            timestamp=datetime.datetime.now(datetime.UTC).isoformat(),
            group_id=group_id,
            project_id=project_id,
            event=event,
            level=level,
        )

        # 2. Append under lock — deque handles ring-buffer eviction automatically
        with self._lock:
            self._buffer.append(entry)

        self.logger.debug(f"[{level.upper()}] {group_id}/{project_id}: {event}")

    def recent(self, limit: int = 100) -> list[ActivityEntry]:
        """
        Return the most recent entries, oldest first.

        Args:
            limit (int): Maximum number of entries to return.

        Returns:
            list[ActivityEntry]: Entries sorted oldest → newest.
        """
        # 1. Snapshot the buffer under lock, then slice
        with self._lock:
            entries = list(self._buffer)
        return entries[-limit:]
