# 📋 Task Manager — In-Memory Architecture

[![CI](https://github.com/YOUR_GITHUB_USERNAME/task-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_GITHUB_USERNAME/task-manager/actions)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=YOUR_GITHUB_USERNAME_task-manager&metric=alert_status)](https://sonarcloud.io/dashboard?id=YOUR_GITHUB_USERNAME_task-manager)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=YOUR_GITHUB_USERNAME_task-manager&metric=coverage)](https://sonarcloud.io/dashboard?id=YOUR_GITHUB_USERNAME_task-manager)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=YOUR_GITHUB_USERNAME_task-manager&metric=bugs)](https://sonarcloud.io/dashboard?id=YOUR_GITHUB_USERNAME_task-manager)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=YOUR_GITHUB_USERNAME_task-manager&metric=code_smells)](https://sonarcloud.io/dashboard?id=YOUR_GITHUB_USERNAME_task-manager)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-224%20passed-brightgreen)](./tests)
[![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)](./coverage/lcov-report/index.html)

> **Курсова робота** · Загорянський М. В. · ФеП-31 · ЛНУ ім. Івана Франка  
> Система управління завданнями на TypeScript з повністю In-Memory архітектурою, GoF патернами, 224 тестами та CI/CD пайплайном.

---

## 📐 Архітектура

```
task-manager/
├── src/
│   ├── domain/
│   │   ├── models.ts          # Сутності: User, Project, Task, Comment, TaskHistory
│   │   └── errors.ts          # AppError, NotFoundError, ForbiddenError, ConflictError...
│   ├── repositories/
│   │   └── interfaces.ts      # IUserRepository, IProjectRepository, ITaskRepository...
│   ├── storage/               # In-Memory імплементації
│   │   ├── base.store.ts      # BaseInMemoryStore<T> — Map + clone + generateId
│   │   ├── user.store.ts      # InMemoryUserRepository
│   │   ├── project.store.ts   # InMemoryProjectRepository (з Map members)
│   │   ├── task.store.ts      # InMemoryTaskRepository (filter, sort, pagination)
│   │   └── comment.store.ts   # InMemoryCommentRepository + InMemoryTaskHistoryRepository
│   ├── strategies/
│   │   └── priority.strategy.ts  # GoF Strategy: 3 алгоритми пріоритету + 3 штрафи
│   ├── observers/
│   │   └── event-bus.ts       # GoF Observer + Singleton: EventBus + 3 observers
│   ├── services/
│   │   ├── auth.service.ts    # Реєстрація, авторизація (PBKDF2 + HS256-like JWT)
│   │   ├── project.service.ts # CRUD проєктів + управління учасниками
│   │   ├── task.service.ts    # CRUD завдань + пріоритизація + штрафи
│   │   └── comment-stats.service.ts  # Коментарі + статистика
│   └── utils/
│       └── crypto.utils.ts    # hashPassword, verifyPassword, signToken, verifyToken
├── tests/
│   ├── helpers.ts             # Фабрики: buildUser, buildProject, buildTask, buildComment
│   └── unit/
│       ├── repositories/stores.test.ts      # ~65 тестів — всі 5 сховищ
│       ├── strategies/priority.strategy.test.ts  # ~45 тестів — всі 6 стратегій
│       ├── observers/event-bus.test.ts       # ~25 тестів — EventBus + 3 observers
│       ├── services/services.test.ts         # ~80 тестів — Auth/Project/Task/Comment/Stats
│       └── utils/crypto.test.ts              # ~20 тестів — crypto + validation
├── docs/
│   └── diagrams/
│       ├── use-case.puml      # Діаграма прецедентів (PlantUML)
│       ├── domain-model.puml  # Модель предметної області
│       ├── class-diagram.puml # Діаграма класів з GoF патернами
│       └── README.md          # Опис діаграм та бізнес-логіки
├── .cursor/rules/
│   ├── architecture.md        # AI-правила: In-Memory архітектура
│   └── testing.md             # AI-правила: стратегія тестування
├── .github/workflows/
│   └── ci.yml                 # CI: lint → test → SonarCloud → Docker
├── .cursorrules               # Глобальні AI-правила
├── Dockerfile                 # Ізольований запуск тестів
├── sonar-project.properties   # SonarCloud конфігурація
└── README.md
```

---

## 🏗️ GoF Патерни

### Strategy — алгоритми пріоритизації та штрафів

```typescript
// Три алгоритми пріоритету:
const ctx = new TaskPriorityContext(new HybridPriorityStrategy());
const ranked = ctx.rankTasks(tasks); // score = 0.6*deadline + 0.4*complexity

// Три алгоритми штрафів:
const penalty = new PenaltyContext(new ExponentialPenaltyStrategy());
const pts = penalty.applyPenalty(overdueTask); // 2^days, max 1024
```

| Стратегія | Алгоритм |
|-----------|----------|
| `DeadlineBasedPriorityStrategy` | Вага за терміновістю дедлайну |
| `ComplexityBasedPriorityStrategy` | Вага за estimatedHours + довжиною опису |
| `HybridPriorityStrategy` | 60% deadline + 40% complexity |
| `LinearPenaltyStrategy` | 1 бал/день прострочення |
| `ExponentialPenaltyStrategy` | 2^days, максимум 1024 |
| `TieredPenaltyStrategy` | Ступінчасті рівні: 5/15/30/50 балів |

### Observer + Singleton — подієва шина

```typescript
const bus = EventBus.getInstance(); // Singleton
bus.subscribe('task.created', new NotificationObserver());
bus.subscribe('task.overdue', new AuditLogObserver());

// Автоматично викликається у TaskService:
bus.notify('task.status_changed', { taskId, oldStatus, newStatus });
```

**Події:** `task.created`, `task.updated`, `task.deleted`, `task.status_changed`,  
`task.overdue`, `task.assigned`, `task.escalated`, `project.created`, `member.added`

---

## 📊 Метрики якості

| Метрика | Результат | Вимога |
|---------|-----------|--------|
| **Тести** | ✅ 224 пройшли | ≥200 |
| **Coverage Statements** | ✅ 95.75% | ≥70% |
| **Coverage Branches** | ✅ 86.29% | ≥70% |
| **Coverage Functions** | ✅ 97.25% | ≥70% |
| **Coverage Lines** | ✅ 97.76% | ≥70% |
| **Bugs** | ✅ 0 | 0 |
| **Vulnerabilities** | ✅ 0 | 0 |
| **TypeScript errors** | ✅ 0 | 0 |

---

## 🚀 CI/CD Пайплайн

```
push/PR
  │
  ├─► lint       TypeScript typecheck + ESLint
  │
  ├─► test       npm run test:ci
  │     │
  │     └──► Artifacts (14-30 днів):
  │           ├── coverage-html-report/   ← HTML звіт покриття
  │           ├── coverage-xml-reports/   ← lcov.info + junit.xml + cobertura
  │           └── coverage-full/          ← всі файли coverage/
  │
  ├─► sonar      SonarCloud Quality Gate
  │     └── qualitygate.wait=true (блокує PR якщо не пройшов)
  │
  └─► docker     docker build (тільки на main)
```

**Branch Protection:** PR не можна змерджити, якщо:
- CI не зелений
- Coverage < 70%
- SonarCloud Quality Gate провалено

---

## ⚙️ Налаштування

```bash
# Встановити залежності
npm install

# Запустити всі тести
npm test

# CI-режим (генерує junit.xml + coverage)
npm run test:ci

# TypeScript перевірка
npm run typecheck

# Lint
npm run lint

# Збірка
npm run build

# Docker (ізольований запуск)
docker build -t task-manager .
docker run --rm task-manager
```

---

## 🔑 SonarCloud інтеграція

1. Зареєструватись на [sonarcloud.io](https://sonarcloud.io)
2. Підключити GitHub репозиторій
3. Додати секрет `SONAR_TOKEN` у Settings → Secrets → Actions
4. Замінити `YOUR_GITHUB_USERNAME` у `sonar-project.properties` та `README.md`

---

## 📁 Деталі In-Memory архітектури

Всі дані зберігаються у `Map<string, T>` в пам'яті процесу:

```typescript
// BaseInMemoryStore<T> — базовий клас для всіх сховищ
protected readonly items: Map<string, T> = new Map();

protected generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
protected clone<U>(obj: U): U {
  return JSON.parse(JSON.stringify(obj)); // deep copy
}
```

**Переваги для тестування:**
- Нульова залежність від БД
- Повна ізоляція між тестами (новий екземпляр = чиста БД)
- Детерміністична поведінка
- Швидкий запуск (~20s для 224 тестів)
