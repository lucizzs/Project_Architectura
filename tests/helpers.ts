import { User, Project, Task, Comment, ProjectMember, TaskStatus, TaskPriority } from '../src/domain/models';
import { InMemoryUserRepository } from '../src/storage/user.store';
import { InMemoryProjectRepository } from '../src/storage/project.store';
import { InMemoryTaskRepository } from '../src/storage/task.store';
import { InMemoryCommentRepository, InMemoryTaskHistoryRepository } from '../src/storage/comment.store';
import { EventBus } from '../src/observers/event-bus';

// ─── Reset EventBus between tests ─────────────────────────────────────────────
export function resetEventBus(): void {
  EventBus.reset();
}

// ─── Repository Factories ─────────────────────────────────────────────────────
export function makeUserRepo(): InMemoryUserRepository {
  return new InMemoryUserRepository();
}
export function makeProjectRepo(): InMemoryProjectRepository {
  return new InMemoryProjectRepository();
}
export function makeTaskRepo(): InMemoryTaskRepository {
  return new InMemoryTaskRepository();
}
export function makeCommentRepo(): InMemoryCommentRepository {
  return new InMemoryCommentRepository();
}
export function makeHistoryRepo(): InMemoryTaskHistoryRepository {
  return new InMemoryTaskHistoryRepository();
}

// ─── Data Builders ─────────────────────────────────────────────────────────────
let counter = 0;
function uid(): string {
  counter++;
  return `test-id-${counter}-${Date.now()}`;
}

export function buildUser(overrides: Partial<User> = {}): Omit<User, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: `User ${counter}`,
    email: `user${counter}@example.com`,
    passwordHash: 'hash',
    isActive: true,
    ...overrides,
  };
}

export function buildProject(ownerId: string, overrides: Partial<Project> = {}): Omit<Project, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: `Project ${counter}`,
    description: null,
    ownerId,
    ...overrides,
  };
}

export function buildTask(projectId: string, createdById: string, overrides: Partial<Task> = {}): Omit<Task, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: `Task ${counter}`,
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: null,
    projectId,
    assigneeId: null,
    createdById,
    estimatedHours: null,
    actualHours: null,
    tags: [],
    ...overrides,
  };
}

export function buildComment(taskId: string, authorId: string, overrides: Partial<Comment> = {}): Omit<Comment, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    content: 'Test comment',
    taskId,
    authorId,
    ...overrides,
  };
}

export const ALL_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'];
export const ALL_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/** Creates a past Date (overdue) */
export function pastDate(daysAgo = 3): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/** Creates a future Date */
export function futureDate(daysAhead = 7): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d;
}
