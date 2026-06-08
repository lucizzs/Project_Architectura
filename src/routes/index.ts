/**
 * Маршрутизація API. Базовий префікс — /api/v1.
 * Кожен ендпоінт описаний з валідацією та middleware авторизації.
 */
import { Router } from 'express';
import { AppContainer } from '../config/container';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

import { registerSchema, loginSchema } from '../dto/auth.dto';
import { createProjectSchema, updateProjectSchema, addMemberSchema } from '../dto/project.dto';
import { createTaskSchema, updateTaskSchema, taskFilterSchema } from '../dto/task.dto';
import { createCommentSchema } from '../dto/comment.dto';

export function buildRoutes(c: AppContainer): Router {
  const router = Router();

  // ── Auth ──
  router.post('/auth/register', validate(registerSchema), c.authController.register);
  router.post('/auth/login', validate(loginSchema), c.authController.login);
  router.get('/auth/me', authMiddleware, c.authController.me);
  router.get('/users/search', authMiddleware, c.authController.searchUsers);

  // ── Projects ──
  router.get('/projects', authMiddleware, c.projectController.list);
  router.post(
    '/projects',
    authMiddleware,
    validate(createProjectSchema),
    c.projectController.create,
  );
  router.get('/projects/:id', authMiddleware, c.projectController.getById);
  router.patch(
    '/projects/:id',
    authMiddleware,
    validate(updateProjectSchema),
    c.projectController.update,
  );
  router.delete('/projects/:id', authMiddleware, c.projectController.remove);
  router.get('/projects/:id/members', authMiddleware, c.projectController.getMembers);
  router.post(
    '/projects/:id/members',
    authMiddleware,
    validate(addMemberSchema),
    c.projectController.addMember,
  );
  router.delete('/projects/:id/members/:userId', authMiddleware, c.projectController.removeMember);

  // ── Tasks (nested під проєкт) ──
  router.get(
    '/projects/:projectId/tasks',
    authMiddleware,
    validate(taskFilterSchema, 'query'),
    c.taskController.list,
  );
  router.post(
    '/projects/:projectId/tasks',
    authMiddleware,
    validate(createTaskSchema),
    c.taskController.create,
  );

  // ── Tasks (за id) ──
  router.get('/tasks/:id', authMiddleware, c.taskController.getById);
  router.patch('/tasks/:id', authMiddleware, validate(updateTaskSchema), c.taskController.update);
  router.delete('/tasks/:id', authMiddleware, c.taskController.remove);

  // ── Comments ──
  router.get('/tasks/:taskId/comments', authMiddleware, c.commentController.list);
  router.post(
    '/tasks/:taskId/comments',
    authMiddleware,
    validate(createCommentSchema),
    c.commentController.create,
  );
  router.delete('/comments/:id', authMiddleware, c.commentController.remove);

  // ── Stats ──
  router.get('/projects/:projectId/stats', authMiddleware, c.statsController.projectStats);

  return router;
}
