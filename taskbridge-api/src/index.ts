/**
 * Application composition root.
 *
 * Wires the layers together (Prisma → repositories → services → adapter → routers), configures the
 * Express app, and starts the HTTP server. This is the only place that knows about every concrete
 * dependency; each layer elsewhere depends only on its direct neighbour or an injected port.
 */

import express from 'express';
import { prisma } from './shared/prisma';
import { authMiddleware } from './shared/auth';
import { logger } from './shared/logger';

import { ProjectRepository, PrismaLike as ProjectPrismaLike } from './projects/project.repository';
import { ProjectService } from './projects/project.service';
import { createProjectRouter } from './projects/project.controller';

import {
  NotificationRepository,
  PrismaLike as NotificationPrismaLike,
} from './notifications/notification.repository';
import { NotificationService } from './notifications/notification.service';
import { createNotificationRouter } from './notifications/notification.controller';
import { NotificationAuditAdapter } from './notifications/notification-audit.adapter';
import { ProjectTeamResolver } from './notifications/team-resolver';

export function buildApp(): express.Express {
  // Repositories (the only DB-aware layer).
  const projectRepository = new ProjectRepository(prisma as unknown as ProjectPrismaLike);
  const notificationRepository = new NotificationRepository(
    prisma as unknown as NotificationPrismaLike,
  );

  // Notification & Audit Service + its team resolver.
  const teamResolver = new ProjectTeamResolver(prisma as unknown as ProjectPrismaLike);
  const notificationService = new NotificationService(notificationRepository, teamResolver);

  // Project Service, integrated with audit/notifications via the adapter (the inter-service port).
  const auditAdapter = new NotificationAuditAdapter(notificationService);
  const projectService = new ProjectService(projectRepository, auditAdapter);

  const app = express();
  app.use(express.json());
  app.use(authMiddleware);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(createProjectRouter(projectService));
  app.use(createNotificationRouter(notificationService));

  return app;
}

/* istanbul ignore next */
if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  const app = buildApp();
  app.listen(port, () => {
    logger.info('server.started', { port });
  });
}
