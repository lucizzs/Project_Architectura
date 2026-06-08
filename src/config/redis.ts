/**
 * Redis замінено на In-Memory кеш (Map).
 * Інтерфейс сумісний з ioredis для збереження StatsService без змін.
 */
export class InMemoryRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  clear(): void { this.store.clear(); }
}

export const redis = new InMemoryRedis();
export async function connectRedis(): Promise<void> {}
export async function disconnectRedis(): Promise<void> {}
