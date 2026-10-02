/**
 * Adapter wiring the Project Service's `AuditNotificationPort` to the Notification & Audit Service.
 *
 * This is the concrete integration contract between the two services: the Project Service depends
 * only on the `AuditNotificationPort` interface, and this adapter translates each milestone change
 * into a `recordMilestoneChange` call on the Notification & Audit Service.
 */

import type { AuditNotificationPort } from '../projects/project.service';
import type { Project } from '../projects/project.model';
import type { Principal } from '../shared/principal';
import { NotificationService } from './notification.service';

export class NotificationAuditAdapter implements AuditNotificationPort {
  constructor(private readonly notificationService: NotificationService) {}

  /** Translate a Project Service milestone change into an audit + notification write. */
  async recordMilestoneChange(input: {
    eventType:
      | 'MILESTONE_CREATED'
      | 'MILESTONE_STATUS_UPDATED'
      | 'MILESTONE_DELETED'
      | 'MILESTONE_REOPENED';
    actor: Principal;
    actorIp?: string | null;
    project: Project;
    previousState: Project | null;
    newState: Project | null;
  }): Promise<void> {
    await this.notificationService.recordMilestoneChange({
      eventType: input.eventType,
      entityType: 'Project',
      entityId: input.project.id,
      actor: input.actor,
      actorIp: input.actorIp ?? null,
      previousState: input.previousState,
      newState: input.newState,
    });
  }
}
