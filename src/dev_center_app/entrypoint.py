# ====== Code Summary ======
# Application entry point — wires all services into CONTEXT and creates the FastAPI app.

import pathlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from loggerplusplus import loggerplusplus
from loggerplusplus import formats as lpp_formats

from config import RUNTIME_CONFIG                                # MUST be first
from backend import CONTEXT, create_app
from libs.state.state_manager import StateManager
from libs.event_bus.event_bus import EventBus
from libs.session_manager.session_manager import SessionManager
from libs.git_manager.git_manager import GitManager
from libs.auth_checker.auth_checker import AuthChecker
from libs.scheduler.scheduler import SchedulerService
from libs.log_broadcaster.log_broadcaster import LogBroadcaster


def _build_app() -> FastAPI:
    """
    Wire services, inject CONTEXT, and create the FastAPI application.

    Returns:
        FastAPI: The fully configured application instance.
    """
    # 1. Logger, config, and log broadcaster
    # Register the broadcaster sink with the same format used by the console sink
    # (defined in runtime_config.py) so the UI receives the same structured output
    # the developer sees in the terminal — identifier, level, message included.
    # colorize=False strips ANSI colour codes since the browser renders plain text.
    CONTEXT.log_broadcaster = LogBroadcaster()
    _fmt = getattr(lpp_formats, RUNTIME_CONFIG.LOGGING_LPP_FORMAT, lpp_formats.DebugFormat())()
    loggerplusplus.add(CONTEXT.log_broadcaster.sink, format=_fmt, colorize=False)
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
    #
    # Do NOT use mount("/", StaticFiles(html=True)) — Starlette's Mount does
    # prefix matching on ALL scope types including "websocket", so it would
    # intercept WebSocket upgrade requests and raise AssertionError.
    #
    # Instead: mount /assets for Vite build artefacts, then add an explicit
    # HTTP-only catch-all GET route that serves index.html for SPA routing.
    # HTTP GET routes are never matched for WebSocket connections.
    dist = RUNTIME_CONFIG.PATH_ROOT_DIR / "frontend" / "dist"
    if dist.exists():
        assets_dir = dist / "assets"
        if assets_dir.exists():
            fastapi_app.mount(
                "/assets",
                StaticFiles(directory=str(assets_dir)),
                name="assets",
            )

        index_html = str(dist / "index.html")

        @fastapi_app.get("/{full_path:path}", include_in_schema=False)
        async def spa_fallback(full_path: str = "") -> FileResponse:
            """
            SPA catch-all — serve index.html for any unmatched GET path.

            Static files that exist in dist (e.g. favicon.ico) are served
            directly; all other paths fall back to index.html so that React
            Router handles client-side navigation.

            Args:
                full_path (str): The unmatched URL path segment.

            Returns:
                FileResponse: The requested static file or index.html.
            """
            # 1. Try to serve an exact file from the dist root
            requested = dist / full_path
            if full_path and requested.is_file():
                return FileResponse(str(requested))

            # 2. Fall back to index.html for SPA client-side routing
            return FileResponse(index_html)

    return fastapi_app


app: FastAPI = _build_app()

__all__ = ["app"]
