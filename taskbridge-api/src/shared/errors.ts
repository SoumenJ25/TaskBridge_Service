/**
 * Shared typed domain errors. Services throw these; controllers map them to HTTP codes.
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Input failed validation. Maps to HTTP 400. */
export class ValidationError extends DomainError {}

/** Caller is not authenticated. Maps to HTTP 401. */
export class UnauthorisedError extends DomainError {}

/** Caller is authenticated but not allowed (e.g. cross-tenant). Maps to HTTP 403. */
export class ForbiddenError extends DomainError {}

/** Resource does not exist within the caller's scope. Maps to HTTP 404. */
export class NotFoundError extends DomainError {}
