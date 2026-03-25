# ====== Code Summary ======
# /rules router — CLAUDE.md read/write + global rules sync.

# ====== Standard Library Imports ======
import pathlib

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from libs.state.models import GLOBAL_RULES_START, GLOBAL_RULES_END

# ====== Local Project Imports ======
from .models import RulesResponse, UpdateRulesRequest, RulesFile, RulesFilesResponse

router = APIRouter()


def _rule_files_dir(project_id: str) -> pathlib.Path:
    """
    Return (and create) the directory that stores uploaded rule files for a project.

    Files live at DATA_DIR/rule_files/<project_id>/ so they persist across
    re-clones and are independent of the workspace.

    Args:
        project_id: Project slug.

    Returns:
        pathlib.Path: Absolute path to the rule files directory.
    """
    d = CONTEXT.RUNTIME_CONFIG.DATA_DIR / "rule_files" / project_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _apply_rule_files(project_id: str, workspace_path: str) -> RulesResponse:
    """
    Concatenate all uploaded rule files alphabetically and write them as the
    project-specific section of CLAUDE.md.

    The global rules block (between markers) is preserved if present.

    Args:
        project_id: Project slug.
        workspace_path: Absolute path to the workspace directory.

    Returns:
        RulesResponse: Updated CLAUDE.md content and sync status.
    """
    # 1. Gather .md files sorted alphabetically by filename (case-insensitive)
    files_dir = _rule_files_dir(project_id)
    md_files = sorted(
        [f for f in files_dir.iterdir() if f.suffix.lower() == ".md"],
        key=lambda f: f.name.lower(),
    )
    combined = "\n\n---\n\n".join(f.read_text(encoding="utf-8") for f in md_files)

    # 2. Read existing CLAUDE.md to extract the global block if present
    claude_md = _claude_md_path(workspace_path)
    existing = claude_md.read_text(encoding="utf-8") if claude_md.exists() else ""
    global_rules = CONTEXT.state_manager.load_global_rules()

    # 3. Reconstruct: preserve global block, replace project section
    end_idx = existing.find(GLOBAL_RULES_END)
    if end_idx != -1:
        global_section = existing[: end_idx + len(GLOBAL_RULES_END)]
        new_content = f"{global_section}\n\n{combined}".rstrip() if combined else global_section
    else:
        new_content = combined

    # 4. Write CLAUDE.md
    claude_md.parent.mkdir(parents=True, exist_ok=True)
    claude_md.write_text(new_content, encoding="utf-8")

    return RulesResponse(
        content=new_content,
        global_rules_out_of_sync=_is_out_of_sync(new_content, global_rules),
    )


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
    # CLAUDE.md may not exist yet in freshly cloned repos — return empty content
    # so the UI can let the user create it, rather than blocking with a 404.
    if not pathlib.Path(p.workspace_path).exists():
        raise HTTPException(status_code=404, detail="workspace not ready")
    content = claude_md.read_text(encoding="utf-8") if claude_md.exists() else ""
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


@router.get("/projects/{project_id}/rules/files", response_model=RulesFilesResponse)
@auto_handle_errors
async def list_rule_files(project_id: str) -> RulesFilesResponse:
    """
    List uploaded rule files for a project, sorted alphabetically.

    Args:
        project_id: ID of the project.

    Raises:
        HTTPException: 404 if the project does not exist.

    Returns:
        RulesFilesResponse: Alphabetically sorted list of uploaded rule files.
    """
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")
    files_dir = _rule_files_dir(project_id)
    md_files = sorted(
        [f for f in files_dir.iterdir() if f.suffix.lower() == ".md"],
        key=lambda f: f.name.lower(),
    )
    return RulesFilesResponse(
        files=[RulesFile(filename=f.name, size=f.stat().st_size) for f in md_files]
    )


@router.post("/projects/{project_id}/rules/files", response_model=RulesResponse)
@auto_handle_errors
async def upload_rule_files(
    project_id: str,
    files: List[UploadFile] = File(...),
) -> RulesResponse:
    """
    Upload one or more .md rule files and auto-apply them to CLAUDE.md.

    Files are stored at DATA_DIR/rule_files/<project_id>/ and concatenated
    alphabetically into the project-specific section of CLAUDE.md.

    Args:
        project_id: ID of the project.
        files: One or more uploaded .md files.

    Raises:
        HTTPException: 404 if the project does not exist.
        HTTPException: 400 if a file is not a .md file.

    Returns:
        RulesResponse: Updated CLAUDE.md content after applying all rule files.
    """
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    files_dir = _rule_files_dir(project_id)
    for upload in files:
        filename = pathlib.Path(upload.filename or "").name
        if not filename.lower().endswith(".md"):
            raise HTTPException(status_code=400, detail=f"Only .md files are accepted (got '{filename}')")
        dest = files_dir / filename
        dest.write_bytes(await upload.read())

    return _apply_rule_files(project_id, p.workspace_path)


@router.delete("/projects/{project_id}/rules/files/{filename}", response_model=RulesResponse)
@auto_handle_errors
async def delete_rule_file(project_id: str, filename: str) -> RulesResponse:
    """
    Delete an uploaded rule file and re-apply the remaining files to CLAUDE.md.

    Args:
        project_id: ID of the project.
        filename: Name of the file to delete.

    Raises:
        HTTPException: 404 if the project or file does not exist.

    Returns:
        RulesResponse: Updated CLAUDE.md content after deletion.
    """
    p = CONTEXT.state_manager.get_project(project_id)
    if p is None:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    target = _rule_files_dir(project_id) / filename
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found")
    target.unlink()

    return _apply_rule_files(project_id, p.workspace_path)


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
