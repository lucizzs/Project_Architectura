import { Task, TaskPriority } from '../domain/models';

// ─────────────────────────────────────────────────────────────────────────────
// Strategy Pattern — алгоритми розрахунку пріоритету та штрафів
// GoF: Strategy дозволяє замінювати алгоритми незалежно від клієнтів
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Інтерфейс стратегії розрахунку «ваги» задачі.
 * Використовується для сортування та ескалації.
 */
export interface ITaskPriorityStrategy {
  readonly name: string;
  calculateWeight(task: Task): number;
  shouldEscalate(task: Task): boolean;
}

/**
 * Стратегія на основі дедлайну:
 * чим менше часу до дедлайну — тим вища вага.
 */
export class DeadlineBasedPriorityStrategy implements ITaskPriorityStrategy {
  readonly name = 'deadline-based';

  private readonly PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
    CRITICAL: 1000,
    HIGH: 100,
    MEDIUM: 10,
    LOW: 1,
  };

  calculateWeight(task: Task): number {
    const priorityWeight = this.PRIORITY_WEIGHTS[task.priority];

    if (!task.dueDate) return priorityWeight;

    const now = Date.now();
    const due = new Date(task.dueDate).getTime();
    const msPerDay = 86_400_000;
    const daysUntilDue = (due - now) / msPerDay;

    if (daysUntilDue < 0) {
      // Прострочена — бонус пропорційний до прострочення
      return priorityWeight + Math.abs(daysUntilDue) * 50;
    }
    if (daysUntilDue < 1) return priorityWeight * 10;
    if (daysUntilDue < 3) return priorityWeight * 5;
    if (daysUntilDue < 7) return priorityWeight * 2;

    return priorityWeight;
  }

  shouldEscalate(task: Task): boolean {
    if (!task.dueDate || task.status === 'DONE' || task.status === 'CANCELLED') return false;
    const daysLeft = (new Date(task.dueDate).getTime() - Date.now()) / 86_400_000;
    return daysLeft < 1;
  }
}

/**
 * Стратегія на основі складності:
 * враховує estimatedHours та кількість описових символів.
 */
export class ComplexityBasedPriorityStrategy implements ITaskPriorityStrategy {
  readonly name = 'complexity-based';

  calculateWeight(task: Task): number {
    let weight = 0;

    switch (task.priority) {
      case 'CRITICAL': weight += 400; break;
      case 'HIGH':     weight += 300; break;
      case 'MEDIUM':   weight += 200; break;
      case 'LOW':      weight += 100; break;
    }

    if (task.estimatedHours) {
      weight += Math.min(task.estimatedHours * 10, 200);
    }

    if (task.description) {
      weight += Math.min(task.description.length / 10, 50);
    }

    return weight;
  }

  shouldEscalate(task: Task): boolean {
    return task.priority === 'CRITICAL' && task.status === 'TODO';
  }
}

/**
 * Комбінована стратегія: зважений середній балів deadline + complexity.
 */
export class HybridPriorityStrategy implements ITaskPriorityStrategy {
  readonly name = 'hybrid';

  private readonly deadline = new DeadlineBasedPriorityStrategy();
  private readonly complexity = new ComplexityBasedPriorityStrategy();

  constructor(
    private readonly deadlineWeight = 0.6,
    private readonly complexityWeight = 0.4,
  ) {}

  calculateWeight(task: Task): number {
    return (
      this.deadline.calculateWeight(task) * this.deadlineWeight +
      this.complexity.calculateWeight(task) * this.complexityWeight
    );
  }

  shouldEscalate(task: Task): boolean {
    return this.deadline.shouldEscalate(task) || this.complexity.shouldEscalate(task);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy — алгоритм нарахування штрафів за прострочені задачі
// ─────────────────────────────────────────────────────────────────────────────

export interface IPenaltyStrategy {
  readonly name: string;
  calculatePenalty(task: Task): number;
  describe(): string;
}

/**
 * Лінійний штраф: 1 бал за кожен прострочений день.
 */
export class LinearPenaltyStrategy implements IPenaltyStrategy {
  readonly name = 'linear';

  calculatePenalty(task: Task): number {
    if (!task.dueDate || task.status === 'DONE' || task.status === 'CANCELLED') return 0;
    const overdueDays = (Date.now() - new Date(task.dueDate).getTime()) / 86_400_000;
    return overdueDays > 0 ? Math.ceil(overdueDays) : 0;
  }

  describe(): string {
    return 'Лінійний штраф: 1 бал/день прострочення';
  }
}

/**
 * Експоненційний штраф: 2^days — для критичних задач.
 */
export class ExponentialPenaltyStrategy implements IPenaltyStrategy {
  readonly name = 'exponential';

  calculatePenalty(task: Task): number {
    if (!task.dueDate || task.status === 'DONE' || task.status === 'CANCELLED') return 0;
    const overdueDays = (Date.now() - new Date(task.dueDate).getTime()) / 86_400_000;
    if (overdueDays <= 0) return 0;
    return Math.round(Math.pow(2, Math.min(overdueDays, 10)));
  }

  describe(): string {
    return 'Експоненційний штраф: 2^days (макс. 1024 балів)';
  }
}

/**
 * Ступеневий штраф: зростає ступенями (1-3 дні, 4-7, 8+).
 */
export class TieredPenaltyStrategy implements IPenaltyStrategy {
  readonly name = 'tiered';

  calculatePenalty(task: Task): number {
    if (!task.dueDate || task.status === 'DONE' || task.status === 'CANCELLED') return 0;
    const overdueDays = (Date.now() - new Date(task.dueDate).getTime()) / 86_400_000;
    if (overdueDays <= 0) return 0;
    if (overdueDays <= 3) return 5;
    if (overdueDays <= 7) return 15;
    if (overdueDays <= 14) return 30;
    return 50;
  }

  describe(): string {
    return 'Ступеневий штраф: 5/15/30/50 балів за рівнями прострочення';
  }
}

/**
 * Контекст (context) для Strategy Pattern.
 * Клієнт взаємодіє лише з TaskPriorityContext, не з конкретними стратегіями.
 */
export class TaskPriorityContext {
  constructor(private strategy: ITaskPriorityStrategy) {}

  setStrategy(strategy: ITaskPriorityStrategy): void {
    this.strategy = strategy;
  }

  getStrategyName(): string {
    return this.strategy.name;
  }

  rank(tasks: Task[]): Task[] {
    return [...tasks].sort(
      (a, b) => this.strategy.calculateWeight(b) - this.strategy.calculateWeight(a),
    );
  }

  getEscalations(tasks: Task[]): Task[] {
    return tasks.filter((t) => this.strategy.shouldEscalate(t));
  }
}

export class PenaltyContext {
  constructor(private strategy: IPenaltyStrategy) {}

  setStrategy(strategy: IPenaltyStrategy): void {
    this.strategy = strategy;
  }

  getStrategyName(): string {
    return this.strategy.name;
  }

  getPenalty(task: Task): number {
    return this.strategy.calculatePenalty(task);
  }

  getTotalPenalty(tasks: Task[]): number {
    return tasks.reduce((sum, t) => sum + this.strategy.calculatePenalty(t), 0);
  }

  describe(): string {
    return this.strategy.describe();
  }
}
