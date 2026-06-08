import {
  PriorityFieldStrategy,
  DeadlineStrategy,
  HybridPriorityStrategy,
  TaskPriorityContext,
  LinearPenaltyStrategy,
  ExponentialPenaltyStrategy,
  TieredPenaltyStrategy,
  PenaltyContext,
  Task,
} from '../../../src/patterns/strategy';

const past = (days: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};
const future = (days: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Demo',
  priority: 'MEDIUM',
  dueDate: null,
  status: 'TODO',
  ...overrides,
});

// ── PriorityFieldStrategy ──────────────────────────────────────────────────
describe('PriorityFieldStrategy', () => {
  const s = new PriorityFieldStrategy();

  it('URGENT має найвищий бал', () => expect(s.score(task({ priority: 'URGENT' }))).toBe(40));
  it('HIGH', () => expect(s.score(task({ priority: 'HIGH' }))).toBe(30));
  it('MEDIUM', () => expect(s.score(task({ priority: 'MEDIUM' }))).toBe(20));
  it('LOW має найнижчий бал', () => expect(s.score(task({ priority: 'LOW' }))).toBe(10));
  it('невідомий пріоритет → 10', () => expect(s.score(task({ priority: 'UNKNOWN' }))).toBe(10));
});

// ── DeadlineStrategy ───────────────────────────────────────────────────────
describe('DeadlineStrategy', () => {
  const s = new DeadlineStrategy();

  it('без дедлайну → 0', () => expect(s.score(task())).toBe(0));
  it('DONE без штрафу → 0', () =>
    expect(s.score(task({ dueDate: past(5), status: 'DONE' }))).toBe(0));
  it('прострочено → 100', () => expect(s.score(task({ dueDate: past(2) }))).toBe(100));
  it('<1 дня → 80', () => expect(s.score(task({ dueDate: future(0) }))).toBe(80));
  it('<3 дні → 60', () => expect(s.score(task({ dueDate: future(2) }))).toBe(60));
  it('<7 днів → 40', () => expect(s.score(task({ dueDate: future(5) }))).toBe(40));
  it('>=7 днів → 10', () => expect(s.score(task({ dueDate: future(10) }))).toBe(10));
});

// ── HybridPriorityStrategy ─────────────────────────────────────────────────
describe('HybridPriorityStrategy', () => {
  const s = new HybridPriorityStrategy();

  it('комбінує field і deadline', () => {
    const score = s.score(task({ priority: 'HIGH', dueDate: future(2) }));
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('прострочений URGENT має найвищий бал', () => {
    const urgent = s.score(task({ priority: 'URGENT', dueDate: past(3) }));
    const low = s.score(task({ priority: 'LOW', dueDate: future(30) }));
    expect(urgent).toBeGreaterThan(low);
  });

  it('без дедлайну — лише поле пріоритету', () => {
    const score = s.score(task({ priority: 'HIGH' }));
    expect(score).toBeCloseTo(30 * 0.6, 1);
  });
});

// ── TaskPriorityContext ────────────────────────────────────────────────────
describe('TaskPriorityContext', () => {
  it('ранжує задачі за замовчуванням (Hybrid)', () => {
    const ctx = new TaskPriorityContext();
    const tasks = [
      task({ id: 'low', priority: 'LOW' }),
      task({ id: 'urgent', priority: 'URGENT' }),
      task({ id: 'medium', priority: 'MEDIUM' }),
    ];
    const ranked = ctx.rank(tasks);
    expect(ranked[0].id).toBe('urgent');
    expect(ranked[ranked.length - 1].id).toBe('low');
  });

  it('дозволяє замінити стратегію', () => {
    const ctx = new TaskPriorityContext();
    ctx.setStrategy(new PriorityFieldStrategy());
    const tasks = [task({ id: 'a', priority: 'LOW' }), task({ id: 'b', priority: 'HIGH' })];
    expect(ctx.rank(tasks)[0].id).toBe('b');
  });

  it('не мутує вхідний масив', () => {
    const ctx = new TaskPriorityContext();
    const tasks = [task({ id: 'a', priority: 'LOW' }), task({ id: 'b', priority: 'HIGH' })];
    const copy = [...tasks];
    ctx.rank(tasks);
    expect(tasks).toEqual(copy);
  });

  it('порожній масив → порожній результат', () => {
    expect(new TaskPriorityContext().rank([])).toEqual([]);
  });
});

// ── LinearPenaltyStrategy ──────────────────────────────────────────────────
describe('LinearPenaltyStrategy', () => {
  const s = new LinearPenaltyStrategy();

  it('0 днів → 0', () => expect(s.penalty(0)).toBe(0));
  it('негативні дні → 0', () => expect(s.penalty(-5)).toBe(0));
  it('5 днів → 5', () => expect(s.penalty(5)).toBe(5));
  it('30 днів → 30', () => expect(s.penalty(30)).toBe(30));
  it('лінійна залежність', () => {
    expect(s.penalty(10)).toBe(10);
    expect(s.penalty(20)).toBe(20);
  });
});

// ── ExponentialPenaltyStrategy ─────────────────────────────────────────────
describe('ExponentialPenaltyStrategy', () => {
  const s = new ExponentialPenaltyStrategy();

  it('0 → 0', () => expect(s.penalty(0)).toBe(0));
  it('негативні → 0', () => expect(s.penalty(-1)).toBe(0));
  it('1 день → 2', () => expect(s.penalty(1)).toBe(2));
  it('2 дні → 4', () => expect(s.penalty(2)).toBe(4));
  it('3 дні → 8', () => expect(s.penalty(3)).toBe(8));
  it('max cap = 1024', () => expect(s.penalty(20)).toBe(1024));
  it('ростає швидше за лінійний', () => {
    const lin = new LinearPenaltyStrategy();
    expect(s.penalty(5)).toBeGreaterThan(lin.penalty(5));
  });
});

// ── TieredPenaltyStrategy ──────────────────────────────────────────────────
describe('TieredPenaltyStrategy', () => {
  const s = new TieredPenaltyStrategy();

  it('0 → 0', () => expect(s.penalty(0)).toBe(0));
  it('негативні → 0', () => expect(s.penalty(-3)).toBe(0));
  it('1-3 дні → 5', () => {
    expect(s.penalty(1)).toBe(5);
    expect(s.penalty(3)).toBe(5);
  });
  it('4-7 днів → 15', () => {
    expect(s.penalty(4)).toBe(15);
    expect(s.penalty(7)).toBe(15);
  });
  it('8-14 днів → 30', () => {
    expect(s.penalty(8)).toBe(30);
    expect(s.penalty(14)).toBe(30);
  });
  it('>14 днів → 50', () => {
    expect(s.penalty(15)).toBe(50);
    expect(s.penalty(100)).toBe(50);
  });
});

// ── PenaltyContext ─────────────────────────────────────────────────────────
describe('PenaltyContext', () => {
  it('без дедлайну → 0', () => {
    const ctx = new PenaltyContext();
    expect(ctx.calculate(task())).toBe(0);
  });

  it('DONE → 0 навіть якщо прострочено', () => {
    const ctx = new PenaltyContext();
    expect(ctx.calculate(task({ dueDate: past(10), status: 'DONE' }))).toBe(0);
  });

  it('прострочено → штраф > 0', () => {
    const ctx = new PenaltyContext(new LinearPenaltyStrategy());
    expect(ctx.calculate(task({ dueDate: past(5) }))).toBeGreaterThan(0);
  });

  it('майбутній дедлайн → 0', () => {
    const ctx = new PenaltyContext();
    expect(ctx.calculate(task({ dueDate: future(10) }))).toBe(0);
  });

  it('дозволяє замінити стратегію', () => {
    const ctx = new PenaltyContext(new LinearPenaltyStrategy());
    const linear = ctx.calculate(task({ dueDate: past(3) }));
    ctx.setStrategy(new TieredPenaltyStrategy());
    const tiered = ctx.calculate(task({ dueDate: past(3) }));
    expect(tiered).toBe(5);
    expect(linear).toBeGreaterThan(0);
  });
});
