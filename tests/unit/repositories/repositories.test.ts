import { UserRepository } from '../../../src/repositories/user.repository';
import { ProjectRepository } from '../../../src/repositories/project.repository';
import { TaskRepository } from '../../../src/repositories/task.repository';
import { CommentRepository } from '../../../src/repositories/comment.repository';

// ── UserRepository ─────────────────────────────────────────────────────────
describe('UserRepository', () => {
  let repo: UserRepository;

  beforeEach(() => {
    repo = new UserRepository();
  });

  it('create — зберігає і повертає користувача', async () => {
    const u = await repo.create({ email: 'a@b.com', name: 'Alice', passwordHash: 'hash' });
    expect(u.id).toBeTruthy();
    expect(u.email).toBe('a@b.com');
    expect(u.name).toBe('Alice');
  });

  it('create — генерує унікальні ID', async () => {
    const a = await repo.create({ email: 'a@b.com', name: 'A', passwordHash: 'h' });
    const b = await repo.create({ email: 'b@b.com', name: 'B', passwordHash: 'h' });
    expect(a.id).not.toBe(b.id);
  });

  it('findById — повертає користувача за ID', async () => {
    const created = await repo.create({ email: 'x@x.com', name: 'X', passwordHash: 'h' });
    const found = await repo.findById(created.id);
    expect(found?.email).toBe('x@x.com');
  });

  it('findById — null якщо не знайдено', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('findByEmail — регістронезалежно', async () => {
    await repo.create({ email: 'Alice@B.COM', name: 'A', passwordHash: 'h' });
    expect(await repo.findByEmail('alice@b.com')).not.toBeNull();
  });

  it('findByEmail — null якщо немає', async () => {
    expect(await repo.findByEmail('nobody@test.com')).toBeNull();
  });

  it('existsByEmail — true/false', async () => {
    await repo.create({ email: 'e@e.com', name: 'E', passwordHash: 'h' });
    expect(await repo.existsByEmail('e@e.com')).toBe(true);
    expect(await repo.existsByEmail('no@no.com')).toBe(false);
  });

  it('findByName — точний збіг регістронезалежно', async () => {
    await repo.create({ email: 'bob@b.com', name: 'Bob Brown', passwordHash: 'h' });
    expect(await repo.findByName('bob brown')).not.toBeNull();
    expect(await repo.findByName('BOB BROWN')).not.toBeNull();
  });

  it('findByName — null якщо немає', async () => {
    expect(await repo.findByName('Nobody')).toBeNull();
  });

  it('searchByName — часткове співпадіння', async () => {
    await repo.create({ email: 'a@a.com', name: 'Alice Adams', passwordHash: 'h' });
    await repo.create({ email: 'b@b.com', name: 'Bob Brown', passwordHash: 'h' });
    const res = await repo.searchByName('alice');
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe('Alice Adams');
  });

  it('searchByName — порожній запит → []', async () => {
    expect(await repo.searchByName('')).toEqual([]);
  });

  it('searchByName — max 10 результатів', async () => {
    for (let i = 0; i < 15; i++) {
      await repo.create({ email: `user${i}@t.com`, name: `Test User ${i}`, passwordHash: 'h' });
    }
    const res = await repo.searchByName('test');
    expect(res.length).toBeLessThanOrEqual(10);
  });

  it('повертає копію — мутація не впливає на сховище', async () => {
    const u = await repo.create({ email: 'x@x.com', name: 'X', passwordHash: 'h' });
    u.name = 'Hacked';
    const found = await repo.findById(u.id);
    expect(found?.name).toBe('X');
  });
});

// ── ProjectRepository ──────────────────────────────────────────────────────
describe('ProjectRepository', () => {
  let repo: ProjectRepository;

  beforeEach(() => {
    repo = new ProjectRepository();
  });

  it('create — зберігає проєкт та додає власника як OWNER', async () => {
    const p = await repo.create({ name: 'Proj', ownerId: 'u1' });
    expect(p.id).toBeTruthy();
    const member = await repo.findMember(p.id, 'u1');
    expect(member?.role).toBe('OWNER');
  });

  it('create — зберігає description', async () => {
    const p = await repo.create({ name: 'P', ownerId: 'u1', description: 'Desc' });
    expect(p.description).toBe('Desc');
  });

  it('create — description null якщо не передано', async () => {
    const p = await repo.create({ name: 'P', ownerId: 'u1' });
    expect(p.description).toBeNull();
  });

  it('findById — повертає проєкт', async () => {
    const p = await repo.create({ name: 'P', ownerId: 'u1' });
    const found = await repo.findById(p.id);
    expect(found?.name).toBe('P');
  });

  it('findById — null якщо немає', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('findByIdWithCounts — включає _count.members', async () => {
    const p = await repo.create({ name: 'P', ownerId: 'u1' });
    await repo.addMember(p.id, 'u2');
    const found = await repo.findByIdWithCounts(p.id);
    expect(found?._count.members).toBe(2);
  });

  it('findAllForUser — повертає лише проєкти де є членом', async () => {
    const p1 = await repo.create({ name: 'P1', ownerId: 'u1' });
    await repo.create({ name: 'P2', ownerId: 'u2' });
    const res = await repo.findAllForUser('u1');
    expect(res.map((p) => p.id)).toContain(p1.id);
    expect(res).toHaveLength(1);
  });

  it('update — змінює name і description', async () => {
    const p = await repo.create({ name: 'Old', ownerId: 'u1' });
    const updated = await repo.update(p.id, { name: 'New', description: 'Desc' });
    expect(updated.name).toBe('New');
    expect(updated.description).toBe('Desc');
  });

  it('delete — видаляє проєкт і всіх членів', async () => {
    const p = await repo.create({ name: 'P', ownerId: 'u1' });
    await repo.delete(p.id);
    expect(await repo.findById(p.id)).toBeNull();
    expect(await repo.findMember(p.id, 'u1')).toBeNull();
  });

  it('addMember — додає MEMBER', async () => {
    const p = await repo.create({ name: 'P', ownerId: 'u1' });
    await repo.addMember(p.id, 'u2');
    const m = await repo.findMember(p.id, 'u2');
    expect(m?.role).toBe('MEMBER');
  });

  it('removeMember — видаляє члена', async () => {
    const p = await repo.create({ name: 'P', ownerId: 'u1' });
    await repo.addMember(p.id, 'u2');
    await repo.removeMember(p.id, 'u2');
    expect(await repo.findMember(p.id, 'u2')).toBeNull();
  });

  it('findMembers — повертає список з ролями', async () => {
    const p = await repo.create({ name: 'P', ownerId: 'u1' });
    repo.storeUserInfo('u1', 'Alice', 'a@a.com');
    const members = await repo.findMembers(p.id);
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('OWNER');
  });
});

// ── TaskRepository ─────────────────────────────────────────────────────────
describe('TaskRepository', () => {
  let repo: TaskRepository;

  beforeEach(() => {
    repo = new TaskRepository();
  });

  const makeTask = (overrides = {}) => repo.create('p1', 'u1', { title: 'Task', ...overrides });

  it('create — зберігає задачу', async () => {
    const t = await makeTask();
    expect(t.id).toBeTruthy();
    expect(t.title).toBe('Task');
    expect(t.status).toBe('TODO');
    expect(t.priority).toBe('MEDIUM');
  });

  it('create — встановлює кастомні status/priority', async () => {
    const t = await makeTask({ status: 'IN_PROGRESS', priority: 'HIGH' });
    expect(t.status).toBe('IN_PROGRESS');
    expect(t.priority).toBe('HIGH');
  });

  it('findById — повертає задачу', async () => {
    const t = await makeTask();
    expect(await repo.findById(t.id)).not.toBeNull();
  });

  it('findById — null якщо немає', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('findManyByProject — фільтрує за projectId', async () => {
    await repo.create('p1', 'u1', { title: 'A' });
    await repo.create('p2', 'u1', { title: 'B' });
    const res = await repo.findManyByProject('p1', { page: 1, pageSize: 20 });
    expect(res.items).toHaveLength(1);
    expect(res.total).toBe(1);
  });

  it('findManyByProject — фільтрує за status', async () => {
    await repo.create('p1', 'u1', { title: 'A', status: 'TODO' });
    await repo.create('p1', 'u1', { title: 'B', status: 'DONE' });
    const res = await repo.findManyByProject('p1', { page: 1, pageSize: 20, status: 'TODO' });
    expect(res.items).toHaveLength(1);
  });

  it('findManyByProject — фільтрує за priority', async () => {
    await repo.create('p1', 'u1', { title: 'A', priority: 'HIGH' });
    await repo.create('p1', 'u1', { title: 'B', priority: 'LOW' });
    const res = await repo.findManyByProject('p1', { page: 1, pageSize: 20, priority: 'HIGH' });
    expect(res.items).toHaveLength(1);
  });

  it('findManyByProject — пошук за title', async () => {
    await repo.create('p1', 'u1', { title: 'Fix bug' });
    await repo.create('p1', 'u1', { title: 'Write docs' });
    const res = await repo.findManyByProject('p1', { page: 1, pageSize: 20, search: 'bug' });
    expect(res.items).toHaveLength(1);
  });

  it('findManyByProject — пагінація', async () => {
    for (let i = 0; i < 5; i++) await repo.create('p1', 'u1', { title: `T${i}` });
    const res = await repo.findManyByProject('p1', { page: 1, pageSize: 2 });
    expect(res.items).toHaveLength(2);
    expect(res.total).toBe(5);
  });

  it('update — змінює title', async () => {
    const t = await makeTask();
    const updated = await repo.update(t.id, { title: 'New Title' });
    expect(updated.title).toBe('New Title');
  });

  it('update — змінює status', async () => {
    const t = await makeTask();
    const updated = await repo.update(t.id, { status: 'DONE' });
    expect(updated.status).toBe('DONE');
  });

  it('delete — видаляє задачу', async () => {
    const t = await makeTask();
    await repo.delete(t.id);
    expect(await repo.findById(t.id)).toBeNull();
  });

  it('countByStatus — рахує за статусами', async () => {
    await repo.create('p1', 'u1', { title: 'A', status: 'TODO' });
    await repo.create('p1', 'u1', { title: 'B', status: 'TODO' });
    await repo.create('p1', 'u1', { title: 'C', status: 'DONE' });
    const counts = await repo.countByStatus('p1');
    expect(counts['TODO']).toBe(2);
    expect(counts['DONE']).toBe(1);
  });

  it('countByStatus — повертає {} для порожнього проєкту', async () => {
    expect(await repo.countByStatus('empty')).toEqual({});
  });
});

// ── CommentRepository ──────────────────────────────────────────────────────
describe('CommentRepository', () => {
  let repo: CommentRepository;

  beforeEach(() => {
    repo = new CommentRepository();
  });

  it('create — зберігає коментар', async () => {
    const c = await repo.create('t1', 'u1', 'Привіт');
    expect(c.id).toBeTruthy();
    expect(c.content).toBe('Привіт');
    expect(c.taskId).toBe('t1');
    expect(c.authorId).toBe('u1');
  });

  it('findByTask — повертає коментарі задачі', async () => {
    await repo.create('t1', 'u1', 'A');
    await repo.create('t1', 'u1', 'B');
    await repo.create('t2', 'u1', 'C');
    const res = await repo.findByTask('t1');
    expect(res).toHaveLength(2);
  });

  it('findByTask — сортує за датою (asc)', async () => {
    const a = await repo.create('t1', 'u1', 'First');
    await new Promise((r) => setTimeout(r, 2));
    const b = await repo.create('t1', 'u1', 'Second');
    const res = await repo.findByTask('t1');
    expect(res[0].id).toBe(a.id);
    expect(res[1].id).toBe(b.id);
  });

  it('findById — знаходить коментар', async () => {
    const c = await repo.create('t1', 'u1', 'Test');
    expect(await repo.findById(c.id)).not.toBeNull();
  });

  it('findById — null якщо немає', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  it('delete — видаляє коментар', async () => {
    const c = await repo.create('t1', 'u1', 'Bye');
    await repo.delete(c.id);
    expect(await repo.findById(c.id)).toBeNull();
  });

  it('порожній findByTask → []', async () => {
    expect(await repo.findByTask('no-task')).toEqual([]);
  });
});
