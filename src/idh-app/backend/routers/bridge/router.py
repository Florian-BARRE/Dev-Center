# ====== Code Summary ======
# Route definitions for the /bridge endpoints.

# ====== Standard Library Imports ======
import pathlib

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, HTTPException

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from .models import BridgeActionResponse, BridgeStatusResponse

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
