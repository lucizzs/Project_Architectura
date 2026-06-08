/**
 * Юніт-тести AuthService.
 * UserRepository мокається — не торкаємось БД.
 */
import { AuthService } from '../../src/services/auth.service';
import { UserRepository } from '../../src/repositories/user.repository';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../src/domain/errors';
import { hashPassword } from '../../src/utils/password';

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

describe('AuthService', () => {
  let userRepo: jest.Mocked<UserRepository>;
  let service: AuthService;

  beforeEach(() => {
    userRepo = makeUserRepoMock();
    service = new AuthService(userRepo);
  });

  describe('register', () => {
    it('реєструє нового користувача і повертає токен', async () => {
      userRepo.existsByEmail.mockResolvedValue(false);
      userRepo.create.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'Alice',
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.register({
        email: 'a@b.com',
        password: 'password123',
        name: 'Alice',
      });

      expect(res.user.email).toBe('a@b.com');
      expect(res.user.name).toBe('Alice');
      expect(res.accessToken).toBeDefined();
      expect(typeof res.accessToken).toBe('string');
      expect(userRepo.create).toHaveBeenCalledTimes(1);
    });

    it('кидає ConflictError, якщо email вже зайнятий', async () => {
      userRepo.existsByEmail.mockResolvedValue(true);

      await expect(
        service.register({ email: 'a@b.com', password: 'password123', name: 'A' }),
      ).rejects.toThrow(ConflictError);
      expect(userRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('повертає токен при правильному паролі', async () => {
      const passwordHash = await hashPassword('mypassword');
      userRepo.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'Alice',
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.login({ email: 'a@b.com', password: 'mypassword' });
      expect(res.accessToken).toBeDefined();
      expect(res.user.id).toBe('u1');
    });

    it('кидає UnauthorizedError, якщо користувача не існує', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'x@x.com', password: 'whatever' })).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('кидає UnauthorizedError при неправильному паролі', async () => {
      const passwordHash = await hashPassword('rightpass');
      userRepo.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'Alice',
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await expect(service.login({ email: 'a@b.com', password: 'wrongpass' })).rejects.toThrow(
        UnauthorizedError,
      );
    });
  });

  describe('getCurrentUser', () => {
    it('повертає поточного користувача', async () => {
      userRepo.findById.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'Alice',
        passwordHash: 'h',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const res = await service.getCurrentUser('u1');
      expect(res).toEqual({ id: 'u1', email: 'a@b.com', name: 'Alice' });
    });

    it('кидає NotFoundError, якщо користувача нема', async () => {
      userRepo.findById.mockResolvedValue(null);
      await expect(service.getCurrentUser('xxx')).rejects.toThrow(NotFoundError);
    });
  });

  describe('searchByName', () => {
    it('повертає [] для порожнього запиту', async () => {
      const res = await service.searchByName('');
      expect(res).toEqual([]);
      expect(userRepo.searchByName).not.toHaveBeenCalled();
    });

    it('повертає [] для запиту з самих пробілів', async () => {
      const res = await service.searchByName('   ');
      expect(res).toEqual([]);
      expect(userRepo.searchByName).not.toHaveBeenCalled();
    });

    it('обрізає пробіли і викликає репозиторій', async () => {
      userRepo.searchByName.mockResolvedValue([{ id: 'u1', name: 'Alice', email: 'a@b.com' }]);
      const res = await service.searchByName('  Alice  ');
      expect(userRepo.searchByName).toHaveBeenCalledWith('Alice');
      expect(res).toHaveLength(1);
      expect(res[0].name).toBe('Alice');
    });

    it('повертає кілька результатів від репозиторія', async () => {
      userRepo.searchByName.mockResolvedValue([
        { id: 'u1', name: 'Alice', email: 'a@b.com' },
        { id: 'u2', name: 'Alicia', email: 'al@b.com' },
      ]);
      const res = await service.searchByName('Ali');
      expect(res).toHaveLength(2);
    });
  });

  describe('findByName', () => {
    it('делегує виклик репозиторію', async () => {
      userRepo.findByName.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'Alice',
        passwordHash: 'h',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const res = await service.findByName('Alice');
      expect(res?.name).toBe('Alice');
      expect(userRepo.findByName).toHaveBeenCalledWith('Alice');
    });

    it('повертає null, якщо репозиторій не знайшов', async () => {
      userRepo.findByName.mockResolvedValue(null);
      const res = await service.findByName('Nobody');
      expect(res).toBeNull();
    });
  });
});
