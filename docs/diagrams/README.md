# UML Діаграми — TaskFlow

Діаграми написані мовою **PlantUML** (`.puml`).

## Перегляд

- [PlantUML Online](https://www.plantuml.com/plantuml/uml/) — вставити вміст файлу
- VS Code: розширення `jebbs.plantuml`
- CLI: `java -jar plantuml.jar *.puml`

## Файли

| Файл | Опис |
|------|------|
| `use-case.puml` | Діаграма прецедентів — актори та 22 сценарії |
| `domain-model.puml` | Модель предметної області — сутності та зв'язки |
| `class-diagram.puml` | Діаграма класів — GoF патерни Strategy + Observer |

## Бізнес-логіка

### Алгоритми пріоритизації (Strategy)

| Стратегія | Алгоритм |
|-----------|----------|
| `PriorityFieldStrategy` | Бал за значенням поля priority (URGENT=40, HIGH=30...) |
| `DeadlineStrategy` | Бал за наближенням дедлайну (прострочено=100, <1дня=80...) |
| `HybridPriorityStrategy` | 60% PriorityField + 40% Deadline |

### Алгоритми штрафів (Strategy)

| Стратегія | Алгоритм |
|-----------|----------|
| `LinearPenaltyStrategy` | 1 бал × кількість днів прострочення |
| `ExponentialPenaltyStrategy` | 2^days, максимум 1024 |
| `TieredPenaltyStrategy` | ≤3 дні → 5б, ≤7 → 15б, ≤14 → 30б, >14 → 50б |

### Подієва система (Observer + Singleton)

`EventBus` (Singleton) надсилає події підписникам:
- `task.created`, `task.updated`, `task.deleted`, `task.status_changed`
- `project.created`, `project.deleted`
- `member.added`, `member.removed`
- `comment.added`
