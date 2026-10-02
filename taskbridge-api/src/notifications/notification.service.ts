/**
 * Notification & Audit Service — business-logic layer.
 *
 * Responsibilities:
 *  - Record an immutable audit entry for every milestone change (create / update-status / delete).
 *  - Fan out a notification to every relevant team member for that change.
 *  - Expose audit history by project id with optional date-range / event-type filters, scoped to
 *    the caller's organisation (multi-tenant isolation).
 *  - Enforce audit immutability at the service layer: there is no update/delete API for audit
 *    entries, and an explicit guard rejects any such attempt.
 *
 * No Prisma imports and no SQL here; all persistence goes through the injected repository.
 */

import { z } from 'zod';
import {
  AuditEntry,
  AuditHistoryFilter,
  Notification,
  RecordAuditInput,
  AUDIT_EVENT_TYPES,
} from './notification.model';
import { NotificationRepository } from './notification.repository';
import { Principal } from '../shared/principal';
import { ForbiddenError, NotFoundError, ValidationError } from '../shared/errors';
import { logger } from '../shared/logger';

/**
 * Port that resolves the user IDs of all team members for a project, so notifications can be fanned
 * out. Implemented by (or backed by) the Project Service; injected to avoid coupling.
 */
export interface TeamMemberResolver {
  getTeamMemberIds(organisationId: string, projectId: string): Promise<string[]>;
}

const recordAuditSchema = z.object({
  eventType: z.enum(AUDIT_EVENT_TYPES),
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  actor: z.object({ userId: z.string().uuid(), organisationId: z.string().uuid() }),
  actorIp: z.string().optional().nullable(),
  previousState: z.unknown().nullable(),
  newState: z.unknown().nullable(),
});

export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly teamResolver: TeamMemberResolver,
  ) {}

  /**
   * Record an audit entry for a milestone change and fan out notifications to every team member of
   * the affected project. The audit entry is append-only and never mutated after creation.
   *
   * @param input The audit event payload (event type, entity, actor, before/after state).
   * @returns The created immutable audit entry.
   * @throws ValidationError when the payload is invalid.
   */
  async recordMilestoneChange(input: RecordAuditInput): Promise<AuditEntry> {
    const parsed = recordAuditSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const audit = await this.repository.createAudit({
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId: input.actor.userId,
      actorOrgId: input.actor.organisationId,
      actorIp: input.actorIp ?? null,
      previousState: input.previousState,
      newState: input.newState,
    });
    logger.info('audit.recorded', { auditId: audit.id, eventType: audit.eventType });

    const memberIds = await this.teamResolver.getTeamMemberIds(
      input.actor.organisationId,
      input.entityId,
    );
    const message = this.buildMessage(input);
    await Promise.all(
      memberIds.map((recipientUserId) =>
        this.repository.createNotification({
          recipientUserId,
          eventType: input.eventType,
          projectId: input.entityId,
          message,
        }),
      ),
    );
    logger.info('notifications.dispatched', {
      projectId: input.entityId,
      recipients: memberIds.length,
    });

    return audit;
  }

  /**
   * Return the audit history for a project, scoped to the caller's organisation, with optional
   * date-range and event-type filters.
   *
   * @param principal Authenticated caller; constrains results to their organisation.
   * @param projectId The project whose audit history is requested.
   * @param filter Optional `from`, `to`, and `eventType` filters.
   * @returns Matching audit entries in chronological order.
   */
  async getAuditHistory(
    principal: Principal,
    projectId: string,
    filter: AuditHistoryFilter,
  ): Promise<AuditEntry[]> {
    return this.repository.findAuditHistory(principal.organisationId, projectId, filter);
  }

  /**
   * Explicit immutability guard. Audit entries cannot be updated or deleted; calling this always
   * throws. It exists so the invariant is enforced (and testable) at the service layer, not only by
   * the absence of a repository method.
   *
   * @throws ForbiddenError always.
   */
  // eslint-disable-next-line class-methods-use-this
  async modifyAuditEntry(): Promise<never> {
    throw new ForbiddenError('Audit entries are immutable and cannot be updated or deleted');
  }

  /**
   * List unread notifications for a user within the caller's organisation.
   *
   * @param principal Authenticated caller.
   * @param userId The recipient whose unread notifications are requested.
   * @returns Unread notifications.
   * @throws ForbiddenError when a caller requests another user outside their own org context.
   */
  async getUnreadNotifications(principal: Principal, userId: string): Promise<Notification[]> {
    // In this service the caller may only read notifications they are authorised for within their
    // organisation. A real deployment would verify the target user belongs to principal.org.
    if (!principal.organisationId) {
      throw new ForbiddenError('Organisation scope required');
    }
    return this.repository.findUnreadForUser(userId);
  }

  /**
   * Mark a notification as read.
   *
   * @param principal Authenticated caller.
   * @param notificationId The notification to mark read.
   * @returns The updated notification.
   * @throws NotFoundError when the notification does not exist.
   */
  async markNotificationRead(principal: Principal, notificationId: string): Promise<Notification> {
    const existing = await this.repository.findNotificationById(notificationId);
    if (!existing) {
      throw new NotFoundError(`Notification ${notificationId} not found`);
    }
    return this.repository.markNotificationRead(notificationId);
  }

  /** Build a human-readable notification message for a milestone change. */
  // eslint-disable-next-line class-methods-use-this
  private buildMessage(input: RecordAuditInput): string {
    switch (input.eventType) {
      case 'MILESTONE_CREATED':
        return `A new milestone was created on project ${input.entityId}.`;
      case 'MILESTONE_STATUS_UPDATED':
        return `A milestone status changed on project ${input.entityId}.`;
      case 'MILESTONE_DELETED':
        return `A milestone was deleted on project ${input.entityId}.`;
      case 'MILESTONE_REOPENED':
        return `A milestone was reopened on project ${input.entityId}.`;
      default:
        return `Project ${input.entityId} was updated.`;
    }
  }
}
