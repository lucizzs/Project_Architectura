import { randomUUID } from 'crypto';

/**
 * BaseInMemoryStore — абстрактний базовий клас для In-Memory сховищ.
 * Використовує Map для O(1) пошуку за ID.
 */
export abstract class BaseInMemoryStore<T extends { id: string }> {
  protected readonly store: Map<string, T> = new Map();

  protected generateId(): string {
    return randomUUID();
  }

  protected now(): Date {
    return new Date();
  }

  protected clone<V>(obj: V): V {
    return JSON.parse(JSON.stringify(obj, (_key, value) => {
      if (value instanceof Date) return value.toISOString();
      return value;
    }), (_key, value) => {
      // Re-hydrate ISO strings that look like dates
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return new Date(value);
      }
      return value;
    });
  }

  findAll(): T[] {
    return Array.from(this.store.values()).map((item) => this.clone(item));
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
