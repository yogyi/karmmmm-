#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Apply versioned Prisma migrations (not db push).
pnpm --filter @workspace/db migrate:deploy
