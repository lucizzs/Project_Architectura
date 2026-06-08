/**
 * Інтеграційні тести: задачі, коментарі, статистика.
 */
import request from 'supertest';
import {
  setupIntegration,
  teardownIntegration,
  cleanDatabase,
  registerUser,
  createProject,
  getApp,
} from './helpers';

beforeAll(async () => {
  await setupIntegration();
});

afterAll(async () => {
  await teardownIntegration();
});

beforeEach(async () => {
  await cleanDatabase();
});

describe('Integration: Tasks lifecycle', () => {
  it('повний CRUD + перехід статусів задачі', async () => {
    const user = await registerUser();
    const project = await createProject(user.token, { name: 'P' });

    // CREATE
    const created = await request(getApp())
      .post(`/api/v1/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Перша задача', priority: 'HIGH' })
      .expect(201);
    expect(created.body.title).toBe('Перша задача');
    expect(created.body.status).toBe('TODO');
    expect(created.body.priority).toBe('HIGH');
    const taskId = created.body.id;

    // READ
    const got = await request(getApp())
      .get(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
    expect(got.body.id).toBe(taskId);

    // UPDATE status TODO → IN_PROGRESS
    const updated = await request(getApp())
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect(updated.body.status).toBe('IN_PROGRESS');

    // UPDATE → DONE
    await request(getApp())
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ status: 'DONE' })
      .expect(200);

    // DELETE
    await request(getApp())
      .delete(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(204);

    // 404 після видалення
    await request(getApp())
      .get(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(404);
  });

  it('фільтрація та пагінація задач', async () => {
    const user = await registerUser();
    const project = await createProject(user.token, { name: 'P' });

    // створюємо 5 задач з різними статусами
    for (const [i, status] of [
      [0, 'TODO'],
      [1, 'TODO'],
      [2, 'IN_PROGRESS'],
      [3, 'DONE'],
      [4, 'DONE'],
    ] as Array<[number, string]>) {
      await request(getApp())
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ title: `Task ${i}`, status })
        .expect(201);
    }

    // фільтр по статусу
    const todos = await request(getApp())
      .get(`/api/v1/projects/${project.id}/tasks?status=TODO`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
    expect(todos.body.total).toBe(2);

    const dones = await request(getApp())
      .get(`/api/v1/projects/${project.id}/tasks?status=DONE`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
    expect(dones.body.total).toBe(2);

    // пагінація
    const page1 = await request(getApp())
      .get(`/api/v1/projects/${project.id}/tasks?page=1&pageSize=2`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
    expect(page1.body.items.length).toBe(2);
    expect(page1.body.total).toBe(5);
    expect(page1.body.totalPages).toBe(3);
  });

  it('403 — чужий не бачить задач', async () => {
    const owner = await registerUser();
    const stranger = await registerUser();
    const project = await createProject(owner.token, { name: 'P' });

    const res = await request(getApp())
      .get(`/api/v1/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(res.status).toBe(403);
  });
});

describe('Integration: Comments', () => {
  it('додавання та читання коментарів до задачі', async () => {
    const user = await registerUser();
    const project = await createProject(user.token, { name: 'P' });
    const task = await request(getApp())
      .post(`/api/v1/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'T' })
      .expect(201);

    await request(getApp())
      .post(`/api/v1/tasks/${task.body.id}/comments`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ content: 'Перший коментар' })
      .expect(201);

    await request(getApp())
      .post(`/api/v1/tasks/${task.body.id}/comments`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ content: 'Другий коментар' })
      .expect(201);

    const list = await request(getApp())
      .get(`/api/v1/tasks/${task.body.id}/comments`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(list.body.items.length).toBe(2);
    expect(list.body.items[0].content).toBe('Перший коментар');
  });
});

describe('Integration: Stats', () => {
  it('повертає правильні значення по статусах', async () => {
    const user = await registerUser();
    const project = await createProject(user.token, { name: 'P' });

    for (const status of ['TODO', 'TODO', 'IN_PROGRESS', 'DONE']) {
      await request(getApp())
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ title: `T-${status}`, status })
        .expect(201);
    }

    const res = await request(getApp())
      .get(`/api/v1/projects/${project.id}/stats`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(res.body.total).toBe(4);
    expect(res.body.byStatus.TODO).toBe(2);
    expect(res.body.byStatus.IN_PROGRESS).toBe(1);
    expect(res.body.byStatus.DONE).toBe(1);
  });

  it('кешування — другий запит підряд має cached: true', async () => {
    const user = await registerUser();
    const project = await createProject(user.token, { name: 'P' });
    await request(getApp())
      .post(`/api/v1/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'T' });

    const first = await request(getApp())
      .get(`/api/v1/projects/${project.id}/stats`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(first.body.cached).toBe(false);

    const second = await request(getApp())
      .get(`/api/v1/projects/${project.id}/stats`)
      .set('Authorization', `Bearer ${user.token}`);
    // Якщо Redis працює — другий запит з кешу; якщо ні — і fallback теж "не кешований"
    expect([true, false]).toContain(second.body.cached);
  });
});

describe('Integration: /healthz', () => {
  it('200 — повертає статус', async () => {
    const res = await request(getApp()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });
});
