# Karm Baba B2B Marketplace

A full-stack B2B wholesale marketplace platform inspired by Alibaba.com, branded for India/global wholesale trade.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 / via proxy at /api)
- `pnpm --filter @workspace/karm-baba run dev` — run the React frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — rebuild lib declarations (run after schema changes)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifact: karm-baba, previewPath: /)
- API: Express 5 (artifact: api-server, port 8080)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Routing: wouter
- Animations: framer-motion
- Icons: lucide-react

## Where things live

- `lib/db/src/schema/` — DB schema (categories, users, suppliers, products, rfq, reviews)
- `lib/api-zod/src/generated/api.ts` — Zod schemas from OpenAPI spec
- `lib/api-client-react/src/generated/api.ts` — React Query hooks
- `artifacts/api-server/src/routes/` — Express route files (categories, products, suppliers, rfq, users, reviews, dashboard)
- `artifacts/karm-baba/src/pages/` — All 10 page components
- `artifacts/karm-baba/src/context/AuthContext.tsx` — Auth state (localStorage-based)
- `artifacts/karm-baba/src/components/` — Header, Footer, StarRating

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → React Query hooks + Zod validation
- Auth is simple localStorage + React context (no external library); no JWT/sessions
- Numeric DB columns (price, rating) stored as NUMERIC string in Postgres, parseFloat() when returning from API
- `GET /products/featured` is declared BEFORE `/products/:id` in Express router to avoid route conflict
- `createdAt` Date objects from Drizzle must be converted to `.toISOString()` before passing to Zod response schemas

## Product

10-page B2B marketplace: Homepage with hero search + category grid + featured products/suppliers, Product catalog with filters, Product detail with RFQ modal, Supplier directory, Supplier profiles, RFQ submission form, My RFQs list, Login, Register, Dashboard.

Demo accounts: buyer@demo.com/demo123, seller@demo.com/demo123, admin@karmbaba.com/admin123

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing schema in `lib/db/`, run `pnpm run typecheck:libs` before typechecking leaf packages
- Drizzle NUMERIC columns come back as strings — always parseFloat() them before returning in API responses
- Drizzle timestamp columns come back as Date objects — always `.toISOString()` before Zod validation
- Express 5: wildcard routes must use `/{*splat}`, optional params use `/path{/:id}`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
