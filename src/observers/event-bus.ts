import { Task, Project, User } from '../domain/models';

// ─────────────────────────────────────────────────────────────────────────────
// Observer Pattern — система сповіщень
// GoF: Observer визначає залежність "один-до-багатьох" між об'єктами
// ─────────────────────────────────────────────────────────────────────────────

export type TaskEvent =
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.status_changed'
  | 'task.overdue'
  | 'task.assigned'
  | 'task.escalated'
  | 'project.created'
  | 'project.deleted'
  | 'member.added'
  | 'member.removed';

export interface EventPayload {
  event: TaskEvent;
  task?: Task;
  project?: Project;
  actor?: User;
  meta?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * IObserver — інтерфейс спостерігача.
 */
export interface IObserver {
  readonly name: string;
  update(payload: EventPayload): void | Promise<void>;
}

/**
 * IObservable — інтерфейс суб'єкта (видавця подій).
 */
export interface IObservable {
  subscribe(event: TaskEvent, observer: IObserver): void;
  unsubscribe(event: TaskEvent, observerName: string): void;
  notify(payload: EventPayload): void;
}

/**
 * EventBus — центральний брокер подій (Singleton).
 */
export class EventBus implements IObservable {
  private static instance: EventBus;
  private readonly listeners: Map<TaskEvent, IObserver[]> = new Map();
  private readonly eventLog: EventPayload[] = [];

  private constructor() {}

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /** Скидає стан (потрібно для тестів) */
  static reset(): void {
    EventBus.instance = new EventBus();
  }

  subscribe(event: TaskEvent, observer: IObserver): void {
    const existing = this.listeners.get(event) ?? [];
    if (!existing.find((o) => o.name === observer.name)) {
      this.listeners.set(event, [...existing, observer]);
    }
  }

  unsubscribe(event: TaskEvent, observerName: string): void {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, existing.filter((o) => o.name !== observerName));
  }

  notify(payload: EventPayload): void {
    this.eventLog.push(payload);
    const observers = this.listeners.get(payload.event) ?? [];
    for (const observer of observers) {
      try {
        void observer.update(payload);
      } catch {
        // Observer помилки не повинні зупиняти основний потік
      }
    }
  }

  getLog(): EventPayload[] {
    return [...this.eventLog];
  }

  clearLog(): void {
    this.eventLog.length = 0;
  }
}

// ─── Конкретні Observer-и ─────────────────────────────────────────────────────

/**
 * NotificationObserver — формує in-app сповіщення.
 */
export class NotificationObserver implements IObserver {
  readonly name = 'notification-observer';
  private readonly notifications: Array<{ message: string; timestamp: Date; userId: string }> = [];

  update(payload: EventPayload): void {
    const { event, task, actor } = payload;
    let message = '';

    switch (event) {
      case 'task.created':
        message = `Задачу "${task?.title}" створено`;
        break;
      case 'task.status_changed':
        message = `Статус задачі "${task?.title}" змінено на "${payload.meta?.newStatus}"`;
        break;
      case 'task.assigned':
        message = `Вас призначено виконавцем задачі "${task?.title}"`;
        break;
      case 'task.overdue':
        message = `⚠️ Задача "${task?.title}" прострочена!`;
        break;
      case 'task.escalated':
        message = `🔴 Задача "${task?.title}" ескальована до CRITICAL`;
        break;
      default:
        return;
    }

    this.notifications.push({
      message,
      timestamp: payload.timestamp,
      userId: actor?.id ?? task?.assigneeId ?? 'system',
    });
  }

  getNotifications(): typeof this.notifications {
    return [...this.notifications];
  }

  clear(): void {
    this.notifications.length = 0;
  }
}

/**
 * AuditLogObserver — веде журнал аудиту всіх змін.
 */
export class AuditLogObserver implements IObserver {
  readonly name = 'audit-log-observer';
  private readonly logs: Array<{
    event: TaskEvent;
    entityId?: string;
    actorId?: string;
    timestamp: Date;
    details: Record<string, unknown>;
  }> = [];

  update(payload: EventPayload): void {
    this.logs.push({
      event: payload.event,
      entityId: payload.task?.id ?? payload.project?.id,
      actorId: payload.actor?.id,
      timestamp: payload.timestamp,
      details: payload.meta ?? {},
    });
  }

  getLogs(): typeof this.logs {
    return [...this.logs];
  }

  getLogsByEvent(event: TaskEvent): typeof this.logs {
    return this.logs.filter((l) => l.event === event);
  }

  clear(): void {
    this.logs.length = 0;
  }
}

/**
 * OverdueCheckerObserver — аналізує нові задачі та сповіщає про дедлайни.
 */
export class OverdueCheckerObserver implements IObserver {
  readonly name = 'overdue-checker-observer';
  private escalatedTaskIds = new Set<string>();

  update(payload: EventPayload): void {
    if (!payload.task) return;
    if (payload.event === 'task.created' || payload.event === 'task.updated') {
      const task = payload.task;
      if (
        task.dueDate &&
        new Date(task.dueDate) < new Date() &&
        task.status !== 'DONE' &&
        task.status !== 'CANCELLED' &&
        !this.escalatedTaskIds.has(task.id)
      ) {
        this.escalatedTaskIds.add(task.id);
        // Publish a new overdue event (non-recursive — different event type)
        EventBus.getInstance().notify({
          event: 'task.overdue',
          task,
          meta: { detectedBy: 'overdue-checker' },
          timestamp: new Date(),
        });
      }
    }
  }

  getEscalatedIds(): Set<string> {
    return new Set(this.escalatedTaskIds);
  }

  reset(): void {
    this.escalatedTaskIds.clear();
  }
}
