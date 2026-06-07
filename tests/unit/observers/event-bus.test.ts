import { EventBus, NotificationObserver, AuditLogObserver, OverdueCheckerObserver, EventPayload, TaskEvent } from '../../../src/observers/event-bus';
import { Task } from '../../../src/domain/models';
import { pastDate } from '../../helpers';

function makeDummyTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1', title: 'Test', description: null,
    status: 'TODO', priority: 'MEDIUM', dueDate: null,
    projectId: 'p1', assigneeId: null, createdById: 'u1',
    estimatedHours: null, actualHours: null, tags: [],
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

describe('EventBus (Singleton)', () => {
  beforeEach(() => EventBus.reset());

  it('getInstance always returns same instance', () => {
    expect(EventBus.getInstance()).toBe(EventBus.getInstance());
  });

  it('reset creates a new instance', () => {
    const a = EventBus.getInstance();
    EventBus.reset();
    const b = EventBus.getInstance();
    expect(a).not.toBe(b);
  });

  it('subscribe + notify calls observer', () => {
    const bus = EventBus.getInstance();
    const received: EventPayload[] = [];
    bus.subscribe('task.created', { name: 'test', update: (p) => { received.push(p); } });
    bus.notify({ event: 'task.created', timestamp: new Date() });
    expect(received.length).toBe(1);
  });

  it('unsubscribe prevents further calls', () => {
    const bus = EventBus.getInstance();
    let count = 0;
    bus.subscribe('task.deleted', { name: 'counter', update: () => { count++; } });
    bus.notify({ event: 'task.deleted', timestamp: new Date() });
    bus.unsubscribe('task.deleted', 'counter');
    bus.notify({ event: 'task.deleted', timestamp: new Date() });
    expect(count).toBe(1);
  });

  it('duplicate subscribe does not double-fire', () => {
    const bus = EventBus.getInstance();
    let count = 0;
    const obs = { name: 'dup', update: () => { count++; } };
    bus.subscribe('task.updated', obs);
    bus.subscribe('task.updated', obs); // duplicate
    bus.notify({ event: 'task.updated', timestamp: new Date() });
    expect(count).toBe(1);
  });

  it('observers are isolated per event type', () => {
    const bus = EventBus.getInstance();
    let count = 0;
    bus.subscribe('task.created', { name: 'obs', update: () => { count++; } });
    bus.notify({ event: 'task.deleted', timestamp: new Date() });
    expect(count).toBe(0);
  });

  it('getLog stores all events', () => {
    const bus = EventBus.getInstance();
    bus.notify({ event: 'task.created', timestamp: new Date() });
    bus.notify({ event: 'task.deleted', timestamp: new Date() });
    expect(bus.getLog().length).toBe(2);
  });

  it('clearLog empties the log', () => {
    const bus = EventBus.getInstance();
    bus.notify({ event: 'task.created', timestamp: new Date() });
    bus.clearLog();
    expect(bus.getLog().length).toBe(0);
  });

  it('observer errors do not stop notification chain', () => {
    const bus = EventBus.getInstance();
    let secondCalled = false;
    bus.subscribe('task.escalated', { name: 'bad', update: () => { throw new Error('boom'); } });
    bus.subscribe('task.escalated', { name: 'good', update: () => { secondCalled = true; } });
    bus.notify({ event: 'task.escalated', timestamp: new Date() });
    expect(secondCalled).toBe(true);
  });
});

describe('NotificationObserver', () => {
  beforeEach(() => EventBus.reset());

  it('generates notification for task.created', () => {
    const obs = new NotificationObserver();
    obs.update({ event: 'task.created', task: makeDummyTask({ title: 'My Task' }), timestamp: new Date() });
    expect(obs.getNotifications()[0].message).toContain('My Task');
  });

  it('generates notification for task.status_changed', () => {
    const obs = new NotificationObserver();
    obs.update({
      event: 'task.status_changed',
      task: makeDummyTask({ title: 'Task A' }),
      meta: { newStatus: 'DONE' },
      timestamp: new Date(),
    });
    expect(obs.getNotifications()[0].message).toContain('DONE');
  });

  it('generates notification for task.assigned', () => {
    const obs = new NotificationObserver();
    obs.update({ event: 'task.assigned', task: makeDummyTask({ title: 'Assigned Task' }), timestamp: new Date() });
    expect(obs.getNotifications().length).toBe(1);
  });

  it('generates notification for task.overdue', () => {
    const obs = new NotificationObserver();
    obs.update({ event: 'task.overdue', task: makeDummyTask({ title: 'Late Task' }), timestamp: new Date() });
    expect(obs.getNotifications()[0].message).toContain('⚠️');
  });

  it('ignores unknown events', () => {
    const obs = new NotificationObserver();
    obs.update({ event: 'project.created', timestamp: new Date() });
    expect(obs.getNotifications().length).toBe(0);
  });

  it('clear empties notifications', () => {
    const obs = new NotificationObserver();
    obs.update({ event: 'task.created', task: makeDummyTask(), timestamp: new Date() });
    obs.clear();
    expect(obs.getNotifications().length).toBe(0);
  });
});

describe('AuditLogObserver', () => {
  it('logs all events', () => {
    const obs = new AuditLogObserver();
    obs.update({ event: 'task.created', task: makeDummyTask(), meta: { userId: 'u1' }, timestamp: new Date() });
    obs.update({ event: 'task.deleted', task: makeDummyTask(), timestamp: new Date() });
    expect(obs.getLogs().length).toBe(2);
  });

  it('getLogsByEvent filters correctly', () => {
    const obs = new AuditLogObserver();
    obs.update({ event: 'task.created', task: makeDummyTask(), timestamp: new Date() });
    obs.update({ event: 'task.deleted', task: makeDummyTask(), timestamp: new Date() });
    expect(obs.getLogsByEvent('task.created').length).toBe(1);
  });

  it('clear empties logs', () => {
    const obs = new AuditLogObserver();
    obs.update({ event: 'task.created', task: makeDummyTask(), timestamp: new Date() });
    obs.clear();
    expect(obs.getLogs().length).toBe(0);
  });

  it('records entityId from task', () => {
    const obs = new AuditLogObserver();
    const task = makeDummyTask({ id: 'task-123' });
    obs.update({ event: 'task.updated', task, timestamp: new Date() });
    expect(obs.getLogs()[0].entityId).toBe('task-123');
  });
});

describe('OverdueCheckerObserver', () => {
  beforeEach(() => EventBus.reset());

  it('emits task.overdue event for overdue task', () => {
    const checker = new OverdueCheckerObserver();
    const bus = EventBus.getInstance();
    bus.subscribe('task.created', checker);

    const overdueEvents: EventPayload[] = [];
    bus.subscribe('task.overdue', { name: 'collector', update: (p) => { overdueEvents.push(p); } });

    bus.notify({
      event: 'task.created',
      task: makeDummyTask({ dueDate: pastDate(), status: 'TODO' }),
      timestamp: new Date(),
    });

    expect(overdueEvents.length).toBe(1);
  });

  it('does not emit overdue for DONE task', () => {
    const checker = new OverdueCheckerObserver();
    const bus = EventBus.getInstance();
    bus.subscribe('task.created', checker);

    const overdueEvents: EventPayload[] = [];
    bus.subscribe('task.overdue', { name: 'col', update: (p) => { overdueEvents.push(p); } });

    bus.notify({
      event: 'task.created',
      task: makeDummyTask({ dueDate: pastDate(), status: 'DONE' }),
      timestamp: new Date(),
    });

    expect(overdueEvents.length).toBe(0);
  });

  it('does not re-escalate same task twice', () => {
    const checker = new OverdueCheckerObserver();
    const bus = EventBus.getInstance();
    bus.subscribe('task.updated', checker);

    let count = 0;
    bus.subscribe('task.overdue', { name: 'counter', update: () => { count++; } });

    const task = makeDummyTask({ id: 'same', dueDate: pastDate(), status: 'TODO' });
    bus.notify({ event: 'task.updated', task, timestamp: new Date() });
    bus.notify({ event: 'task.updated', task, timestamp: new Date() });

    expect(count).toBe(1);
  });

  it('reset clears escalated ids', () => {
    const checker = new OverdueCheckerObserver();
    const task = makeDummyTask({ dueDate: pastDate(), status: 'TODO' });
    const bus = EventBus.getInstance();
    bus.subscribe('task.created', checker);
    let count = 0;
    bus.subscribe('task.overdue', { name: 'cnt', update: () => { count++; } });
    bus.notify({ event: 'task.created', task, timestamp: new Date() });
    checker.reset();
    EventBus.reset();
    const bus2 = EventBus.getInstance();
    bus2.subscribe('task.created', checker);
    bus2.subscribe('task.overdue', { name: 'cnt2', update: () => { count++; } });
    bus2.notify({ event: 'task.created', task, timestamp: new Date() });
    expect(count).toBe(2);
  });
});
