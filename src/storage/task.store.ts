import { Task, TaskFilterDto, TaskStatus, TaskPriority } from '../domain/models';
import { ITaskRepository } from '../repositories/interfaces';
import { BaseInMemoryStore } from '../storage/base.store';
import { NotFoundError } from '../domain/errors';

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export class InMemoryTaskRepository
  extends BaseInMemoryStore<Task>
  implements ITaskRepository
{
  async create(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const task: Task = {
      ...data,
      id: this.generateId(),
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.store.set(task.id, task);
    return this.clone(task);
  }

  async findById(id: string): Promise<Task | null> {
    const t = this.store.get(id);
    return t ? this.clone(t) : null;
  }

  async findManyByProject(
    projectId: string,
    filter: TaskFilterDto,
  ): Promise<{ items: Task[]; total: number }> {
    let tasks = Array.from(this.store.values()).filter((t) => t.projectId === projectId);

    if (filter.status) tasks = tasks.filter((t) => t.status === filter.status);
    if (filter.priority) tasks = tasks.filter((t) => t.priority === filter.priority);
    if (filter.assigneeId) tasks = tasks.filter((t) => t.assigneeId === filter.assigneeId);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false),
      );
    }

    // Sorting
    const sortBy = filter.sortBy ?? 'createdAt';
    const sortDir = filter.sortDir ?? 'desc';
    tasks.sort((a, b) => {
      if (sortBy === 'priority') {
        const diff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
        return sortDir === 'asc' ? -diff : diff;
      }
      const av = a[sortBy] ? new Date(a[sortBy] as Date).getTime() : 0;
      const bv = b[sortBy] ? new Date(b[sortBy] as Date).getTime() : 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    const total = tasks.length;
    const start = (filter.page - 1) * filter.pageSize;
    const items = tasks.slice(start, start + filter.pageSize).map((t) => this.clone(t));

    return { items, total };
  }

  async update(
    id: string,
    data: Partial<Omit<Task, 'id' | 'createdAt' | 'projectId' | 'createdById'>>,
  ): Promise<Task> {
    const task = this.store.get(id);
    if (!task) throw new NotFoundError('Задача');
    const updated: Task = { ...task, ...data, updatedAt: this.now() };
    this.store.set(id, updated);
    return this.clone(updated);
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) throw new NotFoundError('Задача');
    this.store.delete(id);
  }

  async findByAssignee(assigneeId: string): Promise<Task[]> {
    return Array.from(this.store.values())
      .filter((t) => t.assigneeId === assigneeId)
      .map((t) => this.clone(t));
  }

  async countByStatus(projectId: string): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const t of this.store.values()) {
      if (t.projectId === projectId) {
        result[t.status] = (result[t.status] ?? 0) + 1;
      }
    }
    return result;
  }

  async countByPriority(projectId: string): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const t of this.store.values()) {
      if (t.projectId === projectId) {
        result[t.priority] = (result[t.priority] ?? 0) + 1;
      }
    }
    return result;
  }

  async findOverdue(projectId: string): Promise<Task[]> {
    const now = new Date();
    return Array.from(this.store.values())
      .filter(
        (t) =>
          t.projectId === projectId &&
          t.dueDate !== null &&
          new Date(t.dueDate) < now &&
          t.status !== 'DONE' &&
          t.status !== 'CANCELLED',
      )
      .map((t) => this.clone(t));
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    for (const [id, t] of this.store.entries()) {
      if (t.projectId === projectId) this.store.delete(id);
    }
  }
}
