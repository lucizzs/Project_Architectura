import {
  EventBus,
  NotificationObserver,
  AuditLogObserver,
  IObserver,
  EventPayload,
} from '../../../src/patterns/observer';

beforeEach(() => {
  EventBus.reset();
});

describe('EventBus (Singleton)', () => {
  it('завжди повертає один і той самий екземпляр', () => {
    const a = EventBus.getInstance();
    const b = EventBus.getInstance();
    expect(a).toBe(b);
  });

  it('reset() створює новий екземпляр', () => {
    const a = EventBus.getInstance();
    EventBus.reset();
    const b = EventBus.getInstance();
    expect(a).not.toBe(b);
  });

  it('notify — надсилає подію підписнику', () => {
    const bus = EventBus.getInstance();
    const received: EventPayload[] = [];
    bus.subscribe('task.created', { handle: (e) => received.push(e) });
    bus.notify('task.created', { taskId: 't1' });
    expect(received).toHaveLength(1);
    expect(received[0].meta.taskId).toBe('t1');
  });

  it('notify — не надсилає не-підписникам', () => {
    const bus = EventBus.getInstance();
    const received: EventPayload[] = [];
    bus.subscribe('task.created', { handle: (e) => received.push(e) });
    bus.notify('project.created', {});
    expect(received).toHaveLength(0);
  });

  it('кілька підписників на один тип', () => {
    const bus = EventBus.getInstance();
    const a: EventPayload[] = [];
    const b: EventPayload[] = [];
    bus.subscribe('task.updated', { handle: (e) => a.push(e) });
    bus.subscribe('task.updated', { handle: (e) => b.push(e) });
    bus.notify('task.updated', {});
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('unsubscribe — перестає отримувати події', () => {
    const bus = EventBus.getInstance();
    const received: EventPayload[] = [];
    const obs: IObserver = { handle: (e) => received.push(e) };
    bus.subscribe('task.deleted', obs);
    bus.notify('task.deleted', {});
    bus.unsubscribe('task.deleted', obs);
    bus.notify('task.deleted', {});
    expect(received).toHaveLength(1);
  });

  it('getLog — зберігає всі події', () => {
    const bus = EventBus.getInstance();
    bus.notify('task.created', { taskId: 'a' });
    bus.notify('task.updated', { taskId: 'b' });
    expect(bus.getLog()).toHaveLength(2);
  });

  it('clearLog — очищає журнал', () => {
    const bus = EventBus.getInstance();
    bus.notify('task.created', {});
    bus.clearLog();
    expect(bus.getLog()).toHaveLength(0);
  });

  it('getLog повертає копію — мутація не впливає', () => {
    const bus = EventBus.getInstance();
    bus.notify('task.created', {});
    const log = bus.getLog();
    log.push({ type: 'task.deleted', meta: {}, timestamp: new Date() });
    expect(bus.getLog()).toHaveLength(1);
  });

  it('payload містить тип, meta та timestamp', () => {
    const bus = EventBus.getInstance();
    const before = Date.now();
    bus.notify('project.created', { projectId: 'p1' });
    const [event] = bus.getLog();
    expect(event.type).toBe('project.created');
    expect(event.meta.projectId).toBe('p1');
    expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('порожній notify не кидає', () => {
    const bus = EventBus.getInstance();
    expect(() => bus.notify('member.added')).not.toThrow();
  });
});

describe('NotificationObserver', () => {
  it('зберігає отримані події', () => {
    const obs = new NotificationObserver();
    obs.handle({ type: 'task.created', meta: { id: '1' }, timestamp: new Date() });
    expect(obs.getAll()).toHaveLength(1);
  });

  it('getAll повертає копію', () => {
    const obs = new NotificationObserver();
    obs.handle({ type: 'task.updated', meta: {}, timestamp: new Date() });
    const all = obs.getAll();
    all.pop();
    expect(obs.getAll()).toHaveLength(1);
  });

  it('clear() видаляє всі сповіщення', () => {
    const obs = new NotificationObserver();
    obs.handle({ type: 'task.created', meta: {}, timestamp: new Date() });
    obs.clear();
    expect(obs.getAll()).toHaveLength(0);
  });

  it('інтеграція з EventBus', () => {
    const bus = EventBus.getInstance();
    const obs = new NotificationObserver();
    bus.subscribe('comment.added', obs);
    bus.notify('comment.added', { commentId: 'c1' });
    expect(obs.getAll()[0].meta.commentId).toBe('c1');
  });
});

describe('AuditLogObserver', () => {
  it('записує тип і meta', () => {
    const obs = new AuditLogObserver();
    obs.handle({ type: 'project.deleted', meta: { projectId: 'p1' }, timestamp: new Date() });
    const entries = obs.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('project.deleted');
    expect(entries[0].meta).toMatchObject({ projectId: 'p1' });
  });

  it('накопичує кілька записів', () => {
    const obs = new AuditLogObserver();
    obs.handle({ type: 'task.created', meta: {}, timestamp: new Date() });
    obs.handle({ type: 'task.deleted', meta: {}, timestamp: new Date() });
    expect(obs.getEntries()).toHaveLength(2);
  });

  it('запис містить дату', () => {
    const obs = new AuditLogObserver();
    const before = new Date();
    obs.handle({ type: 'member.added', meta: {}, timestamp: before });
    expect(obs.getEntries()[0].at).toEqual(before);
  });

  it('getEntries повертає копію', () => {
    const obs = new AuditLogObserver();
    obs.handle({ type: 'task.created', meta: {}, timestamp: new Date() });
    const entries = obs.getEntries();
    entries.pop();
    expect(obs.getEntries()).toHaveLength(1);
  });
});
