# ====== Code Summary ======
# /projects router — CRUD for dev projects.

from __future__ import annotations
import asyncio
from fastapi import APIRouter, HTTPException
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from libs.state.models import Project, derive_project_id
from .models import (
    ProjectResponse,
    ProjectListResponse,
    CreateProjectRequest,
    UpdateProjectRequest,
)

router = APIRouter()

# Track in-progress clones in memory (project_id → True).
# Module-level set so status is visible across requests within the same process.
_cloning: set[str] = set()


async def _run_clone(
    project_id: str,
    repo_url: str,
    clone_queue: asyncio.Queue,
) -> None:
    """
    Background coroutine that streams git clone output and handles success/failure.

    On success: publishes clone.done event.
    On failure: removes workspace, deletes project from state, publishes clone.done.

    Args:
        project_id (str): ID of the project being cloned.
        repo_url (str): GitHub URL to clone.
        clone_queue (asyncio.Queue): Queue to forward progress lines to WebSocket consumers.
    """
    # 1. Stream clone output line-by-line; detect errors
    success = True
    error_msg = ""
    async for line in CONTEXT.git_manager.clone(repo_url, project_id):
        # Forward every progress line to the queue for WS consumers
        await clone_queue.put({"type": "progress", "line": line})
        if line.startswith("[ERROR]"):
            success = False
            error_msg = line

    # 2. Push the terminal done message before signalling end-of-stream
    if success:
        await clone_queue.put({"type": "done", "success": True})
    else:
        await clone_queue.put({"type": "done", "success": False, "error": error_msg})

    # 3. Sentinel: tell tail_clone() the stream is over, then remove the queue entry
    await clone_queue.put(None)
    CONTEXT.git_manager.finish_clone_queue(project_id)

    # 4. On failure: remove workspace and project state
    if not success:
        CONTEXT.git_manager.cleanup(project_id)
        CONTEXT.state_manager.delete_project(project_id)

    _cloning.discard(project_id)

    # 5. Publish completion event for monitoring consumers
    await CONTEXT.event_bus.publish(
        "clone.done",
        {"success": success, "error": error_msg},
        project_id=project_id,
    )


def _to_response(p: Project) -> ProjectResponse:
    """
    Build a ProjectResponse from a Project with computed status field.

    Args:
        p (Project): The project to convert.

    Returns:
        ProjectResponse: Response with computed "cloning", "active", or "ready" status.
    """
    # 1. Determine status based on clone state and session presence
    if p.id in _cloning:
        status = "cloning"
    elif p.session is not None:
        status = "active"
    else:
        status = "ready"

    # 2. Build and return the response
    return ProjectResponse(
        id=p.id,
        name=p.name,
        repo_url=p.repo_url,
        workspace_path=p.workspace_path,
        provider=p.provider,
        model=p.model,
        schedule=p.schedule,
        session=p.session,
        status=status,
    )


@router.get("/projects", response_model=ProjectListResponse)
@auto_handle_errors
async def list_projects() -> ProjectListResponse:
    """
    List all registered projects.

    Returns:
        ProjectListResponse: All projects with computed status.
    """
    # 1. Load state and map to responses
    state = CONTEXT.state_manager.load_projects()
    return ProjectListResponse(projects=[_to_response(p) for p in state.projects.values()])


@router.get("/projects/{project_id}", response_model=ProjectResponse)
@auto_handle_errors
async def get_project(project_id: str) -> ProjectResponse:
    """
    Fetch a single project by ID.

    Args:
        project_id (str): Project slug.

    Returns:
        ProjectResponse: The project with computed status.

    Raises:
        HTTPException: 404 if the project does not exist.
    """
    # 1. Look up project or raise 404
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    return _to_response(p)


@router.post("/projects", response_model=ProjectResponse, status_code=202)
@auto_handle_errors
async def create_project(body: CreateProjectRequest) -> ProjectResponse:
    """
    Register a new project and trigger git clone in the background.

    Returns 202 immediately. Connect to WS /projects/{id}/clone/stream for progress.

    Args:
        body (CreateProjectRequest): Repo URL and optional provider/model overrides.

    Returns:
        ProjectResponse: The newly created project with status "cloning".
    """
    # 1. Derive and deduplicate project ID from repo URL
    base_id = derive_project_id(body.repo_url)
    project_id = CONTEXT.state_manager.unique_project_id(base_id)
    workspace = str(CONTEXT.git_manager.workspace_path(project_id))

    # 2. Read global defaults to fill in provider/model when not overridden
    global_cfg = CONTEXT.state_manager.load_global_config()
    project = Project(
        id=project_id,
        name=project_id,
        repo_url=body.repo_url,
        workspace_path=workspace,
        provider=body.provider or global_cfg.defaults.default_provider,
        model=body.model or global_cfg.defaults.default_model,
    )
    CONTEXT.state_manager.upsert_project(project)
    _cloning.add(project_id)

    # 3. Register a clone progress queue so the WebSocket endpoint can stream it
    clone_queue = CONTEXT.git_manager.start_clone_queue(project_id)

    # 4. Launch clone in a background task — fire-and-forget
    asyncio.create_task(_run_clone(project_id, body.repo_url, clone_queue))
    return _to_response(project)


@router.put("/projects/{project_id}", response_model=ProjectResponse)
@auto_handle_errors
async def update_project(project_id: str, body: UpdateProjectRequest) -> ProjectResponse:
    """
    Update project model, provider, schedule, or auto_renew flag.

    Args:
        project_id (str): Project slug.
        body (UpdateProjectRequest): Fields to update (all optional).

    Returns:
        ProjectResponse: Updated project.

    Raises:
        HTTPException: 404 if the project does not exist.
    """
    # 1. Fetch project or raise 404
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    # 2. Apply partial updates
    if body.model is not None:
        p.model = body.model
    if body.provider is not None:
        p.provider = body.provider
    if body.schedule is not None:
        p.schedule = body.schedule
    if body.auto_renew is not None and p.session is not None:
        p.session.auto_renew = body.auto_renew

    # 3. Persist and return
    CONTEXT.state_manager.upsert_project(p)
    return _to_response(p)


@router.delete("/projects/{project_id}", status_code=204)
@auto_handle_errors
async def delete_project(project_id: str) -> None:
    """
    Stop session if active, remove workspace and project from state.

    Args:
        project_id (str): Project slug.
    """
    # 1. Stop active session before removing files
    await CONTEXT.session_manager.stop_session(project_id)

    # 2. Remove workspace directory from disk (no-op if already absent)
    CONTEXT.git_manager.cleanup(project_id)

    # 3. Remove project entry from state
    CONTEXT.state_manager.delete_project(project_id)
