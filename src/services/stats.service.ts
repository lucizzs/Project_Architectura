import { InMemoryRedis } from '../config/redis';
/**
 * StatsService — статистика проєкту з кешуванням у Redis.
 * Якщо Redis недоступний — gracefully fallback на пряме обчислення.
 */

import { TaskRepository } from '../repositories/task.repository';
import { ProjectService } from './project.service';
import { logger } from '../utils/logger';

export interface ProjectStats {
  projectId: string;
  byStatus: Record<string, number>;
  total: number;
  cached: boolean;
}

const CACHE_TTL_SECONDS = 60;

export class StatsService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly projectService: ProjectService,
    private readonly redis: InMemoryRedis,
  ) {}

  async getProjectStats(userId: string, projectId: string): Promise<ProjectStats> {
    await this.projectService.ensureMember(projectId, userId);

    const cacheKey = `stats:project:${projectId}`;

    // Спробуємо прочитати з кешу
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as Omit<ProjectStats, 'cached'>;
        return { ...parsed, cached: true };
      }
    } catch (err) {
      logger.warn({ err }, 'Redis GET failed — fallback');
    }

    const byStatus = await this.tasks.countByStatus(projectId);
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const result: ProjectStats = { projectId, byStatus, total, cached: false };

    // Записати в кеш (помилка — не критична)
    try {
      await this.redis.setex(
        cacheKey,
        CACHE_TTL_SECONDS,
        JSON.stringify({ projectId, byStatus, total }),
      );
    } catch (err) {
      logger.warn({ err }, 'Redis SETEX failed');
    }

    return result;
  }

  async invalidateProjectStats(projectId: string): Promise<void> {
    try {
      await this.redis.del(`stats:project:${projectId}`);
    } catch (err) {
      logger.warn({ err }, 'Redis DEL failed');
    }
  }
}
