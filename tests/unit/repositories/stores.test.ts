import { Project, Task } from '../../../src/domain/models';
import { InMemoryUserRepository } from '../../../src/storage/user.store';
import { InMemoryProjectRepository } from '../../../src/storage/project.store';
import { InMemoryTaskRepository } from '../../../src/storage/task.store';
import { InMemoryCommentRepository, InMemoryTaskHistoryRepository } from '../../../src/storage/comment.store';
import { ConflictError, NotFoundError } from '../../../src/domain/errors';
import { buildUser, buildProject, buildTask, buildComment, pastDate, futureDate, ALL_STATUSES, ALL_PRIORITIES } from '../../helpers';

// ══════════════════════════════════════════════════════════════════════════════
// InMemoryUserRepository
// ══════════════════════════════════════════════════════════════════════════════
describe('InMemoryUserRepository', () => {
  let repo: InMemoryUserRepository;

  beforeEach(() => { repo = new InMemoryUserRepository(); });

  it('creates a user and assigns id/timestamps', async () => {
    const user = await repo.create(buildUser({ email: 'a@b.com' }));
    expect(user.id).toBeDefined();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('throws ConflictError on duplicate email', async () => {
    await repo.create(buildUser({ email: 'dup@b.com' }));
    await expect(repo.create(buildUser({ email: 'dup@b.com' }))).rejects.toThrow(ConflictError);
  });

  it('email lookup is case-insensitive', async () => {
    await repo.create(buildUser({ email: 'Test@B.com' }));
    const found = await repo.findByEmail('test@b.com');
    expect(found).not.toBeNull();
  });

  it('findById returns null for unknown id', async () => {
    expect(await repo.findById('nonexistent')).toBeNull();
  });

  it('findByEmail returns null for unknown email', async () => {
    expect(await repo.findByEmail('nobody@x.com')).toBeNull();
  });

  it('update changes name and updates timestamp', async () => {
    const user = await repo.create(buildUser({ email: 'u@u.com' }));
    const updated = await repo.update(user.id, { name: 'New Name' });
    expect(updated.name).toBe('New Name');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(user.updatedAt.getTime());
  });

  it('update throws NotFoundError for unknown id', async () => {
    await expect(repo.update('ghost', { name: 'x' })).rejects.toThrow(NotFoundError);
  });

  it('delete removes user from store', async () => {
    const user = await repo.create(buildUser({ email: 'd@d.com' }));
    await repo.delete(user.id);
    expect(await repo.findById(user.id)).toBeNull();
  });

  it('delete throws NotFoundError for unknown id', async () => {
    await expect(repo.delete('ghost')).rejects.toThrow(NotFoundError);
  });

  it('findAll returns all users', async () => {
    await repo.create(buildUser({ email: 'a1@x.com' }));
    await repo.create(buildUser({ email: 'a2@x.com' }));
    expect((await repo.findAll()).length).toBe(2);
  });

  it('clear empties the store', async () => {
    await repo.create(buildUser({ email: 'cl@x.com' }));
    repo.clear();
    expect((await repo.findAll()).length).toBe(0);
  });

  it('returns cloned objects (mutations do not affect store)', async () => {
    const user = await repo.create(buildUser({ email: 'clone@x.com' }));
    user.name = 'MUTATED';
    const refetch = await repo.findById(user.id);
    expect(refetch?.name).not.toBe('MUTATED');
  });

  it('deactivated user flag is persisted', async () => {
    const user = await repo.create(buildUser({ email: 'act@x.com' }));
    const updated = await repo.update(user.id, { isActive: false });
    expect(updated.isActive).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// InMemoryProjectRepository
// ══════════════════════════════════════════════════════════════════════════════
describe('InMemoryProjectRepository', () => {
  let repo: InMemoryProjectRepository;
  const ownerId = 'owner-1';

  beforeEach(() => { repo = new InMemoryProjectRepository(); });

  it('creates project and auto-adds owner as OWNER member', async () => {
    const project = await repo.create(buildProject(ownerId));
    expect(project.id).toBeDefined();
    const member = await repo.findMember(project.id, ownerId);
    expect(member?.role).toBe('OWNER');
  });

  it('findById returns null for unknown', async () => {
    expect(await repo.findById('no')).toBeNull();
  });

  it('findAllForUser returns only projects the user belongs to', async () => {
    const p1 = await repo.create(buildProject(ownerId));
    const p2 = await repo.create(buildProject('other'));
    const list = await repo.findAllForUser(ownerId);
    expect(list.map((p: Project) => p.id)).toContain(p1.id);
    expect(list.map((p: Project) => p.id)).not.toContain(p2.id);
  });

  it('update changes name and description', async () => {
    const project = await repo.create(buildProject(ownerId));
    const updated = await repo.update(project.id, { name: 'New', description: 'Desc' });
    expect(updated.name).toBe('New');
    expect(updated.description).toBe('Desc');
  });

  it('update throws NotFoundError for unknown id', async () => {
    await expect(repo.update('ghost', { name: 'x' })).rejects.toThrow(NotFoundError);
  });

  it('delete removes project and cleans up memberships', async () => {
    const project = await repo.create(buildProject(ownerId));
    await repo.delete(project.id);
    expect(await repo.findById(project.id)).toBeNull();
    expect(await repo.findMember(project.id, ownerId)).toBeNull();
  });

  it('addMember adds a MEMBER', async () => {
    const project = await repo.create(buildProject(ownerId));
    await repo.addMember(project.id, 'user-2', 'MEMBER');
    const member = await repo.findMember(project.id, 'user-2');
    expect(member?.role).toBe('MEMBER');
  });

  it('removeMember removes membership', async () => {
    const project = await repo.create(buildProject(ownerId));
    await repo.addMember(project.id, 'user-3', 'MEMBER');
    await repo.removeMember(project.id, 'user-3');
    expect(await repo.findMember(project.id, 'user-3')).toBeNull();
  });

  it('getMemberCount returns correct count', async () => {
    const project = await repo.create(buildProject(ownerId));
    await repo.addMember(project.id, 'u2', 'MEMBER');
    expect(await repo.getMemberCount(project.id)).toBe(2);
  });

  it('projects are sorted newest first', async () => {
    const p1 = await repo.create(buildProject(ownerId));
    await new Promise((r) => setTimeout(r, 2));
    const p2 = await repo.create(buildProject(ownerId));
    const list = await repo.findAllForUser(ownerId);
    expect(list[0].id).toBe(p2.id);
    expect(list[1].id).toBe(p1.id);
  });

  it('delete throws NotFoundError for unknown project', async () => {
    await expect(repo.delete('ghost')).rejects.toThrow(NotFoundError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// InMemoryTaskRepository
// ══════════════════════════════════════════════════════════════════════════════
describe('InMemoryTaskRepository', () => {
  let repo: InMemoryTaskRepository;
  const projectId = 'proj-1';
  const userId = 'user-1';

  beforeEach(() => { repo = new InMemoryTaskRepository(); });

  it('creates task with defaults', async () => {
    const task = await repo.create(buildTask(projectId, userId));
    expect(task.id).toBeDefined();
    expect(task.status).toBe('TODO');
    expect(task.priority).toBe('MEDIUM');
    expect(task.tags).toEqual([]);
  });

  it('findById returns null for unknown', async () => {
    expect(await repo.findById('no')).toBeNull();
  });

  it('findManyByProject — pagination works', async () => {
    for (let i = 0; i < 10; i++) await repo.create(buildTask(projectId, userId));
    const { items, total } = await repo.findManyByProject(projectId, { page: 1, pageSize: 5 });
    expect(items.length).toBe(5);
    expect(total).toBe(10);
  });

  it('findManyByProject — page 2', async () => {
    for (let i = 0; i < 7; i++) await repo.create(buildTask(projectId, userId));
    const { items } = await repo.findManyByProject(projectId, { page: 2, pageSize: 5 });
    expect(items.length).toBe(2);
  });

  it('findManyByProject — filter by status', async () => {
    await repo.create(buildTask(projectId, userId, { status: 'TODO' }));
    await repo.create(buildTask(projectId, userId, { status: 'DONE' }));
    const { items } = await repo.findManyByProject(projectId, { page: 1, pageSize: 10, status: 'TODO' });
    expect(items.every((t: Task) => t.status === 'TODO')).toBe(true);
  });

  it('findManyByProject — filter by priority', async () => {
    await repo.create(buildTask(projectId, userId, { priority: 'HIGH' }));
    await repo.create(buildTask(projectId, userId, { priority: 'LOW' }));
    const { items } = await repo.findManyByProject(projectId, { page: 1, pageSize: 10, priority: 'HIGH' });
    expect(items.every((t: Task) => t.priority === 'HIGH')).toBe(true);
  });

  it('findManyByProject — filter by assigneeId', async () => {
    await repo.create(buildTask(projectId, userId, { assigneeId: 'a1' }));
    await repo.create(buildTask(projectId, userId, { assigneeId: 'a2' }));
    const { items } = await repo.findManyByProject(projectId, { page: 1, pageSize: 10, assigneeId: 'a1' });
    expect(items.every((t: Task) => t.assigneeId === 'a1')).toBe(true);
  });

  it('findManyByProject — full-text search in title', async () => {
    await repo.create(buildTask(projectId, userId, { title: 'Alpha task' }));
    await repo.create(buildTask(projectId, userId, { title: 'Beta task' }));
    const { items } = await repo.findManyByProject(projectId, { page: 1, pageSize: 10, search: 'alpha' });
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Alpha task');
  });

  it('findManyByProject — search in description', async () => {
    await repo.create(buildTask(projectId, userId, { title: 'X', description: 'Important thing' }));
    const { items } = await repo.findManyByProject(projectId, { page: 1, pageSize: 10, search: 'important' });
    expect(items.length).toBe(1);
  });

  it('findManyByProject — isolates by projectId', async () => {
    await repo.create(buildTask(projectId, userId));
    await repo.create(buildTask('other-proj', userId));
    const { total } = await repo.findManyByProject(projectId, { page: 1, pageSize: 10 });
    expect(total).toBe(1);
  });

  it('update changes fields', async () => {
    const task = await repo.create(buildTask(projectId, userId));
    const updated = await repo.update(task.id, { status: 'DONE', title: 'Updated' });
    expect(updated.status).toBe('DONE');
    expect(updated.title).toBe('Updated');
  });

  it('update throws NotFoundError for unknown id', async () => {
    await expect(repo.update('ghost', { title: 'x' })).rejects.toThrow(NotFoundError);
  });

  it('delete removes task', async () => {
    const task = await repo.create(buildTask(projectId, userId));
    await repo.delete(task.id);
    expect(await repo.findById(task.id)).toBeNull();
  });

  it('delete throws NotFoundError for unknown id', async () => {
    await expect(repo.delete('ghost')).rejects.toThrow(NotFoundError);
  });

  it('countByStatus returns correct counts', async () => {
    await repo.create(buildTask(projectId, userId, { status: 'TODO' }));
    await repo.create(buildTask(projectId, userId, { status: 'TODO' }));
    await repo.create(buildTask(projectId, userId, { status: 'DONE' }));
    const counts = await repo.countByStatus(projectId);
    expect(counts['TODO']).toBe(2);
    expect(counts['DONE']).toBe(1);
  });

  it('countByPriority returns correct counts', async () => {
    await repo.create(buildTask(projectId, userId, { priority: 'HIGH' }));
    await repo.create(buildTask(projectId, userId, { priority: 'HIGH' }));
    await repo.create(buildTask(projectId, userId, { priority: 'LOW' }));
    const counts = await repo.countByPriority(projectId);
    expect(counts['HIGH']).toBe(2);
    expect(counts['LOW']).toBe(1);
  });

  it('findOverdue returns only overdue non-done tasks', async () => {
    await repo.create(buildTask(projectId, userId, { dueDate: pastDate(), status: 'TODO' }));
    await repo.create(buildTask(projectId, userId, { dueDate: pastDate(), status: 'DONE' }));
    await repo.create(buildTask(projectId, userId, { dueDate: futureDate(), status: 'TODO' }));
    const overdue = await repo.findOverdue(projectId);
    expect(overdue.length).toBe(1);
  });

  it('findOverdue excludes CANCELLED tasks', async () => {
    await repo.create(buildTask(projectId, userId, { dueDate: pastDate(), status: 'CANCELLED' }));
    expect((await repo.findOverdue(projectId)).length).toBe(0);
  });

  it('findByAssignee returns tasks assigned to user', async () => {
    await repo.create(buildTask(projectId, userId, { assigneeId: 'a1' }));
    await repo.create(buildTask(projectId, userId, { assigneeId: 'a2' }));
    const tasks = await repo.findByAssignee('a1');
    expect(tasks.every((t: Task) => t.assigneeId === 'a1')).toBe(true);
  });

  it('deleteByProjectId removes all tasks for project', async () => {
    await repo.create(buildTask(projectId, userId));
    await repo.create(buildTask(projectId, userId));
    await repo.create(buildTask('other', userId));
    await repo.deleteByProjectId(projectId);
    expect((await repo.findManyByProject(projectId, { page: 1, pageSize: 10 })).total).toBe(0);
    expect((await repo.findManyByProject('other', { page: 1, pageSize: 10 })).total).toBe(1);
  });

  it('sorting by priority desc works', async () => {
    await repo.create(buildTask(projectId, userId, { priority: 'LOW' }));
    await repo.create(buildTask(projectId, userId, { priority: 'CRITICAL' }));
    const { items } = await repo.findManyByProject(projectId, { page: 1, pageSize: 10, sortBy: 'priority', sortDir: 'desc' });
    expect(items[0].priority).toBe('CRITICAL');
  });

  it('size() returns count of stored items', async () => {
    expect(repo.size()).toBe(0);
    await repo.create(buildTask(projectId, userId));
    expect(repo.size()).toBe(1);
  });

  it('all task statuses can be set', async () => {
    for (const status of ALL_STATUSES) {
      const task = await repo.create(buildTask(projectId, userId, { status }));
      expect(task.status).toBe(status);
    }
  });

  it('all task priorities can be set', async () => {
    for (const priority of ALL_PRIORITIES) {
      const task = await repo.create(buildTask(projectId, userId, { priority }));
      expect(task.priority).toBe(priority);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// InMemoryCommentRepository
// ══════════════════════════════════════════════════════════════════════════════
describe('InMemoryCommentRepository', () => {
  let repo: InMemoryCommentRepository;

  beforeEach(() => { repo = new InMemoryCommentRepository(); });

  it('creates a comment', async () => {
    const c = await repo.create(buildComment('t1', 'u1'));
    expect(c.id).toBeDefined();
    expect(c.createdAt).toBeInstanceOf(Date);
  });

  it('findByTask returns sorted by createdAt asc', async () => {
    await repo.create(buildComment('t1', 'u1', { content: 'First' }));
    await new Promise((r) => setTimeout(r, 2));
    await repo.create(buildComment('t1', 'u1', { content: 'Second' }));
    const list = await repo.findByTask('t1');
    expect(list[0].content).toBe('First');
    expect(list[1].content).toBe('Second');
  });

  it('findById returns null for unknown', async () => {
    expect(await repo.findById('no')).toBeNull();
  });

  it('update changes content', async () => {
    const c = await repo.create(buildComment('t1', 'u1'));
    const updated = await repo.update(c.id, 'Updated content');
    expect(updated.content).toBe('Updated content');
  });

  it('update throws NotFoundError for unknown', async () => {
    await expect(repo.update('ghost', 'x')).rejects.toThrow(NotFoundError);
  });

  it('delete removes comment', async () => {
    const c = await repo.create(buildComment('t1', 'u1'));
    await repo.delete(c.id);
    expect(await repo.findById(c.id)).toBeNull();
  });

  it('deleteByTaskId removes all comments for task', async () => {
    await repo.create(buildComment('t1', 'u1'));
    await repo.create(buildComment('t1', 'u1'));
    await repo.create(buildComment('t2', 'u1'));
    await repo.deleteByTaskId('t1');
    expect((await repo.findByTask('t1')).length).toBe(0);
    expect((await repo.findByTask('t2')).length).toBe(1);
  });

  it('findByTask returns empty array for unknown task', async () => {
    expect(await repo.findByTask('unknown')).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// InMemoryTaskHistoryRepository
// ══════════════════════════════════════════════════════════════════════════════
describe('InMemoryTaskHistoryRepository', () => {
  let repo: InMemoryTaskHistoryRepository;

  beforeEach(() => { repo = new InMemoryTaskHistoryRepository(); });

  it('creates a history entry', async () => {
    const h = await repo.create({ taskId: 't1', userId: 'u1', field: 'status', oldValue: 'TODO', newValue: 'DONE', changedAt: new Date() });
    expect(h.id).toBeDefined();
  });

  it('findByTask returns entries sorted desc by changedAt', async () => {
    const d1 = new Date(Date.now() - 1000);
    const d2 = new Date();
    await repo.create({ taskId: 't1', userId: 'u1', field: 'status', oldValue: null, newValue: 'TODO', changedAt: d1 });
    await repo.create({ taskId: 't1', userId: 'u1', field: 'status', oldValue: 'TODO', newValue: 'DONE', changedAt: d2 });
    const list = await repo.findByTask('t1');
    expect(list[0].changedAt.getTime()).toBeGreaterThan(list[1].changedAt.getTime());
  });

  it('deleteByTaskId removes history', async () => {
    await repo.create({ taskId: 't1', userId: 'u1', field: 'status', oldValue: null, newValue: 'TODO', changedAt: new Date() });
    await repo.deleteByTaskId('t1');
    expect((await repo.findByTask('t1')).length).toBe(0);
  });
});
