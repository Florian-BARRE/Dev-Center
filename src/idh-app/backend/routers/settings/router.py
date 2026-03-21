# ====== Code Summary ======
# Route definitions for the /settings endpoints.

# ====== Standard Library Imports ======
import hashlib
import hmac
import json

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, Header, HTTPException, Request

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from libs.state.models import ModelOverride, Project
from .models import ModelUpdateRequest, SettingsResponse, TelegramPromptRequest, WebhookPayload

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
