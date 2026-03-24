# ====== Code Summary ======
# @auto_handle_errors decorator — uniform 500 handling for all routes.

import functools
import inspect
import traceback
from fastapi import HTTPException
from backend.context import CONTEXT


def _build_error_detail(func_name: str, exc: Exception, tb: str) -> dict:
    """
    Build 500 detail — full traceback in debug mode, generic otherwise.

    Args:
        func_name (str): Name of the failing function.
        exc (Exception): The caught exception.
        tb (str): Formatted traceback string.

    Returns:
        dict: Error detail dictionary.
    """
    if getattr(getattr(CONTEXT, "RUNTIME_CONFIG", None), "FASTAPI_DEBUG_MODE", False):
        return {"error": str(exc), "traceback": tb, "function": func_name}
    return {"error": "Internal server error."}


def auto_handle_errors(func):
    """
    Decorator for automatic exception handling on route functions.

    Re-raises HTTPExceptions unchanged. Wraps all other exceptions
    in HTTP 500 with a logged traceback.

    Args:
        func (Callable): Route function to wrap.

    Returns:
        Callable: Wrapped function.
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
            raise HTTPException(status_code=500, detail=_build_error_detail(func.__name__, exc, tb))

    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as exc:
            tb = traceback.format_exc()
            CONTEXT.logger.error(f"[{func.__name__}] {exc}\n{tb}")
            raise HTTPException(status_code=500, detail=_build_error_detail(func.__name__, exc, tb))

    return async_wrapper if inspect.iscoroutinefunction(func) else sync_wrapper
