/**
 * Seed-скрипт — заповнює БД демонстраційними даними.
 * Запускається разом з міграціями у dev-середовищі.
 */
import { PrismaClient, TaskStatus, TaskPriority, ProjectRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.warn('[seed] Очищення БД...');
  // Порядок важливий через FK обмеження
  await prisma.tagOnTask.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  console.warn('[seed] Створення користувачів...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const alice = await prisma.user.create({
    data: { email: 'alice@example.com', passwordHash, name: 'Alice Adams' },
  });
  const bob = await prisma.user.create({
    data: { email: 'bob@example.com', passwordHash, name: 'Bob Brown' },
  });

  console.warn('[seed] Створення проєкту...');
  const project = await prisma.project.create({
    data: {
      name: 'Курсова робота',
      description: 'Менеджер задач для курсової роботи',
      ownerId: alice.id,
      members: {
        create: [
          { userId: alice.id, role: ProjectRole.OWNER },
          { userId: bob.id, role: ProjectRole.MEMBER },
        ],
      },
    },
  });

  console.warn('[seed] Створення тегів...');
  const backendTag = await prisma.tag.create({
    data: { name: 'backend', color: '#10b981', projectId: project.id },
  });
  const docsTag = await prisma.tag.create({
    data: { name: 'docs', color: '#f59e0b', projectId: project.id },
  });

  console.warn('[seed] Створення задач...');
  await prisma.task.create({
    data: {
      title: 'Налаштувати CI/CD',
      description: 'Створити GitHub Actions workflow',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      projectId: project.id,
      assigneeId: alice.id,
      createdById: alice.id,
      tags: { create: [{ tagId: backendTag.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: 'Написати README',
      description: 'Опис ендпоінтів, змінні середовища, інструкції запуску',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      projectId: project.id,
      assigneeId: bob.id,
      createdById: alice.id,
      tags: { create: [{ tagId: docsTag.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: 'Покрити сервіси юніт-тестами',
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      projectId: project.id,
      assigneeId: alice.id,
      createdById: alice.id,
    },
  });

  console.warn('[seed] Готово. Демо-логін: alice@example.com / password123');
}

main()
  .catch((e) => {
    console.error('[seed] Помилка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
