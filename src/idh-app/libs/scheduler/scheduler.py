# ====== Code Summary ======
# Async service that drives session scheduling: starts/stops bridges on schedule,
# sends pre-transition warnings, and auto-renews expiring bridges.

# ====== Standard Library Imports ======
import asyncio
import datetime
import pathlib

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass

# ====== Local Project Imports ======
from libs.state.models import Project, ScheduleConfig, ScheduleWindow
from libs.state.state_manager import StateManager
from libs.bridge.bridge_manager import BridgeManager
from libs.global_config.global_config_manager import GlobalConfigManager
from libs.activity.activity_log import ActivityLog
from libs.scheduler.telegram_notifier import TelegramNotifier


# Mapping from Python weekday integer (0=Monday) to schedule day string
_WEEKDAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# Auto-renew triggers this many minutes before expiry
_AUTO_RENEW_LEAD_MINUTES = 5


class SchedulerService(LoggerClass):
    """
    Drives session scheduling for all IDH projects.

    Runs as a background asyncio task. Every 60 seconds it scans all
    projects, applies schedule logic, sends warnings, and auto-renews
    bridges when configured.

    Attributes:
        _state_manager (StateManager): Access to persisted project state.
        _bridge_manager (BridgeManager): Bridge lifecycle control.
        _global_config_manager (GlobalConfigManager): Global schedule defaults.
        _activity_log (ActivityLog): Event log for the monitoring page.
        _telegram_notifier (TelegramNotifier): Sends Telegram alerts.
        _workspaces_dir (pathlib.Path): Base dir for project workspaces.
        _warn_state (dict[str, datetime.datetime]): Last-warned time per group_id.
    """

    def __init__(
        self,
        state_manager: StateManager,
        bridge_manager: BridgeManager,
        global_config_manager: GlobalConfigManager,
        activity_log: ActivityLog,
        telegram_notifier: TelegramNotifier,
        workspaces_dir: pathlib.Path,
    ) -> None:
        """
        Initialise the SchedulerService.

        Args:
            state_manager: Shared state manager.
            bridge_manager: Bridge lifecycle manager.
            global_config_manager: Global config for defaults.
            activity_log: Activity log for monitoring events.
            telegram_notifier: Sends Telegram transition alerts.
            workspaces_dir: Base directory for project workspaces.
        """
        LoggerClass.__init__(self)
        self._state_manager = state_manager
        self._bridge_manager = bridge_manager
        self._global_config_manager = global_config_manager
        self._activity_log = activity_log
        self._telegram_notifier = telegram_notifier
        self._workspaces_dir = workspaces_dir
        self._warn_state: dict[str, datetime.datetime] = {}

    # ──────────────────────────── Private helpers ─────────────────────────────

    def _get_effective_schedule(self, project: Project) -> ScheduleConfig | None:
        """
        Return the schedule config active for this project, or None if scheduling
        is disabled for it.

        Resolution order:
        1. project.schedule is not None and enabled → use project schedule.
        2. global schedule enabled → use global schedule.
        3. Otherwise → no scheduling.

        Args:
            project (Project): The project to check.

        Returns:
            ScheduleConfig | None: Active schedule, or None if scheduling is off.
        """
        # 1. Project has a custom schedule
        if project.schedule is not None and project.schedule.enabled:
            return project.schedule

        # 2. Fall back to global schedule
        global_schedule = self._global_config_manager.get_config().schedule
        if global_schedule.enabled:
            return global_schedule

        # 3. No scheduling
        return None

    def _is_in_window(self, schedule: ScheduleConfig) -> bool:
        """
        Determine whether the current local time falls inside any window.

        Args:
            schedule (ScheduleConfig): The schedule to check.

        Returns:
            bool: True if now is inside a scheduled window.
        """
        # 1. Get current local time and weekday
        now = datetime.datetime.now()
        current_day = _WEEKDAY_NAMES[now.weekday()]
        current_time = now.strftime("%H:%M")

        # 2. Check each window
        for window in schedule.windows:
            if current_day not in window.days:
                continue
            if window.start_time <= current_time < window.end_time:
                return True

        return False

    def _format_remaining(self, expires_at: str) -> str:
        """
        Format the remaining time until expiry as a human-readable string.

        Args:
            expires_at (str): ISO-8601 UTC expiry timestamp.

        Returns:
            str: E.g. "47 minutes" or "2h 3min".
        """
        # 1. Parse and compute delta
        expires = datetime.datetime.fromisoformat(expires_at)
        now = datetime.datetime.now(datetime.UTC)
        delta = expires - now

        # 2. Format as human-readable
        total_minutes = max(0, int(delta.total_seconds() // 60))
        hours, minutes = divmod(total_minutes, 60)
        if hours > 0:
            return f"{hours}h {minutes}min"
        return f"{minutes} minutes"

    # ──────────────────────────── Scheduler loop ────────────────────────────

    async def _tick(self) -> None:
        """
        Single scheduler pass — scans all projects and applies schedule logic.
        """
        # 1. Load current state
        state = self._state_manager.load()
        now = datetime.datetime.now(datetime.UTC)

        # 2. Process each project
        for group_id, project in state.projects.items():
            try:
                await self._process_project(group_id, project, now)
            except Exception as exc:
                self.logger.error(f"Scheduler error for group '{group_id}': {exc}")

    async def _process_project(
        self,
        group_id: str,
        project: Project,
        now: datetime.datetime,
    ) -> None:
        """
        Apply scheduling logic for a single project.

        Args:
            group_id (str): Telegram group ID.
            project (Project): Current project state.
            now (datetime.datetime): Current UTC time.
        """
        # 1. Check for auto-renew (independent of schedule)
        if project.bridge is not None and project.bridge.auto_renew:
            expires = datetime.datetime.fromisoformat(project.bridge.expires_at)
            lead = datetime.timedelta(minutes=_AUTO_RENEW_LEAD_MINUTES)
            if expires - now <= lead:
                self.logger.info(f"Auto-renewing bridge for group '{group_id}'")
                await self._bridge_manager.renew_bridge(group_id)
                self._activity_log.log(group_id, project.project_id, "Bridge auto-renewed")
                return  # Skip other schedule checks after renew

        # 2. Resolve effective schedule
        schedule = self._get_effective_schedule(project)
        if schedule is None:
            return

        # 3. Determine if we should be active right now
        in_window = self._is_in_window(schedule)

        # 4. Start bridge if inside window but not running
        if in_window and project.bridge is None:
            workspace = self._workspaces_dir / project.project_id
            self.logger.info(f"Scheduler: starting bridge for group '{group_id}'")
            await self._bridge_manager.start_bridge(group_id=group_id, workspace=workspace)
            self._activity_log.log(group_id, project.project_id,
                                   f"Bridge auto-started by scheduler")
            return

        # 5. Stop bridge if outside window but running
        if not in_window and project.bridge is not None:
            self.logger.info(f"Scheduler: stopping bridge for group '{group_id}' (outside window)")
            await self._bridge_manager.stop_bridge(group_id)
            self._activity_log.log(group_id, project.project_id,
                                   "Bridge stopped by scheduler (outside schedule window)")
            return

        # 6. Send warning if approaching end of window
        if in_window and project.bridge is not None:
            expires = datetime.datetime.fromisoformat(project.bridge.expires_at)
            lead = datetime.timedelta(minutes=schedule.warn_lead_minutes)
            if expires - now <= lead:
                last_warn = self._warn_state.get(group_id)
                interval = datetime.timedelta(minutes=schedule.warn_interval_minutes)
                if last_warn is None or now - last_warn >= interval:
                    remaining = self._format_remaining(project.bridge.expires_at)
                    message = schedule.alert_template.format(remaining=remaining)
                    await self._telegram_notifier.send_alert(group_id, message)
                    self._warn_state[group_id] = now
                    self._activity_log.log(
                        group_id, project.project_id,
                        f"Telegram alert sent — session ending in {remaining}",
                        level="warning",
                    )

    async def _run_loop(self) -> None:
        """Run indefinitely, calling _tick every 60 seconds."""
        while True:
            await asyncio.sleep(60)
            await self._tick()

    # ──────────────────────────── Public API ────────────────────────────────

    async def start(self) -> asyncio.Task:
        """
        Start the scheduler background task.

        Returns:
            asyncio.Task: The running scheduler asyncio task.
        """
        self.logger.info(f"Starting SchedulerService")
        return asyncio.create_task(self._run_loop())
