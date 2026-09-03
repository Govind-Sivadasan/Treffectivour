#!/bin/sh
set -e

uses_turso() {
  [ -n "$TURSO_DATABASE_URL" ] || echo "${DATABASE_URL:-}" | grep -q "^libsql:"
}

if uses_turso; then
  echo "Using Turso cloud database (persistent on Render free tier)."
  exec node server.js
fi

if [ ! -f /data/treffectivour.db ]; then
  echo "Initializing local SQLite at /data/treffectivour.db"
  cp /app/prisma/init.db /data/treffectivour.db
fi

exec node server.js
