# ====== Code Summary ======
# Application entry point — wires all services into CONTEXT and creates the FastAPI app.

# ====== Standard Library Imports ======
from pathlib import Path

# ====== Third-Party Library Imports ======
from fastapi import FastAPI
from fastapi.exception_handlers import http_exception_handler as default_http_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from loggerplusplus import loggerplusplus
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request

# ====== Internal Project Imports ======
from config import RUNTIME_CONFIG  # MUST be first — registers sys.path

from backend import CONTEXT, create_app
from libs.activity.activity_log import ActivityLog
from libs.bridge.bridge_manager import BridgeManager
from libs.event_bus.event_bus import EventBus
from libs.log_broadcaster.log_broadcaster import LogBroadcaster
from libs.git_ops.git_manager import GitManager
from libs.global_config.global_config_manager import GlobalConfigManager
from libs.memory.codex_summarizer import CodexSummarizer
from libs.memory.memory_manager import MemoryManager
from libs.openclaw_config.config_writer import OpenClawConfigWriter
from libs.scheduler.scheduler import SchedulerService
from libs.scheduler.telegram_notifier import TelegramNotifier
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
    # Instantiate EventBus and LogBroadcaster before services that emit events
    CONTEXT.event_bus = EventBus()
    CONTEXT.log_broadcaster = LogBroadcaster()
    CONTEXT.bridge_manager = BridgeManager(
        state_manager=CONTEXT.state_manager,
        codex_dir=RUNTIME_CONFIG.PATH_CODEX_DIR,
        claude_dir=RUNTIME_CONFIG.PATH_CLAUDE_DIR,
        bridge_ttl_hours=RUNTIME_CONFIG.BRIDGE_TTL_HOURS,
        event_bus=CONTEXT.event_bus,
    )
    CONTEXT.memory_manager = MemoryManager(
        claude_dir=RUNTIME_CONFIG.PATH_CLAUDE_DIR,
        workspaces_dir=RUNTIME_CONFIG.PATH_WORKSPACES,
        event_bus=CONTEXT.event_bus,
    )
    CONTEXT.codex_summarizer = CodexSummarizer(
        codex_dir=RUNTIME_CONFIG.PATH_CODEX_DIR,
        event_bus=CONTEXT.event_bus,
    )

    CONTEXT.activity_log = ActivityLog(max_entries=200)

    CONTEXT.global_config_manager = GlobalConfigManager(
        config_path=RUNTIME_CONFIG.PATH_DATA_DIR / "idh-global-config.json",
    )

    telegram_notifier = TelegramNotifier(bot_token=RUNTIME_CONFIG.TELEGRAM_BOT_TOKEN)
    CONTEXT.scheduler = SchedulerService(
        state_manager=CONTEXT.state_manager,
        bridge_manager=CONTEXT.bridge_manager,
        global_config_manager=CONTEXT.global_config_manager,
        activity_log=CONTEXT.activity_log,
        telegram_notifier=telegram_notifier,
        workspaces_dir=RUNTIME_CONFIG.PATH_WORKSPACES,
        event_bus=CONTEXT.event_bus,
    )

    # 3. Create the FastAPI app
    fastapi_app = create_app(
        app_name=CONTEXT.RUNTIME_CONFIG.FASTAPI_APP_NAME,
        debug=CONTEXT.RUNTIME_CONFIG.FASTAPI_DEBUG_MODE,
    )

    # 4. Mount frontend static files and register SPA catch-all handler
    frontend_dir = RUNTIME_CONFIG.PATH_ROOT_DIR_FRONTEND
    if frontend_dir.exists():
        # Serve the compiled React bundle from the dist/ directory.
        # html=True makes StaticFiles serve index.html for directory-level paths,
        # but it still returns 404 for arbitrary client-side routes like /projects/123.
        fastapi_app.mount(
            "/",
            StaticFiles(directory=frontend_dir, html=True),
            name="static",
        )

        # Catch-all: serve index.html for any 404 that is NOT an API call.
        # This enables React Router client-side navigation on hard refresh or
        # direct URL access (e.g. navigating directly to /projects/-5104943549).
        @fastapi_app.exception_handler(StarletteHTTPException)
        async def spa_fallback(request: Request, exc: StarletteHTTPException) -> FileResponse:
            if exc.status_code == 404 and not request.url.path.startswith("/api"):
                return FileResponse(str(frontend_dir / "index.html"))
            return await default_http_exception_handler(request, exc)

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
