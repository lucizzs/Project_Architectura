import { ICommentRepository, ITaskRepository } from '../repositories/interfaces';
import { ProjectService } from './project.service';
import { CommentResponseDto, CreateCommentDto, StatsDto, TaskStatus, TaskPriority } from '../domain/models';
import { NotFoundError, ForbiddenError, ValidationError } from '../domain/errors';
import { sanitizeString } from '../utils/crypto.utils';

// ─── Comment Service ──────────────────────────────────────────────────────────

export class CommentService {
  constructor(
    private readonly comments: ICommentRepository,
    private readonly tasks: ITaskRepository,
    private readonly projectService: ProjectService,
  ) {}

  async create(userId: string, taskId: string, dto: CreateCommentDto): Promise<CommentResponseDto> {
    const task = await this.tasks.findById(taskId);
    if (!task) throw new NotFoundError('Задача');
    await this.projectService.ensureMember(task.projectId, userId);

    const content = sanitizeString(dto.content, 2000);
    if (!content) throw new ValidationError('Коментар не може бути порожнім');

    const comment = await this.comments.create({ content, taskId, authorId: userId });
    return this.toDto(comment);
  }

  async listByTask(userId: string, taskId: string): Promise<CommentResponseDto[]> {
    const task = await this.tasks.findById(taskId);
    if (!task) throw new NotFoundError('Задача');
    await this.projectService.ensureMember(task.projectId, userId);
    const list = await this.comments.findByTask(taskId);
    return list.map((c) => this.toDto(c));
  }

  async update(userId: string, commentId: string, content: string): Promise<CommentResponseDto> {
    const comment = await this.comments.findById(commentId);
    if (!comment) throw new NotFoundError('Коментар');
    if (comment.authorId !== userId) throw new ForbiddenError('Можна редагувати лише свої коментарі');
    const sanitized = sanitizeString(content, 2000);
    if (!sanitized) throw new ValidationError('Коментар не може бути порожнім');
    const updated = await this.comments.update(commentId, sanitized);
    return this.toDto(updated);
  }

  async delete(userId: string, commentId: string): Promise<void> {
    const comment = await this.comments.findById(commentId);
    if (!comment) throw new NotFoundError('Коментар');
    if (comment.authorId !== userId) throw new ForbiddenError('Можна видаляти лише свої коментарі');
    await this.comments.delete(commentId);
  }

  private toDto(c: { id: string; content: string; taskId: string; authorId: string; createdAt: Date; updatedAt: Date }): CommentResponseDto {
    return { id: c.id, content: c.content, taskId: c.taskId, authorId: c.authorId, createdAt: c.createdAt, updatedAt: c.updatedAt };
  }
}

// ─── Stats Service ────────────────────────────────────────────────────────────

export class StatsService {
  constructor(
    private readonly tasks: ITaskRepository,
    private readonly projectService: ProjectService,
  ) {}

  async getProjectStats(userId: string, projectId: string): Promise<StatsDto> {
    await this.projectService.ensureMember(projectId, userId);

    const byStatusRaw = await this.tasks.countByStatus(projectId);
    const byPriorityRaw = await this.tasks.countByPriority(projectId);
    const overdue = await this.tasks.findOverdue(projectId);

    const allStatuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'];
    const allPriorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    const byStatus = Object.fromEntries(
      allStatuses.map((s) => [s, byStatusRaw[s] ?? 0]),
    ) as Record<TaskStatus, number>;

    const byPriority = Object.fromEntries(
      allPriorities.map((p) => [p, byPriorityRaw[p] ?? 0]),
    ) as Record<TaskPriority, number>;

    const totalTasks = allStatuses.reduce((sum, s) => sum + byStatus[s], 0);
    const doneTasks = byStatus['DONE'];
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const { items: allTasks } = await this.tasks.findManyByProject(projectId, { page: 1, pageSize: 10000 });
    const withEstimate = allTasks.filter((t) => t.estimatedHours !== null);
    const avgEstimatedHours =
      withEstimate.length > 0
        ? withEstimate.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0) / withEstimate.length
        : 0;

    return {
      totalTasks,
      byStatus,
      byPriority,
      overdueCount: overdue.length,
      completionRate,
      avgEstimatedHours: Math.round(avgEstimatedHours * 10) / 10,
    };
  }
}
