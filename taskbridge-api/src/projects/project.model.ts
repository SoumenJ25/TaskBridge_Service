/**
 * Project Service — model layer.
 *
 * Holds the domain types and typed request/response contracts for the Project Service.
 * This is the only project file that mirrors the Prisma schema shape; no database access here.
 */

/** Allowed project/milestone statuses. Mirrors the Prisma `ProjectStatus` enum. */
export const PROJECT_STATUSES = ['PLANNED', 'ACTIVE', 'BLOCKED', 'DONE'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** A project as exposed by the service layer (response contract / DTO). */
export interface Project {
  id: string;
  organisationId: string;
  teamId: string;
  name: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Input contract for creating a project (tenant comes from the authenticated principal). */
export interface CreateProjectInput {
  teamId: string;
  name: string;
}

/** Input contract for updating a project's status. */
export interface UpdateProjectStatusInput {
  status: ProjectStatus;
}

/** Type guard for a valid status string. */
export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && (PROJECT_STATUSES as readonly string[]).includes(value);
}
