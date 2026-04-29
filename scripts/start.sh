#!/bin/sh
set -e

# Set HOME to a writable directory (prisma needs this for caching)
export HOME=/tmp

# TEMPORARY: Skip migrations to allow container to start
# A failed migration (20260313000000_add_correlation_id_and_workflow_integrations) is blocking deployment
# Once container is running, use ECS Exec to run:
#   prisma migrate resolve --rolled-back 20260313000000_add_correlation_id_and_workflow_integrations
# Then restore this script and redeploy

echo "SKIPPING migrations (temporary fix for failed migration)..."
echo "Starting server..."
# In monorepo standalone output, server.js is in apps/web/
exec node apps/web/server.js
