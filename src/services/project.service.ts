import { IProjectRepository, IUserRepository } from '../repositories/interfaces';
import {
  CreateProjectDto, UpdateProjectDto, ProjectResponseDto, ProjectMember,
} from '../domain/models';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../domain/errors';
import { EventBus } from '../observers/event-bus';
import { sanitizeString } from '../utils/crypto.utils';

export class ProjectService {
  constructor(
    private readonly projects: IProjectRepository,
    private readonly users: IUserRepository,
  ) {}

  async create(userId: string, dto: CreateProjectDto): Promise<ProjectResponseDto> {
    const name = sanitizeString(dto.name, 100);
    if (!name) throw new ValidationError('Назва проєкту не може бути порожньою');

    const project = await this.projects.create({
      name,
      description: dto.description ?? null,
      ownerId: userId,
    });

    EventBus.getInstance().notify({
      event: 'project.created',
      project,
      meta: { userId },
      timestamp: new Date(),
    });

    return this.toDto(project);
  }

  async getById(userId: string, projectId: string): Promise<ProjectResponseDto> {
    await this.ensureMember(projectId, userId);
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Проєкт');
    const memberCount = await this.projects.getMemberCount(projectId);
    return { ...this.toDto(project), memberCount };
  }

  async listForUser(userId: string): Promise<ProjectResponseDto[]> {
    const list = await this.projects.findAllForUser(userId);
    return list.map((p) => this.toDto(p));
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    await this.ensureOwner(projectId, userId);
    if (dto.name !== undefined && !sanitizeString(dto.name)) {
      throw new ValidationError('Назва не може бути порожньою');
    }
    const updated = await this.projects.update(projectId, {
      name: dto.name ? sanitizeString(dto.name, 100) : undefined,
      description: dto.description,
    });
    return this.toDto(updated);
  }

  async delete(userId: string, projectId: string): Promise<void> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundError('Проєкт');
    await this.ensureOwner(projectId, userId);
    await this.projects.delete(projectId);
    EventBus.getInstance().notify({
      event: 'project.deleted',
      project,
      meta: { userId },
      timestamp: new Date(),
    });
  }

  async addMember(ownerId: string, projectId: string, newUserId: string): Promise<void> {
    await this.ensureOwner(projectId, ownerId);
    const user = await this.users.findById(newUserId);
    if (!user) throw new NotFoundError('Користувач');
    const existing = await this.projects.findMember(projectId, newUserId);
    if (existing) throw new ConflictError('Користувач вже є членом проєкту');
    await this.projects.addMember(projectId, newUserId, 'MEMBER');
    EventBus.getInstance().notify({
      event: 'member.added',
      meta: { projectId, newUserId, addedBy: ownerId },
      timestamp: new Date(),
    });
  }

  async removeMember(ownerId: string, projectId: string, targetUserId: string): Promise<void> {
    await this.ensureOwner(projectId, ownerId);
    const member = await this.projects.findMember(projectId, targetUserId);
    if (!member) throw new NotFoundError('Член проєкту');
    if (member.role === 'OWNER') throw new ForbiddenError('Не можна видалити власника проєкту');
    await this.projects.removeMember(projectId, targetUserId);
    EventBus.getInstance().notify({
      event: 'member.removed',
      meta: { projectId, targetUserId, removedBy: ownerId },
      timestamp: new Date(),
    });
  }

  async getMembers(userId: string, projectId: string): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
    await this.ensureMember(projectId, userId);
    const allUsers = await this.users.findAll();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const members = await this.projects.findMembers(projectId, userMap);
    return members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    }));
  }

  async getMemberRole(projectId: string, userId: string): Promise<ProjectMember['role'] | null> {
    const member = await this.projects.findMember(projectId, userId);
    return member?.role ?? null;
  }

  async ensureMember(projectId: string, userId: string): Promise<void> {
    const member = await this.projects.findMember(projectId, userId);
    if (!member) throw new ForbiddenError('Ви не є членом цього проєкту');
  }

  async ensureOwner(projectId: string, userId: string): Promise<void> {
    const member = await this.projects.findMember(projectId, userId);
    if (!member) throw new NotFoundError('Проєкт');
    if (member.role !== 'OWNER') throw new ForbiddenError('Лише власник може виконувати цю операцію');
  }

  private toDto(p: { id: string; name: string; description: string | null; ownerId: string; createdAt: Date; updatedAt: Date }): ProjectResponseDto {
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
