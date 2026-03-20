#!/usr/bin/env bash
set -euo pipefail

# Fix SSH key permissions.
# The ~/.ssh volume is mounted :ro — SSH refuses keys not owned with 600 perms.
# We copy to a temp writable location and fix permissions before use.
if [ -d "/home/app/.ssh" ]; then
    cp -r /home/app/.ssh /tmp/.ssh-rw
    chmod 700 /tmp/.ssh-rw
    chmod 600 /tmp/.ssh-rw/id_* 2>/dev/null || true
    export GIT_SSH_COMMAND="ssh -i /tmp/.ssh-rw/id_ed25519 \
        -o StrictHostKeyChecking=accept-new \
        -o UserKnownHostsFile=/tmp/.ssh-rw/known_hosts"
fi

# The working directory must be the idh-app root for Python module resolution.
cd /app/idh-app

if [ "${DEV_MODE:-}" = "true" ]; then
    # Hot reload enabled — entrypoint.sh checks DEV_MODE, not compose command.
    exec uvicorn entrypoint:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload \
        --reload-dir /app/idh-app
else
    exec uvicorn entrypoint:app \
        --host 0.0.0.0 \
        --port 8000
fi
