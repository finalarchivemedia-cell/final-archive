# Final Archive Backend

Production-ready backend for "Final Archive", handling 5-digit image IDs, R2 storage sync, and public API with caching.

## Features

- **Stable 5-digit IDs**: Images get a permanent `00000`-`99999` ID.
- **R2 Sync**: Automatically registers images dropped into Cloudflare R2 bucket.
- **Webhook Support**: Real-time registration via R2 event notifications.
- **Caching**:
  - `/api/images` cached for 10s (SWR).
  - `/api/images/:id` cached for 60s (SWR).
  - Public settings cached for 5m.
- **CDN Integrated**: Returns full CDN URLs (when R2 sync enabled).
- **Admin API**: Secured with JWT, allows setting crop/duration values and manual sync.

## Prerequisites

- Node.js v18+
- PostgreSQL
- Cloudflare R2 Bucket + Access Keys (Optional for Local Dev)

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Copy `.env.example` to `.env` and fill in the details:
   ```bash
   cp .env.example .env
   ```
   
   **Key Variables:**
   - `DATABASE_URL`: Postgres connection string.
   - `ENABLE_R2_SYNC`: Set to `true` to enable R2 features. Default is `false`.
   - `R2_BUCKET`: Your R2 bucket name (Required if ENABLE_R2_SYNC=true).
   - `R2_ENDPOINT`: `https://<account-id>.r2.cloudflarestorage.com` (Required if ENABLE_R2_SYNC=true).
   - `CDN_BASE_URL`: Public domain mapping (Required if ENABLE_R2_SYNC=true).
   - `WEBHOOK_SECRET`: Shared secret for protecting the webhook endpoint.
   - `CORS_ORIGINS`: Comma-separated list of allowed frontend origins (ex: `https://finalarchivemedia.com,https://www.finalarchivemedia.com`)
   - `RESEND_API_KEY`: API key for sending contact emails (recommended provider: Resend).
   - `CONTACT_TO`: Destination email for contact form (default: `Contact@FinalArchiveMedia.com`).
   - `CONTACT_FROM`: Sender for Resend (must be verified in Resend).

3. **Database Migration**
   ```bash
   npx prisma db push
   # OR
   npx prisma migrate dev --name init
   ```

4. **Run Development Server**
   - **Backend Only**: `npm run dev:backend`
   - **Full Stack (if frontend present)**: `npm run dev:all`
   
   *Note: If R2 is disabled, you will see a warning in the console.*

5. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Cloudflare R2 Setup

### 1. Webhook
Configure an Event Notification on your R2 bucket (or via Worker) to POST to:
`https://your-backend.com/api/storage/webhook`

Headers:
`X-Webhook-Secret: <your_secret>`

### 2. Scheduler
The backend includes a built-in scheduler (every 60s) that scans R2 for new images. 
This ensures that even if webhooks fail, images eventually appear.

## API Usage

### Public
- `GET /api/images` - List all active images.
- `GET /api/images/:id` - Get single image. Returns 410 if deactivated.
- `GET /api/images/random` - Get a random active image.
- `GET /api/settings` - Get display configuration.
- `POST /api/contact` - Send contact message `{ email, message }` (requires `RESEND_API_KEY`).

### Admin (Header: `Authorization: Bearer <token>`)
- `POST /api/admin/login` - Body: `{ password: "..." }` -> Returns `{ token }`.
- `PUT /api/admin/settings` - Update crop/duration.
- `POST /api/admin/refresh` - Trigger manual R2 sync.
- `POST /api/admin/images/:id/deactivate` - Soft delete an image.

## License
Private.

## Recommended Hosting (Simple + Fast)

- **Domain / DNS**: Keep domain in Squarespace, just edit DNS records to point to hosting.
- **Frontend (React)**: Cloudflare Pages (fast global CDN + SPA routing).
- **Backend (Fastify API)**: Fly.io or Render (simple Node deploy).
- **Database**: Neon (Postgres) or Supabase Postgres.
- **Image Storage**: Cloudflare R2 + (optional) Cloudflare CDN via custom domain.
- **Contact Email**: Resend (deliverability + simple API).

### SPA Routing (required for `finalarchivemedia.com/12345`)
Because the app uses `BrowserRouter`, your host must rewrite unknown paths to `index.html`.
- Cloudflare Pages: add a `_redirects` file with `/* /index.html 200`
- Netlify: same rule works via `_redirects`

### “Drop a JPEG, it appears” (no upload button)
This project is built for **Cloudflare R2** ingestion:
- Upload JPEGs directly to the R2 bucket (Cloudflare UI / S3 client) and they will appear automatically via:
  - **Webhook** (near real-time), plus
  - **Scheduler** fallback sync (every 60 seconds).

If you specifically want **iCloud → automatic publish**, the clean approach is:
- Use a small always-on machine (Mac mini at home, or a cheap VPS) running `rclone` to sync an iCloud folder to R2 on a schedule.
  - iCloud folder → local folder
  - `rclone sync` local folder → `s3:r2-bucket/prefix`

