# UML Діаграми — Task Manager

Усі діаграми написані мовою **PlantUML** (`.puml`). Для рендерингу:
- [PlantUML Online Editor](https://www.plantuml.com/plantuml/uml/)
- VS Code розширення: `jebbs.plantuml`
- CLI: `java -jar plantuml.jar *.puml`

## Файли

| Файл | Опис |
|------|------|
| `use-case.puml` | Діаграма прецедентів (Use Case Diagram) |
| `domain-model.puml` | Модель предметної області (Domain Model) |
| `class-diagram.puml` | Діаграма класів з GoF патернами (Strategy + Observer) |

## Use Case Summary

**Актори:**
- **Користувач** — базові дії: реєстрація, завдання, коментарі
- **Власник проєкту** — управління проєктом і учасниками
- **Адміністратор** — системні операції

**Ключові сценарії:**
1. UC-01/02 — Реєстрація та авторизація (JWT)
2. UC-04/05/06 — CRUD проєктів
3. UC-10…18 — Повний цикл управління завданнями (зі Strategy)
4. UC-19…21 — Система коментарів
5. UC-22/23 — Статистика та аналітика прострочених

## Бізнес-логіка (алгоритми)

### Алгоритм пріоритизації (Strategy Pattern)
```
DeadlineBasedPriority: score = basePriority + urgency(dueDate)
ComplexityBased:       score = estimatedHours * 1.5 + descriptionLength / 50
Hybrid (default):      score = 0.6 * deadline + 0.4 * complexity
```

### Алгоритми штрафів (Strategy Pattern)
```
Linear:      penalty = daysOverdue * 1
Exponential: penalty = min(2^daysOverdue, 1024)
Tiered:      ≤3 дні → 5pts, ≤7 → 15pts, ≤14 → 30pts, >14 → 50pts
```
