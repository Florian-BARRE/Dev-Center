# ====== Code Summary ======
# Route definitions for the /projects endpoints.

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, HTTPException

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from .models import ProjectListResponse, ProjectResponse

router = APIRouter(tags=["projects"])


@router.get("/projects", response_model=ProjectListResponse)
@auto_handle_errors
async def list_projects() -> ProjectListResponse:
    """
    List all registered IDH projects.

    Returns:
        ProjectListResponse: All projects from the state file.
    """
    # 1. Load the full state and return the projects list
    state = CONTEXT.state_manager.load()
    return ProjectListResponse(projects=list(state.projects.values()))


@router.get("/projects/{group_id}", response_model=ProjectResponse)
@auto_handle_errors
async def get_project(group_id: str) -> ProjectResponse:
    """
    Retrieve a single project by Telegram group ID.

    Args:
        group_id (str): Telegram group ID.

    Returns:
        ProjectResponse: The project data.

    Raises:
        HTTPException: 404 if the project does not exist.
    """
    # 1. Fetch and validate the project exists
    project = CONTEXT.state_manager.get_project(group_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")

    return ProjectResponse(**project.model_dump())


@router.delete("/projects/{group_id}", response_model=ProjectResponse)
@auto_handle_errors
async def delete_project(group_id: str) -> ProjectResponse:
    """
    Delete a project and stop its bridge.

    Args:
        group_id (str): Telegram group ID.

    Returns:
        ProjectResponse: The deleted project data.

    Raises:
        HTTPException: 404 if the project does not exist.
    """
    # 1. Verify the project exists before deletion
    project = CONTEXT.state_manager.get_project(group_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")

    # 2. Stop the bridge if active
    await CONTEXT.bridge_manager.stop_bridge(group_id)

    # 3. Atomically remove from state
    CONTEXT.state_manager.delete_project(group_id)

    # 4. Fire deletion webhook (no-op if URL not configured)
    CONTEXT.webhook_client.project_deleted(
        group_id=group_id, project_id=project.project_id
    )

    return ProjectResponse(**project.model_dump())
