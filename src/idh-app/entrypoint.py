# ====== Code Summary ======
# Application entry point — wires CONTEXT and creates the FastAPI app.

# ====== Third-Party Library Imports ======
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loggerplusplus import loggerplusplus

# ====== Internal Project Imports ======
from config import RUNTIME_CONFIG          # MUST be first — registers sys.path
from backend import CONTEXT, create_app


def _build_app() -> FastAPI:
    """
    Assemble and return a fully configured FastAPI application.

    Returns:
        FastAPI: The configured application instance.
    """
    # 1. Inject logger and config into CONTEXT
    CONTEXT.logger = loggerplusplus.bind(identifier="IDH-APP")
    CONTEXT.RUNTIME_CONFIG = RUNTIME_CONFIG

    # 2. Create FastAPI app
    fastapi_app = create_app(
        app_name=RUNTIME_CONFIG.FASTAPI_APP_NAME,
        debug=RUNTIME_CONFIG.FASTAPI_DEBUG_MODE,
    )

    # 3. Mount frontend static files if the dist folder has been built
    if RUNTIME_CONFIG.PATH_ROOT_DIR_FRONTEND.exists():
        fastapi_app.mount(
            "/",
            StaticFiles(directory=RUNTIME_CONFIG.PATH_ROOT_DIR_FRONTEND, html=True),
            name="static",
        )

    # 4. Add CORS middleware — origins read from RUNTIME_CONFIG
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
