# Модульная декомпозиция код-ревью — TonForge / martket.ton

> Продолжение `docs/AUDIT.md`: систематический проход по **каждому кластеру**
> кодовой базы. Метод: чтение исходников + 4 параллельных целевых ревью +
> личная верификация всех находок уровня High/Critical (помечены ✓).
> Дата: 2026-06-06. Опкоды контрактов сверены с `contracts/src/*.tact`.

## Легенда
🔴 P0 Critical · 🟠 P1 High · 🟡 P2 Medium · ⚪ P3 Low · ✅ чисто · ✓ верифицировано лично

---

## 1. Карта модулей (охват и вердикт)

| # | Кластер | Файлы | Худшая severity | Вердикт |
|---|---------|-------|-----------------|---------|
| 3.1 | **Контракты ↔ on-chain драйверы** | `contracts/src/*.tact`, `backend/tonforge/onchain/*`, `commerce/escrow.ts`, `mintSigner.ts` | 🔴 P0 | **Опкод-дрифт: live-платёж сломан при включении on-chain** |
| 3.2 | Commerce: деньги/escrow/верификация | `commerce/orderRoutes,escrow,money,tonVerify,ttlOrders,distributedLock,mintWorker` | 🔴 P0¹ | Логика зрелая, но верификация платежа «рыхлая», есть орфан-escrow |
| 3.3 | Core-репозитории + REST routes | `core/*`, `routes/*`, `middleware/auth` | 🔴 P0 | Authz хорошая; PII-утечка + отсутствие unique-индексов |
| 3.4 | Storage / BYOS / distribution / scan | `r2/*`, `distribution/*`, `scan/*`, `commerce/{storage,distribution,scan}Routes` | 🟠 P1 | Крипто/quarantine сильные; **SSRF через accountId** |
| 3.5 | Security middleware / infra | `middleware/{mahakala,validate,requestLogger,requestId,asyncHandler}`, `server.ts` | 🟡 P2 | Заголовки правильные; «integrity-check» — театр; PII в логах |
| 3.6 | Email (Resend) / OG-SSR | `resend/routes.js`, `og/handler.js` | 🟡 P2 | Webhook сделан **правильно** (fail-closed); plain-JS вне typecheck |
| 3.7 | Frontend data-layer + checkout + admin | `src/lib/*`, `contexts/*`, `checkout/*`, `components/admin/*` | 🟠 P1 | React Query непоследователен; float-математика TON; fee-фолбэк |

¹ P0 этого кластера — следствие 3.1 (escrow-опкод), сама commerce-логика — P1/P2.

---

## 2. Новые находки по приоритету (сверх `AUDIT.md`)

| Severity | Находка | Файл:строка | ✓ |
|----------|---------|-------------|---|
| 🔴 P0 | **Опкод-дрифт контракт↔бэкенд** — 5 escrow-опкодов в бэкенде ≠ `.tact`; live PayEscrow покупателя уйдёт на несуществующий опкод → escrow не фондируется | `tonforge/onchain/contractSchemas.ts:35-40` vs `contracts/src/escrow.tact:5-9` | ✓ |
| 🔴 P0 | **Нет unique-индексов на `purchases`** (`tx_hash`, `user_id+product_id` — оба `Key`) → гонка double-purchase / replay tx_hash | `scripts/provision-demiurge.mjs:91-97`, `core/purchaseRepository.ts` | ✓ |
| 🟠 P1 | **PII/IDOR: `GET /profiles/by-ton/:ton`** отдаёт полный профиль (email, ФИО, ДР, страна, город) любому залогиненному | `routes/profile.ts:152-163` | ✓ |
| 🟠 P1 | **SSRF через `accountId`** — блоклист только в `custom`-ветке; `accountId` без валидации хоста → fetch на внутренний/чужой хост | `commerce/storageRoutes.ts:42-53`, `validation.ts:90`, `r2/devClient.ts` | ✓ |
| 🟠 P1 | **USD/TON путаница в payouts** — `amountTon = price_usd`; все TON-агрегаты врут на курс | `core/payoutsRepository.ts:55` | ✓ |
| 🟠 P1 | **JWT-превью + email в логах** (`[AUTH_AUDIT_BE]` на каждый запрос, info/warn) | `middleware/auth.ts:80-94` | ✓ |
| 🟠 P1 | **Legacy `confirmPurchaseSession` минтит без верификации платежа** (txHash опционален) — любой владелец кошелька минтит лицензию бесплатно при включённом on-chain | `tonforge/service.ts:272-314` (смонтирован `/api/tonforge`) | ✓ |
| 🟠 P1 | **Item data-layout дрифт** — `buildItemDataCell` кладёт `burnDeadline` перед `content` и без `registered:Bool` → `computeItemAddress` даёт неверный адрес | `contractSchemas.ts:113-124` vs `licenseItem.tact:54-83` | ✓ |
| 🟡 P2 | Модератор может править **любые** контент-поля чужого продукта (не только статус) | `routes/products.ts:187-196` | ✓ |
| 🟡 P2 | `searchProducts` при ошибке fulltext падает в полный скан коллекции (DoS-усилитель) | `core/productRepository.ts:179-199` | |
| 🟡 P2 | CSV-инъекция в экспорте леджера (поля без экранирования/`=+`-формулы) | `routes/admin.ts:540-562` | |
| 🟡 P2 | `verifyPaymentToEscrow` не проверяет op/`state==FUNDED`/bounce — оптимистичный `confirm` (бэкстоп — on-chain проверка воркера) | `commerce/tonVerify.ts:232-281` | ✓ |
| 🟡 P2 | Орфан-escrow: профинансирован, но `confirm` не записал `tonTxHash` → через 2ч `ttlOrders` отменяет ордер → воркер больше не подхватит | `commerce/ttlOrders.ts:35-41` | ✓ |
| 🟡 P2 | Два mint-воркера (commerce + tonforge) могут минтить один ордер; у commerce-воркера нет distributed-lock (только process-local `running`) | `commerce/mintWorker.ts:43` vs `tonforge/mintWorker.ts` | ✓ |
| 🟡 P2 | `support/tickets` без `validateBody` (свободные `category`/`priority` мимо enum) | `routes/support.ts:12-37` | |
| 🟡 P2 | payouts: `limit` применяется **на чанк** из 100 id → фактический лимит `limit×ceil(n/100)` | `core/payoutsRepository.ts:76-88` | |
| 🟡 P2 | Hardcoded `1500` bps fee-фолбэк показывается покупателю до прихода ордера | `checkout/CommerceCheckout.tsx:241-248` | |
| 🟡 P2 | Float-математика TON (`Number(raw)/1e9`) теряет точность >9M TON; расходится с BigInt-путём в `lib/api.ts` | `admin/ComplianceLedger.tsx:88`, `checkout/CommerceCheckout.tsx:375` | |
| 🟡 P2 | Worker буферизует весь quarantine-объект в RAM (до/свыше 100MB × batch) | `scan/worker.ts:318-330` | ✓ |
| ⚪ P3 | `extractMsgHash` хэширует external-message BOC, а не tx-hash — но бэкенд v4 **игнорирует** клиентский txHash → инертно | `checkout/CommerceCheckout.tsx:350-360` | ✓ |
| ⚪ P3 | Mahakala «integrity self-check» тавтологичен (хэш той же in-memory строки) → театр | `middleware/mahakala.ts:42-47` | ✓ |
| ⚪ P3 | `ledgerService` пишет `ton_usd_rate=0` при сбое оракула (плохие данные) | `core/ledgerService.ts:114` | |
| ⚪ P3 | `/admin/categories` POST/DELETE — no-op, но отвечает успехом (ложный контракт API) | `routes/admin.ts:421-478` | |
| ⚪ P3 | `repo` regex допускает `..` без `encodeURIComponent`; CRLF в R2 `ResponseContentDisposition` | `distribution/manifest.ts:31`, `sources/r2.ts:61` | |
| ⚪ P3 | Inbound-email HTML рендерится в `<iframe sandbox="" srcDoc>` (sandbox пустой — ок, но контент чужой) | `admin/InboxPanel.tsx:511` | |

---

## 3. Детально по кластерам

### 3.1 Контракты ↔ on-chain драйверы — 🔴 ГЛАВНЫЙ РИСК

**Опкод-дрифт (P0, ✓).** `escrow.tact` объявляет явные опкоды
(`message(0xd2e5b971) PayEscrow`, `0x45dfb5a1`, `0x7f8c9a12`, `0x70e30189`,
`0x9b3c2d45`). Бэкенд (`contractSchemas.ts:35-40`) использует **другие** значения
(`0xcddea230`, `0xf4a8bfa0`, `0x19c74777`, `0x70db9989`, `0x7e083215`) — это
авто-опкоды, которые Tact генерирует, когда опкод **не** задан явно. Похоже,
`.tact` позже перевели на явные опкоды, а бэкенд-билдеры не обновили. Живой
v4-платёж покупателя строится из `buildPayEscrowPayload()` (`escrow.ts:195`,
опкод `0xcddea230`) → при escrow, скомпилированном из текущего `.tact`,
сообщение уйдёт на несуществующий receiver и сбаунсится → **escrow никогда не
переходит в FUNDED, ни один ордер не завершается**. Не ловится тестами (они
используют типизированные Tact-`$$type`-обёртки, минуя ручные билдеры);
`contracts/build/*.md`, на которые ссылается комментарий «Verified against»,
**в репозитории отсутствуют**. _Чинить:_ синхронизировать `contractSchemas.ts`/
`escrow.ts` с явными опкодами `.tact` + assert опкод-хэшей в CI; убрать
выдуманный `ORACLE_REFUND (0xbf21e1ee)` и oracle-`RegisterLicense` (нет receiver:
escrow требует `sender()==msg.licenseAddress`).

**Item-layout дрифт (P1, ✓).** `buildItemDataCell` (`contractSchemas.ts:113-124`)
сериализует `…transferLimit(8), transfers(8), burnDeadline(32), content(ref)`, а
`licenseItem.tact` хранит `…transfers(8), content(ref), burnDeadline(32),
registered(Bool)` → `computeItemAddress` вычисляет неверный адрес (затрагивает
tonforge-воркер, который опрашивает item; commerce-воркер использует
`escrow.license_address` и не страдает).

**Legacy mint без оплаты (P1, ✓).** `tonforge/service.ts:272-314`
`confirmPurchaseSession` при `onchain.enabled && app.collectionAddress` вызывает
реальный `mintLicense()` с **неверифицированным** `txHash` → бесплатный минт.
Путь смонтирован (`/api/tonforge`), хотя помечен `@deprecated`.

**Хорошее:** ключи (`ORACLE_MNEMONIC`/`COLLECTION_OWNER_MNEMONIC`) только в env и
module-cache, **не логируются** (логируются лишь derived-адреса). Сами `.tact`
зрелые, тесты покрывают весь lifecycle (pay→mint→burn→refund, timeout,
soulbound, авторизация) — но **тесты обходят ручные билдеры**, из-за чего дрифт
невидим CI.

### 3.2 Commerce: деньги / escrow / верификация / конкурентность

- **`tonVerify.ts` (P2, ✓):** `verifyPaymentToEscrow` принимает любой входящий tx
  `source==buyer && value>=expected`, без проверки op-кода, `state==FUNDED` и
  compute-phase/bounce. Бэкстоп — on-chain проверка `state===1` в mint-воркере, но
  `confirm` отвечает оптимистично. Уникальность escrow-адреса per-order ограничивает
  cross-order replay.
- **`ttlOrders.ts` (P2, ✓):** орфан-escrow при пропущенном `confirm` (см. таблицу).
  _Чинить:_ перед отменой проверять on-chain state escrow.
- **`distributedLock.ts` (✅, нюанс P3):** грамотный атомарный захват через
  unique-index, осознанная защита от TOCTOU при краже протухшего лока; нет
  fencing-токена/продления лиза → цикл дольше TTL = два воркера (mitigation —
  щедрый TTL). Commerce-воркер этот лок **не использует** (только process-local
  `running`) — отсюда риск дубль-минта при горизонтальном масштабировании.
- **`money.ts` (✅):** строковая nano-математика корректна; `applyFeeBps`
  (deprecated) и расхождение с `escrow.resolveAmountSplit` — латентный footgun
  (см. `AUDIT.md §2.9`).

### 3.3 Core-репозитории + REST routes

- **PII/IDOR `/profiles/by-ton/:ton` (P1, ✓)** и **отсутствие unique-индексов на
  `purchases` (P0, ✓)** — см. таблицу; самые важные в кластере.
- **`payoutsRepository` USD/TON (P1, ✓)** и **limit-per-chunk (P2)**.
- **`auth.ts` (P1, ✓):** `[AUTH_AUDIT_BE]` логирует `$id`, email и превью JWT
  (`token.slice(0,20)…`) на каждый запрос — PII/секрет в логах; должно быть
  debug-gated, токен — никогда.
- **`products.ts` (P2, ✓):** модератор правит любые контент-поля чужого продукта.
- **`productRepository.searchProducts` (P2):** fallback в полный скан коллекции.
- **`admin.ts` (P2/P3):** CSV-инъекция в экспорте; `/categories` POST/DELETE — no-op.
- **`statsRepository`/`ledgerService` (P3):** gross-spend как revenue; `ton_usd_rate=0`
  при сбое оракула.
- **Хорошее:** authz централизована (`resolveProfile`/`require*`), `user_id` берётся
  из `req.profile` (не из body), Appwrite-Query параметризованы (нет инъекции),
  unique-индексы на `profiles`/`email`/email-коллекциях есть. Чисто:
  `constants`, `generateId` (128-bit), `db`, `repository`, `auditRepository`,
  `supportRepository`, email-репозитории.

### 3.4 Storage / BYOS / distribution / scan

- **SSRF `accountId` (P1, ✓):** `endpointFor` валидирует против блоклиста только
  `custom`-эндпоинт; провайдерные ветки подставляют `accountId`
  (`z.string().min(1).max(128)`, без charset) в host → `accountId="evil.com#"` →
  `https://evil.com#….r2.cloudflarestorage.com`. `probeBucket`/verify/scan/download
  идут на этот host с платформенного egress; текст ошибки S3 возвращается клиенту
  (частичная эксфильтрация). _Чинить:_ валидировать charset `accountId` + прогонять
  **каждый** resolved-эндпоинт через блоклист или allow-list доменов провайдеров.
- **`scan/worker.ts` (P2, ✓):** `transformToByteArray()` буферизует весь
  quarantine-объект в RAM (до 100MB × batch).
- **Хорошее:** `devCredentials` AES-256-GCM **fail-closed**, auth-tag проверяется,
  ключи не логируются; `quarantine`/`safeFilename` строго блокируют traversal
  (`..`, NUL, `//`, backslash) и ре-валидируют префикс при promote; download-gate
  (`decideDownloadGate`) требует оплаченный entitlement + `MINTED`+непустой
  `nftAddress`; streaming-хэш/upload — O(1) память; VirusTotal клампит `Retry-After`.
- **P3:** `github.repo` без `encodeURIComponent`; CRLF в R2 `ResponseContentDisposition`;
  фильтр типа файла по расширению (бэкстоп — VT-скан).

### 3.5 Security middleware / infra

- **`mahakala.ts` (P3, ✓):** заголовки OWASP корректны (nosniff, X-Frame-Options
  DENY, Referrer-Policy, Permissions-Policy, CORP/COOP, HSTS в prod). Но
  `mahakalaIntegrity()` хэширует ту же in-memory переменную `_dharmaShield`, из
  которой посчитан эталон → `X-Shield-Integrity: intact` ничего не детектит. 33
  строки base64-мантры — мёртвый груз. _Чинить:_ убрать театр, оставить заголовки.
- **`requestLogger.ts` (P3):** логирует `ip` + полный `originalUrl` на каждый
  запрос (PII/GDPR; риск утечки query-секретов).
- **`validate.ts`, `requestId.ts`, `asyncHandler.ts` (✅):** чисто.
- **`server.ts` (✅, см. первый проход):** rate-limit по зонам, origin-guard,
  CSP без `unsafe-inline` в script-src, graceful shutdown, опц. роутеры с алертами.

### 3.6 Email (Resend) / OG-SSR

- **`resend/routes.js` webhook (✅, образец):** `/webhook/inbound` **fail-closed** —
  503 без `RESEND_WEBHOOK_SECRET`, проверка svix-подписи, 401 при неверной. Это
  **правильный** паттерн — и прямой контраст с Didit KYC-webhook (fail-open, P0 в
  `AUDIT.md`): команда умеет верифицировать вебхуки, значит дыра в Didit —
  упущение, а не незнание. Все admin-роуты под `apiRequireAuth()+requireAdminRole`.
- **`og/handler.js` (✅, P3):** все интерполяции экранируются `esc()` (XSS-safe);
  минус — это **plain JS** вне strict-typecheck (как и `resend/routes.js`,
  `r2/*.js`), в отличие от остального TS-кода.

### 3.7 Frontend data-layer + checkout + admin

(дополняет первый проход — не повторяет seed-merge/AuthContext/god-компоненты)

- **Checkout:** hardcoded `1500` bps fee-фолбэк показывается покупателю (P2);
  float-оценка «You pay» расходится с nano-точным бэкендом (P2); `extractMsgHash`
  считает не тот хэш, но бэкенд его игнорирует → инертно (P3, ✓); отсутствует
  отдельный «cancelled»-стейт при отклонении в кошельке (P3).
- **Money-display:** `ComplianceLedger.formatTon` — `Number/1e9` (теряет точность),
  тогда как `lib/api.ts` корректно на BigInt — несогласованность (P2).
- **React Query:** admin-запросы без `enabled`-гейта на auth → retry-storm 3× на
  401 (P2); `body as T` без рантайм-валидации envelope → тихий `undefined` при
  дрейфе схемы бэкенда (P2); leak interval в `DiditKycWidget` при смене кошелька (P3).
- **Security:** `X-Commerce-Admin-Secret` шлётся на `VITE_COMMERCE_API_URL` без
  проверки схемы (риск cleartext при http) (P3); единственный HTML-sink —
  sandbox-iframe инбокса (ок); `dangerouslySetInnerHTML` нигде нет (✓ чисто).

---

## 4. Обновлённый приоритет (с учётом нового)

**Перед включением on-chain / публичным запуском:**
1. 🔴 Синхронизировать опкоды контракт↔бэкенд + CI-assert опкод-хэшей (§3.1).
2. 🔴 Добавить unique-индексы `purchases.tx_hash` и `(user_id, product_id)` (§3.3).
3. 🔴 (из `AUDIT.md`) KYC-webhook fail-closed; запинить сеть серверно; убрать seed-merge.
4. 🟠 Закрыть PII-эндпоинт `/profiles/by-ton` (public-subset/owner-only) (§3.3).
5. 🟠 Валидация `accountId` + allow-list доменов против SSRF (§3.4).
6. 🟠 Убрать/защитить legacy `confirmPurchaseSession` (mint без оплаты) (§3.1).
7. 🟠 Убрать JWT/email из логов; разнести USD/TON в payouts (§3.3).

**Достоверность/тех-долг:** модератор-IDOR, CSV-инъекция, search full-scan,
support-валидация, float TON-математика, второй mint-воркер без лока, mahakala-театр.

---

## 5. Что сделано хорошо (не только баги)

- Atomic distributed-lock через unique-index; download-gate как чистая
  decision-функция с полной gate-матрицей и тестами.
- BYOS-креды AES-256-GCM fail-closed, ключи не логируются; quarantine жёстко
  блокирует path-traversal; streaming-хэш/upload без буферизации.
- Resend-webhook — образцовый fail-closed с svix-проверкой.
- Контракты на Tact зрелые, lifecycle покрыт sandbox-тестами.
- Authz централизована, `user_id` из токена, Appwrite-Query параметризованы.
- strict TS, ~0 `any`, 496 unit-тестов (включая новый drift-guard опкодов), CI с CodeQL/gitleaks.

---

## 6. Длинный хвост (utils / mappers / hooks / e2e)

- **`roleCatalog.ts` (P2):** `requiresMFA: true` (admin/super_admin) и
  `sessionDuration` **объявлены, но не enforced** — реальная аутентификация это
  Appwrite OTP/OAuth без MFA-гейта, `authenticateWithMFA` существует только в
  интерфейсе; `sessionDuration` идёт лишь в косметический клиентский `expiresAt`
  (`AuthContext.tsx:26`), а реальную сессию определяет Appwrite-JWT. Тот же
  паттерн «аспирационная security-конфигурация без проводки», что и
  mahakala-театр (§3.5).
- **`backend/logger.ts:14` (P2):** `JSON.stringify` логирует произвольные
  объекты **без редактирования** — любой токен/секрет/PII, переданный в logger,
  пишется как есть. Это и есть причина, по которой `[AUTH_AUDIT_BE]` (§3.3)
  реально светит JWT/email в логах. _Чинить:_ allow/deny-list полей + редакция.
- **`backend/sentry.ts:17` (P2):** нет `beforeSend`/scrubbing, дефолтный PII-захват
  Sentry активен; секреты могут уехать во внешний сервис.
- **`mapDocuments.ts` (P2):** мапперы **фабрикуют** недостающие данные —
  синтетическое описание («— Catalog description (Appwrite).», `:152`), выдуманный
  счётчик отзывов из `downloads/200`, `version: '1.0.0'`, `lastUpdated = сегодня`.
  UI показывает выдуманные метаданные как настоящие (тот же мотив, что seed-merge).
- **`utils/tonAmount.ts:5` (P2):** `nanoRawToTonHuman` не валидирует вход —
  нечисловая/дробная строка режется позиционно и выдаёт мусор (вход backend-контролируемый,
  риск низкий, но без ассерта).
- **`catalog.ts:235` (P3):** сортировка `'newest'` = `Number(b.id)-Number(a.id)`;
  Appwrite `$id` нечисловые → `NaN` → сортировка по «новизне» **молча не работает**
  на реальных данных (только на seed с числовыми id).
- **`requestId.ts:14` (P3):** клиентский `x-request-id` принимается без bounds и
  отражается в ответ (spoofing log-correlation; newline-инъекция снята валидацией Node).
- **`useTonPrice.ts:12` (P3):** при не-OK ответе тихо возвращает `0` → цена $0
  вместо ошибки. **`params.str()` (P3):** без bounding длины (Query параметризованы).
- Чисто: `slugify`, `useAdminData`, `Network/SearchContext`, `commerce/tonforge types`,
  `repository`, `ids`, `limits`, `categoryIcons`, `platformIcons`, `asyncHandler`.

**E2E — покрытие в основном косметическое (P2, важно):**
- `smoke.spec.ts` — много вакуумных ассертов (`count >= 0` всегда истина, `:199`;
  `if (visible)`-гарды молча no-op при отсутствии элемента).
- `product-lifecycle`/`admin-panel` — настоящие **auth-gate** проверки (401/403),
  но все под `test.skip(!backendUp)` → без бэкенда в CI весь сьют «зелёный» скипом;
  аутентифицированный happy-path покупки/mint/KYC не прогоняется ни разу.
- `commerce-nft-bridge.spec.ts:108-167` — флагманские «mint→minted» и
  «mint_failed→refunded» **не монтируют** компонент, а делают `goto('/docs/...')` и
  проверяют наличие слова «refund» в статической доке. Стаб `/licenses/**` не
  срабатывает — критический mint/refund state-machine **тестируется против текста
  документации, а не поведения**.

> Итог §6: длинный хвост по утилитам/типам в целом крепкий, но опирается на
> «защитные дефолты», которые **фабрикуют или маскируют** отсутствующие данные, а
> наблюдаемость (logger/sentry) **не скрабит секреты**. Главный пробел — **e2e:
> security-гейты реальны, но backend-gated скипом, а ключевые денежные потоки
> (покупка/mint/refund/KYC) фактически не прогоняются** (496 unit-тестов реальны,
> e2e критических флоу — нет).

---

## 7. Исправлено в этом PR (ветка `claude/funny-dijkstra-KIPtO`)

| Находка | Статус | Коммит |
|---------|--------|--------|
| §3.1 Опкод-дрифт (P0) | ✅ исправлено: опкоды синхронизированы с `escrow.tact`, убран выдуманный `ORACLE_REFUND`, добавлен drift-guard тест (парсит `.tact`) | `be0edd3` |
| §3.3 PII `/profiles/by-ton` (P1) | ✅ исправлено: public-subset без email/KYC/internal-id | `c88c8f8` |
| §3.3 `purchases` без unique-индексов (P0) | ✅ исправлено: unique `(user_id, product_id)` + `uniq_tx_hash`, идемпотентный `insertPurchase` (409 → existing) | `c88c8f8` |
| `AUDIT §2.1` KYC-webhook fail-open (P0) | ✅ исправлено: подпись обязательна (нет/невалидна → 401), пустой `DIDIT_WEBHOOK_SECRET` → fail-closed; тест `diditIntegration.test.ts` | этот PR |
| `AUDIT §2.2` сеть из клиентского заголовка (P0) | ✅ исправлено: `resolveNetwork` пинится к `TON_NETWORK`, клиентский `x-ton-network` advisory-only; тест `network.test.ts` | этот PR |
| (из `AUDIT.md`) high-CVE deps + npmmirror | ✅ исправлено: `overrides` + lock на npmjs; `npm audit --audit-level=high` = 0 | ранее |
| (из `AUDIT.md`) флака-тест GCM | ✅ исправлено: детерминированный tamper | ранее |

> Самая важная **оставшаяся** задача после этого PR: реальные e2e денежного пути
> (покупка→escrow→mint→download) на testnet и серверный пиннинг сети + fail-closed
> KYC-webhook (§`AUDIT.md` P0). Опкод-дрифт, который был №1 риском, закрыт и
> защищён тестом от регрессии.
