# FinWise — Умные Финансы

# testing push

Полнофункциональное приложение для управления личными финансами с модулем финансовой грамотности.

## Возможности

- **Мультисчётность** — дебетовые, кредитные карты, наличные
- **Кредитные карты** — отслеживание долга, лимита, доступного остатка
- **Транзакции** — расходы, доходы, переводы, кредитные покупки/платежи
- **Бюджет** — лимиты по категориям с визуализацией
- **Цели сбережений** — копилки с прогресс-баром
- **Обучение** — уроки из лучших финансовых книг, квизы, XP-система
- **Уведомления** — система in-app и push-уведомлений
- **PWA** — устанавливается на мобильное устройство как приложение
- **Виджеты** — iOS Widget (SwiftUI) и Windows Widget (Electron)
- **Авторизация** — JWT + httpOnly cookie, регистрация/вход

## Технологии

| Слой | Технология |
|------|-----------| 
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS v3 + shadcn/ui |
| Backend | Express 5 + TypeScript + tsx |
| ORM | Drizzle ORM + drizzle-zod |
| Database | PostgreSQL 16 (опционально; demo-режим без БД) |
| Auth | JWT в httpOnly cookie, PBKDF2 (встроенный Node crypto) |
| PWA | Web App Manifest + Service Worker |
| Desktop | Electron (Windows Widget) |
| Mobile | SwiftUI Widget Extension (iOS) |

---

## Быстрый старт (demo-режим, без БД)

```bash
cd finwise
npm install
npm run dev
# Открыть http://localhost:5000
```

В demo-режиме используется in-memory хранилище с тестовыми данными. Авторизация не требуется.

---

## Запуск с PostgreSQL

### 1. Создать файл окружения

```bash
cp .env.example .env
```

Заполните `.env`:

```env
DATABASE_URL=postgresql://finwise:your_password@localhost:5432/finwise
JWT_SECRET=ваш_длинный_секрет_минимум_32_символа
```

### 2. Создать базу данных

```bash
psql -U postgres -c "CREATE DATABASE finwise;"
psql -U postgres -c "CREATE USER finwise WITH PASSWORD 'your_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE finwise TO finwise;"
```

### 3. Применить миграции

```bash
npm run db:push
```

### 4. Запустить

```bash
npm run dev
```

---

## Docker Compose (рекомендуется для продакшена)

```bash
cd finwise/infra

# Задать пароли
export POSTGRES_PASSWORD=super_secret_db_password
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

docker compose up -d
```

Приложение будет доступно на `http://localhost:5000`.

### Миграции в Docker

```bash
docker compose exec app npx drizzle-kit push
```

---

## Структура проекта

```
finwise/
├── client/                  # React SPA (Vite)
│   ├── public/
│   │   ├── manifest.json    # PWA manifest
│   │   └── sw.js            # Service Worker
│   └── src/
│       ├── contexts/
│       │   └── AuthContext.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Transactions.tsx
│       │   ├── Accounts.tsx     # NEW
│       │   ├── Budget.tsx
│       │   ├── Goals.tsx
│       │   ├── Learn.tsx
│       │   ├── Notifications.tsx # NEW
│       │   └── Auth.tsx          # NEW
│       └── components/
│           └── Layout.tsx        # + notifications bell, user info
├── server/
│   ├── index.ts
│   ├── routes.ts            # REST API
│   ├── storage.ts           # MemStorage (demo)
│   ├── storage-pg.ts        # PgStorage (production)
│   ├── db.ts                # Drizzle + pg Pool
│   ├── auth.ts              # JWT + PBKDF2
│   └── scheduler.ts         # Hourly notification cron
├── shared/
│   └── schema.ts            # Drizzle schema + Zod types
├── widgets/
│   ├── ios/
│   │   └── FinWiseWidget.swift
│   └── windows/
│       ├── main.js
│       ├── preload.js
│       ├── widget.html
│       └── package.json
├── infra/
│   ├── docker-compose.yml
│   └── Dockerfile
├── .env.example
└── README.md
```

---

## API-эндпоинты

### Auth
| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/register` | Регистрация (email, name, password) |
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/logout` | Выход |
| GET | `/api/auth/me` | Текущий пользователь |
| PATCH | `/api/auth/settings` | Настройки уведомлений |

### Счета
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/accounts` | Список счётов |
| POST | `/api/accounts` | Создать счёт |
| PATCH | `/api/accounts/:id` | Обновить счёт |
| DELETE | `/api/accounts/:id` | Архивировать счёт |

### Транзакции, Бюджет, Цели
Существующие эндпоинты сохранены без изменений + расширены фильтрацией по userId в режиме PG.

### Уведомления
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/notifications` | Список уведомлений |
| PATCH | `/api/notifications/:id/read` | Отметить прочитанным |

### Виджет
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/widget/summary` | Сводка для iOS/Windows виджета |

---

## Переменные окружения

| Переменная | Описание | Обязательная |
|-----------|----------|:---:|
| `DATABASE_URL` | PostgreSQL connection string | Нет (demo без) |
| `JWT_SECRET` | Секрет для JWT (≥32 символов) | При DB |
| `PORT` | Порт сервера (по умолчанию 5000) | Нет |
| `NODE_ENV` | `development` / `production` | Нет |
| `SMTP_HOST` | SMTP-сервер для email | Нет |
| `VAPID_PUBLIC_KEY` | Web Push ключ | Нет |

---

## Виджеты

### iOS Widget
Файлы: `widgets/ios/` — SwiftUI Widget Extension для iOS 16+.
Инструкции: `widgets/ios/README.md`

### Windows Widget
Файлы: `widgets/windows/` — Electron приложение.

```bash
cd widgets/windows
npm install
FINWISE_API=http://localhost:5000 npm start
```

Инструкции: `widgets/windows/README.md`

---

## PWA

Приложение можно установить как PWA:
- **Android:** Chrome → «Добавить на главный экран»
- **iOS:** Safari → «Поделиться» → «На экран "Домой"»
- **Desktop:** Chrome → иконка установки в адресной строке
