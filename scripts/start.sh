#!/usr/bin/env sh
# Production start: create the database (from the demo snapshot on first boot), sync the schema, set the admin password.
set -e
mkdir -p storage
if [ ! -f storage/app.db ] && [ "${LOAD_DEMO_DATA:-1}" = "1" ]; then
  cp prisma/demo/demo.db storage/app.db
fi
npx prisma db push --skip-generate
npx tsx prisma/seed.ts
exec npx next start -p "${PORT:-3000}"
