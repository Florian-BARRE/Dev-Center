# ====== Code Summary ======
# Pydantic models for the /projects router.

# ====== Third-Party Library Imports ======
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# ====== Internal Project Imports ======
from libs.state.models import Project


class _CamelModel(BaseModel):
    """Base model with camelCase serialisation."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ProjectListResponse(_CamelModel):
    """
    Response model for listing all projects.

    Attributes:
        projects (list[Project]): List of all registered projects.
    """

    projects: list[Project]


class ProjectResponse(Project):
    """
    Response model for a single project.

    Inherits all fields from Project.
    """
