# Refund-cycle testnet certification runbook (Gate C — Blocker #1)

> **Audience:** the operator with **live TON testnet access** (the "Terra
> cogitator" / Cursor) who can fund wallets and broadcast transactions —
> something the sandbox CI cannot do. This runbook certifies the
> **buyer-claim refund** path end-to-end on testnet.
>
> **Why this exists:** PR #95 replaced the dead `oracleRefund()` (which the
> escrow contract never supported) with the contract-correct **buyer-initiated**
> `RefundIfNotMinted`. The unit/decision layer and the contract sandbox tests
> are green in CI; what remains is a live broadcast to prove the full loop. This
> is the last code-side step before Gate C mainnet activation.

> Related: [`commerce-license-smoke-checklist.md`](./commerce-license-smoke-checklist.md)
> (happy-path + ops §6), [`license-nft-runbook.md`](./license-nft-runbook.md),
> [`per-seller-collections.md`](./per-seller-collections.md).

---

## 0. What we are proving

The canonical refund state machine (no contract change; the escrow's
`RefundIfNotMinted` is **buyer-only** by design — `sender()==self.buyer`):

```
mint_pending --(mint fails MAX_ATTEMPTS)--> mint_failed
mint_failed  --(worker, after REFUND_AFTER_MS)--> refund_claimable
refund_claimable --(buyer GET tx, signs RefundIfNotMinted, POST confirm)--> refund_pending
refund_pending --(escrow self-destructs; settle cycle)--> refunded  +  order REFUNDED
```

On-chain guard (the final authority, `contracts/src/escrow.tact:167`):
`state==FUNDED` && `sender()==buyer` && `licenseAddress==zero` &&
`now() > paidAt + 600s` (`MINT_GRACE_SEC`).

**PASS** = a real testnet purchase whose mint is forced to fail ends with:
the buyer's wallet refunded on-chain, the escrow contract destroyed, the
license `refunded`, and the order `refunded`.

---

## 1. Environment

| Layer | Requirement |
|---|---|
| TON | testnet; `TON_NETWORK=testnet`; oracle wallet ≥10 TON; treasury set |
| Appwrite | DB `marketplace`, schema applied (`node scripts/provision-commerce.mjs`) |
| Backend | `node backend/dist/server.js`; mintWorker enabled (`loadOnchainConfig.enabled=true`) |
| Frontend | `npm run dev`; TonConnect manifest on testnet |
| Wallets | Tonkeeper testnet for **buyer**; a provisioned seller with a deployed per-seller collection |

### 1.1 Speed up the test (env-only — no rebuild)

The dwell before a failed mint becomes claimable, and the grace before the
contract accepts the refund, are tunable via **env** (the worker reads them at
boot — no code edit, unlike the old hard-coded constant):

```bash
# backend/.env.staging  (TEST ONLY — restore before mainnet, see §6)
MINT_REFUND_AFTER_MS=60000      # mint_failed → refund_claimable after 60s (prod: 1h)
MINT_REFUND_REVERT_MS=120000    # refund_pending → claimable revert if claim never lands
MINT_TICK_MS=15000              # faster worker cycles for the test
```

The **on-chain** grace (`MINT_GRACE_SEC = 600s`) lives in the Tact contract and
**cannot** be lowered without a redeploy — so budget ~10 minutes of real wait
between payment and a valid claim. Plan the run around it.

---

## 2. Setup: a listing whose mint will fail

1. Provision a seller + a **deployed per-seller collection** (admin):
   `POST /admin/seller-collections/provision { sellerWallet, network:"testnet" }`.
2. Create an ACTIVE listing carrying that `collectionAddress`.
3. **Arm the failure.** Pick ONE deterministic way to make the mint fail
   *after* the escrow is funded (so a License is created, then minting fails):
   - **Easiest:** after the buyer pays (escrow funded, license `mint_pending`),
     stop the oracle from minting — temporarily blank `ORACLE_MNEMONIC` (or point
     it at a wallet with 0 TON) and restart the backend. The mint worker retries
     `MINT_MAX_ATTEMPTS` (3) then flips the license to `mint_failed`.
   - **Alternative:** set the listing's `collection_address` to a **non-deployed**
     address before purchase — `processOne` marks `mint_failed` with
     `NO_COLLECTION_ADDRESS` / a deploy error.

> Do **not** simply leave `collection_address` empty — order-create now refuses
> that with `400 LISTING_NO_COLLECTION` (PR #94), so no order/escrow is formed
> and there is nothing to refund. (That refusal is itself a check — see §5.)

---

## 3. The refund loop (the core certification)

### 3.1 Buy, then force the failure
1. Buyer connects Tonkeeper (testnet), buys the listing, signs the escrow
   payment. Confirm the escrow is **FUNDED** on-chain and the license is
   `mint_pending`.
2. With the failure armed (§2.3), watch the worker:
   ```
   [mintWorker] mint failed license=lic_… attempt=3: <reason>
   ```
   License → `mint_failed`.

### 3.2 Worker marks it claimable
After `MINT_REFUND_AFTER_MS`:
```
[mintWorker.refund] marking 1 license(s) refund_claimable
[mintWorker.refund] license lic_… → refund_claimable (buyer can reclaim escrow EQ…)
```
- [ ] `GET /api/v1/commerce/licenses/<id>` → `state:"refund_claimable"`,
      `refundClaimable:true`, `refundAvailableAt` is set, `nftAddress:null`.

### 3.3 Buyer claims (the on-chain broadcast — needs testnet)
1. In **My Licenses**, the license shows the **«Вернуть средства» (Claim refund)**
   button (only once `refundClaimable` is true). OR drive it by API:
   ```bash
   BASE=$VERIFY_API_URL/api/v1/commerce
   # 1) fetch the signable message
   curl -s "$BASE/orders/<orderId>/refund-claim" -H "Authorization: Bearer <buyerJWT>" | jq
   #    → { claimable:true, message:{ address:<escrow>, amount:"50000000", payload:<base64 RefundIfNotMinted> }, ... }
   ```
2. Buyer signs a TonConnect tx to `message.address` with `amount` (0.05 TON gas)
   and `message.payload`. (The UI button does this automatically.)
3. Record the claim:
   ```bash
   curl -s -X POST "$BASE/orders/<orderId>/refund-claim" \
     -H "Authorization: Bearer <buyerJWT>" -H 'content-type: application/json' \
     -d '{"buyerWallet":"<BUYER>","txHash":"<signedTxHash>"}' | jq
   #    → { ok:true, state:"refund_pending" }
   ```
   - [ ] License → `refund_pending`.

### 3.4 Settle
The escrow processes `RefundIfNotMinted`: `state=REFUNDED`, returns its balance
to the buyer, self-destructs (`SendRemainingBalance | SendDestroyIfZero`). The
settle cycle then:
```
[mintWorker.refund] license lic_… fully refunded on-chain
[finalizeOrderRefund] order ord_… → refunded
```
- [ ] License → `refunded`, `refundedAt` set.
- [ ] **Order → `refunded`** (this is the piece the order-reconciler cannot do
      alone — the escrow is gone, so `getEscrowState` reads null).
- [ ] On-chain: escrow address **inactive/destroyed**; buyer balance up by
      ~escrow amount minus gas.

> **Why the order moves even though the reconciler is blind:** the settle cycle
> confirms destruction via `checkEscrowAlive` and calls `finalizeOrderRefund`
> directly. Verify both transitions — a green refund with a stuck
> `pending_payment` order would be a regression.

---

## 4. Recovery path (abandoned claim)

Prove the self-heal: a recorded claim that never actually lands must not strand
the license in `refund_pending`.

1. From a `refund_claimable` license, POST `/refund-claim` with a **bogus**
   `txHash` (do not actually sign/broadcast). License → `refund_pending`.
2. Wait `MINT_REFUND_REVERT_MS` with the escrow still FUNDED.
3. Expect:
   ```
   [mintWorker.refund] license lic_… claim did not land … → reverted to refund_claimable
   ```
   - [ ] License back to `refund_claimable`; the buyer can retry the real claim.

---

## 5. Negative / security matrix

| Scenario | Expected |
|---|---|
| `GET /orders/<id>/refund-claim` by a non-owner wallet | `403 FORBIDDEN` |
| `POST /refund-claim` before grace (`now < paidAt+600s`) | `409 GRACE_NOT_ELAPSED` (+ `availableAt`) |
| `POST /refund-claim` on a **minted** license (NFT exists) | `409 ALREADY_MINTED` (use BuyerBurn) |
| `POST /refund-claim` twice (already `refund_pending`/`refunded`) | `409 ALREADY_REFUNDED` |
| Order-create on a listing with **no** `collection_address` | `400 LISTING_NO_COLLECTION` (PR #94) |
| `RefundIfNotMinted` from a **non-buyer** wallet | contract rejects |
| `RefundIfNotMinted` **before** the 600s grace | contract rejects |
| `RefundIfNotMinted` after a license is registered | contract rejects (`licenseAddress != 0`) |
| Download (`/listings/:id/download`) while `refund_claimable`/`refund_pending`/`refunded` | `403` (download gated on `minted` + `nftAddress`) |

The contract rows are already automated in `contracts/tests/escrow.spec.ts`
(`RefundIfNotMinted` success / before-grace / non-buyer / not-funded) — run
`cd contracts && npm test`. The API rows above are the **live** ones to capture.

---

## 6. Also verify the other two Gate C fixes (PR #94)

While on testnet:
- **Escrow address form** — the escrow `address` returned by `POST /orders`
  is the correct network form (testnet `kQ…/0Q…`). On a future mainnet env it
  must be `EQ…/UQ…`, not testnet-flagged. (`renderEscrowAddress`.)
- **Global-fallback removed** — confirm the `400 LISTING_NO_COLLECTION` row in §5.

---

## 7. Capture & restore

**Capture for the certification record** (append to
`docs/e2e-test-and-commit-report.md`): escrow address + explorer link, the
buyer refund tx, the four state transitions (`mint_failed → refund_claimable →
refund_pending → refunded`), the order `refunded`, and the buyer balance delta.

**Restore before mainnet (critical):**
- [ ] `MINT_REFUND_AFTER_MS` → `3600000` (1h); remove `MINT_REFUND_REVERT_MS` /
      `MINT_TICK_MS` test overrides.
- [ ] Restore `ORACLE_MNEMONIC` / the real `collection_address`.
- [ ] Restart backend; confirm `[mintWorker] started …` with prod tunables.
- [ ] Tick the remaining `commerce-license-smoke-checklist.md §6` items
      (treasury→multisig, oracle ≥50 TON, alerts on `mint_failed` rate and
      stale `refund_pending`).

---

## Appendix — quick API probes

```bash
BASE=$VERIFY_API_URL/api/v1/commerce
# claimability for an order (buyer JWT)
curl -s "$BASE/orders/<orderId>/refund-claim" -H "Authorization: Bearer <buyerJWT>" | jq
# the buyer's library (states + refundClaimable flags)
curl -s "$BASE/buyers/me/licenses" -H "Authorization: Bearer <buyerJWT>" | jq '.data.licenses[] | {id,state,refundClaimable,refundAvailableAt}'
```

There is intentionally **no** admin "force refund" endpoint: a pre-mint refund
is the buyer's on-chain action and cannot be initiated by the platform (the
contract forbids it). For a registered (minted) license, the buyer's remedy is
BuyerBurn within the trial window.
