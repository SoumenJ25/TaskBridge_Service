/**
 * Project Service — business-logic layer.
 *
 * Contains business rules ONLY: validation, multi-tenant isolation, and the audit + notification
 * side effects for every milestone change. It never imports Prisma or builds SQL; all persistence
 * goes through the injected repository, and all audit/notification work goes through the injected
 * port (implemented by the Notification & Audit Service).
 */

import { z } from 'zod';
import {
  Project,
  CreateProjectInput,
  UpdateProjectStatusInput,
  PROJECT_STATUSES,
} from './project.model';
import { ProjectRepository } from './project.repository';
import { Principal } from '../shared/principal';
import { ValidationError, NotFoundError } from '../shared/errors';
import { logger } from '../shared/logger';

const createSchema = z.object({
  teamId: z.string().uuid(),
  name: z.string().min(1).max(200),
});

const updateStatusSchema = z.object({
  status: z.enum(PROJECT_STATUSES),
});

/**
 * Integration contract with the Notification & Audit Service. The Project Service depends only on
 * this port, not on the audit implementation, so the two services stay loosely coupled.
 */
export interface AuditNotificationPort {
  /** Record an audit entry and fan out notifications for a milestone change. */
  recordMilestoneChange(input: {
    eventType:
      | 'MILESTONE_CREATED'
      | 'MILESTONE_STATUS_UPDATED'
      | 'MILESTONE_DELETED'
      | 'MILESTONE_REOPENED';
    actor: Principal;
    /** Actor IP address (optional PII), captured at the HTTP edge. */
    actorIp?: string | null;
    project: Project;
    previousState: Project | null;
    newState: Project | null;
  }): Promise<void>;
}

export class ProjectService {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly auditPort: AuditNotificationPort,
  ) {}

  /**
   * Create a project for the caller's organisation and emit a MILESTONE_CREATED audit + notifications.
   *
   * @param principal Authenticated caller; supplies the owning `organisationId`.
   * @param input Unvalidated create payload.
   * @returns The created project.
   * @throws ValidationError when the payload is invalid.
   */
  async create(principal: Principal, input: CreateProjectInput): Promise<Project> {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const project = await this.repository.create(principal.organisationId, parsed.data);
    logger.info('project.created', { projectId: project.id, organisationId: project.organisationId });

    await this.auditPort.recordMilestoneChange({
      eventType: 'MILESTONE_CREATED',
      actor: principal,
      project,
      previousState: null,
      newState: project,
    });

    return project;
  }

  /**
   * Update a project's status within the caller's organisation and emit an audit + notifications
   * capturing the before/after state.
   *
   * @param principal Authenticated caller.
   * @param id Project id.
   * @param input Unvalidated status payload.
   * @returns The updated project.
   * @throws ValidationError when the payload is invalid.
   * @throws NotFoundError when the project does not exist in the caller's organisation.
   */
  async updateStatus(
    principal: Principal,
    id: string,
    input: UpdateProjectStatusInput,
  ): Promise<Project> {
    const parsed = updateStatusSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const existing = await this.repository.findByIdForOrg(principal.organisationId, id);
    if (!existing) {
      throw new NotFoundError(`Project ${id} not found`);
    }

    const updated = await this.repository.updateStatus(id, parsed.data.status);
    logger.info('project.status_updated', { projectId: id, status: parsed.data.status });

    await this.auditPort.recordMilestoneChange({
      eventType: 'MILESTONE_STATUS_UPDATED',
      actor: principal,
      project: updated,
      previousState: existing,
      newState: updated,
    });

    return updated;
  }

  /**
   * Reopen a completed (DONE) milestone: move it back to ACTIVE and emit a MILESTONE_REOPENED audit
   * + notifications, capturing the actor's IP address.
   *
   * @param principal Authenticated caller.
   * @param id Project id.
   * @param actorIp Optional actor IP captured at the HTTP edge (PII; never logged).
   * @returns The reopened project.
   * @throws NotFoundError when the project does not exist in the caller's organisation.
   * @throws ValidationError when the project is not currently DONE.
   */
  async reopen(principal: Principal, id: string, actorIp?: string | null): Promise<Project> {
    const existing = await this.repository.findByIdForOrg(principal.organisationId, id);
    if (!existing) {
      throw new NotFoundError(`Project ${id} not found`);
    }
    if (existing.status !== 'DONE') {
      throw new ValidationError('Only a DONE milestone can be reopened');
    }

    const updated = await this.repository.updateStatus(id, 'ACTIVE');
    logger.info('project.reopened', { projectId: id });

    await this.auditPort.recordMilestoneChange({
      eventType: 'MILESTONE_REOPENED',
      actor: principal,
      actorIp,
      project: updated,
      previousState: existing,
      newState: updated,
    });

    return updated;
  }

  /**
   * List projects for a team within the caller's organisation.
   *
   * @param principal Authenticated caller.
   * @param teamId Team to filter by.
   * @returns Projects belonging to the caller's organisation and the given team.
   */
  async getByTeam(principal: Principal, teamId: string): Promise<Project[]> {
    return this.repository.findByTeam(principal.organisationId, teamId);
  }

  /**
   * Delete a project within the caller's organisation and emit a MILESTONE_DELETED audit +
   * notifications preserving the deleted state.
   *
   * @param principal Authenticated caller.
   * @param id Project id.
   * @throws NotFoundError when the project does not exist in the caller's organisation.
   */
  async delete(principal: Principal, id: string): Promise<void> {
    const existing = await this.repository.findByIdForOrg(principal.organisationId, id);
    if (!existing) {
      throw new NotFoundError(`Project ${id} not found`);
    }

    await this.repository.delete(id);
    logger.info('project.deleted', { projectId: id, organisationId: principal.organisationId });

    await this.auditPort.recordMilestoneChange({
      eventType: 'MILESTONE_DELETED',
      actor: principal,
      project: existing,
      previousState: existing,
      newState: null,
    });
  }
}
