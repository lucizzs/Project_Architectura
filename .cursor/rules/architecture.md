# Architecture — Task Manager (In-Memory)

## Принцип: No External Dependencies

Всі дані зберігаються в пам'яті процесу через `Map<string, T>`.
Немає PostgreSQL, Redis, MongoDB або будь-якого зовнішнього сховища.

## Шари (Layers)

```
┌─────────────────────────────────────────────────────┐
│  domain/   ← Моделі (User, Task, Project), Errors  │
│            ← Чиста бізнес-логіка, 0 залежностей    │
├─────────────────────────────────────────────────────┤
│  repositories/ ← Інтерфейси IUserRepo, ITaskRepo   │
│            ← Контракти (Dependency Inversion)       │
├─────────────────────────────────────────────────────┤
│  storage/  ← InMemoryUserRepo, InMemoryTaskRepo     │
│            ← Реалізують інтерфейси через Map        │
├─────────────────────────────────────────────────────┤
│  strategies/ ← Strategy pattern                    │
│            ← ITaskPriorityStrategy, IPenaltyStrategy│
├─────────────────────────────────────────────────────┤
│  observers/ ← Observer pattern                     │
│            ← EventBus (Singleton), IObserver        │
├─────────────────────────────────────────────────────┤
│  services/ ← Бізнес-логіка                        │
│            ← AuthService, ProjectService, TaskService│
└─────────────────────────────────────────────────────┘
```

## GoF Патерни

### Strategy (src/strategies/priority.strategy.ts)
- **Контекст**: `TaskPriorityContext`, `PenaltyContext`
- **Стратегії**:
  - `DeadlineBasedPriorityStrategy` — вага за дедлайном
  - `ComplexityBasedPriorityStrategy` — вага за складністю
  - `HybridPriorityStrategy` — зважена комбінація
  - `LinearPenaltyStrategy` — лінійний штраф
  - `ExponentialPenaltyStrategy` — експоненційний штраф
  - `TieredPenaltyStrategy` — ступеневий штраф
- **Використання**: `taskService.setPenaltyStrategy(new TieredPenaltyStrategy())`

### Observer (src/observers/event-bus.ts)
- **Суб'єкт**: `EventBus` (Singleton)
- **Спостерігачі**:
  - `NotificationObserver` — in-app повідомлення
  - `AuditLogObserver` — журнал аудиту
  - `OverdueCheckerObserver` — авто-детекція прострочення
- **Події**: `task.created`, `task.status_changed`, `task.overdue`, тощо
- **Використання**: `EventBus.getInstance().subscribe('task.created', observer)`

### Singleton (src/observers/event-bus.ts)
- `EventBus.getInstance()` — єдиний екземпляр брокера подій

## SOLID

| Принцип | Де реалізовано |
|---------|---------------|
| SRP | Кожен сервіс відповідає за одну сутність |
| OCP | Нові стратегії без зміни TaskService |
| LSP | InMemoryXxxRepo замінює IXxxRepository |
| ISP | IUserRepository, ITaskRepository — окремі |
| DIP | Services залежать від інтерфейсів, не від класів |

## In-Memory Storage

```typescript
class BaseInMemoryStore<T extends { id: string }> {
  protected readonly store: Map<string, T> = new Map();
  // clone() — повертає deep copy, запобігає мутаціям
  // generateId() — randomUUID()
}
```

Всі repository повертають **клони** об'єктів (deep copy через JSON serialize/deserialize).
Це гарантує immutability зовні сховища.
