# ====== Code Summary ======
# /projects/{id}/session routes — start/stop/renew + WebSocket log stream.

import asyncio
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from .models import SessionResponse

router = APIRouter()


@router.post("/projects/{project_id}/session/start", response_model=SessionResponse)
@auto_handle_errors
async def start_session(project_id: str) -> SessionResponse:
    """Start a claude remote-control session for the project."""
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    if p.session is not None:
        raise HTTPException(status_code=422, detail=f"Session already active for '{project_id}'")
    try:
        await CONTEXT.session_manager.start_session(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
    p = CONTEXT.state_manager.get_project(project_id)
    return SessionResponse(project_id=project_id, session=p.session)


@router.post("/projects/{project_id}/session/stop", status_code=204)
@auto_handle_errors
async def stop_session(project_id: str) -> None:
    """Stop the active session for a project."""
    await CONTEXT.session_manager.stop_session(project_id)


@router.post("/projects/{project_id}/session/renew", response_model=SessionResponse)
@auto_handle_errors
async def renew_session(project_id: str) -> SessionResponse:
    """Renew the session (stop + restart with --continue)."""
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    await CONTEXT.session_manager.renew_session(project_id)
    p = CONTEXT.state_manager.get_project(project_id)
    return SessionResponse(project_id=project_id, session=p.session)


@router.websocket("/projects/{project_id}/session/logs")
async def session_logs(websocket: WebSocket, project_id: str) -> None:
    """
    WebSocket endpoint streaming live stdout from the session subprocess.

    Sends { "line": "..." } messages until client disconnects.
    Sends { "line": "(no active session)" } and closes if no session running.
    """
    await websocket.accept()
    try:
        async for line in CONTEXT.session_manager.tail_logs(project_id):
            await websocket.send_json({"line": line})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@router.websocket("/projects/{project_id}/clone/stream")
async def clone_stream(websocket: WebSocket, project_id: str) -> None:
    """
    WebSocket endpoint streaming git clone progress for a project.

    Sends { "type": "progress", "line": "..." } lines during clone.
    Sends { "type": "done", "success": true } on success.
    Sends { "type": "done", "success": false, "error": "..." } on failure.
    Closes immediately with { "type": "done", "success": false } if no clone in progress.
    """
    await websocket.accept()
    try:
        async for msg in CONTEXT.git_manager.tail_clone(project_id):
            await websocket.send_json(msg)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
