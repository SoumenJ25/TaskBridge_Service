/**
 * The authenticated principal carried by every request. All data access is scoped by
 * `organisationId` to enforce multi-tenant isolation.
 */
export interface Principal {
  userId: string;
  organisationId: string;
}
