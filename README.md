# TaskFlow — Менеджер задач

[![CI](https://github.com/lucizzs/qq/actions/workflows/ci.yml/badge.svg)](https://github.com/lucizzs/qq/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/node-20.x-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-5.6-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/postgres-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/redis-7-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-lightgrey)
![Tests](https://img.shields.io/badge/tests-69%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-84%25-yellowgreen)

> Повностековий веб-додаток для управління задачами з Kanban-дошкою, командною роботою, аутентифікацією та статистикою. Реалізовано за сучасними підходами проєктування архітектури (Layered/Clean Architecture, Dependency Injection, Repository, DTO, SOLID), повністю контейнеризований через Docker та автоматизований через CI/CD.

> **Курсова робота** на тему «Розробка веб-додатку менеджера задач з застосуванням сучасних підходів проєктування архітектури». Лабораторна робота №6 з предмета «Аналіз та рефакторинг» — DevOps, CI/CD, Docker, тестування.
>
> **Автор:** Загорянський М. В., група ФеП-31, ЛНУ ім. І. Франка.

---

## 📋 Зміст

1. [Особливості](#-особливості)
2. [Архітектура](#%EF%B8%8F-архітектура)
3. [Стек технологій](#%EF%B8%8F-стек-технологій)
4. [Швидкий старт](#-швидкий-старт)
5. [Встановлення](#-встановлення)
   - [Через Docker (рекомендовано)](#через-docker-рекомендовано)
   - [Локально без Docker](#локально-без-docker)
6. [Конфігурація](#%EF%B8%8F-конфігурація)
7. [REST API](#-rest-api)
8. [Frontend (SPA)](#%EF%B8%8F-frontend-spa)
9. [База даних](#-база-даних)
10. [Структура проєкту](#-структура-проєкту)
11. [Тестування](#-тестування)
12. [CI/CD конвеєр](#-cicd-конвеєр)
13. [Docker](#-docker)
14. [Розробка](#-розробка)
15. [Перевірка результату](#-перевірка-результату)
16. [Troubleshooting](#-troubleshooting)
17. [Безпека](#-безпека)
18. [Автор та ліцензія](#-автор-та-ліцензія)

---

## ✨ Особливості

### Функціональні

- 🔐 **Аутентифікація через JWT** — реєстрація, логін, stateless-токени з терміном життя
- 👥 **Командна робота** — проєкти з ролями OWNER/MEMBER, додавання і видалення членів
- 📋 **Задачі з Kanban-дошкою** — 4 статуси (TODO, IN_PROGRESS, IN_REVIEW, DONE), drag&drop у UI
- 🎯 **Пріоритети та терміни** — 4 рівні (LOW, MEDIUM, HIGH, URGENT), дедлайни, призначення на користувача
- 💬 **Коментарі** до задач
- 🏷️ **Теги** з кольорами для категоризації задач
- 🔍 **Фільтрація та пошук** — за статусом, пріоритетом, призначеним, текстом
- 📄 **Пагінація** на серверній стороні
- 📊 **Статистика** проєкту з кешуванням у Redis (TTL 60 с)
- 👤 **Пошук користувачів** за іменем для додавання у проєкт

### Технічні

- 🏛️ **Шарувата архітектура** — чіткий поділ Controller → Service → Repository
- 💉 **Dependency Injection** через composition root, без рантайм-контейнерів
- 📦 **DTO + Zod-валідація** усіх вхідних даних
- ⚠️ **Типізовані доменні помилки** (AppError, NotFoundError, ConflictError тощо)
- 🛡️ **Security headers** (Helmet з CSP), CORS, bcrypt для паролів
- 📝 **Structured logging** через Pino з JSON у production
- 🛑 **Graceful shutdown** з закриттям з'єднань
- ✅ **69 тестів** (38 юніт + 31 інтеграційний), покриття 84% / 86%
- 🐳 **Multi-stage Dockerfile** з non-root user
- 🚀 **CI/CD** через GitHub Actions з 3 етапами

---

## 🏗️ Архітектура

### Шарова структура (Layered/Clean Architecture)

```
                          ┌─────────────────────────┐
   HTTP Request           │   Браузер / Postman     │
        │                 └────────────┬────────────┘
        ▼                              │
┌──────────────────────────────────────▼──────────────┐
│           Middleware Pipeline                       │
│  helmet → cors → express.json → static → pino-http  │
│  → authMiddleware → validateMiddleware              │
└──────────────────────────────────────┬──────────────┘
                                       │
                                       ▼
┌───────────────┐    ┌───────────────┐    ┌──────────────────┐
│  Controllers  │───▶│   Services    │───▶│  Repositories    │
│  (тонкі)      │    │ (бізнес-      │    │ (доступ до даних)│
│               │    │  логіка,      │    │                  │
│  - валідація  │    │  перевірка    │    │  - Prisma запити │
│  - HTTP-коди  │    │  прав,        │    │  - типобезпека   │
│  - response   │    │  оркестрація) │    │                  │
└───────────────┘    └───────┬───────┘    └──────────┬───────┘
                             │                       │
                             ▼                       ▼
                     ┌───────────────┐     ┌──────────────────┐
                     │  Redis (кеш)  │     │ PostgreSQL (db)  │
                     └───────────────┘     └──────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────┐
│           Global Error Middleware                   │
│   AppError → структурована JSON-відповідь           │
│   Prisma errors → 404/409                           │
│   Невідомі помилки → log + 500                      │
└─────────────────────────────────────────────────────┘
```

### Принципи

| Принцип | Реалізація |
|---|---|
| **Single Responsibility** | Кожен сервіс відповідає за один домен (Auth, Project, Task...) |
| **Open/Closed** | Інтерфейси DTO; розширюваність через DI |
| **Liskov Substitution** | Repository інтерфейси замінювані (можна підставити Mock) |
| **Interface Segregation** | DTO для request/response різні, не одна «жирна» модель |
| **Dependency Inversion** | Сервіси залежать від репозиторіїв через конструктор, не імпортують Prisma |
| **DRY** | Доменні помилки, validate middleware — переюзаються |
| **12-Factor App** | Конфіг через ENV, stateless процеси, dev/prod-паритет |

### Composition Root

Усі залежності збираються в одному файлі — `src/config/container.ts`. Це єдиний модуль, що знає про конкретні класи. Решта коду залежить лише від інтерфейсів через конструктор.

```typescript
// src/config/container.ts (спрощено)
export function buildContainer(prisma, redis) {
  const userRepo = new UserRepository(prisma);
  const projectRepo = new ProjectRepository(prisma);
  // ...
  const authService = new AuthService(userRepo);
  const projectService = new ProjectService(projectRepo, userRepo);
  const taskService = new TaskService(taskRepo, projectService);
  // ...
  return {
    authController: new AuthController(authService),
    projectController: new ProjectController(projectService),
    // ...
  };
}
```

---

## 🛠️ Стек технологій

### Backend

| Шар | Технологія | Версія | Призначення |
|-----|-----------|--------|-------------|
| Мова | TypeScript | 5.6 | Статична типізація |
| Runtime | Node.js | 20 LTS | Серверне середовище |
| Веб-фреймворк | Express | 4.21 | HTTP-маршрутизація |
| ORM | Prisma | 5.22 | Типобезпечні запити + міграції |
| БД | PostgreSQL | 16 | Реляційна БД |
| Кеш | Redis | 7 | Кешування статистики |
| Валідація | Zod | 3.23 | Schema validation |
| Аутентифікація | jsonwebtoken | 9.0 | JWT токени |
| Хешування | bcryptjs | 2.4 | Паролі |
| Логування | Pino + pino-http | 9.5 | Структуровані JSON-логи |
| Безпека | Helmet | 8.0 | Security headers + CSP |
| CORS | cors | 2.8 | Cross-Origin |

### Frontend

| Технологія | Призначення |
|-----------|-------------|
| Vanilla JavaScript (ES2020+) | SPA без фреймворків |
| HTML5 / CSS3 | Розмітка та стилі |
| Google Fonts (Syne + DM Sans) | Кастомна типографіка |
| Fetch API + localStorage | HTTP-клієнт + збереження токена |

### DevOps / Tooling

| Інструмент | Призначення |
|-----------|-------------|
| Docker + docker-compose | Контейнеризація |
| GitHub Actions | CI/CD |
| GitHub Container Registry | Реєстр Docker-образів |
| Jest + ts-jest | Тестовий runner |
| Supertest | HTTP-інтеграційні тести |
| ESLint + Prettier | Лінтер + форматтер |
| tsx | Hot reload у dev |

---

## 🚀 Швидкий старт

Найшвидший спосіб запустити все — через Docker. Потрібен лише встановлений Docker Desktop.

```bash
# 1. Клонувати репозиторій
git clone https://github.com/lucizzs/qq.git task-manager
cd task-manager

# 2. Скопіювати приклад .env
cp .env.example .env

# 3. Запустити стек (БД + кеш + додаток)
docker-compose up -d --build

# 4. Перевірити роботу
open http://localhost:3000
# або:
curl http://localhost:3000/healthz
# → {"status":"ok","uptime":12.5}
```

Чекати ≈10–15 секунд на старті — додаток накатує міграції у БД та піднімає сервер.

---

## 📦 Встановлення

### Через Docker (рекомендовано)

**Передумови:** Docker Desktop (Mac/Windows) або docker + docker-compose plugin (Linux).

#### 1. Підготовка змінних середовища

```bash
cp .env.example .env
```

Відкрий `.env` у редакторі та змінити для production-режиму:

- `JWT_SECRET` — мінімум 32 випадкових символи (наприклад: `openssl rand -hex 32`)
- `POSTGRES_PASSWORD` — надійний пароль БД

Для локальної розробки можна залишити дефолтні значення.

#### 2. Запуск стеку

```bash
docker-compose up -d --build
```

Це збере образ додатку та запустить три контейнери:

| Контейнер | Сервіс | Порт | Стан |
|-----------|--------|------|------|
| `taskmgr-db` | PostgreSQL 16 | 5432 | healthcheck активний |
| `taskmgr-redis` | Redis 7 | 6379 | healthcheck активний |
| `taskmgr-app` | TaskFlow Node.js | 3000 | стартує після БД+кешу |

Перевірити стан:

```bash
docker-compose ps
```

Очікувано: всі три у стані `Up` / `Healthy`.

#### 3. Перегляд логів

```bash
docker-compose logs -f app
# Шукати: "Сервер запущено: http://localhost:3000"
```

#### 4. Зупинка

```bash
docker-compose down       # зупинити контейнери
docker-compose down -v    # + видалити томи (всі дані пропадуть)
```

#### 5. Додаткові інструменти (профіль `dev-tools`)

Запустити Adminer — веб-UI для перегляду БД:

```bash
docker-compose --profile dev-tools up -d adminer
```

Відкрити `http://localhost:8080` →
- **Система:** PostgreSQL
- **Сервер:** `db`
- **Користувач:** `taskmgr` (з .env)
- **Пароль:** з .env
- **База:** `taskmgr`

### Локально (без Docker)

**Передумови:**
- Node.js ≥ 20 LTS
- npm ≥ 10
- Локальний PostgreSQL 14+
- Локальний Redis 6+ (опціонально — fallback працює)

#### 1. Встановлення залежностей

```bash
npm install
```

#### 2. Генерація Prisma client

```bash
npm run prisma:generate
```

Це створює типізованого клієнта в `node_modules/@prisma/client`.

#### 3. Налаштування БД

Створи БД у локальній Postgres:

```bash
createdb taskmgr
```

#### 4. Підготовка .env

```bash
cp .env.example .env
```

Відредагуй `DATABASE_URL`:

```env
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASS@localhost:5432/taskmgr?schema=public
```

#### 5. Накат міграцій

```bash
npm run prisma:migrate:dev
```

Це створить усі таблиці та (опціонально) запустить seed.

#### 6. Заповнення демо-даними (опціонально)

```bash
npm run prisma:seed
```

Створить двох користувачів та один проєкт з задачами. Логін:
- `alice@example.com` / `password123`
- `bob@example.com` / `password123`

#### 7. Запуск у dev-режимі (hot reload)

```bash
npm run dev
```

Сервер слухатиме на `http://localhost:3000`. При зміні файлів автоматично перезапускається.

#### 8. Запуск у production-режимі

```bash
npm run build    # tsc → dist/
npm start        # node dist/src/server.js
```

---

## ⚙️ Конфігурація

### Змінні середовища

Усі змінні валідуються через Zod при старті — якщо обов'язкова відсутня або значення некоректне, додаток одразу впаде з зрозумілою помилкою (принцип fail-fast).

| Змінна | Тип | Обов'язкова | За замовч. | Опис |
|--------|-----|------------|-----------|------|
| `NODE_ENV` | enum | ні | `development` | `development` \| `production` \| `test` |
| `PORT` | int > 0 | ні | `3000` | HTTP-порт сервера |
| `DATABASE_URL` | URL | **так** | — | Повний connection string PostgreSQL (формат `postgresql://user:pass@host:port/db?schema=public`) |
| `POSTGRES_USER` | string | для compose | `taskmgr` | Логін БД (для docker-compose) |
| `POSTGRES_PASSWORD` | string | для compose | `changeme_in_prod` | Пароль БД — **обов'язково змінити** для production |
| `POSTGRES_DB` | string | для compose | `taskmgr` | Назва БД |
| `POSTGRES_PORT` | int | ні | `5432` | Порт БД |
| `REDIS_URL` | URL | ні | `redis://localhost:6379` | URL Redis |
| `REDIS_PORT` | int | ні | `6379` | Порт Redis |
| `JWT_SECRET` | string ≥ 16 | **так** | — | Секрет для підпису JWT. Рекомендовано 32+ символів (`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | string | ні | `7d` | Термін життя токена (`1h`, `7d`, `30d` тощо) |
| `BCRYPT_ROUNDS` | int 4–15 | ні | `10` | Кількість раундів bcrypt (більше = повільніше + безпечніше) |
| `LOG_LEVEL` | enum | ні | `info` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` |

### Приклад .env

```env
NODE_ENV=production
PORT=3000

POSTGRES_USER=taskmgr
POSTGRES_PASSWORD=your_strong_password_here
POSTGRES_DB=taskmgr
DATABASE_URL=postgresql://taskmgr:your_strong_password_here@db:5432/taskmgr?schema=public

REDIS_URL=redis://redis:6379

JWT_SECRET=please_run_openssl_rand_hex_32_and_paste_here_at_least_32_chars
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

LOG_LEVEL=info
```

---

## 🔌 REST API

Базовий префікс — `/api/v1`. Усі ендпоінти, крім `/auth/register` та `/auth/login`, вимагають заголовок:

```
Authorization: Bearer <jwt-token>
```

Структура помилок:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Невірні дані запиту",
    "details": { "email": ["Невірний формат email"] }
  }
}
```

Коди помилок: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `VALIDATION_ERROR` (422), `INTERNAL_ERROR` (500).

### Auth

| Метод | Шлях | Body | Відповідь | Опис |
|-------|------|------|-----------|------|
| `POST` | `/auth/register` | `{email, password, name}` | `201 {user, accessToken}` | Реєстрація користувача |
| `POST` | `/auth/login` | `{email, password}` | `200 {user, accessToken}` | Логін |
| `GET` | `/auth/me` | — | `200 {id, email, name}` | Поточний користувач |

**Валідація register:** `email` валідний, `password` ≥ 8 символів, `name` ≥ 1 символ.

### Users

| Метод | Шлях | Опис |
|-------|------|------|
| `GET` | `/users/search?name=Ali` | Пошук користувача за частковим іменем (case-insensitive, до 10 результатів) |

### Projects

| Метод | Шлях | Body | Опис |
|-------|------|------|------|
| `GET` | `/projects` | — | Список проєктів поточного користувача |
| `POST` | `/projects` | `{name, description?}` | Створити (творець стає OWNER) |
| `GET` | `/projects/:id` | — | Деталі + memberCount + taskCount |
| `PATCH` | `/projects/:id` | `{name?, description?}` | Оновити (тільки OWNER) |
| `DELETE` | `/projects/:id` | — | Видалити (тільки OWNER) — каскадно знищить задачі, коментарі, теги |

### Members

| Метод | Шлях | Body | Опис |
|-------|------|------|------|
| `GET` | `/projects/:id/members` | — | Список членів з ролями |
| `POST` | `/projects/:id/members` | `{userId}` | Додати члена (тільки OWNER) |
| `DELETE` | `/projects/:id/members/:userId` | — | Видалити члена (тільки OWNER, не можна видалити власника) |

### Tasks

| Метод | Шлях | Body | Опис |
|-------|------|------|------|
| `GET` | `/projects/:projectId/tasks?status=&priority=&assigneeId=&search=&page=&pageSize=` | — | Список з фільтрами та пагінацією |
| `POST` | `/projects/:projectId/tasks` | `{title, description?, status?, priority?, dueDate?, assigneeId?}` | Створити задачу |
| `GET` | `/tasks/:id` | — | Деталі задачі |
| `PATCH` | `/tasks/:id` | `{title?, status?, priority?, ...}` | Оновити (учасник проєкту) |
| `DELETE` | `/tasks/:id` | — | Видалити (creator / assignee / OWNER проєкту) |

**Query-параметри для GET /tasks:**
- `status` — `TODO` \| `IN_PROGRESS` \| `IN_REVIEW` \| `DONE`
- `priority` — `LOW` \| `MEDIUM` \| `HIGH` \| `URGENT`
- `assigneeId` — UUID користувача
- `search` — підрядок у title або description (case-insensitive)
- `page` — номер сторінки (≥1, default 1)
- `pageSize` — розмір сторінки (1–100, default 20)

**Відповідь з пагінацією:**

```json
{
  "items": [...],
  "page": 1,
  "pageSize": 20,
  "total": 47,
  "totalPages": 3
}
```

### Comments

| Метод | Шлях | Body | Опис |
|-------|------|------|------|
| `GET` | `/tasks/:taskId/comments` | — | Список коментарів задачі (chronological) |
| `POST` | `/tasks/:taskId/comments` | `{content}` | Додати коментар |
| `DELETE` | `/comments/:id` | — | Видалити (автор або OWNER проєкту) |

### Stats

| Метод | Шлях | Опис |
|-------|------|------|
| `GET` | `/projects/:projectId/stats` | Кількість задач по статусах (TTL кешу — 60 с) |

**Відповідь:**

```json
{
  "projectId": "uuid",
  "byStatus": { "TODO": 5, "IN_PROGRESS": 2, "DONE": 12 },
  "total": 19,
  "cached": false
}
```

### Health

| Метод | Шлях | Опис |
|-------|------|------|
| `GET` | `/healthz` | Стан сервісу (для Docker healthcheck та CI) |
| `GET` | `/` | Віддача SPA (`public/index.html`) |

### Приклади запитів (curl)

#### Реєстрація + збереження токена

```bash
# Реєстрація
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "password123",
    "name": "Alice"
  }'

# Логін з jq для парсингу
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}' \
  | jq -r .accessToken)

echo "Token: $TOKEN"
```

#### Створення проєкту і задачі

```bash
# Створити проєкт
PROJECT_ID=$(curl -s -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Курсова робота","description":"Менеджер задач"}' \
  | jq -r .id)

# Створити задачу
curl -X POST http://localhost:3000/api/v1/projects/$PROJECT_ID/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Написати README",
    "description": "Детальна документація",
    "priority": "HIGH",
    "status": "IN_PROGRESS"
  }'

# Отримати всі задачі проєкту з фільтром
curl "http://localhost:3000/api/v1/projects/$PROJECT_ID/tasks?status=IN_PROGRESS&page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN"

# Статистика
curl "http://localhost:3000/api/v1/projects/$PROJECT_ID/stats" \
  -H "Authorization: Bearer $TOKEN"
```

#### Додавання члена у проєкт

```bash
# Знайти користувача за іменем
USER_ID=$(curl -s "http://localhost:3000/api/v1/users/search?name=Bob" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.users[0].id')

# Додати його у проєкт
curl -X POST http://localhost:3000/api/v1/projects/$PROJECT_ID/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\"}"

# Подивитись усіх членів проєкту
curl "http://localhost:3000/api/v1/projects/$PROJECT_ID/members" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🖥️ Frontend (SPA)

Single-Page Application написано на **vanilla JavaScript** без використання фреймворків. Загалом 1743 рядки коду.

### Структура

| Файл | Рядків | Опис |
|------|--------|------|
| `public/index.html` | 235 | Розмітка двох екранів: auth (вхід/реєстрація) та app (sidebar + dashboard + projects + kanban + my-tasks) |
| `public/css/style.css` | 736 | Темна тема, кастомні шрифти Syne + DM Sans, glow/grid анімації, кольорова семантика статусів |
| `public/js/api.js` | 55 | Тонкий клієнт REST API із збереженням JWT у localStorage |
| `public/js/app.js` | 717 | State management, маршрутизація між views, модальні вікна, drag&drop для kanban |

### Ключові можливості UI

- 🎨 **Темна тема** з brand-кольорами TaskFlow та анімованим background grid
- 📋 **Дашборд** зі статистикою (всього проєктів, активних задач, виконано, прострочено)
- 🏗️ **Список проєктів** у sidebar з можливістю швидкого створення
- 📊 **Kanban-дошка** з 4 колонками статусів і drag&drop між ними
- 🔍 **Пошук користувача** при додаванні членів проєкту
- ✏️ **Модальні вікна** для створення/редагування задач
- 🎯 **Призначення задач** через автокомпліт
- 💬 **Коментарі** з реальним часом створення
- 🏷️ **Теги** з кастомними кольорами
- 📅 **Дедлайни** з підсвічуванням прострочених
- 🚪 **Авто-логаут** з localStorage при невалідному токені

### Інтеграція з backend

Frontend і backend деплояться як **один Docker-образ** через `express.static`. Це означає:

- Немає окремого frontend-сервера (Nginx/Caddy не потрібен)
- Немає CORS-проблем (домен той самий)
- Один URL для всього: `http://localhost:3000`

API-клієнт зберігає JWT у localStorage (`tf_token`) та автоматично додає його у кожен запит:

```javascript
async request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  const res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  // ...
}
```

---

## 📊 База даних

### Схема

Реляційна модель на PostgreSQL з 7 таблицями:

```
users
  ├─ id (uuid, PK)
  ├─ email (unique)
  ├─ passwordHash
  ├─ name
  ├─ createdAt, updatedAt
  │
  ├─ ownedProjects        → projects.ownerId
  ├─ projectMembers       → project_members.userId
  ├─ assignedTasks        → tasks.assigneeId
  ├─ createdTasks         → tasks.createdById
  └─ comments             → comments.authorId

projects
  ├─ id (uuid, PK)
  ├─ name, description
  ├─ ownerId (FK → users, ON DELETE CASCADE)
  ├─ createdAt, updatedAt
  │
  ├─ members              → project_members.projectId
  ├─ tasks                → tasks.projectId
  └─ tags                 → tags.projectId

project_members  (M:N users ↔ projects)
  ├─ projectId + userId (PK)
  ├─ role (OWNER | MEMBER)
  └─ joinedAt

tasks
  ├─ id (uuid, PK)
  ├─ title, description
  ├─ status (TODO | IN_PROGRESS | IN_REVIEW | DONE)
  ├─ priority (LOW | MEDIUM | HIGH | URGENT)
  ├─ dueDate
  ├─ projectId (FK)
  ├─ assigneeId (FK, nullable)
  ├─ createdById (FK)
  ├─ createdAt, updatedAt
  │
  ├─ comments             → comments.taskId
  └─ tags                 → task_tags.taskId

comments
  ├─ id, content
  ├─ taskId (FK)
  ├─ authorId (FK)
  └─ createdAt

tags
  ├─ id, name, color
  ├─ projectId (FK)
  └─ (projectId, name) — unique

task_tags  (M:N tasks ↔ tags)
  └─ taskId + tagId (PK)
```

Індекси: на всі FK + `tasks.status`, `tasks.assigneeId`.

### Міграції

Усі міграції зберігаються у `prisma/migrations/`. Створення нової міграції:

```bash
npm run prisma:migrate:dev -- --name describe_your_change
```

Накат у production (виконується автоматично в Docker-контейнері при старті):

```bash
npx prisma migrate deploy
```

### Seed-дані

Файл `prisma/seed.ts` створює:

- 2 користувачів (alice, bob) з паролем `password123`
- 1 проєкт «Курсова робота»
- 2 теги (`backend`, `docs`)
- 3 задачі у різних статусах

Запуск:

```bash
npm run prisma:seed
```

⚠️ **Seed очищує всі таблиці перед заповненням!** Використовуй тільки в dev-середовищі.

---

## 📁 Структура проєкту

```
task-manager/
├── Dockerfile                  # Multi-stage build для production
├── Dockerfile.test             # Образ для запуску тестів
├── docker-compose.yaml         # Оркестрація сервісів
├── .dockerignore               # Що не копіювати в образ
├── .gitignore
├── package.json                # Залежності + скрипти
├── package-lock.json
├── tsconfig.json               # Налаштування TypeScript
├── .eslintrc.json              # Правила ESLint
├── .prettierrc                 # Правила Prettier
├── jest.config.js              # Налаштування Jest
├── .env.example                # Шаблон змінних середовища
├── README.md                   # (цей файл)
│
├── .github/
│   └── workflows/
│       └── ci.yml              # CI/CD конвеєр
│
├── prisma/
│   ├── schema.prisma           # Модель домену + ENUM-и
│   ├── seed.ts                 # Демо-дані
│   └── migrations/             # Згенеровані міграції
│
├── src/                        # === Backend ===
│   ├── server.ts               # Точка входу (HTTP + graceful shutdown)
│   ├── app.ts                  # Фабрика Express-аплікації
│   │
│   ├── config/
│   │   ├── env.ts              # Валідація .env через Zod
│   │   ├── database.ts         # Prisma singleton
│   │   ├── redis.ts            # Redis з lazy-connect
│   │   └── container.ts        # Composition Root (DI)
│   │
│   ├── domain/
│   │   └── errors.ts           # AppError + 6 спеціалізацій
│   │
│   ├── dto/                    # Pydantic-подібні DTO + Zod-схеми
│   │   ├── auth.dto.ts
│   │   ├── project.dto.ts
│   │   ├── task.dto.ts
│   │   └── comment.dto.ts
│   │
│   ├── repositories/           # Шар доступу до даних
│   │   ├── user.repository.ts
│   │   ├── project.repository.ts
│   │   ├── task.repository.ts
│   │   └── comment.repository.ts
│   │
│   ├── services/               # Бізнес-логіка
│   │   ├── auth.service.ts
│   │   ├── project.service.ts
│   │   ├── task.service.ts
│   │   ├── comment.service.ts
│   │   └── stats.service.ts
│   │
│   ├── controllers/            # Тонкі обробники HTTP
│   │   ├── auth.controller.ts
│   │   ├── project.controller.ts
│   │   ├── task.controller.ts
│   │   ├── comment.controller.ts
│   │   └── stats.controller.ts
│   │
│   ├── routes/
│   │   └── index.ts            # Об'єднання всіх маршрутів /api/v1
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts      # JWT validation
│   │   ├── validate.middleware.ts  # Zod validation
│   │   └── error.middleware.ts     # Global error handler
│   │
│   └── utils/
│       ├── jwt.ts              # JWT sign/verify
│       ├── password.ts         # bcrypt
│       └── logger.ts           # Pino logger
│
├── public/                     # === Frontend SPA ===
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js              # REST-клієнт
│       └── app.js              # UI логіка
│
└── tests/                      # === Тести ===
    ├── setup.ts                # Глобальний setup (ENV для тестів)
    │
    ├── unit/                   # Юніт-тести з моками (38 тестів)
    │   ├── auth.service.test.ts
    │   ├── project.service.test.ts
    │   ├── task.service.test.ts
    │   └── stats.service.test.ts
    │
    └── integration/            # Інтеграційні через supertest (31 тест)
        ├── helpers.ts          # Утиліти (setup, cleanDatabase, registerUser)
        ├── auth.api.test.ts
        ├── projects.api.test.ts
        └── tasks.api.test.ts
```

---

## 🧪 Тестування

Згідно з вимогами лабораторної роботи реалізовано **двошарову систему тестування**:

| Категорія | Файлів | Тестів | Тривалість |
|-----------|--------|--------|-----------|
| Юніт-тести | 4 | 38 | ≈2.4 с |
| Інтеграційні | 3 | 31 | ≈6.8 с |
| **ВСЬОГО** | **7** | **69** | **≈9.2 с** |

Покриття: **84.5% statements / 86.1% lines** (статистика з `npm run test:unit`). AuthService покрито на 100%.

### Юніт-тести (з моками)

Юніт-тести (Jest + ts-jest) сфокусовані на сервісному шарі — основній бізнес-логіці. Репозиторії підставляються через jest-моки, БД не використовується, тести швидкі (≈2 секунди).

**Що перевіряється:**

- **AuthService** — реєстрація з конфліктом email, логін з правильним/неправильним паролем, getCurrentUser, searchByName з обрізанням пробілів та порожнім запитом, findByName
- **ProjectService** — створення з автододанням OWNER, ensureMember/ensureOwner, оновлення/видалення з перевіркою прав, добавляння/видалення членів з валідаціями, getMembers для учасника та не-учасника
- **TaskService** — створення з перевіркою членства, пагінація, оновлення, видалення з диференціацією прав (OWNER / creator / assignee)
- **StatsService** — використання Redis-кешу, fallback при недоступності кешу, інвалідація

**Запуск:**

```bash
npm run test:unit
```

Очікуваний результат:

```
PASS tests/unit/auth.service.test.ts
PASS tests/unit/project.service.test.ts
PASS tests/unit/task.service.test.ts
PASS tests/unit/stats.service.test.ts

Test Suites: 4 passed, 4 total
Tests:       38 passed, 38 total
Coverage:    84.53% statements, 86.14% lines
```

HTML-звіт покриття: `coverage/lcov-report/index.html`.

### Інтеграційні тести (з реальною БД)

Інтеграційні тести використовують **supertest** для HTTP-запитів до Express-аплікації, підключеної до **реальної PostgreSQL** та Redis. Тестове середовище піднімається через docker-compose, перед усіма тестами накатуються міграції (`npx prisma migrate deploy`), перед кожним тестом — TRUNCATE усіх таблиць у правильному порядку (з урахуванням FK обмежень).

**Сценарії:**

- **auth.api.test.ts** (13 тестів) — POST register (201/409/422), POST login (200/401), GET /me (200/401), GET /users/search з пошуком за частковим іменем
- **projects.api.test.ts** (11 тестів) — CRUD проєктів, перевірка прав OWNER/MEMBER, додавання/видалення членів, конфлікти, доступ до чужих проєктів
- **tasks.api.test.ts** (7 тестів) — Lifecycle задачі (CREATE → UPDATE статусу → DELETE), фільтрація+пагінація, коментарі, статистика з Redis-кешем, /healthz

**Підготовка:**

```bash
# Підняти БД та кеш
docker-compose up -d db redis

# Експортувати ENV
export DATABASE_URL="postgresql://taskmgr:changeme_in_prod@localhost:5432/taskmgr?schema=public"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="test_secret_at_least_16_chars_long"

# Накатати міграції
npx prisma migrate deploy
```

**Запуск:**

```bash
npm run test:integration
```

Очікуваний результат:

```
PASS tests/integration/tasks.api.test.ts
PASS tests/integration/projects.api.test.ts
PASS tests/integration/auth.api.test.ts

Test Suites: 3 passed, 3 total
Tests:       31 passed, 31 total
Time:        6.758 s
```

### Запуск тестів у Docker

Якщо не хочеш встановлювати локально — можна запустити весь набір (lint + unit + integration) у контейнері:

```bash
docker-compose --profile test up --build test
```

Це підніме `db`, `redis` і запустить `taskmgr-test`, який виконає весь пайплайн.

### Команди тестування

| Команда | Опис |
|---------|------|
| `npm test` | Всі тести (юніт + інтеграційні) з coverage |
| `npm run test:unit` | Тільки юніт-тести з coverage |
| `npm run test:integration` | Тільки інтеграційні (потребує БД) |
| `npm run lint` | ESLint + Prettier перевірка |
| `npm run lint:fix` | Автовиправлення форматування |

### Стратегія тестування

**Test Pyramid:**

```
       ┌─ Integration tests
       │  31 тестів, ≈6.8 с
       │  supertest → Express → Prisma → Postgres
       │
       │  ┌─ Unit tests
       │  │  38 тестів, ≈2.4 с
       │  │  jest-mocks, без I/O
       │  │
       │  │  ┌─ Type-checking
       │  │  │  tsc --noEmit
       │  │  │  миттєвий feedback
       │  │  │
```

Юніт-тести швидкі і запускаються при кожному збереженні (CI). Інтеграційні запускаються в pre-push та CI. Це класична піраміда тестування: більше юніт-тестів внизу, менше інтеграційних зверху.

---

## 🤖 CI/CD конвеєр

Файл `.github/workflows/ci.yml` описує конвеєр з **трьох послідовних job'ів**, що автоматично запускається на кожен push або pull request у гілки `main`/`master`.

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions runner: ubuntu-latest                       │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────┐  │
│  │   lint   │───▶│   test   │───▶│       docker         │  │
│  │          │    │          │    │ (тільки на main push)│  │
│  │ ESLint + │    │ + Postgres   │                      │  │
│  │ Prettier │    │ + Redis  │    │  Build image         │  │
│  │          │    │          │    │  Push to GHCR        │  │
│  │ npm ci   │    │ tsc      │    │                      │  │
│  │ prisma   │    │ test:unit│    │  Tags: latest,       │  │
│  │ generate │    │ migrate  │    │   sha-<commit>,      │  │
│  │ lint     │    │ test:int.│    │   <branch>           │  │
│  └──────────┘    └──────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Job 1 — `lint`

Перевіряє якість коду через ESLint + Prettier.

```yaml
- name: Run ESLint
  run: npm run lint
```

Якщо знаходить помилки форматування — пайплайн падає, наступні job'и не запускаються.

### Job 2 — `test`

Запускає TypeScript-перевірку типів та обидва набори тестів.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: test
    options: >-
      --health-cmd "pg_isready -U test"
  redis:
    image: redis:7-alpine
    options: >-
      --health-cmd "redis-cli ping"

steps:
  - name: TypeScript check
    run: npx tsc --noEmit
  - name: Run unit tests with coverage
    run: npm run test:unit
  - name: Run database migrations
    run: npx prisma migrate deploy
  - name: Run integration tests
    run: npm run test:integration
```

Coverage-звіт зберігається як артефакт CI на 7 днів.

### Job 3 — `docker`

Білдить Docker-образ та публікує у GitHub Container Registry (GHCR). Запускається **тільки на push у main/master** (не на PR).

```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    push: true
    tags: |
      ghcr.io/lucizzs/qq:latest
      ghcr.io/lucizzs/qq:sha-${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

Образ доступний для pull після успішного workflow:

```bash
docker pull ghcr.io/lucizzs/qq:latest
```

### Бейдж CI

Бейдж на початку README показує статус останнього workflow на main-гілці. Має відображати ✅ зелений значок при успіху.

---

## 🐳 Docker

### Multi-stage Dockerfile

Образ збирається у **два етапи** для мінімізації фінального розміру:

#### Stage 1 — build

```dockerfile
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get install openssl ca-certificates  # для Prisma
COPY package.json package-lock.json* ./
RUN npm ci                                   # ВСІ залежності
COPY prisma ./prisma
RUN npx prisma generate                      # типізований клієнт
COPY tsconfig.json ./
COPY src ./src
RUN npm run build                            # tsc → dist/
RUN npm prune --omit=dev                     # прибрати dev-deps
```

#### Stage 2 — runtime

```dockerfile
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get install openssl wget             # runtime + healthcheck
RUN useradd nodeapp                          # non-root user

# Копіюємо тільки необхідне
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY public ./public                         # frontend SPA
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./

USER nodeapp                                 # не-root!

HEALTHCHECK CMD wget --spider --quiet http://localhost:3000/healthz

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
```

**Чому multi-stage:**

- Фінальний образ не містить tsc, prisma CLI, dev-залежностей
- Менший розмір → швидший pull/deploy
- Менша поверхня атаки → безпечніше
- Non-root user → захист від container escape

### docker-compose сервіси

```yaml
services:
  db:                  # PostgreSQL 16
    healthcheck: pg_isready
    volumes: postgres_data

  redis:               # Redis 7
    healthcheck: redis-cli ping
    volumes: redis_data

  app:                 # TaskFlow
    depends_on:
      db: service_healthy
      redis: service_healthy
    healthcheck: GET /healthz

  adminer:             # Профіль dev-tools
    profile: dev-tools

  test:                # Профіль test
    profile: test
```

### Профілі docker-compose

| Профіль | Команда запуску | Сервіси |
|---------|---------|---------|
| (default) | `docker-compose up -d` | db + redis + app |
| `dev-tools` | `docker-compose --profile dev-tools up -d` | + adminer (port 8080) |
| `test` | `docker-compose --profile test up test` | db + redis + test runner |

---

## 💻 Розробка

### Корисні npm-скрипти

| Команда | Опис |
|---------|------|
| `npm run dev` | Запуск у dev-режимі з hot reload (tsx) |
| `npm run build` | Компіляція TypeScript → `dist/` |
| `npm start` | Запуск зі скомпільованих файлів |
| `npm run lint` | ESLint + Prettier перевірка |
| `npm run lint:fix` | Автовиправлення помилок форматування |
| `npm run format` | Запуск Prettier --write |
| `npm test` | Усі тести |
| `npm run test:unit` | Юніт-тести з coverage |
| `npm run test:integration` | Інтеграційні (потрібна БД) |
| `npm run prisma:generate` | Згенерувати Prisma client |
| `npm run prisma:migrate` | Накатати міграції у production |
| `npm run prisma:migrate:dev` | Створити нову міграцію у dev |
| `npm run prisma:seed` | Заповнити БД демо-даними |

### Workflow внесення змін

1. **Створи гілку** від `main`:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Зміни код** → перевір локально:
   ```bash
   npm run lint:fix
   npm run test:unit
   ```

3. **Якщо змінив схему БД** — створи міграцію:
   ```bash
   # Відредагуй prisma/schema.prisma
   npm run prisma:migrate:dev -- --name describe_change
   ```

4. **Запусти інтеграційні тести**:
   ```bash
   docker-compose up -d db redis
   npm run test:integration
   ```

5. **Push** → CI відпрацює автоматично:
   ```bash
   git push origin feature/my-feature
   ```

### Рекомендована IDE-конфігурація (VS Code)

`.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

Рекомендовані розширення:

- `dbaeumer.vscode-eslint` — ESLint
- `esbenp.prettier-vscode` — Prettier
- `Prisma.prisma` — Prisma syntax + autocomplete
- `usernamehw.errorlens` — підсвічування помилок

---

## ✅ Перевірка результату

### 1. Через браузер

Відкрий `http://localhost:3000` — побачиш форму логіну/реєстрації TaskFlow.

1. Натисни **«Реєстрація»**, заповни форму, створи акаунт
2. Створи проєкт через **«+ Новий проєкт»** у sidebar
3. У проєкті створи кілька задач **«+ Задача»**
4. Перетягуй задачі між колонками Kanban-дошки
5. Подивись дашборд — статистика оновлюється в реальному часі

### 2. Через Postman / curl

Імпортуй наступну Postman-колекцію або скопіюй curl-команди з розділу [REST API](#-rest-api).

```bash
# Health-check (без авторизації)
curl http://localhost:3000/healthz

# Реєстрація → токен
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123","name":"Test"}'

# Деталі тесту в розділі "REST API → Приклади запитів"
```

### 3. Через Adminer (БД)

```bash
docker-compose --profile dev-tools up -d adminer
```

Відкрий `http://localhost:8080`, логін з параметрами з `.env`. Подивись:

- Таблиця `users` — зареєстровані користувачі
- Таблиця `projects` — створені проєкти
- Таблиця `tasks` — задачі з різними статусами
- Таблиця `project_members` — членство та ролі

### 4. Перегляд логів

```bash
# Логи додатку (з форматуванням Pino)
docker-compose logs -f app

# Логи БД
docker-compose logs -f db

# Все одразу
docker-compose logs -f
```

### 5. CI статус

Перейди на `https://github.com/lucizzs/qq/actions` — побачиш список усіх запущених workflow з зеленими/червоними значками.

---

## 🔍 Troubleshooting

### Connection reset by peer при curl

**Симптом:** одразу після `docker-compose up` curl на `localhost:3000` повертає `Connection reset by peer`.

**Причина:** контейнер запустився, але всередині додаток ще накатує міграції та стартує (≈5–10 с).

**Рішення:** зачекати або використати healthcheck-цикл:

```bash
until curl -fsS http://localhost:3000/healthz >/dev/null 2>&1; do
  echo "waiting..." && sleep 1
done && echo "READY"
```

### Port 3000/5432/6379 already in use

**Симптом:** `Error: bind: address already in use`.

**Причина:** інший процес займає порт.

**Рішення:**

```bash
# Знайти процес
lsof -i :3000

# Або змінити порт у .env
PORT=3001
```

### TypeScript: Cannot find name 'helmet'

**Симптом:** при компіляції падає на рядку `helmet({...})`.

**Причина:** `import helmet from 'helmet';` був видалений автофіксером ESLint.

**Рішення:** додай імпорт назад у `src/app.ts`:

```typescript
import helmet from 'helmet';
```

### Prisma migrate: no migrations to apply

**Симптом:** `npx prisma migrate deploy` каже `No pending migrations to apply` але таблиць немає.

**Рішення:** очисти БД і накатай заново:

```bash
docker-compose down -v   # видалить volume
docker-compose up -d db redis
sleep 5
npx prisma migrate deploy
```

### Тести: Force exiting Jest

**Симптом:** після інтеграційних тестів Jest пише `Force exiting Jest: Have you considered using --detectOpenHandles`.

**Причина:** Prisma connection pool не закрився одразу.

**Рішення:** це warning, не помилка. У package.json вже `--forceExit`. Якщо хочеш чисто — додай у `teardownIntegration()` явні таймаути.

### "/users/search 404" на frontend

**Симптом:** при пошуку користувача у UI повертається 404.

**Причина:** ендпоінт `GET /api/v1/users/search` не зареєстрований у `src/routes/index.ts`.

**Рішення:** перевір, що у routes є рядок:

```typescript
router.get('/users/search', authMiddleware, c.authController.searchUsers);
``