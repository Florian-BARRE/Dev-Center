# ====== Code Summary ======
# /rules router — CLAUDE.md read/write + global rules sync.

# ====== Standard Library Imports ======
import pathlib

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, HTTPException

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from libs.state.models import GLOBAL_RULES_START, GLOBAL_RULES_END

# ====== Local Project Imports ======
from .models import RulesResponse, UpdateRulesRequest

router = APIRouter()


def _claude_md_path(workspace: str) -> pathlib.Path:
    """
    Return the CLAUDE.md path for a given workspace.

    Args:
        workspace: Absolute path to the project workspace directory.

    Returns:
        pathlib.Path: Path to CLAUDE.md inside the workspace.
    """
    return pathlib.Path(workspace) / "CLAUDE.md"


def _extract_global_block(content: str) -> str:
    """
    Extract text between global-rules markers, or empty string if not found.

    Args:
        content: Full CLAUDE.md content.

    Returns:
        str: Extracted global rules block, or empty string if markers absent.
    """
    start_idx = content.find(GLOBAL_RULES_START)
    end_idx = content.find(GLOBAL_RULES_END)
    if start_idx == -1 or end_idx == -1:
        return ""
    block_start = start_idx + len(GLOBAL_RULES_START)
    return content[block_start:end_idx].strip()


def _inject_global_block(content: str, global_rules: str) -> str:
    """
    Replace the global-rules block with updated content, or prepend if absent.

    Args:
        content: Current CLAUDE.md content.
        global_rules: New global rules content to inject.

    Returns:
        str: Updated CLAUDE.md content with injected global block.
    """
    new_block = f"{GLOBAL_RULES_START}\n{global_rules}\n{GLOBAL_RULES_END}"
    start_idx = content.find(GLOBAL_RULES_START)
    end_idx = content.find(GLOBAL_RULES_END)
    if start_idx == -1 or end_idx == -1:
        # No complete block yet — prepend
        return new_block + "\n\n" + content
    return content[:start_idx] + new_block + content[end_idx + len(GLOBAL_RULES_END):]


def _is_out_of_sync(content: str, global_rules: str) -> bool:
    """
    Check if the global rules block in CLAUDE.md differs from the current global rules.

    Args:
        content: Current CLAUDE.md content.
        global_rules: Current global rules content from data store.

    Returns:
        bool: True if the embedded block differs from global_rules.
    """
    extracted = _extract_global_block(content)
    return extracted.strip() != global_rules.strip()


@router.get("/projects/{project_id}/rules", response_model=RulesResponse)
@auto_handle_errors
async def get_rules(project_id: str) -> RulesResponse:
    """
    Read CLAUDE.md for a project and check global rules sync status.

    Args:
        project_id: ID of the project.

    Raises:
        HTTPException: 404 if the project does not exist.
        HTTPException: 404 if the workspace is not ready (CLAUDE.md missing).

    Returns:
        RulesResponse: CLAUDE.md content and sync status.
    """
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    claude_md = _claude_md_path(p.workspace_path)
    if not claude_md.exists():
        raise HTTPException(status_code=404, detail="workspace not ready")
    content = claude_md.read_text(encoding="utf-8")
    global_rules = CONTEXT.state_manager.load_global_rules()
    return RulesResponse(content=content, global_rules_out_of_sync=_is_out_of_sync(content, global_rules))


@router.put("/projects/{project_id}/rules", response_model=RulesResponse)
@auto_handle_errors
async def update_rules(project_id: str, body: UpdateRulesRequest) -> RulesResponse:
    """
    Save CLAUDE.md content for a project.

    Args:
        project_id: ID of the project.
        body: New CLAUDE.md content.

    Raises:
        HTTPException: 404 if the project does not exist.

    Returns:
        RulesResponse: Written content and sync status.
    """
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    claude_md = _claude_md_path(p.workspace_path)
    claude_md.parent.mkdir(parents=True, exist_ok=True)
    claude_md.write_text(body.content, encoding="utf-8")
    global_rules = CONTEXT.state_manager.load_global_rules()
    return RulesResponse(content=body.content, global_rules_out_of_sync=_is_out_of_sync(body.content, global_rules))


@router.post("/projects/{project_id}/rules/sync", response_model=RulesResponse)
@auto_handle_errors
async def sync_rules(project_id: str) -> RulesResponse:
    """
    Re-inject the current global rules block into CLAUDE.md.

    Args:
        project_id: ID of the project.

    Raises:
        HTTPException: 404 if the project does not exist.

    Returns:
        RulesResponse: Updated content with global rules block injected.
    """
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    claude_md = _claude_md_path(p.workspace_path)
    existing = claude_md.read_text(encoding="utf-8") if claude_md.exists() else ""
    global_rules = CONTEXT.state_manager.load_global_rules()
    updated = _inject_global_block(existing, global_rules)
    claude_md.parent.mkdir(parents=True, exist_ok=True)
    claude_md.write_text(updated, encoding="utf-8")
    return RulesResponse(content=updated, global_rules_out_of_sync=False)
