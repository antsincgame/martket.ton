# TonForge for buyer / shopping agents

This guide is for AI agents that **shop** on TonForge — discovering products and
helping a user buy them — as opposed to the seller-side [Agent API](./agent-api.md).

The short version:

- **Discovery is fully public** — browse and search the catalog with no auth.
- **Purchase is non-custodial** — the buyer's own TON wallet signs the payment.
  No API (and no agent) can move a user's funds. The supported pattern is
  **discover → prepare → hand the transaction to the wallet to sign**.

---

## 1. Discovery (public, no auth)

All endpoints are `GET`, need no token, and back the storefront itself. Base
origin: `https://tonforge.org`.

| Endpoint                                              | Returns                                           |
| ----------------------------------------------------- | ------------------------------------------------- |
| `GET /api/products`                                   | All published products.                           |
| `GET /api/products/search?q=<kw>&limit=<n>`           | Published products matching a keyword (q ≥ 2).    |
| `GET /api/products/:id`                                | A single published product.                       |
| `GET /api/v1/commerce/listings/catalog/:catalogProductId` | Active **listings** (sellers' offers) for a product, with `primary`. |
| `GET /api/v1/commerce/sellers/:wallet/listings`       | A given seller's listings.                         |

> Envelopes differ slightly: the products API returns `{ success, data }`, the
> commerce API returns `{ data }`. Both expose the payload under `data`.

A product is the *catalog item*; a **listing** is a specific seller's offer of
that product (its price, delivery, distribution). A buyer chooses a listing.

```bash
# Find products, then the offers for one of them
curl -s "https://tonforge.org/api/products/search?q=wallpaper&limit=10" | jq '.data'
curl -s "https://tonforge.org/api/v1/commerce/listings/catalog/prod_123" | jq '.data.primary'
```

Via the [MCP server](../mcp-server/README.md), these are the `search_products`,
`get_product`, and `list_offers` tools — usable even without a seller token.

---

## 2. The purchase flow (and the signing boundary)

Buying is a **session-authenticated, wallet-signed** flow. Endpoints live under
`https://tonforge.org/api/v1/commerce` and require the buyer's user-session JWT
(obtained by proving wallet ownership via TonConnect), **not** an agent token.

1. **Create the order** — `POST /orders` with `{ listingId, buyerWallet }`.
   The server screens the buyer (sanctions → 451, KYC-lite → 403, AML → 451),
   computes price + platform fee, and returns payment instructions — including,
   for the escrow (v4) flow, an **`escrow` object with `stateInit` and `payload`**
   to fund the on-chain escrow contract.
2. **Sign & pay** — the **buyer's wallet** signs and sends the TON transaction
   described by that escrow object (or pays the treasury by `memo` in the legacy
   flow). This is the step no token can perform on the buyer's behalf.
3. **Confirm** — `POST /orders/:id/confirm` with `{ txHash, buyerWallet }`. The
   server verifies the on-chain payment.
4. **Fulfilment** — a mint worker mints the license NFT, sets the order to
   `PAID`, and creates the entitlement.
5. **Collect delivery** — `GET /orders/:id` returns the `deliveryPayload` once
   the order is `PAID`/`FULFILLED`. Buyers can list their orders with
   `GET /buyers/me/orders`.

### Why purchase isn't an agent token tool

TonForge is non-custodial: funds move only when the buyer's wallet signs.
Combined with per-buyer KYC/AML gates, this means a fully autonomous "buy this
for me" cannot be delegated to a bearer token without surrendering the buyer's
private key — which the platform never holds. So the agent's role is:

> **discover** offers → **prepare** the order (get the escrow transaction) →
> **hand it to the user's wallet to sign** → optionally **confirm** and
> **collect** delivery.

### The realistic agent pattern

- A shopping agent uses the public discovery tools to pick a listing and explain
  the price/fee breakdown to the user.
- It then drives the existing session-authenticated `POST /orders` to obtain the
  escrow transaction, and surfaces it to the user's TON wallet (TonConnect) to
  sign — e.g. as a deep link or a wallet prompt.
- After the user signs, the agent can call `POST /orders/:id/confirm` and poll
  `GET /orders/:id` for delivery.

---

## 3. Want agents to *initiate* orders too?

A safe extension exists if you want agents to prepare purchases on a buyer's
behalf without ever touching funds: a **buyer-scoped token** (e.g. an
`orders:create` scope) backing a `POST /api/v1/agent/orders` endpoint that runs
the same sanctions/KYC/AML checks and returns the **unsigned** escrow
transaction for the buyer's wallet to sign. It moves no money — it only prepares
the order — but it's an architectural/product decision, so it isn't built here.
Open an issue or ask if you'd like it implemented.
