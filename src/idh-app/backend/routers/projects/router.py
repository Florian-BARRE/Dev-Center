# ====== Code Summary ======
# Route definitions for the /projects endpoints.

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, HTTPException

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from libs.state.models import ModelOverride, Project
from .models import CreateProjectRequest, ProjectListResponse, ProjectResponse

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


@router.post("/projects/", response_model=ProjectResponse)
@auto_handle_errors
async def create_project(body: CreateProjectRequest) -> ProjectResponse:
    """
    Create a new IDH project from the plugin wizard.

    Orchestrates: git clone → memory init → openclaw.json registration
    → openclaw reload → bridge start → state persistence.

    Args:
        body (CreateProjectRequest): Project creation parameters.

    Returns:
        ProjectResponse: The newly created project.

    Raises:
        HTTPException: 409 if a project already exists for this group.
    """
    # 1. Reject duplicate group binding
    if CONTEXT.state_manager.get_project(body.group_id) is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Project for group '{body.group_id}' already exists",
        )

    # 2. Derive project_id from repo URL slug (last path segment, strip .git)
    project_id = body.repo_url.rstrip("/").split("/")[-1].removesuffix(".git")

    # 3. Clone the repository into the shared workspace
    workspace = await CONTEXT.git_manager.clone(body.repo_url, project_id)

    # 4. Initialise the project memory file
    CONTEXT.memory_manager.write_memory(project_id, "# Project Memory\n")

    # 5. Register the Telegram group with the OpenClaw gateway and reload config.
    # Any write to openclaw.json must be followed by a reload call (spec §4.1).
    CONTEXT.openclaw_writer.register_group(
        group_id=body.group_id,
        project_id=project_id,
        agent_id=project_id,
    )
    await CONTEXT.openclaw_writer.reload()

    # 6. Start the coding bridge for the new workspace
    await CONTEXT.bridge_manager.start_bridge(
        group_id=body.group_id, workspace=workspace
    )

    # 7. Build the project with model override from the wizard
    project = Project(
        group_id=body.group_id,
        project_id=project_id,
        repo_url=body.repo_url,
        model_override=ModelOverride(provider=body.provider, model=body.model),
    )

    # 8. Persist to state file
    CONTEXT.state_manager.upsert_project(body.group_id, project)

    return ProjectResponse(**project.model_dump())
