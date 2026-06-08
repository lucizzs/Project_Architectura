/**
 * Інтеграційні тести: автентифікація.
 * Перевіряють Express + Validation + AuthService + UserRepository + Prisma + Postgres.
 */
import request from 'supertest';
import {
  setupIntegration,
  teardownIntegration,
  cleanDatabase,
  registerUser,
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

describe('Integration: /api/v1/auth', () => {
  describe('POST /auth/register', () => {
    it('201 — реєструє нового користувача і повертає токен', async () => {
      const res = await request(getApp())
        .post('/api/v1/auth/register')
        .send({ email: 'new@test.com', password: 'password123', name: 'New User' });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('new@test.com');
      expect(res.body.user.name).toBe('New User');
      expect(res.body.user.id).toBeDefined();
      expect(res.body.accessToken).toBeDefined();
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('409 — конфлікт при повторному email', async () => {
      const payload = { email: 'dup@test.com', password: 'password123', name: 'Dup' };
      await request(getApp()).post('/api/v1/auth/register').send(payload).expect(201);

      const res = await request(getApp()).post('/api/v1/auth/register').send(payload);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('422 — невалідні дані (короткий пароль)', async () => {
      const res = await request(getApp())
        .post('/api/v1/auth/register')
        .send({ email: 'bad@test.com', password: '123', name: 'X' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('422 — невалідні дані (невірний email)', async () => {
      const res = await request(getApp())
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'password123', name: 'X' });
      expect(res.status).toBe(422);
    });
  });

  describe('POST /auth/login', () => {
    it('200 — правильний пароль повертає токен', async () => {
      await registerUser({ email: 'login@test.com', password: 'mypass123' });

      const res = await request(getApp())
        .post('/api/v1/auth/login')
        .send({ email: 'login@test.com', password: 'mypass123' });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it('401 — неправильний пароль', async () => {
      await registerUser({ email: 'wp@test.com', password: 'correct123' });
      const res = await request(getApp())
        .post('/api/v1/auth/login')
        .send({ email: 'wp@test.com', password: 'wrong-pass' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('401 — користувача не існує', async () => {
      const res = await request(getApp())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@test.com', password: 'anything123' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('200 — повертає поточного користувача з валідним токеном', async () => {
      const user = await registerUser({ email: 'me@test.com', name: 'Me' });
      const res = await request(getApp())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('me@test.com');
      expect(res.body.name).toBe('Me');
    });

    it('401 — без токена', async () => {
      const res = await request(getApp()).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('401 — з кривим токеном', async () => {
      const res = await request(getApp())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer garbage.token.value');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /users/search', () => {
    it('200 — знаходить користувачів за частковим іменем', async () => {
      const user = await registerUser({ email: 'a@test.com', name: 'Alice' });
      await registerUser({ email: 'b@test.com', name: 'Alicia' });
      await registerUser({ email: 'c@test.com', name: 'Bob' });

      const res = await request(getApp())
        .get('/api/v1/users/search?name=Ali')
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(200);
      expect(res.body.users.length).toBe(2);
      const names = res.body.users.map((u: { name: string }) => u.name).sort();
      expect(names).toEqual(['Alice', 'Alicia']);
    });

    it('200 — повертає пустий список для невідомого імені', async () => {
      const user = await registerUser();
      const res = await request(getApp())
        .get('/api/v1/users/search?name=ZZZ_no_such')
        .set('Authorization', `Bearer ${user.token}`);
      expect(res.status).toBe(200);
      expect(res.body.users).toEqual([]);
    });

    it('401 — без токена', async () => {
      const res = await request(getApp()).get('/api/v1/users/search?name=any');
      expect(res.status).toBe(401);
    });
  });
});
