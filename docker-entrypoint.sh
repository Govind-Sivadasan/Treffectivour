#!/bin/sh
set -e
if [ ! -f /data/treffectivour.db ]; then
  cp /app/prisma/init.db /data/treffectivour.db
fi
exec node server.js
