import {
  User, Project, ProjectMember, Task, Comment, TaskHistory, TaskFilterDto,
} from '../domain/models';

// ─── User Repository ──────────────────────────────────────────────────────────

export interface IUserRepository {
  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, data: Partial<Pick<User, 'name' | 'isActive'>>): Promise<User>;
  delete(id: string): Promise<void>;
  findAll(): User[] | Promise<User[]>;
}

// ─── Project Repository ───────────────────────────────────────────────────────

export interface IProjectRepository {
  create(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findAllForUser(userId: string): Promise<Project[]>;
  update(id: string, data: Partial<Pick<Project, 'name' | 'description'>>): Promise<Project>;
  delete(id: string): Promise<void>;

  addMember(projectId: string, userId: string, role?: ProjectMember['role']): Promise<ProjectMember>;
  removeMember(projectId: string, userId: string): Promise<void>;
  findMember(projectId: string, userId: string): Promise<ProjectMember | null>;
  findMembers(projectId: string, userStore?: Map<string, User>): Promise<Array<ProjectMember & { user: User }>>;
  getMemberCount(projectId: string): Promise<number>;
}

// ─── Task Repository ──────────────────────────────────────────────────────────

export interface ITaskRepository {
  create(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  findManyByProject(
    projectId: string,
    filter: TaskFilterDto,
  ): Promise<{ items: Task[]; total: number }>;
  update(id: string, data: Partial<Omit<Task, 'id' | 'createdAt' | 'projectId' | 'createdById'>>): Promise<Task>;
  delete(id: string): Promise<void>;
  findByAssignee(assigneeId: string): Promise<Task[]>;
  countByStatus(projectId: string): Promise<Record<string, number>>;
  countByPriority(projectId: string): Promise<Record<string, number>>;
  findOverdue(projectId: string): Promise<Task[]>;
  deleteByProjectId(projectId: string): Promise<void>;
}

// ─── Comment Repository ───────────────────────────────────────────────────────

export interface ICommentRepository {
  create(data: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Comment>;
  findById(id: string): Promise<Comment | null>;
  findByTask(taskId: string): Promise<Comment[]>;
  update(id: string, content: string): Promise<Comment>;
  delete(id: string): Promise<void>;
  deleteByTaskId(taskId: string): Promise<void>;
}

// ─── History Repository ───────────────────────────────────────────────────────

export interface ITaskHistoryRepository {
  create(data: Omit<TaskHistory, 'id'>): Promise<TaskHistory>;
  findByTask(taskId: string): Promise<TaskHistory[]>;
  deleteByTaskId(taskId: string): Promise<void>;
}
