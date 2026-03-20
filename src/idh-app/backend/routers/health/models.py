# ====== Code Summary ======
# Pydantic models for the health check endpoint.

# ====== Third-Party Library Imports ======
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """
    Response model for the GET /api/v1/health/ping route.

    Attributes:
        status (str): Service status. Always 'ok' when healthy.
        version (str): Application version.
    """

    status: str = Field(..., description="Service status. Always 'ok' when healthy.")
    version: str = Field(..., description="Application version.")
