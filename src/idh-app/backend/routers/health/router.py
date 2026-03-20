# ====== Code Summary ======
# Health check route — confirms idh-app is running and accepting requests.

# ====== Third-Party Library Imports ======
from fastapi import APIRouter

# ====== Local Project Imports ======
from ...libs.utils.error_handling import auto_handle_errors
from .models import HealthResponse

router = APIRouter()
_VERSION = "0.1.0"


@router.get("/health/ping", response_model=HealthResponse)
@auto_handle_errors
async def ping() -> HealthResponse:
    """
    Health check endpoint.

    Returns:
        HealthResponse: Status and version.
    """
    # 1. Return healthy status
    return HealthResponse(status="ok", version=_VERSION)
