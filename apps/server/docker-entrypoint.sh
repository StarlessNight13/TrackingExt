#!/bin/sh
set -eu

echo "Applying database schema..."
cd /app/packages/db
bun run db:push -- --force

echo "Starting server..."
cd /app/apps/server
exec bun run src/index.ts
