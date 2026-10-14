/**
 * Default implementation of the `TeamMemberResolver` port.
 *
 * The current data model does not persist team membership, so this resolver returns the project's
 * team as a single-member list derived from the project record. It is deliberately simple and is the
 * seam where a real membership lookup (e.g. a Membership table or an identity service call) would be
 * wired in without changing the Notification & Audit Service.
 */

import type { TeamMemberResolver } from './notification.service';
import type { PrismaLike as ProjectPrismaLike } from '../projects/project.repository';

export class ProjectTeamResolver implements TeamMemberResolver {
  constructor(private readonly prisma: ProjectPrismaLike) {}

  /**
   * Resolve the recipient user IDs for a project's notifications.
   *
   * @param organisationId Caller's organisation (tenant scope).
   * @param projectId The project whose team should be notified.
   * @returns The list of user IDs to notify (currently the project's team id as a placeholder).
   */
  async getTeamMemberIds(organisationId: string, projectId: string): Promise<string[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organisationId },
    });
    if (!project) {
      return [];
    }
    // Placeholder: without a membership model, notify the team owner. Replace with a real lookup.
    return [project.teamId];
  }
}
