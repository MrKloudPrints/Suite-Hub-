#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy 2>&1 || echo "Migration warning (may be first deploy)"

echo "Starting application..."
exec node server.js
