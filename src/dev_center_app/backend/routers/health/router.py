# ====== Code Summary ======
# Health check route.

from fastapi import APIRouter
from backend.libs.utils.error_handling import auto_handle_errors
from .models import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
@auto_handle_errors
async def health() -> HealthResponse:
    """
    Simple health check endpoint.

    Returns:
        HealthResponse: Status response.
    """
    return HealthResponse(status="ok")
