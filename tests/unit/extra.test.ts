/**
 * Додаткові тести TaskService і AuthService для досягнення 200+
 */
import { AuthService } from '../../src/services/auth.service';
import { TaskService } from '../../src/services/task.service';
import { ProjectService } from '../../src/services/project.service';
import { UserRepository } from '../../src/repositories/user.repository';
import { ProjectRepository } from '../../src/repositories/project.repository';
import { TaskRepository } from '../../src/repositories/task.repository';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
} from '../../src/domain/errors';

// ── AuthService (full flow with real repos) ────────────────────────────────
describe('AuthService — real repo integration', () => {
  let userRepo: UserRepository;
  let service: AuthService;

  beforeEach(() => {
    userRepo = new UserRepository();
    service = new AuthService(userRepo);
  });

  it('register + login — повний цикл', async () => {
    await service.register({ email: 'alice@test.com', password: 'Password1!', name: 'Alice' });
    const result = await service.login({ email: 'alice@test.com', password: 'Password1!' });
    expect(result.accessToken).toBeTruthy();
    expect(result.user.email).toBe('alice@test.com');
  });

  it('register — нормалізує email до нижнього регістру', async () => {
    await service.register({ email: 'Alice@TEST.COM', password: 'Pass1234!', name: 'Alice' });
    const result = await service.login({ email: 'alice@test.com', password: 'Pass1234!' });
    expect(result.user.email).toBeTruthy();
  });

  it('register — ConflictError при дублікаті email', async () => {
    await service.register({ email: 'dup@test.com', password: 'Pass1!', name: 'A' });
    await expect(
      service.register({ email: 'dup@test.com', password: 'Pass2!', name: 'B' }),
    ).rejects.toThrow(ConflictError);
  });

  it('login — UnauthorizedError при неправильному паролі', async () => {
    await service.register({ email: 'u@test.com', password: 'correct123', name: 'U' });
    await expect(service.login({ email: 'u@test.com', password: 'wrong' })).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('login — UnauthorizedError якщо email не існує', async () => {
    await expect(service.login({ email: 'no@test.com', password: 'any' })).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('getCurrentUser — повертає профіль', async () => {
    const { user } = await service.register({
      email: 'p@test.com',
      password: 'pass123',
      name: 'P',
    });
    const profile = await service.getCurrentUser(user.id);
    expect(profile.name).toBe('P');
  });

  it('getCurrentUser — NotFoundError для невідомого ID', async () => {
    await expect(service.getCurrentUser('nope')).rejects.toThrow(NotFoundError);
  });

  it('searchByName — знаходить часткові збіги', async () => {
    await service.register({ email: 'bob@test.com', password: 'pass123', name: 'Bob Builder' });
    const results = await service.searchByName('bob');
    expect(results.length).toBeGreaterThan(0);
  });

  it('searchByName — порожній рядок → []', async () => {
    expect(await service.searchByName('')).toEqual([]);
  });

  it('searchByName — пробіл → []', async () => {
    expect(await service.searchByName('   ')).toEqual([]);
  });
});

// ── TaskService — real repos ───────────────────────────────────────────────
function makeTaskSetup() {
  const userRepo = new UserRepository();
  const projectRepo = new ProjectRepository();
  const taskRepo = new TaskRepository();
  const projectService = new ProjectService(projectRepo, userRepo);
  const taskService = new TaskService(taskRepo, projectService);
  return { taskService, taskRepo, projectService, projectRepo };
}

describe('TaskService — real repo integration', () => {
  it('create — додає задачу в проєкт', async () => {
    const { taskService, projectService } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'P' });
    const t = await taskService.create('u1', p.id, { title: 'Task 1' });
    expect(t.id).toBeTruthy();
    expect(t.title).toBe('Task 1');
    expect(t.projectId).toBe(p.id);
  });

  it('create — 403 якщо не член', async () => {
    const { taskService, projectService } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'P' });
    await expect(taskService.create('u2', p.id, { title: 'T' })).rejects.toThrow(ForbiddenError);
  });

  it('getById — повертає задачу', async () => {
    const { taskService, projectService } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'P' });
    const t = await taskService.create('u1', p.id, { title: 'T' });
    const found = await taskService.getById('u1', t.id);
    expect(found.id).toBe(t.id);
  });

  it('getById — 404 якщо не існує', async () => {
    const { taskService } = makeTaskSetup();
    await expect(taskService.getById('u1', 'no-task')).rejects.toThrow(NotFoundError);
  });

  it('listByProject — повертає пагінацію', async () => {
    const { taskService, projectService } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'P' });
    await taskService.create('u1', p.id, { title: 'A' });
    await taskService.create('u1', p.id, { title: 'B' });
    const res = await taskService.listByProject('u1', p.id, { page: 1, pageSize: 10 });
    expect(res.items).toHaveLength(2);
    expect(res.total).toBe(2);
    expect(res.totalPages).toBe(1);
  });

  it('listByProject — пагінація — page 2', async () => {
    const { taskService, projectService } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'P' });
    for (let i = 0; i < 5; i++) await taskService.create('u1', p.id, { title: `T${i}` });
    const res = await taskService.listByProject('u1', p.id, { page: 2, pageSize: 2 });
    expect(res.items).toHaveLength(2);
    expect(res.page).toBe(2);
  });

  it('update — змінює title і status', async () => {
    const { taskService, projectService } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'P' });
    const t = await taskService.create('u1', p.id, { title: 'Old' });
    const updated = await taskService.update('u1', t.id, { title: 'New', status: 'DONE' });
    expect(updated.title).toBe('New');
    expect(updated.status).toBe('DONE');
  });

  it('update — 404 якщо задача не існує', async () => {
    const { taskService } = makeTaskSetup();
    await expect(taskService.update('u1', 'nope', { title: 'X' })).rejects.toThrow(NotFoundError);
  });

  it('delete — creator може видалити', async () => {
    const { taskService, projectService } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'P' });
    const t = await taskService.create('u1', p.id, { title: 'T' });
    await expect(taskService.delete('u1', t.id)).resolves.toBeUndefined();
  });

  it('delete — 403 стороннім', async () => {
    const { taskService, projectService, projectRepo } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'P' });
    await projectRepo.addMember(p.id, 'u2');
    const t = await taskService.create('u1', p.id, { title: 'T' });
    await expect(taskService.delete('u2', t.id)).rejects.toThrow(ForbiddenError);
  });

  it('delete — 404 якщо не існує', async () => {
    const { taskService } = makeTaskSetup();
    await expect(taskService.delete('u1', 'nope')).rejects.toThrow(NotFoundError);
  });

  it('listByProject — фільтрація за status', async () => {
    const { taskService, projectService } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'P' });
    await taskService.create('u1', p.id, { title: 'T1', status: 'TODO' });
    await taskService.create('u1', p.id, { title: 'T2', status: 'DONE' });
    const res = await taskService.listByProject('u1', p.id, {
      page: 1,
      pageSize: 10,
      status: 'TODO',
    });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].status).toBe('TODO');
  });

  it('listByProject — пошук за назвою', async () => {
    const { taskService, projectService } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'P' });
    await taskService.create('u1', p.id, { title: 'Fix login bug' });
    await taskService.create('u1', p.id, { title: 'Write tests' });
    const res = await taskService.listByProject('u1', p.id, {
      page: 1,
      pageSize: 10,
      search: 'login',
    });
    expect(res.items).toHaveLength(1);
  });
});

// ── Edge cases ─────────────────────────────────────────────────────────────
describe('TaskService — edge cases', () => {
  it('listByProject — порожній проєкт → items=[]', async () => {
    const { taskService, projectService } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'Empty' });
    const res = await taskService.listByProject('u1', p.id, { page: 1, pageSize: 10 });
    expect(res.items).toHaveLength(0);
    expect(res.total).toBe(0);
    expect(res.totalPages).toBe(0);
  });

  it('create — зберігає dueDate', async () => {
    const { taskService, projectService } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'P' });
    const due = new Date('2030-12-31');
    const t = await taskService.create('u1', p.id, { title: 'T', dueDate: due });
    expect(t.dueDate).toEqual(due);
  });

  it('update — null dueDate очищає дату', async () => {
    const { taskService, projectService } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'P' });
    const t = await taskService.create('u1', p.id, { title: 'T', dueDate: new Date() });
    const updated = await taskService.update('u1', t.id, { dueDate: null });
    expect(updated.dueDate).toBeNull();
  });

  it('totalPages розраховується правильно', async () => {
    const { taskService, projectService } = makeTaskSetup();
    const p = await projectService.create('u1', { name: 'P' });
    for (let i = 0; i < 7; i++) await taskService.create('u1', p.id, { title: `T${i}` });
    const res = await taskService.listByProject('u1', p.id, { page: 1, pageSize: 3 });
    expect(res.totalPages).toBe(3);
  });
});
