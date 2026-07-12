---
name: Object Storage (GCS) setup for Karm Baba
description: Presigned URL upload flow is live; covers server setup, client hook, and serving pattern.
---

## Rule
Store `objectPath` returned from `POST /api/storage/uploads/request-url` in the DB. Serve via `GET /api/storage${objectPath}`.

**Why:** Object storage uses Replit-managed GCS bucket (auto-provisioned via `setupObjectStorage()`). Files upload directly to GCS via presigned PUT URL — never through the Express server.

**How to apply:**
- Upload: `useUpload()` hook from `@workspace/object-storage-web` handles both the presigned URL request and the GCS PUT.
- Serving: `<img src={/api/storage${objectPath}} />` — the storage route is mounted in `routes/index.ts`.
- The `lib/object-storage-web/tsconfig.json` must have `composite: true, declarationMap: true, emitDeclarationOnly: true` to build as a composite lib.
- Add pnpm overrides `{ "react": "19.1.0", "react-dom": "19.1.0" }` in root `package.json` before installing Uppy.
