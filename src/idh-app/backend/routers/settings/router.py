# ====== Code Summary ======
# Route definitions for the /settings endpoints.

# ====== Standard Library Imports ======
import hashlib
import hmac
import json
import pathlib

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, Header, HTTPException, Request, UploadFile, File

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from libs.state.models import ModelOverride, Project
from .models import FileContentResponse, FileWriteRequest, ModelResponse, ModelUpdateRequest, RuleFileInfo, RuleFilesListResponse, SettingsResponse, TelegramPromptRequest, TelegramPromptResponse, WebhookPayload

router = APIRouter(tags=["settings"])


def _verify_signature(body: bytes, signature: str) -> bool:
    """
    Verify an HMAC-SHA256 webhook signature.

    Args:
        body (bytes): Raw request body bytes.
        signature (str): Signature header value (``sha256=<hex>``).

    Returns:
        bool: True if the signature matches, False otherwise.
    """
    # 1. Compute expected HMAC-SHA256 digest
    secret = CONTEXT.RUNTIME_CONFIG.IDH_WEBHOOK_SECRET.encode()
    expected = "sha256=" + hmac.new(secret, body, hashlib.sha256).hexdigest()

    # 2. Compare constant-time to prevent timing attacks
    return hmac.compare_digest(expected, signature)


@router.post("/settings/webhook", response_model=SettingsResponse)
@auto_handle_errors
async def handle_webhook(
    request: Request,
    x_idh_signature: str = Header(..., alias="X-IDH-Signature"),
) -> SettingsResponse:
    """
    Receive and process an IDH project creation webhook.

    Validates the HMAC signature, then orchestrates the full project setup:
    git clone, memory initialisation, OpenClaw registration, bridge start,
    state persistence, and webhook notification.

    Args:
        request (Request): Raw FastAPI request (needed to read body bytes).
        x_idh_signature (str): HMAC-SHA256 signature from the request header.

    Returns:
        SettingsResponse: Success status.

    Raises:
        HTTPException: 403 if the signature is invalid.
    """
    # 1. Read raw body bytes and validate signature
    body = await request.body()
    if not _verify_signature(body, x_idh_signature):
        raise HTTPException(status_code=403, detail="Invalid signature")

    # 2. Parse the validated payload
    payload = WebhookPayload(**json.loads(body))

    # 3. Clone the repository into a workspace directory
    workspace = await CONTEXT.git_manager.clone(payload.repo_url, payload.project_id)

    # 4. Initialise the project memory file
    CONTEXT.memory_manager.write_memory(payload.project_id, "# Project Memory\n")

    # 5. Register the Telegram group with the OpenClaw gateway
    CONTEXT.openclaw_writer.register_group(
        group_id=payload.group_id,
        project_id=payload.project_id,
        agent_id=payload.agent_id,
    )

    # 6. Start a bridge for the project workspace
    await CONTEXT.bridge_manager.start_bridge(
        group_id=payload.group_id, workspace=workspace
    )

    # 7. Persist the new project in state
    CONTEXT.state_manager.upsert_project(
        payload.group_id,
        Project(
            group_id=payload.group_id,
            project_id=payload.project_id,
            repo_url=payload.repo_url,
        ),
    )

    # 8. Fire the project_created lifecycle event
    CONTEXT.webhook_client.project_created(
        group_id=payload.group_id, project_id=payload.project_id
    )

    return SettingsResponse(status="ok")


@router.put("/settings/telegram/prompt/{agent_id}", response_model=SettingsResponse)
@auto_handle_errors
async def put_telegram_prompt(
    agent_id: str, body: TelegramPromptRequest
) -> SettingsResponse:
    """
    Update the system prompt for a Telegram agent in openclaw.json.

    Args:
        agent_id (str): OpenClaw agent identifier.
        body (TelegramPromptRequest): Request body containing the new system prompt.

    Returns:
        SettingsResponse: Success status.
    """
    # 1. Delegate to the OpenClaw config writer
    CONTEXT.openclaw_writer.update_agent_system_prompt(agent_id, body.system_prompt)
    return SettingsResponse(status="ok")


@router.put("/settings/{group_id}/model", response_model=SettingsResponse)
@auto_handle_errors
async def put_model(group_id: str, body: ModelUpdateRequest) -> SettingsResponse:
    """
    Update the model override for a project (called from /agent wizard).

    Args:
        group_id (str): Telegram group ID.
        body (ModelUpdateRequest): New provider and model.

    Returns:
        SettingsResponse: Success status.

    Raises:
        HTTPException: 404 if the project does not exist.
    """
    # 1. Atomically read-modify-write the model override (raises 404 if missing)
    CONTEXT.state_manager.set_model_override(
        group_id,
        ModelOverride(provider=body.provider, model=body.model),
    )

    return SettingsResponse(status="ok")


@router.get("/settings/global/coding-rules", response_model=FileContentResponse)
@auto_handle_errors
async def get_global_coding_rules() -> FileContentResponse:
    """
    Read CODING_RULES.md content.

    Returns:
        FileContentResponse: Content of CODING_RULES.md.

    Raises:
        HTTPException: 404 if the file does not exist.
    """
    # 1. Resolve path and check existence
    path: pathlib.Path = CONTEXT.RUNTIME_CONFIG.PATH_RULES_DIR / "CODING_RULES.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail="CODING_RULES.md not found")

    # 2. Read and return content
    return FileContentResponse(content=path.read_text())


@router.put("/settings/global/coding-rules", response_model=SettingsResponse)
@auto_handle_errors
async def put_global_coding_rules(body: FileWriteRequest) -> SettingsResponse:
    """
    Write CODING_RULES.md content.

    Args:
        body (FileWriteRequest): New content to write.

    Returns:
        SettingsResponse: Success status.
    """
    # 1. Ensure directory exists and write file
    path: pathlib.Path = CONTEXT.RUNTIME_CONFIG.PATH_RULES_DIR / "CODING_RULES.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body.content)
    return SettingsResponse(status="ok")


@router.get("/settings/global/common-context", response_model=FileContentResponse)
@auto_handle_errors
async def get_global_common_context() -> FileContentResponse:
    """
    Read COMMON_CONTEXT.md content.

    Returns:
        FileContentResponse: Content of COMMON_CONTEXT.md.

    Raises:
        HTTPException: 404 if the file does not exist.
    """
    # 1. Resolve path and check existence
    path: pathlib.Path = CONTEXT.RUNTIME_CONFIG.PATH_RULES_DIR / "COMMON_CONTEXT.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail="COMMON_CONTEXT.md not found")

    # 2. Read and return content
    return FileContentResponse(content=path.read_text())


@router.put("/settings/global/common-context", response_model=SettingsResponse)
@auto_handle_errors
async def put_global_common_context(body: FileWriteRequest) -> SettingsResponse:
    """
    Write COMMON_CONTEXT.md content.

    Args:
        body (FileWriteRequest): New content to write.

    Returns:
        SettingsResponse: Success status.
    """
    # 1. Ensure directory exists and write file
    path: pathlib.Path = CONTEXT.RUNTIME_CONFIG.PATH_RULES_DIR / "COMMON_CONTEXT.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body.content)
    return SettingsResponse(status="ok")


@router.get("/settings/{group_id}/claude-md", response_model=FileContentResponse)
@auto_handle_errors
async def get_project_claude_md(group_id: str) -> FileContentResponse:
    """
    Read the CLAUDE.md file for a project.

    Args:
        group_id (str): Telegram group ID.

    Returns:
        FileContentResponse: CLAUDE.md content.

    Raises:
        HTTPException: 404 if project or file not found.
    """
    # 1. Look up project to get project_id
    project = CONTEXT.state_manager.get_project(group_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")

    # 2. Read CLAUDE.md from workspace
    path = CONTEXT.RUNTIME_CONFIG.PATH_WORKSPACES / project.project_id / "CLAUDE.md"
    if not path.exists():
        raise HTTPException(status_code=404, detail="CLAUDE.md not found in workspace")
    return FileContentResponse(content=path.read_text())


@router.put("/settings/{group_id}/claude-md", response_model=SettingsResponse)
@auto_handle_errors
async def put_project_claude_md(group_id: str, body: FileWriteRequest) -> SettingsResponse:
    """
    Write CLAUDE.md for a project.

    Args:
        group_id (str): Telegram group ID.
        body (FileWriteRequest): New content.

    Returns:
        SettingsResponse: Success status.

    Raises:
        HTTPException: 404 if project not found.
    """
    # 1. Look up project
    project = CONTEXT.state_manager.get_project(group_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")

    # 2. Write to workspace CLAUDE.md
    path = CONTEXT.RUNTIME_CONFIG.PATH_WORKSPACES / project.project_id / "CLAUDE.md"
    path.write_text(body.content)
    return SettingsResponse(status="ok")


@router.get("/settings/{group_id}/telegram-prompt", response_model=TelegramPromptResponse)
@auto_handle_errors
async def get_telegram_prompt(group_id: str) -> TelegramPromptResponse:
    """
    Read the Telegram agent system prompt for a project.

    Args:
        group_id (str): Telegram group ID.

    Returns:
        TelegramPromptResponse: Agent ID and current system prompt.

    Raises:
        HTTPException: 404 if project not found.
    """
    # 1. Look up project
    project = CONTEXT.state_manager.get_project(group_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")

    # 2. Read from openclaw.json via config writer (agent_id == project_id by convention)
    agent_id = project.project_id
    prompt = CONTEXT.openclaw_writer.get_agent_system_prompt(agent_id)
    return TelegramPromptResponse(agent_id=agent_id, system_prompt=prompt)


@router.get("/settings/{group_id}/model", response_model=ModelResponse)
@auto_handle_errors
async def get_model(group_id: str) -> ModelResponse:
    """
    Read the model override for a project.

    Args:
        group_id (str): Telegram group ID.

    Returns:
        ModelResponse: Current provider and model.

    Raises:
        HTTPException: 404 if project not found.
    """
    # 1. Look up project
    project = CONTEXT.state_manager.get_project(group_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")

    # 2. Return current model override (empty strings if no override set)
    if project.model_override:
        return ModelResponse(provider=project.model_override.provider, model=project.model_override.model)
    return ModelResponse(provider="", model="")


# ──────────────────────────── Rule source files ──────────────────────────────

def _sources_dir() -> pathlib.Path:
    """Return the directory that stores individual uploaded rule source files."""
    return CONTEXT.RUNTIME_CONFIG.PATH_RULES_DIR / "sources"


@router.get("/settings/global/coding-rules/files", response_model=RuleFilesListResponse)
@auto_handle_errors
async def list_rule_files() -> RuleFilesListResponse:
    """
    List all uploaded rule source files in the sources/ directory.

    Returns:
        RuleFilesListResponse: Sorted list of rule file metadata.
    """
    # 1. Ensure the sources directory exists before listing
    sources = _sources_dir()
    sources.mkdir(parents=True, exist_ok=True)

    # 2. Collect metadata for every .md file, sorted alphabetically
    files = sorted(
        [
            RuleFileInfo(filename=f.name, size_bytes=f.stat().st_size)
            for f in sources.iterdir()
            if f.is_file() and f.suffix == ".md"
        ],
        key=lambda x: x.filename,
    )
    return RuleFilesListResponse(files=files)


@router.post("/settings/global/coding-rules/upload", response_model=SettingsResponse)
@auto_handle_errors
async def upload_rule_file(file: UploadFile = File(...)) -> SettingsResponse:
    """
    Upload a Markdown rule source file to the sources/ directory.

    Only ``.md`` files are accepted. Existing files with the same name
    are silently overwritten.

    Args:
        file (UploadFile): The uploaded Markdown file.

    Returns:
        SettingsResponse: Success status.

    Raises:
        HTTPException: 400 if the file is not a ``.md`` file.
    """
    # 1. Validate extension
    if not (file.filename or "").lower().endswith(".md"):
        raise HTTPException(status_code=400, detail="Only .md files are accepted.")

    # 2. Write the uploaded file to sources/
    sources = _sources_dir()
    sources.mkdir(parents=True, exist_ok=True)
    dest = sources / pathlib.Path(file.filename).name
    dest.write_bytes(await file.read())

    return SettingsResponse(status="ok")


@router.delete("/settings/global/coding-rules/files/{filename}", response_model=SettingsResponse)
@auto_handle_errors
async def delete_rule_file(filename: str) -> SettingsResponse:
    """
    Delete a rule source file from the sources/ directory.

    Args:
        filename (str): Name of the file to delete (e.g. ``python.md``).

    Returns:
        SettingsResponse: Success status.

    Raises:
        HTTPException: 404 if the file does not exist.
    """
    # 1. Resolve and validate the target path
    target = _sources_dir() / filename
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found.")

    # 2. Delete the file
    target.unlink()
    return SettingsResponse(status="ok")


@router.post("/settings/global/coding-rules/combine", response_model=FileContentResponse)
@auto_handle_errors
async def combine_rule_files() -> FileContentResponse:
    """
    Concatenate all rule source files into CODING_RULES.md.

    Files are joined in alphabetical order, each prefixed with a header
    indicating the source filename. The result is written to
    ``rules/CODING_RULES.md`` and returned in the response.

    Returns:
        FileContentResponse: The combined content that was written.

    Raises:
        HTTPException: 404 if the sources/ directory contains no .md files.
    """
    # 1. Collect source files sorted alphabetically
    sources = _sources_dir()
    sources.mkdir(parents=True, exist_ok=True)
    md_files = sorted(f for f in sources.iterdir() if f.is_file() and f.suffix == ".md")

    if not md_files:
        raise HTTPException(status_code=404, detail="No rule source files found. Upload at least one .md file first.")

    # 2. Build combined content: header block + each file separated by a divider
    sections = []
    for f in md_files:
        sections.append(f"<!-- Source: {f.name} -->\n{f.read_text()}")
    combined = "\n\n---\n\n".join(sections)

    # 3. Persist to CODING_RULES.md
    output = CONTEXT.RUNTIME_CONFIG.PATH_RULES_DIR / "CODING_RULES.md"
    output.write_text(combined)

    return FileContentResponse(content=combined)
