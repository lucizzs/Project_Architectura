import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Коментар не може бути порожнім').max(5000),
});

export type CreateCommentDto = z.infer<typeof createCommentSchema>;

export interface CommentResponseDto {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  createdAt: Date;
}
