# ====== Code Summary ======
# Async service that drives session scheduling: starts bridges on range entry,
# stops scheduler-owned bridges on range exit, and auto-renews expiring bridges.

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


class SchedulerService(LoggerClass):
    """
    Drives range-based session scheduling for all IDH projects.

    Runs as a background asyncio task. Every 60 seconds it scans all
    projects and applies range-based scheduling logic:

    - In range + no session → start (marks scheduled_session=True)
    - In range + session expiring within 5 min → renew
    - Not in range + scheduled_session=True → stop
    - Sessions started manually (scheduled_session=False) are never touched

    Attributes:
        _state_manager (StateManager): Access to persisted project state.
        _bridge_manager (BridgeManager): Bridge lifecycle control.
        _global_config_manager (GlobalConfigManager): Global schedule defaults.
        _activity_log (ActivityLog): Event log for the monitoring page.
        _telegram_notifier (TelegramNotifier): Reserved for pre-start warning notifications (deferred feature — not yet called).
        _workspaces_dir (pathlib.Path): Base dir for project workspaces.
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
        # Reserved for pre-start warning notifications — not yet called (deferred feature)
        self._telegram_notifier = telegram_notifier
        self._workspaces_dir = workspaces_dir
        self._event_bus: "EventBus | None" = event_bus

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

    def _is_in_active_range(
        self, now: datetime.datetime, schedule: ScheduleConfig
    ) -> bool:
        """
        Return True if ``now`` falls within any active time range and on an active day.

        Ranges where end <= start are treated as overnight (start to midnight + midnight to end).
        "00:00" end is treated as midnight (end of the 23:xx hour).

        Args:
            now (datetime.datetime): Current local datetime.
            schedule (ScheduleConfig): The effective schedule to check against.

        Returns:
            bool: True if now is within an active range on an active day.
        """
        # 1. Check if today is an active day
        if not self._is_active_day(schedule, now.date()):
            return False

        # 2. Check if current time falls inside any range
        current_minutes = now.hour * 60 + now.minute
        for r in schedule.ranges:
            start_h, start_m = map(int, r.start.split(":"))
            end_h, end_m = map(int, r.end.split(":"))
            start_minutes = start_h * 60 + start_m
            # "00:00" end = midnight = treat as 1440 (24*60) to cover full day-end
            end_minutes = end_h * 60 + end_m if (end_h, end_m) != (0, 0) else 1440

            if start_minutes <= end_minutes:
                # Normal range: e.g. 08:00 → 20:00
                if start_minutes <= current_minutes < end_minutes:
                    return True
            else:
                # Overnight range: e.g. 22:00 → 06:00
                if current_minutes >= start_minutes or current_minutes < end_minutes:
                    return True

        return False

    # ──────────────────────────── Scheduler loop ────────────────────────────

    async def _tick(self) -> None:
        """
        Single scheduler pass — scans all projects and applies range-based logic.
        """
        # 1. Load current state
        state = self._state_manager.load()
        now = datetime.datetime.now(datetime.UTC)

        # 2. Process each project
        for group_id, project in state.projects.items():
            try:
                schedule = self._get_effective_schedule(project)
                await self._process_project(project, schedule, now)
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
        self, project: Project, schedule: ScheduleConfig | None, now: datetime.datetime
    ) -> None:
        """
        Apply range-based scheduling logic to one project.

        - In range + no session → start (marks scheduled_session=True)
        - In range + session expiring within 5 min → renew
        - Not in range + scheduled_session → stop
        - Never touches manually-started sessions (scheduled_session=False)

        Args:
            project (Project): Current project state.
            schedule (ScheduleConfig | None): Active schedule, or None if scheduling is off.
            now (datetime.datetime): Current UTC time.
        """
        bridge = project.bridge

        # 1. Auto-renew: renew any bridge (manual or scheduled) expiring within the lead window
        if bridge is not None and bridge.auto_renew:
            expires = datetime.datetime.fromisoformat(bridge.expires_at)
            if (expires - now).total_seconds() < _AUTO_RENEW_LEAD_MINUTES * 60:
                self.logger.info(f"Auto-renewing bridge for group '{project.group_id}'")
                await self._bridge_manager.renew_bridge(project.group_id)
                self._activity_log.log(project.group_id, project.project_id, "Bridge auto-renewed")
                return

        # 2. Determine whether we are currently inside an active range.
        # Use an empty ScheduleConfig (all-days, no ranges → always False) when scheduling is off,
        # so _is_in_active_range can be called uniformly and patched cleanly in tests.
        effective_schedule = schedule if schedule is not None else ScheduleConfig()
        in_range = self._is_in_active_range(now, effective_schedule)

        if in_range:
            # 3. Only act on range entry/renewal if a real schedule is configured
            if schedule is None:
                pass  # No schedule — no automatic start, but allow expiry renewal below
            elif bridge is None:
                # 4. Enter range with no active session: start a new scheduled session
                workspace = self._workspaces_dir / project.project_id
                self.logger.info(
                    f"Scheduler: starting bridge for group '{project.group_id}' (range entry)"
                )
                await self._bridge_manager.start_bridge(
                    group_id=project.group_id, workspace=workspace
                )
                self._activity_log.log(
                    project.group_id, project.project_id, "Bridge started by scheduler"
                )
                # Mark as scheduler-owned after start
                updated = self._state_manager.get_project(project.group_id)
                if updated and updated.bridge:
                    updated.bridge.scheduled_session = True
                    self._state_manager.upsert_project(project.group_id, updated)

            if bridge is not None and bridge.scheduled_session:
                # 5. In range with a scheduler-owned session: renew if expiring soon
                expires = datetime.datetime.fromisoformat(bridge.expires_at)
                if (expires - now).total_seconds() < _AUTO_RENEW_LEAD_MINUTES * 60:
                    self.logger.info(
                        f"Scheduler: renewing bridge for group '{project.group_id}' (expiring)"
                    )
                    await self._bridge_manager.renew_bridge(project.group_id)
                    self._activity_log.log(
                        project.group_id, project.project_id, "Bridge renewed by scheduler"
                    )
        else:
            if bridge is not None and bridge.scheduled_session:
                # 6. Exit range: stop the scheduler-owned session
                self.logger.info(
                    f"Scheduler: stopping bridge for group '{project.group_id}' (range exit)"
                )
                await self._bridge_manager.stop_bridge(project.group_id)
                self._activity_log.log(
                    project.group_id, project.project_id, "Bridge stopped by scheduler (range exit)"
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
