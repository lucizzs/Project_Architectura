/**
 * CommentRepository — In-Memory реалізація.
 */

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

let _cSeq = 1;
function genId(): string {
  return `c_${Date.now()}_${_cSeq++}`;
}

export class CommentRepository {
  private readonly store = new Map<string, Comment>();

  async create(taskId: string, authorId: string, content: string): Promise<Comment> {
    const comment: Comment = {
      id: genId(),
      content,
      taskId,
      authorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(comment.id, comment);
    return { ...comment };
  }

  async findByTask(taskId: string): Promise<Comment[]> {
    return [...this.store.values()]
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((c) => ({ ...c }));
  }

  async findById(id: string): Promise<Comment | null> {
    const c = this.store.get(id);
    return c ? { ...c } : null;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  _clear(): void {
    this.store.clear();
  }
}
