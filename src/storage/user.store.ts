import { User } from '../domain/models';
import { IUserRepository } from '../repositories/interfaces';
import { BaseInMemoryStore } from '../storage/base.store';
import { ConflictError, NotFoundError } from '../domain/errors';

export class InMemoryUserRepository
  extends BaseInMemoryStore<User>
  implements IUserRepository
{
  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const existing = await this.findByEmail(data.email);
    if (existing) throw new ConflictError('Email вже зайнятий');

    const user: User = {
      ...data,
      id: this.generateId(),
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.store.set(user.id, user);
    return this.clone(user);
  }

  async findById(id: string): Promise<User | null> {
    const user = this.store.get(id);
    return user ? this.clone(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return this.clone(user);
      }
    }
    return null;
  }

  async update(id: string, data: Partial<Pick<User, 'name' | 'isActive'>>): Promise<User> {
    const user = this.store.get(id);
    if (!user) throw new NotFoundError('Користувач');
    const updated: User = { ...user, ...data, updatedAt: this.now() };
    this.store.set(id, updated);
    return this.clone(updated);
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) throw new NotFoundError('Користувач');
    this.store.delete(id);
  }

  findAll(): User[] {
    return super.findAll() as User[];
  }
}
