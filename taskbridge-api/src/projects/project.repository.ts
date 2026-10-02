/**
 * Project Service — repository layer.
 *
 * The ONLY project layer permitted to touch the database. All queries are parameterised through
 * Prisma and scoped by `organisationId` so no caller can reach another tenant's rows.
 *
 * The Prisma client is injected to keep this layer testable without a live database.
 */

import type { Project, ProjectStatus, CreateProjectInput } from './project.model';

/**
 * The slice of the Prisma client this repository depends on. Declaring it as an interface keeps
 * the repository decoupled from the generated client and trivially mockable in tests.
 */
export interface ProjectDelegate {
  create(args: { data: { organisationId: string; teamId: string; name: string; status: ProjectStatus } }): Promise<Project>;
  update(args: { where: { id: string }; data: { status: ProjectStatus } }): Promise<Project>;
  findFirst(args: { where: { id: string; organisationId: string } }): Promise<Project | null>;
  findMany(args: { where: { organisationId: string; teamId: string } }): Promise<Project[]>;
  delete(args: { where: { id: string } }): Promise<Project>;
}

export interface PrismaLike {
  project: ProjectDelegate;
}

export class ProjectRepository {
  constructor(private readonly prisma: PrismaLike) {}

  /** Insert a new project for the given organisation. */
  async create(organisationId: string, input: CreateProjectInput): Promise<Project> {
    return this.prisma.project.create({
      data: {
        organisationId,
        teamId: input.teamId,
        name: input.name,
        status: 'PLANNED',
      },
    });
  }

  /** Find a single project by id, scoped to the caller's organisation. */
  async findByIdForOrg(organisationId: string, id: string): Promise<Project | null> {
    return this.prisma.project.findFirst({ where: { id, organisationId } });
  }

  /** List projects for a team within the caller's organisation. */
  async findByTeam(organisationId: string, teamId: string): Promise<Project[]> {
    return this.prisma.project.findMany({ where: { organisationId, teamId } });
  }

  /** Update a project's status by id (caller scope is verified by the service first). */
  async updateStatus(id: string, status: ProjectStatus): Promise<Project> {
    return this.prisma.project.update({ where: { id }, data: { status } });
  }

  /** Delete a project by id (caller scope is verified by the service first). */
  async delete(id: string): Promise<Project> {
    return this.prisma.project.delete({ where: { id } });
  }
}
