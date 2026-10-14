/**
 * Express middleware that establishes the authenticated principal for each request.
 *
 * For local/dev use it reads the principal from headers:
 *   x-user-id          — the acting user's UUID
 *   x-organisation-id  — the user's organisation (tenant) UUID
 *
 * In production this would be replaced by real JWT/session verification that yields the same
 * `{ userId, organisationId }` shape. Requests without both headers are left unauthenticated, and
 * controllers will reject them with 401 via `requirePrincipal`.
 */

import { Request, Response, NextFunction } from 'express';
import { Principal } from './principal';

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.header('x-user-id');
  const organisationId = req.header('x-organisation-id');

  if (userId && organisationId) {
    const principal: Principal = { userId, organisationId };
    (req as Request & { principal?: Principal }).principal = principal;
  }

  next();
}
