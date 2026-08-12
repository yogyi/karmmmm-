---
name: Object Storage (GCS) setup for Karm Baba
description: Presigned URL upload flow; GCS / S3 / R2 drivers; Replit sidecar is legacy-only.
---

## Rule
Store `objectPath` returned from `POST /api/storage/uploads/request-url` in the DB. Serve via `GET /api/storage${objectPath}`.

**Why:** Files upload directly to cloud storage via a **presigned PUT URL** — never through the Express server. Signing must work off Replit (Vercel/local).

**Drivers** (`OBJECT_STORAGE_DRIVER`, or auto-detect):
- `gcs` — `@google-cloud/storage` V4 signed URLs + `GCS_SERVICE_ACCOUNT_JSON` / ADC
- `s3` — AWS S3 or Cloudflare R2 (`S3_ENDPOINT` / `R2_ACCOUNT_ID` + AWS keys)
- `replit` — local sidecar at `127.0.0.1:1106` (legacy; fails on Vercel)

Paths: `PRIVATE_OBJECT_DIR=/bucket/private`, `PUBLIC_OBJECT_SEARCH_PATHS=/bucket/public`

**How to apply:**
- Upload: `useUpload()` from `@workspace/object-storage-web`
- Serving: `<img src={/api/storage${objectPath}} />`
- See `.env.example` for credential env vars
