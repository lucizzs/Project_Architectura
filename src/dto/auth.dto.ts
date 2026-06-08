import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Невірний формат email'),
  password: z.string().min(8, 'Пароль має бути не менше 8 символів').max(128),
  name: z.string().min(1, "Ім'я обов'язкове").max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;

export interface AuthResponseDto {
  user: {
    id: string;
    email: string;
    name: string;
  };
  accessToken: string;
}
