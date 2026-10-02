/**
 * Notification & Audit Service — required test suite (≥6 cases).
 *
 * These exercise the mandated scenarios from the assessment:
 *   1. Equal notification dispatch to all team members on a project state change
 *   2. Audit entry created correctly when a milestone is updated
 *   3. Audit entry cannot be deleted/overwritten (immutability enforced)
 *   4. Audit history filtered by date range returns correct results
 *   5. Audit history filtered by event type returns only matching entries
 *   6. Unauthorised user cannot access another organisation's audit log (multi-tenant)
 */

import { randomUUID } from 'crypto';
import { NotificationService } from '../src/notifications/notification.service';
import { NotificationRepository } from '../src/notifications/notification.repository';
import { ForbiddenError } from '../src/shared/errors';
import type { Principal } from '../src/shared/principal';
import type { AuditEventType } from '../src/notifications/notification.model';
import { InMemoryPrisma, StaticTeamResolver } from './in-memory';

const ORG_A = randomUUID();
const ORG_B = randomUUID();
const PROJECT_ID = randomUUID();

function makeService(memberIds: string[]) {
  const prisma = new InMemoryPrisma();
  const repository = new NotificationRepository(prisma);
  const resolver = new StaticTeamResolver(memberIds);
  const service = new NotificationService(repository, resolver);
  return { prisma, service };
}

function actor(orgId: string): Principal {
  return { userId: randomUUID(), organisationId: orgId };
}

function recordInput(eventType: AuditEventType, orgId: string) {
  return {
    eventType,
    entityType: 'Project',
    entityId: PROJECT_ID,
    actor: actor(orgId),
    previousState: { status: 'ACTIVE' },
    newState: { status: 'DONE' },
  };
}

describe('Notification & Audit Service', () => {
  it('1. dispatches a notification to every team member on a state change', async () => {
    const members = [randomUUID(), randomUUID(), randomUUID()];
    const { prisma, service } = makeService(members);

    await service.recordMilestoneChange(recordInput('MILESTONE_STATUS_UPDATED', ORG_A));

    expect(prisma.notification.rows).toHaveLength(members.length);
    const recipients = prisma.notification.rows.map((n) => n.recipientUserId).sort();
    expect(recipients).toEqual([...members].sort());
  });

  it('2. creates a correct audit entry when a milestone is updated', async () => {
    const { prisma, service } = makeService([randomUUID()]);

    const audit = await service.recordMilestoneChange(
      recordInput('MILESTONE_STATUS_UPDATED', ORG_A),
    );

    expect(prisma.auditEntry.rows).toHaveLength(1);
    expect(audit.eventType).toBe('MILESTONE_STATUS_UPDATED');
    expect(audit.entityId).toBe(PROJECT_ID);
    expect(audit.actorOrgId).toBe(ORG_A);
    expect(audit.previousState).toEqual({ status: 'ACTIVE' });
    expect(audit.newState).toEqual({ status: 'DONE' });
  });

  it('3. enforces audit immutability (no update/delete path)', async () => {
    const { prisma, service } = makeService([randomUUID()]);
    await service.recordMilestoneChange(recordInput('MILESTONE_CREATED', ORG_A));

    // The service exposes no update/delete; the explicit guard must always throw.
    await expect(service.modifyAuditEntry()).rejects.toBeInstanceOf(ForbiddenError);

    // The repository has no update/delete method for audit entries.
    const repoWithAny = prisma.auditEntry as unknown as Record<string, unknown>;
    expect(repoWithAny.update).toBeUndefined();
    expect(repoWithAny.delete).toBeUndefined();

    // The stored entry remains unchanged.
    expect(prisma.auditEntry.rows).toHaveLength(1);
  });

  it('4. filters audit history by date range', async () => {
    const { prisma, service } = makeService([randomUUID()]);
    const caller = actor(ORG_A);

    // Seed three entries with controlled timestamps.
    const base = new Date('2026-01-01T00:00:00Z');
    const times = [
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-02-01T00:00:00Z'),
      new Date('2026-03-01T00:00:00Z'),
    ];
    prisma.auditEntry.rows.push(
      ...times.map((createdAt, i) => ({
        id: randomUUID(),
        eventType: 'MILESTONE_STATUS_UPDATED' as AuditEventType,
        entityType: 'Project',
        entityId: PROJECT_ID,
        actorUserId: caller.userId,
        actorOrgId: ORG_A,
        actorIp: null,
        previousState: null,
        newState: { i },
        createdAt,
      })),
    );
    void base;

    const results = await service.getAuditHistory(caller, PROJECT_ID, {
      from: new Date('2026-01-15T00:00:00Z'),
      to: new Date('2026-02-15T00:00:00Z'),
    });

    expect(results).toHaveLength(1);
    expect(results[0].createdAt).toEqual(times[1]);
  });

  it('5. filters audit history by event type', async () => {
    const { prisma, service } = makeService([randomUUID()]);
    const caller = actor(ORG_A);

    const seed = (eventType: AuditEventType) =>
      prisma.auditEntry.rows.push({
        id: randomUUID(),
        eventType,
        entityType: 'Project',
        entityId: PROJECT_ID,
        actorUserId: caller.userId,
        actorOrgId: ORG_A,
        actorIp: null,
        previousState: null,
        newState: null,
        createdAt: new Date(),
      });
    seed('MILESTONE_CREATED');
    seed('MILESTONE_STATUS_UPDATED');
    seed('MILESTONE_DELETED');

    const results = await service.getAuditHistory(caller, PROJECT_ID, {
      eventType: 'MILESTONE_STATUS_UPDATED',
    });

    expect(results).toHaveLength(1);
    expect(results[0].eventType).toBe('MILESTONE_STATUS_UPDATED');
  });

  it('6. denies access to another organisation\'s audit log (multi-tenant isolation)', async () => {
    const { prisma, service } = makeService([randomUUID()]);

    // Audit entry belongs to ORG_A.
    await service.recordMilestoneChange(recordInput('MILESTONE_CREATED', ORG_A));
    expect(prisma.auditEntry.rows).toHaveLength(1);

    // A caller from ORG_B queries the same project and must see nothing.
    const intruder = actor(ORG_B);
    const results = await service.getAuditHistory(intruder, PROJECT_ID, {});

    expect(results).toHaveLength(0);
  });
});
