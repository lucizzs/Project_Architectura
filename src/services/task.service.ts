import { ITaskRepository } from '../repositories/interfaces';
import { ProjectService } from './project.service';
import {
  CreateTaskDto, UpdateTaskDto, TaskFilterDto, TaskResponseDto,
  PaginatedResponse, Task, TaskStatus,
} from '../domain/models';
import { NotFoundError, ForbiddenError, ValidationError } from '../domain/errors';
import { EventBus } from '../observers/event-bus';
import { TaskPriorityContext, DeadlineBasedPriorityStrategy, IPenaltyStrategy } from '../strategies/priority.strategy';
import { sanitizeString } from '../utils/crypto.utils';

export class TaskService {
  private readonly priorityCtx = new TaskPriorityContext(new DeadlineBasedPriorityStrategy());

  constructor(
    private readonly tasks: ITaskRepository,
    private readonly projectService: ProjectService,
    private penaltyStrategy?: IPenaltyStrategy,
  ) {}

  setPenaltyStrategy(strategy: IPenaltyStrategy): void {
    this.penaltyStrategy = strategy;
  }

  setPriorityStrategy(strategy: TaskPriorityContext): void {
    // Allows swapping ranking algorithm at runtime (Strategy pattern demo)
    Object.assign(this.priorityCtx, strategy);
  }

  async create(userId: string, projectId: string, dto: CreateTaskDto): Promise<TaskResponseDto> {
    await this.projectService.ensureMember(projectId, userId);

    const title = sanitizeString(dto.title, 200);
    if (!title) throw new ValidationError('Назва задачі не може бути порожньою');

    if (dto.estimatedHours !== undefined && dto.estimatedHours < 0) {
      throw new ValidationError('Оцінка часу не може бути від\'ємною');
    }

    const task = await this.tasks.create({
      title,
      description: dto.description ?? null,
      status: dto.status ?? 'TODO',
      priority: dto.priority ?? 'MEDIUM',
      dueDate: dto.dueDate ?? null,
      projectId,
      assigneeId: dto.assigneeId ?? null,
      createdById: userId,
      estimatedHours: dto.estimatedHours ?? null,
      actualHours: null,
      tags: dto.tags ?? [],
    });

    EventBus.getInstance().notify({ event: 'task.created', task, meta: { userId }, timestamp: new Date() });

    return this.toDto(task);
  }

  async getById(userId: string, taskId: string): Promise<TaskResponseDto> {
    const task = await this.tasks.findById(taskId);
    if (!task) throw new NotFoundError('Задача');
    await this.projectService.ensureMember(task.projectId, userId);
    return this.toDto(task);
  }

  async listByProject(
    userId: string,
    projectId: string,
    filter: TaskFilterDto,
  ): Promise<PaginatedResponse<TaskResponseDto>> {
    await this.projectService.ensureMember(projectId, userId);

    if (filter.page < 1) throw new ValidationError('Номер сторінки повинен бути ≥ 1');
    if (filter.pageSize < 1 || filter.pageSize > 100) throw new ValidationError('Розмір сторінки: 1–100');

    const { items, total } = await this.tasks.findManyByProject(projectId, filter);
    return {
      items: items.map((t) => this.toDto(t)),
      page: filter.page,
      pageSize: filter.pageSize,
      total,
      totalPages: Math.ceil(total / filter.pageSize),
    };
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto): Promise<TaskResponseDto> {
    const task = await this.tasks.findById(taskId);
    if (!task) throw new NotFoundError('Задача');
    await this.projectService.ensureMember(task.projectId, userId);

    if (dto.title !== undefined) {
      const title = sanitizeString(dto.title, 200);
      if (!title) throw new ValidationError('Назва не може бути порожньою');
      dto = { ...dto, title };
    }

    if (dto.actualHours !== undefined && dto.actualHours < 0) {
      throw new ValidationError('Фактичний час не може бути від\'ємним');
    }

    const oldStatus = task.status;
    const updated = await this.tasks.update(taskId, dto);

    EventBus.getInstance().notify({ event: 'task.updated', task: updated, meta: { userId, changes: dto }, timestamp: new Date() });

    if (dto.status && dto.status !== oldStatus) {
      EventBus.getInstance().notify({
        event: 'task.status_changed',
        task: updated,
        meta: { oldStatus, newStatus: dto.status, userId },
        timestamp: new Date(),
      });
    }

    if (dto.assigneeId && dto.assigneeId !== task.assigneeId) {
      EventBus.getInstance().notify({ event: 'task.assigned', task: updated, meta: { assigneeId: dto.assigneeId, userId }, timestamp: new Date() });
    }

    return this.toDto(updated);
  }

  async delete(userId: string, taskId: string): Promise<void> {
    const task = await this.tasks.findById(taskId);
    if (!task) throw new NotFoundError('Задача');

    const role = await this.projectService.getMemberRole(task.projectId, userId);
    if (!role) throw new ForbiddenError('Ви не є членом проєкту');

    const canDelete = role === 'OWNER' || task.createdById === userId || task.assigneeId === userId;
    if (!canDelete) throw new ForbiddenError('Недостатньо прав для видалення задачі');

    await this.tasks.delete(taskId);
    EventBus.getInstance().notify({ event: 'task.deleted', task, meta: { userId }, timestamp: new Date() });
  }

  async getRanked(userId: string, projectId: string): Promise<TaskResponseDto[]> {
    await this.projectService.ensureMember(projectId, userId);
    const { items } = await this.tasks.findManyByProject(projectId, { page: 1, pageSize: 1000 });
    const active = items.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED');
    return this.priorityCtx.rank(active).map((t) => this.toDto(t));
  }

  async getPenalty(userId: string, taskId: string): Promise<number> {
    const task = await this.tasks.findById(taskId);
    if (!task) throw new NotFoundError('Задача');
    await this.projectService.ensureMember(task.projectId, userId);
    return this.penaltyStrategy?.calculatePenalty(task) ?? 0;
  }

  async getOverdue(userId: string, projectId: string): Promise<TaskResponseDto[]> {
    await this.projectService.ensureMember(projectId, userId);
    const overdue = await this.tasks.findOverdue(projectId);
    return overdue.map((t) => this.toDto(t));
  }

  async bulkUpdateStatus(userId: string, projectId: string, taskIds: string[], status: TaskStatus): Promise<number> {
    await this.projectService.ensureMember(projectId, userId);
    let updated = 0;
    for (const id of taskIds) {
      const task = await this.tasks.findById(id);
      if (task && task.projectId === projectId) {
        await this.tasks.update(id, { status });
        updated++;
      }
    }
    return updated;
  }

  private isOverdue(task: Task): boolean {
    return (
      task.dueDate !== null &&
      new Date(task.dueDate) < new Date() &&
      task.status !== 'DONE' &&
      task.status !== 'CANCELLED'
    );
  }

  private toDto(task: Task): TaskResponseDto {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      projectId: task.projectId,
      assigneeId: task.assigneeId,
      createdById: task.createdById,
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      tags: task.tags,
      isOverdue: this.isOverdue(task),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
