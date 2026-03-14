#!/bin/sh
set -e

# Set HOME to a writable directory (npm/prisma need this for caching)
export HOME=/tmp

echo "Deploying database migrations..."

# Try to mark baseline migration as applied (will be no-op if already applied)
node ./node_modules/prisma/build/index.js migrate resolve --applied 0_init 2>/dev/null || true

# Deploy any pending migrations
node ./node_modules/prisma/build/index.js migrate deploy

echo "Starting server..."
# In monorepo standalone output, server.js is in apps/web/
exec node apps/web/server.js
