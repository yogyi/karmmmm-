# Object storage (Karm Baba)

## Production (Vercel) — use Blob

Product images must not use local disk on serverless.

1. Open the Vercel project (`karmmmm-api-server`) → **Storage** → **Create** → **Blob**
2. Connect the store to the project (Production + Preview)
3. Vercel injects `BLOB_READ_WRITE_TOKEN` automatically
4. Set env (optional explicit):
   - `OBJECT_STORAGE_DRIVER=blob`
   - `PRIVATE_OBJECT_DIR=/karmbaba-blob/private` (default if unset)
5. Redeploy

Auto-detect: if `BLOB_READ_WRITE_TOKEN` is present, or `VERCEL=1`, the API uses the `blob` driver.

## Drivers

| Driver | When |
|--------|------|
| `blob` | Vercel Blob (`BLOB_READ_WRITE_TOKEN`) — **preferred on Vercel** |
| `s3` | AWS S3 / Cloudflare R2 |
| `gcs` | Google Cloud Storage |
| `local` | Local disk only (`pnpm dev`) — never on Vercel |
| `replit` | Legacy Replit sidecar |

## Upload flow

1. `POST /api/storage/uploads/request-url`
2. `PUT` file to returned URL (Blob/local: `/api/storage/uploads/put/:id`)
3. `POST /api/storage/uploads/finalize` (ACL / public)
4. Serve via `/api/storage/objects/...` (Blob public → 302 to CDN URL)
