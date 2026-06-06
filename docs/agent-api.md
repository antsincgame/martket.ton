# TonForge Agent API

The **Agent API** lets an AI agent — or any HTTP client — manage a seller's
marketplace listings, attach downloadable artifacts, and read orders, entirely
over HTTP with no browser session. It is the supported way to let "other AIs"
operate a storefront on TonForge.

- **Base URL:** `https://tonforge.org/api/v1/agent`
- **Machine-readable spec:** [`openapi/agent-api.yaml`](./openapi/agent-api.yaml)
- **Token management:** `https://tonforge.org/api/v1/commerce/agent-tokens`

> Looking for the fastest path? Jump to [Quickstart](#quickstart). Prefer to plug
> the API straight into an MCP-compatible assistant (Claude, Cursor, …)? See the
> [MCP server](../mcp-server/README.md).

---

## 1. Authentication

Every Agent API call authenticates with a **Personal Access Token (PAT)** issued
by a *verified* seller. A token looks like:

```
tfa_QmF6ZTY0dXJsLXJhbmRvbS0zMmJ5dGVz
```

Pass it on every request as **either**:

```http
Authorization: Bearer tfa_…
```

or, for clients that reserve the `Authorization` header:

```http
X-Agent-Token: tfa_…
```

The acting wallet is read **from the token**, never from the request body or a
header. An agent therefore can only ever act for the single seller that issued
its token — putting a different `sellerWallet` in a payload is ignored and
overridden.

### Issuing a token

Tokens are minted by the **human seller** (session-authenticated), normally from
the dashboard UI, or via the API:

```http
POST /api/v1/commerce/agent-tokens
Authorization: Bearer <SELLER_SESSION_JWT>
Content-Type: application/json

{
  "wallet": "EQC…",
  "name": "pricing-bot",
  "scopes": ["listings:read", "listings:write", "orders:read"],
  "ttlDays": 90
}
```

The response contains `data.token` — the **plaintext, shown exactly once**. Store
it immediately (e.g. in your agent's secret store); it can never be retrieved
again. Only `sha256(token)` is persisted server-side.

Pre-conditions enforced at issue time: the caller owns the wallet, the wallet is
not sanctioned, and the wallet holds **approved KYC**.

Manage tokens with `GET /agent-tokens` (list metadata) and
`DELETE /agent-tokens/{id}` (revoke immediately).

---

## 2. Scopes

A token carries a set of scopes. Some imply others:

| Scope                | Grants                                              | Implies         |
| -------------------- | --------------------------------------------------- | --------------- |
| `listings:read`      | Read your listings                                  | —               |
| `listings:write`     | Create / update your listings                       | `listings:read` |
| `orders:read`        | Read your orders                                    | —               |
| `distribution:write` | Set / verify the downloadable artifact on a listing | `listings:read` |

A request missing a required scope returns **`403 SCOPE_FORBIDDEN`**. Grant the
narrowest set your agent needs.

---

## 3. Hard gates (checked on every call)

Independent of scopes, every request re-screens the token's wallet:

| Condition           | Response                |
| ------------------- | ----------------------- |
| Wallet sanctioned   | `451 SANCTIONED`        |
| KYC not approved    | `403` (KYC code)        |

So a token issued before a sanctions designation — or for a wallet whose KYC was
later revoked — stops working **immediately**, with no need to revoke it.

---

## 4. Rate limiting

- **Per token:** 600 requests / 15 min (configurable via `AGENT_RATE_LIMIT`).
- Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
  `X-RateLimit-Reset` (Unix epoch seconds).
- Exceeding it → **`429 RATE_LIMITED`**. Back off until `X-RateLimit-Reset`.
- Repeated **auth failures** from one IP are separately throttled
  (`429 AUTH_RATE_LIMITED`) to deter token brute-forcing.

---

## 5. Response & error shapes

Success responses wrap their payload in a top-level `data`:

```json
{ "data": { "listing": { "id": "…", "title": "…" } } }
```

Errors come in two shapes:

```json
{ "error": "Not your listing", "code": "NOT_OWNER" }          // route-level
{ "success": false, "message": "…", "code": "RATE_LIMITED" }  // auth middleware
```

Always branch on `code`, not the human-readable message.

---

## 6. Endpoint reference

All paths are relative to `https://tonforge.org/api/v1/agent`.

| Method & path                          | Scope                | Purpose                                   |
| -------------------------------------- | -------------------- | ----------------------------------------- |
| `GET /me`                              | any                  | Identity (wallet, scopes, token prefix)   |
| `GET /instructions`                    | `instructions:read`  | Onboarding manual + personal checklist (pre-KYC ok) |
| `GET /status`                          | any                  | Onboarding progress + listing/order aggregates (pre-KYC ok) |
| `POST /products`                       | `products:write`     | Create a catalog product draft (→ moderation + scan) |
| `GET /listings`                        | `listings:read`      | List your listings (≤100)                 |
| `POST /listings`                       | `listings:write`     | Create a listing                          |
| `PATCH /listings/{id}`                 | `listings:write`     | Update a listing                          |
| `PUT /listings/{id}/distribution`      | `distribution:write` | Attach a distribution manifest (→ draft)  |
| `POST /listings/{id}/distribution/verify` | `distribution:write` | Resolve + hash artifact, compare sha256 |
| `GET /orders?limit=`                   | `orders:read`        | List orders, newest first (≤500)          |

### Notes per endpoint

- **`GET /instructions`** — the platform-authored, machine-readable operating
  manual: an honest service description, prerequisites (wallet, KYC, BYOS
  storage / GitHub), the seller lifecycle, the KYC requirement (a real verified
  human owner — circumventing KYC is prohibited), and the conduct policy
  (legitimate confidentiality is fine; concealing material facts or misleading
  buyers is not). Returns `{ sections, onboarding }`. Readable before KYC.
- **`GET /status`** — counts only (no buyer PII): your `onboarding` checklist
  (`kyc`, `storage`, `catalog`, `distribution`, `readyToSell`, `nextStep`) plus
  listing/order/distribution aggregates. Poll this to drive onboarding.
- **`POST /products`** — creates a catalog product as a `draft`. It enters the
  same moderation + antivirus pipeline as a human-created product and stays
  unpublished until a moderator approves it. The creator is the catalog profile
  linked to the token's wallet; `409 NO_CREATOR_PROFILE` if none is linked.
  Body: `name` (required), `description`, `short_description`, `price_usd`,
  `category`, `image`, `version`.
- **`POST /listings`** — `priceUsd` is converted to TON at the current oracle
  rate at creation time. `deliveryPayload` (the buyer-facing secret) is stored
  separately and **never** returned by read endpoints. `collectionAddress` is
  mandatory: every purchase mints a license NFT into it, and downloads are gated
  on that mint. `sellerWallet` must be present to pass validation but is
  overridden with the token's wallet.
- **`PATCH /listings/{id}`** — send any subset of fields. Activating a listing
  (`status: "active"`) requires a non-empty `collectionAddress`, existing or
  supplied in the same call.
- **Distribution** — `PUT …/distribution` sets the manifest and moves the
  listing to `draft`; follow with `POST …/distribution/verify` to confirm the
  artifact resolves and its sha256 matches (→ `verified`, else `manifest_drift`).
  See [`byos-distribution.md`](./byos-distribution.md) for manifest fields.

For exact request/response schemas, status codes, and examples, use the
[OpenAPI spec](./openapi/agent-api.yaml) — render it in any Swagger/Redoc viewer.

---

## 7. Quickstart

```bash
export TONFORGE_AGENT_TOKEN="tfa_…"
export TONFORGE_API="https://tonforge.org/api/v1/agent"

# Who am I?
curl -s "$TONFORGE_API/me" \
  -H "Authorization: Bearer $TONFORGE_AGENT_TOKEN" | jq

# List my listings
curl -s "$TONFORGE_API/listings" \
  -H "Authorization: Bearer $TONFORGE_AGENT_TOKEN" | jq '.data.listings'

# Create a listing
curl -s -X POST "$TONFORGE_API/listings" \
  -H "Authorization: Bearer $TONFORGE_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sellerWallet": "EQC…",
    "catalogProductId": "prod_123",
    "title": "My digital good",
    "description": "Created by my agent",
    "priceUsd": 9.99,
    "deliveryType": "file",
    "deliveryPayload": "https://example.com/secret-download",
    "collectionAddress": "EQC…collection"
  }' | jq '.data.listing'
```

Runnable clients in TypeScript and Python live in
[`agent-api-examples/`](./agent-api-examples/).

---

## 8. Security model in one paragraph

A seller proves wallet ownership + KYC, then mints a scoped, expiring PAT whose
plaintext is shown once and stored only as a hash. Agents present that token;
the server derives the acting wallet from it (never from the request), enforces
scopes, re-screens sanctions and KYC on every call, rate-limits per token, and
writes an audit row for every mutation. Revocation and expiry are immediate.
