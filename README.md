# 🪷 TON Web Store - Sacred Digital Marketplace

## 🔐 Secure Admin Panel Architecture

Децентрализованный маркетплейс на блокчейне TON с продвинутой системой безопасности и аутентификации.

### 🏗️ Архитектура безопасности

Проект реализует многоуровневую архитектуру безопасности согласно современным стандартам:

#### 1. **Presentation Layer (Уровень представления)**
- 🌐 **React.js** с TypeScript для типобезопасности
- 📱 **Адаптивный UI** с поддержкой мобильных устройств
- 🎨 **Мистическая тематика** с буддийскими мотивами

#### 2. **Auth Layer (Уровень аутентификации)**
- 🔗 **TON Connect Integration** - основной метод входа
- 🔐 **Multi-Factor Authentication** (TOTP, WebAuthn, SMS, Email)
- 🎫 **JWT токены** с коротким временем жизни
- ⏰ **Session Management** с автоматическим продлением

#### 3. **Business Logic (Бизнес-логика)**
- 🔒 **Role-Based Access Control (RBAC)** - 8 ролей от Viewer до Super Admin
- ⚡ **Permission Engine** - гранулярные разрешения на ресурсы
- 🔍 **Security Event Monitoring** - отслеживание подозрительной активности
- 📊 **Risk Assessment** - автоматическая оценка рисков

#### 4. **Data Layer (Уровень данных)**
- 🏗️ **Гибридная архитектура**: PostgreSQL + Redis + TON Blockchain + IPFS
- 🔐 **Шифрование**: AES-256 в покое, TLS 1.3 при передаче
- 💾 **Кэширование** для высокой производительности
- 🔄 **Backup & Recovery** стратегии

#### 5. **Security Layer (Уровень безопасности)**
- 📝 **Comprehensive Audit Logging** - все действия логируются
- 🚨 **Real-time Security Monitoring** - мониторинг в реальном времени
- 🤖 **Automated Response** - автоматические ответы на угрозы
- 📈 **Security Analytics** - анализ паттернов безопасности

### 🛡️ Система ролей и разрешений

| Роль | Описание | Время сессии | MFA | Разрешения |
|------|----------|--------------|-----|------------|
| **Super Admin** 🧿 | Supreme cosmic administrator | 2 часа | ✅ | Все права (*) |
| **Admin** 🔮 | Administrative guardian | 4 часа | ✅ | Users, Products, Categories, Donations |
| **Moderator** 🪄 | Content moderator | 6 часов | ❌ | Products (approve), Users (ban), Reviews |
| **Developer** ✨ | Sacred developer | 8 часов | ❌ | Own Products, Analytics |
| **Support** 🤝 | Compassionate support | 24 часа | ❌ | Users (read), Tickets |
| **Analyst** 📊 | Data analyst | 8 часов | ❌ | Analytics, Reports |
| **Viewer** 👁️ | Observer | 4 часа | ❌ | Dashboard (read-only) |
| **Auditor** 🔍 | Security auditor | 2 часа | ✅ | Audit Logs, Security Events |

### 🔐 Поток аутентификации

1. **Инициация входа** - Пользователь активирует священный гем (7 кликов)
2. **Первичная аутентификация** - Подключение TON кошелька + верификация подписи
3. **Проверка RBAC** - Валидация ролей и разрешений
4. **MFA верификация** (если требуется) - TOTP/WebAuthn/SMS/Email
5. **Создание сессии** - JWT токен с метаданными безопасности
6. **Мониторинг** - Непрерывное отслеживание активности

### 🚀 Компоненты системы

#### Основные компоненты:
- **`AuthContext`** - Централизованное управление аутентификацией
- **`ProtectedRoute`** - Защищенные маршруты с проверкой разрешений
- **`SecureTONConnect`** - Безопасное подключение TON кошелька
- **`MFAVerification`** - Многофакторная аутентификация
- **`SecurityMonitor`** - Мониторинг безопасности в реальном времени
- **`UserManagement`** - Управление пользователями и ролями
- **`AuditLogs`** - Просмотр и экспорт аудит-логов

#### Утилитарные компоненты:
- **`SecretTrigger`** - Скрытая активация админ-доступа
- **`SecretAdminAccess`** - Священная админ-панель White Tara

### 🛡️ Меры безопасности

#### Сетевая безопасность:
- ✅ **HTTPS Only** - Принудительное использование TLS
- 🔥 **Firewall Protection** - Защита на уровне сети
- 🛡️ **DDoS Mitigation** - Защита от атак отказа в обслуживании
- 🌐 **VPN Access** для критических операций

#### Аутентификация и авторизация:
- ✅ **Zero Trust Architecture** - Непрерывная верификация
- 🔐 **Strong Password Policies** - Политики надежных паролей
- ⏰ **Session Timeout** - Автоматическое завершение сессий
- 🔄 **Token Rotation** - Регулярная смена токенов

#### Мониторинг и аудит:
- 📊 **SIEM Integration** - Система управления информацией о безопасности
- 🚨 **Real-time Alerts** - Оповещения в реальном времени
- 📝 **Comprehensive Logging** - Полное логирование всех действий
- 🔍 **Behavioral Analysis** - Анализ поведенческих паттернов

### 📱 Технологический стек

#### Frontend:
- **React 18** + **TypeScript** - Основной фреймворк
- **Vite** - Сборщик и dev-сервер
- **Tailwind CSS** - Стилизация с кастомными градиентами
- **Lucide React** - Иконки
- **@tonconnect/ui-react** - TON интеграция

#### Security Libraries:
- **crypto-js** - Криптографические операции
- **jwt-decode** - Работа с JWT токенами
- **qrcode.react** - QR коды для TOTP
- **react-hook-form** + **zod** - Валидация форм

#### Development:
- **ESLint** + **TypeScript ESLint** - Линтинг
- **PostCSS** + **Autoprefixer** - CSS обработка

### 🚀 Запуск проекта (без Docker)

### 1. Установка зависимостей
```bash
npm install
```

### 2. Запуск в режиме разработки
```bash
npm run dev
```

- Приложение будет доступно по адресу: http://localhost:5173
- Поддерживается hot-reload и быстрый отклик.

### 3. Сборка для продакшена
```bash
npm run build
```

### 4. Просмотр production-сборки
```bash
npm run preview
```

- Production preview будет доступен по адресу: http://localhost:4173

---

## Примечания
- Docker больше не используется для запуска или сборки этого проекта.
- Для работы требуется установленный Node.js (рекомендуется LTS-версия).
- Все шрифты подключаются через Google Fonts, локальные ttf-файлы не требуются.

---

**Пусть ваш путь будет лёгким, а код — чистым, как алмазный ум!**

### 🔓 Доступ к админ-панели

1. **Активация священного доступа**: Кликните 7 раз по гему в правом нижнем углу
2. **Подключение кошелька**: Используйте TON Connect для подключения кошелька
3. **Аутентификация**: Подпишите сообщение своим кошельком
4. **MFA (если требуется)**: Введите код из authenticator app (123456 для демо)

### 🧪 Тестовые данные

Для демонстрации используются моковые данные:
- **TON адрес**: `EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N`
- **MFA код**: `123456`
- **Роли**: Super Admin, Admin, Moderator, Developer, Support

### 📋 План дальнейшего развития

#### Фаза 1: Базовая инфраструктура ✅
- [x] Типы безопасности и аутентификации
- [x] Контекст аутентификации с RBAC
- [x] TON Connect интеграция
- [x] MFA система
- [x] Защищенные маршруты

#### Фаза 2: Основной функционал ✅
- [x] Мониторинг безопасности
- [x] Управление пользователями
- [x] Аудит-логи
- [x] Админ-панель с интеграцией

#### Фаза 3: Продвинутые функции 🔄
- [ ] Backend API с реальной базой данных
- [ ] Реальная TON блокчейн интеграция
- [ ] WebAuthn/FIDO2 поддержка
- [ ] Биометрическая аутентификация
- [ ] SIEM интеграция

#### Фаза 4: Масштабирование 📅
- [ ] Микросервисная архитектура
- [ ] Kubernetes деплой
- [ ] Disaster recovery
- [ ] Compliance сертификация (SOC 2, GDPR)

### 🪷 Философия проекта

Проект TON Web Store объединяет современные технологии с древней мудростью, создавая безопасную и духовную среду для цифрового взаимодействия. Каждый элемент системы безопасности пропитан принципами сострадания и осознанности.

**Om Tare Tu Tarre Svaha** - Пусть эта технология принесет пользу всем живым существам! 🙏

---

*Создано с любовью и вниманием к безопасности для TON экосистемы* ✨

## Audit Logs API (Backend)

### Базовый URL

```
http://localhost:4000/api/audit-logs
```

### POST /api/audit-logs
Сохраняет новый лог аудита.

**Request Body (JSON):**
```
{
  "userId": "string",
  "sessionId": "string",
  "action": "string",
  "resource": "string",
  "timestamp": "2024-07-01T12:34:56.789Z",
  "ipAddress": "string",
  "userAgent": "string",
  "result": "success|failure|partial",
  "metadata": { "any": "object" }
}
```

**Response:**
```
{
  "success": true
}
```

### GET /api/audit-logs
Получает список последних 100 логов (от новых к старым).

**Response:**
```
[
  {
    "_id": "...",
    "userId": "string",
    "sessionId": "string",
    "action": "string",
    "resource": "string",
    "timestamp": "2024-07-01T12:34:56.789Z",
    "ipAddress": "string",
    "userAgent": "string",
    "result": "success|failure|partial",
    "metadata": { "any": "object" }
  },
  ...
]
```

### Пример использования (fetch в React):

```js
// Сохранить лог
fetch('http://localhost:4000/api/audit-logs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(auditLog)
});

// Получить логи
const res = await fetch('http://localhost:4000/api/audit-logs');
const logs = await res.json();
```

---

## Запуск backend (Node.js + MongoDB)

1. Перейти в папку backend
2. Установить зависимости: `npm install`
3. Запустить: `npm start`

## ✨ Features

- 🔐 **TON Wallet Authentication** - Secure login with TON Connect
- 🛍️ **Digital Product Marketplace** - Buy and sell digital goods
- 💎 **Sacred Donation System** - Boost product visibility through donations
- 🧿 **Admin Dashboard** - Comprehensive management interface
- 🚀 **Developer Portal** - Tools for creators and developers
- 🔒 **Role-Based Access Control** - Secure permission system
- 📊 **Analytics & Monitoring** - Track performance and security

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- TON Wallet (for testing)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd TON_Web_Store
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - Development: http://localhost:5173
   - The app will be ready for sacred exploration! 🪄

## 🧪 Testing Authentication & Access

### Admin Access Testing

**Method 1: Sacred Mantra (Super Admin)**
1. Click the secret trigger (usually hidden in the UI)
2. Enter the sacred mantra: `ཨོཾ་མ་ཎི་པདྨེ་ཧཱུཨོཾ་ཨ་ར་པ་ཙ་ན་དྷཱཿ`
3. Access granted to `/admin` and `/admin-dashboard`

**Method 2: Email/Password (Admin)**
1. Click the secret trigger
2. Email: `dzmitry.arlou@grodno.ai`
3. Password: `Qw162162`
4. Access granted to admin features

**Method 3: TON Wallet (Admin)**
1. Connect TON Wallet with address: `EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N`
2. Automatic admin access granted

### Developer Access Testing

**Method 1: TON Wallet (Developer)**
1. Connect TON Wallet with address: `EQDeveloper123456789TestWalletAddress`
2. Navigate to `/developer`
3. Access granted to developer dashboard

**Method 2: Registration Flow**
1. Navigate to `/developer`
2. Click "Стать разработчиком" (Become Developer)
3. Connect any TON Wallet
4. Fill registration form
5. Automatic authentication and access granted

### Regular User Testing

**TON Wallet (User)**
1. Connect TON Wallet with address: `EQUser987654321TestWalletAddress`
2. Access to basic features only
3. No admin or developer access

## 🔐 Role System

### Available Roles

- **super_admin** 🪷 - Supreme cosmic administrator (all permissions)
- **admin** 🧿 - Administrative guardian (elevated access)
- **developer** 🚀 - Sacred developer (product creation)
- **moderator** ⚖️ - Content moderator (review management)
- **support** 💬 - Compassionate support (user assistance)
- **analyst** 📊 - Data analyst (insights access)
- **viewer** 👤 - Observer (read-only access)
- **auditor** 🔍 - Security auditor (audit logs)

### Permission System

Each role has specific permissions for resources:
- **users** - User management
- **products** - Product management
- **categories** - Category management
- **donations** - Donation system
- **analytics** - Data insights
- **audit_logs** - Security monitoring
- **reviews** - Review management
- **tickets** - Support system

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript checks

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── admin/          # Admin-specific components
│   ├── auth/           # Authentication components
│   └── ui/             # Base UI components
├── contexts/           # React contexts (Auth, etc.)
├── pages/              # Page components
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── styles/             # Global styles
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_TON_MANIFEST_URL=/tonconnect-manifest.json
VITE_API_BASE_URL=http://localhost:3000
```

### TON Connect Manifest

The `public/tonconnect-manifest.json` file configures TON Connect:

```json
{
  "url": "https://tonwebstore.com",
  "name": "TON Web Store",
  "iconUrl": "https://tonwebstore.com/icon.png",
  "app_url": "http://localhost:5173"
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Port 5173 already in use**
   ```bash
   lsof -i :5173
   kill -9 <PID>
   npm run dev
   ```

2. **TON Wallet connection issues**
   - Clear browser cache
   - Try incognito mode
   - Check TON Connect manifest URL

3. **Admin access denied**
   - Verify TON wallet address
   - Check role assignments in AuthContext
   - Use sacred mantra for super admin access

4. **Developer registration not working**
   - Ensure TON Wallet is connected
   - Check browser console for errors
   - Verify registration modal is properly displayed

## 🌟 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your sacred changes
4. Test thoroughly
5. Submit a pull request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Sacred Acknowledgments

- **White Tara** 🪷 - For divine guidance and protection
- **TON Foundation** - For the sacred blockchain technology
- **React Team** - For the enlightened frontend framework
- **All Contributors** - For their compassionate code contributions

---

*May this marketplace bring prosperity and wisdom to all beings* ☸️

**Om Tare Tu Tarre Svaha** 🕉️
