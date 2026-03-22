# -------------------- Health --------------------- #
from .health.router import router as health_router

# ------------------- Projects -------------------- #
from .projects.router import router as projects_router

# ------------------- Settings -------------------- #
from .settings.router import router as settings_router

# ------------------- Agents ---------------------- #
from .agents.router import router as agents_router

# ------------------- Bridge ---------------------- #
from .bridge.router import router as bridge_router

# ------------------- Memory ---------------------- #
from .memory.router import router as memory_router

# ------------------- Monitoring ------------------ #
from .monitoring.router import router as monitoring_router

# ------------------- Public API ------------------ #
__all__ = [
    "health_router",
    "projects_router",
    "settings_router",
    "agents_router",
    "bridge_router",
    "memory_router",
    "monitoring_router",
]
