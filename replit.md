# Karm Baba B2B Marketplace

A full-stack B2B wholesale marketplace platform inspired by Alibaba.com, branded for India/global wholesale trade.

## Run & Operate

- `pnpm dev` — single Express server (API + Vite middleware) on `PORT` (default **8080**)
- `pnpm test` — API unit tests (Vitest)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — rebuild lib declarations (run after schema changes)
- `pnpm run build` — typecheck + build all packages
- `pnpm db:migrate:dev` — create/apply Prisma migrations locally
- `pnpm db:migrate` — deploy pending migrations (CI / post-merge)
- `pnpm db:studio` — Prisma Studio
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: see `.env.example` — especially `DATABASE_URL`, Clerk keys (`CLERK_*` / `VITE_CLERK_*`), `APP_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifact: karm-baba, previewPath: /)
- API: Express 5 (artifact: api-server, port 8080; serves `/api` + frontend in `pnpm dev`)
- Auth: **Clerk** (`@clerk/react` frontend, `@clerk/express` API)
- Object storage: GCS / S3 / Cloudflare R2 via presigned PUT (`OBJECT_STORAGE_DRIVER`); Replit sidecar is legacy-only
- DB: PostgreSQL + **Prisma** (`lib/db/prisma/schema.prisma`, versioned migrations)
- Validation: Zod (`@workspace/api-zod`, generated from OpenAPI)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (API bundle)
- Routing: wouter
- Animations: framer-motion
- Icons: lucide-react

## Where things live

- `lib/db/prisma/schema.prisma` — DB schema (categories, users, suppliers, products, rfq, reviews)
- `lib/db/prisma/migrations/` — versioned SQL migrations (prefer `db:migrate` over `db:push`)
- `lib/api-zod/src/generated/api.ts` — Zod schemas from OpenAPI spec
- `lib/api-client-react/src/generated/api.ts` — React Query hooks
- `artifacts/api-server/src/routes/` — Express route files
- `artifacts/api-server/src/lib/auth.ts` — Clerk middleware (`requireClerkAuth`)
- `artifacts/api-server/src/lib/authorize.ts` — role / supplier ownership helpers
- `artifacts/karm-baba/src/pages/` — page components (incl. `/onboarding`)
- `artifacts/karm-baba/src/context/AuthContext.tsx` — Clerk session → `POST /api/users/sync` → app user
- `artifacts/karm-baba/src/components/` — Header, Footer, StarRating, OnboardingGate

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → React Query hooks + Zod validation
- **Auth:** Clerk handles sign-in/up; API requires Bearer session tokens. App role lives in Postgres (`users.role`), chosen via `/onboarding` (`POST /api/users/me/onboarding`). Sync does **not** overwrite buyer/seller from opaque Clerk `publicMetadata` (admin elevation only).
- Legacy password routes (`POST /api/users`, `/api/users/login`) are **off** unless `ALLOW_LEGACY_PASSWORD_AUTH=true`
- Numeric DB columns (price, rating) stored as Decimal in Postgres; convert with `toNumber()` before API responses
- `GET /products/featured` is declared BEFORE `/products/:id` in Express router to avoid route conflict
- `createdAt` Date objects from Prisma must be converted to `.toISOString()` before Zod response schemas
- Foreign keys enforce referential integrity; `users.supplier_id` is integer FK → `suppliers`

## Product

B2B marketplace: Homepage with hero search + category grid + featured products/suppliers, Product catalog with filters, Product detail with RFQ modal, Supplier directory, Supplier profiles, RFQ submission, My RFQs, Login/Register (Clerk), role onboarding (buyer/seller), Seller dashboard (products + RFQs).

Demo seed accounts (legacy password auth only when enabled): buyer@demo.com / demo123, seller@demo.com / demo123, admin@karmbaba.com / admin123

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing Prisma schema, add a migration (`pnpm db:migrate:dev`) then `pnpm db:generate` / `pnpm run typecheck:libs`
- Prefer `pnpm db:migrate` over `pnpm db:push` (push is emergency-only)
- Prisma Decimal / numeric fields come back as Decimal objects — use `toNumber()` before returning in API responses
- Timestamps come back as Date objects — always `.toISOString()` before Zod validation
- Express 5: wildcard routes must use `/{*splat}`, optional params use `/path{/:id}`
- Seller dashboard must never default a missing `supplierId` to another shop (IDOR)
- Object storage: do **not** rely on the Replit sidecar on Vercel — set `OBJECT_STORAGE_DRIVER=gcs` or `s3` with real credentials (see `.env.example`)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
