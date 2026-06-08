import { Request, Response, NextFunction } from 'express';
import { CommentService } from '../services/comment.service';
import { UnauthorizedError } from '../domain/errors';

export class CommentController {
  constructor(private readonly comments: CommentService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const comment = await this.comments.create(req.user.id, req.params.taskId, req.body);
      res.status(201).json(comment);
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const items = await this.comments.listByTask(req.user.id, req.params.taskId);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await this.comments.delete(req.user.id, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
