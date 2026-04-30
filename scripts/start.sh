#!/bin/sh
set -e

# Set HOME to a writable directory (prisma needs this for caching)
export HOME=/tmp

echo "Deploying database migrations..."

# Try to mark baseline migration as applied (will be no-op if already applied)
prisma migrate resolve --applied 0_init 2>/dev/null || true

# Deploy any pending migrations
prisma migrate deploy

echo "Starting server..."
# In monorepo standalone output, server.js is in apps/web/
exec node apps/web/server.js
