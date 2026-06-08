/**
 * GoF Strategy — алгоритми пріоритизації та штрафів за прострочення.
 * Використовується в TaskService для ранжування задач.
 */

export interface Task {
  id: string;
  priority: string;
  dueDate: Date | null;
  status: string;
  title: string;
}

// ── Priority Strategy ──────────────────────────────────────────────────────

export interface IPriorityStrategy {
  score(task: Task): number;
}

const PRIORITY_BASE: Record<string, number> = {
  URGENT: 40, HIGH: 30, MEDIUM: 20, LOW: 10,
};

/** Пріоритизує за значенням поля priority */
export class PriorityFieldStrategy implements IPriorityStrategy {
  score(task: Task): number {
    return PRIORITY_BASE[task.priority] ?? 10;
  }
}

/** Пріоритизує за наближенням дедлайну */
export class DeadlineStrategy implements IPriorityStrategy {
  score(task: Task): number {
    if (!task.dueDate || task.status === 'DONE') return 0;
    const diffDays = (new Date(task.dueDate).getTime() - Date.now()) / 86_400_000;
    if (diffDays < 0) return 100;   // прострочено
    if (diffDays < 1) return 80;
    if (diffDays < 3) return 60;
    if (diffDays < 7) return 40;
    return 10;
  }
}

/** Гібридна: 60% пріоритет поля + 40% дедлайн */
export class HybridPriorityStrategy implements IPriorityStrategy {
  constructor(
    private readonly field = new PriorityFieldStrategy(),
    private readonly deadline = new DeadlineStrategy(),
    private readonly fieldWeight = 0.6,
  ) {}

  score(task: Task): number {
    return (
      this.field.score(task) * this.fieldWeight +
      this.deadline.score(task) * (1 - this.fieldWeight)
    );
  }
}

export class TaskPriorityContext {
  constructor(private strategy: IPriorityStrategy = new HybridPriorityStrategy()) {}

  setStrategy(s: IPriorityStrategy): void { this.strategy = s; }

  rank(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => this.strategy.score(b) - this.strategy.score(a));
  }
}

// ── Penalty Strategy ───────────────────────────────────────────────────────

export interface IPenaltyStrategy {
  penalty(daysOverdue: number): number;
}

/** Лінійний штраф: 1 бал/день */
export class LinearPenaltyStrategy implements IPenaltyStrategy {
  penalty(days: number): number { return Math.max(0, days); }
}

/** Експоненційний: 2^days, max 1024 */
export class ExponentialPenaltyStrategy implements IPenaltyStrategy {
  penalty(days: number): number {
    if (days <= 0) return 0;
    return Math.min(Math.pow(2, days), 1024);
  }
}

/** Ступінчастий: ≤3 → 5, ≤7 → 15, ≤14 → 30, >14 → 50 */
export class TieredPenaltyStrategy implements IPenaltyStrategy {
  penalty(days: number): number {
    if (days <= 0) return 0;
    if (days <= 3) return 5;
    if (days <= 7) return 15;
    if (days <= 14) return 30;
    return 50;
  }
}

export class PenaltyContext {
  constructor(private strategy: IPenaltyStrategy = new LinearPenaltyStrategy()) {}

  setStrategy(s: IPenaltyStrategy): void { this.strategy = s; }

  calculate(task: Task): number {
    if (!task.dueDate || task.status === 'DONE') return 0;
    const diffDays = (Date.now() - new Date(task.dueDate).getTime()) / 86_400_000;
    return this.strategy.penalty(Math.ceil(diffDays));
  }
}
