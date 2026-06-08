import { UserRepository } from '../repositories/user.repository';
import { RegisterDto, LoginDto, AuthResponseDto } from '../dto/auth.dto';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { ConflictError, UnauthorizedError, NotFoundError } from '../domain/errors';

export class AuthService {
  constructor(private readonly users: UserRepository) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const exists = await this.users.existsByEmail(dto.email);
    if (exists) throw new ConflictError('Користувач з таким email вже існує');
    const passwordHash = await hashPassword(dto.password);
    const user = await this.users.create({ email: dto.email, name: dto.name, passwordHash });
    const accessToken = signToken({ sub: user.id, email: user.email });
    return { user: { id: user.id, email: user.email, name: user.name }, accessToken };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedError('Невірний email або пароль');
    const ok = await verifyPassword(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedError('Невірний email або пароль');
    const accessToken = signToken({ sub: user.id, email: user.email });
    return { user: { id: user.id, email: user.email, name: user.name }, accessToken };
  }

  async getCurrentUser(userId: string): Promise<{ id: string; email: string; name: string }> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Користувач');
    return { id: user.id, email: user.email, name: user.name };
  }

  async searchByName(query: string): Promise<{ id: string; name: string; email: string }[]> {
    if (!query || query.trim().length < 1) return [];
    return this.users.searchByName(query.trim());
  }

  async findByName(name: string): Promise<{ id: string; name: string; email: string } | null> {
    return this.users.findByName(name);
  }
}
