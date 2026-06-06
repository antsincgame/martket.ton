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
   registry name `io.github.antsincgame/tonforge-agent`. It exposes 10 tools:
   `whoami`, `list_listings`, `create_listing`, `update_listing`,
   `set_distribution`, `verify_distribution`, `list_orders` (seller, need a token)
   and `search_products`, `get_product`, `list_offers` (public discovery).
2. **Plain HTTPS.** Call the REST endpoints directly (see below).

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
delivery). Buyers choose a listing.

## Seller actions (need a token + scope)

```
GET   /api/v1/agent/me                                  # token identity
GET   /api/v1/agent/listings                            # listings:read
POST  /api/v1/agent/listings                            # listings:write
PATCH /api/v1/agent/listings/{id}                       # listings:write
PUT   /api/v1/agent/listings/{id}/distribution          # distribution:write
POST  /api/v1/agent/listings/{id}/distribution/verify   # distribution:write
GET   /api/v1/agent/orders?limit=                       # orders:read
```

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
