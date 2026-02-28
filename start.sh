#\!/bin/sh

echo "Running database migrations..."
timeout 30 node node_modules/prisma/build/index.js migrate deploy --schema=prisma/schema.prisma 2>&1 || echo "Migration skipped or failed (non-fatal)"

echo "Seeding database if empty..."
timeout 15 node prisma/seed-prod.mjs 2>&1 || echo "Seed skipped or failed (non-fatal)"

echo "Starting application on port ${PORT:-3000}..."
exec node server.js
