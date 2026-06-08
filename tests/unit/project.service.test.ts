import { ProjectService } from '../../src/services/project.service';
import { ProjectRole } from '../../src/repositories/project.repository';
import { ProjectRepository } from '../../src/repositories/project.repository';
import { UserRepository } from '../../src/repositories/user.repository';
import { ForbiddenError, NotFoundError, ConflictError } from '../../src/domain/errors';

function makeProjectRepoMock(): jest.Mocked<ProjectRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdWithCounts: jest.fn(),
    findAllForUser: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMember: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    findMembers: jest.fn(),
  } as unknown as jest.Mocked<ProjectRepository>;
}

function makeUserRepoMock(): jest.Mocked<UserRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    existsByEmail: jest.fn(),
    findByName: jest.fn(),
    searchByName: jest.fn(),
  } as unknown as jest.Mocked<UserRepository>;
}

const dummyProject = (overrides = {}) => ({
  id: 'p1',
  name: 'Test',
  description: null,
  ownerId: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const dummyMember = (role: ProjectRole, userId = 'u1', projectId = 'p1') => ({
  id: 'm1',
  projectId,
  userId,
  role,
  joinedAt: new Date(),
});

describe('ProjectService', () => {
  let projects: jest.Mocked<ProjectRepository>;
  let users: jest.Mocked<UserRepository>;
  let service: ProjectService;

  beforeEach(() => {
    projects = makeProjectRepoMock();
    users = makeUserRepoMock();
    service = new ProjectService(projects, users);
  });

  it('створює проєкт і робить творця власником', async () => {
    projects.create.mockResolvedValue(dummyProject());
    const res = await service.create('u1', { name: 'Test' });
    expect(res.name).toBe('Test');
    expect(projects.create).toHaveBeenCalledWith({
      name: 'Test',
      description: undefined,
      ownerId: 'u1',
    });
  });

  it('ensureOwner — кидає 403, якщо користувач не власник', async () => {
    projects.findMember.mockResolvedValue(dummyMember('MEMBER'));
    await expect(service.ensureOwner('p1', 'u1')).rejects.toThrow(ForbiddenError);
  });

  it('ensureOwner — пропускає власника', async () => {
    projects.findMember.mockResolvedValue(dummyMember('OWNER'));
    await expect(service.ensureOwner('p1', 'u1')).resolves.toBeUndefined();
  });

  it('ensureMember — кидає 403 для не-члена', async () => {
    projects.findMember.mockResolvedValue(null);
    await expect(service.ensureMember('p1', 'u9')).rejects.toThrow(ForbiddenError);
  });

  it('getById включає лічильники членів і задач', async () => {
    projects.findMember.mockResolvedValue(dummyMember('MEMBER'));
    projects.findByIdWithCounts.mockResolvedValue({
      ...dummyProject(),
      _count: { members: 3, tasks: 5 },
    });
    const res = await service.getById('u1', 'p1');
    expect(res.memberCount).toBe(3);
    expect(res.taskCount).toBe(5);
  });

  it('getById — 404 коли проєкту нема', async () => {
    projects.findMember.mockResolvedValue(dummyMember('MEMBER'));
    projects.findByIdWithCounts.mockResolvedValue(null);
    await expect(service.getById('u1', 'p1')).rejects.toThrow(NotFoundError);
  });

  it('addMember — заборонено для не-власника', async () => {
    projects.findMember.mockResolvedValue(dummyMember('MEMBER'));
    await expect(service.addMember('u1', 'p1', 'u2')).rejects.toThrow(ForbiddenError);
  });

  it('addMember — конфлікт, якщо вже член', async () => {
    projects.findMember
      .mockResolvedValueOnce(dummyMember('OWNER')) // ensureOwner
      .mockResolvedValueOnce(dummyMember('MEMBER', 'u2')); // findMember для нового
    users.findById.mockResolvedValue({
      id: 'u2',
      email: 'b@b.com',
      name: 'Bob',
      passwordHash: 'h',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(service.addMember('u1', 'p1', 'u2')).rejects.toThrow(ConflictError);
  });

  it('removeMember — не дозволяє видалити власника', async () => {
    projects.findMember
      .mockResolvedValueOnce(dummyMember('OWNER'))
      .mockResolvedValueOnce(dummyMember('OWNER', 'u1'));
    await expect(service.removeMember('u1', 'p1', 'u1')).rejects.toThrow(ForbiddenError);
  });

  it('getMemberRole — повертає роль або null', async () => {
    projects.findMember.mockResolvedValue(dummyMember('MEMBER'));
    expect(await service.getMemberRole('p1', 'u1')).toBe('MEMBER');
    projects.findMember.mockResolvedValue(null);
    expect(await service.getMemberRole('p1', 'u9')).toBeNull();
  });

  describe('getMembers', () => {
    it('повертає членів проєкту для учасника', async () => {
      projects.findMember.mockResolvedValue(dummyMember('MEMBER'));
      projects.findMembers.mockResolvedValue([
        { id: 'u1', name: 'Alice', email: 'a@b.com', role: 'OWNER' },
        { id: 'u2', name: 'Bob', email: 'b@b.com', role: 'MEMBER' },
      ]);
      const res = await service.getMembers('u1', 'p1');
      expect(res).toHaveLength(2);
      expect(res[0].name).toBe('Alice');
      expect(projects.findMembers).toHaveBeenCalledWith('p1');
    });

    it('кидає 403 для не-учасника', async () => {
      projects.findMember.mockResolvedValue(null);
      await expect(service.getMembers('u9', 'p1')).rejects.toThrow(ForbiddenError);
      expect(projects.findMembers).not.toHaveBeenCalled();
    });
  });
});
