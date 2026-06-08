import { TaskService } from '../../src/services/task.service';
import { TaskRepository } from '../../src/repositories/task.repository';
import { ProjectService } from '../../src/services/project.service';
import { NotFoundError, ForbiddenError } from '../../src/domain/errors';


function makeTaskRepoMock(): jest.Mocked<TaskRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findManyByProject: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countByStatus: jest.fn(),
  } as unknown as jest.Mocked<TaskRepository>;
}

function makeProjectServiceMock(): jest.Mocked<ProjectService> {
  return {
    ensureMember: jest.fn(),
    ensureOwner: jest.fn(),
    getMemberRole: jest.fn(),
  } as unknown as jest.Mocked<ProjectService>;
}

import type { Task } from '../../src/repositories/task.repository';

const dummyTask = (overrides: Record<string, unknown> = {}): Task => ({
  id: 't1',
  title: 'Demo',
  description: null,
  status: 'TODO',
  priority: 'MEDIUM',
  dueDate: null,
  projectId: 'p1',
  assigneeId: null,
  createdById: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  assignee: null,
  createdBy: { id: 'u1', name: 'Test User', email: 'test@test.com' },
  ...overrides,
});

describe('TaskService', () => {
  let tasks: jest.Mocked<TaskRepository>;
  let projectService: jest.Mocked<ProjectService>;
  let service: TaskService;

  beforeEach(() => {
    tasks = makeTaskRepoMock();
    projectService = makeProjectServiceMock();
    service = new TaskService(tasks, projectService);
  });

  it('створює задачу після перевірки членства', async () => {
    projectService.ensureMember.mockResolvedValue();
    tasks.create.mockResolvedValue(dummyTask());
    const res = await service.create('u1', 'p1', { title: 'Demo' });
    expect(projectService.ensureMember).toHaveBeenCalledWith('p1', 'u1');
    expect(res.title).toBe('Demo');
  });

  it('list — повертає пагінацію', async () => {
    projectService.ensureMember.mockResolvedValue();
    tasks.findManyByProject.mockResolvedValue({
      items: [dummyTask(), dummyTask({ id: 't2' })],
      total: 2,
    });
    const res = await service.listByProject('u1', 'p1', {
      page: 1,
      pageSize: 20,
    });
    expect(res.items.length).toBe(2);
    expect(res.total).toBe(2);
    expect(res.totalPages).toBe(1);
  });

  it('getById — 404 коли нема', async () => {
    tasks.findById.mockResolvedValue(null);
    await expect(service.getById('u1', 't1')).rejects.toThrow(NotFoundError);
  });

  it('update — перевіряє членство', async () => {
    tasks.findById.mockResolvedValue(dummyTask());
    projectService.ensureMember.mockResolvedValue();
    tasks.update.mockResolvedValue(dummyTask({ title: 'New' }));
    const res = await service.update('u1', 't1', { title: 'New' });
    expect(res.title).toBe('New');
  });

  it('delete — заборонено стороннім', async () => {
    tasks.findById.mockResolvedValue(dummyTask({ createdById: 'u1', assigneeId: 'u2' }));
    projectService.getMemberRole.mockResolvedValue('MEMBER');
    await expect(service.delete('u3', 't1')).rejects.toThrow(ForbiddenError);
  });

  it('delete — дозволено OWNER', async () => {
    tasks.findById.mockResolvedValue(dummyTask({ createdById: 'someone', assigneeId: null }));
    projectService.getMemberRole.mockResolvedValue('OWNER');
    tasks.delete.mockResolvedValue();
    await expect(service.delete('u1', 't1')).resolves.toBeUndefined();
    expect(tasks.delete).toHaveBeenCalledWith('t1');
  });

  it('delete — дозволено creator', async () => {
    tasks.findById.mockResolvedValue(dummyTask({ createdById: 'u1' }));
    projectService.getMemberRole.mockResolvedValue('MEMBER');
    tasks.delete.mockResolvedValue();
    await expect(service.delete('u1', 't1')).resolves.toBeUndefined();
  });

  it('delete — дозволено assignee', async () => {
    tasks.findById.mockResolvedValue(dummyTask({ createdById: 'someone', assigneeId: 'u1' }));
    projectService.getMemberRole.mockResolvedValue('MEMBER');
    tasks.delete.mockResolvedValue();
    await expect(service.delete('u1', 't1')).resolves.toBeUndefined();
  });

  it('delete — 403, якщо взагалі не член', async () => {
    tasks.findById.mockResolvedValue(dummyTask());
    projectService.getMemberRole.mockResolvedValue(null);
    await expect(service.delete('u9', 't1')).rejects.toThrow(ForbiddenError);
  });
});
