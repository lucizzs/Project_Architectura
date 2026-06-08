import { Request, Response, NextFunction } from 'express';
import { TaskService } from '../services/task.service';
import { StatsService } from '../services/stats.service';
import { UnauthorizedError } from '../domain/errors';

export class TaskController {
  constructor(
    private readonly tasks: TaskService,
    private readonly stats: StatsService,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const projectId = req.params.projectId;
      const task = await this.tasks.create(req.user.id, projectId, req.body);
      await this.stats.invalidateProjectStats(projectId);
      res.status(201).json(task);
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await this.tasks.listByProject(
        req.user.id,
        req.params.projectId,
        // після validate(taskFilterSchema, 'query') у req.query вже парсений об'єкт
        req.query as unknown as import('../dto/task.dto').TaskFilterDto,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const task = await this.tasks.getById(req.user.id, req.params.id);
      res.json(task);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const task = await this.tasks.update(req.user.id, req.params.id, req.body);
      await this.stats.invalidateProjectStats(task.projectId);
      res.json(task);
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const task = await this.tasks.getById(req.user.id, req.params.id);
      await this.tasks.delete(req.user.id, req.params.id);
      await this.stats.invalidateProjectStats(task.projectId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
