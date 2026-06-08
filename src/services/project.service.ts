import { ProjectRole } from '../repositories/project.repository';
/**
 * ProjectService — бізнес-логіка проєктів та членства.
 * Перевірки доступу (owner/member) виконуються тут, а не в репозиторії.
 */

import { ProjectRepository } from '../repositories/project.repository';
import { UserRepository } from '../repositories/user.repository';
import { CreateProjectDto, UpdateProjectDto, ProjectResponseDto } from '../dto/project.dto';
import { NotFoundError, ForbiddenError, ConflictError } from '../domain/errors';

export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly users: UserRepository,
  ) {}

  async create(userId: string, dto: CreateProjectDto): Promise<ProjectResponseDto> {
    const project = await this.projects.create({
      name: dto.name,
      description: dto.description,
      ownerId: userId,
    });
    return this.toDto(project);
  }

  async getById(userId: string, projectId: string): Promise<ProjectResponseDto> {
    await this.ensureMember(projectId, userId);
    const project = await this.projects.findByIdWithCounts(projectId);
    if (!project) throw new NotFoundError('Проєкт');
    return {
      ...this.toDto(project),
      memberCount: project._count.members,
      taskCount: project._count.tasks,
    };
  }

  async listForUser(userId: string): Promise<ProjectResponseDto[]> {
    const projects = await this.projects.findAllForUser(userId);
    return projects.map((p) => this.toDto(p));
  }

  async update(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    await this.ensureOwner(projectId, userId);
    const updated = await this.projects.update(projectId, dto);
    return this.toDto(updated);
  }

  async delete(userId: string, projectId: string): Promise<void> {
    await this.ensureOwner(projectId, userId);
    await this.projects.delete(projectId);
  }

  async addMember(userId: string, projectId: string, newUserId: string): Promise<void> {
    await this.ensureOwner(projectId, userId);
    const user = await this.users.findById(newUserId);
    if (!user) throw new NotFoundError('Користувач');
    const existing = await this.projects.findMember(projectId, newUserId);
    if (existing) throw new ConflictError('Користувач вже є членом проєкту');
    await this.projects.addMember(projectId, newUserId);
  }

  async getMembers(
    userId: string,
    projectId: string,
  ): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
    await this.ensureMember(projectId, userId);
    return this.projects.findMembers(projectId);
  }

  async removeMember(userId: string, projectId: string, memberUserId: string): Promise<void> {
    await this.ensureOwner(projectId, userId);
    const member = await this.projects.findMember(projectId, memberUserId);
    if (!member) throw new NotFoundError('Член проєкту');
    if (member.role === 'OWNER') {
      throw new ForbiddenError('Не можна видалити власника проєкту');
    }
    await this.projects.removeMember(projectId, memberUserId);
  }

  // ── Допоміжні методи доступу ──

  /** Повертає роль користувача у проєкті або null, якщо він не член. */
  async getMemberRole(projectId: string, userId: string): Promise<ProjectRole | null> {
    const member = await this.projects.findMember(projectId, userId);
    return member?.role ?? null;
  }

  /** Кидає 403, якщо користувач не є членом проєкту. */
  async ensureMember(projectId: string, userId: string): Promise<void> {
    const member = await this.projects.findMember(projectId, userId);
    if (!member) {
      throw new ForbiddenError('Ви не є членом цього проєкту');
    }
  }

  /** Кидає 403, якщо користувач не є власником проєкту. */
  async ensureOwner(projectId: string, userId: string): Promise<void> {
    const member = await this.projects.findMember(projectId, userId);
    if (!member) {
      throw new NotFoundError('Проєкт');
    }
    if (member.role !== 'OWNER') {
      throw new ForbiddenError('Лише власник може виконувати цю операцію');
    }
  }

  private toDto(p: {
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectResponseDto {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      ownerId: p.ownerId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
