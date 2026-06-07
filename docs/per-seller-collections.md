# Per-seller collections (Phase 1) — runbook

Each seller gets a distinct on-chain `AppCollection` whose **owner is the platform
`COLLECTION_OWNER` key**. Because the existing mint worker signs with that same
key, it can mint license NFTs into the seller's collection with **no contract
change** and no seller signature. The seller's own wallet is recorded
(`ownerWallet`) for forward compatibility with a future sovereign-collection
model (Phase 2), but the on-chain owner today is the platform.

Provisioning hands the seller a collection address; the seller attaches it to
their listings. On order creation the escrow is built around
`listing.collection_address` (falling back to the global platform collection for
legacy listings without one), so the **escrow, the license record and the mint
all target the same per-seller collection** — keep these three in lockstep.

**Canonical mint path (one minter):** minting is owned solely by
`tonforge/mintWorker` — it mints into `license.collectionAddress` (per-seller),
holds a cluster-wide lock, and runs the full mint → register → refund → payout
lifecycle. The former `commerce/mintWorker` was demoted to an **order-state
reconciler**: it no longer mints (a second minter targeted the *global*
collection — a double-mint race and, once orders route per-seller, an
escrow↔mint mismatch); it only reconciles order state (→ PAID / FULFILLED /
REFUNDED) from on-chain escrow/license truth.

## Components

| Piece | File |
| --- | --- |
| Address derivation + on-chain deploy | `backend/commerce/collectionProvisioner.ts` |
| Appwrite registry (`seller_collections`) | `backend/commerce/sellerCollectionRepository.ts` |
| Admin trigger | `backend/commerce/adminRoutes.ts` (`POST /admin/seller-collections/provision`) |
| Appwrite provisioning | `scripts/provision-commerce.mjs` (`setupSellerCollections`) |
| Canonical deploy this mirrors | `contracts/scripts/deployCollection.ts` |

The deterministic address is derived **exactly** like the canonical deploy
script (`AppCollection.fromInit(appId, owner, collectionContent, commonContent)`
with TEP-64 `0x01 + snake(uri)` content), so the address this service computes
equals what `deployCollection.ts` would produce. `appId` is a stable 256-bit
hash of `network:sellerWallet`.

## Safety / gating

Provisioning refuses (HTTP 503 `PROVISION_NOT_CONFIGURED`) unless
`COLLECTION_OWNER_MNEMONIC[_NETWORK]` and `COLLECTION_OWNER_ADDRESS[_NETWORK]` are
set — the same gating pattern as the mint worker. It never produces a half-state:
the registry row is `pending` until the contract is confirmed `active`, then
`deployed`; on error it is `failed` with `lastError`.

## Prerequisites (one-time)

1. Provision the Appwrite collection:
   ```bash
   npm run provision:commerce   # creates seller_collections + indexes
   ```
2. Build the Tact wrapper the backend loads at runtime:
   ```bash
   cd contracts && npm run build   # emits build/AppCollection_AppCollection.js
   ```
3. Configure the platform owner key + endpoint (testnet shown):
   ```bash
   export COLLECTION_OWNER_MNEMONIC_TESTNET="<24 words, funded on testnet>"
   export COLLECTION_OWNER_ADDRESS_TESTNET="<wallet address of that mnemonic>"
   export TON_API_KEY="<toncenter testnet key>"      # recommended
   export COLLECTION_METADATA_BASE="https://cdn.tonforge.org/collections"  # optional
   ```

## Testnet verification (end-to-end)

> Requires testnet network egress (`testnet.toncenter.com`) and a funded owner
> wallet — these are not available inside the sandboxed web session, so run this
> on an environment that has them.

1. Provision a collection for a test seller:
   ```bash
   curl -s -X POST "$API/api/v1/commerce/admin/seller-collections/provision" \
     -H "x-commerce-admin-secret: $COMMERCE_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"sellerWallet":"<seller EQ…>","network":"testnet"}' | jq
   # → { data: { collectionAddress, status: "deployed", alreadyDeployed, appId } }
   ```
2. Confirm the registry row and on-chain state:
   ```bash
   curl -s "$API/api/v1/commerce/admin/seller-collections/<seller>/testnet" \
     -H "x-commerce-admin-secret: $COMMERCE_ADMIN_SECRET" | jq
   # status == "deployed"; open collectionAddress in a testnet explorer → active
   ```
3. Create a listing for that seller using the returned `collectionAddress`
   (existing agent or commerce listing flow).
4. Buy it (fund the escrow from a testnet buyer wallet), then verify the mint
   worker minted the license NFT **into the seller's collection** (the NFT's
   collection == `collectionAddress`) and the order/license reaches
   `LICENSE_STATE=MINTED`.

Idempotency: calling provision again returns the same address with
`alreadyDeployed: true` (it also short-circuits if the contract is already active
on-chain).

## Multi-seller routing certification (the decisive test)

Single-seller passing is necessary but NOT sufficient — it can pass even if the
escrow uses the global collection (when global == the one provisioned collection).
This test proves the canonical routing: **each seller's purchase mints into THAT
seller's own collection.**

1. Provision a collection for **two distinct** sellers A and B (different wallets):
   `POST /admin/seller-collections/provision` for each → addresses `COL_A`, `COL_B`
   (must differ).
2. Create one listing per seller, each carrying its own `collection_address`
   (`COL_A` for A's listing, `COL_B` for B's). Do **not** rely on the global
   `COLLECTION_ADDRESS_*`; ideally set the global to a THIRD, decoy address so a
   regression to the global path is detectable.
3. Buy **both** listings from a testnet buyer wallet (fund each escrow).
4. After mint, assert per purchase:
   - the order's escrow was built around the listing's collection (the escrow
     address is deterministic from it),
   - the minted License NFT's `collection` == the seller's own address
     (`COL_A` for A, `COL_B` for B) — **not** the global decoy,
   - `licenses` rows carry the matching `collectionAddress`,
   - both orders reach `PAID` (reconciler) and downloads open.

Pass criterion: A's NFT ∈ `COL_A`, B's NFT ∈ `COL_B`, neither in the global decoy.
A regression (escrow/mint on the global collection) would put both NFTs in the
decoy and fail this test.

## What is unit-tested vs. testnet-verified

- **Unit-tested** (`collectionProvisioner.test.ts`): content-cell encoding,
  `appId` derivation (determinism, per-seller/per-network uniqueness, uint256
  range), metadata URI shape.
- **Testnet-verified** (this runbook): the Tact-artifact address derivation and
  the on-chain deploy — they need the build artifact, a funded owner key, and TON
  network access.
