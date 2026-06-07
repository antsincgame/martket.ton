# E2E Test & Commit Report — Commerce × License NFT (Phase 1)

**Ветка:** `claude/funny-dijkstra-KIPtO` (PR #90)  
**Дата отчёта:** 2026-06-08  
**Окружение:** staging Appwrite + TON testnet, backend `:8081`

---

## Краткий итог

| Область | Статус |
|---------|--------|
| Unit/integration (`vitest run backend`) | **326/326 PASS** |
| TypeScript (`tsc --noEmit`) | **PASS** |
| Live E2E single-seller (mint + order `paid`) | **PASS** |
| Live E2E multi-seller (per-seller collections) | **PASS** ✅ |
| Agent API smoke (Phase 0) | **PASS** |

---

## Коммиты на ветке (live-verify + reconciler)

### Уже в origin

| SHA | Сообщение | Суть |
|-----|-----------|------|
| `ebfbfac` | `fix(commerce): agent listing schema and legacy Appwrite field omit` | Agent listing без `sellerWallet` в body; `omitListingFields()` + `LEGACY_LISTINGS_OMIT_FIELDS` |
| `42c19b5` | `fix(commerce): TON price fallback and collection address alias` | `TON_USD_FALLBACK`; alias `collection_address` ↔ `collectionAddress` |
| `5c8166f` | `fix(onchain): shared @ton/core coercion and Tact item address` | `tonBuildCoerce.ts`; async `LicenseItem.init()` — BitBuilder overflow |
| `deba946` | `fix(server): start TonForge mint worker on boot` | `startTonforgeMintWorkerIfConfigured()` в `server.ts` |
| `ab26abe` | `docs(deploy): document staging smoke env vars` | Staging env в `deploy/coolify.env.example` |
| `88bd95b` | `feat(scripts): live E2E smoke and testnet debug helpers` | `live-smoke-e2e.mjs`, `fund-buyer.mjs`, debug helpers |
| `d32b217` | `docs: live verify report for PR #90 staging run` | Первичный отчёт `docs/live-verify-report.md` |

### Новые (этот прогон)

| SHA | Сообщение | Суть |
|-----|-----------|------|
| `86b7f8d` | `fix(commerce): reconcile order PAID after tonforge mint` | `reconcileOrderAfterMint.ts`; вызов из `tonforge/mintWorker`; `omitOrderFields` / `omitEntitlementFields` |
| `5e14a18` | `fix(commerce): optional E2E_LOW_GAS escrow buffer for smoke runs` | Уменьшенный gas buffer при `E2E_LOW_GAS=1` (не для prod-like прогонов) |
| `785cc1c` | `feat(scripts): live-smoke-e2e-suite single and multi seller flows` | `live-smoke-e2e-suite.mjs` — режимы `single` \| `multi` \| `all` |
| `ca8eadf` | `docs: E2E test and commit report for PR #90` | Этот документ |

**База Phase 1:** `454e140` — `feat(commerce): per-seller collections — provisioning foundation`

---

## Quality gates

```bash
cd backend && npx tsc --noEmit          # PASS (после удаления unused listingOmitFields)
npx vitest run backend                 # 326 tests, 31 files — PASS
```

ESLint на изменённых файлах — без новых ошибок.

---

## Live E2E — single-seller ✅

**Скрипт:** `node --import tsx backend/scripts/live-smoke-e2e-suite.mjs single`  
**Альтернатива:** `backend/scripts/live-smoke-e2e.mjs`

### Успешный прогон (с reconciler)

| Поле | Значение |
|------|----------|
| orderId | `6a25ee2c00111c66ca8a` |
| license.state | `minted` |
| order.state | **`paid`** |
| nftAddress | `EQD4madHlLEtfev2fZT_s5uVnj9ewe4EKqmiAI7rjnLSytba` |
| collectionAddress | `kQA9mT1B8zY1WnOEbVUrQOL5P9F5pR4wpyhUqT40wAUm1D4-` |
| onChain.collectionMatch | **true** |
| buyer | `0QCcZCSkjRaVKwj90kHQ0YLGnu7MxNDDL3Go3OrFudDsI_9Y` |
| seller (agent token) | `EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t` |

### Ранний прогон (mint OK, order ещё не `paid`)

| Поле | Значение |
|------|----------|
| orderId | `6a25d477000af4c3e885` |
| nftAddress | `EQAjKFSmQeDWBChuG8huGX3JyeMyf85qZgn64AOQeK0msPHU` |
| order.state | оставался `pending` до фикса reconciler |

**Поток:**

```
confirm → ensureLicenseForOrder → tonforge/mintWorker
       → mintLicense → registerLicense → license.state=minted
       → reconcileOrderAfterMint → order.state=paid + entitlement
```

---

## Live E2E — multi-seller ✅

**Скрипт:** `node --import tsx backend/scripts/live-smoke-e2e-suite.mjs multi`  
**Прогон:** 2026-06-08, ~316s, exit 0 (после пополнения owner +2 TON)

### Seller A

| Поле | Значение |
|------|----------|
| wallet | `EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t` |
| collectionAddress | `kQA9mT1B8zY1WnOEbVUrQOL5P9F5pR4wpyhUqT40wAUm1D4-` |
| orderId | `6a25fab7001a265c3be7` |
| nftAddress | `EQBw7Amev9ZT_3toYiKdhhhEDVQoLdQSzBg4KP8Q0DSLPj1r` |
| order.state | **`paid`** |
| onChain.nftCollection | `0QA9mT1B8zY1WnOEbVUrQOL5P9F5pR4wpyhUqT40wAUm1GP7` |
| collectionMatch | **true** |

### Seller B

| Поле | Значение |
|------|----------|
| wallet | `0QAopJN6cf2GG0C1B3eSnGzx9fFLpbDymjtSjiYpcrUVHmKd` |
| collectionAddress | `kQBjCBYles9RekxunFWFUcIif3F2OWXFK09T7X8D_NZMJsli` |
| orderId | `6a25fb4900178e569076` |
| nftAddress | `EQBFESPSTkqFgCYM6hANSaM4czxYTmrbQmwJgz1TfasL6xgT` |
| order.state | **`paid`** |
| onChain.nftCollection | `0QBjCBYles9RekxunFWFUcIif3F2OWXFK09T7X8D_NZMJpSn` |
| collectionMatch | **true** |

**Phase 1 proof:** NFT seller A и seller B лежат в **разных** on-chain коллекциях (`collectionMatch: true` для обоих, адреса коллекций различаются).

### Ранний блокер (исправлен)

| Симптом | Причина | Фикс |
|---------|---------|------|
| `NO_CREATOR_PROFILE` на seller B | `issueAgentTokenForWallet` создавал только `seller_profiles`, без catalog `profiles` | `ensureSellerAgentReady()` — seller + catalog profile как в `issue-agent-token.mjs` |
| Owner balance too low | ~0.19 TON на oracle | Faucet +2 TON на `0QDLSgMKoLoiRedbweIoescZpf2xUp3op4mw527zVWOoFiBR` |

---

## Неудачные прогоны и исправления

| # | Симптом | Корень (5 почему, сжато) | Фикс |
|---|---------|--------------------------|------|
| 1 | `ESCROW_PAYMENT_NOT_FOUND` | Buyer underfunded vs price+gas | `fundBuyerForOrders` в suite; ~0.35 TON/order |
| 2 | Mint timeout 5 min | Backlog pending licenses | Poll timeout → 10 min |
| 3 | `pollOrderPaid` never resolves | Читал `data.state` вместо `data.order.state` | Исправлен парсинг ответа API |
| 4 | Appwrite 400 `licenseAddress` unknown | Staging schema без поля на orders/entitlements | `LEGACY_ORDERS_OMIT_FIELDS` / `LEGACY_ENTITLEMENTS_OMIT_FIELDS` |
| 5 | Mint failed (insufficient gas) | `E2E_LOW_GAS=1` урезал on-chain gas | Убрать для prod-like; опция только для dev smoke |
| 6 | Order stuck после mint | TonForge worker не переводил order в PAID | `reconcileOrderAfterMint` после `registerLicense` |
| 7 | `NO_CREATOR_PROFILE` (seller B) | Suite не создавал catalog profile в `profiles` | `ensureSellerAgentReady()` в suite |

---

## Переменные окружения (staging smoke)

```env
# Appwrite legacy schema
LEGACY_LISTINGS_OMIT_FIELDS=priceUsd
LEGACY_ORDERS_OMIT_FIELDS=licenseAddress
LEGACY_ENTITLEMENTS_OMIT_FIELDS=licenseAddress

# TON / mint
TON_NETWORK=testnet
COLLECTION_ADDRESS_TESTNET=kQA9mT1B8zY1WnOEbVUrQOL5P9F5pR4wpyhUqT40wAUm1D4-
TON_USD_FALLBACK=5.5

# Optional — только dev smoke, не prod-like E2E
# E2E_LOW_GAS=1
```

Полный список: `deploy/coolify.env.example`, `docs/live-verify-report.md`.

---

## Команды для повторного прогона

```bash
# 1. Backend
cd backend && npm start   # :8081

# 2. Quality gates
cd backend && npx tsc --noEmit
npx vitest run backend

# 3. Single-seller E2E
node --import tsx backend/scripts/live-smoke-e2e-suite.mjs single

# 4. Multi-seller (после пополнения owner)
node --import tsx backend/scripts/live-smoke-e2e-suite.mjs multi

# 5. Оба сценария
node --import tsx backend/scripts/live-smoke-e2e-suite.mjs all
```

**Faucet testnet:** [@testgiver_ton_bot](https://t.me/testgiver_ton_bot) → owner `0QDLSgMKoLoiRedbweIoescZpf2xUp3op4mw527zVWOoFiBR`

---

## Карта влияния (reconciler)

```
tonforge/mintWorker.ts
       │
       ├──► mintLicense / registerLicense
       │
       └──► reconcileOrderAfterMint.ts
                 ├──► COL_ORDERS (state=PAID)
                 ├──► COL_ENTITLEMENTS (deliveryPayload)
                 ├──► audit + ledger mint_license
                 └──► helpers.omitOrderFields / omitEntitlementFields
```

---

## Связанные документы

- [`docs/live-verify-report.md`](./live-verify-report.md) — первичный staging run
- [`docs/commerce-license-smoke-checklist.md`](./commerce-license-smoke-checklist.md) — чек-лист smoke/E2E
- [`docs/per-seller-collections.md`](./per-seller-collections.md) — Phase 1 per-seller collections

---

## Следующие шаги

1. ~~Пополнить owner wallet и прогнать `multi`~~ — **DONE** ✅
2. ~~Обновить отчёт двумя `collectionAddress`~~ — **DONE** ✅
3. *(опционально)* unit-тест для `ensureSellerAgentReady` / multi-seller provisioning edge cases

---

*Отчёт сгенерирован в рамках live-verify PR #90 / Phase 1 per-seller collections.*
