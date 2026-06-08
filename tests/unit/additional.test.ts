/**
 * Додаткові тести для ProjectService, CommentService, utils.
 */
import { ProjectService } from '../../src/services/project.service';
import { ProjectRepository } from '../../src/repositories/project.repository';
import { UserRepository } from '../../src/repositories/user.repository';
import { CommentService } from '../../src/services/comment.service';
import { CommentRepository } from '../../src/repositories/comment.repository';
import { TaskRepository } from '../../src/repositories/task.repository';
import { ForbiddenError, NotFoundError } from '../../src/domain/errors';
import { hashPassword, verifyPassword } from '../../src/utils/password';
import { signToken, verifyToken } from '../../src/utils/jwt';
import { InMemoryRedis } from '../../src/config/redis';

// ── InMemoryRedis ──────────────────────────────────────────────────────────
describe('InMemoryRedis', () => {
  let redis: InMemoryRedis;
  beforeEach(() => { redis = new InMemoryRedis(); });

  it('get — null якщо ключ відсутній', async () => {
    expect(await redis.get('missing')).toBeNull();
  });

  it('setex + get — повертає значення', async () => {
    await redis.setex('k', 60, 'value');
    expect(await redis.get('k')).toBe('value');
  });

  it('setex — прострочений ключ повертає null', async () => {
    await redis.setex('k', -1, 'old');
    expect(await redis.get('k')).toBeNull();
  });

  it('del — видаляє ключ', async () => {
    await redis.setex('k', 60, 'v');
    await redis.del('k');
    expect(await redis.get('k')).toBeNull();
  });

  it('del — повертає 1 якщо ключ існував', async () => {
    await redis.setex('k', 60, 'v');
    expect(await redis.del('k')).toBe(1);
  });

  it('del — повертає 0 якщо ключ відсутній', async () => {
    expect(await redis.del('nope')).toBe(0);
  });

  it('clear — видаляє всі ключі', async () => {
    await redis.setex('a', 60, '1');
    await redis.setex('b', 60, '2');
    redis.clear();
    expect(await redis.get('a')).toBeNull();
    expect(await redis.get('b')).toBeNull();
  });

  it('JSON round-trip', async () => {
    const data = { items: [1, 2, 3], total: 3 };
    await redis.setex('json', 60, JSON.stringify(data));
    const val = await redis.get('json');
    expect(JSON.parse(val!)).toEqual(data);
  });
});

// ── password utils ─────────────────────────────────────────────────────────
describe('password utils', () => {
  it('hashPassword — повертає рядок', async () => {
    const hash = await hashPassword('secret123');
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe('secret123');
  });

  it('verifyPassword — true для правильного пароля', async () => {
    const hash = await hashPassword('mypassword');
    expect(await verifyPassword('mypassword', hash)).toBe(true);
  });

  it('verifyPassword — false для неправильного пароля', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('два однакові паролі — різні хеші (сіль)', async () => {
    const h1 = await hashPassword('same');
    const h2 = await hashPassword('same');
    expect(h1).not.toBe(h2);
  });
});

// ── JWT utils ──────────────────────────────────────────────────────────────
describe('JWT utils', () => {

  it('signToken — повертає рядок', () => {
    const token = signToken({ sub: 'u1', email: 'a@b.com' });
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('verifyToken — повертає payload з sub і email', () => {
    const token = signToken({ sub: 'u1', email: 'a@b.com' });
    const payload = verifyToken(token);
    expect(payload.sub).toBe('u1');
    expect(payload.email).toBe('a@b.com');
  });

  it('verifyToken — кидає на невалідному токені', () => {
    expect(() => verifyToken('bad.token.here')).toThrow();
  });

  it('verifyToken — кидає на підробленому токені', () => {
    const token = signToken({ sub: 'u1', email: 'a@b.com' });
    const parts = token.split('.');
    parts[2] = 'fakesignature';
    expect(() => verifyToken(parts.join('.'))).toThrow();
  });
});

// ── ProjectService (additional) ────────────────────────────────────────────
function makeProjectSetup() {
  const projectRepo = new ProjectRepository();
  const userRepo = new UserRepository();
  return new ProjectService(projectRepo, userRepo);
}

describe('ProjectService — listForUser', () => {
  it('повертає всі проєкти користувача', async () => {
    const service = makeProjectSetup();
    await service.create('u1', { name: 'P1' });
    await service.create('u1', { name: 'P2' });
    const list = await service.listForUser('u1');
    expect(list).toHaveLength(2);
  });

  it('не повертає чужі проєкти', async () => {
    const service = makeProjectSetup();
    await service.create('u1', { name: 'Mine' });
    await service.create('u2', { name: 'Theirs' });
    const list = await service.listForUser('u1');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Mine');
  });

  it('порожній список якщо нема проєктів', async () => {
    const service = makeProjectSetup();
    expect(await service.listForUser('u99')).toEqual([]);
  });
});

describe('ProjectService — delete', () => {
  it('видаляє проєкт', async () => {
    const projRepo = new ProjectRepository();
    const userRepo = new UserRepository();
    const service = new ProjectService(projRepo, userRepo);
    const p = await service.create('u1', { name: 'ToDelete' });
    await service.delete('u1', p.id);
    await expect(service.getById('u1', p.id)).rejects.toThrow(ForbiddenError);
  });

  it('кидає 403 якщо не власник', async () => {
    const projRepo = new ProjectRepository();
    const userRepo = new UserRepository();
    const service = new ProjectService(projRepo, userRepo);
    const p = await service.create('u1', { name: 'P' });
    await expect(service.delete('u2', p.id)).rejects.toThrow();
  });
});

// ── CommentService ─────────────────────────────────────────────────────────
function makeCommentSetup() {
  const commentRepo = new CommentRepository();
  const taskRepo = new TaskRepository();
  const projectRepo = new ProjectRepository();
  const userRepo = new UserRepository();
  const projectService = new ProjectService(projectRepo, userRepo);
  const commentService = new CommentService(commentRepo, taskRepo, projectService);
  return { commentService, taskRepo, projectRepo, projectService };
}

describe('CommentService', () => {
  it('create — додає коментар якщо є доступ', async () => {
    const { commentService, taskRepo, projectService } = makeCommentSetup();
    const p = await projectService.create('u1', { name: 'P' });
    const t = await taskRepo.create(p.id, 'u1', { title: 'T' });
    const c = await commentService.create('u1', t.id, { content: 'Hello' });
    expect(c.content).toBe('Hello');
  });

  it('create — 404 якщо задача не існує', async () => {
    const { commentService } = makeCommentSetup();
    await expect(commentService.create('u1', 'no-task', { content: 'Hi' }))
      .rejects.toThrow(NotFoundError);
  });

  it('create — 403 якщо не член проєкту', async () => {
    const { commentService, taskRepo, projectService } = makeCommentSetup();
    const p = await projectService.create('u1', { name: 'P' });
    const t = await taskRepo.create(p.id, 'u1', { title: 'T' });
    await expect(commentService.create('u2', t.id, { content: 'Hi' }))
      .rejects.toThrow(ForbiddenError);
  });

  it('listByTask — повертає коментарі', async () => {
    const { commentService, taskRepo, projectService } = makeCommentSetup();
    const p = await projectService.create('u1', { name: 'P' });
    const t = await taskRepo.create(p.id, 'u1', { title: 'T' });
    await commentService.create('u1', t.id, { content: 'A' });
    await commentService.create('u1', t.id, { content: 'B' });
    const list = await commentService.listByTask('u1', t.id);
    expect(list).toHaveLength(2);
  });

  it('delete — автор може видалити свій коментар', async () => {
    const { commentService, taskRepo, projectService } = makeCommentSetup();
    const p = await projectService.create('u1', { name: 'P' });
    const t = await taskRepo.create(p.id, 'u1', { title: 'T' });
    const c = await commentService.create('u1', t.id, { content: 'Mine' });
    await expect(commentService.delete('u1', c.id)).resolves.toBeUndefined();
  });

  it('delete — чужий коментар без прав → 403', async () => {
    const { commentService, taskRepo, projectService, projectRepo } = makeCommentSetup();
    const p = await projectService.create('u1', { name: 'P' });
    const t = await taskRepo.create(p.id, 'u1', { title: 'T' });
    await projectRepo.addMember(p.id, 'u2');
    const c = await commentService.create('u1', t.id, { content: 'Alice comment' });
    await expect(commentService.delete('u2', c.id)).rejects.toThrow(ForbiddenError);
  });

  it('delete — 404 якщо коментар не існує', async () => {
    const { commentService } = makeCommentSetup();
    await expect(commentService.delete('u1', 'no-comment')).rejects.toThrow(NotFoundError);
  });
});
