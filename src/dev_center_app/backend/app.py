# ====== Code Summary ======
# FastAPI factory — assembles all routers.

from fastapi import FastAPI
from .lifespan import lifespan
from .routers import health_router, projects_router, sessions_router, memory_router, rules_router, auth_router, monitoring_router


def create_app(app_name: str, debug: bool) -> FastAPI:
    """
    Create and configure the FastAPI application instance.

    Args:
        app_name (str): Application title shown in OpenAPI docs.
        debug (bool): Enable debug mode.

    Returns:
        FastAPI: Configured application.
    """
    app = FastAPI(title=app_name, version="1.0.0", lifespan=lifespan(), debug=debug)

    # 1. Register all routers under the standard API prefix
    prefix = "/api/v1"
    app.include_router(health_router, prefix=prefix)
    app.include_router(projects_router, prefix=prefix)
    app.include_router(sessions_router, prefix=prefix)
    app.include_router(memory_router, prefix=prefix)
    app.include_router(rules_router, prefix=prefix)
    app.include_router(auth_router, prefix=prefix)
    app.include_router(monitoring_router, prefix=prefix)

    return app


__all__ = ["create_app"]
