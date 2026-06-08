// ─────────────────────────────────────────────────────────────────────────────
// Domain Models — Task Manager (In-Memory, без зовнішніх БД)
// ─────────────────────────────────────────────────────────────────────────────

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ProjectRole = 'OWNER' | 'MEMBER';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: Date;
}

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
  estimatedHours: number | null;
  actualHours: number | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskHistory {
  id: string;
  taskId: string;
  userId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: Date;
}

// ─── DTO ─────────────────────────────────────────────────────────────────────

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date;
  assigneeId?: string;
  estimatedHours?: number;
  tags?: string[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date | null;
  assigneeId?: string | null;
  actualHours?: number;
  tags?: string[];
}

export interface TaskFilterDto {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  search?: string;
  page: number;
  pageSize: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority';
  sortDir?: 'asc' | 'desc';
}

export interface CreateCommentDto {
  content: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
}

export interface ProjectResponseDto {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  memberCount?: number;
  taskCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskResponseDto {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  projectId: string;
  assigneeId: string | null;
  createdById: string;
  estimatedHours: number | null;
  actualHours: number | null;
  tags: string[];
  isOverdue: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentResponseDto {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StatsDto {
  totalTasks: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  overdueCount: number;
  completionRate: number;
  avgEstimatedHours: number;
}

export interface AuthTokenDto {
  token: string;
  user: UserResponseDto;
}
