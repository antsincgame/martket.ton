# Commerce × License NFT — Smoke & E2E чек-лист (testnet)

Цель: за один прогон убедиться, что новый Commerce-флоу с автоматическим
mint License NFT и auto-refund при mint_failed работает end-to-end на
TON testnet.

> Связанные документы:
> - [`docs/license-nft-runbook.md`](./license-nft-runbook.md) — деплой
>   контрактов, заведение oracle/treasury, перенос на mainnet.
> - [`docs/license-nft-spec.md`](./license-nft-spec.md) — спецификация.
> - [`docs/byos-distribution.md`](./byos-distribution.md) — BYOS-доставка.

---

## 0. Окружения и роли

| Слой       | Что нужно                                                           |
|------------|----------------------------------------------------------------------|
| TON        | testnet (`TONFORGE_NETWORK=testnet`), oracle с ≥10 TON, treasury    |
| Appwrite   | Project `69d76ede001aae3bd4d7`, database `marketplace`, schema applied |
| Backend    | `node backend/server.js`, переменные из `.env.example` заполнены    |
| Frontend   | `npm run dev` (Vite), TonConnect manifest на testnet                |
| Wallets    | Tonkeeper (testnet) для buyer + seller                              |

### Pre-flight

```bash
# 1. Контракты собраны и протестированы
cd contracts && npm install && npm run build && npm test

# 2. Appwrite-схема применена (idempotent)
node scripts/provision-commerce.mjs

# 3. Backend стартует без ошибок и mintWorker подцепился
cd backend && npm install && npm run build && node dist/server.js
#   ожидаемый лог: "[mintWorker] tick interval=… ms" каждые 30s
```

Перед прогоном проверьте в логах:
- `loadOnchainConfig: enabled=true network=testnet`
- `mintWorker started`
- Appwrite client connected, all collections present

---

## 1. Smoke (5 минут): API живой

```bash
BASE=http://localhost:8787/api/v1/commerce

# health
curl -s $BASE/health | jq

# каталог листингов (после provision должен быть пустой массив)
curl -s $BASE/listings | jq

# попытка получить несуществующую лицензию → 404
curl -s -o /dev/null -w "%{http_code}\n" $BASE/licenses/none
```

Ожидание: `health=ok`, listings=`[]`, licenses/none=`404`.

---

## 2. Подготовка продавца и листинга

### 2.1. Создать seller_profile + listing

Через админ-панель (`/demiurge/commerce` → `Listings`) или curl:

```bash
# создать seller_profile (oracle wallet вручную делает initSeller)
curl -s -X POST $BASE/sellers \
  -H 'content-type: application/json' \
  -d '{"wallet":"<SELLER_TESTNET_WALLET>","kycLevel":"basic"}' | jq

# опубликовать listing с включённым NFT
curl -s -X POST $BASE/listings \
  -H 'content-type: application/json' \
  -d '{
    "sellerWallet":"<SELLER_TESTNET_WALLET>",
    "title":"Smoke E2E App",
    "priceTon":"1.5",
    "nftEnabled":true,
    "collectionAddress":"<DEPLOYED_COLLECTION_ADDRESS>",
    "metadataUriPrefix":"https://r2.example.com/meta/",
    "licenseTransferLimit":"3"
  }' | jq
```

Ожидание: `listing.id`, `nftEnabled=true`, `collectionAddress` сохранён.

### 2.2. Загрузить артефакт (BYOS)

Через `/demiurge/commerce` загрузить .zip / .apk → backend сохраняет в
R2 и привязывает к листингу.

---

## 3. Happy path: покупка → mint → download

### 3.1. Buyer создаёт ордер

В `ProductPage` (`/p/<listingId>`):
1. Подключить **Tonkeeper testnet** через TonConnect.
2. Нажать **Buy** → видим разбивку:
   - Product price: `1.5 TON`
   - Mint gas: `~0.15 TON`
   - Register gas: `~0.05 TON`
   - **Total**: `~1.7 TON`
3. Подтвердить транзакцию в кошельке.

### 3.2. Backend цикл

В логах backend ожидаем:
```
[orderRoutes] order=ord_… created, escrow=EQA…, total=1.7 TON
[orderRoutes] order=ord_… confirmed, license=lic_… state=mint_pending
[mintWorker] picked lic_… → mintLicense() …
[mintWorker] lic_… nft deployed at EQA…, state=minted, registering…
[mintWorker] lic_… registered with escrow, state=minted
```

### 3.3. Frontend MintProgress

В `CommerceCheckout` после оплаты пользователя редиректит на экран
`MintProgress`. Чек-лист:
- [ ] Шаг 1 «Payment received» — done за ≤30s
- [ ] Шаг 2 «Mint pending» → «NFT minted» за 1–3 минуты
- [ ] Шаг 3 «Register license» → done
- [ ] Кнопка **Download** активна
- [ ] При нажатии: backend `distributionRoutes` отдаёт presigned URL

### 3.4. MyLicensesPanel

В `/demiurge/arsenal` (или `/me/licenses`):
- [ ] Лицензия отображается с бейджем `minted`
- [ ] Видны: nftAddress, escrowAddress, listing.title
- [ ] Состояние подгружается из `commerceApi.fetchMyLicenses` (НЕ из
      старого `tonforgeApi.fetchWalletProfile`)

### 3.5. Проверка on-chain

```bash
# в TON Explorer (testnet)
#  - escrow EQA…  → state == 3 (REGISTERED), licenseAddress != 0
#  - NFT EQA…     → owner == buyer wallet
```

---

## 4. Sad path: mint_failed → **buyer-claim** refund

> ⚠️ **Изменено (PR #95).** Авто-refund через `OracleRefund` **удалён** — эскроу
> по дизайну контракта (`RefundIfNotMinted`, `sender()==buyer`) возвращает
> средства **только покупателю**, оракул не может. Поток теперь:
> `mint_failed → refund_claimable → (покупатель подписывает) → refund_pending → refunded + заказ REFUNDED`.
>
> **Полная сертификация этого пути — в отдельном рунбуке для оператора с живым
> testnet:** [`refund-cycle-testnet-runbook.md`](./refund-cycle-testnet-runbook.md).
> Ниже — краткая проверка; детали, негативная матрица и recovery — там.

Кратко:
1. Сорвать минт (бланк `ORACLE_MNEMONIC` после оплаты, либо non-deployed
   collection) → license `mint_failed`. **Не** оставлять `collection_address`
   пустым — order-create отвергнет `400 LISTING_NO_COLLECTION` (PR #94).
2. Ускорение — **через env, без пересборки**: `MINT_REFUND_AFTER_MS=60000`
   (вернуть `3600000` перед mainnet). On-chain grace `MINT_GRACE_SEC=600s` — в
   контракте, не меняется без редеплоя (заложить ~10 мин ожидания).
3. Воркер: `mint_failed → refund_claimable`. В `MyLicensesPanel` — кнопка
   **«Вернуть средства»**; покупатель подписывает `RefundIfNotMinted`.
4. Settle: эскроу самоуничтожается → license `refunded` + **заказ `refunded`**
   (`finalizeOrderRefund`; reconciler сам не может — эскроу уже null).
5. On-chain: эскроу inactive; баланс покупателя вырос на ~сумму минус gas.

---

## 5. Negative checks (security smoke)

| Сценарий                                                            | Ожидание                       |
|---------------------------------------------------------------------|--------------------------------|
| `GET /licenses/<id>` чужого buyer wallet                            | 404 (или 403 с auth)           |
| `GET /distribution/<licenseId>` пока state=`mint_pending`           | 403 `LICENSE_NOT_READY`        |
| `GET /distribution/<licenseId>` при state=`refund_claimable`/`refund_pending`/`refunded` | 403                           |
| `RefundIfNotMinted` от не-buyer (тест из contracts)                 | контракт реджектит             |
| `RefundIfNotMinted` до 600s grace / после регистрации license       | контракт реджектит             |
| `POST /orders/:id/refund-claim` до grace / не-владельцем            | 409 `GRACE_NOT_ELAPSED` / 403  |
| Повторный `confirmOrder` для уже подтверждённого                    | 409 `ORDER_ALREADY_CONFIRMED`  |

Контрактные кейсы автоматически покрыты в `contracts/tests/escrow.spec.ts`,
запустить локально:

```bash
cd contracts && npm test -- --reporter=default
```

---

## 6. Готовность к mainnet

Перед переключением `TONFORGE_NETWORK=mainnet`:

- [ ] Все §1–§5 пройдены на testnet и зафиксированы (скриншоты + tx links).
- [ ] `MINT_REFUND_AFTER_MS` = 1ч; test-оверрайды (`MINT_REFUND_REVERT_MS`,
      `MINT_TICK_MS`) сняты.
- [ ] **Контур возврата сертифицирован на testnet** —
      [`refund-cycle-testnet-runbook.md`](./refund-cycle-testnet-runbook.md) пройден,
      tx-линки зафиксированы.
- [ ] Treasury переведён на multisig.
- [ ] Oracle wallet получил production-mnemonic (Coolify secret) и
      ≥50 TON баланс.
- [ ] Метрики mintWorker (успехи/фейлы/refunds) выставлены в логи.
- [ ] Алерт на >5 `mint_failed` за час и на любой `refund_pending`/`refund_claimable`
      старше порога.
- [ ] Возврат — действие **покупателя** (`RefundIfNotMinted`); платформа не может
      рефандить до минта (контракт запрещает). Резервного admin-refund нет
      намеренно; для зарегистрированной лицензии — BuyerBurn в trial-окне.

---

## Appendix A. Команды для быстрого debug

```bash
# Все pending лицензии
curl -s $BASE/admin/licenses?state=mint_pending | jq

# Все mint_failed / refund_claimable (кандидаты на возврат)
curl -s $BASE/admin/licenses?state=mint_failed | jq
curl -s $BASE/admin/licenses?state=refund_claimable | jq
```

Forced admin-refund **нет намеренно** — до минта возврат может инициировать
только покупатель (`RefundIfNotMinted`, контракт требует `sender()==buyer`).
Сертификация пути — [`refund-cycle-testnet-runbook.md`](./refund-cycle-testnet-runbook.md).
(Если admin-эндпоинты ещё не вынесены — Appwrite console: database
`marketplace`, collection `licenses`.)
