import { IUserRepository } from '../repositories/interfaces';
import { CreateUserDto, LoginDto, AuthTokenDto, UserResponseDto } from '../domain/models';
import {
  hashPassword, verifyPassword, signToken,
  isValidEmail, isValidPassword, sanitizeString,
} from '../utils/crypto.utils';
import { ConflictError, UnauthorizedError, ValidationError } from '../domain/errors';

export class AuthService {
  constructor(private readonly users: IUserRepository) {}

  async register(dto: CreateUserDto): Promise<AuthTokenDto> {
    if (!isValidEmail(dto.email)) {
      throw new ValidationError('Невірний формат email');
    }
    if (!isValidPassword(dto.password)) {
      throw new ValidationError('Пароль повинен містити мінімум 8 символів');
    }
    const name = sanitizeString(dto.name);
    if (!name) throw new ValidationError("Ім'я не може бути порожнім");

    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictError('Email вже зареєстрований');

    const passwordHash = hashPassword(dto.password);
    const user = await this.users.create({
      name,
      email: dto.email.toLowerCase(),
      passwordHash,
      isActive: true,
    });

    const token = signToken(user.id, user.email);
    return { token, user: this.toDto(user) };
  }

  async login(dto: LoginDto): Promise<AuthTokenDto> {
    const user = await this.users.findByEmail(dto.email.toLowerCase());
    if (!user) throw new UnauthorizedError('Невірний email або пароль');
    if (!user.isActive) throw new UnauthorizedError('Акаунт деактивовано');

    const valid = verifyPassword(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Невірний email або пароль');

    const token = signToken(user.id, user.email);
    return { token, user: this.toDto(user) };
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedError('Користувач не знайдений');
    return this.toDto(user);
  }

  private toDto(user: { id: string; name: string; email: string; isActive: boolean; createdAt: Date }): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
