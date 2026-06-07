import {
  DeadlineBasedPriorityStrategy,
  ComplexityBasedPriorityStrategy,
  HybridPriorityStrategy,
  LinearPenaltyStrategy,
  ExponentialPenaltyStrategy,
  TieredPenaltyStrategy,
  TaskPriorityContext,
  PenaltyContext,
} from '../../../src/strategies/priority.strategy';
import { Task } from '../../../src/domain/models';
import { pastDate, futureDate } from '../../helpers';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test',
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: null,
    projectId: 'p1',
    assigneeId: null,
    createdById: 'u1',
    estimatedHours: null,
    actualHours: null,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// DeadlineBasedPriorityStrategy
// ══════════════════════════════════════════════════════════════════════════════
describe('DeadlineBasedPriorityStrategy', () => {
  const strategy = new DeadlineBasedPriorityStrategy();

  it('name is "deadline-based"', () => {
    expect(strategy.name).toBe('deadline-based');
  });

  it('CRITICAL without due date returns base 1000', () => {
    expect(strategy.calculateWeight(makeTask({ priority: 'CRITICAL' }))).toBe(1000);
  });

  it('HIGH without due date returns base 100', () => {
    expect(strategy.calculateWeight(makeTask({ priority: 'HIGH' }))).toBe(100);
  });

  it('MEDIUM without due date returns base 10', () => {
    expect(strategy.calculateWeight(makeTask({ priority: 'MEDIUM' }))).toBe(10);
  });

  it('LOW without due date returns base 1', () => {
    expect(strategy.calculateWeight(makeTask({ priority: 'LOW' }))).toBe(1);
  });

  it('overdue task gets higher weight than non-overdue', () => {
    const overdue = makeTask({ priority: 'MEDIUM', dueDate: pastDate(5) });
    const future = makeTask({ priority: 'MEDIUM', dueDate: futureDate(30) });
    expect(strategy.calculateWeight(overdue)).toBeGreaterThan(strategy.calculateWeight(future));
  });

  it('due within 1 day gets 10x multiplier', () => {
    const d = new Date(Date.now() + 30 * 60 * 1000); // 30 min ahead
    const task = makeTask({ priority: 'MEDIUM', dueDate: d });
    expect(strategy.calculateWeight(task)).toBe(100); // 10 * 10
  });

  it('due within 3 days gets 5x multiplier', () => {
    const d = new Date(Date.now() + 2 * 86_400_000);
    const task = makeTask({ priority: 'MEDIUM', dueDate: d });
    expect(strategy.calculateWeight(task)).toBe(50); // 10 * 5
  });

  it('due within 7 days gets 2x multiplier', () => {
    const d = new Date(Date.now() + 5 * 86_400_000);
    const task = makeTask({ priority: 'MEDIUM', dueDate: d });
    expect(strategy.calculateWeight(task)).toBe(20); // 10 * 2
  });

  it('shouldEscalate returns true when due within 24h', () => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    expect(strategy.shouldEscalate(makeTask({ dueDate: d }))).toBe(true);
  });

  it('shouldEscalate returns false for DONE task even if overdue', () => {
    expect(strategy.shouldEscalate(makeTask({ dueDate: pastDate(), status: 'DONE' }))).toBe(false);
  });

  it('shouldEscalate returns false when no due date', () => {
    expect(strategy.shouldEscalate(makeTask())).toBe(false);
  });

  it('shouldEscalate returns false when CANCELLED', () => {
    expect(strategy.shouldEscalate(makeTask({ dueDate: pastDate(), status: 'CANCELLED' }))).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ComplexityBasedPriorityStrategy
// ══════════════════════════════════════════════════════════════════════════════
describe('ComplexityBasedPriorityStrategy', () => {
  const strategy = new ComplexityBasedPriorityStrategy();

  it('name is "complexity-based"', () => {
    expect(strategy.name).toBe('complexity-based');
  });

  it('CRITICAL base weight is 400', () => {
    expect(strategy.calculateWeight(makeTask({ priority: 'CRITICAL' }))).toBe(400);
  });

  it('adds weight for estimatedHours', () => {
    const w1 = strategy.calculateWeight(makeTask({ priority: 'MEDIUM', estimatedHours: 8 }));
    const w2 = strategy.calculateWeight(makeTask({ priority: 'MEDIUM', estimatedHours: 0 }));
    expect(w1).toBeGreaterThan(w2);
  });

  it('estimatedHours capped at 200 extra points', () => {
    const high = strategy.calculateWeight(makeTask({ priority: 'LOW', estimatedHours: 9999 }));
    const cap = strategy.calculateWeight(makeTask({ priority: 'LOW', estimatedHours: 20 }));
    expect(high).toBe(cap);
  });

  it('description adds weight', () => {
    const long = strategy.calculateWeight(makeTask({ priority: 'LOW', description: 'A'.repeat(200) }));
    const none = strategy.calculateWeight(makeTask({ priority: 'LOW', description: null }));
    expect(long).toBeGreaterThan(none);
  });

  it('shouldEscalate returns true for CRITICAL + TODO', () => {
    expect(strategy.shouldEscalate(makeTask({ priority: 'CRITICAL', status: 'TODO' }))).toBe(true);
  });

  it('shouldEscalate returns false for non-CRITICAL', () => {
    expect(strategy.shouldEscalate(makeTask({ priority: 'HIGH', status: 'TODO' }))).toBe(false);
  });

  it('shouldEscalate returns false for CRITICAL + DONE', () => {
    expect(strategy.shouldEscalate(makeTask({ priority: 'CRITICAL', status: 'DONE' }))).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HybridPriorityStrategy
// ══════════════════════════════════════════════════════════════════════════════
describe('HybridPriorityStrategy', () => {
  const strategy = new HybridPriorityStrategy();

  it('name is "hybrid"', () => {
    expect(strategy.name).toBe('hybrid');
  });

  it('overdue CRITICAL task has high weight', () => {
    const w = strategy.calculateWeight(makeTask({ priority: 'CRITICAL', dueDate: pastDate(5) }));
    expect(w).toBeGreaterThan(100);
  });

  it('shouldEscalate combines both strategies', () => {
    expect(strategy.shouldEscalate(makeTask({ priority: 'CRITICAL', status: 'TODO' }))).toBe(true);
    const imminentDue = new Date(Date.now() + 30 * 60 * 1000);
    expect(strategy.shouldEscalate(makeTask({ dueDate: imminentDue }))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Penalty Strategies
// ══════════════════════════════════════════════════════════════════════════════
describe('LinearPenaltyStrategy', () => {
  const strategy = new LinearPenaltyStrategy();

  it('name is "linear"', () => expect(strategy.name).toBe('linear'));
  it('returns 0 for task without due date', () => {
    expect(strategy.calculatePenalty(makeTask())).toBe(0);
  });
  it('returns 0 for DONE task even if overdue', () => {
    expect(strategy.calculatePenalty(makeTask({ dueDate: pastDate(), status: 'DONE' }))).toBe(0);
  });
  it('returns 0 for CANCELLED task', () => {
    expect(strategy.calculatePenalty(makeTask({ dueDate: pastDate(), status: 'CANCELLED' }))).toBe(0);
  });
  it('returns 0 for future due date', () => {
    expect(strategy.calculatePenalty(makeTask({ dueDate: futureDate() }))).toBe(0);
  });
  it('returns positive penalty for overdue task', () => {
    expect(strategy.calculatePenalty(makeTask({ dueDate: pastDate(3) }))).toBeGreaterThan(0);
  });
  it('penalty increases with more overdue days', () => {
    const p3 = strategy.calculatePenalty(makeTask({ dueDate: pastDate(3) }));
    const p7 = strategy.calculatePenalty(makeTask({ dueDate: pastDate(7) }));
    expect(p7).toBeGreaterThan(p3);
  });
  it('describe returns string', () => {
    expect(typeof strategy.describe()).toBe('string');
  });
});

describe('ExponentialPenaltyStrategy', () => {
  const strategy = new ExponentialPenaltyStrategy();

  it('name is "exponential"', () => expect(strategy.name).toBe('exponential'));
  it('returns 0 for non-overdue', () => {
    expect(strategy.calculatePenalty(makeTask({ dueDate: futureDate() }))).toBe(0);
  });
  it('returns higher penalty than linear for same overdue', () => {
    const linear = new LinearPenaltyStrategy();
    const task = makeTask({ dueDate: pastDate(5) });
    expect(strategy.calculatePenalty(task)).toBeGreaterThan(linear.calculatePenalty(task));
  });
  it('caps at 2^10 = 1024', () => {
    const task = makeTask({ dueDate: pastDate(100) });
    expect(strategy.calculatePenalty(task)).toBe(1024);
  });
});

describe('TieredPenaltyStrategy', () => {
  const strategy = new TieredPenaltyStrategy();

  it('name is "tiered"', () => expect(strategy.name).toBe('tiered'));
  it('1-3 days overdue → 5 points', () => {
    expect(strategy.calculatePenalty(makeTask({ dueDate: pastDate(2) }))).toBe(5);
  });
  it('4-7 days overdue → 15 points', () => {
    expect(strategy.calculatePenalty(makeTask({ dueDate: pastDate(5) }))).toBe(15);
  });
  it('8-14 days overdue → 30 points', () => {
    expect(strategy.calculatePenalty(makeTask({ dueDate: pastDate(10) }))).toBe(30);
  });
  it('15+ days overdue → 50 points', () => {
    expect(strategy.calculatePenalty(makeTask({ dueDate: pastDate(20) }))).toBe(50);
  });
  it('returns 0 for non-overdue', () => {
    expect(strategy.calculatePenalty(makeTask({ dueDate: futureDate() }))).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Context classes
// ══════════════════════════════════════════════════════════════════════════════
describe('TaskPriorityContext', () => {
  it('rank sorts by weight descending', () => {
    const ctx = new TaskPriorityContext(new DeadlineBasedPriorityStrategy());
    const tasks = [
      makeTask({ id: 'low', priority: 'LOW' }),
      makeTask({ id: 'crit', priority: 'CRITICAL' }),
      makeTask({ id: 'med', priority: 'MEDIUM' }),
    ];
    const ranked = ctx.rank(tasks);
    expect(ranked[0].id).toBe('crit');
    expect(ranked[ranked.length - 1].id).toBe('low');
  });

  it('getEscalations returns only tasks that should escalate', () => {
    const ctx = new TaskPriorityContext(new DeadlineBasedPriorityStrategy());
    const imminentDue = new Date(Date.now() + 30 * 60 * 1000);
    const tasks = [
      makeTask({ id: 'soon', dueDate: imminentDue }),
      makeTask({ id: 'later', dueDate: futureDate(30) }),
    ];
    expect(ctx.getEscalations(tasks).map((t) => t.id)).toContain('soon');
    expect(ctx.getEscalations(tasks).map((t) => t.id)).not.toContain('later');
  });

  it('getStrategyName returns correct name', () => {
    const ctx = new TaskPriorityContext(new ComplexityBasedPriorityStrategy());
    expect(ctx.getStrategyName()).toBe('complexity-based');
  });

  it('setStrategy changes algorithm', () => {
    const ctx = new TaskPriorityContext(new DeadlineBasedPriorityStrategy());
    ctx.setStrategy(new HybridPriorityStrategy());
    expect(ctx.getStrategyName()).toBe('hybrid');
  });
});

describe('PenaltyContext', () => {
  it('getPenalty delegates to strategy', () => {
    const ctx = new PenaltyContext(new LinearPenaltyStrategy());
    const task = makeTask({ dueDate: pastDate(3) });
    expect(ctx.getPenalty(task)).toBeGreaterThan(0);
  });

  it('getTotalPenalty sums all tasks', () => {
    const ctx = new PenaltyContext(new TieredPenaltyStrategy());
    const tasks = [
      makeTask({ dueDate: pastDate(2) }),
      makeTask({ dueDate: pastDate(5) }),
    ];
    expect(ctx.getTotalPenalty(tasks)).toBe(20); // 5 + 15
  });

  it('setStrategy switches algorithm', () => {
    const ctx = new PenaltyContext(new LinearPenaltyStrategy());
    ctx.setStrategy(new ExponentialPenaltyStrategy());
    expect(ctx.getStrategyName()).toBe('exponential');
  });

  it('describe returns string from strategy', () => {
    const ctx = new PenaltyContext(new TieredPenaltyStrategy());
    expect(typeof ctx.describe()).toBe('string');
  });
});
