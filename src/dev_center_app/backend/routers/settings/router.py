# ====== Code Summary ======
# /settings router — global config + global rules CRUD.

# ====== Standard Library Imports ======
import pathlib

# ====== Third-Party Library Imports ======
from fastapi import APIRouter

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors
from libs.state.models import GLOBAL_RULES_START, GLOBAL_RULES_END

# ====== Local Project Imports ======
from .models import (
    GlobalConfigResponse,
    UpdateGlobalConfigRequest,
    GlobalRulesResponse,
    UpdateGlobalRulesRequest,
)

router = APIRouter()


def _count_out_of_sync(global_rules: str) -> int:
    """
    Count projects whose CLAUDE.md global block differs from current global_rules.

    Args:
        global_rules (str): Current global rules content from the data store.

    Returns:
        int: Number of projects with an out-of-sync global rules block.
    """
    # 1. Load all projects from state
    state = CONTEXT.state_manager.load_projects()
    count = 0

    # 2. Check each project's CLAUDE.md for the global rules block
    for project in state.projects.values():
        claude_md = pathlib.Path(project.workspace_path) / "CLAUDE.md"
        if not claude_md.exists():
            # Missing CLAUDE.md — project hasn't been set up yet, skip
            continue
        content = claude_md.read_text(encoding="utf-8")
        start_idx = content.find(GLOBAL_RULES_START)
        end_idx = content.find(GLOBAL_RULES_END)

        # 3. Count as out-of-sync if markers are missing or block content differs
        if start_idx == -1 or end_idx == -1:
            count += 1
            continue
        block = content[start_idx + len(GLOBAL_RULES_START) : end_idx].strip()
        if block != global_rules.strip():
            count += 1

    return count


@router.get("/settings", response_model=GlobalConfigResponse)
@auto_handle_errors
async def get_settings() -> GlobalConfigResponse:
    """
    Return the current global configuration.

    Returns:
        GlobalConfigResponse: Global defaults and schedule configuration.
    """
    # 1. Load config from state manager and return it
    cfg = CONTEXT.state_manager.load_global_config()
    return GlobalConfigResponse(defaults=cfg.defaults, schedule=cfg.schedule)


@router.put("/settings", response_model=GlobalConfigResponse)
@auto_handle_errors
async def update_settings(body: UpdateGlobalConfigRequest) -> GlobalConfigResponse:
    """
    Update global configuration defaults and/or schedule.

    Args:
        body: Fields to update (both optional).

    Returns:
        GlobalConfigResponse: Updated global defaults and schedule.
    """
    # 1. Load current config
    cfg = CONTEXT.state_manager.load_global_config()

    # 2. Apply partial updates from the request body
    if body.defaults is not None:
        cfg.defaults = body.defaults
    if body.schedule is not None:
        cfg.schedule = body.schedule

    # 3. Persist and return updated config
    CONTEXT.state_manager.save_global_config(cfg)
    return GlobalConfigResponse(defaults=cfg.defaults, schedule=cfg.schedule)


@router.get("/settings/rules", response_model=GlobalRulesResponse)
@auto_handle_errors
async def get_global_rules() -> GlobalRulesResponse:
    """
    Return the current global rules content with out-of-sync project count.

    Returns:
        GlobalRulesResponse: Global rules content and count of out-of-sync projects.
    """
    # 1. Load rules and compute out-of-sync count
    content = CONTEXT.state_manager.load_global_rules()
    return GlobalRulesResponse(content=content, out_of_sync_projects=_count_out_of_sync(content))


@router.put("/settings/rules", response_model=GlobalRulesResponse)
@auto_handle_errors
async def update_global_rules(body: UpdateGlobalRulesRequest) -> GlobalRulesResponse:
    """
    Save new global rules content.

    Args:
        body: New global rules markdown content.

    Returns:
        GlobalRulesResponse: Saved content and count of out-of-sync projects.
    """
    # 1. Persist the new rules
    CONTEXT.state_manager.save_global_rules(body.content)

    # 2. Return saved content with out-of-sync count
    return GlobalRulesResponse(
        content=body.content,
        out_of_sync_projects=_count_out_of_sync(body.content),
    )
