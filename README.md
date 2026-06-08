# Task Manager — In-Memory Architecture

[![CI](https://github.com/lucizzs/Project_Architectura/actions/workflows/ci.yml/badge.svg)](https://github.com/lucizzs/Project_Architectura/actions)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=lucizzs_Project_Architectura&metric=alert_status)](https://sonarcloud.io/dashboard?id=lucizzs_Project_Architectura)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=lucizzs_Project_Architectura&metric=coverage)](https://sonarcloud.io/dashboard?id=lucizzs_Project_Architectura)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=lucizzs_Project_Architectura&metric=bugs)](https://sonarcloud.io/dashboard?id=lucizzs_Project_Architectura)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=lucizzs_Project_Architectura&metric=code_smells)](https://sonarcloud.io/dashboard?id=lucizzs_Project_Architectura)

Система управління завданнями реалізована на TypeScript з повністю In-Memory архітектурою, патернами проектування GoF, 224 модульними тестами та автоматизованим CI/CD пайплайном.

---

## Зміст

- [Опис системи](#опис-системи)
- [Архітектура](#архітектура)
- [Патерни проектування](#патерни-проектування)
- [Структура репозиторію](#структура-репозиторію)
- [Метрики якості](#метрики-якості)
- [CI/CD](#cicd)
- [Запуск проекту](#запуск-проекту)
- [UML діаграми](#uml-діаграми)

---

## Опис системи

Система вирішує задачу управління завданнями в рамках проектів з підтримкою кількох користувачів. Ключові бізнес-алгоритми:

**Пріоритизація завдань** — три змінні стратегії ранжування:
- за терміновістю дедлайну (чим ближче дедлайн, тим вищий пріоритет)
- за складністю (враховує оцінку годин та обсяг опису)
- гібридна (60% вага дедлайну + 40% вага складності)

**Нарахування штрафів за прострочення** — три змінні стратегії:
- лінійна: 1 бал за кожен день прострочення
- експоненційна: 2 в степені кількості днів, максимум 1024
- ступінчаста: 5 / 15 / 30 / 50 балів залежно від тривалості прострочення

**Подієва система** — автоматичні сповіщення та аудит при кожній зміні стану завдання або проекту.

Актори системи: звичайний користувач (реєстрація, управління завданнями, коментарі) та власник проекту (управління проектом, учасниками, bulk-операції).

---

## Архітектура

Проект розділений на чіткі шари з інверсією залежностей через інтерфейси.

```
src/
  domain/
    models.ts              # Сутності: User, Project, Task, Comment, TaskHistory
    errors.ts              # Ієрархія помилок: AppError, NotFoundError, ForbiddenError...
  repositories/
    interfaces.ts          # Контракти: IUserRepository, IProjectRepository, ITaskRepository...
  storage/
    base.store.ts          # Базовий клас InMemoryStore з Map, clone(), generateId()
    user.store.ts          # InMemoryUserRepository
    project.store.ts       # InMemoryProjectRepository
    task.store.ts          # InMemoryTaskRepository з фільтрацією, сортуванням, пагінацією
    comment.store.ts       # InMemoryCommentRepository, InMemoryTaskHistoryRepository
  strategies/
    priority.strategy.ts   # GoF Strategy: алгоритми пріоритету та штрафів
  observers/
    event-bus.ts           # GoF Observer + Singleton: EventBus та три observers
  services/
    auth.service.ts        # Реєстрація, авторизація (PBKDF2 + власна JWT реалізація)
    project.service.ts     # CRUD проектів, управління учасниками
    task.service.ts        # CRUD завдань, пріоритизація, штрафи, bulk-оновлення
    comment-stats.service.ts  # Коментарі та статистика по проекту
  utils/
    crypto.utils.ts        # hashPassword, verifyPassword, signToken, verifyToken
```

Всі дані зберігаються в `Map<string, T>` в оперативній пам'яті. Зовнішні бази даних та API не використовуються. Кожен тест отримує свіжі екземпляри репозиторіїв, що забезпечує повну ізоляцію.

---

## Патерни проектування

### Strategy

Реалізовано в `src/strategies/priority.strategy.ts`. Дозволяє підміняти алгоритм пріоритизації та нарахування штрафів без зміни коду сервісу.

```typescript
// Підміна алгоритму в runtime
const ctx = new TaskPriorityContext(new HybridPriorityStrategy());
const ranked = ctx.rankTasks(tasks);

ctx.setStrategy(new DeadlineBasedPriorityStrategy());
const reranked = ctx.rankTasks(tasks);
```

Інтерфейси: `ITaskPriorityStrategy`, `IPenaltyStrategy`.  
Реалізації пріоритету: `DeadlineBasedPriorityStrategy`, `ComplexityBasedPriorityStrategy`, `HybridPriorityStrategy`.  
Реалізації штрафів: `LinearPenaltyStrategy`, `ExponentialPenaltyStrategy`, `TieredPenaltyStrategy`.

### Observer

Реалізовано в `src/observers/event-bus.ts`. EventBus є Singleton і координує підписників на події системи.

```typescript
const bus = EventBus.getInstance();
bus.subscribe('task.created', new NotificationObserver());
bus.subscribe('task.overdue', new AuditLogObserver());

// Автоматично викликається в TaskService при кожній зміні:
bus.notify('task.status_changed', { taskId, oldStatus, newStatus, userId });
```

Observers: `NotificationObserver` (in-app сповіщення), `AuditLogObserver` (аудит всіх змін), `OverdueCheckerObserver` (автоматичне виявлення прострочених завдань).

Події: `task.created`, `task.updated`, `task.deleted`, `task.status_changed`, `task.overdue`, `task.assigned`, `project.created`, `project.deleted`, `member.added`, `member.removed`.

### Singleton

`EventBus.getInstance()` гарантує єдиний екземпляр шини подій. `EventBus.reset()` використовується в тестах для ізоляції.

---

## Структура репозиторію

```
.
├── src/                          # Вихідний код
├── tests/
│   ├── helpers.ts                # Фабричні функції для тестових даних
│   └── unit/
│       ├── repositories/         # Тести всіх 5 сховищ (~65 тестів)
│       ├── strategies/           # Тести всіх 6 стратегій (~45 тестів)
│       ├── observers/            # Тести EventBus та observers (~25 тестів)
│       ├── services/             # Тести всіх сервісів (~80 тестів)
│       └── utils/                # Тести crypto утиліт (~20 тестів)
├── docs/
│   └── diagrams/
│       ├── use-case.puml         # Діаграма прецедентів
│       ├── domain-model.puml     # Модель предметної області
│       ├── class-diagram.puml    # Діаграма класів з GoF патернами
│       └── README.md             # Опис діаграм та бізнес-алгоритмів
├── .cursor/
│   └── rules/
│       ├── architecture.md       # AI-правила: In-Memory архітектура
│       └── testing.md            # AI-правила: стратегія тестування
├── .github/
│   └── workflows/
│       └── ci.yml                # CI/CD пайплайн
├── .cursorrules                  # Глобальні правила для AI-агентів
├── .eslintrc.json                # ESLint конфігурація
├── Dockerfile                    # Ізольований запуск тестів
├── jest.config.js                # Jest з coverage reporters
├── sonar-project.properties      # SonarCloud конфігурація
├── tsconfig.json                 # TypeScript конфігурація
└── package.json
```

---

## Метрики якості

| Метрика | Результат | Вимога |
|---|---|---|
| Тести | 224 пройшли | 200+ |
| Coverage (statements) | 95.75% | 70% |
| Coverage (branches) | 86.29% | 70% |
| Coverage (functions) | 97.25% | 70% |
| Coverage (lines) | 97.76% | 70% |
| Bugs | 0 | 0 |
| Vulnerabilities | 0 | 0 |
| SonarCloud Quality Gate | Passed | Passed |

---

## CI/CD

Пайплайн запускається при кожному push та pull request.

```
push
  |
  +-- Lint & TypeCheck     TypeScript компіляція + ESLint
  |
  +-- Tests & Coverage     224 тести, генерація coverage звітів
  |     |
  |     +-- Artifacts:
  |           coverage-html-report   HTML звіт (30 днів)
  |           coverage-xml-reports   lcov.info, cobertura, clover (30 днів)
  |           coverage-full          повна папка coverage (14 днів)
  |
  +-- SonarCloud Analysis  статичний аналіз, Quality Gate
  |
  +-- Docker Build         валідація Dockerfile (тільки на main)
```

Branch Protection на `main`: злиття заблоковане якщо CI не зелений або Quality Gate провалено.

---

## Запуск проекту

```bash
# Встановити залежності
npm install

# Запустити всі тести
npm test

# CI-режим з генерацією coverage звітів
npm run test:ci

# Переглянути HTML звіт покриття
open coverage/lcov-report/index.html

# TypeScript перевірка
npm run typecheck

# Lint
npm run lint

# Збірка
npm run build

# Docker
docker build -t task-manager .
docker run --rm task-manager
```

---

## UML діаграми

Діаграми знаходяться в `docs/diagrams/` у форматі PlantUML.

Для перегляду: [PlantUML Online Editor](https://www.plantuml.com/plantuml/uml/) або розширення `jebbs.plantuml` для VS Code.

- `use-case.puml` — діаграма прецедентів з акторами та сценаріями
- `domain-model.puml` — модель предметної області з усіма сутностями та зв'язками
- `class-diagram.puml` — діаграма класів із зображенням патернів Strategy та Observer
