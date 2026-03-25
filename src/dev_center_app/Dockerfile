# syntax=docker/dockerfile:1.7

###############################################################################
# Build note:
# Built from repository root with src/ as the build context.
# Example:
#   docker build -f src/dev_center_app/Dockerfile -t dev-center-backend:latest src
###############################################################################

###############################################################################
# Stage 1: Python dependency builder (uv + Python 3.12)
#
# Goal:
# - Create the virtual environment at /opt/venv
# - Install locked production dependencies from uv.lock only
# - Keep dependency installation cached separately from source code
###############################################################################
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS py-build

# Keep all builder files under /workspace for clarity.
WORKDIR /workspace

# Tell uv where to create the project virtual environment.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv

# Copy dependency metadata first so Docker can cache this layer.
COPY dev_center_app/pyproject.toml dev_center_app/uv.lock /workspace/dev_center_app/

# Install only locked production dependencies.
# --frozen: lock file must match pyproject.toml
# --no-dev: skip development/test dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --project /workspace/dev_center_app

###############################################################################
# Stage 2: Frontend production builder (Node + Vite)
#
# Goal:
# - Install frontend dependencies reproducibly
# - Build the production bundle into frontend/dist
###############################################################################
FROM node:22-bookworm-slim AS ui-build

# Build inside the frontend directory to keep paths explicit.
WORKDIR /workspace/dev_center_app/frontend

# Copy package manifests first to maximize npm cache reuse.
COPY dev_center_app/frontend/package.json dev_center_app/frontend/package-lock.json ./

# Install exact dependencies from package-lock.json.
RUN npm ci

# Copy frontend source code and create the production bundle.
COPY dev_center_app/frontend/ ./
RUN npm run build

###############################################################################
# Stage 3: Claude CLI builder (Node global package)
#
# Goal:
# - Install the Claude Code CLI once
# - Copy Node + CLI artifacts into runtime stages without shipping npm tooling
###############################################################################
FROM node:22-bookworm-slim AS claude-cli

# Install Claude Code CLI globally so /usr/local/bin/claude is generated.
RUN npm install -g @anthropic-ai/claude-code

###############################################################################
# Stage 4: Docker CLI source
#
# Goal:
# - Provide a standalone Docker client binary for runtime containers
# - Avoid adding Docker apt repositories inside the Python runtime image
###############################################################################
FROM docker:28-cli AS docker-cli

###############################################################################
# Stage 5: Shared runtime base (used by prod and dev targets)
#
# Goal:
# - Keep one explicit runtime foundation for both production and development
# - Include only required system tools (git + ssh) and runtime CLIs
###############################################################################
FROM python:3.12-slim-bookworm AS runtime-base

# Runtime Python defaults and module path configuration.
# PYTHONDONTWRITEBYTECODE: do not write .pyc files to container filesystem
# PYTHONUNBUFFERED: flush logs immediately to stdout/stderr
# PATH: activate /opt/venv binaries by default
# PYTHONPATH: allow absolute imports from /app/dev_center_app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:${PATH}" \
    PYTHONPATH="/app/dev_center_app"

# Install only required OS tools:
# - git: clone/pull/push project repositories
# - openssh-client: SSH transport for private git remotes
# - ca-certificates: TLS certificates for HTTPS and package downloads
RUN apt-get update \
    && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Keep application files under /app.
WORKDIR /app

# Copy the prebuilt Python virtual environment from py-build stage.
COPY --from=py-build /opt/venv /opt/venv

# Copy Docker client binary so the app can talk to host docker.sock.
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker

# Copy Node runtime and Claude Code CLI files from claude-cli stage.
COPY --from=claude-cli /usr/local/bin/node /usr/local/bin/node
COPY --from=claude-cli /usr/local/bin/claude /usr/local/bin/claude
COPY --from=claude-cli /usr/local/lib/node_modules/@anthropic-ai/claude-code \
                        /usr/local/lib/node_modules/@anthropic-ai/claude-code

# Copy startup entrypoint script that fixes SSH key permissions at runtime.
COPY dev_center_app/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Use entrypoint wrapper for SSH permissions, then execute CMD.
ENTRYPOINT ["docker-entrypoint.sh"]

###############################################################################
# Stage 6: Production runtime target
#
# Goal:
# - Run FastAPI backend
# - Serve compiled frontend static assets from the same container
###############################################################################
FROM runtime-base AS runtime

# Copy backend source code.
COPY dev_center_app /app/dev_center_app

# Copy frontend production assets consumed by entrypoint.py static mount.
COPY --from=ui-build /workspace/dev_center_app/frontend/dist /app/dev_center_app/frontend/dist

# Expose backend HTTP port.
EXPOSE 8000

# Start FastAPI app in production mode (no autoreload).
CMD ["uvicorn", "dev_center_app.entrypoint:app", "--host", "0.0.0.0", "--port", "8000"]

###############################################################################
# Stage 7: Development runtime target
#
# Goal:
# - Provide a lean backend image for local development
# - Source code is bind-mounted by docker-compose.dev.yml
###############################################################################
FROM runtime-base AS dev-runtime

# Copy backend source as a fallback; bind mount will override it in dev.
COPY dev_center_app /app/dev_center_app

# Expose backend HTTP port used by uvicorn in development.
EXPOSE 8000

# Default dev command (can be overridden by compose).
CMD ["uvicorn", "dev_center_app.entrypoint:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app/dev_center_app"]
