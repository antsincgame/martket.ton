# TON Web Store

Маркетплейс цифровых товаров с интеграцией TON блокчейна.

## Стек

| Слой | Технологии |
|------|-----------|
| **Frontend** | React 18, TypeScript (strict), Vite 5, Tailwind CSS 3 |
| **Routing** | React Router DOM v6 |
| **Auth** | Appwrite Account (email+пароль), TonConnect (кошелёк), JWT API для кошелька |
| **Backend** | Node.js, Express |
| **БД** | Appwrite Databases (витрина, commerce, core: профили/legacy API), Appwrite Storage (снимок TonForge) |

## Структура проекта

```
├── backend/                 # Express API сервер
│   ├── commerce/            # Commerce API (заказы, споры, аудит)
│   ├── server.js            # Точка входа бэкенда
│   ├── core/                # Репозиторий Appwrite (database core)
│   └── logger.js            # Логгер
├── scripts/                 # Провижининг и сид-данные
├── src/
│   ├── components/          # React компоненты
│   │   └── admin/           # Админ-панель
│   ├── contexts/            # React контексты (AuthContext)
│   ├── domain/              # Доменная логика
│   │   ├── commerce/        # Типы commerce
│   │   └── marketplace/     # Каталог (Appwrite)
│   ├── lib/                 # Клиенты API
│   ├── pages/               # Страницы приложения
│   ├── types/               # TypeScript типы
│   └── utils/               # Утилиты
├── public/                  # Статика (tonconnect-manifest.json)
├── .env.example             # Шаблон переменных окружения
└── package.json
```

## Запуск

### Предварительные требования

- Node.js 20+
- Проект в Appwrite (провижининг: `provision:appwrite`, `provision:commerce`, `provision:core`)

### Установка

```bash
# Клонируйте репозиторий
git clone <repo-url>
cd martket.ton

# Установите зависимости фронтенда
npm install

# Установите зависимости бэкенда
cd backend && npm install && cd ..

# Скопируйте и заполните переменные окружения
cp .env.example .env
```

### Переменные окружения

Заполните `.env` по шаблону `.env.example`. Обязательные переменные:

- `VITE_APPWRITE_*` — фронтенд (каталог + Auth)
- `APPWRITE_*` — бэкенд (server API key)
- `JWT_SECRET` — секрет для подписи JWT токенов

### Запуск в режиме разработки

```bash
# Фронтенд (порт 8080)
npm run dev

# Бэкенд (порт 8081) — в отдельном терминале
cd backend && node server.js
```

### Провижининг Appwrite

```bash
npm run provision:appwrite
npm run provision:commerce
```

### Сборка

```bash
npm run build
npm run preview
```

## Маршруты приложения

| Путь | Страница | Доступ |
|------|----------|--------|
| `/` | Главная (каталог) | Публичный |
| `/product/:id` | Страница товара | Публичный |
| `/category/:id` | Категория | Публичный |
| `/profile` | Профиль | Публичный |
| `/developer` | Панель разработчика | Авторизованный |
| `/developer/register` | Регистрация разработчика | Публичный |
| `/seller/commerce` | Commerce продавца | Публичный |
| `/admin` | Админ-панель | Роль `admin` |

## API эндпоинты (backend)

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/health` | Healthcheck |
| `POST` | `/api/auth/login` | Авторизация по кошельку |
| `GET` | `/api/developers` | Список разработчиков |
| `POST` | `/api/developers` | Регистрация разработчика (JWT) |
| `GET` | `/api/products` | Список продуктов |
| `GET` | `/api/products/:id` | Продукт по ID |
| `POST/GET` | `/api/audit-logs` | Аудит-логи (JWT) |
| — | `/api/v1/commerce/*` | Commerce API (заказы, споры) |

## Деплой и TON Connect

Фронтенд собирается командой `npm run build` (артефакты в `dist/`). Деплой на любой хостинг статики — по выбору команды.

Для продакшена укажите публичный URL приложения в `public/tonconnect-manifest.json` (поля `url`, `iconUrl`, `termsOfUseUrl`, `privacyPolicyUrl`, `app_url`) или задайте `VITE_TONCONNECT_MANIFEST_URL` на URL размещённого манифеста.

## Лицензия

MIT
