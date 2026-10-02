/**
 * Project Service — controller / route layer.
 *
 * HTTP concerns ONLY: read the authenticated principal, delegate to the service, and map typed
 * domain errors to specific HTTP status codes. No business logic or data access here.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ProjectService } from './project.service';
import { Principal } from '../shared/principal';
import {
  ValidationError,
  UnauthorisedError,
  ForbiddenError,
  NotFoundError,
} from '../shared/errors';

/** Extract the authenticated principal attached by upstream auth middleware. */
function requirePrincipal(req: Request): Principal {
  const principal = (req as Request & { principal?: Principal }).principal;
  if (!principal) {
    throw new UnauthorisedError('Authentication required');
  }
  return principal;
}

/** Map a thrown domain error to an HTTP response. */
function toHttpError(error: unknown, res: Response): void {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
  } else if (error instanceof UnauthorisedError) {
    res.status(401).json({ error: 'UNAUTHORISED' });
  } else if (error instanceof ForbiddenError) {
    res.status(403).json({ error: 'FORBIDDEN' });
  } else if (error instanceof NotFoundError) {
    res.status(404).json({ error: 'NOT_FOUND' });
  } else {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

/** Build the Project Service router around a configured service instance. */
export function createProjectRouter(service: ProjectService): Router {
  const router = Router();

  router.post('/projects', async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const principal = requirePrincipal(req);
      const project = await service.create(principal, req.body);
      res.status(201).json(project);
    } catch (error) {
      toHttpError(error, res);
    }
  });

  router.patch('/projects/:id/status', async (req: Request, res: Response) => {
    try {
      const principal = requirePrincipal(req);
      const project = await service.updateStatus(principal, req.params.id, req.body);
      res.status(200).json(project);
    } catch (error) {
      toHttpError(error, res);
    }
  });

  router.get('/projects', async (req: Request, res: Response) => {
    try {
      const principal = requirePrincipal(req);
      const teamId = String(req.query.teamId ?? '');
      const projects = await service.getByTeam(principal, teamId);
      res.status(200).json(projects);
    } catch (error) {
      toHttpError(error, res);
    }
  });

  router.delete('/projects/:id', async (req: Request, res: Response) => {
    try {
      const principal = requirePrincipal(req);
      await service.delete(principal, req.params.id);
      res.status(204).send();
    } catch (error) {
      toHttpError(error, res);
    }
  });

  return router;
}
