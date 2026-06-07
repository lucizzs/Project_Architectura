# Testing Strategy — Task Manager

## Мета: 200+ тестів, покриття > 70%

## Структура тестів

```
tests/
├── helpers.ts                     # Фабрики, утиліти
└── unit/
    ├── repositories/
    │   └── stores.test.ts         # ~60 тестів — InMemory stores
    ├── strategies/
    │   └── priority.strategy.test.ts  # ~40 тестів — GoF Strategy
    ├── observers/
    │   └── event-bus.test.ts      # ~25 тестів — GoF Observer
    ├── services/
    │   └── services.test.ts       # ~80 тестів — бізнес-логіка
    └── utils/
        └── crypto.test.ts         # ~20 тестів — утиліти
```

## Правила написання тестів

### Для кожного публічного методу писати:
1. **Happy path** — нормальний сценарій
2. **Edge case** — граничні значення (порожній рядок, null, 0)
3. **Error case** — виняткові ситуації (NotFound, Forbidden, Conflict)

### Ізоляція
- Кожен тест створює **нові** екземпляри репозиторіїв
- `beforeEach` скидає `EventBus.reset()`
- Ніяких shared state між тестами

### Mock-об'єкти
- Не мокати InMemory репозиторії — вони самі по собі ізольовані
- Для юніт-тестів сервісів — використовувати реальні InMemory репозиторії
- Мокати тільки зовнішні залежності (якщо з'являться)

### Naming convention
```typescript
it('create — throws ValidationError for empty title', async () => { ... });
it('delete — owner can delete any task', async () => { ... });
it('findOverdue — excludes DONE and CANCELLED tasks', async () => { ... });
```

## Coverage Reports

Jest генерує:
- `coverage/lcov-report/` — HTML (візуальний перегляд)
- `coverage/lcov.info` — для SonarQube
- `coverage/junit.xml` — для SonarQube test execution
- `coverage/cobertura-coverage.xml` — альтернативний XML формат

## CI Coverage Gate

```yaml
# jest.config.js
coverageThresholds:
  global:
    branches: 70
    functions: 70
    lines: 70
    statements: 70
```

Якщо покриття < 70% — CI падає автоматично.

## Шаблон нового тесту

```typescript
describe('NewService', () => {
  let service: NewService;
  let repo: InMemoryXxxRepository;

  beforeEach(() => {
    EventBus.reset();
    repo = new InMemoryXxxRepository();
    service = new NewService(repo);
  });

  it('methodName — happy path', async () => {
    // Arrange
    const input = { ... };
    // Act
    const result = await service.methodName(input);
    // Assert
    expect(result).toBeDefined();
    expect(result.field).toBe(expectedValue);
  });

  it('methodName — throws NotFoundError for unknown id', async () => {
    await expect(service.methodName('ghost-id')).rejects.toThrow(NotFoundError);
  });
});
```
