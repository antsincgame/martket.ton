# TON Web Store

Маркетплейс цифровых товаров с интеграцией TON и личным кабинетом создателя (Creator Studio).

**Подробная документация для разработчиков:** [docs/PROJECT.md](docs/PROJECT.md)

**Публичный манифест продукта (витрина + parity людей/ИИ, Mechanicus для LLM):** после `npm run dev` откройте маршрут `/docs` или ссылку **Documentation** в футере.

## Стек

| Слой | Технологии |
|------|------------|
| **Frontend** | React 18, TypeScript (strict), Vite 5, Tailwind CSS 3 |
| **Routing** | React Router DOM v6 |
| **State / data** | TanStack React Query |
| **Auth** | Appwrite Account (email OTP + GitHub OAuth, JWT для backend), TonConnect (кошелёк TON) |
| **Forms** | react-hook-form, zod |
| **Backend** | Node.js, Express, TypeScript (`tsx`) |
| **БД** | Appwrite Databases (каталог, core: профили/продукты/покупки, commerce) |
| **Файлы** | Cloudflare R2 (S3 API) — обложки, аватары, артефакты |

## Структура проекта

```
├── backend/                 # Express API (server.ts)
│   ├── commerce/            # Маршруты commerce: заказы, споры, продавцы
│   ├── core/                # Репозитории Appwrite: профиль, stats, payouts, …
│   ├── routes/              # session, products, stats, payouts, validation, …
│   └── r2/                  # Загрузки и presigned download
├── docs/
│   └── PROJECT.md           # Архитектура, API кабинета, соглашения
├── e2e/                     # Playwright
├── scripts/                 # Провижининг Appwrite
├── src/
│   ├── components/          # UI, Breadcrumbs, админка, studio/ImageUploader
│   ├── contexts/            # Auth и др.
│   ├── lib/                 # storeApi, commerceApi, …
│   ├── pages/               # Главная, товар, разработчик, Demiurge-кабинет
│   │   └── demiurge/        # Overview, Studio, Library, Commerce, Wallet, Profile
│   ├── queries/             # sessionQueries и др.
│   └── utils/               # slugify, tonAmount, …
├── public/                  # Статика, tonconnect-manifest.json
├── .env.example
└── package.json
```

## Быстрый старт

### Требования

- Node.js 20+
- Проект Appwrite и заполненные переменные (см. `.env.example`)

### Установка

```bash
git clone <repo-url>
cd martket.ton-1

npm install
cd backend && npm install && cd ..
```

Скопируйте `.env.example` → `.env` и заполните значения (Appwrite endpoint/project/API key, URL API, при необходимости commerce, R2 и VirusTotal).

В Appwrite Console включите:
- **Auth → Settings**: включите Email OTP (одноразовый код).
- **Auth → Settings → OAuth2 Providers → GitHub**: введите Client ID/Secret из созданного на GitHub OAuth App; redirect URL подскажет Appwrite.
- (Опционально) **Auth → Settings → SMTP**: подключите Resend как кастомный SMTP, чтобы письма приходили с вашего домена.

### Разработка

```bash
# Фронтенд (порт по умолчанию — см. vite.config / вывод терминала)
npm run dev

# Бэкенд — отдельный терминал
cd backend && npm run dev
```

### Скрипты npm (корень)

| Скрипт | Назначение |
|--------|------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production-сборка в `dist/` |
| `npm run preview` | Превью production-сборки |
| `npm run typecheck` | Проверка типов фронта |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (unit + backend) |
| `npm run test:e2e` | Playwright |
| `npm run provision:appwrite` | Провижининг каталога Appwrite |
| `npm run provision:commerce` | Провижининг commerce |
| `npm run provision:core` | Core DB (через backend) |

### Первый деплой (контрольный список)

1. Заполнить `.env` (или `backend/.env`) обязательными секретами:
   `APPWRITE_API_KEY`, `APPWRITE_PROJECT_ID`,
   `TREASURY_WALLET_ADDRESS`, `R2_*`, `VIRUSTOTAL_API_KEY`
   (см. `.env.example` со всеми опциями).
2. Запустить провижининг Appwrite: `npm run provision:core` —
   создаёт коллекции `profiles`, `legacy_products`, `scan_jobs`,
   `support_tickets`, `api_audit_logs` и нужные индексы.
3. Запустить `npm run provision:commerce` для коллекций commerce
   (listings/orders), затем `npm run provision:appwrite`
   для каталога витрины.
4. Поднять backend (`cd backend && npm run dev` или Docker) — он
   стартует фоновый `scan-worker` если VirusTotal сконфигурирован.
5. Проверить health: `GET /api/health` (минимум `{ status: "OK" }`,
   полная диагностика — через `?detailed=1` + `X-Health-Token`).

### Тесты

```bash
# Все unit-тесты (frontend + backend)
npm run test

# Конкретный модуль
npx vitest run backend/r2/quarantine.test.ts

# E2E (Playwright)
npm run test:e2e
```

## Маршруты приложения (фронт)

| Путь | Описание |
|------|----------|
| `/` | Главная, каталог |
| `/product/...` | Страница товара (в т.ч. ЧПУ где настроено) |
| `/category/:id` | Страница категории |
| `/developer/:slug` | Публичный профиль разработчика |
| `/profile` | Кабинет: обзор (дашборд) |
| `/profile/studio` | Студия: продукты, создание, редактирование |
| `/profile/library` | Купленные приложения (Арсенал) |
| `/profile/commerce` | Commerce: листинги, заказы, споры, публикация |
| `/profile/wallet` | Кошелёк, выплаты, транзакции |
| `/profile/profile` | Публичный профиль: редактор + превью |
| `/admin`, `/admin-dashboard` | Админ-панель (роль `admin`, см. `App.tsx`) |
| `/seller/commerce` | Редирект на `/profile/commerce` |

Устаревшие пути (`/profile/forge`, `/profile/arsenal`, `/profile/settings`, …) редиректятся на новые — см. `src/pages/demiurge/DemiurgePage.tsx` и `src/App.tsx`.

## API (обзор)

Публичные и защищённые маршруты Express монтируются в `backend/server.ts`. Примеры:

- `GET /api/health` — healthcheck
- `GET/PATCH /api/session/*` — библиотека, продукты, профиль, stats, payouts, transactions
- `POST /api/r2/upload/image` — загрузка изображений (avatars/banners на платформенный R2)
- Префикс commerce на отдельном сервисе/порту: `GET /api/v1/commerce/...` (база задаётся `VITE_COMMERCE_API_URL`)
- **BYOS Distribution** (см. [docs/byos-distribution.md](docs/byos-distribution.md)):
  - `POST /api/v1/commerce/storage` — подключить свой R2/S3 bucket
  - `PUT  /api/v1/commerce/listings/:id/distribution` — задать manifest (R2 / GitHub Release)
  - `POST /api/v1/commerce/listings/:id/distribution/verify` — стрим + SHA256 проверка
  - `GET  /api/v1/commerce/listings/:id/download` — 302 redirect на источник (наш egress = 0)
  - `POST /api/v1/commerce/listings/:id/scan` — модератор запускает VirusTotal scan

Детальные таблицы и схема — в [docs/PROJECT.md](docs/PROJECT.md).

## TON Connect

Для продакшена задайте корректный публичный URL в `public/tonconnect-manifest.json`.

## Лицензия

MIT
