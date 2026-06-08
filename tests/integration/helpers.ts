/**
 * Утиліти для інтеграційних тестів.
 *
 * Інтеграційні тести запускають реальну Express-аплікацію + реальну Postgres
 * (через docker-compose або сервіси GitHub Actions). Перед усім запуском
 * накатуються міграції, перед кожним тестом — TRUNCATE таблиць.
 */
import { execSync } from 'child_process';
import { Application } from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { createApp } from '../../src/app';
import { buildContainer } from '../../src/config/container';

let prisma: PrismaClient;
let redis: Redis;
let app: Application;

/** Викликати один раз перед усіма інтеграційними тестами. */
export async function setupIntegration(): Promise<void> {
  // 1) Накат міграцій
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });

  // 2) Створення клієнтів і застосунку
  prisma = new PrismaClient();
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
  });
  await redis.connect().catch(() => undefined);

  const container = buildContainer();
  app = createApp(container);
}

/** Викликати один раз після усіх тестів. */
export async function teardownIntegration(): Promise<void> {
  if (prisma) await prisma.$disconnect();
  if (redis) await redis.quit().catch(() => undefined);
}

/** Очистити всі таблиці перед кожним тестом. */
export async function cleanDatabase(): Promise<void> {
  // Порядок важливий через FK обмеження
  await prisma.tagOnTask.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

export function getApp(): Application {
  return app;
}

export function getPrisma(): PrismaClient {
  return prisma;
}

/** Швидко зареєструвати користувача і повернути токен + дані. */
export async function registerUser(
  overrides: Partial<{ email: string; password: string; name: string }> = {},
): Promise<{ id: string; email: string; name: string; token: string }> {
  const payload = {
    email:
      overrides.email ?? `user${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`,
    password: overrides.password ?? 'password123',
    name: overrides.name ?? 'Test User',
  };
  const res = await request(app).post('/api/v1/auth/register').send(payload).expect(201);
  return {
    id: res.body.user.id,
    email: res.body.user.email,
    name: res.body.user.name,
    token: res.body.accessToken,
  };
}

/** Створити проєкт від імені користувача. */
export async function createProject(
  token: string,
  data: { name: string; description?: string },
): Promise<{ id: string; name: string }> {
  const res = await request(app)
    .post('/api/v1/projects')
    .set('Authorization', `Bearer ${token}`)
    .send(data)
    .expect(201);
  return { id: res.body.id, name: res.body.name };
}
