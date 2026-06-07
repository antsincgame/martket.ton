# Live Verify Report — staging Appwrite + TON testnet

**Ветка:** `claude/funny-dijkstra-KIPtO` (PR #90)  
**Дата:** 2026-06-07  
**Статус:** E2E mint **PASSED** ✅

---

## Результат E2E

Последний успешный прогон: `backend/scripts/live-smoke-e2e.mjs` (~121s, exit 0).

| Поле | Значение |
|------|----------|
| orderId | `6a25d477000af4c3e885` |
| licenseId | `6a25d49f00141953f77d` |
| license.state | `minted` |
| nftAddress | `EQAjKFSmQeDWBChuG8huGX3JyeMyf85qZgn64AOQeK0msPHU` |
| collectionAddress | `kQA9mT1B8zY1WnOEbVUrQOL5P9F5pR4wpyhUqT40wAUm1D4-` |
| escrowAddress | `0QB29Gkp-BOr6cq8lVzIpFdCQQjUWyT8I1KcD02QTUEKEFt_` |
| buyer | `0QCcZCSkjRaVKwj90kHQ0YLGnu7MxNDDL3Go3OrFudDsI_9Y` |
| seller | `EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t` |

**Фаза 0 (Agent API):** smoke пройден — listing create/read через agent token.  
**Фаза 1 (Per-seller collection):** коллекция задеплоена, запись в `seller_collections`, `COLLECTION_ADDRESS_TESTNET` в env.

---

## Исправленные блокеры

| # | Симптом | Корень | Фикс |
|---|---------|--------|------|
| 1 | TON API 401 | Новый/невалидный `TON_API_KEY` | Ключ в `backend/.env` (ротация рекомендуется — был в чате) |
| 2 | fund-buyer fail | Owner ~1.99 TON, скрипт слал 2 TON | `fund-buyer.mjs` → 1.5 TON |
| 3 | Agent listing 400 | `createListingSchema` требовал `sellerWallet` в body | `agentCreateListingSchema` (omit sellerWallet) |
| 4 | Listing 500 oracle | Price providers недоступны | `TON_USD_FALLBACK` + fallback в `tonPriceOracle.ts` |
| 5 | Listing 500 Appwrite | Staging без атрибута `priceUsd` | `LEGACY_LISTINGS_OMIT_FIELDS=priceUsd` + `omitListingFields()` |
| 6 | Order 403 NO_WALLET | Buyer profile не привязан к JWT | `ensureBuyerProfile()` upsert по `appwrite_user_id` + KYC |
| 7 | escrow: null | Две копии `@ton/core` | `tonBuildCoerce.ts` — re-parse Address/Cell |
| 8 | Mint BitBuilder overflow | Flat `buildItemDataCell` | Async `LicenseItem.init()` в `computeItemAddress()` |
| 9 | Mint не ретраится после рестарта | `tonforge/mintWorker` не стартовал в `server.ts` | `startTonforgeMintWorkerIfConfigured()` при boot |

---

## Архитектура mint-пути

```
confirm → ensureLicenseForOrder → tonforge/mintWorker.triggerMintLoop()
       → mintLicense → pollItemDeployed → registerLicense → state=minted
```

- **Download gate:** `license.state === 'minted' && nftAddress` (не order `paid`).
- **Два mint worker:**
  - `commerce/mintWorker` — legacy Option C (order `pending_payment` + FUNDED escrow → PAID).
  - `tonforge/mintWorker` — license NFT (minting/failed → minted, refund, payout).
- **Dual `@ton/core`:** backend vs `contracts/node_modules/@ton/core` — все Tact-вызовы через `tonBuildCoerce.ts`.

---

## Quality gates (после фиксов)

```bash
cd backend && npx tsc --noEmit          # 0 errors
cd .. && npx vitest run backend         # 326/326 passed
npx eslint backend/... (changed files)  # clean
```

---

## Команды для повторной проверки

```bash
# Сборка контрактов (если build/ пуст)
cd contracts && npm run build

# Backend
cd backend && npm run dev

# E2E (канонический путь)
cd backend && node --import tsx scripts/live-smoke-e2e.mjs

# Или из корня (делегат)
node scripts/live-smoke-e2e.mjs

# Пополнить buyer testnet wallet
cd backend && node --import tsx scripts/fund-buyer.mjs

# Phase 0 / Phase 1 smoke (из корня)
node scripts/live-smoke-phase0.mjs
node scripts/live-smoke-phase1.mjs
```

---

## Env (backend/.env, gitignored)

Ключевые переменные для staging smoke:

```env
TON_NETWORK=testnet
TON_API_ENDPOINT=https://testnet.toncenter.com/api/v2/jsonRPC
TON_API_KEY=...
TON_USD_FALLBACK=5.5

COLLECTION_OWNER_MNEMONIC_TESTNET=...
COLLECTION_ADDRESS_TESTNET=kQA9mT1B8zY1WnOEbVUrQOL5P9F5pR4wpyhUqT40wAUm1D4-

ORACLE_MNEMONIC=...
LICENSE_NFT_ITEM_CODE_BOC=...
APP_COLLECTION_CODE_BOC=...

LEGACY_PRODUCTS_OMIT_FIELDS=price_usd,scan_status
LEGACY_LISTINGS_OMIT_FIELDS=priceUsd
```

Полный шаблон: `deploy/coolify.env.example`.

---

## Известные ограничения

> **Обновление — canonical review/refactor (commit `274969c`).** Пункт #2 закрыт:
> order финализируется в `paid` order-reconciler'ом (бывший `commerce/mintWorker`
> с демонтированным минт-шагом). Дополнительно: per-seller маршрутизация
> достроена (escrow строится на `listing.collection_address`), двойной минтер
> устранён (единственный минтер — `tonforge/mintWorker`), `LEGACY_*_OMIT_FIELDS`
> убраны из prod-шаблона. Нужна multi-seller testnet-сертификация —
> см. `docs/per-seller-collections.md`.

1. **Staging Appwrite `listings`** — лимит атрибутов; `priceUsd` опускается через `LEGACY_LISTINGS_OMIT_FIELDS`.
2. **`confirm`** возвращает `state: pending_payment` + `mintPending: true` (tonforge path не переводит order в `paid`). _(Закрыто reconciler'ом — см. примечание выше.)_
3. **Баланс owner wallet** после E2E может быть низким (~0.49 TON) — нужен top-up для следующих mint.
4. **`contracts/build/`** gitignored — на CI/новой машине нужен `npm run build` в `contracts/`.

---

## Коммиты этого похода (логическая группировка)

1. `fix(commerce): agent listing schema and legacy Appwrite field omit`
2. `fix(commerce): TON price fallback and collection address alias on confirm`
3. `fix(onchain): shared @ton/core coercion and Tact item address derivation`
4. `fix(server): start TonForge mint worker on boot`
5. `docs(deploy): document staging smoke env vars`
6. `feat(scripts): live E2E smoke and testnet debug helpers`
7. `docs: live verify report for PR #90 staging run`

---

## Следующие шаги (вне скоупа)

- [ ] Push ветки и обновить PR #90
- [ ] Ротация `TON_API_KEY` (был в plaintext в сессии)
- [ ] Добавить `priceUsd` в staging Appwrite или миграция схемы
- [ ] E2E в CI с testnet secrets (optional, flaky)
