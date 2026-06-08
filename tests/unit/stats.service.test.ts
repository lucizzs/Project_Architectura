import { StatsService } from '../../src/services/stats.service';
import { TaskRepository } from '../../src/repositories/task.repository';
import { ProjectService } from '../../src/services/project.service';
import { InMemoryRedis } from '../../src/config/redis';

function makeTaskRepoMock(): jest.Mocked<TaskRepository> {
  return { countByStatus: jest.fn() } as unknown as jest.Mocked<TaskRepository>;
}

function makeProjectServiceMock(): jest.Mocked<ProjectService> {
  return { ensureMember: jest.fn() } as unknown as jest.Mocked<ProjectService>;
}

describe('StatsService', () => {
  let tasks: jest.Mocked<TaskRepository>;
  let projectService: jest.Mocked<ProjectService>;
  let cache: InMemoryRedis;
  let service: StatsService;

  beforeEach(() => {
    tasks = makeTaskRepoMock();
    projectService = makeProjectServiceMock();
    cache = new InMemoryRedis();
    service = new StatsService(tasks, projectService, cache as never);
  });

  it('обчислює статистику без кешу', async () => {
    projectService.ensureMember.mockResolvedValue();
    tasks.countByStatus.mockResolvedValue({ TODO: 3, DONE: 2 });
    const res = await service.getProjectStats('u1', 'p1');
    expect(res.cached).toBe(false);
    expect(res.total).toBe(5);
    expect(res.byStatus).toEqual({ TODO: 3, DONE: 2 });
  });

  it('повертає кешовані дані при повторному запиті', async () => {
    projectService.ensureMember.mockResolvedValue();
    tasks.countByStatus.mockResolvedValue({ TODO: 1 });
    await service.getProjectStats('u1', 'p1');
    const res2 = await service.getProjectStats('u1', 'p1');
    expect(res2.cached).toBe(true);
    expect(tasks.countByStatus).toHaveBeenCalledTimes(1);
  });

  it('invalidateProjectStats очищає кеш', async () => {
    projectService.ensureMember.mockResolvedValue();
    tasks.countByStatus.mockResolvedValue({ DONE: 5 });
    await service.getProjectStats('u1', 'p1');
    await service.invalidateProjectStats('p1');
    await service.getProjectStats('u1', 'p1');
    expect(tasks.countByStatus).toHaveBeenCalledTimes(2);
  });

  it('повертає total = сума всіх статусів', async () => {
    projectService.ensureMember.mockResolvedValue();
    tasks.countByStatus.mockResolvedValue({ TODO: 2, IN_PROGRESS: 3, DONE: 1 });
    const res = await service.getProjectStats('u1', 'p1');
    expect(res.total).toBe(6);
  });
});
