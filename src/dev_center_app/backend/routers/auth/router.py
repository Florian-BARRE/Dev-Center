# ====== Code Summary ======
# /auth router — Claude CLI credential status + OAuth flow streaming.

# ====== Standard Library Imports ======
import asyncio

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from backend.libs.utils.error_handling import auto_handle_errors

# ====== Local Project Imports ======
from .models import AuthStatusResponse, LoginStartedResponse

router = APIRouter()
AUTH_TIMEOUT_SECONDS = 300  # 5 minutes


@router.get("/auth/status", response_model=AuthStatusResponse)
@auto_handle_errors
async def auth_status() -> AuthStatusResponse:
    """
    Return Claude CLI authentication status.

    Returns:
        AuthStatusResponse: Current auth state and email if authenticated.
    """
    # 1. Check authentication and retrieve email if authenticated
    authenticated = CONTEXT.auth_checker.is_authenticated()
    email = CONTEXT.auth_checker.get_email() if authenticated else None

    # 2. Update CONTEXT flag for middleware/header injection
    CONTEXT.auth_ok = authenticated

    return AuthStatusResponse(authenticated=authenticated, email=email)


@router.post("/auth/login", status_code=200, response_model=LoginStartedResponse)
@auto_handle_errors
async def start_login() -> LoginStartedResponse:
    """
    Spawn `claude auth login`. Connect to WS /auth/login/stream for output.

    Raises:
        HTTPException: 422 if claude CLI is not found in PATH.

    Returns:
        LoginStartedResponse: Status confirmation.
    """
    # 1. Attempt to start the login subprocess
    try:
        await CONTEXT.auth_checker.start_login()
    except FileNotFoundError:
        raise HTTPException(status_code=422, detail="claude CLI not found in PATH")

    return LoginStartedResponse(status="started")


@router.websocket("/auth/login/stream")
async def login_stream(websocket: WebSocket) -> None:
    """
    Stream output from the running `claude auth login` subprocess.

    Sends { "line": "..." } per output line.
    Closes with { "done": true, "success": bool } on completion.
    Closes immediately with success=false if no process is running.
    Times out after 5 minutes (AUTH_TIMEOUT_SECONDS).

    Args:
        websocket: Active WebSocket connection from the client.
    """
    await websocket.accept()
    try:
        # 1. Retrieve the active login process, bail out if none
        proc = CONTEXT.auth_checker.get_active_login_process()
        if proc is None or proc.stdout is None:
            await websocket.send_json({"done": True, "success": False})
            return

        # 2. Define an inner coroutine to stream stdout line by line
        async def _stream() -> bool:
            async for raw in proc.stdout:
                line = raw.decode(errors="replace").rstrip()
                await websocket.send_json({"line": line})
            await proc.wait()
            return proc.returncode == 0

        # 3. Run the stream with a timeout
        success = await asyncio.wait_for(_stream(), timeout=AUTH_TIMEOUT_SECONDS)

        # 4. Refresh auth state and signal completion
        CONTEXT.auth_ok = CONTEXT.auth_checker.is_authenticated()
        await websocket.send_json({"done": True, "success": success})

    except asyncio.TimeoutError:
        await websocket.send_json({"done": True, "success": False})
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        CONTEXT.logger.warning(f"[login_stream] unexpected error: {exc}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
