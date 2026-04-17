# Документация проекта TON Web Store

Обзор архитектуры, модулей и соглашений для разработчиков.

## Назначение

Веб-маркетплейс цифровых товаров с оплатой в TON: каталог, страницы товаров и разработчиков, личный кабинет создателя (Demiurge / Creator Studio), commerce-заказы и админка.

## Высокоуровневая схема

```
┌─────────────┐     HTTPS      ┌──────────────────┐
│  Vite SPA   │ ─────────────► │  Express (API)   │
│  React 18   │  Appwrite JWT  │  Node + tsx      │
└──────┬──────┘                └────────┬─────────┘
       │                                  │
       │ TonConnect                       │ Appwrite SDK
       ▼                                  ▼
┌─────────────┐                  ┌──────────────────┐
│ TON Wallet  │                  │ Appwrite DB      │
└─────────────┘                  │ + R2 (S3) upload │
                                 └──────────────────┘
```

- **Фронтенд** (`src/`) — SPA, авторизация через **Appwrite Account** (magic-link email + GitHub OAuth), кошелёк через **TonConnect**, данные кабинета через **TanStack React Query**.
- **Бэкенд** (`backend/`) — REST API, Appwrite JWT для защищённых маршрутов, **Appwrite** как основная БД, **Cloudflare R2** для загрузки изображений/артефактов.
- **Commerce API** — отдельный префикс `VITE_COMMERCE_API_URL` → `/api/v1/commerce/*` (заказы, споры, листинги продавца).

## Структура репозитория

| Путь | Назначение |
|------|------------|
| `src/` | React-приложение: страницы, компоненты, контексты, `lib/` клиенты |
| `src/queries/` | Хуки React Query (`sessionQueries` — library, products, stats, payouts, transactions) |
| `src/pages/demiurge/` | Личный кабинет: Overview, Studio, Library, Commerce, Wallet, Profile, Admin |
| `backend/` | Express-сервер: `server.ts`, маршруты `routes/`, `commerce/`, репозитории `core/` |
| `backend/core/` | Работа с Appwrite: профили, продукты, покупки, stats, payouts |
| `scripts/` | Провижининг коллекций Appwrite |
| `e2e/` | Playwright E2E |
| `public/` | Статика, `tonconnect-manifest.json` |

## Личный кабинет (Creator Studio)

Информационная архитектура — три группы навигации:

| Группа | Секции | Базовые пути |
|--------|--------|--------------|
| **Creator** | Overview, Studio, Library | `/profile`, `/profile/studio`, `/profile/library` |
| **Business** | Commerce, Wallet | `/profile/commerce`, `/profile/wallet` |
| **Identity** | Profile | `/profile/profile` |

Старые URL перенаправляются на новые (например `/profile/forge` → `/profile/studio`, `/seller/commerce` → `/profile/commerce`). Реализация — `src/App.tsx`, layout — `src/layouts/DemiurgeLayout.tsx`.

### Ключевые API кабинета (store backend)

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/session/library` | Покупки пользователя |
| `GET` | `/api/session/products` | Продукты автора |
| `GET` | `/api/session/stats` | KPI дашборда |
| `GET` | `/api/session/payouts` | Агрегаты выплат по месяцам |
| `GET` | `/api/session/transactions` | История транзакций (продажи и т.д.) |
| `PATCH` | `/api/session/profile` | Публичный профиль (slug, bio, соцсети, featured) |
| `POST` | `/api/r2/upload/image` | Загрузка avatar/banner/cover |

### Commerce (отдельный base URL)

Клиент: `src/lib/commerceApi.ts`. Типичные пути: листинги продавца, `GET /sellers/:wallet/orders`, `GET /sellers/:wallet/disputes`, KYC, публикация TonForge-приложений — см. код модуля и `backend/commerce/`.

## Соглашения по коду

- TypeScript strict на фронте; бэкенд — ES-модули, `tsx` для запуска.
- Формы: `react-hook-form` + `zod` где уместно.
- Ошибки API: единообразные JSON-ответы; на фронте — React Query + toast.
- Логирование на бэке — через проектный logger, не `console.log` в прод-коде.

## Тестирование

| Команда | Описание |
|---------|----------|
| `npm run test` | Vitest: `src/**/*.test.{ts,tsx}`, `backend/**/*.test.ts` |
| `npm run typecheck` | `tsc` для приложения |
| `cd backend && npm run typecheck` | Проверка бэкенда |
| `npm run test:e2e` | Playwright |

## Переменные окружения

Полный список и комментарии — в `.env.example`. Критично:

- Appwrite (фронт + бэк): `VITE_APPWRITE_ENDPOINT`, `VITE_APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`.
- `VITE_STORE_API_URL` / прокси к API витрины.
- `VITE_COMMERCE_API_URL` — база commerce API.
- Appwrite: endpoint, project id, API key для сервера.
- R2/S3: ключи для presigned upload/download.

## Деплой

Сборка фронта: `npm run build` → каталог `dist/`. Бэкенд запускается как `npm start` в `backend/` (или `dev` с watch). Манифест TonConnect и публичный URL приложения должны совпадать с прод-доменом.

## Дополнительные материалы

- `docs/tonforge-rollout.md` — сценарии TonForge (если актуален).
- План редизайна кабинета может храниться в `.cursor/plans/` — не часть поставки продукта.
