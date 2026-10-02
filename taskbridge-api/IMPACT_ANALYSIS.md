# IMPACT_ANALYSIS.md — Mid-Sprint Change Request

> **Written BEFORE coding the change**, as required. Scope change: (1) add a new event type
> `MILESTONE_REOPENED` that triggers an audit entry **and** notifications, and (2) audit entries must
> now capture the **actor's IP address**.

## 1. Change summary

| # | Change | Nature |
|---|--------|--------|
| A | New event type `MILESTONE_REOPENED` (milestone moves from `DONE` back to an active status) emitting audit + notifications | **Additive** (new enum value + new transition path) |
| B | Capture the actor's **IP address** on every audit entry | **Breaking-ish / migration required** (new persisted field + new data flowing through every layer) |

## 2. Affected files / modules / data models

| Area | File / model | Change | Type |
|------|--------------|--------|------|
| Schema | `prisma/schema.prisma` → `AuditEventType` enum | Add `MILESTONE_REOPENED` | Additive (enum migration) |
| Schema | `prisma/schema.prisma` → `AuditEntry` model | Add nullable `actorIp String?` | **Migration required** |
| Project model | `src/projects/project.model.ts` | No new status needed (reopen = status back to `ACTIVE`/`PLANNED`), but add a reopen path | Additive |
| Project service | `src/projects/project.service.ts` | Add `reopen()` method emitting `MILESTONE_REOPENED`; thread the actor IP into the audit port | Additive + signature change |
| Integration port | `AuditNotificationPort` (project.service.ts) | Add optional `actorIp` to the `recordMilestoneChange` input | **Contract change** (both services must agree) |
| Audit model | `src/notifications/notification.model.ts` | Add `MILESTONE_REOPENED` to `AUDIT_EVENT_TYPES`; add `actorIp` to `AuditEntry` + `RecordAuditInput` | Additive |
| Audit repository | `src/notifications/notification.repository.ts` | Persist `actorIp` on create | Additive |
| Audit service | `src/notifications/notification.service.ts` | Accept + validate `actorIp`; add reopen message copy | Additive |
| Adapter | `notification-audit.adapter.ts` | Pass `actorIp` through | Additive |
| Controller | both controllers | Capture IP from the request (`req.ip` / `X-Forwarded-For`) at the HTTP edge only | Additive |
| Tests | `tests/` | Add cases for reopen fan-out + IP persisted (and NOT logged) | Additive |

## 3. Privacy & compliance risks of capturing IP

An IP address is **personal data** under GDPR and similar regimes. Capturing it is a compliance
decision, not just a schema addition:

- **Privacy / lawful basis:** we must have a documented purpose (security/audit forensics) and a
  lawful basis; IP cannot be collected "just in case." Update the privacy notice / DPA.
- **Data retention:** audit entries are **immutable and long-lived**, so IPs would persist for the
  full audit retention period. That may exceed what's proportionate — consider a shorter retention
  for the IP field specifically (e.g. truncate/null it after N days) even though the audit row stays.
- **Logging exposure:** IP must be **persisted in the audit store only**, never written to
  application logs (our logger already forbids PII). A leaked log line is a breach.
- **Data minimisation:** consider storing a **truncated** IP (e.g. /24) or a salted hash if full
  precision isn't needed for the forensic purpose.
- **Access control:** the IP field is more sensitive than the rest of the audit row; restrict who can
  read it and keep it inside the same multi-tenant scoping (`actorOrgId`).
- **Subject-access / erasure tension:** immutability vs. the right to erasure is a genuine conflict —
  document that audit entries are retained under a legal/security exemption, and handle erasure via
  field-level redaction rather than row deletion (never break immutability).

## 4. Recommended approach + sequencing

1. **Schema migration first** — add the `MILESTONE_REOPENED` enum value and the nullable `actorIp`
   column. Nullable keeps existing rows valid (no backfill).
2. **Thread IP from the edge only** — capture `req.ip` in the controller, pass it inward as data;
   never read request objects in the service/repository.
3. **Extend the contract** — add optional `actorIp` to `AuditNotificationPort` and `RecordAuditInput`
   so both services stay in sync; keep it optional to avoid a breaking rollout.
4. **Add the reopen transition** — `ProjectService.reopen()` validates the project is currently
   `DONE`, sets it active again, and emits `MILESTONE_REOPENED` with before/after + IP.
5. **Guard logging** — assert in tests that IP is persisted but never appears in logs.
6. **Governance** — update privacy notice + retention policy before enabling IP capture in prod.

## 5. How Copilot Assisted This Analysis

- **Prompt (Ask mode):** *"Given this AuditEntry model and multi-tenant audit service, list every
  file and layer affected if I add a new event type and start storing the actor's IP address, and
  flag privacy/retention risks."* Copilot produced a solid **file-impact checklist** and surfaced the
  enum migration and the edge-only IP capture pattern.
- **Where I validated / overrode:** Copilot initially treated IP as "just another column" and
  suggested logging it for debugging — I **overrode** that: IP is PII, must never hit application
  logs, and must respect retention limits. Copilot also missed the **immutability-vs-erasure**
  tension; I added the field-level redaction approach manually because that requires legal/retention
  judgment an AI won't infer from the code alone.
- **Net:** Copilot accelerated the mechanical impact mapping; the compliance framing and the
  immutability conflict were human additions.
