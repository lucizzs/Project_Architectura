/**
 * GoF Observer + Singleton — подієва шина.
 * EventBus є Singleton; сповіщає підписників про події системи.
 */

export type EventType =
  | 'task.created' | 'task.updated' | 'task.deleted' | 'task.status_changed'
  | 'project.created' | 'project.deleted'
  | 'member.added' | 'member.removed'
  | 'comment.added';

export interface EventPayload {
  type: EventType;
  meta: Record<string, unknown>;
  timestamp: Date;
}

export interface IObserver {
  handle(event: EventPayload): void;
}

export class EventBus {
  private static _instance: EventBus | null = null;
  private readonly subscribers = new Map<string, IObserver[]>();
  private readonly _log: EventPayload[] = [];

  private constructor() {}

  static getInstance(): EventBus {
    if (!EventBus._instance) EventBus._instance = new EventBus();
    return EventBus._instance;
  }

  /** Скидає Singleton — для використання в тестах */
  static reset(): void { EventBus._instance = null; }

  subscribe(type: EventType, observer: IObserver): void {
    const list = this.subscribers.get(type) ?? [];
    list.push(observer);
    this.subscribers.set(type, list);
  }

  unsubscribe(type: EventType, observer: IObserver): void {
    const list = this.subscribers.get(type) ?? [];
    this.subscribers.set(type, list.filter((o) => o !== observer));
  }

  notify(type: EventType, meta: Record<string, unknown> = {}): void {
    const payload: EventPayload = { type, meta, timestamp: new Date() };
    this._log.push(payload);
    for (const obs of this.subscribers.get(type) ?? []) {
      obs.handle(payload);
    }
  }

  getLog(): EventPayload[] { return [...this._log]; }
  clearLog(): void { this._log.length = 0; }
}

// ── Concrete Observers ──────────────────────────────────────────────────────

export class NotificationObserver implements IObserver {
  private readonly notifications: EventPayload[] = [];

  handle(event: EventPayload): void {
    this.notifications.push(event);
  }

  getAll(): EventPayload[] { return [...this.notifications]; }
  clear(): void { this.notifications.length = 0; }
}

export class AuditLogObserver implements IObserver {
  private readonly entries: Array<{ type: string; meta: unknown; at: Date }> = [];

  handle(event: EventPayload): void {
    this.entries.push({ type: event.type, meta: event.meta, at: event.timestamp });
  }

  getEntries() { return [...this.entries]; }
}
