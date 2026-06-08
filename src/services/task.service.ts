/**
 * TaskService — CRUD задач + пагінація + фільтрація.
 * Делегує перевірку доступу до ProjectService (ensureMember).
 */
import { TaskRepository } from '../repositories/task.repository';
import { ProjectService } from './project.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskFilterDto,
  TaskResponseDto,
  PaginatedResponse,
} from '../dto/task.dto';
import { NotFoundError, ForbiddenError } from '../domain/errors';

export class TaskService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly projectService: ProjectService,
  ) {}

  async create(userId: string, projectId: string, dto: CreateTaskDto): Promise<TaskResponseDto> {
    await this.projectService.ensureMember(projectId, userId);
    const task = await this.tasks.create(projectId, userId, dto);
    return task;
  }

  async getById(userId: string, taskId: string): Promise<TaskResponseDto> {
    const task = await this.tasks.findById(taskId);
    if (!task) throw new NotFoundError('Задача');
    await this.projectService.ensureMember(task.projectId, userId);
    return task;
  }

  async listByProject(
    userId: string,
    projectId: string,
    filter: TaskFilterDto,
  ): Promise<PaginatedResponse<TaskResponseDto>> {
    await this.projectService.ensureMember(projectId, userId);
    const { items, total } = await this.tasks.findManyByProject(projectId, filter);
    return {
      items,
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
    const updated = await this.tasks.update(taskId, dto);
    return updated;
  }

  async delete(userId: string, taskId: string): Promise<void> {
    const task = await this.tasks.findById(taskId);
    if (!task) throw new NotFoundError('Задача');
    const role = await this.projectService.getMemberRole(task.projectId, userId);
    if (!role) throw new ForbiddenError('Ви не є членом проєкту');
    const isOwner = role === 'OWNER';
    const isCreator = task.createdById === userId;
    const isAssignee = task.assigneeId === userId;
    if (!isOwner && !isCreator && !isAssignee) {
      throw new ForbiddenError('Недостатньо прав для видалення задачі');
    }
    await this.tasks.delete(taskId);
  }
}
