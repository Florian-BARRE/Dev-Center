# -------------------- Health --------------------- #
from .health.router import router as health_router

# ------------------- Projects -------------------- #
from .projects.router import router as projects_router

# ------------------- Settings -------------------- #
from .settings.router import router as settings_router

# ------------------- Agents ---------------------- #
from .agents.router import router as agents_router

# ------------------- Public API ------------------ #
__all__ = [
    "health_router",
    "projects_router",
    "settings_router",
    "agents_router",
]
