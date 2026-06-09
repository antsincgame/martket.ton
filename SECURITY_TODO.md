# martket.ton — что осталось по безопасности

Статус: 2026-06-09. Аудит TonForge. Ниже только **незакрытое**; сделанное — в конце для контекста.

Закрыто кодом и задеплоено всё, что чинится без живого доступа и без риска уронить прод. Остальное упирается в секреты/доступ/решения либо в контракт.

---

## 1. За тобой — нужен живой доступ / секрет / решение

### 1.1. Применить права Appwrite — КРИТИЧНО (на проде права ещё открыты)
Скрипт `scripts/harden-permissions.mjs` запушен, но **не применён** (нужен живой Appwrite API-key; Appwrite-MCP в сессии не был подключён).
```
APPWRITE_ENDPOINT=... APPWRITE_PROJECT_ID=... APPWRITE_API_KEY=... npm run harden:permissions
```
Проверить вывод: ни одного `FAILED`. До запуска открыты шире нужного: `seller_profiles` (шифр BYOS-креды + KYC), `profiles` (email + buyer Lite-KYC PII), `developers`, `legacy_products`, `support_tickets`, `compliance_ledger`, `api_audit_logs`, bucket `tonforge_state`.

### 1.2. Ротация засвеченных в чате секретов (Coolify)
`APPWRITE_API_KEY`, `JWT_SECRET`, `COMMERCE_ADMIN_SECRET`, R2 access+secret, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`.
`STORAGE_ENCRYPTION_KEY` — перегенерить `openssl rand -hex 32` (текущее 64-hex значение прошло через чат; шифрованных данных пока нет, ротация бесплатна). Testnet mnemonic — по желанию.

### 1.3. Env для запуска коммерции (сейчас мертва end-to-end)
- `TREASURY_WALLET_ADDRESS`
- `ORACLE_MNEMONIC` + `LICENSE_NFT_ITEM_CODE_BOC` + `APP_COLLECTION_CODE_BOC` (НЕ `COLLECTION_OWNER_MNEMONIC`)
- Didit KYC keys
- `VIRUSTOTAL_API_KEY`

### 1.4. Sanctions / AML blocklist
Код скрининга есть, но список пуст → пропускает всех. Наполнить blocklist / настроить источник.

### 1.5. P0 trial-refund — продуктовое решение
На цифровом товаре `BuyerBurn` возвращает весь баланс эскроу **включая комиссию** → бесплатный товар. Нужен вотчер гашения download при burn + политика возврата для file-товаров.

---

## 2. Контракты — нужен Tact compile + `contracts/tests/*.spec.ts` + редеплой
Автодеплоем Coolify не катится. Вслепую (без локального компилятора) в main не пишу — ошибка в контракте опаснее исходного бага.

### 2.1. CON-01 (КРИТИЧЕСКИЙ) — RegisterLicense не привязан к коллекции
`Escrow.RegisterLicense` проверяет `sender() == msg.licenseAddress`, но НЕ проверяет, что license заминчен привязанной коллекцией (`self.collectionAddress`). Фронт-ран: атакующий регистрирует свой контракт на FUNDED-эскроу до саморегистрации настоящего айтема.
Эксплойт — griefing/DoS, не кража (RefundOnBurn всегда шлёт средства `self.buyer`): срыв продаж продавца / блокировка burn-возврата покупателя.
Прикладной слой уже смягчён (мой `pollLicenseRegistered` не подтвердит подделку → download закрыт, покупатель не теряет и деньги, и товар). Полный фикс — контрактный, 3 правки:
1. `escrow.tact` → `receive(RegisterLicense)`: заменить `require(sender() == msg.licenseAddress, …)` на `require(sender() == self.collectionAddress, "Only bound collection")` (проверки `state == FUNDED` и «license ещё не задан» оставить).
2. `appCollection.tact` → `receive(MintLicense)`: после деплоя айтема слать `RegisterLicense{ licenseAddress: itemAddress }` на `msg.escrowAddress` (перераспределить газ — сейчас весь `SendRemainingValue` уходит айтему).
3. `licenseItem.tact` → убрать self-register из пустого `receive()` (станет лишним).

### 2.2. STO-01 — bucket commerce_assets публичный
`commerce_assets` = `READ_ANY`, а legacy-путь `assetFileId` кладёт туда файлы-товары → скачиваются напрямую из Appwrite Storage в обход license-гейта.
Не закрыл глухо: тот же bucket, вероятно, отдаёт публичные картинки листингов (блокировка сломает показ).
Решение за тобой: подтвердить, что доставка идёт только через gated-distribution (R2/GitHub signed URL) → тогда вынести товарные файлы в `fileSecurity`/server-only; либо разделить bucket (картинки публично, товары приватно). Скажешь назначение — расширю `harden-permissions.mjs`.

### 2.3. TEP-62 (минор) — get_nft_address_by_index заглушка
`AppCollection.get_nft_address_by_index` возвращает `newAddress(0, 0)` → обозреватели/маркетплейсы не находят айтем по индексу. Интероп, не безопасность.

---

## 3. Латентное / минорное (commerce выключен) — не трогал, риск правки > польза
- `verifyPaymentToEscrow` принимает любой tx buyer→escrow с `value >= expected`, без проверки opcode `PayEscrow` / состояния FUNDED → шум в ledger `escrow_fund`. Реальный гейт — reconciler, читающий on-chain state; деньги/NFT не затронуты.
- Тихий фолбэк legacy-v3: при падении `computeEscrow` заказ создаётся без эскроу → confirm по memo на treasury и сразу выдаётся entitlement без NFT / trial-refund.
- `ensureLicenseForOrder` в confirm — fire-and-forget; при падении эскроу профинансирован без license → `refund-claim` вернёт `NO_LICENSE` (только ручной `RefundIfNotMinted` on-chain после grace). `createOrder` требует `collection_address`, так что в норме не случается.

---

## 4. Координация
По контрактам `martket.ton` параллельно работал отдельный Claude Code агент (PR-based). Подтвердить, кто берёт CON-01 / STO-01, чтобы не плодить конфликтующие PR.

---

## Сделано и задеплоено (контекст, зелёная сборка)
- `f1c4b57` — `harden-permissions.mjs` + npm-скрипт
- `8e323b4` — price-oracle (CoinGecko/Binance + кламп вместо мёртвого CoinCap), antivirus-гейт в `downloadGate`, чистка PII/токенов из auth-логов
- `d2cde40` — проводка scan-гейта в `distributionRoutes` + DNS-проверка SSRF в `storageService`
- `3be9bae` — R1 (подтверждение саморегистрации license вместо баунсящегося oracle-register), сериализация mint/refund/payout (гонка seqno), новый `escrowState.ts`
- Coolify env: `STORAGE_ENCRYPTION_KEY` → 64 hex
