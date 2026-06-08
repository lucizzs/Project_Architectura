/**
 * Глобальний setup для Jest.
 * Фіктивні ENV-змінні, щоб модулі що залежать від env могли імпортуватись.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_at_least_16_chars_long';
process.env.LOG_LEVEL = 'fatal';
