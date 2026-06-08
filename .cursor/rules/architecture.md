# Architecture — In-Memory

Шари: repositories → services → controllers → routes
Кожен шар залежить лише від абстракцій, не від конкретних реалізацій.
Сховища: Map<string, Entity> без зовнішніх БД.
GoF патерни: Strategy (src/patterns/strategy.ts), Observer (src/patterns/observer.ts).
