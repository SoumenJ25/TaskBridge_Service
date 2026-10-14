/**
 * Singleton Prisma client for the application.
 *
 * Only repositories should import this module; other layers must go through a repository.
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
