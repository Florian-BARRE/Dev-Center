# ====== Code Summary ======
# Provides the @auto_handle_errors decorator for automatic exception handling on all routes.

# ====== Standard Library Imports ======
import functools
import inspect
import traceback

# ====== Third-Party Library Imports ======
from fastapi import HTTPException

# ====== Local Project Imports ======
from ...context import CONTEXT


def _build_error_detail(func_name: str, exc: Exception, tb: str) -> dict:
    """
    Build the HTTP 500 response detail.

    In debug mode, includes traceback. In production, returns a generic message.

    Args:
        func_name (str): Name of the failing function.
        exc (Exception): The caught exception.
        tb (str): Formatted traceback string.

    Returns:
        dict: Error detail dictionary.
    """
    if getattr(CONTEXT.RUNTIME_CONFIG, "FASTAPI_DEBUG_MODE", False):
        return {"error": str(exc), "traceback": tb, "function": func_name}
    return {"error": "Internal server error."}


def auto_handle_errors(func):
    """
    Decorator to automatically handle unexpected exceptions for sync and async routes.

    HTTPExceptions are always re-raised as-is.

    Args:
        func (Callable): The route function to wrap.

    Returns:
        Callable: Wrapped function with automatic error handling.
    """

    @functools.wraps(func)
    async def async_wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as exc:
            tb = traceback.format_exc()
            CONTEXT.logger.error(f"[{func.__name__}] {exc}\n{tb}")
            raise HTTPException(
                status_code=500,
                detail=_build_error_detail(func.__name__, exc, tb),
            )

    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as exc:
            tb = traceback.format_exc()
            CONTEXT.logger.error(f"[{func.__name__}] {exc}\n{tb}")
            raise HTTPException(
                status_code=500,
                detail=_build_error_detail(func.__name__, exc, tb),
            )

    if inspect.iscoroutinefunction(func):
        return async_wrapper
    return sync_wrapper
