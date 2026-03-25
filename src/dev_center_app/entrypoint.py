# ====== Code Summary ======
# Application entry point — wires all services into CONTEXT and creates the FastAPI app.

import pathlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loggerplusplus import loggerplusplus

from config import RUNTIME_CONFIG                                # MUST be first
from backend import CONTEXT, create_app
from libs.state.state_manager import StateManager
from libs.event_bus.event_bus import EventBus
from libs.session_manager.session_manager import SessionManager
from libs.git_manager.git_manager import GitManager
from libs.auth_checker.auth_checker import AuthChecker
from libs.scheduler.scheduler import SchedulerService


def _build_app() -> FastAPI:
    """
    Wire services, inject CONTEXT, and create the FastAPI application.

    Returns:
        FastAPI: The fully configured application instance.
    """
    # 1. Logger and config
    CONTEXT.logger = loggerplusplus.bind(identifier="DEV-CENTER")
    CONTEXT.RUNTIME_CONFIG = RUNTIME_CONFIG

    # 2. Core services
    CONTEXT.state_manager = StateManager(data_dir=RUNTIME_CONFIG.DATA_DIR)
    CONTEXT.event_bus = EventBus()
    CONTEXT.session_manager = SessionManager(
        state_manager=CONTEXT.state_manager,
        workspaces_dir=RUNTIME_CONFIG.WORKSPACES_DIR,
        claude_dir=RUNTIME_CONFIG.CLAUDE_DIR,
        event_bus=CONTEXT.event_bus,
        default_ttl_hours=RUNTIME_CONFIG.DEFAULT_TTL_HOURS,
        renew_threshold_minutes=RUNTIME_CONFIG.RENEW_THRESHOLD_MINUTES,
    )
    CONTEXT.git_manager = GitManager(workspaces_dir=RUNTIME_CONFIG.WORKSPACES_DIR)
    CONTEXT.auth_checker = AuthChecker(
        claude_dir=RUNTIME_CONFIG.CLAUDE_DIR,
        claude_json_path=RUNTIME_CONFIG.CLAUDE_DIR.parent / ".claude.json",
    )
    CONTEXT.scheduler = SchedulerService(
        state_manager=CONTEXT.state_manager,
        session_manager=CONTEXT.session_manager,
    )

    # 3. Create the FastAPI app
    fastapi_app = create_app(
        app_name=RUNTIME_CONFIG.FASTAPI_APP_NAME,
        debug=RUNTIME_CONFIG.FASTAPI_DEBUG_MODE,
    )

    # 4. CORS middleware — origins read from RUNTIME_CONFIG, never hardcoded
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=RUNTIME_CONFIG.CORS_ALLOWED_ORIGINS.split(","),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 5. Frontend static files (served after build; skip gracefully if dist not present)
    dist = RUNTIME_CONFIG.PATH_ROOT_DIR / "frontend" / "dist"
    if dist.exists():
        fastapi_app.mount("/", StaticFiles(directory=str(dist), html=True), name="static")

    return fastapi_app


app: FastAPI = _build_app()

__all__ = ["app"]
