# ====== Code Summary ======
# /logs WebSocket route — streams live backend log lines to the frontend.

# ====== Third-Party Library Imports ======
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

# ====== Internal Project Imports ======
from backend.context import CONTEXT

router = APIRouter()


@router.websocket("/logs")
async def backend_logs(websocket: WebSocket) -> None:
    """
    WebSocket endpoint that streams live backend log records.

    On connect:
      1. Sends the recent history buffer (up to LogBroadcaster.max_history lines).
      2. Streams new lines as they are emitted by loggerplusplus.

    Each message is { "line": "<log line>" }.

    Closes cleanly on client disconnect.
    """
    await websocket.accept()
    history, queue = CONTEXT.log_broadcaster.subscribe()
    try:
        # 1. Replay recent history for late-connecting clients
        for line in history:
            await websocket.send_json({"line": line})

        # 2. Stream live lines
        while True:
            line = await queue.get()
            await websocket.send_json({"line": line})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        CONTEXT.logger.warning(f"[backend_logs] unexpected error: {exc}")
    finally:
        CONTEXT.log_broadcaster.unsubscribe(queue)
        try:
            await websocket.close()
        except Exception:
            pass
