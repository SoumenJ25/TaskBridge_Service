/**
 * In-memory test doubles for the Notification & Audit repositories and the team-member resolver.
 * These let the service layer be tested without Prisma or a live database.
 *
 * The audit store is intentionally append-only to mirror the production immutability guarantee.
 */

import { randomUUID } from 'crypto';
import type {
  PrismaLike,
  AuditDelegate,
  NotificationDelegate,
} from '../src/notifications/notification.repository';
import type {
  AuditEntry,
  AuditEventType,
  Notification,
} from '../src/notifications/notification.model';
import type { TeamMemberResolver } from '../src/notifications/notification.service';

class InMemoryAuditDelegate implements AuditDelegate {
  readonly rows: AuditEntry[] = [];

  async create(args: {
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
  }): Promise<AuditEntry> {
    const entry: AuditEntry = {
      id: randomUUID(),
      createdAt: new Date(),
      ...args.data,
    };
    this.rows.push(entry);
    return entry;
  }

  async findMany(args: {
    where: {
      entityId: string;
      actorOrgId: string;
      eventType?: AuditEventType;
      createdAt?: { gte?: Date; lte?: Date };
    };
    orderBy: { createdAt: 'asc' | 'desc' };
  }): Promise<AuditEntry[]> {
    const { where } = args;
    let results = this.rows.filter(
      (r) => r.entityId === where.entityId && r.actorOrgId === where.actorOrgId,
    );
    if (where.eventType) {
      results = results.filter((r) => r.eventType === where.eventType);
    }
    if (where.createdAt?.gte) {
      results = results.filter((r) => r.createdAt >= where.createdAt!.gte!);
    }
    if (where.createdAt?.lte) {
      results = results.filter((r) => r.createdAt <= where.createdAt!.lte!);
    }
    return results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}

class InMemoryNotificationDelegate implements NotificationDelegate {
  readonly rows: Notification[] = [];

  async create(args: {
    data: { recipientUserId: string; eventType: string; projectId: string; message: string };
  }): Promise<Notification> {
    const row: Notification = {
      id: randomUUID(),
      read: false,
      createdAt: new Date(),
      ...args.data,
    };
    this.rows.push(row);
    return row;
  }

  async findMany(args: {
    where: { recipientUserId: string; read: boolean };
    orderBy: { createdAt: 'desc' };
  }): Promise<Notification[]> {
    return this.rows.filter(
      (r) => r.recipientUserId === args.where.recipientUserId && r.read === args.where.read,
    );
  }

  async findFirst(args: { where: { id: string } }): Promise<Notification | null> {
    return this.rows.find((r) => r.id === args.where.id) ?? null;
  }

  async update(args: { where: { id: string }; data: { read: boolean } }): Promise<Notification> {
    const row = this.rows.find((r) => r.id === args.where.id);
    if (!row) {
      throw new Error('not found');
    }
    row.read = args.data.read;
    return row;
  }
}

export class InMemoryPrisma implements PrismaLike {
  auditEntry = new InMemoryAuditDelegate();
  notification = new InMemoryNotificationDelegate();
}

/** Resolver double that always returns a fixed list of team member ids. */
export class StaticTeamResolver implements TeamMemberResolver {
  constructor(private readonly memberIds: string[]) {}

  async getTeamMemberIds(): Promise<string[]> {
    return this.memberIds;
  }
}
