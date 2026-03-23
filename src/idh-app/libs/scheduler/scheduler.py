# ====== Code Summary ======
# Async service that drives session scheduling: renews/starts bridges at configured
# renewal times, sends pre-renewal warnings, and auto-renews expiring bridges.

# ====== Standard Library Imports ======
from __future__ import annotations

import asyncio
import datetime
import pathlib
from typing import TYPE_CHECKING

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass

if TYPE_CHECKING:
    from libs.event_bus.event_bus import EventBus

# ====== Local Project Imports ======
from libs.state.models import Project, ScheduleConfig
from libs.state.state_manager import StateManager
from libs.bridge.bridge_manager import BridgeManager
from libs.global_config.global_config_manager import GlobalConfigManager
from libs.activity.activity_log import ActivityLog
from libs.scheduler.telegram_notifier import TelegramNotifier


# Mapping from Python weekday integer (0=Monday) to schedule day string
_WEEKDAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# Auto-renew triggers this many minutes before expiry
_AUTO_RENEW_LEAD_MINUTES = 5

# A renewal is considered to have "just triggered" if it occurred within this window
_RENEWAL_TRIGGER_WINDOW_MINUTES = 2


class SchedulerService(LoggerClass):
    """
    Drives session scheduling for all IDH projects.

    Runs as a background asyncio task. Every 60 seconds it scans all
    projects, applies schedule logic, sends warnings, and auto-renews
    bridges when configured.

    The schedule model uses ``renewal_times`` (HH:MM list) rather than
    time windows: the bridge is renewed/started at each renewal time, and
    warnings are sent ``warn_lead_minutes`` before each upcoming renewal.

    Attributes:
        _state_manager (StateManager): Access to persisted project state.
        _bridge_manager (BridgeManager): Bridge lifecycle control.
        _global_config_manager (GlobalConfigManager): Global schedule defaults.
        _activity_log (ActivityLog): Event log for the monitoring page.
        _telegram_notifier (TelegramNotifier): Sends Telegram alerts.
        _workspaces_dir (pathlib.Path): Base dir for project workspaces.
        _warn_state (dict[str, datetime.datetime]): Last-warned time per group_id.
        _event_bus (EventBus | None): Optional event bus for publishing real-time events.
    """

    def __init__(
        self,
        state_manager: StateManager,
        bridge_manager: BridgeManager,
        global_config_manager: GlobalConfigManager,
        activity_log: ActivityLog,
        telegram_notifier: TelegramNotifier,
        workspaces_dir: pathlib.Path,
        event_bus: "EventBus | None" = None,
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
            event_bus: Optional EventBus instance to emit events to. Defaults to None.
        """
        LoggerClass.__init__(self)
        self._state_manager = state_manager
        self._bridge_manager = bridge_manager
        self._global_config_manager = global_config_manager
        self._activity_log = activity_log
        self._telegram_notifier = telegram_notifier
        self._workspaces_dir = workspaces_dir
        self._event_bus: "EventBus | None" = event_bus
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

    def _is_active_day(self, schedule: ScheduleConfig, date: datetime.date) -> bool:
        """
        Return True if the given date falls on an active schedule day.

        An empty ``days`` list means all days are active.

        Args:
            schedule (ScheduleConfig): Schedule to check against.
            date (datetime.date): Date to evaluate.

        Returns:
            bool: True if the schedule applies on this date.
        """
        # 1. Empty days list means every day is active
        if not schedule.days:
            return True

        # 2. Check if the weekday name is in the active days list
        return _WEEKDAY_NAMES[date.weekday()] in schedule.days

    def _get_next_renewal_dt(
        self,
        schedule: ScheduleConfig,
        now: datetime.datetime,
    ) -> datetime.datetime | None:
        """
        Find the earliest upcoming renewal datetime strictly after ``now``.

        Scans the next 8 days so weekly schedules are fully covered.

        Args:
            schedule (ScheduleConfig): Schedule with renewal_times.
            now (datetime.datetime): Reference local datetime.

        Returns:
            datetime.datetime | None: Next renewal datetime, or None if none found.
        """
        # 1. Iterate over the next 8 days
        for day_offset in range(8):
            check_date = now.date() + datetime.timedelta(days=day_offset)

            if not self._is_active_day(schedule, check_date):
                continue

            # 2. Check each renewal time on this date
            for time_str in sorted(schedule.renewal_times):
                hh, mm = map(int, time_str.split(":"))
                candidate = datetime.datetime.combine(check_date, datetime.time(hh, mm))
                if candidate > now:
                    return candidate

        return None

    def _just_triggered_renewal(
        self,
        schedule: ScheduleConfig,
        now: datetime.datetime,
    ) -> bool:
        """
        Return True if a renewal time occurred within the last trigger window.

        Used to detect that the scheduler tick just crossed a configured renewal
        time, so the bridge should be started or renewed.

        Args:
            schedule (ScheduleConfig): Schedule with renewal_times.
            now (datetime.datetime): Current local datetime.

        Returns:
            bool: True if a renewal trigger is active right now.
        """
        # 1. Skip if today is not an active day
        if not self._is_active_day(schedule, now.date()):
            return False

        # 2. Check each renewal time on today's date
        trigger_window = datetime.timedelta(minutes=_RENEWAL_TRIGGER_WINDOW_MINUTES)
        for time_str in schedule.renewal_times:
            hh, mm = map(int, time_str.split(":"))
            renewal_dt = datetime.datetime.combine(now.date(), datetime.time(hh, mm))
            delta = now - renewal_dt
            if datetime.timedelta(0) <= delta <= trigger_window:
                return True

        return False

    def _format_remaining(self, target: datetime.datetime) -> str:
        """
        Format the remaining time until ``target`` as a human-readable string.

        Args:
            target (datetime.datetime): Target local datetime.

        Returns:
            str: E.g. "47 minutes" or "2h 3min".
        """
        # 1. Compute delta from now
        now = datetime.datetime.now()
        delta = target - now

        # 2. Format as human-readable
        total_minutes = max(0, int(delta.total_seconds() // 60))
        hours, minutes = divmod(total_minutes, 60)
        if hours > 0:
            return f"{hours}h {minutes}min"
        return f"{minutes} minutes"

    def _format_remaining_from_iso(self, expires_at: str) -> str:
        """
        Format the remaining time until an ISO-8601 UTC expiry string.

        Args:
            expires_at (str): ISO-8601 UTC expiry timestamp.

        Returns:
            str: Human-readable remaining time string.
        """
        # 1. Parse UTC timestamp and convert to local for display
        expires = datetime.datetime.fromisoformat(expires_at)
        now = datetime.datetime.now(datetime.UTC)
        delta = expires - now
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

        # 3. Emit scheduler.tick event with count of currently active projects
        if self._event_bus is not None:
            state = self._state_manager.load()
            await self._event_bus.publish(
                "scheduler.tick",
                {"active_projects": sum(1 for p in state.projects.values() if p.bridge is not None)},
            )

    async def _process_project(
        self,
        group_id: str,
        project: Project,
        now: datetime.datetime,
    ) -> None:
        """
        Apply scheduling logic for a single project.

        Processing order:
        1. Auto-renew check: if bridge has auto_renew=True and is expiring soon, renew it.
        2. Schedule-based renewal: if a renewal time just triggered, start or renew the bridge.
        3. Pre-renewal warning: if within warn_lead_minutes of the next renewal time,
           send a Telegram alert (rate-limited by warn_interval_minutes).

        Args:
            group_id (str): Telegram group ID.
            project (Project): Current project state.
            now (datetime.datetime): Current UTC time.
        """
        # 1. Auto-renew: renew bridge expiring in ≤ AUTO_RENEW_LEAD_MINUTES
        if project.bridge is not None and project.bridge.auto_renew:
            expires = datetime.datetime.fromisoformat(project.bridge.expires_at)
            lead = datetime.timedelta(minutes=_AUTO_RENEW_LEAD_MINUTES)
            if expires - now <= lead:
                self.logger.info(f"Auto-renewing bridge for group '{group_id}'")
                await self._bridge_manager.renew_bridge(group_id)
                self._activity_log.log(group_id, project.project_id, "Bridge auto-renewed")
                return  # Skip other schedule checks after renew

        # 2. Resolve effective schedule; nothing to do if scheduling is off
        schedule = self._get_effective_schedule(project)
        if schedule is None:
            return

        # 3. Schedule-based renewal: start or renew at configured renewal times
        # Use local time for day/time comparison since renewal_times are wall-clock times
        now_local = datetime.datetime.now()
        if self._just_triggered_renewal(schedule, now_local):
            if project.bridge is not None:
                self.logger.info(f"Scheduler: renewing bridge for group '{group_id}' (renewal time)")
                await self._bridge_manager.renew_bridge(group_id)
                self._activity_log.log(group_id, project.project_id,
                                       "Bridge renewed by scheduler")
            else:
                workspace = self._workspaces_dir / project.project_id
                self.logger.info(f"Scheduler: starting bridge for group '{group_id}' (renewal time)")
                await self._bridge_manager.start_bridge(group_id=group_id, workspace=workspace)
                self._activity_log.log(group_id, project.project_id,
                                       "Bridge started by scheduler")
            return

        # 4. Pre-renewal warning: send alert if approaching next renewal time
        next_renewal = self._get_next_renewal_dt(schedule, now_local)
        if next_renewal is None:
            return

        lead = datetime.timedelta(minutes=schedule.warn_lead_minutes)
        if next_renewal - now_local <= lead:
            last_warn = self._warn_state.get(group_id)
            interval = datetime.timedelta(minutes=schedule.warn_interval_minutes)
            if last_warn is None or now_local - last_warn >= interval:
                remaining = self._format_remaining(next_renewal)
                message = schedule.alert_template.format(remaining=remaining)
                await self._telegram_notifier.send_alert(group_id, message)
                self._warn_state[group_id] = now_local
                self._activity_log.log(
                    group_id, project.project_id,
                    f"Telegram alert sent — renewal in {remaining}",
                    level="warning",
                )
                if self._event_bus is not None:
                    remaining_minutes = max(
                        0, int((next_renewal - now_local).total_seconds() // 60)
                    )
                    await self._event_bus.publish(
                        "scheduler.warning_sent",
                        {"remaining_minutes": remaining_minutes},
                        group_id=group_id,
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
