from libs.state.models import _CamelModel


class HealthResponse(_CamelModel):
    """Health check response model."""
    status: str
    server_time: str
    timezone: str
    utc_offset: str
