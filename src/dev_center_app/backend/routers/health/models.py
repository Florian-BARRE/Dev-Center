from libs.state.models import _CamelModel


class HealthResponse(_CamelModel):
    """Health check response model."""
    status: str
