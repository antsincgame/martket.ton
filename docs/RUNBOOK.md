# TonForge — Operational Runbook

Production operations manual for the TonForge marketplace.

---

## Architecture Overview

```
User Browser
    │
    ├─► Frontend (Vite SPA @ :8080 / CDN)
    │     └─ React, TailwindCSS, TonConnect
    │
    └─► Backend API (Express @ :8081)
          ├─ Appwrite (Auth + Database)
          ├─ Cloudflare R2 (Asset storage)
          ├─ VirusTotal (Malware scanning)
          ├─ Resend (Transactional email)
          └─ Sentry (Error tracking, optional)
```

## Health Checks

### Liveness — `/api/health`
Returns `200 { status: "OK" }` if the process is alive.
Use for container restart probes (Docker HEALTHCHECK, Kubernetes livenessProbe).

```bash
curl -s http://localhost:8081/api/health | jq .
```

### Readiness — `/api/ready`
Returns `200` if Appwrite is configured and the service can handle traffic.
Returns `503` if critical dependencies are missing.
Use for load balancer routing (Kubernetes readinessProbe).

```bash
curl -s http://localhost:8081/api/ready | jq .
```

### Detailed Health (operators only)
Requires `HEALTH_DETAIL_TOKEN` env var and the `X-Health-Token` header.
Returns subsystem status: auth, storage, scan engine.

```bash
curl -s -H "X-Health-Token: $HEALTH_DETAIL_TOKEN" \
  "http://localhost:8081/api/health?detailed=1" | jq .
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API port (default: 8081) |
| `NODE_ENV` | Yes | `production` / `development` |
| `CORS_ORIGIN` | Yes | Frontend URL (e.g. `https://tonforge.org`) |
| `APPWRITE_ENDPOINT` | Yes | Appwrite API URL |
| `APPWRITE_PROJECT_ID` | Yes | Appwrite project ID |
| `APPWRITE_API_KEY` | Yes | Appwrite server API key |
| `TREASURY_WALLET_ADDRESS` | Yes | Platform treasury TON wallet |
| `HEALTH_DETAIL_TOKEN` | No | Token for detailed health endpoint |
| `SENTRY_DSN` | No | Sentry error tracking DSN |
| `VIRUSTOTAL_API_KEY` | No | VirusTotal malware scanning |
| `R2_ACCOUNT_ID` | No | Cloudflare R2 account |
| `R2_ACCESS_KEY_ID` | No | R2 access key |
| `R2_SECRET_ACCESS_KEY` | No | R2 secret key |
| `R2_BUCKET_NAME` | No | R2 bucket name |
| `RESEND_API_KEY` | No | Resend email API key |
| `RESEND_WEBHOOK_SECRET` | No | Resend inbound webhook signing secret |

## Logging

### Format
- **Production**: JSON lines to stdout/stderr (structured logging)
- **Development**: Human-readable with timestamps

### Log Fields
```json
{
  "ts": "2026-04-18T12:00:00.000Z",
  "level": "info|warn|error",
  "msg": "human-readable message",
  "stack": "optional error stack trace"
}
```

### HTTP Request Logs
Every non-health request is logged with:
```json
{
  "requestId": "uuid",
  "method": "GET|POST|...",
  "path": "/api/...",
  "status": 200,
  "durationMs": 42,
  "ip": "x.x.x.x",
  "ua": "user-agent string"
}
```

### Request Tracing
Every response includes an `X-Request-Id` header. Include this in bug reports.
If the client sends `X-Request-Id`, the server preserves it; otherwise generates a UUID.

### Slow Request Alerts
Requests taking longer than 3000ms are logged at `warn` level with tag `[http:slow]`.

## Incident Response

### High CPU / Memory
1. Check `/api/health` — is the service responding?
2. Check logs for `[http:slow]` entries — identify slow endpoints
3. Check scan worker — VirusTotal polling can be CPU-intensive
4. Restart the service: `docker restart tonforge-api`

### 5xx Errors Spiking
1. Check logs for `Unhandled error` entries — they include `requestId`
2. Check Appwrite status — `https://cloud.appwrite.io`
3. Check R2 connectivity — is storage accessible?
4. Verify `APPWRITE_API_KEY` hasn't expired

### Authentication Failures
1. Check Appwrite Console > Auth > Sessions — are sessions being created?
2. Verify `VITE_APPWRITE_ENDPOINT` and `VITE_APPWRITE_PROJECT_ID` in frontend
3. For GitHub OAuth: check GitHub OAuth App callback URL matches Appwrite's
4. For Email OTP: verify Appwrite email provider (SMTP/Resend) is configured

### Database Not Responding
1. Run `node scripts/provision-core.mjs` to verify/create collections
2. Check Appwrite Console > Databases — are collections present?
3. Verify `APPWRITE_API_KEY` has correct permissions

### Order Stuck in PENDING_PAYMENT
1. Check TTL cron — orders expire after 30 minutes automatically
2. Manual check: `GET /api/admin/orders` to see order state
3. Admin override: `POST /api/admin/orders/:id/state` with `{ state: "expired" }`

## Deployment Checklist

### Pre-deploy
- [ ] All CI checks pass (typecheck, lint, unit tests, E2E)
- [ ] Environment variables set in production
- [ ] Appwrite collections provisioned (`provision-core.mjs`)
- [ ] Commerce collections provisioned (`provision-commerce.mjs`)
- [ ] DNS records configured (CORS_ORIGIN matches)

### Post-deploy
- [ ] Hit `/api/health` — returns `{ status: "OK" }`
- [ ] Hit `/api/ready` — returns `{ ready: true }`
- [ ] Open the frontend — homepage loads
- [ ] Test sign-in flow (email OTP)
- [ ] Check logs for startup errors
- [ ] Verify `X-Request-Id` header on API responses
- [ ] Verify `X-Dharma-Shield: mahakala` header

### Rollback
1. Revert to the previous Docker image / commit
2. Restart the service
3. Verify health endpoints
4. Check that Appwrite schema hasn't changed (provision scripts are additive)

## Cron Jobs

| Job | Interval | Description |
|-----|----------|-------------|
| Order TTL | 10 min | Expires orders stuck in `PENDING_PAYMENT` > 30 min |
| Scan Worker | Continuous | Polls quarantine queue for VirusTotal results |

## Security Headers

All API responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `X-Dharma-Shield: mahakala`
- `X-Shield-Integrity: intact`
- `X-Request-Id: <uuid>`

Production CSP:
- `script-src 'self'` (no `unsafe-inline`, no `unsafe-eval`)
- `style-src 'self' 'unsafe-inline'` (required for TonConnect UI)
- `upgrade-insecure-requests`

## TON/USD Price Endpoint

### `GET /api/ton-price`
Returns the current TON/USD exchange rate, cached for 15 minutes.

```bash
curl -s http://localhost:8081/api/ton-price | jq .
# { "success": true, "data": { "usd": 1.33, "updatedAt": "2026-04-25T..." } }
```

Price providers (cascading fallback — first success wins):
1. **CoinCap v2** — free, no API key, 200 req/min (`api.coincap.io/v2/assets/toncoin`)
2. **CoinMarketRate** — free, no registration (`coinmarketrate.com`)

If all providers are down, returns the last cached value with `"stale": true`.

### Coolify Deployment Instructions

The `/api/ton-price` endpoint requires **no additional env vars**. Both
CoinCap and CoinMarketRate are free public APIs that work without API keys.

## Client Error Reporting

### `POST /api/client-errors`
Frontend ErrorBoundary sends crash details (message, stack, path, viewport)
to this endpoint. Errors are:
1. Logged to stdout with a unique `ce_*` error ID
2. Saved to the `api_audit_logs` collection with `action: "client_error"`
3. Visible in Admin Dashboard → Errors tab

Rate limited to 10 requests/minute per IP.

### `GET /api/admin/router-status`
Returns the list of optional routers that failed to load at startup.
Requires `X-Health-Token` header (same as detailed health).

```bash
curl -s -H "X-Health-Token: $HEALTH_DETAIL_TOKEN" \
  http://localhost:8081/api/admin/router-status | jq .
```

## Monitoring Recommendations

### Mandatory (implemented)
- Structured JSON logging to stdout
- Request ID tracing (`X-Request-Id`)
- HTTP request/response logging with duration
- Slow request detection (> 3s)
- Health + readiness endpoints

### Recommended (optional, external services)
- **Sentry**: Set `SENTRY_DSN` for error tracking with stack traces
- **Uptime monitoring**: Point UptimeRobot / Better Stack at `/api/health`
- **Log aggregation**: Forward stdout to Datadog / Grafana Loki / ELK
- **Alerting**: Set up alerts for:
  - `/api/ready` returning 503
  - Error rate > 5% over 5 minutes
  - P99 latency > 5 seconds
  - Disk usage > 80%
  - `CRITICAL: Router` in logs (optional router failed to load)
  - `[client-error]` in logs (frontend crash reported)
  - `/api/admin/router-status` returning `healthy: false`
