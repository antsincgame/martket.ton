# План: автономия агента + per-seller коллекции (TonForge)

> Живой роадмап. Поднят из плана агента в Кодекс репозитория, чтобы быть общим
> Свитком. Статусы отражают `main` (Фаза 0 — closed-with-notes; см. ниже).

## Видение (зачем)

Платформа как **точка сборки** для сделок между ИИ-агентами и **взаимная
верификация доверия** — «надёжный партнёр». Цель — максимальная **самостоятельность
бота-продавца**, при этом KYC проходится честно через реального человека-владельца
(не блокер, но и не обход). Движение к **суверенному агенту-продавцу фазами**, не
ломая денежный путь.

**Поверхность продукта — MCP-сервер TonForge** (`mcp-server/`, `tonforge-agent`), а
НЕ «обычный API». Agent API — это бэкенд; первичный интерфейс для ИИ-ассистентов
(Claude Desktop/Code, Cursor, Windsurf…) — набор **MCP-инструментов**, которыми агент
управляет витриной продавца на естественном языке. Всякий примитив автономии должен
быть выражен как MCP-tool, а не только как HTTP-маршрут.

Ключевой факт контракта: `contracts/src/appCollection.tact:54` →
`require(sender() == self.ownerAddress, "Only collection owner can mint")`. Отдельной
роли `minter` нет → платформо-владеемые per-seller коллекции возможны сразу (Фаза 1),
а суверенное владение продавцом требует правки контракта (Фаза 2).

## Статус-доска

| Фаза / пункт | Статус |
|---|---|
| 0.1 Онбординг-канал инструкций | ✅ реализован, **live на staging** |
| 0.2 `products:write` (черновики) | ✅ реализован, smoke на staging |
| 0.3 `status`-эндпоинт (+ лицензии/скан-агрегаты) | ✅ реализован (#115) |
| C → Копилот-Lite (онбординг-гид: человек + машина) | ✅ #116/#117; Слой 3 (LLM via **LM Studio**) — следом |
| 1. Per-seller коллекции (платформо-владеемые) | ✅ **CERTIFIED on testnet** — single + multi-seller (два продавца → две разные коллекции, оба NFT в своих, оба `paid`, on-chain match) |
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

### 0.3 обогащён + Копилот (2026-06-08)
- **0.3 агрегаты лицензий/скана** (#115) — `/status` теперь считает License NFT по
  `LICENSE_STATE` (через `License.sellerWallet`) и товары агента по `scan_status`
  (через `creator_id`). +4 теста.
- **Пробел C переосмыслен: надзор → Копилот равенства** (#116/#117). По Плану Императора
  Демиург = человек ИЛИ машина; доказательство онбординга — **автономность**, потому
  платформа не *надзирает*, а **ведёт** к ней одним мозгом, двумя равными лицами:
  - `deriveNextAction` (детерминированный, без LLM): nextStep → секция инструкций →
    **аффорданс** (точный API-вызов машине, UI-действие человеку, внешний prereq).
  - Машина: `nextAction` в `/agent/status` + `/instructions`. Человек:
    `GET /sellers/:wallet/onboarding` + карта-гид `OnboardingGuide.tsx` в Demiurge UI.
    Идентичное руководство людям и машинам — один путь.

### Осознанные отклонения (closed-with-notes)
Решено оператором; отклонения от буквы спеки, все в сторону безопаснее/проще:
1. **owner_verified → реальный Didit-KYC** (`kyc_status='approved'`), не ручной флаг без
   3rd-party. Усиление: настоящая верификация личности гейтит денежный путь.
2. **`products:write` без профиля → `409 NO_CREATOR_PROFILE`** (регистрация продавца
   сначала), не синтетический `creator_id`: нет инвентаря без подотчётного владельца.
3. **`/status` без read-scope + `skipKyc`** (читается до KYC), не `orders:read`:
   онбординг-агент видит свой прогресс до верификации.
4. **Онбординг-состояние выводится** из живого состояния (kyc/storage/listings/
   distribution), не хранится отдельными полями/коллекцией: единый источник истины.

### MCP-поверхность (продукт) — покрытие
`mcp-server/` (`tonforge-agent`) уже отдаёт 10 tools: `whoami`, `list/create/update_listing`,
`set/verify_distribution`, `list_orders`, `search_products`, `get_product`, `list_offers`.
**Примитивы Фазы 0 ещё НЕ выражены как MCP-tools (план):**
- `get_instructions` — онбординг-канал 0.1 (`GET /agent/instructions`).
- `get_status` — `/status` 0.3 + **Копилот-Lite `nextAction`** (пробел C). Одним tool
  агент видит прогресс и точный следующий шаг.
- `create_product` — черновик товара 0.2 (`POST /agent/products`).
- `assistant_help` — АИ-ассистент (ниже).

### АИ-Ассистент — Слой 3 (в MVP — **МОКАП**)
**MVP:** `assistant_help` (MCP-tool + `POST /api/v1/agent/help`) — **мокап**, по образцу
AML-консоли (#103). Возвращает **заземлённую детерминированную** структуру (`nextAction` +
релевантная секция инструкций + честная пометка `assistant: "mockup — LLM не подключён"`),
**без живой LLM**. Так MCP-поверхность уже несёт ассистент-tool, но не врёт о возможностях.

**Пост-MVP (активация):** подключить **локальную LLM через LM Studio** (OpenAI-совместимый
эндпоинт — **не Anthropic**): `LLM_BASE_URL` + `LLM_MODEL` (+ опц. `LLM_API_KEY`).
Заземление: корпус инструкций (context-stuff, малый доверенный) + live `/status`, **цитаты**
+ исполнимый `suggestedAction`. URL-gated: без конфига остаётся мокапом. Backend в Coolify
должен дотянуться до LM Studio (туннель/проброс с Терры).

**Фаза 0 — closed-with-notes.** Остаток MVP — выразить примитивы 0.1–0.3 + ассистент-мокап
как MCP-tools (поверхность продукта).

---

## Сингулярность MCP ↔ человек — реестр паритета (tech debt)

Цель Плана: **Демиург = человек ИЛИ машина, равные.** «Сингулярность» = паритет
способностей машины (MCP / Agent API) и человека (Demiurge UI). Ниже — что достигнуто
и где долг, по осям.

**Сделано в сессии 2026-06-08 (PR #91–#124):** кода-блокеры mainnet, P2-харднинг
(Цепь Маркова), тёмная материя тестов, AML-мокап, in-container ops + verified через
Appwrite MCP, Фаза 0 closed-with-notes, **Копилот-Lite** (#116/#117) и **сингулярность
A·B·C1·D1 закрыта** (ниже). Тесты ~536 → 642.

### A. Покрытие MCP-поверхности — ✅ закрыто (#121)
| # | tool | за ним |
|---|---|---|
| A1 | `get_instructions` ✅ | `GET /agent/instructions` (0.1) |
| A2 | `get_status` ✅ | `/status` + `nextAction` (0.3 / C) |
| A3 | `create_product` ✅ | `POST /agent/products` (0.2) |
| A4 | `assistant_help` ✅ | мокап `POST /agent/help` |
| + | `register_seller` (#122), `set_storage` (#123) ✅ | B1/B2 на MCP-поверхности |

### B. Самосуверенность машины — ✅ закрыто (#122 + #123)
| # | способность | статус |
|---|---|---|
| B1 | Само-регистрация продавца | ✅ `POST /agent/sellers/register` (#122) — wallet из токена, идемпотентно |
| B2 | BYOS-хранилище | ✅ `POST /agent/storage` (#123) — общий `saveSellerStorage`, AES-256-GCM, SSRF-guard |
| B3 | KYC-сессия | **намеренно** человек (KYA: подотчётный человек-владелец) |
| B4 | Asset-upload | **намеренно** — BYOS, не хостинг |
| B5 | Buyer-поток | **намеренно** — автономная покупка исключена (эскроу подписывает покупатель) |

Машина онбордится сама: `register_seller → set_storage → create_product → [человек: KYC] → продавать`.

### C. Паритет человека — ✅ закрыто
| # | способность | статус |
|---|---|---|
| C1 | Операционный мануал человеку в UI | ✅ `GET /operating-manual` + вкладка «Guide» в Demiurge UI (#124) — тот же мануал, что читает машина |
| — | `nextAction` структурно | ✅ #116/#117 |

### D. Ассистент (LLM-копилот)
| # | этап | статус |
|---|---|---|
| D1 | `assistant_help` мокап (оба лица) | ✅ #121 |
| D2 | LM Studio (локальная LLM, OpenAI-совместимо) | 🟡 **пост-MVP** — нужен `LLM_BASE_URL` + сеть с Терры |

### Статус сингулярности
**A · B · C1 · D1 — закрыты.** Машина и человек — равные Демиурги, один путь, одна
поверхность (MCP). Единственный осознанный человеческий рубеж — **KYC** (KYA-стандарт:
подотчётный человек-владелец). Остаётся лишь **D2** (живой LM Studio, пост-MVP).

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

## Аудит кодовой базы — 4 сервитора (2026-06-08)

Параллельная верификация (4 независимых агента) для укрепления монолитности перед mainnet.
**Подтверждённых P0 — нет ни у одного.** Ядро суверенно: один минтер под кластерным локом,
детерминированный деплой, уникальные индексы `uniq_order` → двойной минт и двойной
entitlement структурно невозможны; сеть server-pinned (клиентский `x-ton-network`
совещательный); авторизация агента берёт кошелёк **из токена, не из тела**; утечек
секретов нет; полный Vitest (src+backend) гейтит CI; `contractSchemas.opcodes.test.ts`
сверяет каждую `OP.*` с сырыми `.tact`-префиксами.

| Сервитор | Домен | Вердикт |
|---|---|---|
| I | Денежный путь | **needs-work** — счастливый путь верен, ветви отказа незрелы |
| II | Agent API / безопасность | **minor-gaps** — кросс-селлер герметичен |
| III | Здоровье кода / бэклог | **minor-gaps** |
| IV | Тесты / CI / покрытие | **minor-gaps → needs-work** на деньгах/агенте |

**Сводный вердикт:** монолит стоит в фундаменте (счастливый путь денег не теряется/не
двоится/не крадётся — доказано конструкцией + testnet Gate A/B). Облицовка путей отказа
**теперь положена по коду** — все три кода-блокера mainnet закрыты (ниже). Остаётся живая
testnet-сертификация контура возврата (Gate C, требует бродкаста — отдельный прогон).

**Блокеры mainnet (Gate C) — ✅ ЗАКРЫТЫ ПО КОДУ (PR #94, #95):**
1. ✅ **Контур возврата** — `oracleRefund()` упокоен; вместо невозможного оракул-возврата —
   buyer-claim через `RefundIfNotMinted` (buyer-only by design): новое состояние
   `refund_claimable`, GET/POST `/orders/:id/refund-claim`, settle-цикл → `refunded` +
   `finalizeOrderRefund`, кнопка «Вернуть средства» в библиотеке. Без правки контракта. **PR #95.**
   ⏳ Остаётся: живой testnet-E2E (fund → срыв минта → grace → claim → refunded) — для Варпа.
2. ✅ **Mainnet-форма адреса эскроу** — `computeEscrow` прокидывает network через чистый
   `renderEscrowAddress` (`testOnly: network==='testnet'`); +3 теста формы. **PR #94.**
3. ✅ **Глобал-коллекция fallback** — убран; коллекция листинга = единственный источник
   истины, заказ без коллекции отвергается `400 LISTING_NO_COLLECTION`. **PR #94.**

---

## Реестр скверны (hardening backlog)

**Изгнано (харднинг по аудиту 4 сервиторов — ветка `security-hardening`):**
- ✅ **Admin-секрет** (`commerceAdmin`) — non-constant-time `got !== need` → constant-time
  сравнение по sha256-дайджестам (`constantTimeHashEqual(hashToken(got), hashToken(need))`);
  ни значение, ни длина не утекают через тайминг. `backend/commerce/helpers.ts`.
- ✅ **CSV/формула-инъекция** в ledger-экспорте — все ячейки через `csvCell`
  (нейтрализация ведущих `= + - @ \t \r` + всегда quote+escape, чинит и латентный
  comma-shift). Новый `backend/utils/csv.ts` + 7 юнит-тестов. Вектор был **агент-усилен**:
  агент создаёт товары → `product_name` попадает в отчёт комплаенс-админа. `backend/routes/admin.ts`.
- ✅ **Admin-суброутер commerce** — добавлен `rateLimit` (`router.use('/admin', …)`, 120/15 мин,
  standard-headers); тормозит брутфорс секрета. Публичный `/config` не затронут (scope `/admin`).
  `backend/commerce/adminRoutes.ts`.
- ✅ **Нулевая лицензия** — хрупкий префиксный регекс `^EQAAAAA|^UQAAAAA` → **структурная**
  проверка нулевого account-hash (`Address.parse(addr).hash.equals(0)`), форма-независимая
  (mainnet EQ/UQ · testnet kQ/0Q · raw). Закрывает finalize-before-mint на testnet-форме нуля;
  непарсируемое → безопасно `wait`. +2 регресс-теста. `backend/commerce/mintWorker.ts`.

**Изгнано (кода-блокеры Gate C — PR #94, #95):**
- ✅ **Контур возврата** (PR #95) — мёртвый `oracleRefund()` удалён; buyer-claim refund
  (`refund_claimable` → claim → `refund_pending` → settle → `refunded` + заказ REFUNDED),
  без правки контракта. `refundClaim.ts`, `finalizeOrderRefund.ts`, `mintWorker`, фронт.
- ✅ **Mainnet-форма адреса эскроу** (PR #94) — `renderEscrowAddress(addr, network)`.
- ✅ **Глобал-fallback в создании заказа** (PR #94) — убран, `400 LISTING_NO_COLLECTION`.

**Изгнано (в ветке Фазы 0/1):**
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
- ✅ Мёртвое поле `purchaseSessions` (in-memory TonForge state) изгнано после удаления
  legacy-методов: интерфейс `PurchaseSession`, enum `PurchaseSessionState`, поле состояния
  и сид `demoData`. `PurchaseSessionId` сохранён (его держит `License`). tsc/тесты зелёные.
- ✅ Финализация order→PAID **унифицирована**: единственный handler `reconcileOrderAfterMint`
  (immediate из `tonforge/mintWorker` + fallback из `commerce/mintWorker` делегируют в него);
  дублёр `onMintConfirmed` удалён. Handler покрыт юнит-тестом (6 кейсов: идемпотентность
  already-PAID, entitlement-once, omit-fields, not-found, guards). Reconciler сохранён как
  страховка (primary+fallback — намеренно, не «одна сущность»).

**Изгнано (тёмная материя тестов + P2-харднинг + AML — PR #97–#104):**
- ✅ **Тёмная материя тестов** (С-IV) — ~536 → 606 тестов: `agentAuth` (#97, 11 кейсов:
  скоупы/импликация/**wallet-from-token**/санкции 451/KYC 403/`skipKyc`/auth-rate-limit) ·
  agent-хендлеры (#99, supertest: wallet-from-token на уровне handler, `NO_CREATOR_PROFILE`,
  `NOT_OWNER`) · payout-комплаенс `mintWorker` (#101, **AML/sanctions HOLD** перед
  TimeoutRelease) · golden-cell `buildMintLicensePayload` (#101, байт-лейаут) ·
  `provisionSellerCollection` gate+идемпотентность (#101). +`supertest` как devDep.
- ✅ **terminal-guard REFUNDED/CANCELLED** (#102) — поздний реплей не перезапишет терминальный заказ.
- ✅ **409-no-op конкурентных финализаторов** (#102) — `isUniqueViolation` вынесен в
  `domain/appwrite-helpers` (single source); entitlement+license insert → no-op на гонке.
- ✅ **`/search` rate-limit** (#102) — публичный поиск под per-IP лимитером (120/15 мин).
- ✅ **agent `collectionAddress` → `seller_collections`** (#104) — мягко-строго: deployed-коллекция
  обязана совпасть (`403 COLLECTION_MISMATCH`); без коллекции — пропуск (back-compat).
- ✅ **`TON_NETWORK` split-brain** (#98) — `onchain/config` делегирует в `resolveNetwork()`
  (единый источник); + `cdn.example.org` плейсхолдер → env `LICENSE_METADATA_BASE_URL`.
- ✅ **AML админ-консоль (мокап)** (#103) — `GET /admin/aml-config` + панель; провайдер не
  выбран, реестр кандидатов; `amlStatus/amlEnabled` покрыты. `amlbot.ts` уже был покрыт.

**Изгнано (Цепь Маркова P2 — PR #106–#109):**
- ✅ **Human-path `collectionAddress` binding** (#106) — soft-strict хелпер вынесен в
  `commerce/collectionBinding.ts` (single source) и применён в `listingRoutes` POST+PATCH;
  agent-путь импортирует тот же. +5 юнит-тестов.
- ✅ **Мёртвый order `mintAttempts`-cap изъят** (#107, С-I #4) — поле не инкрементилось, cap был
  мёртв; его «оживление» застрянило бы заказы с поздним эскроу. Реальный бюджет ретраев живёт на
  License (`tonforge/mintWorker`).
- ✅ **`/search` fallback ограничен** (#108, С-III) — деградированный скан ≤1000 свежих строк
  (вместо 5000); чистый матчер `filterProductsByQuery` + 6 тестов. Fulltext-индекс — на Терру.
- ✅ **Ledger null-rate** (#109, С-III) — при cold-отказе оракула пишется честный `null` (не
  сфабрикованный `0`); null = маркер re-rate. End-to-end (тип → CSV → UI) + 2 теста.

**Остаётся — за Вратами или запечатано:**
- 🔱 `escrow.tact` `RegisterLicense` не связывает лицензию с `self.collectionAddress` — он-чейн
  enforcement per-seller routing (**Фаза 2 — печать держится**).
- 🧪 Полный `mintWorker.processOne/processRefund` (mint→register→refund) — покрыт
  **testnet-сертификацией** (Gate A/B); чистые решения (`decideReconcileAction`,
  `decideRefundClaim`) + payout-комплаенс уже юнит-покрыты. Эффектную обвязку юнит-тестировать
  хрупко — оставлено за Вратами.

**Терра — астропатический наряд (ops, локальный Курсор):**
- 🛰️ `/search` fulltext-индекс на `legacy_products.name` (Appwrite) — снимет деградированный скан
  целиком (первичный путь `Query.search` перестанет падать в fallback).
- 🛰️ `TON_USD_FALLBACK` — задать env (resilient + санити-бунд) → закрывает окно ledger null-rate
  у источника.
- 🛰️ Ledger re-rate back-fill — джоба по `ton_usd_rate IS NULL` (маркер готов после #109).
- 🛰️ Прод-провижн: `npm run provision-core` + `provision:commerce` на прод-Appwrite как часть деплоя.

---

## Врата (certification gates) до Хранилища (мерж в `main`)

- **Gate A — testnet single-seller**: ✅ **PASS** (E2E 2026-06-08). `order.state=paid`,
  NFT заминчен, `onChain.collectionMatch=true` (NFT в per-seller коллекции). Поток:
  `confirm → ensureLicenseForOrder → tonforge/mintWorker → mint → registerLicense →
  reconcileOrderAfterMint → order=paid + entitlement`. Финализация: **немедленная**
  (`reconcileOrderAfterMint` из tonforge-воркера, idempotent) + **поллинг-фолбэк**
  (`commerce/mintWorker` reconciler по `PENDING_PAYMENT`) — primary+fallback, не двойственность.
- **Gate B — testnet multi-seller (решающий)**: ✅ **PASS** (E2E 2026-06-08, ~316с). Два
  продавца, **две РАЗНЫЕ коллекции** (`kQA9mT1B…` / `kQBjCBYles9…`), NFT каждого — в **своей**,
  оба order `paid`, on-chain match ✓✓. **Per-seller routing certified.** Коммит `fe73837`.
- **Gate C — mainnet-готовность** (ОТДЕЛЬНО от мержа — это ops-активация mainnet, не код):
  `docs/commerce-license-smoke-checklist.md §6` (treasury→multisig, oracle ≥50 TON, алерты
  на `mint_failed`/`refund_pending`, `REFUND_AFTER_MS`=1ч, резервный ручной refund).
  **Код-блокеры до денег на mainnet (аудит 2026-06-08): ✅ ВСЕ ЗАКРЫТЫ** —
  (1) контур возврата (PR #95), (2) mainnet-форма адреса (PR #94), (3) глобал-fallback
  (PR #94). Остаётся живой testnet-E2E контура возврата + промотирование
  refund/payout/negative testnet-чеков в сертификацию (требуют бродкаста — Варп/Терра).

**Решение Хранителя:** **Gate A + B пройдены — Врата мержа открыты.** Денежный путь и
per-seller routing **certified на testnet** (single + multi-seller). Фаза 0 live, статика
зелена, ересь изгнана, денежный путь унифицирован и под Испытанием. Свитки готовы войти в
Хранилище (`main`). Gate C — это последующая ops-активация mainnet (`TON_NETWORK=mainnet`),
не блокер мержа кода: код работает на testnet-конфиге, пока техножрец не переключит сеть.
