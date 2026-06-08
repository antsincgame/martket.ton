# Terra ops hand-off — astropathic work-order

Ops tasks that need a live prod environment (Appwrite admin key, network egress)
— run from a machine that reaches prod, e.g. local Cursor. Each scroll is
idempotent and safe to re-run. These close the non-code remainder of the P2
roadmap (`docs/agent-autonomy-roadmap.md`).

## Preconditions

Set these in the environment (or `.env` at repo root):

```
APPWRITE_ENDPOINT=https://<your-appwrite>/v1
APPWRITE_PROJECT_ID=<project id>
APPWRITE_API_KEY=<server API key with databases.write>
```

`npm install` once so `node-appwrite` + `dotenv` are present.

---

## Scroll 1 — public search fulltext index

**Why:** `searchProducts()` uses `Query.search('name', q)`. Without a Fulltext
index on `legacy_products.name` that call throws and degrades into a bounded
in-memory scan (#108). This index makes the primary path work.

```bash
npm run provision:search-index
```

- Idempotent — a 409 (already exists) is reported as success.
- Waits for the index to finish building before exiting.
- Also created automatically by a full `npm run provision:core`; this standalone
  scroll just avoids re-running the whole core provision.

**Verify:** `GET /api/products/search?q=<term>` returns matches; backend logs show
no `[search]` fallback path.

---

## Scroll 2 — compliance ledger re-rate back-fill

**Why:** during a cold oracle outage, `recordLedgerEntry` writes `ton_usd_rate =
null` (honest "unknown", #109). This fills those nulls so the audit record is
complete.

```bash
# 1) DRY-RUN first — prints the plan, writes nothing (live CoinCap rate):
npm run backfill:ledger-rate

# 2) Apply to recent nulls (default window: 48h, live rate ≈ txn rate):
npm run backfill:ledger-rate -- --apply

# 3) Older nulls: supply the historical rate that held at txn time:
npm run backfill:ledger-rate -- --rate=5.12 --apply
```

Flags: `--apply` (write; default is dry-run), `--rate=<n>` (explicit historical
rate; otherwise live CoinCap), `--max-age-hours=<n>` (auto-rate window, default
48). Entries older than the window are **listed, not auto-rated** — re-run with
`--rate` to fill them deliberately.

**Verify:** re-run dry-run → `0 to fill`; the ledger CSV/UI shows a rate instead
of "unavailable".

---

## Scroll 3 — `TON_USD_FALLBACK` (close the null window at the source)

Set a sane resilient fallback so the oracle never reaches the throw/null branch
(it cascades providers → stale cache → `TON_USD_FALLBACK`):

```
TON_USD_FALLBACK=<recent TON/USD, e.g. 5.20>
```

Recommendation: resilient with a sanity bound — pick a value within a plausible
band of the live price and refresh it periodically. With this set, Scroll 2
becomes rarely-needed.

---

## Scroll 4 — prod provision (schema parity)

Brings prod Appwrite up to the current schema (incl. the Scroll-1 index and the
`agent_instructions` / `seller_collections` collections):

```bash
npm run provision:core
npm run provision:commerce
```

Both are idempotent (existing collections/attributes/indexes report 409 and are
skipped).
