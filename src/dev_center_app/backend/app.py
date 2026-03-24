# ====== Code Summary ======
# FastAPI factory — assembles all routers.

from fastapi import FastAPI
from .lifespan import lifespan
from .routers import health_router


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

    return app


__all__ = ["create_app"]
