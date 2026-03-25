#!/usr/bin/env bash
# docker-entrypoint.sh
#
# Runs once at container startup before uvicorn is launched.
#
# Problem:
#   SSH keys mounted from a Windows host via Docker Desktop always arrive with
#   0777 permissions (Windows NTFS has no Unix permission bits). OpenSSH refuses
#   to use private keys that are readable by others and exits with:
#     "Permissions 0777 for '/root/.ssh/id_ed25519' are too open."
#
# Fix:
#   Copy the read-only mount to /root/.ssh-rw, set strict permissions there
#   (700 for the directory, 600 for private keys, 644 for public keys), and
#   point git to the fixed copy via GIT_SSH_COMMAND.
#
# If no SSH keys are found the script is a no-op — HTTPS repos still work.

set -euo pipefail

SSH_SRC="/root/.ssh"
SSH_DST="/root/.ssh-rw"

if [ -d "$SSH_SRC" ] && [ -n "$(ls -A "$SSH_SRC" 2>/dev/null)" ]; then
    # Copy the entire .ssh directory to a writable location.
    mkdir -p "$SSH_DST"
    cp -r "$SSH_SRC/." "$SSH_DST/"

    # Apply strict Unix permissions that OpenSSH requires.
    chmod 700 "$SSH_DST"
    # Private keys: owner-read/write only
    chmod 600 "$SSH_DST"/id_* 2>/dev/null || true
    # Public keys: owner read/write, group/world read
    chmod 644 "$SSH_DST"/*.pub 2>/dev/null || true
    # known_hosts and config files: owner read/write only
    chmod 600 "$SSH_DST/known_hosts" 2>/dev/null || true
    chmod 600 "$SSH_DST/config" 2>/dev/null || true

    # Override git's SSH command to use the fixed key directory.
    # -F: use the fixed-permissions copy of the SSH config (if it exists) so OpenSSH
    #   does not refuse to run due to bad permissions on the read-only Windows mount.
    #   If no config file exists, fall back to -F /dev/null to suppress the default read.
    # -o IdentitiesOnly=yes: only use the explicitly specified key, not the SSH agent.
    # -o UserKnownHostsFile: use the fixed-permissions known_hosts copy.
    if [ -f "$SSH_DST/config" ]; then
        SSH_CONFIG_FLAG="-F $SSH_DST/config"
    else
        SSH_CONFIG_FLAG="-F /dev/null"
    fi
    export GIT_SSH_COMMAND="ssh $SSH_CONFIG_FLAG -i $SSH_DST/id_ed25519 -o IdentitiesOnly=yes -o UserKnownHostsFile=$SSH_DST/known_hosts"

    echo "[entrypoint] SSH keys copied to $SSH_DST with correct permissions."
    echo "[entrypoint] GIT_SSH_COMMAND=$GIT_SSH_COMMAND"
else
    echo "[entrypoint] No SSH keys found in $SSH_SRC — SSH git clone will not work."
fi

# Hand off to the main process (uvicorn or any CMD passed to the container).
exec "$@"
