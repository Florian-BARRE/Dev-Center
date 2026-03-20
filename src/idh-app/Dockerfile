# syntax=docker/dockerfile:1.7

###############################################################################
# Build note:
# Built from the repository root with the src/ directory as context.
#   docker build -f src/idh-app/Dockerfile -t idh-app:latest src
###############################################################################

###############################################################################
# Stage 1: Python dependency builder (uv + Python 3.12)
#
# Goal:
# - Install locked production Python dependencies into /opt/venv
# - Keep dependency layer separate from app code for Docker layer cache reuse
###############################################################################
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS py-build

# /workspace is the build scratch area — isolated from the runtime filesystem.
WORKDIR /workspace

# Tell uv where to create the project virtual environment.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv

# Copy lock metadata first — dependency cache is invalidated only when these change.
COPY idh-app/pyproject.toml idh-app/uv.lock /workspace/idh-app/

# Install locked production dependencies.
# --frozen: fail if lock file is out of sync with pyproject.toml.
# --no-dev: skip development-only packages.
# cache mount: speeds up repeated local builds without network round-trips.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --project /workspace/idh-app

###############################################################################
# Stage 2: Frontend builder (Node 22 + Vite)
#
# Goal:
# - Build the React production bundle into frontend/dist/
# - Only the compiled dist/ is copied to the runtime stage
###############################################################################
FROM node:22-bookworm-slim AS ui-build

WORKDIR /workspace/idh-app/frontend

# Copy package descriptors first to enable npm dependency-layer caching.
# package-lock.json is committed in the repo and required here for npm ci.
COPY idh-app/frontend/package.json idh-app/frontend/package-lock.json ./

# Reproducible install strictly from package-lock.json (no version drift).
RUN npm ci

# Copy frontend source and compile the production bundle.
COPY idh-app/frontend/ ./
RUN npm run build

###############################################################################
# Stage 3: Runtime image (Python + Node for claude CLI)
#
# Goal:
# - Run FastAPI via uvicorn (Python)
# - Include Node.js runtime so the `claude remote-control` bridge can be spawned
# - Serve compiled React bundle as static files from /app/idh-app/frontend/dist
###############################################################################
FROM python:3.12-slim-bookworm AS runtime

# Python runtime best practices.
# PYTHONDONTWRITEBYTECODE: no .pyc files written to disk.
# PYTHONUNBUFFERED: logs appear immediately in stdout/stderr.
# PATH: make the uv-built venv the active Python environment.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:${PATH}"

# Install Node.js 22 (required to run the `claude` CLI) and git + ssh tools.
# NodeSource is used for a recent LTS version on Debian bookworm.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    openssh-client \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get remove -y curl \
    && apt-get autoremove -y \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install the Claude Code CLI globally.
# Required by the bridge manager to spawn `claude remote-control` processes.
RUN npm install -g @anthropic-ai/claude-code

# /app is the runtime working directory — source code is mounted here.
WORKDIR /app

# Copy prebuilt Python virtual environment from the py-build stage.
COPY --from=py-build /opt/venv /opt/venv

# Copy backend application source code.
COPY idh-app /app/idh-app

# Copy compiled React bundle into the backend tree.
# FastAPI mounts this directory as static files at the root URL.
COPY --from=ui-build /workspace/idh-app/frontend/dist /app/idh-app/frontend/dist

# Copy and set permissions on the entrypoint script.
COPY idh-app/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port 8000 — the port uvicorn listens on for FastAPI requests.
EXPOSE 8000

# Start via entrypoint.sh which handles SSH permissions and DEV_MODE detection.
CMD ["/entrypoint.sh"]
