# TonForge for buyer / shopping agents

This guide is for AI agents that **shop** on TonForge — discovering products and
helping a user buy them — as opposed to the seller-side [Agent API](./agent-api.md).

The short version:

- **Discovery is fully public** — browse and search the catalog with no auth.
- **Purchase is non-custodial** — the escrow is paid only by the buying wallet's
  own signature. No API (and no agent) can move a **user's** funds.
- Two purchase patterns: **assist a human** (discover → prepare → hand the
  transaction to the user's wallet to sign), or **buy autonomously with the
  agent's OWN wallet** (§3 — a buyer token + e.g. a TON Agentic Wallet).

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

### Why a token can't spend a USER's funds

TonForge is non-custodial: funds move only when the buying wallet signs.
Combined with per-buyer KYC/AML gates, this means "buy this with the USER's
money" cannot be delegated to a bearer token without surrendering the user's
private key — which the platform never holds. When assisting a human buyer,
the agent's role is:

> **discover** offers → **prepare** the order (get the escrow transaction) →
> **hand it to the user's wallet to sign** → optionally **confirm** and
> **collect** delivery.

An agent that holds **its own** wallet is a different story — see §3.

### The realistic agent pattern

- A shopping agent uses the public discovery tools to pick a listing and explain
  the price/fee breakdown to the user.
- It then drives the existing session-authenticated `POST /orders` to obtain the
  escrow transaction, and surfaces it to the user's TON wallet (TonConnect) to
  sign — e.g. as a deep link or a wallet prompt.
- After the user signs, the agent can call `POST /orders/:id/confirm` and poll
  `GET /orders/:id` for delivery.

---

## 3. Autonomous buying — the agent pays with its OWN wallet

Built and live in the API: `/api/v1/agent/buyer/*`, scope `orders:buy`. The
agent owns a TON wallet — typically a [TON Agentic Wallet](https://agents.ton.org/)
(the agent holds the operator key; its human keeps the owner key, can withdraw
at any time, and funds it on a "fund what you risk" basis).

**Human accountability gate (once).** The owner — session-authenticated, with
a ton_proof-bound wallet and Lite KYC — issues a buyer token:

```
POST /api/v1/commerce/buyer-agent-tokens
{ "agentWallet": "…", "name": "shopping-agent", "ttlDays": 90 }
```

Issuance verifies **on-chain** (TEP-85 `get_nft_data`) that the agent wallet's
owner is the caller's verified wallet, so nobody can bind a stranger's wallet
and download its purchases. The returned `tfa_…` token carries `orders:buy`
plus read-only `instructions:read` (manual / status / assistant) and is bound
to the wallet the agent pays from.

**The purchase loop (agent, autonomous).** All under
`https://tonforge.org/api/v1/agent`, `Authorization: Bearer <buyer token>`:

1. `POST /buyer/orders` `{ listingId }` — same sanctions/AML screening and the
   same money path as the human flow. The response's `payment` object is
   machine-actionable: send EXACTLY `amountNanoton` from `payFromWallet` to
   `payToAddress` with **both** `stateInitBase64` and `payloadBase64` attached
   (a plain comment transfer leaves the escrow undeployed).
2. **Pay from the agent wallet** — e.g. via `npx @ton/mcp` running beside this
   API's MCP server. The platform never sees the key.
3. `POST /buyer/orders/:id/confirm` — verifies the payment AND the escrow's
   on-chain `FUNDED` state, then queues the license NFT mint. Idempotent.
4. `GET /buyer/orders/:id` — poll `pending_payment → paid → fulfilled`.
5. `GET /buyer/listings/:id/download` — short-lived signed URL + expected
   sha256, gated on the minted license and a clean antivirus verdict (≤20/day).

Via the [MCP server](./mcp.md) these are the `create_order`, `confirm_order`,
`get_order`, and `download_purchase` tools (env `TONFORGE_BUYER_TOKEN`).
