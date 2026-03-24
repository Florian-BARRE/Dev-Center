# ====== Code Summary ======
# /monitoring router — global session status + real-time event feed.

# ====== Standard Library Imports ======
import asyncio

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors

# ====== Local Project Imports ======
from .models import MonitoringResponse, ProjectMonitorRow

router = APIRouter()

# Events that flow through the monitoring WebSocket
_MONITORED_EVENTS = [
    "session.started",
    "session.stopped",
    "session.expired",
    "session.renewed",
    "clone.done",
]

# Keepalive interval for the monitoring WebSocket (seconds)
_KEEPALIVE_TIMEOUT = 30


@router.get("/monitoring", response_model=MonitoringResponse)
@auto_handle_errors
async def get_monitoring() -> MonitoringResponse:
    """
    Return current status of all projects.

    Returns:
        MonitoringResponse: List of project monitor rows with status and session info.
    """
    # 1. Load all projects from state
    state = CONTEXT.state_manager.load_projects()

    # 2. Build a monitor row for each project
    rows = [
        ProjectMonitorRow(
            project_id=p.id,
            status="active" if p.session else "idle",
            session=p.session,
            workspace_path=p.workspace_path,
        )
        for p in state.projects.values()
    ]

    return MonitoringResponse(projects=rows)


@router.websocket("/monitoring/events")
async def monitoring_events(websocket: WebSocket) -> None:
    """
    WebSocket feed of all session lifecycle events.

    Sends { "type": event_name, "project_id": str, "data": {} } messages.
    Sends { "type": "ping" } every 30 seconds as a keepalive.
    Unsubscribes from the event bus on disconnect or error.

    Args:
        websocket: Active WebSocket connection from the client.
    """
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue()

    # 1. Define an enqueue callback that pushes events into the local queue
    async def _enqueue(event_type: str, data: dict) -> None:
        await queue.put({"type": event_type, **data})

    # 2. Subscribe to all monitored event types
    for et in _MONITORED_EVENTS:
        CONTEXT.event_bus.subscribe(et, _enqueue)

    try:
        # 3. Forward events to the WebSocket, sending keepalive pings on timeout
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=_KEEPALIVE_TIMEOUT)
                await websocket.send_json(event)
            except asyncio.TimeoutError:
                # Send keepalive ping and continue waiting
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        CONTEXT.logger.warning(f"[monitoring_events] unexpected error: {exc}")
    finally:
        # 4. Unsubscribe all handlers on any exit path
        for et in _MONITORED_EVENTS:
            CONTEXT.event_bus.unsubscribe(et, _enqueue)
        try:
            await websocket.close()
        except Exception:
            pass
