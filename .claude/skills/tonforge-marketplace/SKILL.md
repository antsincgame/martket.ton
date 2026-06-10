---
name: tonforge-marketplace
description: >-
  Operate the TonForge marketplace (digital goods on the TON blockchain) as an
  agent — search the public catalog and offers, and manage a seller's listings,
  distribution, and orders via the Agent API or its MCP server. Use when the user
  mentions TonForge, buying/selling digital goods on TON, marketplace listings,
  agent tokens (tfa_), or the TonForge / Agent / buyer API.
---

# TonForge marketplace

TonForge is a TON-blockchain marketplace for digital goods. Every purchase mints
a license NFT and gates the download on that mint. This skill covers operating it
programmatically: **discovery** (public) and **seller management** (token).

- Base API: `https://tonforge.org/api/v1/agent`
- OpenAPI: https://github.com/antsincgame/martket.ton/blob/main/docs/openapi/agent-api.yaml
- Full docs: [agent-api](https://github.com/antsincgame/martket.ton/blob/main/docs/agent-api.md) · [buyer-api](https://github.com/antsincgame/martket.ton/blob/main/docs/buyer-api.md) · [mcp](https://github.com/antsincgame/martket.ton/blob/main/docs/mcp.md)

## Two ways to connect

1. **MCP server (preferred for assistants).** `npx tonforge-agent-mcp`, or the MCP
   registry name `io.github.antsincgame/tonforge-agent`. It exposes **19 tools**:
   - **Self-onboarding (a machine Demiurge sets itself up):** `get_instructions`,
     `get_status`, `register_seller`, `set_storage`, `create_product`,
     `assistant_help`.
   - **Seller management (need a token):** `whoami`, `list_listings`,
     `create_listing`, `update_listing`, `set_distribution`,
     `verify_distribution`, `list_orders`, `get_analytics`, `set_webhook`,
     `delete_webhook`.
   - **Discovery (public, no token):** `search_products`, `get_product`,
     `list_offers`.
2. **Plain HTTPS.** Call the REST endpoints directly (see below).

## An agent can onboard itself

The platform is built so a machine Demiurge becomes a seller on its own, stopping
only at the one human gate (KYC — a real accountable owner, the "Know Your Agent"
standard). The path, all as MCP tools or REST calls:

```
register_seller  →  set_storage  →  create_product  →  [human: KYC]  →  create_listing  →  set_distribution / verify_distribution  →  list_orders
```

Drive it from `get_status`: it returns an onboarding checklist plus a
`nextAction` (the exact next call to make). `get_instructions` is the full,
honest operating manual, and `assistant_help` answers a free-text question
grounded in that manual + your live status. All three are readable **before KYC**,
so an agent can see the whole path before committing.

## Authentication

- **Discovery is keyless.** The catalog endpoints need no auth.
- **Seller actions need a Personal Access Token** that looks like `tfa_…`, issued
  by a *verified* seller (KYC-approved, not sanctioned). Send it as
  `Authorization: Bearer tfa_…`. The acting wallet is derived from the token, never
  from the request body. Scopes: `listings:read`, `listings:write`, `orders:read`,
  `distribution:write`. Every call re-screens sanctions (451) and KYC (403).
- A human issues/revokes tokens via `POST|DELETE /api/v1/commerce/agent-tokens`
  (session-authenticated). Never ask the user to paste a token into chat — have
  them set `TONFORGE_AGENT_TOKEN` in the MCP server's environment.

## Discovery (public, no auth)

```
GET https://tonforge.org/api/products                          # all published products
GET https://tonforge.org/api/products/search?q=<kw>&limit=<n>  # search (q >= 2)
GET https://tonforge.org/api/products/{id}                     # one product
GET https://tonforge.org/api/v1/commerce/listings/catalog/{catalogProductId}  # offers
```

A *product* is the catalog item; a *listing* is a seller's offer of it (price,
delivery). Buyers choose a listing. Each offer carries the **buyer total to pay**
(`buyerTotalTonHuman` / `buyerTotalRaw` = seller price + the effective platform
fee, already clamped) so a shopping agent can quote the exact cost without
re-deriving the fee math or creating an order.

## Seller actions (need a token + scope)

```
GET   /api/v1/agent/me                                  # token identity
GET   /api/v1/agent/instructions                        # instructions:read (pre-KYC ok)
GET   /api/v1/agent/status                              # any token (pre-KYC ok)
POST  /api/v1/agent/help                                # instructions:read — grounded Q&A (pre-KYC ok)
POST  /api/v1/agent/sellers/register                    # any token — self-register seller profile (idempotent, pre-KYC ok)
POST  /api/v1/agent/storage                             # distribution:write — connect your BYOS bucket (R2/S3/B2)
POST  /api/v1/agent/products                            # products:write (creates a draft)
GET   /api/v1/agent/listings                            # listings:read
POST  /api/v1/agent/listings                            # listings:write
PATCH /api/v1/agent/listings/{id}                       # listings:write
PUT   /api/v1/agent/listings/{id}/distribution          # distribution:write
POST  /api/v1/agent/listings/{id}/distribution/verify   # distribution:write
GET   /api/v1/agent/orders?limit=                       # orders:read
GET   /api/v1/agent/analytics                           # orders:read — store performance (sales, revenue split, top products)
POST  /api/v1/agent/webhook                             # orders:read — register an event webhook (returns a signing secret once)
DELETE /api/v1/agent/webhook                            # orders:read — remove the event webhook
```

### Event webhooks (react to sales without polling)

Register an HTTPS endpoint with `set_webhook` (or `POST /webhook`) and the
platform POSTs signed events as they happen, so an agent runs its storefront
event-driven instead of polling `/orders`:

- **`order.paid`** — a purchase settled (license minted); carries orderId,
  listingId/title, buyerWallet, amounts, licenseAddress.
- **`payout.released`** — escrow released to the seller; carries licenseId,
  orderId, escrowAddress, releasedAt.

Each delivery sets `X-TonForge-Event` and `X-TonForge-Signature: sha256=<HMAC>`.
Verify it with the secret returned at registration (HMAC-SHA256 over the raw
body). Delivery is best-effort with retries; treat it as an optimisation over
polling, not a guaranteed-exactly-once bus.

Start by reading `GET /api/v1/agent/instructions` — it returns the platform's
machine-readable onboarding manual (honest service description, prerequisites,
lifecycle, KYC and conduct policy) plus a personalised onboarding checklist.
`GET /api/v1/agent/status` returns your onboarding progress and listing/order
aggregates. Both are readable before KYC so you can see what's left to do.

Responses wrap data in `{ "data": … }`. Errors carry a `code` — branch on it,
not the message. Per-token rate limit: 600 req / 15 min (`X-RateLimit-*` headers).

## Buying is non-custodial — important

An agent **cannot** complete a purchase on a buyer's behalf: funding the escrow
requires the buyer's own TON wallet to sign, plus the buyer's KYC/AML. The
supported pattern is **discover → prepare the order (`POST /api/v1/commerce/orders`,
session-auth) → hand the escrow transaction to the user's wallet to sign →
confirm → collect delivery**. Do not imply you can move a user's funds.

## Quickstart (curl)

```bash
export T=tfa_…
curl -s https://tonforge.org/api/v1/agent/me -H "Authorization: Bearer $T" | jq
curl -s "https://tonforge.org/api/products/search?q=wallpaper" | jq '.data'
```

Runnable TypeScript/Python clients:
https://github.com/antsincgame/martket.ton/tree/main/docs/agent-api-examples
