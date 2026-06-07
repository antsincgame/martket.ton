# Аудит проекта TonForge / martket.ton

> Глубокий технический аудит: ошибки и уязвимости, качество разработки,
> рыночная ценность и направление, идеи синергии «маркет»-приложений.
> Дата: 2026-06-06. Метод: статический анализ всего репозитория + реальный
> прогон typecheck / lint / unit-тестов. Схема Appwrite реконструирована из
> `scripts/provision-*.mjs` (DDL базы).

## Легенда severity

| Тег | Значение |
|-----|----------|
| 🔴 **P0** | Критично: дыра в безопасности / потеря денег. Чинить до публичного запуска. |
| 🟠 **P1** | Высокий риск: достоверность данных, обход контролей, демо-хвосты в проде. |
| 🟡 **P2** | Средний: тех-долг, идемпотентность, отчётность, цепочка поставок. |
| ⚪ **P3** | Низкий: косметика, мелкий рефактор, latent-footgun. |

---

## 0. Объективные сигналы качества (запущены реально)

| Проверка | Результат |
|----------|-----------|
| Frontend `tsc` (strict) | ✅ 0 ошибок |
| Backend `tsc` (strict) | ✅ 0 ошибок |
| ESLint | ✅ 0 ошибок, 7 warnings (`react-refresh`, безобидные) |
| Vitest (frontend + backend) | ✅ 481 тест / 48 файлов — все зелёные |
| Объём | ~28k строк фронт + ~18k бэк + контракты на Tact |
| История | 81 коммит, активная команда |
| CI/CD | `ci` + `codeql` + `gitleaks` + `security` + `e2e` |

**Итоговая оценка качества разработки: 7/10.** Высокая инженерная культура
(strict TS, почти ноль `any`, серьёзный security-baseline, on-chain контракты с
тестами, 481 unit-тест). Минусуют: несколько P0/P1-дыр, демо/seed-данные в
продакшен-путях и фронтовый разнобой в работе с данными.

---

## 1. Чек-лист задач (для трекинга)

### 🔴 P0 — до публичного запуска
- [x] **KYC-webhook Didit обходится без аутентификации** → ✅ fail-closed: подпись теперь обязательна (нет заголовка → 401) и пустой `DIDIT_WEBHOOK_SECRET` → отказ. Опц. усиление (сверка через `fetchDiditSessionResult`) — осталось. _(§2.1)_
- [x] **Сеть выбирается клиентским заголовком `x-ton-network`** → ✅ запинено серверно к `TON_NETWORK`; клиентский заголовок/`?network` теперь advisory-only (игнорируется, на mismatch — warn). _(§2.2)_

### 🟠 P1 — достоверность и контроли
- [ ] **Фейковый seed-каталог всегда подмешивается в живую витрину** → убрать merge, seed только как fallback при пустой БД; снять demo-бейджи с публичных страниц. _(§2.3)_
- [ ] **Sanctions-список пуст** (`entries: []`) → наполнить/автоматизировать или убрать заявление о скрининге. _(§2.4)_
- [ ] **AML fail-open и выключен по умолчанию** → осознанно зафиксировать политику + алертинг на «тихий» отказ. _(§2.5)_
- [ ] **Дубль-mint + `cdn.example.org` в метаданных NFT** → `lastMintAttemptAt` guard + реальный `licenseContentUri`. _(§2.6)_

### 🟡 P2 — тех-долг / отчётность
- [ ] **Двойная запись в ledger при повторном `confirm` (v4)** → идемпотентность по `(orderId, entryType)`. _(§2.7)_
- [ ] **Несоответствие «per-listing collection» docs vs runtime** → привести политику/доки к факту или реализовать per-listing коллекции. _(§2.8)_
- [ ] **Payouts — заглушка, путает USD и TON** → разнести валюты, пометить как not-implemented в UI. _(§2.9)_
- [ ] **Demo-treasury fallback в `tonforge/demoData.ts`** → стартовая валидация, отклонять demo-адрес в проде. _(§2.9)_
- [ ] **`backend/package-lock.json` тянет `registry.npmmirror.com`** → перегенерировать на `registry.npmjs.org`. _(§2.9)_
- [ ] **High-severity CVE в прод-зависимостях бэкенда** (CI `npm audit --audit-level=high` красный): `axios` через `@ton/ton@16.2.4`, `fast-xml-builder` через `@aws-sdk`. Отдельный remediation-PR (bump/`overrides`). _(§2.9)_
- [ ] **Судьба legacy `tonforge/*` (`@deprecated`, in-memory, два mint-воркера)** → удалить или довести. _(§2.9)_

### ⚪ P3 — мелочи
- [ ] Latent footgun: формулы split в `money.ts` и `escrow.ts:resolveAmountSplit` не взаимно-обратны; удалить deprecated `applyFeeBps`. _(§2.9)_
- [ ] Фронт: перевести публичные/админ-`fetch` на React Query; разбить god-компоненты. _(§3)_

---

## 2. Находки (с файлами и строками)

### 2.1 🔴 P0 — KYC-webhook Didit обходится без аутентификации
**`backend/commerce/listingRoutes.ts:283-296`, `backend/commerce/handlers/diditIntegration.ts:126-148`**

Маршрут `POST /api/v1/commerce/sellers/kyc/webhook`:
- смонтирован **без `apiRequireAuth`**;
- подпись проверяется только `if (signature && !verifyDiditWebhookSignature(...))` —
  **если не прислать заголовок `x-webhook-signature`, проверка пропускается**;
- `verifyDiditWebhookSignature()` возвращает `true`, когда `DIDIT_WEBHOOK_SECRET` пуст;
- тело (`vendor_data` = кошелёк, `status: "Approved"`) принимается на доверии и
  пишет `kyc_status: 'approved'` в `seller_profiles`.

**Эксплойт:** `POST .../kyc/webhook` с телом
`{"session_id":"x","status":"Approved","vendor_data":"<кошелёк>"}` **без подписи**
→ self-approve seller-KYC без единого документа. Весь смысл Didit обнуляется.

**Фикс:** отклонять при отсутствии подписи; fail-**closed** при пустом секрете;
не доверять телу вебхука — брать статус из `fetchDiditSessionResult(session_id)`
(функция уже реализована в том же модуле).

> ✅ **Исправлено:** `listingRoutes.ts` теперь `if (!signature || !verify(...)) → 401`;
> `verifyDiditWebhookSignature` читает `DIDIT_WEBHOOK_SECRET` напрямую и при пустом
> секрете/пустой подписи возвращает `false` (fail-closed). Тест:
> `diditIntegration.test.ts`. Осталось как доп. усиление: сверка статуса через
> `fetchDiditSessionResult` вместо доверия телу.

### 2.2 🔴 P0/P1 — Сеть выбирается клиентским заголовком
**`backend/config/network.ts:66-72` (resolve) и `:24-37` (configs)**

`resolveNetwork(req)` берёт сеть из заголовка `x-ton-network` / `?network=testnet`.
И `create`, и `confirm` ордера резолвят сеть из запроса. По умолчанию testnet-конфиг
**наследует тот же `TREASURY_WALLET_ADDRESS` и `COLLECTION_ADDRESS`**, меняется лишь
`tonapiBase = testnet.tonapi.io`. Каталог/листинги — общие (одна БД `marketplace`).

**Эксплойт:** покупатель шлёт `x-ton-network: testnet`, платит почти-бесплатными
testnet-TON, `verifyPaymentToEscrow` валидирует оплату через `testnet.tonapi.io` →
проходит → выдаётся entitlement и доступ к скачиванию **реального** товара.

**Фикс:** пинить сеть на сервере (одна сеть на деплой через env), не доверять
заголовку; либо физически разделять treasury/коллекции/каталог по сетям.

> ✅ **Исправлено:** `resolveNetwork()` теперь возвращает сеть из `TON_NETWORK`
> (тот же источник, что и `tonforge/onchain/config.ts`); клиентский
> `x-ton-network`/`?network` — advisory-only (на mismatch — `logger.warn`, сеть
> сервера побеждает). `resolveNetworkConfig(req)` без изменений в сигнатуре. Тест:
> `network.test.ts` (`resolveNetwork (server-pinned)`). Операторам: задать
> `TON_NETWORK` явно, чтобы commerce и mint-воркер совпадали.

### 2.3 🟠 P1 — Фейковый seed-каталог в живой витрине
**`src/domain/marketplace/marketplaceRemote.ts:60-88`**

`mergeWithSeed()` добавляет встроенный демо-каталог (`seed.ts`: «Karma Tracker»,
«Neon Arena», «AI Wisdom Oracle» — стоковые картинки, выдуманные рейтинги) к
реальным товарам Appwrite **даже когда Appwrite настроен и вернул данные**, и
помечает `source: 'appwrite'`. Они рендерятся как настоящие, покупаемые товары.
Дополнительно: `<DemoUiBadge>` и текст «demonstration data for investor review» на
публичных путях (`src/pages/demiurge/OverviewSection.tsx:79`, `ProductPage.tsx`,
`DeveloperPage.tsx`).

**Фикс:** убрать merge-ветку для прода (seed только при пустой БД), снять demo-бейджи
с публичных страниц.

### 2.4 🟠 P1 — Sanctions-screening пуст
**`backend/sanctions/blocklist.json` → `"entries": []`**, `refresh-sanctions.mjs` — `(TODO)`.
`screenWallet()` никого не блокирует, хотя заявлен OFAC/EU-скрининг. Механизм
(нормализация в `0:hex`, авто-refresh-хук в `sanctions/screen.ts`) готов — нужны
источник данных и наполнение.

### 2.5 🟠 P1 — AML fail-open и выключен по умолчанию
**`backend/aml/amlbot.ts:209-253`** — без `AMLBOT_ACCESS_ID` всё проходит; любая
ошибка провайдера/сети/парсинга → `ok:true`. Сознательный выбор доступности, но без
алертинга «тихий» отказ = нулевая защита. Для регулируемой деятельности фиксировать
политику осознанно (и добавить мониторинг health AML-провайдера).

### 2.6 🟠 P1 — Дубль-mint + placeholder-URI в NFT
**`backend/commerce/mintWorker.ts:194-209`, `backend/commerce/orderRoutes.ts:115`**

- `licenseContentUri` по умолчанию = `https://cdn.example.org/license/${orderId}.json`
  — несуществующий хост зашивается в TEP-64 метаданные NFT, если у листинга не задан
  `licenseContentUri`.
- Воркер инкрементит `mintAttempts` **после** отправки `MintLicense`, `queryId =
  Date.now()` каждый раз, без «mint in flight» guard: если on-chain петля
  (mint → deploy LicenseItem → RegisterLicense) не успела за 30-секундный тик,
  отправляется ещё один mint → коллекция деплоит дубль soulbound-NFT и жжёт газ
  оракула. Первый зарегистрировавшийся выигрывает, остальные — сироты.

**Фикс:** хранить `lastMintAttemptAt`, пропускать повтор внутри grace-окна; дефолтный
URI брать из реального CDN/листинга, иначе не минтить.

### 2.7 🟡 P2 — Двойная запись в ledger при повторном `confirm` (v4)
**`backend/commerce/orderRoutes.ts:212-349`** — в v4 после `confirm` ордер остаётся
`PENDING_PAYMENT` (PAID ставит воркер), поэтому ранний guard
`state !== PENDING_PAYMENT` не ловит повтор, и `recordLedgerEntry({entryType:
'escrow_fund'})` пишется снова. `ensureLicenseForOrder` идемпотентен (unique по
`orderId`), а ledger — нет.

**Фикс:** идемпотентность ledger по `(refType, refId, entryType)` или флаг на ордере.

### 2.8 🟡 P2 — «Per-listing collection» docs vs runtime
Политика (PROJECT.md, раздел NFT-mint bridge) и БД требуют у листинга
`collection_address`, но escrow и mint фактически используют **платформенную**
коллекцию из `network.ts` (`netCfg.collectionAddress`); `listing.collection_address`
идёт только в DB-запись лицензии и gate активации. «Своя коллекция у каждого
приложения» пока не реализована. Не баг безопасности — рассинхрон docs/реализации.

### 2.9 🟡 P2 / ⚪ P3 — Прочее
- **Payouts — заглушка:** `backend/core/payoutsRepository.ts` — «on-chain payout-цикл
  ещё не реализован»; `amountTon` присваивается из `price_usd` → USD складываются в
  поле с именем TON (`lifetimeTon`/`thisMonthTon` врут на курс).
- **Demo-treasury fallback:** `backend/tonforge/demoData.ts` при отсутствии
  `TREASURY_WALLET_ADDRESS` поднимает состояние с `EQDemoTreasuryWallet…`. Legacy
  `tonforge/*` весь `@deprecated`, но смонтирован (`/api/tonforge`); существуют **два**
  mint-воркера (`commerce/mintWorker.ts` без seller-compliance-гейта vs
  `tonforge/mintWorker.ts` с гейтом).
- **Цепочка поставок (2 проблемы):**
  1. `backend/package-lock.json` ссылается на `registry.npmmirror.com` (73 ссылки)
     — риск воспроизводимости; перегенерировать lock на официальном реестре.
  2. CI-job `npm audit · backend` (workflow `security.yml`, гейт `--audit-level=high`)
     **красный** — 15 уязвимостей (12 moderate, 3 high) в дереве бэкенда. High-severity
     сидят в **прод-зависимостях**: `axios` (множество CVE: prototype-pollution,
     SSRF/NO_PROXY-bypass, ReDoS) — транзитивно через `@ton/ton@16.2.3-16.2.4`;
     `fast-xml-builder`/`fast-xml-parser` — через `@aws-sdk`. Moderate: `ip-address`
     (через `express-rate-limit`/`geoip-lite`), `qs` (через `express`/`body-parser`),
     `uuid` (через `svix`→`resend`), `brace-expansion`. Падение **предсуществующее**
     (не вызвано docs-изменениями) — advisory-база npm пополнилась новыми CVE поверх
     зафиксированного lock-файла. Лечится bump'ом/`overrides` отдельным PR с прогоном
     тестов; в CI намеренно нет авто-`npm audit fix` («human decision»).
- **Latent footgun (НЕ активный баг):** `money.ts` (fee «сверху») и
  `escrow.ts:resolveAmountSplit` (fee «изнутри») не взаимно-обратны. Живой путь
  безопасен — `orderRoutes` передаёт явные `seller`+`fee` и срабатывает проверка
  инварианта. Удалить deprecated `applyFeeBps` (экспортируется и тестируется).
- **Не реализовано (заявлено как roadmap):** Jetton-платежи (`COMMERCE_JETTON_MASTER`
  «not yet»), trustless init-hash (`contracts/src/appCollection.tact:50` TODO — сейчас
  mint через оракул-middleman), мультисиг оракула.

---

## 3. Качество разработки

**Сильное:** strict TS на обоих слоях, почти ноль `any`, оба typecheck зелёные;
серверный security-baseline (hardened CSP без `unsafe-inline` в script-src, helmet,
зонный rate-limit, origin-guard, health без раскрытия инфраструктуры, graceful
shutdown, distributed lock через unique-index, TTL-cron); контракты на Tact
(idempotent `RegisterLicense`, refund-петля, emergency-refund, TEP-62, unit-тесты);
481 тест, CodeQL/gitleaks/dependabot, CODEOWNERS, SECURITY.md.

**Слабое:** фронтенд непоследователен — React Query только в кабинете
(`sessionQueries`), публичные страницы, checkout и **вся админка** хэндлят данные
руками (`fetch`+`useState`+`useEffect`, ~21 место) → god-компоненты
(`ComplianceLedger.tsx` 865 строк, `InboxPanel.tsx` 685, `ResendSettings.tsx` 744) и
`eslint-disable exhaustive-deps`-мины. Demo/seed-данные в продакшен-путях. Legacy
`tonforge/*` сосуществует с новым commerce.

**Главный рефактор:** удалить seed-merge и перевести все ручные `fetch`/`useState`/
`useEffect` на существующую инфраструктуру React Query — это разом убирает demo-утечку,
boilerplate и suppression'ы, и ужимает админ-god-компоненты.

---

## 4. Рыночная ценность и направление

**Направление сильное и дифференцированное.** Устойчивые преимущества (это и есть актив):

1. **Egress = 0 через BYOS** — структурно дешевле классических сторов (Gumroad/itch.io
   платят за трафик; вы — нет). Устойчивое ценовое преимущество.
2. **Лицензия = soulbound-NFT + on-chain escrow с trial/refund** — программируемая
   верификация владения и авто-возврат; у Web2-сторов этого нет.
3. **Комплаенс-рельсы (KYC/AML/sanctions/AV)** как переиспользуемый слой — ров для
   выхода в «легальную» нишу.
4. **Agent API** (scoped PAT) — задел под agentic commerce, попадание в тренд 2025-2026.

**Риски — не технологические, а GTM:** зависимость от ликвидности TON/Telegram,
регуляторика, «пустые полки» (сейчас витрина наполнена fake-seed). Главная задача —
первые 50 настоящих продавцов с настоящими товарами.

---

## 5. Идеи синергии «маркет»-приложений

Принцип: у вас уже есть переиспользуемые **примитивы** — *escrow*, *soulbound-лицензия
с trial*, *BYOS-доставка*, *agent-токены*, *compliance-гейты*, *ledger*. Каждая идея —
новая вертикаль на тех же рельсах, не новое приложение.

**A. На «escrow + лицензия + trial»:**
- SaaS/подписки и API-ключи как лицензии (trial встроен).
- Маркет ИИ-артефактов: промпты, fine-tune-веса, датасеты, MCP-серверы, агенты.
- Цифровые услуги/фриланс с escrow-гарантией (релиз по `ConfirmDelivery`, спор → burn/refund).

**B. На «BYOS + verify + scan»:**
- Маркет модов/ассетов/плагинов (Unity/Unreal/Figma/VST) — большие файлы у автора.
- B2B-дистрибуция приватного софта с manifest-drift-детектом (уже есть).

**C. На «agent-токены / Agent API»:**
- «Shopify для ИИ-агентов»: продавец-агент сам создаёт листинги/ставит цену/отвечает на
  заказы. Сделать **MCP-сервер вашего маркета** — главный канал дистрибуции под ИИ.
- Agent-to-agent закупки (покупатель-агент через API).

**D. На «compliance + ledger»:**
- Compliance-as-a-Service для других TON-dApp (слой почти готов внутри).
- Royalties/N-way splits (escrow уже делит seller/treasury → добавить соавторов/реферал).

**Один движок + тонкие вертикали** (категория, поля листинга, тип доставки). Архитектура
к этому уже располагает (`catalogProductId`, `deliveryType`, `distribution_kind`).

---

## 6. Рекомендуемый порядок работ

1. **Спринт «безопасность/достоверность»** (до публичного запуска): §2.1, §2.2, §2.3, §2.6, §2.4.
2. **Спринт «достоверность данных»**: §2.7, §2.9 (payouts USD/TON, lock npmjs, судьба legacy).
3. **Спринт «фронт-консолидация»**: §3 (React Query, god-компоненты).

---

> Замечание по инструментам: Appwrite-MCP не использовался — сетевая политика
> web-окружения разрешает только пакетные реестры. Схема Appwrite реконструирована из
> `scripts/provision-appwrite.mjs`, `provision-commerce.mjs`, `provision-core.mjs`.
> Для прямого доступа к Appwrite-MCP запускайте Claude Code локально или выберите
> сетевую политику с доступом к `cloud.appwrite.io` и MCP-хосту.
