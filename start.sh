#!/bin/sh
set -e

echo "Running database migrations..."
# Use direct path — npx can't resolve local bins in standalone image
node node_modules/prisma/build/index.js migrate deploy 2>&1 || echo "Migration warning (may be first deploy)"

echo "Starting application..."
exec node server.js
