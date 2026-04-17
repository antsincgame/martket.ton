# TON Web Store

Маркетплейс цифровых товаров с интеграцией TON и личным кабинетом создателя (Creator Studio).

**Подробная документация для разработчиков:** [docs/PROJECT.md](docs/PROJECT.md)

## Стек

| Слой | Технологии |
|------|------------|
| **Frontend** | React 18, TypeScript (strict), Vite 5, Tailwind CSS 3 |
| **Routing** | React Router DOM v6 |
| **State / data** | TanStack React Query |
| **Auth** | Clerk (сессия), TonConnect (кошелёк TON), JWT для API по кошельку где применимо |
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

Скопируйте `.env.example` → `.env` и заполните значения (Clerk, Appwrite, URL API, при необходимости commerce и R2).

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
| `npm run test` | Vitest (unit) |
| `npm run test:e2e` | Playwright |
| `npm run provision:appwrite` | Провижининг каталога Appwrite |
| `npm run provision:commerce` | Провижининг commerce |
| `npm run provision:core` | Core DB (через backend) |

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
- `POST /api/r2/upload/image` — загрузка изображений
- Префикс commerce на отдельном сервисе/порту: `GET /api/v1/commerce/...` (база задаётся `VITE_COMMERCE_API_URL`)

Детальные таблицы и схема — в [docs/PROJECT.md](docs/PROJECT.md).

## TON Connect

Для продакшена задайте корректный публичный URL в `public/tonconnect-manifest.json` или используйте `VITE_TONCONNECT_MANIFEST_URL`.

## Лицензия

MIT
