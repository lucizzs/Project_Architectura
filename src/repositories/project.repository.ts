/**
 * ProjectRepository — In-Memory реалізація.
 * Зберігає той самий публічний API що й Prisma-версія.
 */

export type ProjectRole = 'OWNER' | 'MEMBER';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: Date;
}

let _pSeq = 1;
let _mSeq = 1;
function genPId(): string {
  return `p_${Date.now()}_${_pSeq++}`;
}
function genMId(): string {
  return `m_${Date.now()}_${_mSeq++}`;
}

export class ProjectRepository {
  private readonly projects = new Map<string, Project>();
  private readonly members = new Map<string, ProjectMember>(); // key: `${projectId}_${userId}`

  private memberKey(projectId: string, userId: string): string {
    return `${projectId}_${userId}`;
  }

  async create(data: { name: string; description?: string; ownerId: string }): Promise<Project> {
    const project: Project = {
      id: genPId(),
      name: data.name,
      description: data.description ?? null,
      ownerId: data.ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.set(project.id, project);
    // Auto-add owner as member
    const member: ProjectMember = {
      id: genMId(),
      projectId: project.id,
      userId: data.ownerId,
      role: 'OWNER',
      joinedAt: new Date(),
    };
    this.members.set(this.memberKey(project.id, data.ownerId), member);
    return { ...project };
  }

  async findById(id: string): Promise<Project | null> {
    const p = this.projects.get(id);
    return p ? { ...p } : null;
  }

  async findByIdWithCounts(
    id: string,
  ): Promise<(Project & { _count: { members: number; tasks: number } }) | null> {
    const p = this.projects.get(id);
    if (!p) return null;
    let memberCount = 0;
    for (const m of this.members.values()) {
      if (m.projectId === id) memberCount++;
    }
    return { ...p, _count: { members: memberCount, tasks: 0 } };
  }

  async findAllForUser(userId: string): Promise<Project[]> {
    const result: Project[] = [];
    for (const m of this.members.values()) {
      if (m.userId === userId) {
        const p = this.projects.get(m.projectId);
        if (p) result.push({ ...p });
      }
    }
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return result;
  }

  async update(id: string, data: { name?: string; description?: string | null }): Promise<Project> {
    const p = this.projects.get(id);
    if (!p) throw new Error('Project not found');
    Object.assign(p, data, { updatedAt: new Date() });
    return { ...p };
  }

  async delete(id: string): Promise<void> {
    this.projects.delete(id);
    for (const [key, m] of this.members.entries()) {
      if (m.projectId === id) this.members.delete(key);
    }
  }

  async findMember(projectId: string, userId: string): Promise<ProjectMember | null> {
    const m = this.members.get(this.memberKey(projectId, userId));
    return m ? { ...m } : null;
  }

  async addMember(projectId: string, userId: string): Promise<ProjectMember> {
    const member: ProjectMember = {
      id: genMId(),
      projectId,
      userId,
      role: 'MEMBER',
      joinedAt: new Date(),
    };
    this.members.set(this.memberKey(projectId, userId), member);
    return { ...member };
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    this.members.delete(this.memberKey(projectId, userId));
  }

  async findMembers(
    projectId: string,
  ): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
    // Note: returns member stubs — user data resolved in service layer if needed
    // For compatibility, we store user info at add time via updateMemberUserInfo
    const result: Array<{ id: string; name: string; email: string; role: string }> = [];
    for (const m of this.members.values()) {
      if (m.projectId === projectId) {
        const info = this._userInfoStore.get(m.userId);
        result.push({
          id: m.userId,
          name: info?.name ?? m.userId,
          email: info?.email ?? '',
          role: m.role,
        });
      }
    }
    return result;
  }

  /** Called by ProjectService to cache user info for member listing */
  _userInfoStore = new Map<string, { name: string; email: string }>();

  storeUserInfo(userId: string, name: string, email: string): void {
    this._userInfoStore.set(userId, { name, email });
  }

  updateTaskCount(_projectId: string, _delta: number): void {
    /* stats computed live */
  }

  _clear(): void {
    this.projects.clear();
    this.members.clear();
    this._userInfoStore.clear();
  }
}
