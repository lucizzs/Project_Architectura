/**
 * Composition Root — збирає всі залежності.
 * In-Memory реалізація — без Prisma та Redis.
 */
import { UserRepository } from '../repositories/user.repository';
import { ProjectRepository } from '../repositories/project.repository';
import { TaskRepository } from '../repositories/task.repository';
import { CommentRepository } from '../repositories/comment.repository';

import { AuthService } from '../services/auth.service';
import { ProjectService } from '../services/project.service';
import { TaskService } from '../services/task.service';
import { CommentService } from '../services/comment.service';
import { StatsService } from '../services/stats.service';

import { AuthController } from '../controllers/auth.controller';
import { ProjectController } from '../controllers/project.controller';
import { TaskController } from '../controllers/task.controller';
import { CommentController } from '../controllers/comment.controller';
import { StatsController } from '../controllers/stats.controller';

import { InMemoryRedis } from './redis';

export interface AppContainer {
  authController: AuthController;
  projectController: ProjectController;
  taskController: TaskController;
  commentController: CommentController;
  statsController: StatsController;
}

export function buildContainer(redis?: InMemoryRedis): AppContainer {
  const cache = redis ?? new InMemoryRedis();

  const userRepo = new UserRepository();
  const projectRepo = new ProjectRepository();
  const taskRepo = new TaskRepository();
  const commentRepo = new CommentRepository();

  // Wire user resolver so tasks can embed assignee/createdBy
  taskRepo._userResolver = (id: string) => userRepo.findById(id).then((u) =>
    u ? { id: u.id, name: u.name, email: u.email } : null,
  );

  const authService = new AuthService(userRepo);
  const projectService = new ProjectService(projectRepo, userRepo);
  const taskService = new TaskService(taskRepo, projectService);
  const commentService = new CommentService(commentRepo, taskRepo, projectService);
  const statsService = new StatsService(taskRepo, projectService, cache as never);

  return {
    authController: new AuthController(authService),
    projectController: new ProjectController(projectService),
    taskController: new TaskController(taskService, statsService),
    commentController: new CommentController(commentService),
    statsController: new StatsController(statsService),
  };
}
