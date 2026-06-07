import { Comment, TaskHistory } from '../domain/models';
import { ICommentRepository, ITaskHistoryRepository } from '../repositories/interfaces';
import { BaseInMemoryStore } from '../storage/base.store';
import { NotFoundError } from '../domain/errors';

export class InMemoryCommentRepository
  extends BaseInMemoryStore<Comment>
  implements ICommentRepository
{
  async create(data: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Comment> {
    const comment: Comment = {
      ...data,
      id: this.generateId(),
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.store.set(comment.id, comment);
    return this.clone(comment);
  }

  async findById(id: string): Promise<Comment | null> {
    const c = this.store.get(id);
    return c ? this.clone(c) : null;
  }

  async findByTask(taskId: string): Promise<Comment[]> {
    return Array.from(this.store.values())
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((c) => this.clone(c));
  }

  async update(id: string, content: string): Promise<Comment> {
    const comment = this.store.get(id);
    if (!comment) throw new NotFoundError('Коментар');
    const updated: Comment = { ...comment, content, updatedAt: this.now() };
    this.store.set(id, updated);
    return this.clone(updated);
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) throw new NotFoundError('Коментар');
    this.store.delete(id);
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    for (const [id, c] of this.store.entries()) {
      if (c.taskId === taskId) this.store.delete(id);
    }
  }
}

export class InMemoryTaskHistoryRepository
  extends BaseInMemoryStore<TaskHistory>
  implements ITaskHistoryRepository
{
  async create(data: Omit<TaskHistory, 'id'>): Promise<TaskHistory> {
    const entry: TaskHistory = {
      ...data,
      id: this.generateId(),
    };
    this.store.set(entry.id, entry);
    return this.clone(entry);
  }

  async findByTask(taskId: string): Promise<TaskHistory[]> {
    return Array.from(this.store.values())
      .filter((h) => h.taskId === taskId)
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())
      .map((h) => this.clone(h));
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    for (const [id, h] of this.store.entries()) {
      if (h.taskId === taskId) this.store.delete(id);
    }
  }
}
