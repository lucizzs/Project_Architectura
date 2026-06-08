/**
 * UserRepository — In-Memory реалізація.
 * Зберігає той самий публічний API що й Prisma-версія.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

let _seq = 1;
function genId(): string {
  return `u_${Date.now()}_${_seq++}`;
}

export class UserRepository {
  private readonly store = new Map<string, User>();

  async create(data: { email: string; passwordHash: string; name: string }): Promise<User> {
    const user: User = {
      id: genId(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(user.id, user);
    return { ...user };
  }

  async findById(id: string): Promise<User | null> {
    const u = this.store.get(id);
    return u ? { ...u } : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const u of this.store.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return { ...u };
    }
    return null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }

  async findByName(name: string): Promise<User | null> {
    for (const u of this.store.values()) {
      if (u.name.toLowerCase() === name.toLowerCase()) return { ...u };
    }
    return null;
  }

  async searchByName(query: string): Promise<Pick<User, 'id' | 'name' | 'email'>[]> {
    const q = query.toLowerCase();
    const results: Pick<User, 'id' | 'name' | 'email'>[] = [];
    for (const u of this.store.values()) {
      if (u.name.toLowerCase().includes(q)) {
        results.push({ id: u.id, name: u.name, email: u.email });
        if (results.length >= 10) break;
      }
    }
    return results;
  }

  /** Для тестів — очищає сховище */
  _clear(): void {
    this.store.clear();
  }
}
