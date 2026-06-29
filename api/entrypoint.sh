#!/bin/sh
set -e

# Apply pending Prisma migrations before booting Nest.
# Uses DATABASE_URL from the container environment (loaded by docker-compose env_file).
echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] Starting Nest..."
exec node dist/main.js