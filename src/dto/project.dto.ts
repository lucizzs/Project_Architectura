import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова").max(200),
  description: z.string().max(2000).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid('Невірний формат userId'),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type AddMemberDto = z.infer<typeof addMemberSchema>;

export interface ProjectResponseDto {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  memberCount?: number;
  taskCount?: number;
}
