# TaskFlow — Менеджер задач

[![CI](https://github.com/lucizzs/Project_Architectura/actions/workflows/ci.yml/badge.svg)](https://github.com/lucizzs/Project_Architectura/actions)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=lucizzs_Project_Architectura&metric=alert_status)](https://sonarcloud.io/dashboard?id=lucizzs_Project_Architectura)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=lucizzs_Project_Architectura&metric=coverage)](https://sonarcloud.io/dashboard?id=lucizzs_Project_Architectura)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=lucizzs_Project_Architectura&metric=bugs)](https://sonarcloud.io/dashboard?id=lucizzs_Project_Architectura)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=lucizzs_Project_Architectura&metric=code_smells)](https://sonarcloud.io/dashboard?id=lucizzs_Project_Architectura)

Повностековий веб-додаток для управління задачами з Kanban-дошкою, командною роботою та статистикою. Реалізовано за підходами Layered Architecture, Dependency Injection, Repository Pattern, SOLID. Повністю In-Memory — без зовнішніх баз даних.

---

## Зміст

- [Опис системи](#опис-системи)
- [Архітектура](#архітектура)
- [Патерни проектування](#патерни-проектування)
- [Структура проекту](#структура-проекту)
- [Запуск](#запуск)
- [REST API](#rest-api)
- [Тестування](#тестування)
- [CI/CD](#cicd)
- [UML діаграми](#uml-діаграми)

---

## Опис системи

Система вирішує задачу управління проектами та задачами в команді. Ключові бізнес-алгоритми:

**Пріоритизація задач** — три змінні стратегії ранжування (GoF Strategy):
- за значенням поля priority (URGENT=40, HIGH=30, MEDIUM=20, LOW=10)
- за наближенням дедлайну (прострочено=100, менше доби=80, менше 3 днів=60)
- гібридна: 60% пріоритет поля + 40% дедлайн

**Нарахування штрафів за прострочення** — три змінні стратегії (GoF Strategy):
- лінійна: 1 бал за кожен день прострочення
- експоненційна: 2 в степені кількості днів, максимум 1024
- ступінчаста: до 3 днів — 5 балів, до 7 — 15, до 14 — 30, понад 14 — 50

**Подієва система** — EventBus (GoF Observer + Singleton) надсилає події підписникам при кожній зміні задачі, проекту або учасника.

Актори системи: власник проекту (створення, управління учасниками, видалення) та учасник (робота з задачами і коментарями).

---

## Архітектура

Шарувата архітектура з чітким розділенням відповідальності:

```
HTTP Request
    |
Middleware Pipeline
helmet, cors, express.json, static, auth, validate
    |
Controllers  -->  Services  -->  Repositories (In-Memory Map)
                     |
               Patterns Layer
               Strategy, Observer
```

Всі залежності збираються в одному місці — `src/config/container.ts` (Composition Root). Жоден інший модуль не знає про конкретні реалізації — тільки про інтерфейси, що передаються через конструктор.

Сховище даних — `Map<string, Entity>` в оперативній пам'яті. Зовнішні бази даних та API не використовуються. Redis замінено на `InMemoryRedis` з тим самим інтерфейсом `get/setex/del`.

---

## Патерни проектування

### Strategy — `src/patterns/strategy.ts`

Дозволяє підміняти алгоритм пріоритизації або нарахування штрафів без зміни коду сервісу.

```typescript
const ctx = new TaskPriorityContext(new HybridPriorityStrategy());
const ranked = ctx.rank(tasks);

ctx.setStrategy(new DeadlineStrategy());
const reranked = ctx.rank(tasks);
```

Реалізовано 6 конкретних стратегій: `PriorityFieldStrategy`, `DeadlineStrategy`, `HybridPriorityStrategy`, `LinearPenaltyStrategy`, `ExponentialPenaltyStrategy`, `TieredPenaltyStrategy`.

### Observer + Singleton — `src/patterns/observer.ts`

`EventBus` є Singleton і координує підписників на події системи.

```typescript
const bus = EventBus.getInstance();
bus.subscribe('task.created', new NotificationObserver());
bus.subscribe('project.deleted', new AuditLogObserver());
bus.notify('task.status_changed', { taskId, oldStatus, newStatus });
```

Події: `task.created`, `task.updated`, `task.deleted`, `task.status_changed`, `project.created`, `project.deleted`, `member.added`, `member.removed`, `comment.added`.

### Принципи SOLID

| Принцип | Реалізація |
|---------|------------|
| Single Responsibility | Кожен сервіс відповідає за один домен |
| Open/Closed | Нові стратегії додаються без зміни контексту |
| Liskov Substitution | Репозиторії замінні (використовуються моки в тестах) |
| Interface Segregation | DTO для запиту і відповіді різні |
| Dependency Inversion | Сервіси залежать від репозиторіїв через конструктор |

---

## Структура проекту

```
taskflow/
├── src/
│   ├── server.ts               # Точка входу
│   ├── app.ts                  # Фабрика Express-аплікації
│   ├── config/
│   │   ├── env.ts              # Валідація змінних середовища через Zod
│   │   ├── redis.ts            # InMemoryRedis (заміна ioredis)
│   │   └── container.ts        # Composition Root — збирання залежностей
│   ├── domain/
│   │   └── errors.ts           # AppError та 6 спеціалізацій
│   ├── dto/                    # Zod-схеми та типи запитів/відповідей
│   ├── repositories/           # In-Memory реалізації (Map)
│   │   ├── user.repository.ts
│   │   ├── project.repository.ts
│   │   ├── task.repository.ts
│   │   └── comment.repository.ts
│   ├── services/               # Бізнес-логіка
│   │   ├── auth.service.ts
│   │   ├── project.service.ts
│   │   ├── task.service.ts
│   │   ├── comment.service.ts
│   │   └── stats.service.ts
│   ├── controllers/            # Тонкі HTTP-обробники
│   ├── routes/
│   │   └── index.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── validate.middleware.ts
│   │   └── error.middleware.ts
│   ├── patterns/               # GoF патерни
│   │   ├── strategy.ts         # Strategy: пріоритизація + штрафи
│   │   └── observer.ts         # Observer + Singleton: EventBus
│   └── utils/
│       ├── jwt.ts
│       ├── password.ts
│       └── logger.ts
├── tests/
│   ├── setup.ts
│   ├── unit/
│   │   ├── auth.service.test.ts
│   │   ├── project.service.test.ts
│   │   ├── task.service.test.ts
│   │   ├── stats.service.test.ts
│   │   ├── additional.test.ts
│   │   ├── extra.test.ts
│   │   ├── patterns/
│   │   │   ├── strategy.test.ts
│   │   │   └── observer.test.ts
│   │   └── repositories/
│   │       └── repositories.test.ts
│   └── integration/
├── docs/
│   └── diagrams/
│       ├── use-case.puml       # Діаграма прецедентів
│       ├── domain-model.puml   # Модель предметної області
│       ├── class-diagram.puml  # Діаграма класів з GoF патернами
│       └── README.md
├── public/                     # Frontend SPA
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js
│       └── app.js
├── .github/workflows/ci.yml
├── .cursor/rules/
│   ├── architecture.md
│   └── testing.md
├── .cursorrules
├── sonar-project.properties
├── Dockerfile
└── jest.config.js
```

---

## Запуск

```bash
npm install
npm run dev
```

Відкрий `http://localhost:3000`. Демо-акаунт не потрібен — реєструйся через форму.

```bash
# Тести
npm test

# Збірка
npm run build
npm start

# Lint
npm run lint
```

---

## REST API

Базовий префікс: `/api/v1`. Всі маршрути крім `/auth/register` і `/auth/login` вимагають заголовок `Authorization: Bearer <token>`.

### Auth

| Метод | Шлях | Опис |
|-------|------|------|
| POST | /auth/register | Реєстрація `{email, password, name}` |
| POST | /auth/login | Вхід `{email, password}` |
| GET | /auth/me | Поточний користувач |
| GET | /users/search?name= | Пошук користувача за іменем |

### Projects

| Метод | Шлях | Опис |
|-------|------|------|
| GET | /projects | Список проектів |
| POST | /projects | Створити `{name, description?}` |
| GET | /projects/:id | Деталі з лічильниками |
| PATCH | /projects/:id | Оновити (тільки OWNER) |
| DELETE | /projects/:id | Видалити (тільки OWNER) |
| GET | /projects/:id/members | Список учасників |
| POST | /projects/:id/members | Додати `{userId}` |
| DELETE | /projects/:id/members/:userId | Видалити учасника |

### Tasks

| Метод | Шлях | Опис |
|-------|------|------|
| GET | /projects/:id/tasks | Список з фільтрами та пагінацією |
| POST | /projects/:id/tasks | Створити задачу |
| GET | /tasks/:id | Деталі задачі |
| PATCH | /tasks/:id | Оновити |
| DELETE | /tasks/:id | Видалити |

Query-параметри для GET /tasks: `status`, `priority`, `assigneeId`, `search`, `page`, `pageSize`.

### Comments та Stats

| Метод | Шлях | Опис |
|-------|------|------|
| GET | /tasks/:taskId/comments | Коментарі задачі |
| POST | /tasks/:taskId/comments | Додати `{content}` |
| DELETE | /comments/:id | Видалити |
| GET | /projects/:id/stats | Статистика за статусами |
| GET | /healthz | Health check |

---

## Тестування

| Категорія | Файлів | Тестів |
|-----------|--------|--------|
| Юніт — сервіси (з моками) | 4 | 38 |
| Юніт — патерни Strategy | 1 | 40 |
| Юніт — патерни Observer | 1 | 30 |
| Юніт — репозиторії | 1 | 50 |
| Юніт — додаткові | 2 | 42 |
| Всього | 9 | 200 |

Покриття: 92% statements, 77% branches, 91% functions, 94% lines.

```bash
npm test                  # всі тести з coverage
npm run test:unit         # тільки юніт
npm run test:ci           # CI-режим з генерацією junit.xml
```

HTML-звіт покриття після запуску: `coverage/lcov-report/index.html`.

---

## CI/CD

Пайплайн `.github/workflows/ci.yml` запускається при кожному push та pull request.

```
push
  |
  Lint & TypeCheck
  |
  Tests & Coverage
  |     |
  |     Artifacts (30 днів):
  |       coverage-html-report   -- HTML звіт покриття
  |       coverage-xml-reports   -- lcov.info, cobertura, junit.xml
  |       coverage-full          -- вся папка coverage
  |
  SonarCloud Analysis
  |
  Docker Build (тільки main)
```

Branch Protection на `main`: злиття заблоковане якщо CI не зелений або SonarCloud Quality Gate провалено.

---

## UML діаграми

Діаграми у форматі PlantUML знаходяться в `docs/diagrams/`. Для перегляду: [plantuml.com](https://www.plantuml.com/plantuml/uml/) або розширення `jebbs.plantuml` у VS Code.

- `use-case.puml` — діаграма прецедентів, 22 сценарії, 3 актори
- `domain-model.puml` — модель предметної області, всі сутності та зв'язки
- `class-diagram.puml` — діаграма класів з GoF патернами Strategy та Observer
