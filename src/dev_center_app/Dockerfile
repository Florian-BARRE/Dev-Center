# syntax=docker/dockerfile:1.7

###############################################################################
# Build note:
# Built from the repository root with the src/ directory as context.
# Example:
#   docker build -f src/dev_center_app/Dockerfile -t dev-center-app:latest src
###############################################################################

###############################################################################
# Stage 1: Python dependency builder
#
# Goal:
# - Install locked production Python dependencies into /opt/venv using uv.
# - Isolate dependency installation from application code for cache efficiency.
###############################################################################
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS py-build

WORKDIR /workspace

# UV_PROJECT_ENVIRONMENT tells uv where to create the virtual environment.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv

# Copy lock metadata first — dependency cache is invalidated only when these change.
COPY dev_center_app/pyproject.toml dev_center_app/uv.lock /workspace/dev_center_app/

# Install locked production dependencies only.
# --frozen: fail if lock file is out of sync with pyproject.toml.
# --no-dev: skip development/test dependencies.
# cache mount: speeds up repeated local builds without network round-trips.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --project /workspace/dev_center_app

###############################################################################
# Stage 2: Frontend builder
#
# Goal:
# - Install Node dependencies reproducibly with npm ci.
# - Build the optimised production React+Vite bundle into frontend/dist.
###############################################################################
FROM node:22-bookworm-slim AS ui-build

WORKDIR /workspace/dev_center_app/frontend

# Copy package descriptors first to enable npm dependency-layer caching.
COPY dev_center_app/frontend/package.json dev_center_app/frontend/package-lock.json ./

# Reproducible install strictly from package-lock.json.
RUN npm ci

# Copy frontend source and compile production bundle.
COPY dev_center_app/frontend/ ./
RUN npm run build

###############################################################################
# Stage 3: Runtime image
#
# Goal:
# - Contain only what is needed to run the service — no build tools.
# - Expose a clean filesystem:
#     /app/dev_center_app              -> backend application source
#     /app/dev_center_app/frontend/dist -> compiled React bundle (served as static files)
###############################################################################
FROM python:3.12-slim-bookworm AS runtime

# Runtime Python best practices:
# - PYTHONDONTWRITEBYTECODE: suppress .pyc file creation.
# - PYTHONUNBUFFERED: logs appear immediately in stdout/stderr.
# - PATH: make the uv-built venv the active Python environment.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:${PATH}"

# Install git — required by the git clone feature at runtime.
# Clean up apt cache to keep the image minimal.
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy prebuilt Python virtual environment from the builder stage.
COPY --from=py-build /opt/venv /opt/venv

# Copy backend application source code.
COPY dev_center_app /app/dev_center_app

# Copy compiled React bundle from the frontend builder stage.
# FastAPI mounts this directory as static files at the root URL.
COPY --from=ui-build /workspace/dev_center_app/frontend/dist /app/dev_center_app/frontend/dist

EXPOSE 8000

# Start the FastAPI application via uvicorn.
# The entrypoint.py module exposes the FastAPI `app` object.
CMD ["uvicorn", "dev_center_app.entrypoint:app", "--host", "0.0.0.0", "--port", "8000"]
