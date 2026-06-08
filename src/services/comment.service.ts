import { CommentRepository } from '../repositories/comment.repository';
import { TaskRepository } from '../repositories/task.repository';
import { ProjectService } from './project.service';
import { CreateCommentDto, CommentResponseDto } from '../dto/comment.dto';
import { NotFoundError, ForbiddenError } from '../domain/errors';

export class CommentService {
  constructor(
    private readonly comments: CommentRepository,
    private readonly tasks: TaskRepository,
    private readonly projectService: ProjectService,
  ) {}

  async create(userId: string, taskId: string, dto: CreateCommentDto): Promise<CommentResponseDto> {
    const task = await this.tasks.findById(taskId);
    if (!task) throw new NotFoundError('Задача');
    await this.projectService.ensureMember(task.projectId, userId);
    return this.comments.create(taskId, userId, dto.content);
  }

  async listByTask(userId: string, taskId: string): Promise<CommentResponseDto[]> {
    const task = await this.tasks.findById(taskId);
    if (!task) throw new NotFoundError('Задача');
    await this.projectService.ensureMember(task.projectId, userId);
    return this.comments.findByTask(taskId);
  }

  async delete(userId: string, commentId: string): Promise<void> {
    const comment = await this.comments.findById(commentId);
    if (!comment) throw new NotFoundError('Коментар');
    if (comment.authorId !== userId) {
      const task = await this.tasks.findById(comment.taskId);
      if (!task) throw new NotFoundError('Задача');
      const role = await this.projectService.getMemberRole(task.projectId, userId);
      if (role !== 'OWNER') {
        throw new ForbiddenError('Можна видаляти лише власні коментарі');
      }
    }
    await this.comments.delete(commentId);
  }
}
