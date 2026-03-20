# ====== Code Summary ======
# Application entry point — wires all services into CONTEXT and creates the FastAPI app.

# ====== Standard Library Imports ======
from pathlib import Path

# ====== Third-Party Library Imports ======
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loggerplusplus import loggerplusplus

# ====== Internal Project Imports ======
from config import RUNTIME_CONFIG  # MUST be first — registers sys.path

from backend import CONTEXT, create_app
from libs.bridge.bridge_manager import BridgeManager
from libs.git_ops.git_manager import GitManager
from libs.memory.codex_summarizer import CodexSummarizer
from libs.memory.memory_manager import MemoryManager
from libs.openclaw_config.config_writer import OpenClawConfigWriter
from libs.state.state_manager import StateManager
from libs.webhook.webhook_client import WebhookClient


def _build_app() -> FastAPI:
    """
    Assemble and return a fully configured FastAPI application.

    Returns:
        FastAPI: The configured application instance.
    """
    # 1. Inject logger and config into CONTEXT
    CONTEXT.logger = loggerplusplus.bind(identifier="BACKEND")
    CONTEXT.RUNTIME_CONFIG = RUNTIME_CONFIG

    # 2. Instantiate and inject all services
    CONTEXT.state_manager = StateManager(
        state_path=RUNTIME_CONFIG.PATH_STATE_FILE,
    )
    CONTEXT.openclaw_writer = OpenClawConfigWriter(
        config_path=RUNTIME_CONFIG.PATH_OPENCLAW_CONFIG,
        gateway_port=RUNTIME_CONFIG.OPENCLAW_GATEWAY_PORT,
    )
    CONTEXT.git_manager = GitManager(
        workspaces_dir=RUNTIME_CONFIG.PATH_WORKSPACES,
    )
    CONTEXT.webhook_client = WebhookClient(
        webhook_url="",  # Placeholder — no webhook URL in RUNTIME_CONFIG yet
    )
    CONTEXT.bridge_manager = BridgeManager(
        state_manager=CONTEXT.state_manager,
        codex_dir=RUNTIME_CONFIG.PATH_CODEX_DIR,
        claude_dir=RUNTIME_CONFIG.PATH_CLAUDE_DIR,
        bridge_ttl_hours=RUNTIME_CONFIG.BRIDGE_TTL_HOURS,
    )
    CONTEXT.memory_manager = MemoryManager(
        claude_dir=RUNTIME_CONFIG.PATH_CLAUDE_DIR,
    )
    CONTEXT.codex_summarizer = CodexSummarizer(
        codex_dir=RUNTIME_CONFIG.PATH_CODEX_DIR,
    )

    # 3. Create the FastAPI app
    fastapi_app = create_app(
        app_name=CONTEXT.RUNTIME_CONFIG.FASTAPI_APP_NAME,
        debug=CONTEXT.RUNTIME_CONFIG.FASTAPI_DEBUG_MODE,
    )

    # 4. Mount frontend static files only if the dist directory exists
    frontend_dir = RUNTIME_CONFIG.PATH_ROOT_DIR_FRONTEND
    if frontend_dir.exists():
        fastapi_app.mount(
            "/",
            StaticFiles(directory=frontend_dir, html=True),
            name="static",
        )

    # 5. Add CORS middleware
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=RUNTIME_CONFIG.CORS_ALLOWED_ORIGINS.split(","),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return fastapi_app


app: FastAPI = _build_app()

__all__ = ["app"]
