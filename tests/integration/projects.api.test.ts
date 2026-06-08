/**
 * Інтеграційні тести: проєкти та члени проєкту.
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

describe('Integration: /api/v1/projects', () => {
  describe('POST /projects', () => {
    it('201 — створює проєкт, користувач автоматично OWNER', async () => {
      const user = await registerUser();
      const res = await request(getApp())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ name: 'My Project', description: 'Test' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('My Project');
      expect(res.body.ownerId).toBe(user.id);
    });

    it('422 — без назви', async () => {
      const user = await registerUser();
      const res = await request(getApp())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ description: 'No name' });
      expect(res.status).toBe(422);
    });
  });

  describe('GET /projects', () => {
    it('200 — повертає тільки проєкти користувача', async () => {
      const alice = await registerUser({ name: 'Alice' });
      const bob = await registerUser({ name: 'Bob' });
      await createProject(alice.token, { name: 'Alice P1' });
      await createProject(alice.token, { name: 'Alice P2' });
      await createProject(bob.token, { name: 'Bob P1' });

      const res = await request(getApp())
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(2);
      const names = res.body.items.map((p: { name: string }) => p.name).sort();
      expect(names).toEqual(['Alice P1', 'Alice P2']);
    });
  });

  describe('GET /projects/:id', () => {
    it('200 — деталі проєкту з лічильниками', async () => {
      const user = await registerUser();
      const project = await createProject(user.token, { name: 'Detail' });

      const res = await request(getApp())
        .get(`/api/v1/projects/${project.id}`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(project.id);
      expect(res.body.memberCount).toBe(1);
      expect(res.body.taskCount).toBe(0);
    });

    it('403 — чужому проєкт недоступний', async () => {
      const owner = await registerUser();
      const stranger = await registerUser();
      const project = await createProject(owner.token, { name: 'Private' });

      const res = await request(getApp())
        .get(`/api/v1/projects/${project.id}`)
        .set('Authorization', `Bearer ${stranger.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /projects/:id', () => {
    it('200 — власник оновлює', async () => {
      const user = await registerUser();
      const project = await createProject(user.token, { name: 'Old' });

      const res = await request(getApp())
        .patch(`/api/v1/projects/${project.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
    });

    it('403 — звичайний учасник не може оновлювати', async () => {
      const owner = await registerUser();
      const member = await registerUser();
      const project = await createProject(owner.token, { name: 'P' });

      // Додаємо member як учасника
      await request(getApp())
        .post(`/api/v1/projects/${project.id}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: member.id })
        .expect(201);

      const res = await request(getApp())
        .patch(`/api/v1/projects/${project.id}`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /projects/:id', () => {
    it('204 — власник видаляє', async () => {
      const user = await registerUser();
      const project = await createProject(user.token, { name: 'Delete me' });
      const res = await request(getApp())
        .delete(`/api/v1/projects/${project.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(204);
    });
  });

  describe('Members', () => {
    it('POST /projects/:id/members — додає, GET — повертає список', async () => {
      const owner = await registerUser({ name: 'Owner' });
      const member = await registerUser({ name: 'Joiner' });
      const project = await createProject(owner.token, { name: 'Team' });

      await request(getApp())
        .post(`/api/v1/projects/${project.id}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: member.id })
        .expect(201);

      const res = await request(getApp())
        .get(`/api/v1/projects/${project.id}/members`)
        .set('Authorization', `Bearer ${owner.token}`);

      expect(res.status).toBe(200);
      expect(res.body.members.length).toBe(2);
      const roles = res.body.members.map((m: { role: string }) => m.role).sort();
      expect(roles).toEqual(['MEMBER', 'OWNER']);
    });

    it('409 — додавання повторно того самого користувача', async () => {
      const owner = await registerUser();
      const member = await registerUser();
      const project = await createProject(owner.token, { name: 'T' });

      await request(getApp())
        .post(`/api/v1/projects/${project.id}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: member.id })
        .expect(201);

      const res = await request(getApp())
        .post(`/api/v1/projects/${project.id}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: member.id });
      expect(res.status).toBe(409);
    });

    it('403 — не можна видалити OWNER', async () => {
      const owner = await registerUser();
      const project = await createProject(owner.token, { name: 'T' });

      const res = await request(getApp())
        .delete(`/api/v1/projects/${project.id}/members/${owner.id}`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(res.status).toBe(403);
    });
  });
});
