# ====== Code Summary ======
# Route definitions for the /monitoring endpoints.

# ====== Standard Library Imports ======
import datetime

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from libs.state.models import ScheduleConfig
from .models import ActivityLogResponse, TimelineProject, TimelineResponse, TimelineWindow

router = APIRouter(tags=["monitoring"])

# Number of hours to show on each side of "now" in the timeline
_TIMELINE_HOURS = 24

# Mapping weekday integer (Monday=0) → schedule day string
_WEEKDAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _expand_windows(
    schedule: ScheduleConfig,
    now: datetime.datetime,
    horizon_hours: int = _TIMELINE_HOURS,
) -> list[TimelineWindow]:
    """
    Expand schedule windows into absolute UTC timestamps within ±horizon_hours of now.

    Args:
        schedule (ScheduleConfig): The schedule to expand.
        now (datetime.datetime): Current UTC time.
        horizon_hours (int): Hours to look ahead and behind.

    Returns:
        list[TimelineWindow]: Absolute windows within the horizon.
    """
    windows: list[TimelineWindow] = []
    start_date = (now - datetime.timedelta(hours=horizon_hours)).date()
    end_date = (now + datetime.timedelta(hours=horizon_hours)).date()

    # 1. Iterate each calendar day in the horizon
    current_date = start_date
    while current_date <= end_date:
        day_name = _WEEKDAY_NAMES[current_date.weekday()]

        for win in schedule.windows:
            if day_name not in win.days:
                continue

            # 2. Build UTC datetimes for this window on this date
            sh, sm = map(int, win.start_time.split(":"))
            eh, em = map(int, win.end_time.split(":"))
            win_start = datetime.datetime.combine(
                current_date, datetime.time(sh, sm),
                tzinfo=datetime.timezone.utc
            )
            win_end = datetime.datetime.combine(
                current_date, datetime.time(eh, em),
                tzinfo=datetime.timezone.utc
            )

            # 3. Skip windows entirely outside the horizon
            horizon_start = now - datetime.timedelta(hours=horizon_hours)
            horizon_end = now + datetime.timedelta(hours=horizon_hours)
            if win_end <= horizon_start or win_start >= horizon_end:
                continue

            # 4. Determine status
            if win_start <= now < win_end:
                status = "active"
            elif win_start > now:
                status = "scheduled"
            else:
                status = "past"

            windows.append(TimelineWindow(
                start=win_start.isoformat(),
                end=win_end.isoformat(),
                status=status,
            ))

        current_date += datetime.timedelta(days=1)

    return windows


@router.get("/monitoring/timeline", response_model=TimelineResponse)
@auto_handle_errors
async def get_timeline() -> TimelineResponse:
    """
    Return per-project schedule windows expanded to absolute timestamps ±24h.

    Returns:
        TimelineResponse: Timeline data for all projects.
    """
    # 1. Load all projects
    state = CONTEXT.state_manager.load()
    now = datetime.datetime.now(datetime.timezone.utc)
    global_schedule = CONTEXT.global_config_manager.get_schedule()

    # 2. Build timeline for each project
    timeline_projects: list[TimelineProject] = []
    for group_id, project in state.projects.items():
        # 3. Resolve effective schedule
        if project.schedule is not None and project.schedule.enabled:
            schedule = project.schedule
        elif global_schedule.enabled:
            schedule = global_schedule
        else:
            schedule = None

        # 4. Expand windows (or empty list if no schedule)
        windows = _expand_windows(schedule, now) if schedule else []

        timeline_projects.append(TimelineProject(
            group_id=group_id,
            project_id=project.project_id,
            windows=windows,
        ))

    return TimelineResponse(projects=timeline_projects)


@router.get("/monitoring/activity", response_model=ActivityLogResponse)
@auto_handle_errors
async def get_activity(limit: int = 100) -> ActivityLogResponse:
    """
    Return the most recent activity log entries.

    Args:
        limit (int): Maximum number of entries to return (default 100).

    Returns:
        ActivityLogResponse: Recent activity entries, oldest first.
    """
    # 1. Fetch from ActivityLog service
    entries = CONTEXT.activity_log.recent(limit=limit)
    return ActivityLogResponse(entries=entries)


@router.websocket("/monitoring/ws")
async def monitoring_ws(websocket: WebSocket) -> None:
    """
    Stream real-time events to a connected WebSocket client.

    Accepts the connection, subscribes to the EventBus, and forwards each
    event as a JSON message until the client disconnects.

    Note: This route cannot use ``@auto_handle_errors`` — HTTPException has
    no effect on an already-upgraded WebSocket connection. Errors are logged
    and the connection is closed cleanly.

    Args:
        websocket (WebSocket): The incoming WebSocket connection.
    """
    # 1. Upgrade the HTTP connection to WebSocket
    await websocket.accept()
    try:
        # 2. Subscribe to the EventBus and stream events indefinitely
        async for event in CONTEXT.event_bus.subscribe():
            await websocket.send_json(event)
    except WebSocketDisconnect:
        # Client disconnected cleanly — no error to log
        pass
    except Exception as exc:
        # 3. Log unexpected errors; subscribe() finally block cleans up the queue
        CONTEXT.logger.error(f"[monitoring_ws] unexpected error: {exc}")
    finally:
        # 4. Ensure the WebSocket is closed on any exit path
        await websocket.close()
