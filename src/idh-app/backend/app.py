# ====== Code Summary ======
# Creates the FastAPI application instance and registers all API routers.

# ====== Third-Party Library Imports ======
from fastapi import FastAPI

# ====== Local Project Imports ======
from .lifespan import lifespan
from .routers import agents_router, bridge_router, health_router, memory_router, monitoring_router, projects_router, settings_router


def create_app(app_name: str, debug: bool) -> FastAPI:
    """
    Create and configure the FastAPI application instance.

    Args:
        app_name (str): Application title shown in OpenAPI docs.
        debug (bool): Enable debug mode.

    Returns:
        FastAPI: Configured application.
    """
    # 1. Create FastAPI instance with lifespan
    app = FastAPI(title=app_name, version="0.1.0", lifespan=lifespan(), debug=debug)

    # 2. Register routers under /api/v1
    api_prefix = "/api/v1"
    app.include_router(router=health_router, prefix=api_prefix)
    app.include_router(router=projects_router, prefix=api_prefix)
    app.include_router(router=settings_router, prefix=api_prefix)
    app.include_router(router=agents_router, prefix=api_prefix)
    app.include_router(router=bridge_router, prefix=api_prefix)
    app.include_router(router=memory_router, prefix=api_prefix)
    app.include_router(router=monitoring_router, prefix=api_prefix)

    return app


__all__ = ["create_app"]
