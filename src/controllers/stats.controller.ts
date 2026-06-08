import { Request, Response, NextFunction } from 'express';
import { StatsService } from '../services/stats.service';
import { UnauthorizedError } from '../domain/errors';

export class StatsController {
  constructor(private readonly stats: StatsService) {}

  projectStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await this.stats.getProjectStats(req.user.id, req.params.projectId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
