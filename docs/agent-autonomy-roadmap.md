# План: автономия агента + per-seller коллекции (TonForge)

> Живой роадмап. Поднят из плана агента в Кодекс репозитория, чтобы быть общим
> Свитком. Статусы отражают состояние ветки `claude/funny-dijkstra-KIPtO` (PR #90).

## Видение (зачем)

Платформа как **точка сборки** для сделок между ИИ-агентами и **взаимная
верификация доверия** — «надёжный партнёр». Цель — максимальная **самостоятельность
бота-продавца**, при этом KYC проходится честно через реального человека-владельца
(не блокер, но и не обход). Движение к **суверенному агенту-продавцу фазами**, не
ломая денежный путь.

Ключевой факт контракта: `contracts/src/appCollection.tact:54` →
`require(sender() == self.ownerAddress, "Only collection owner can mint")`. Отдельной
роли `minter` нет → платформо-владеемые per-seller коллекции возможны сразу (Фаза 1),
а суверенное владение продавцом требует правки контракта (Фаза 2).

## Статус-доска

| Фаза / пункт | Статус |
|---|---|
| 0.1 Онбординг-канал инструкций | ✅ реализован, **live на staging** |
| 0.2 `products:write` (черновики) | ✅ реализован, smoke на staging |
| 0.3 `status`-эндпоинт | ✅ реализован |
| 1. Per-seller коллекции (платформо-владеемые) | ✅ **single-seller verified на testnet** (order=`paid`, NFT в своей коллекции, `collectionMatch=true`); ⏳ multi-seller — нехватка testnet-TON (не код) |
| Денежный путь: единственный минтер | ✅ `commerce/mintWorker` → reconciler; минтит только `tonforge` |
| Безопасность: free-mint в `confirmPurchaseSession` | ✅ изгнан (он-чейн минт убран из deprecated-пути) |
| 2. Суверенные коллекции продавца | 📜 спецификация (ниже); правка Tact + аудит |

---

## Фаза 0 — Примитивы автономии ✅ (без контракта)

Реализовано и live-проверено на staging Appwrite. Кратко (детали — в коде и в
`docs/agent-api.md` / OpenAPI):

- **0.1 Онбординг-канал** — `GET /api/v1/agent/instructions` (scope `instructions:read`,
  читается **до KYC**): машинно-читаемый манифест (`service_overview`, `prerequisites`,
  `onboarding`, `kyc`, `behavior`) с **границей честности** (конфиденциальность своей
  стратегии — да; сокрытие существенных фактов / обход KYC — нет) + персональный
  чек-лист. Дефолты в коде + admin-оверрайд в Appwrite `agent_instructions`.
  Файлы: `backend/agent/instructions.ts`, `status.ts`, `routes.ts`, `commerce/adminRoutes.ts`.
- **0.2 `products:write`** — `POST /api/v1/agent/products`: агент заводит товар-черновик
  в ту же модерацию + антивирус, что и человек (reuse `insertProduct`/`createProductSchema`);
  создатель резолвится из кошелька токена (`findUserByTonAddress`), не из тела.
- **0.3 status** — `GET /api/v1/agent/status`: онбординг-прогресс + агрегаты
  (листинги/заказы/дистрибуция, только счётчики, без PII), выведено из существующих данных.
- KYC-гейт уже встроен в `apiRequireAgentToken`; для онбординг-ридов — `skipKyc`
  (санкции по-прежнему проверяются). Per-IP rate-limit backstop на агентском роутере.

---

## Фаза 1 — Per-seller коллекции (владелец = платформа) ✅ + канон

Каждый продавец получает **свою** AppCollection, on-chain `ownerAddress` =
платформенный ключ `COLLECTION_OWNER`. Mint-воркер подписывает тем же ключом → гард
`sender() == ownerAddress` проходит, **без правки контракта**.

**Реализовано:**
- Реестр **Appwrite `seller_collections`** (не SQL `app_collections` — её бэкенд не
  использует) + `backend/commerce/sellerCollectionRepository.ts`. Поля: `sellerWallet`,
  `network`, `appId`, `collectionAddress`, `ownerWallet` (кошелёк продавца — задел под
  Фазу 2), `deployTxHash`, `status` (`pending|deployed|failed`).
- `backend/commerce/collectionProvisioner.ts` — детерминированная деривация адреса,
  **зеркалящая** `contracts/scripts/deployCollection.ts` (TEP-64 `0x01 + snake(uri)`,
  `AppCollection.fromInit`), изолированный он-чейн деплой под env-gate (no-op без
  `COLLECTION_OWNER`; `503 PROVISION_NOT_CONFIGURED` иначе). `appId` = 256-бит хеш
  `network:sellerWallet`.
- Admin-триггер `POST /api/v1/commerce/admin/seller-collections/provision` (idempotent) + GET-lookup.

**Канонические правки денежного пути (ревью композиторских коммитов):**
- **Routing**: `orderRoutes.ts` строит escrow на `listing.collection_address` (fallback —
  глобал для legacy). Теперь **escrow + license + mint — одна per-seller коллекция**.
- **Единственный минтер**: `tonforge/mintWorker` минтит в `license.collectionAddress`
  (per-seller, cluster-lock, полный mint/refund/payout). `commerce/mintWorker` низведён
  до **order-reconciler** (минт-шаг удалён) — финализирует `order → PAID/FULFILLED/REFUNDED`.

**Остаётся:** ⏳ multi-seller testnet-сертификация (см. «Врата»).

---

## Фаза 2 — Суверенные коллекции продавца 📜 (СПЕЦИФИКАЦИЯ)

> Конечное состояние видения: продавец **владеет** своей AppCollection on-chain;
> платформа — лишь **гарант-минтер** (и эскроу-гарант), а не кастодиан. Требует правки
> Tact-контракта → отдельный **аудит + редеплой**, не в этом PR.

### 2.1 Ключевая идея — «протокольный минтер» (несменяемый)
Наивный `authorized_minters: map<Address,Bool>`, управляемый владельцем, опасен:
суверенный продавец может **снять** платформу с минтеров → платформа не сможет
минтить → покупки/эскроу ломаются. Поэтому канон:

- **`protocolMinter: Address`** — задаётся при init, **иммутабелен**, владелец НЕ может
  его убрать. Гарантирует, что платформа всегда сможет минтить (сохраняя escrow/refund-
  гарантии) даже на суверенной коллекции продавца.
- Опционально **`authorizedMinters: map<Address,Bool>`** — управляется владельцем
  (`AddMinter`/`RemoveMinter`), для будущих сценариев; на гарантии протокола не влияет.

### 2.2 Правка контракта `contracts/src/appCollection.tact`
```tact
// storage (+поля)
protocolMinter: Address;                 // immutable, set in init
authorizedMinters: map<Address, Bool>;   // owner-managed (optional)

// init(...): принять protocolMinter; записать.

receive(msg: MintLicense) {
    require(
        sender() == self.ownerAddress
        || sender() == self.protocolMinter
        || self.authorizedMinters.get(sender()) == true,
        "Only owner / protocol minter / authorized minter can mint"
    );
    // ... тело без изменений
}

// owner-only:
receive(msg: AddMinter)    { require(sender() == self.ownerAddress, "owner only"); ... }
receive(msg: RemoveMinter) { require(sender() == self.ownerAddress, "owner only");
                             // нельзя удалить protocolMinter — он не в map
                             ... }
```
Обратная совместимость: коллекции Фазы 1 (owner == платформа) продолжают работать как
есть; `protocolMinter` можно ставить = платформенный ключ и для них.

### 2.3 Неподписанный деплой продавцом (seller-signed)
- Новая backend-функция `computeCollectionDeploy(sellerWallet, appId, content, protocolMinter)`
  **по паттерну `computeEscrow`** (`backend/commerce/escrow.ts:154`): собрать stateInit
  (code + data: `ownerAddress = seller`, `protocolMinter = платформенный mint-ключ`),
  вернуть `{ collectionAddress, stateInitBase64, deployPayloadBase64, fundingTon }`.
- Новый эндпоинт отдаёт **unsigned deploy tx**; продавец подписывает через TonConnect
  (как фандинг эскроу). Деплой создаёт коллекцию, **владелец = продавец**, платформа уже
  протокольный минтер.
- Mint-воркер (tonforge) минтит платформенным оракулом в `license.collectionAddress` →
  оракул == `protocolMinter` → проходит. **Воркер не меняем.**

### 2.4 Модель данных (forward-compatible из Фазы 1)
- `seller_collections.ownerWallet` уже = кошелёк продавца. Добавить:
  - `ownership: 'platform' | 'sovereign'` — какая модель у коллекции;
  - `protocolMinterRegistered: bool` — стоит ли платформенный минтер (для sovereign;
    минт упадёт, пока не стоит).
- Миграция: коллекции Фазы 1 остаются `platform` (не трогаем). Новые продавцы —
  `sovereign`. Опционально «claim ownership»: для существующей платформо-владеемой
  коллекции — `OP_CHANGE_OWNER` (0x4d8b8b8b, уже есть в `AppCollectionWrapper`) → передать
  владение продавцу, оставив платформу `protocolMinter`. Без редеплоя каждой коллекции.

### 2.5 Риски и обязательные шаги
- **Правка mint-гарда = денежный путь → полный security-аудит контракта + редеплой.**
- UX: seller-signed деплой требует газа (~0.1 TON у продавца).
- Решить судьбу существующих коллекций (рекомендация: оставить Фазу-1 как есть, sovereign
  только для новых).
- Тесты контракта в `contracts/tests/` на новый гард (owner / protocolMinter / authorized /
  посторонний-реджект).

---

## Реестр скверны (hardening backlog)

**Изгнано (в этой ветке):**
- ✅ Free-mint через `confirmPurchaseSession` — он-чейн минт убран из deprecated-пути
  (без оплаты/санкций/AML/KYC он драйнил оракула). `backend/tonforge/service.ts`.
- ✅ Двойной минтер (commerce + tonforge) → один минтер + reconciler.
- ✅ escrow на глобале → escrow на per-seller коллекции.
- ✅ `LEGACY_*_OMIT_FIELDS` убраны из prod-шаблона (дропали `priceUsd`/`scan_status`).
- ✅ CI: typecheck TS2307 (dynamic imports), 10 CodeQL-алертов (удалены dev-скрипты с
  утечкой `COMMERCE_ADMIN_SECRET`).
- ✅ `computeItemAddress` — убран рудиментарный параметр `code` (адрес берётся из
  авторитетного Tact-`init()`); вычищены `mintLicense.ts` + тест. tsc/eslint/тесты зелёные.
- ✅ Legacy `/api/tonforge/purchase/{session,confirm}` упокоены через `410 Gone` (фронт и
  тесты их не звали); осиротевшие zod-схемы удалены.
- ✅ Осиротевшие методы `createPurchaseSession`/`confirmPurchaseSession` удалены из
  `tonforge/service.ts` + каскадная чистка (7 теней: импорты цен, типы `PurchaseSession*`,
  `buildTonAddress`, `addHours`). Полное удаление недостижимого кода; tsc/тесты зелёные.
- ✅ Order-reconciler: машина состояний вынесена в чистую `decideReconcileAction` (поведение
  неизменно) и покрыта юнит-тестом (7 кейсов: FUNDED+license→PAID, 3/4→FULFILLED/REFUNDED,
  zero-addr→wait, защита от ложного распознавания реального адреса) — щит денежного пути
  до testnet-сертификации.
- ✅ Финализация order→PAID **унифицирована**: единственный handler `reconcileOrderAfterMint`
  (immediate из `tonforge/mintWorker` + fallback из `commerce/mintWorker` делегируют в него);
  дублёр `onMintConfirmed` удалён. Handler покрыт юнит-тестом (6 кейсов: идемпотентность
  already-PAID, entitlement-once, omit-fields, not-found, guards). Reconciler сохранён как
  страховка (primary+fallback — намеренно, не «одна сущность»).

**Остаётся (P2, не блокеры):**
- 🟡 `TON_USD_FALLBACK` — политика прода: fail-closed (не задавать → заказ падает при
  недоступности цены) vs resilient (задать + санити-бунд: отвергать если отклонение от
  последней цены > X%). Рекомендация — resilient с бундом.
- 🟡 Прод-провижн: прогнать `npm run provision:commerce` на прод-Appwrite (создаёт
  `agent_instructions` + `seller_collections`) как часть деплоя.

---

## Врата (certification gates) до Хранилища (мерж в `main`)

- **Gate A — testnet single-seller**: ✅ **PASS** (E2E 2026-06-08). `order.state=paid`,
  NFT заминчен, `onChain.collectionMatch=true` (NFT в per-seller коллекции). Поток:
  `confirm → ensureLicenseForOrder → tonforge/mintWorker → mint → registerLicense →
  reconcileOrderAfterMint → order=paid + entitlement`. Финализация: **немедленная**
  (`reconcileOrderAfterMint` из tonforge-воркера, idempotent) + **поллинг-фолбэк**
  (`commerce/mintWorker` reconciler по `PENDING_PAYMENT`) — primary+fallback, не двойственность.
- **Gate B — testnet multi-seller (решающий)**: ⏸ **BLOCKED** — нехватка testnet-TON
  (owner-кошелёк осушён, faucet cooldown). Логика готова (`live-smoke-e2e-suite multi`);
  нужно ≥1.5 TON на owner. Доказательство: два NFT в **разных** `collection_address`.
- **Gate C — mainnet-готовность**: пройти `docs/commerce-license-smoke-checklist.md §6`
  (treasury→multisig, oracle ≥50 TON, алерты на `mint_failed`/`refund_pending`, возврат
  `REFUND_AFTER_MS` к 1ч, резервный ручной refund).

**Решение Хранителя:** Gate A пройден — денежный путь и per-seller routing подтверждены
на testnet для одного продавца (`collectionMatch=true`). Мерж в `main` **держим** до
Gate B (multi-seller routing — суть Фазы 1), который ждёт лишь пополнения owner-кошелька,
не правок кода. Фаза 0 и статика готовы.
