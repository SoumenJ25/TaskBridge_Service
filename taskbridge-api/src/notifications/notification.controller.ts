/**
 * Notification & Audit Service — controller / route layer.
 *
 * HTTP concerns ONLY. Exposes the four service endpoints and maps typed domain errors to status
 * codes. No business logic or data access here.
 *
 * Endpoints:
 *   POST  /audit                     — internal: record an audit event (called by Project Service)
 *   GET   /audit/:projectId          — query params `from`, `to`, `eventType`
 *   GET   /notifications/:userId     — all UNREAD notifications for a user
 *   PATCH /notifications/:id/read    — mark a notification read
 */

import { Router, Request, Response } from 'express';
import { NotificationService } from './notification.service';
import { isAuditEventType } from './notification.model';
import { Principal } from '../shared/principal';
import {
  ValidationError,
  UnauthorisedError,
  ForbiddenError,
  NotFoundError,
} from '../shared/errors';

function requirePrincipal(req: Request): Principal {
  const principal = (req as Request & { principal?: Principal }).principal;
  if (!principal) {
    throw new UnauthorisedError('Authentication required');
  }
  return principal;
}

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

/** Parse an optional ISO date query param into a Date, or undefined. */
function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function createNotificationRouter(service: NotificationService): Router {
  const router = Router();

  router.post('/audit', async (req: Request, res: Response) => {
    try {
      const principal = requirePrincipal(req);
      const body = req.body ?? {};
      const audit = await service.recordMilestoneChange({
        eventType: body.eventType,
        entityType: body.entityType,
        entityId: body.entityId,
        actor: principal,
        actorIp: req.ip ?? null,
        previousState: body.previousState ?? null,
        newState: body.newState ?? null,
      });
      res.status(201).json(audit);
    } catch (error) {
      toHttpError(error, res);
    }
  });

  router.get('/audit/:projectId', async (req: Request, res: Response) => {
    try {
      const principal = requirePrincipal(req);
      const eventTypeRaw = req.query.eventType;
      const eventType = isAuditEventType(eventTypeRaw) ? eventTypeRaw : undefined;
      const history = await service.getAuditHistory(principal, req.params.projectId, {
        from: parseDate(req.query.from),
        to: parseDate(req.query.to),
        eventType,
      });
      res.status(200).json(history);
    } catch (error) {
      toHttpError(error, res);
    }
  });

  router.get('/notifications/:userId', async (req: Request, res: Response) => {
    try {
      const principal = requirePrincipal(req);
      const notifications = await service.getUnreadNotifications(principal, req.params.userId);
      res.status(200).json(notifications);
    } catch (error) {
      toHttpError(error, res);
    }
  });

  router.patch('/notifications/:id/read', async (req: Request, res: Response) => {
    try {
      const principal = requirePrincipal(req);
      const notification = await service.markNotificationRead(principal, req.params.id);
      res.status(200).json(notification);
    } catch (error) {
      toHttpError(error, res);
    }
  });

  return router;
}
