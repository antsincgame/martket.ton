# Ops hand-off (Coolify)

Closes the non-code remainder of the P2 roadmap. Prod secrets live in **Coolify**
(injected as env into the `api` container) and the data lives in **Appwrite** —
there is **no external machine with prod creds**, so these run *inside* the
deployed backend container, or are set in the Coolify UI. The root `provision-*`
scripts only work from a machine that already has the Appwrite key (fresh-setup
tooling), not from a credential-less workstation.

## 1 — public search fulltext index → AUTOMATIC

`ensureSearchIndex()` runs at backend startup (post-`listen`, guarded) and
idempotently creates the Fulltext index on `legacy_products.name`, so
`Query.search` stops falling back to the in-memory scan. **No action needed** —
it is applied on the next deploy.

**Verify:** in the `api` container logs after boot, look for
`[search-index] created legacy_products.idx_name_fulltext` (first time) or
`already exists` (debug). Then `GET /api/products/search?q=<term>` returns
matches with no fallback path.

## 2 — compliance ledger re-rate back-fill → in-container

Fills `ton_usd_rate` on entries recorded null during an oracle outage (#109).
Run from **Coolify → the `api` resource → Execute Command / Terminal** (the
container already has the Appwrite env + `tsx`); WORKDIR is `/app`:

```bash
# DRY-RUN first — prints the plan, writes nothing (oracle rate):
node --import tsx scripts/backfill-ledger-rate.ts

# Apply to recent nulls (default window 48h, live rate ≈ txn rate):
node --import tsx scripts/backfill-ledger-rate.ts --apply

# Older nulls: supply the historical rate that held at txn time:
node --import tsx scripts/backfill-ledger-rate.ts --rate=5.12 --apply
```

(or `npm run backfill:ledger-rate -- --apply`). Flags: `--apply` (write; default
dry-run), `--rate=<n>` (explicit historical rate; else the backend oracle),
`--max-age-hours=<n>` (auto-rate window, default 48). Entries older than the
window are **listed, not auto-rated** — re-run with `--rate` to fill them.

**Verify:** re-run the dry-run → `nothing to fill ✓`; the ledger CSV/UI shows a
rate instead of `unavailable`.

## 3 — `TON_USD_FALLBACK` → Coolify env

Add to the `api` service env in the Coolify UI and redeploy, so the oracle never
reaches the null branch (it cascades providers → stale cache → `TON_USD_FALLBACK`):

```
TON_USD_FALLBACK=5.20   # resilient: a value within a plausible band; refresh periodically
```

With this set, step 2 becomes rarely needed.

## 4 — fresh-Appwrite provision (only when standing up a NEW project)

Schema is already provisioned for the running env. For a brand-new Appwrite,
run the provision scripts from a machine that holds the Appwrite key (they are
fresh-setup tooling, not part of the deploy):

```bash
APPWRITE_ENDPOINT=… APPWRITE_PROJECT_ID=… APPWRITE_API_KEY=… \
  npm run provision:core && npm run provision:commerce
```

`provision-core` also creates the search index (same one as step 1); both are
idempotent (existing attributes/indexes report 409 and are skipped).
