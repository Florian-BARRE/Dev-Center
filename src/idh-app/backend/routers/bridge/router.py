# ====== Code Summary ======
# Route definitions for the /bridge endpoints.

# ====== Standard Library Imports ======
import pathlib

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from .models import AutoRenewRequest, BridgeActionResponse, BridgeStatusResponse

router = APIRouter(tags=["bridge"])


@router.get("/bridge/{group_id}", response_model=BridgeStatusResponse)
@auto_handle_errors
async def get_bridge_status(group_id: str) -> BridgeStatusResponse:
    """
    Get the current bridge status for a project.

    Args:
        group_id (str): Telegram group ID.

    Returns:
        BridgeStatusResponse: Current bridge state (None if idle).

    Raises:
        HTTPException: 404 if the project does not exist.
    """
    # 1. Look up the project
    project = CONTEXT.state_manager.get_project(group_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")

    # 2. Return the bridge status
    return BridgeStatusResponse(group_id=group_id, bridge=project.bridge)


@router.post("/bridge/{group_id}/start", response_model=BridgeActionResponse)
@auto_handle_errors
async def start_bridge(group_id: str) -> BridgeActionResponse:
    """
    Start a bridge for a project.

    Args:
        group_id (str): Telegram group ID.

    Returns:
        BridgeActionResponse: Success status.

    Raises:
        HTTPException: 404 if the project does not exist.
    """
    # 1. Look up the project and resolve workspace
    project = CONTEXT.state_manager.get_project(group_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")

    # 2. Start the bridge using the state workspace path (if bridge exists) or project_id
    workspace = (
        pathlib.Path(project.bridge.workspace)
        if project.bridge
        else (CONTEXT.RUNTIME_CONFIG.PATH_WORKSPACES / project.project_id)
    )
    await CONTEXT.bridge_manager.start_bridge(group_id=group_id, workspace=workspace)

    return BridgeActionResponse(status="started")


@router.delete("/bridge/{group_id}", response_model=BridgeActionResponse)
@auto_handle_errors
async def stop_bridge(group_id: str) -> BridgeActionResponse:
    """
    Stop the active bridge for a project.

    Args:
        group_id (str): Telegram group ID.

    Returns:
        BridgeActionResponse: Success status.

    Raises:
        HTTPException: 404 if the project does not exist.
    """
    # 1. Verify the project exists
    project = CONTEXT.state_manager.get_project(group_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")

    # 2. Stop the bridge
    await CONTEXT.bridge_manager.stop_bridge(group_id)

    return BridgeActionResponse(status="stopped")


@router.post("/bridge/{group_id}/renew", response_model=BridgeActionResponse)
@auto_handle_errors
async def renew_bridge(group_id: str) -> BridgeActionResponse:
    """
    Renew an active bridge: stop the current process and restart it.

    Args:
        group_id (str): Telegram group ID.

    Returns:
        BridgeActionResponse: Success status.

    Raises:
        HTTPException: 404 if the project does not exist.
    """
    # 1. Verify the project exists
    project = CONTEXT.state_manager.get_project(group_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")

    # 2. Trigger renewal (stop + respawn)
    await CONTEXT.bridge_manager.renew_bridge(group_id)
    return BridgeActionResponse(status="renewed")


@router.put("/bridge/{group_id}/auto-renew", response_model=BridgeActionResponse)
@auto_handle_errors
async def set_auto_renew(group_id: str, body: AutoRenewRequest) -> BridgeActionResponse:
    """
    Toggle the auto-renew flag on an active bridge.

    Args:
        group_id (str): Telegram group ID.
        body (AutoRenewRequest): New auto_renew state.

    Returns:
        BridgeActionResponse: Success status.

    Raises:
        HTTPException: 404 if project not found.
        HTTPException: 400 if no bridge is currently active.
    """
    # 1. Look up the project
    project = CONTEXT.state_manager.get_project(group_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")

    # 2. Require an active bridge to set auto-renew
    if project.bridge is None:
        raise HTTPException(status_code=400, detail="No active bridge — start one first")

    # 3. Update the flag and persist
    project.bridge.auto_renew = body.auto_renew
    CONTEXT.state_manager.upsert_project(group_id, project)

    return BridgeActionResponse(
        status="auto_renew_on" if body.auto_renew else "auto_renew_off"
    )


@router.websocket("/bridge/{group_id}/logs")
async def bridge_logs_ws(websocket: WebSocket, group_id: str) -> None:
    """
    Stream live bridge stdout logs over WebSocket.

    Accepts the connection, then sends one line per message until the bridge
    process closes its pipe. Closes gracefully on client disconnect.

    Args:
        websocket (WebSocket): FastAPI WebSocket connection.
        group_id (str): Telegram group ID.
    """
    await websocket.accept()
    try:
        # 1. Verify the project has an active bridge
        project = CONTEXT.state_manager.get_project(group_id)
        if project is None or project.bridge is None:
            await websocket.send_text(f"No active bridge for group '{group_id}'.")
            await websocket.close()
            return

        # 2. Stream logs line by line from the bridge manager
        async for line in CONTEXT.bridge_manager.tail_logs(group_id):
            await websocket.send_text(line)

    except WebSocketDisconnect:
        pass
    finally:
        await websocket.close()
