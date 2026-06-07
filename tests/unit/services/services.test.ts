import { AuthService } from '../../../src/services/auth.service';
import { ProjectService } from '../../../src/services/project.service';
import { TaskService } from '../../../src/services/task.service';
import { CommentService, StatsService } from '../../../src/services/comment-stats.service';
import { InMemoryUserRepository } from '../../../src/storage/user.store';
import { InMemoryProjectRepository } from '../../../src/storage/project.store';
import { InMemoryTaskRepository } from '../../../src/storage/task.store';
import { InMemoryCommentRepository } from '../../../src/storage/comment.store';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError, UnauthorizedError } from '../../../src/domain/errors';
import { EventBus } from '../../../src/observers/event-bus';
import { LinearPenaltyStrategy, ExponentialPenaltyStrategy, TieredPenaltyStrategy } from '../../../src/strategies/priority.strategy';
import { pastDate, futureDate } from '../../helpers';

// ─── Shared Setup ─────────────────────────────────────────────────────────────

function makeServices() {
  const userRepo = new InMemoryUserRepository();
  const projectRepo = new InMemoryProjectRepository();
  const taskRepo = new InMemoryTaskRepository();
  const commentRepo = new InMemoryCommentRepository();

  const authService = new AuthService(userRepo);
  const projectService = new ProjectService(projectRepo, userRepo);
  const taskService = new TaskService(taskRepo, projectService);
  const commentService = new CommentService(commentRepo, taskRepo, projectService);
  const statsService = new StatsService(taskRepo, projectService);

  return { userRepo, projectRepo, taskRepo, commentRepo, authService, projectService, taskService, commentService, statsService };
}

async function seedUserAndProject(services: ReturnType<typeof makeServices>) {
  const { authService, projectService } = services;
  const { user } = await authService.register({ name: 'Alice', email: 'alice@test.com', password: 'password123' });
  const project = await projectService.create(user.id, { name: 'Test Project' });
  return { user, project };
}

beforeEach(() => EventBus.reset());

// ══════════════════════════════════════════════════════════════════════════════
// AuthService
// ══════════════════════════════════════════════════════════════════════════════
describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = makeServices().authService;
  });

  it('register creates user and returns token', async () => {
    const result = await authService.register({ name: 'Bob', email: 'bob@test.com', password: 'password123' });
    expect(result.token).toBeTruthy();
    expect(result.user.email).toBe('bob@test.com');
  });

  it('register normalizes email to lowercase', async () => {
    const result = await authService.register({ name: 'Bob', email: 'BOB@TEST.COM', password: 'password123' });
    expect(result.user.email).toBe('bob@test.com');
  });

  it('register throws ValidationError for invalid email', async () => {
    await expect(authService.register({ name: 'X', email: 'not-email', password: 'password123' })).rejects.toThrow(ValidationError);
  });

  it('register throws ValidationError for short password', async () => {
    await expect(authService.register({ name: 'X', email: 'x@x.com', password: '123' })).rejects.toThrow(ValidationError);
  });

  it('register throws ValidationError for empty name', async () => {
    await expect(authService.register({ name: '   ', email: 'x@x.com', password: 'password123' })).rejects.toThrow(ValidationError);
  });

  it('register throws ConflictError for duplicate email', async () => {
    await authService.register({ name: 'A', email: 'same@test.com', password: 'password123' });
    await expect(authService.register({ name: 'B', email: 'same@test.com', password: 'password123' })).rejects.toThrow(ConflictError);
  });

  it('login succeeds with correct credentials', async () => {
    await authService.register({ name: 'Alice', email: 'alice@test.com', password: 'mypassword' });
    const result = await authService.login({ email: 'alice@test.com', password: 'mypassword' });
    expect(result.token).toBeTruthy();
    expect(result.user.name).toBe('Alice');
  });

  it('login is case-insensitive for email', async () => {
    await authService.register({ name: 'X', email: 'x@test.com', password: 'password123' });
    const result = await authService.login({ email: 'X@TEST.COM', password: 'password123' });
    expect(result.token).toBeTruthy();
  });

  it('login throws UnauthorizedError for wrong password', async () => {
    await authService.register({ name: 'X', email: 'x@test.com', password: 'correctpw' });
    await expect(authService.login({ email: 'x@test.com', password: 'wrongpw' })).rejects.toThrow(UnauthorizedError);
  });

  it('login throws UnauthorizedError for unknown email', async () => {
    await expect(authService.login({ email: 'nobody@x.com', password: 'pw' })).rejects.toThrow(UnauthorizedError);
  });

  it('login throws UnauthorizedError for deactivated user', async () => {
    const services = makeServices();
    const { user } = await services.authService.register({ name: 'D', email: 'd@d.com', password: 'password123' });
    await services.userRepo.update(user.id, { isActive: false });
    await expect(services.authService.login({ email: 'd@d.com', password: 'password123' })).rejects.toThrow(UnauthorizedError);
  });

  it('getProfile returns user dto', async () => {
    const { user } = await authService.register({ name: 'P', email: 'p@p.com', password: 'password123' });
    const profile = await authService.getProfile(user.id);
    expect(profile.id).toBe(user.id);
    expect(profile).not.toHaveProperty('passwordHash');
  });

  it('getProfile throws UnauthorizedError for unknown id', async () => {
    await expect(authService.getProfile('ghost')).rejects.toThrow(UnauthorizedError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ProjectService
// ══════════════════════════════════════════════════════════════════════════════
describe('ProjectService', () => {
  it('create adds user as OWNER', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const fetched = await services.projectService.getById(user.id, project.id);
    expect(fetched.ownerId).toBe(user.id);
  });

  it('create throws ValidationError for empty name', async () => {
    const services = makeServices();
    const { user } = await services.authService.register({ name: 'U', email: 'u@u.com', password: 'password123' });
    await expect(services.projectService.create(user.id, { name: '   ' })).rejects.toThrow(ValidationError);
  });

  it('getById throws ForbiddenError for non-member', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const { user: other } = await services.authService.register({ name: 'B', email: 'b@b.com', password: 'password123' });
    await expect(services.projectService.getById(other.id, project.id)).rejects.toThrow(ForbiddenError);
  });

  it('listForUser returns only owned/member projects', async () => {
    const services = makeServices();
    const { user } = await seedUserAndProject(services);
    const { user: other } = await services.authService.register({ name: 'O', email: 'o@o.com', password: 'password123' });
    await services.projectService.create(other.id, { name: 'Other' });
    const list = await services.projectService.listForUser(user.id);
    expect(list.length).toBe(1);
  });

  it('update works for owner', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const updated = await services.projectService.update(user.id, project.id, { name: 'Renamed', description: 'New desc' });
    expect(updated.name).toBe('Renamed');
    expect(updated.description).toBe('New desc');
  });

  it('update throws ForbiddenError for non-owner member', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const { user: member } = await services.authService.register({ name: 'M', email: 'm@m.com', password: 'password123' });
    await services.projectService.addMember(user.id, project.id, member.id);
    await expect(services.projectService.update(member.id, project.id, { name: 'X' })).rejects.toThrow(ForbiddenError);
  });

  it('delete removes project and throws 404 on re-fetch', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    await services.projectService.delete(user.id, project.id);
    await expect(services.projectService.getById(user.id, project.id)).rejects.toThrow();
  });

  it('addMember throws ConflictError if already member', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const { user: member } = await services.authService.register({ name: 'M', email: 'm@m.com', password: 'password123' });
    await services.projectService.addMember(user.id, project.id, member.id);
    await expect(services.projectService.addMember(user.id, project.id, member.id)).rejects.toThrow(ConflictError);
  });

  it('addMember throws NotFoundError for non-existent user', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    await expect(services.projectService.addMember(user.id, project.id, 'nobody')).rejects.toThrow(NotFoundError);
  });

  it('removeMember throws ForbiddenError if trying to remove owner', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    await expect(services.projectService.removeMember(user.id, project.id, user.id)).rejects.toThrow(ForbiddenError);
  });

  it('getMembers returns member list for project members', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const { user: m } = await services.authService.register({ name: 'M', email: 'm@m.com', password: 'password123' });
    await services.projectService.addMember(user.id, project.id, m.id);
    const members = await services.projectService.getMembers(user.id, project.id);
    expect(members.length).toBe(2);
  });

  it('getMemberRole returns null for non-member', async () => {
    const services = makeServices();
    const { project } = await seedUserAndProject(services);
    const role = await services.projectService.getMemberRole(project.id, 'ghost');
    expect(role).toBeNull();
  });

  it('ensureOwner throws NotFoundError for non-member', async () => {
    const services = makeServices();
    const { project } = await seedUserAndProject(services);
    await expect(services.projectService.ensureOwner(project.id, 'ghost')).rejects.toThrow(NotFoundError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TaskService
// ══════════════════════════════════════════════════════════════════════════════
describe('TaskService', () => {
  it('create adds task to project', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'Do something' });
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Do something');
    expect(task.isOverdue).toBe(false);
  });

  it('create throws ForbiddenError for non-member', async () => {
    const services = makeServices();
    const { project } = await seedUserAndProject(services);
    await expect(services.taskService.create('ghost', project.id, { title: 'x' })).rejects.toThrow(ForbiddenError);
  });

  it('create throws ValidationError for empty title', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    await expect(services.taskService.create(user.id, project.id, { title: '  ' })).rejects.toThrow(ValidationError);
  });

  it('create throws ValidationError for negative estimatedHours', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    await expect(services.taskService.create(user.id, project.id, { title: 'x', estimatedHours: -1 })).rejects.toThrow(ValidationError);
  });

  it('getById returns task for member', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    const found = await services.taskService.getById(user.id, task.id);
    expect(found.id).toBe(task.id);
  });

  it('getById throws NotFoundError for unknown task', async () => {
    const services = makeServices();
    const { user } = await seedUserAndProject(services);
    await expect(services.taskService.getById(user.id, 'ghost')).rejects.toThrow(NotFoundError);
  });

  it('listByProject returns paginated response', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    await services.taskService.create(user.id, project.id, { title: 'A' });
    await services.taskService.create(user.id, project.id, { title: 'B' });
    const res = await services.taskService.listByProject(user.id, project.id, { page: 1, pageSize: 10 });
    expect(res.items.length).toBe(2);
    expect(res.total).toBe(2);
    expect(res.totalPages).toBe(1);
  });

  it('listByProject throws ValidationError for page < 1', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    await expect(services.taskService.listByProject(user.id, project.id, { page: 0, pageSize: 10 })).rejects.toThrow(ValidationError);
  });

  it('listByProject throws ValidationError for pageSize > 100', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    await expect(services.taskService.listByProject(user.id, project.id, { page: 1, pageSize: 101 })).rejects.toThrow(ValidationError);
  });

  it('update changes task title', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'Old' });
    const updated = await services.taskService.update(user.id, task.id, { title: 'New' });
    expect(updated.title).toBe('New');
  });

  it('update throws NotFoundError for unknown task', async () => {
    const services = makeServices();
    const { user } = await seedUserAndProject(services);
    await expect(services.taskService.update(user.id, 'ghost', { title: 'X' })).rejects.toThrow(NotFoundError);
  });

  it('update throws ValidationError for negative actualHours', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    await expect(services.taskService.update(user.id, task.id, { actualHours: -5 })).rejects.toThrow(ValidationError);
  });

  it('delete — owner can delete any task', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    await expect(services.taskService.delete(user.id, task.id)).resolves.toBeUndefined();
  });

  it('delete — creator can delete their task', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const { user: member } = await services.authService.register({ name: 'M', email: 'm@m.com', password: 'password123' });
    await services.projectService.addMember(user.id, project.id, member.id);
    const task = await services.taskService.create(member.id, project.id, { title: 'T' });
    await expect(services.taskService.delete(member.id, task.id)).resolves.toBeUndefined();
  });

  it('delete — throws ForbiddenError for non-member', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    await expect(services.taskService.delete('ghost', task.id)).rejects.toThrow(ForbiddenError);
  });

  it('delete — throws ForbiddenError for unrelated member', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const { user: m2 } = await services.authService.register({ name: 'M2', email: 'm2@m.com', password: 'password123' });
    await services.projectService.addMember(user.id, project.id, m2.id);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    await expect(services.taskService.delete(m2.id, task.id)).rejects.toThrow(ForbiddenError);
  });

  it('delete throws NotFoundError for unknown task', async () => {
    const services = makeServices();
    const { user } = await seedUserAndProject(services);
    await expect(services.taskService.delete(user.id, 'ghost')).rejects.toThrow(NotFoundError);
  });

  it('isOverdue is true for past-due active task', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'Late', dueDate: pastDate() });
    expect(task.isOverdue).toBe(true);
  });

  it('isOverdue is false for DONE task even if past due', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'Late', dueDate: pastDate(), status: 'DONE' });
    expect(task.isOverdue).toBe(false);
  });

  it('getOverdue returns overdue tasks', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    await services.taskService.create(user.id, project.id, { title: 'Late', dueDate: pastDate() });
    await services.taskService.create(user.id, project.id, { title: 'Future', dueDate: futureDate() });
    const overdue = await services.taskService.getOverdue(user.id, project.id);
    expect(overdue.length).toBe(1);
    expect(overdue[0].title).toBe('Late');
  });

  it('getRanked returns tasks sorted by priority weight', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    await services.taskService.create(user.id, project.id, { title: 'Low', priority: 'LOW' });
    await services.taskService.create(user.id, project.id, { title: 'Critical', priority: 'CRITICAL' });
    const ranked = await services.taskService.getRanked(user.id, project.id);
    expect(ranked[0].title).toBe('Critical');
  });

  it('getPenalty returns 0 without strategy', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'T', dueDate: pastDate() });
    const penalty = await services.taskService.getPenalty(user.id, task.id);
    expect(penalty).toBe(0);
  });

  it('getPenalty uses configured strategy', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    services.taskService.setPenaltyStrategy(new TieredPenaltyStrategy());
    const task = await services.taskService.create(user.id, project.id, { title: 'T', dueDate: pastDate(5) });
    const penalty = await services.taskService.getPenalty(user.id, task.id);
    expect(penalty).toBe(15);
  });

  it('bulkUpdateStatus updates multiple tasks', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const t1 = await services.taskService.create(user.id, project.id, { title: 'T1' });
    const t2 = await services.taskService.create(user.id, project.id, { title: 'T2' });
    const count = await services.taskService.bulkUpdateStatus(user.id, project.id, [t1.id, t2.id], 'DONE');
    expect(count).toBe(2);
  });

  it('update emits task.status_changed event on status change', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    const events: string[] = [];
    EventBus.getInstance().subscribe('task.status_changed', { name: 'spy', update: (p) => { events.push(p.event); } });
    await services.taskService.update(user.id, task.id, { status: 'DONE' });
    expect(events).toContain('task.status_changed');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CommentService
// ══════════════════════════════════════════════════════════════════════════════
describe('CommentService', () => {
  it('create adds comment to task', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    const comment = await services.commentService.create(user.id, task.id, { content: 'Hello' });
    expect(comment.content).toBe('Hello');
    expect(comment.authorId).toBe(user.id);
  });

  it('create throws NotFoundError for unknown task', async () => {
    const services = makeServices();
    const { user } = await seedUserAndProject(services);
    await expect(services.commentService.create(user.id, 'ghost', { content: 'x' })).rejects.toThrow(NotFoundError);
  });

  it('create throws ForbiddenError for non-member', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    await expect(services.commentService.create('ghost', task.id, { content: 'x' })).rejects.toThrow(ForbiddenError);
  });

  it('create throws ValidationError for empty content', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    await expect(services.commentService.create(user.id, task.id, { content: '   ' })).rejects.toThrow(ValidationError);
  });

  it('listByTask returns comments for task', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    await services.commentService.create(user.id, task.id, { content: 'C1' });
    await services.commentService.create(user.id, task.id, { content: 'C2' });
    const list = await services.commentService.listByTask(user.id, task.id);
    expect(list.length).toBe(2);
  });

  it('update changes comment content', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    const comment = await services.commentService.create(user.id, task.id, { content: 'Old' });
    const updated = await services.commentService.update(user.id, comment.id, 'New content');
    expect(updated.content).toBe('New content');
  });

  it('update throws ForbiddenError for different author', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const { user: other } = await services.authService.register({ name: 'O', email: 'o@o.com', password: 'password123' });
    await services.projectService.addMember(user.id, project.id, other.id);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    const comment = await services.commentService.create(user.id, task.id, { content: 'Mine' });
    await expect(services.commentService.update(other.id, comment.id, 'Hacked')).rejects.toThrow(ForbiddenError);
  });

  it('delete removes comment', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    const comment = await services.commentService.create(user.id, task.id, { content: 'C' });
    await expect(services.commentService.delete(user.id, comment.id)).resolves.toBeUndefined();
  });

  it('delete throws ForbiddenError for non-author', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const { user: o } = await services.authService.register({ name: 'O', email: 'o@o.com', password: 'password123' });
    await services.projectService.addMember(user.id, project.id, o.id);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    const c = await services.commentService.create(user.id, task.id, { content: 'C' });
    await expect(services.commentService.delete(o.id, c.id)).rejects.toThrow(ForbiddenError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// StatsService
// ══════════════════════════════════════════════════════════════════════════════
describe('StatsService', () => {
  it('returns zero stats for empty project', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const stats = await services.statsService.getProjectStats(user.id, project.id);
    expect(stats.totalTasks).toBe(0);
    expect(stats.completionRate).toBe(0);
    expect(stats.overdueCount).toBe(0);
  });

  it('completionRate is 100 when all tasks done', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const task = await services.taskService.create(user.id, project.id, { title: 'T' });
    await services.taskService.update(user.id, task.id, { status: 'DONE' });
    const stats = await services.statsService.getProjectStats(user.id, project.id);
    expect(stats.completionRate).toBe(100);
  });

  it('counts byStatus correctly', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    await services.taskService.create(user.id, project.id, { title: 'T1', status: 'TODO' });
    await services.taskService.create(user.id, project.id, { title: 'T2', status: 'IN_PROGRESS' });
    const stats = await services.statsService.getProjectStats(user.id, project.id);
    expect(stats.byStatus.TODO).toBe(1);
    expect(stats.byStatus.IN_PROGRESS).toBe(1);
  });

  it('counts overdueCount correctly', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    await services.taskService.create(user.id, project.id, { title: 'Late', dueDate: pastDate() });
    await services.taskService.create(user.id, project.id, { title: 'Done', dueDate: pastDate(), status: 'DONE' });
    const stats = await services.statsService.getProjectStats(user.id, project.id);
    expect(stats.overdueCount).toBe(1);
  });

  it('avgEstimatedHours is calculated correctly', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    await services.taskService.create(user.id, project.id, { title: 'T1', estimatedHours: 4 });
    await services.taskService.create(user.id, project.id, { title: 'T2', estimatedHours: 6 });
    const stats = await services.statsService.getProjectStats(user.id, project.id);
    expect(stats.avgEstimatedHours).toBe(5);
  });

  it('throws ForbiddenError for non-member', async () => {
    const services = makeServices();
    const { project } = await seedUserAndProject(services);
    await expect(services.statsService.getProjectStats('ghost', project.id)).rejects.toThrow(ForbiddenError);
  });

  it('all statuses are present in byStatus', async () => {
    const services = makeServices();
    const { user, project } = await seedUserAndProject(services);
    const stats = await services.statsService.getProjectStats(user.id, project.id);
    const expectedStatuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'];
    for (const s of expectedStatuses) {
      expect(stats.byStatus).toHaveProperty(s);
    }
  });
});
