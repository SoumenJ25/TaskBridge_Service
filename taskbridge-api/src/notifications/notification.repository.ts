/**
 * Notification & Audit Service — repository layer.
 *
 * The ONLY layer that touches the database for audit entries and notifications. Prisma is injected
 * to keep this testable without a live database.
 *
 * IMMUTABILITY: this repository deliberately exposes NO update or delete methods for audit entries.
 * The absence of those code paths — combined with the service-layer guard — is how audit
 * immutability is enforced.
 */

import type {
  AuditEntry,
  AuditEventType,
  AuditHistoryFilter,
  Notification,
} from './notification.model';

export interface AuditDelegate {
  create(args: {
    data: {
      eventType: AuditEventType;
      entityType: string;
      entityId: string;
      actorUserId: string;
      actorOrgId: string;
      actorIp: string | null;
      previousState: unknown | null;
      newState: unknown | null;
    };
  }): Promise<AuditEntry>;
  findMany(args: {
    where: {
      entityId: string;
      actorOrgId: string;
      eventType?: AuditEventType;
      createdAt?: { gte?: Date; lte?: Date };
    };
    orderBy: { createdAt: 'asc' | 'desc' };
  }): Promise<AuditEntry[]>;
}

export interface NotificationDelegate {
  create(args: {
    data: { recipientUserId: string; eventType: string; projectId: string; message: string };
  }): Promise<Notification>;
  findMany(args: {
    where: { recipientUserId: string; read: boolean };
    orderBy: { createdAt: 'desc' };
  }): Promise<Notification[]>;
  findFirst(args: { where: { id: string } }): Promise<Notification | null>;
  update(args: { where: { id: string }; data: { read: boolean } }): Promise<Notification>;
}

export interface PrismaLike {
  auditEntry: AuditDelegate;
  notification: NotificationDelegate;
}

export class NotificationRepository {
  constructor(private readonly prisma: PrismaLike) {}

  /** Append a new audit entry. There is no corresponding update/delete by design. */
  async createAudit(data: {
    eventType: AuditEventType;
    entityType: string;
    entityId: string;
    actorUserId: string;
    actorOrgId: string;
    actorIp: string | null;
    previousState: unknown | null;
    newState: unknown | null;
  }): Promise<AuditEntry> {
    return this.prisma.auditEntry.create({ data });
  }

  /** Query audit history for an entity, scoped by organisation, with optional filters. */
  async findAuditHistory(
    actorOrgId: string,
    entityId: string,
    filter: AuditHistoryFilter,
  ): Promise<AuditEntry[]> {
    const createdAt =
      filter.from || filter.to
        ? { gte: filter.from, lte: filter.to }
        : undefined;

    return this.prisma.auditEntry.findMany({
      where: {
        entityId,
        actorOrgId,
        ...(filter.eventType ? { eventType: filter.eventType } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Create a single notification. */
  async createNotification(data: {
    recipientUserId: string;
    eventType: string;
    projectId: string;
    message: string;
  }): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  /** List unread notifications for a user. */
  async findUnreadForUser(recipientUserId: string): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { recipientUserId, read: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Find a notification by id. */
  async findNotificationById(id: string): Promise<Notification | null> {
    return this.prisma.notification.findFirst({ where: { id } });
  }

  /** Mark a notification read. */
  async markNotificationRead(id: string): Promise<Notification> {
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }
}
