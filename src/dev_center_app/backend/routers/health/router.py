# ====== Code Summary ======
# Health check route.

from datetime import datetime
from fastapi import APIRouter
from backend.libs.utils.error_handling import auto_handle_errors
from .models import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
@auto_handle_errors
async def health() -> HealthResponse:
    """
    Return backend health and current container time metadata.

    Returns:
        HealthResponse: Status response with current container time.
    """
    now = datetime.now().astimezone()
    return HealthResponse(
        status="ok",
        server_time=now.isoformat(),
        timezone=now.tzname() or "unknown",
        utc_offset=now.strftime("%z"),
    )
