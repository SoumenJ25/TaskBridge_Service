/**
 * Notification & Audit Service — model layer.
 *
 * Domain types and typed contracts for audit entries and notifications. No database access here.
 * Audit entries are IMMUTABLE: there are intentionally no "update" or "delete" shapes.
 */

import type { Principal } from '../shared/principal';

/** Audit event types. Mirrors the Prisma `AuditEventType` enum. */
export const AUDIT_EVENT_TYPES = [
  'MILESTONE_CREATED',
  'MILESTONE_STATUS_UPDATED',
  'MILESTONE_DELETED',
  'MILESTONE_REOPENED',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

/** An immutable audit entry as exposed by the service layer. */
export interface AuditEntry {
  id: string;
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  actorUserId: string;
  actorOrgId: string;
  /** Actor IP address (PII). Persisted in the audit store only; never written to application logs. */
  actorIp: string | null;
  previousState: unknown | null;
  newState: unknown | null;
  createdAt: Date;
}

/** Input contract for recording an audit entry (append-only). */
export interface RecordAuditInput {
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  actor: Principal;
  /** Actor IP address (optional PII). Captured at the HTTP edge only. */
  actorIp?: string | null;
  previousState: unknown | null;
  newState: unknown | null;
}

/** A notification as exposed by the service layer. */
export interface Notification {
  id: string;
  recipientUserId: string;
  eventType: string;
  projectId: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

/** Optional filters for querying audit history. */
export interface AuditHistoryFilter {
  from?: Date;
  to?: Date;
  eventType?: AuditEventType;
}

/** Type guard for a valid audit event type. */
export function isAuditEventType(value: unknown): value is AuditEventType {
  return typeof value === 'string' && (AUDIT_EVENT_TYPES as readonly string[]).includes(value);
}
