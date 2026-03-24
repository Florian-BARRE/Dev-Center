# ====== Code Summary ======
# SchedulerService — evaluates time-range schedules and starts/stops sessions.

from __future__ import annotations
import asyncio
import datetime
from typing import TYPE_CHECKING
from loggerplusplus import LoggerClass
from libs.state.models import ScheduleConfig, GlobalConfig
from libs.state.state_manager import StateManager

if TYPE_CHECKING:
    from libs.session_manager.session_manager import SessionManager


class SchedulerService(LoggerClass):
    """
    Evaluates per-project and global schedules every 60 seconds.

    On range entry: starts session if idle.
    On range exit: stops session if running.

    Schedule priority:
    - Use project.schedule if project.schedule.enabled = True
    - Else use GlobalConfig.schedule if enabled
    - Else do nothing for that project

    Attributes:
        _state_manager (StateManager): Reads project and global config.
        _session_manager (SessionManager): Starts and stops sessions.
    """

    def __init__(
        self,
        state_manager: StateManager,
        session_manager: "SessionManager",
    ) -> None:
        LoggerClass.__init__(self)
        self._state_manager = state_manager
        self._session_manager = session_manager

    # ──────────────────────── Static helpers ─────────────────────────

    @staticmethod
    def is_in_schedule(schedule: ScheduleConfig, day: str, time_str: str) -> bool:
        """
        Return True if the given day+time falls within a schedule's active windows.

        Args:
            schedule (ScheduleConfig): The schedule to evaluate.
            day (str): Three-letter day abbreviation e.g. "mon".
            time_str (str): Current time as "HH:MM".

        Returns:
            bool: True if currently in an active window.
        """
        # 1. Disabled schedule is never active
        if not schedule.enabled:
            return False

        # 2. Day filter — empty days list means all days
        if schedule.days and day not in schedule.days:
            return False

        # 3. Parse current time
        h, m = map(int, time_str.split(":"))
        current_minutes = h * 60 + m

        # 4. Check each range
        for r in schedule.ranges:
            start_h, start_m = map(int, r.start.split(":"))
            end_h, end_m = map(int, r.end.split(":"))
            start_minutes = start_h * 60 + start_m
            end_minutes = end_h * 60 + end_m

            # end=00:00 means end of day (midnight = 24*60 = 1440)
            if end_minutes == 0:
                end_minutes = 24 * 60

            if start_minutes <= current_minutes < end_minutes:
                return True

        return False

    # ──────────────────────── Scheduler loop ─────────────────────────

    async def _tick(self) -> None:
        """
        Evaluate all projects against their schedule and start/stop sessions.
        Called every 60 seconds by the scheduler loop.
        """
        now = datetime.datetime.now()
        day = now.strftime("%a").lower()[:3]  # "mon", "tue", etc.
        time_str = now.strftime("%H:%M")

        global_config: GlobalConfig = self._state_manager.load_global_config()
        state = self._state_manager.load_projects()

        for project_id, project in state.projects.items():
            # 1. Determine effective schedule
            if project.schedule.enabled:
                effective = project.schedule
            elif global_config.schedule.enabled:
                effective = global_config.schedule
            else:
                continue  # No schedule configured — skip this project

            # 2. Evaluate
            should_be_active = self.is_in_schedule(effective, day, time_str)
            is_active = project.session is not None

            # 3. Act
            if should_be_active and not is_active:
                self.logger.info(f"Schedule: starting session for '{project_id}'")
                await self._session_manager.start_session(project_id)
            elif not should_be_active and is_active:
                self.logger.info(f"Schedule: stopping session for '{project_id}'")
                await self._session_manager.stop_session(project_id)

    async def _loop(self) -> None:
        """Run _tick every 60 seconds indefinitely."""
        while True:
            await asyncio.sleep(60)
            await self._tick()

    async def start(self) -> asyncio.Task:
        """
        Start the scheduler background task.

        Returns:
            asyncio.Task: The running scheduler task.
        """
        self.logger.info(f"Starting scheduler")
        return asyncio.create_task(self._loop())
