# BYOS — Bring Your Own Storage / Distribution

> Status: implemented in v3.1
> Audience: demiurges (publishers) and platform operators

## Summary

The TonForge Platform follows a **BYOS (Bring Your Own Storage)** model.
The Platform stores only:

- product metadata (title, description, price)
- a **distribution manifest** (locator + SHA256)

It does **not** host build files, screenshots, or covers. Builds live on storage
chosen by the demiurge.

Two source kinds are supported in MVP:

| Kind     | Best for             | Cost to demiurge          | DRM control       |
| -------- | -------------------- | ------------------------- | ----------------- |
| `r2`     | Paid / DRM products  | Free (10 GB R2 free tier) | Signed URLs (1h)  |
| `github` | Open source / free   | Free (unlimited public)   | None — public URL |

Outcome: zero platform R2 storage cost for builds; zero egress cost on downloads
(buyer is redirected to the source URL via HTTP 302).

---

## Architecture

```
Demiurge ─upload─► Source (R2 bucket / GitHub Release)
        │
        ├─register manifest─► Platform Backend ─store─► Appwrite
        │                       │
        │                       └─stream + sha256─► Source (verify)
        │
        └─submit for moderation
                                Moderator ─Run VT Scan─► VirusTotal
                                                         │
                                                         └─stream from Source
                                Moderator ─approve─► product live

Buyer holds NFT ─GET /download─► Platform Backend
                                  │ entitlement check
                                  │ rate limit (≤20/day)
                                  │
                                  └─302 redirect─► Source (presigned 1h / public URL)
```

---

## Setup guide for demiurges

### Option A — Cloudflare R2 (recommended for paid apps)

1. Create a Cloudflare account → R2 → Create bucket (e.g. `my-app-builds`).
2. R2 → Manage R2 API Tokens → Create API token:
   - Permissions: **Object Read & Write** for `my-app-builds`
   - TTL: never expires (or rotate periodically)
3. Copy `Account ID`, `Access Key ID`, `Secret Access Key`.
4. Open the Platform → Profile → Commerce → **Storage** tab.
5. Provider: `Cloudflare R2`. Fill the fields, click **Save & test**.
6. Status badge should turn **Connected**.

For each product:

1. Upload your build to R2 with any tool (`wrangler`, `rclone`, `aws s3 cp`).
2. Note the object key, e.g. `releases/v1.0.0/build.zip`.
3. Compute SHA256:
   - Linux/macOS: `sha256sum build.zip`
   - Windows: `Get-FileHash build.zip -Algorithm SHA256`
4. Open the listing → **Distribution manifest** → R2 → fill bucket, key, sha256.
5. Click **Verify (stream + hash)** — backend streams the file and confirms hash.
6. State badge turns **Verified**. You can now submit for moderation.

### Option B — GitHub Releases (for open source)

1. Create a public repository.
2. `gh release create v1.0.0 ./build.zip --title "v1.0.0"` (or via web UI).
3. Open the listing → **Distribution manifest** → GitHub Release → fill:
   - Repository: `acme/my-app`
   - Tag: `v1.0.0`
   - Asset: `build.zip` (must match the file name in the release)
   - SHA256
4. Click **Verify** — backend fetches the asset and confirms hash.

> Private repos are **not** supported in MVP. Use R2 for private DRM.

---

## How downloads work for buyers

1. Buyer clicks "Download" in their licenses panel.
2. Frontend calls `GET /api/v1/commerce/listings/:id/download`.
3. Backend:
   - Verifies the buyer has an active entitlement.
   - Checks rate limit (≤20 redirects per license per 24h).
   - Generates source URL (R2 presigned with 1h TTL, or GitHub raw URL).
   - Returns HTTP **302 redirect** to that URL.
4. Browser follows the redirect → downloads from the source directly.
   - **No platform egress** — file bytes never touch our server.

### About the 1-hour TTL

The TTL is the window to **start** the download, not the maximum transfer time.
Once the GET request authenticates, the connection lives until the file finishes.
For very heavy builds on slow connections, the demiurge can set TTL up to 6h in
the Distribution Editor.

If the connection drops mid-download, the frontend uses
[`resumableDownload`](../src/lib/resumableDownload.ts) — it requests a fresh
URL and resumes with a `Range` header.

---

## Distribution SLA

By submitting a product, the demiurge agrees to the
[Distribution SLA in Terms of Service § 5A](../src/pages/legal/TermsOfService.tsx):

- File available throughout the lifetime of any active license + 30-day grace period.
- Hash must match the registered SHA256 (no hot-swap).
- ≥99% uptime over a rolling 30-day window (measured by the platform's health-check).
- 30-day notice before changing the source.

Violations escalate: warning → 7-day suspension → permanent ban + automatic refund
to all impacted buyers from the demiurge's accrued earnings.

---

## VirusTotal scanning

VT scans are **manual**, triggered by moderators on demand:

- Moderator opens the product in the moderation queue.
- Clicks **Run VT Scan**.
- Backend:
  1. Looks up the SHA256 in VT's existing reports (free, no upload).
  2. If unknown, streams the file from source → submits to VT.
  3. Polls the analysis until completed.
- The verdict is cached by SHA256. As long as the demiurge does not change the
  file, the same scan result is reused.

Files >32 MB exceed VT's free-tier limit and are flagged as `oversize_skip` —
moderator should download them via the standard 302 flow and inspect locally.

---

## What the platform still hosts

- Profile avatars and banners (small, in R2 free tier).
- Product metadata (Appwrite database).
- Distribution manifest (Appwrite database).
- Audit logs (`commerce_audit_logs`, `download_audit`).

Total platform storage cost for builds and product images: **zero**.

---

## Configuration (operators)

Required env:

```
STORAGE_ENCRYPTION_KEY=<openssl rand -hex 32>
```

R2 credentials for avatars/banners stay as before:

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
```

VirusTotal:

```
VIRUSTOTAL_API_KEY=...
VIRUSTOTAL_THRESHOLD_MALICIOUS=1
VIRUSTOTAL_THRESHOLD_SUSPICIOUS=3
```

Provision Appwrite schema (creates BYOS attributes + `download_audit` collection):

```
node scripts/provision-commerce.mjs
```

---

## API reference

### Storage credentials

```
POST   /api/v1/commerce/storage         { wallet, provider, accountId, bucket, accessKeyId, secretAccessKey, ... }
GET    /api/v1/commerce/storage?wallet=...
POST   /api/v1/commerce/storage/test    { wallet }
DELETE /api/v1/commerce/storage         { wallet }
```

### Distribution manifest

```
PUT  /api/v1/commerce/listings/:id/distribution         { wallet, manifest, ttlSec? }
POST /api/v1/commerce/listings/:id/distribution/verify  { wallet }
GET  /api/v1/commerce/listings/:id/distribution
GET  /api/v1/commerce/listings/:id/download             → 302 redirect
```

### Manual VirusTotal scan (moderator only)

```
POST /api/v1/commerce/listings/:id/scan
GET  /api/v1/commerce/listings/:id/scan
```
