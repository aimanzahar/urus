#!/bin/sh
set -e

# Bind-mounted `./data` arrives with the host user's UID/GID, which may not
# match the container's `nextjs` user. Fix ownership at startup so SQLite
# (and its WAL/SHM sidecars) + uploaded images can be written.
if [ -d /app/data ]; then
  chown -R nextjs:nodejs /app/data 2>/dev/null || true
fi

exec gosu nextjs:nodejs "$@"
