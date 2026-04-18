# License NFT — Operator Runbook (testnet → mainnet)

Документ описывает оперативные процедуры для запуска и поддержки on-chain
License NFT слоя TonForge: сборка контрактов, подготовка backend-oracle,
деплой `AppCollection` на testnet, E2E-приёмка покупки и refund, перенос
на mainnet, мониторинг и инциденты.

> Спецификация лицензии: [`docs/license-nft-spec.md`](./license-nft-spec.md)
>
> Контракты: `contracts/src/appCollection.tact`, `contracts/src/licenseItem.tact`
>
> Backend on-chain модуль: `backend/tonforge/onchain/`

---

## 0. Действующие лица

| Роль                | Кто это                                                                              | Где живёт ключ                          |
|---------------------|---------------------------------------------------------------------------------------|------------------------------------------|
| **Buyer wallet**    | Покупатель                                                                            | Tonkeeper / TonConnect                   |
| **Seller wallet**   | Разработчик приложения                                                                | Tonkeeper / Custom                       |
| **Treasury wallet** | Кошелёк маркетплейса для комиссии                                                    | Multisig (mainnet) / hot wallet (testnet) |
| **Oracle wallet**   | Backend-кошелёк, минтит и сжигает License NFT                                         | `ORACLE_MNEMONIC` env (Coolify secret)   |
| **Deployer**        | Кошелёк, деплоит `AppCollection` (должен совпадать с oracle)                          | `DEPLOYER_MNEMONIC` env (одноразово)     |

> **Важно**: deployer и oracle для конкретного `AppCollection` должны быть
> одним и тем же wallet — `ownerAddress` пишется в storage коллекции при
> деплое и впоследствии проверяется контрактом при `MintLicense`/`BurnLicense`.

---

## 1. Сборка контрактов

```bash
cd contracts
npm install
npm run build         # → build/AppCollection_AppCollection.code.boc, .abi
npm test              # 42 теста: appCollection + licenseItem + escrow + lifecycle
```

Артефакты, которые нам нужны для backend:

```bash
# AppCollection (нужен deploy script + backend; может не понадобиться backend, если адрес уже захардкожен)
base64 -w0 build/AppCollection_AppCollection.code.boc

# LicenseItem (обязателен backend для расчёта детерминистических адресов)
base64 -w0 build/LicenseItem_LicenseItem.code.boc
```

Полученные строки кладём в `.env` / Coolify Secret Storage:

```env
APP_COLLECTION_CODE_BOC=te6ccgEC...
LICENSE_NFT_ITEM_CODE_BOC=te6ccgEC...
```

---

## 2. Подготовка backend Oracle wallet

1. Сгенерировать новую 24-словную мнемонику в Tonkeeper / `tonkeeper-mnemonic-cli`.
   * Для testnet можно использовать devnet seed.
   * Для mainnet — обязательно офлайн-генерация на чистом устройстве,
     запись в холодное хранилище и копия в Coolify Secrets.
2. Адрес: при первом запуске backend выводит resolved oracle-адрес в логах
   (`oracleWallet.address`). Записать.
3. Запфандить кошелёк:
   * **testnet**: получить ~5 TON через [@testgiver_ton_bot](https://t.me/testgiver_ton_bot).
   * **mainnet**: пополнить ~10 TON. Газовый бюджет:
     * mint: ~`LICENSE_MINT_GAS_NANO` (по умолчанию 0.1 TON, чистый расход ≈ 0.04 TON).
     * burn: ~`LICENSE_BURN_GAS_NANO` (по умолчанию 0.05 TON).
   * Заводим алерт, когда баланс < 2 TON.

`.env` блок backend:

```env
TON_NETWORK=testnet
TON_API_ENDPOINT=https://testnet.toncenter.com/api/v2/jsonRPC
TON_API_KEY=<your-toncenter-key>
ORACLE_MNEMONIC="word1 word2 ... word24"
LICENSE_MINT_GAS_NANO=100000000
LICENSE_BURN_GAS_NANO=50000000
APP_COLLECTION_CODE_BOC=...
LICENSE_NFT_ITEM_CODE_BOC=...
```

> Если все вышеперечисленные переменные пустые, backend остаётся в legacy-режиме
> (минтит "виртуальные" лицензии без on-chain). См. `backend/tonforge/onchain/config.ts`.

---

## 3. Деплой `AppCollection` (per-app)

```bash
cd contracts
DEPLOYER_MNEMONIC="<тот же seed что ORACLE_MNEMONIC>" \
TON_API_KEY=<key> \
npm run deploy:collection -- \
  --network testnet \
  --app-id 1 \
  --metadata-uri https://cdn.tonforge.local/apps/1/collection.json \
  --item-base-uri https://cdn.tonforge.local/apps/1/items/ \
  --fund 0.2
```

Что делает скрипт:

1. Загружает `build/AppCollection_AppCollection.code.boc`.
2. Считает детерминированный адрес от `(code, init data)`.
3. Деплоит контракт через WalletV4 + StateInit.
4. Поллит, пока state не станет `active`.
5. Печатает payload для `POST /api/tonforge/admin/apps/:appId/collection`.

Привязка коллекции к приложению через backend:

```bash
curl -XPOST https://api.tonforge.local/api/tonforge/admin/apps/<appId>/collection \
  -H 'Content-Type: application/json' \
  -d '{
    "address": "<EQ...address...>",
    "metadataUriPrefix": "https://cdn.tonforge.local/apps/1/items/"
  }'
```

После этого `confirmPurchaseSession` будет минтить реальные NFT в эту коллекцию.

---

## 4. Поднять CDN под TEP-64 metadata

Для каждого приложения публикуем JSON-документы:

* `<metadata-uri>` — `collection.json` (TEP-64 collection metadata).
* `<item-base-uri><index>.json` — `LicenseItem` метаданные на каждый минт.

Пример collection.json:

```json
{
  "name": "TonForge License — DemoApp",
  "description": "Soulbound proof of purchase + device binding for DemoApp v1.x",
  "image": "https://cdn.tonforge.local/apps/1/icon.png",
  "social_links": ["https://tonforge.local/apps/1"]
}
```

Backend при минте передаёт `individualContent = offchainContent("<metadata_uri_prefix><index>.json")`.

---

## 5. E2E acceptance (testnet)

Минимальный сценарий для PR-приёмки:

1. **Подготовка**
   * Backend поднят (`docker compose up tonforge-api`), логи говорят `oracle wallet ready`.
   * `AppCollection` задеплоен и привязан, миграции БД применены.
2. **Successful purchase**
   1. Buyer открывает `/checkout` приложения, нажимает Pay.
   2. Подтверждает TonConnect транзакцию в Tonkeeper testnet.
   3. UI переходит в "Purchase complete" + `LicenseMintIndicator` рендерит «Minting your License NFT».
   4. Через 15–60 сек индикатор переключается на «License NFT minted» с адресом и кнопками TONScan / Tonkeeper.
   5. В профиле `My Licenses` появляется карточка с `state=trial_active`, нажатие "Проверить on-chain" даёт бейдж "Владение подтверждено".
   6. Tonkeeper testnet показывает NFT во вкладке Collectibles покупателя.
3. **Buyer-initiated refund (BuyerBurn)**
   1. Покупатель открывает "Мои лицензии" в профиле.
   2. Нажимает "Сжечь и вернуть" в карточке лицензии (в течение trial window).
   3. Подтверждает BuyerBurn транзакцию через TonConnect.
   4. LicenseItem сжигается, отправляет `RefundOnBurn` в Escrow.
   5. Escrow автоматически возвращает полную сумму покупателю и самоуничтожается.
   6. TONScan показывает, что `LicenseItem` и `Escrow` уничтожены,
      коллекция остаётся живой, `nextItemIndex` не уменьшается.
   7. Tonkeeper покупателя более не показывает NFT в Collectibles.
4. **Activation guard**
   1. Buyer пытается забиндить устройство → backend дергает `verifyLicenseOwner`,
      который дёргает `get_nft_data` и сверяет owner.
   2. Если NFT уже сожжён — backend возвращает `license_not_owned_onchain`.

Каждый шаг логируется в `tonforge_logs` (см. service.logEvent).

---

## 6. Mainnet promotion checklist

Перед переключением на mainnet:

- [ ] Холодная генерация `ORACLE_MNEMONIC`, бэкап в 2 локациях.
- [ ] Wallet профинансирован минимум на 1 месяц (трафик * газ).
- [ ] CDN с metadata живёт за HTTPS + CDN, ETag/Cache-Control выставлены.
- [ ] `TON_API_ENDPOINT=https://toncenter.com/api/v2/jsonRPC`,
  `TON_NETWORK=mainnet`, `TON_API_KEY` обновлён.
- [ ] Скрипт деплоя выполнен **с тем же** mnemonic, что и oracle.
- [ ] Smoke E2E: реальная покупка ~$1 TON, buyer burn → refund проходит.
- [ ] Прогон `npm run build && npm test` в `contracts/` — все 42 теста зелёные.
- [ ] Backend `npm run typecheck && npm run test` чистые (исключая legacy-warnings).
- [ ] Frontend `npm run typecheck && npm run build` чистые.
- [ ] Алерты: low oracle balance, mint_failed > 0 за 5 минут, burn_failed > 0 за 5 минут,
  rpc latency > 5s, mismatch between license.state and on-chain owner.

---

## 7. Operations & инциденты

### 7.1 "Mint застрял в `mint_pending`"
* Проверить логи backend на `tonforge_logs.event = onchain_mint_failed`.
* Проверить баланс oracle wallet (`tonscan.org/address/<oracle>`).
* Если seqno-конфликт: дождаться 60s и повторить (backend будет повторять автоматически).
* Ручная починка: повторно вызвать `mintLicense` для конкретного `licenseId`
  через приватный admin endpoint (TODO добавить, MVP — через DB).

### 7.2 "Burn не проходит"
* Убедиться, что `BurnLicense` шлётся owner-кошельком (oracle).
* Проверить `LicenseItem` через `getNftData` — если уже `nonexist`, считать burn'ом успешным.
* Если контракт жив, но `transferLimit` нарушен — повторить burn (gas budget x2).

### 7.3 "Backend не может верифицировать владельца"
* `verifyLicenseOnchain` возвращает `reason=item_not_active`: NFT сожжён или ещё не задеплоен.
* `reason=owner_mismatch`: владелец сменился (для transferable NFTs) — это легитимно,
  обновить `license.buyerWallet` в БД через ручную миграцию или поддержать transfer-flow.
* `reason=collection_not_configured`: вызвать `/admin/apps/:appId/collection` ещё раз.

### 7.4 Ротация oracle-кошелька
1. Сгенерировать новый mnemonic, прибить к новому wallet.
2. Из старого oracle отправить `ChangeOwner(newOwner)` в каждый `AppCollection`.
3. Обновить `ORACLE_MNEMONIC` в Coolify, перезапустить backend.
4. Подождать рендеринг логов `oracle wallet ready (<new addr>)`.
5. Прогнать smoke E2E.

### 7.5 Восстановление после потери oracle-ключа
* Если потерян mnemonic — все будущие минты в существующих коллекциях невозможны.
* План B: задеплоить новый `AppCollection` с новым owner, перенаправить новые
  покупки на новую коллекцию (DB поле `collectionAddress`), старые лицензии
  остаются валидными.

---

## 8. Полезные команды

```bash
# Проверить контрактное состояние и баланс
curl "https://testnet.toncenter.com/api/v2/getAddressInformation?address=<addr>"

# Проверить TEP-64 owner LicenseItem
curl "https://testnet.toncenter.com/api/v2/runGetMethod" \
  -H 'Content-Type: application/json' \
  -d '{"address":"<licenseItemAddr>","method":"get_nft_data","stack":[]}'

# Перевыпустить миграции БД (idempotent)
psql "$DATABASE_URL" -f backend/sql/tonforge_schema.sql

# Полный E2E тест-набор контрактов
cd contracts && npm test
```

---

## 9. Ссылки

* TEP-62 (NFT Collection): https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md
* TEP-64 (NFT Metadata): https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md
* TEP-85 (Soulbound NFTs): https://github.com/ton-blockchain/TEPs/blob/master/text/0085-sbt-standard.md
* TON Sandbox: https://docs.ton.org/v3/guidelines/smart-contracts/testing/overview
* Tact compiler: https://docs.tact-lang.org/

---

_Last updated: 2026-04-18, owner: TonForge platform team._
