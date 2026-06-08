import { Request, Response, NextFunction } from 'express';
import { ProjectService } from '../services/project.service';
import { UnauthorizedError } from '../domain/errors';

export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const project = await this.projects.create(req.user.id, req.body);
      res.status(201).json(project);
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const projects = await this.projects.listForUser(req.user.id);
      res.json({ items: projects });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const project = await this.projects.getById(req.user.id, req.params.id);
      res.json(project);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const project = await this.projects.update(req.user.id, req.params.id, req.body);
      res.json(project);
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await this.projects.delete(req.user.id, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  getMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const members = await this.projects.getMembers(req.user.id, req.params.id);
      res.json({ members });
    } catch (err) {
      next(err);
    }
  };

  addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await this.projects.addMember(req.user.id, req.params.id, req.body.userId);
      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await this.projects.removeMember(req.user.id, req.params.id, req.params.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
