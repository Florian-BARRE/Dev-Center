#!/usr/bin/env bash
set -euo pipefail

# Fix ownership of idh-app's data directories so the app user (UID 1000) can write.
# These may be owned by root if:
#   - a previous container run created files as root, or
#   - Docker Desktop on Windows created the host directory as root.
#
# Strategy:
#   - /data and /rules: recursive chown — small dirs with only a few files.
#   - /workspaces and /openclaw-config: non-recursive chown on the directory only
#     (they may be large or shared with other services — chown-R would be slow).
for dir in /data /rules; do
    if [ -d "$dir" ]; then
        chown -R app:app "$dir" 2>/dev/null || true
    fi
done

# Non-recursive chown on the directory inode — lets app create new files in it.
for dir in /openclaw-config; do
    if [ -d "$dir" ]; then
        chown app:app "$dir" 2>/dev/null || true
    fi
done

# Recursive chown on /workspaces — subdirectories may be owned by root if they were
# cloned by a previous container run as root. The claude remote-control bridge spawns
# sessions inside the workspace and needs full read/write access to run correctly.
# chown only updates inode metadata — it does not read file content — so even large
# git repos complete in under a second.
if [ -d "/workspaces" ]; then
    chown -R app:app /workspaces 2>/dev/null || true
fi

# Fix Claude credentials directory ownership.
# ~/.claude is bind-mounted from the host at /home/app/.claude.
# ~/.claude.json is bind-mounted as a single file at /home/app/.claude.json.
# Both must be writable by the app user so claude remote-control can refresh tokens.
if [ -d "/home/app/.claude" ]; then
    chown -R app:app /home/app/.claude 2>/dev/null || true
fi
if [ -f "/home/app/.claude.json" ]; then
    chown app:app /home/app/.claude.json 2>/dev/null || true
fi

# Fix Codex credentials directory ownership.
# ~/.codex is bind-mounted from the host at /home/app/.codex.
if [ -d "/home/app/.codex" ]; then
    chown -R app:app /home/app/.codex 2>/dev/null || true
fi

# Fix SSH key permissions and copy to a writable location.
# The ~/.ssh volume is mounted :ro — SSH refuses keys that are world-readable.
# We copy to a temp writable location and set the correct 600 permissions.
if [ -d "/home/app/.ssh" ]; then
    cp -r /home/app/.ssh /tmp/.ssh-rw
    chown -R app:app /tmp/.ssh-rw
    chmod 700 /tmp/.ssh-rw
    chmod 600 /tmp/.ssh-rw/id_* 2>/dev/null || true
    export GIT_SSH_COMMAND="ssh -i /tmp/.ssh-rw/id_ed25519 \
        -o StrictHostKeyChecking=accept-new \
        -o UserKnownHostsFile=/tmp/.ssh-rw/known_hosts"
fi

# The working directory must be the idh-app root for Python module resolution.
cd /app/idh-app

# Drop privileges to the 'app' user before starting uvicorn.
# gosu re-execs the given command under the target user — signals are forwarded
# correctly because exec replaces the shell process entirely.
if [ "${DEV_MODE:-}" = "true" ]; then
    # Hot reload enabled — uvicorn watches /app/idh-app for .py file changes.
    exec gosu app uvicorn entrypoint:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload \
        --reload-dir /app/idh-app
else
    exec gosu app uvicorn entrypoint:app \
        --host 0.0.0.0 \
        --port 8000
fi
