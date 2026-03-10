#!/bin/sh
set -e

echo "Checking migrations..."

# Try to mark baseline migration as applied (will be no-op if already applied)
npx prisma migrate resolve --applied 0_init 2>/dev/null || true

echo "Starting server..."
exec node server.js
