# ====== Code Summary ======
# Pydantic models for the /auth router.

# ====== Internal Project Imports ======
from libs.state.models import _CamelModel


class AuthStatusResponse(_CamelModel):
    """Response model for authentication status check."""

    authenticated: bool
    email: str | None = None


class LoginStartedResponse(_CamelModel):
    """Response confirming auth login process was started."""

    status: str
