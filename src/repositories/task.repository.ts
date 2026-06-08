/**
 * TaskRepository — In-Memory реалізація.
 * Зберігає той самий публічний API що й Prisma-версія.
 */
import { CreateTaskDto, UpdateTaskDto, TaskFilterDto } from '../dto/task.dto';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface UserShort { id: string; name: string; email: string; }

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  projectId: string;
  assigneeId: string | null;
  createdById: string;
  assignee: UserShort | null;
  createdBy: UserShort | null;
  createdAt: Date;
  updatedAt: Date;
}

let _tSeq = 1;
function genId(): string { return `t_${Date.now()}_${_tSeq++}`; }

export class TaskRepository {
  private readonly store = new Map<string, Task>();
  // Cache for resolving user names — set by container
  _userResolver?: (id: string) => Promise<UserShort | null>;

  async create(projectId: string, createdById: string, data: CreateTaskDto): Promise<Task> {
    const assignee = data.assigneeId && this._userResolver
      ? await this._userResolver(data.assigneeId)
      : null;
    const createdBy = this._userResolver
      ? await this._userResolver(createdById)
      : null;

    const task: Task = {
      id: genId(),
      title: data.title,
      description: data.description ?? null,
      status: (data.status as TaskStatus) ?? 'TODO',
      priority: (data.priority as TaskPriority) ?? 'MEDIUM',
      dueDate: data.dueDate ?? null,
      projectId,
      assigneeId: data.assigneeId ?? null,
      createdById,
      assignee,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(task.id, task);
    return { ...task };
  }

  async findById(id: string): Promise<Task | null> {
    const t = this.store.get(id);
    return t ? { ...t } : null;
  }

  async findManyByProject(
    projectId: string,
    filter: TaskFilterDto,
  ): Promise<{ items: Task[]; total: number }> {
    let items = [...this.store.values()].filter((t) => t.projectId === projectId);

    if (filter.status) items = items.filter((t) => t.status === filter.status);
    if (filter.priority) items = items.filter((t) => t.priority === filter.priority);
    if (filter.assigneeId) items = items.filter((t) => t.assigneeId === filter.assigneeId);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      items = items.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q),
      );
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    return { items: items.slice(start, start + filter.pageSize).map((t) => ({ ...t })), total };
  }

  async update(id: string, data: UpdateTaskDto): Promise<Task> {
    const task = this.store.get(id);
    if (!task) throw new Error('Task not found');

    if (data.title !== undefined) task.title = data.title;
    if (data.description !== undefined) task.description = data.description ?? null;
    if (data.status !== undefined) task.status = data.status as TaskStatus;
    if (data.priority !== undefined) task.priority = data.priority as TaskPriority;
    if (Object.prototype.hasOwnProperty.call(data, 'dueDate')) task.dueDate = data.dueDate ?? null;
    if (Object.prototype.hasOwnProperty.call(data, 'assigneeId')) {
      task.assigneeId = data.assigneeId ?? null;
      if (data.assigneeId && this._userResolver) {
        task.assignee = await this._userResolver(data.assigneeId);
      } else {
        task.assignee = null;
      }
    }
    task.updatedAt = new Date();
    return { ...task };
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
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

  _clear(): void { this.store.clear(); }
}
