import { Project, ProjectMember, User } from '../domain/models';
import { IProjectRepository } from '../repositories/interfaces';
import { BaseInMemoryStore } from '../storage/base.store';
import { NotFoundError } from '../domain/errors';

export class InMemoryProjectRepository
  extends BaseInMemoryStore<Project>
  implements IProjectRepository
{
  private readonly members: Map<string, ProjectMember> = new Map();

  private memberKey(projectId: string, userId: string): string {
    return `${projectId}::${userId}`;
  }

  async create(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const project: Project = {
      ...data,
      id: this.generateId(),
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.store.set(project.id, project);
    // Auto-add owner as OWNER member
    await this.addMember(project.id, data.ownerId, 'OWNER');
    return this.clone(project);
  }

  async findById(id: string): Promise<Project | null> {
    const p = this.store.get(id);
    return p ? this.clone(p) : null;
  }

  async findAllForUser(userId: string): Promise<Project[]> {
    const projectIds = new Set<string>();
    for (const m of this.members.values()) {
      if (m.userId === userId) projectIds.add(m.projectId);
    }
    const result: Project[] = [];
    for (const id of projectIds) {
      const p = this.store.get(id);
      if (p) result.push(this.clone(p));
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async update(id: string, data: Partial<Pick<Project, 'name' | 'description'>>): Promise<Project> {
    const project = this.store.get(id);
    if (!project) throw new NotFoundError('Проєкт');
    const updated: Project = { ...project, ...data, updatedAt: this.now() };
    this.store.set(id, updated);
    return this.clone(updated);
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) throw new NotFoundError('Проєкт');
    this.store.delete(id);
    // Clean up memberships
    for (const [key, m] of this.members.entries()) {
      if (m.projectId === id) this.members.delete(key);
    }
  }

  async addMember(
    projectId: string,
    userId: string,
    role: ProjectMember['role'] = 'MEMBER',
  ): Promise<ProjectMember> {
    const key = this.memberKey(projectId, userId);
    const member: ProjectMember = {
      projectId,
      userId,
      role,
      joinedAt: this.now(),
    };
    this.members.set(key, member);
    return this.clone(member);
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    const key = this.memberKey(projectId, userId);
    this.members.delete(key);
  }

  async findMember(projectId: string, userId: string): Promise<ProjectMember | null> {
    const key = this.memberKey(projectId, userId);
    const m = this.members.get(key);
    return m ? this.clone(m) : null;
  }

  async findMembers(
    projectId: string,
    userStore?: Map<string, User>,
  ): Promise<Array<ProjectMember & { user: User }>> {
    const result: Array<ProjectMember & { user: User }> = [];
    for (const m of this.members.values()) {
      if (m.projectId === projectId) {
        const user = userStore?.get(m.userId);
        if (user) {
          result.push({ ...this.clone(m), user: this.clone(user) });
        }
      }
    }
    return result;
  }

  async getMemberCount(projectId: string): Promise<number> {
    let count = 0;
    for (const m of this.members.values()) {
      if (m.projectId === projectId) count++;
    }
    return count;
  }

  clearMembers(): void {
    this.members.clear();
  }
}
