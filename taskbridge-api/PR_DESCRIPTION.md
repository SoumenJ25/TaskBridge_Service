# PR_DESCRIPTION.md — TaskBridge API

## Summary (what + why)

This PR delivers the TaskBridge backend as two cooperating services on a Node.js + TypeScript +
Express + Prisma stack. The **Project Service** owns projects/milestones (create, update-status,
get-by-team, delete, reopen); the **Notification & Audit Service** records an immutable audit trail of
every milestone change and fans out notifications to team members. A deliberately sloppy Project
Service was first generated from a low-effort prompt, reviewed in REVIEW.md, and then remediated into
a clean layered implementation — so the change set shows both where AI helped and where human
judgment corrected it. A mid-sprint change (new `MILESTONE_REOPENED` event + actor IP capture) was
analysed in IMPACT_ANALYSIS.md before implementation.

## AI Tool Disclosure

- **Features used:** Copilot Chat (Ask mode) for review and design; Agent/Edit mode for multi-file
  scaffolding and remediation; Inline Chat + `/fix` + `/doc` for targeted method-level fixes and
  docstrings; `#file` and `@workspace` for context grounding.
- **Mode used most:** Edit/Agent mode (applying structural multi-file changes consistently).
- **Accepted vs overrode:** Accepted Copilot's layered scaffolding, boilerplate controllers, Zod
  schemas, and docstring drafts. **Overrode** Copilot on: multi-tenant `organisationId` scoping
  (absent in generations), audit immutability (Copilot offered admin update/delete "corrections"),
  and logging the actor IP (PII — removed; persisted only).
- **Estimated split:** ~60% AI-generated (scaffolding, boilerplate, schemas, test skeletons) /
  ~40% hand-written or hand-corrected (tenancy, immutability guard, integration contract, privacy
  handling, impact analysis).
- **Did `.github/copilot-instructions.md` help?** Yes — grounding Copilot with the standards file made
  it reliably produce layered, typed code and reduced tenancy/validation omissions in later prompts.

## How the two services integrate (inter-service contracts)

- The Project Service depends only on the `AuditNotificationPort` interface. On every milestone
  change it calls `recordMilestoneChange({ eventType, actor, actorIp?, project, previousState,
  newState })`.
- `NotificationAuditAdapter` implements that port against the Notification & Audit Service, translating
  each change into an audit write + notification fan-out (`entityType: 'Project'`, `entityId:
  project.id`).
- Notification fan-out resolves recipients through the `TeamMemberResolver` port, keeping the two
  services loosely coupled (no direct DB or type sharing beyond the contract).

## Testing coverage + known gaps

- **Coverage:** 6 Jest tests (all passing) covering equal fan-out, audit-on-update, immutability,
  date-range filter, event-type filter, and cross-tenant denial. Run with in-memory doubles (no DB).
- **Gaps:** no HTTP-level (Supertest) tests of the controllers yet; `TeamMemberResolver` has only a
  test double, no production implementation; Prisma client generation is blocked by a local TLS/cert
  issue so no integration test against a real database; IP-retention redaction job is specified in
  IMPACT_ANALYSIS.md but not implemented.

## Risk / trade-off in the multi-service design

**Dual-write consistency:** a milestone change mutates the Project DB and then writes an audit entry +
notifications through the port. If the audit/notification step fails after the project mutation
commits, the audit log can diverge from project state. The current design favours service decoupling
over a distributed transaction; a production system would need an outbox/event pattern to guarantee
the audit write eventually happens. This is an accepted trade-off for now and is called out as a gap.

## Self-review checklist

- [x] Layered architecture (model → repository → service → controller) in both services
- [x] Prisma only; repositories are the sole DB-aware layer
- [x] Multi-tenant isolation enforced in the service layer + tested
- [x] Audit immutability (no update/delete path + explicit guard) + tested
- [x] Input validation (Zod) and typed request/response contracts
- [x] Typed domain errors mapped to specific HTTP codes
- [x] Structured logging with no PII (IP never logged)
- [x] Docstrings on public service methods
- [x] Conventional Commits with descriptive bodies

## Peer Review Simulation

| # | Location (file + symbol) | What should change | Why (constructive) |
|---|--------------------------|--------------------|--------------------|
| 1 | `src/notifications/notification.service.ts` → `recordMilestoneChange` | Wrap the audit write + notification fan-out so a fan-out failure cannot leave an audit entry without notifications (or vice-versa); consider an outbox. | Today a partial failure after the audit insert leaves inconsistent state; the dual-write risk should be contained, not silent. |
| 2 | `src/notifications/notification.service.ts` → `getUnreadNotifications` | Verify the target `userId` actually belongs to `principal.organisationId` before returning notifications. | The current check only asserts an org exists; a caller could request another user's notifications. This is the kind of **tenant-scoping gap AI tools routinely miss** because the code "works" functionally. |
| 3 | `src/projects/project.controller.ts` → reopen route | Prefer a trusted, normalised client IP (validated `X-Forwarded-For` behind the proxy) over `req.ip`, and document retention. | `req.ip` can be spoofed/unset depending on proxy config; since this value is persisted PII in an immutable store, correctness and provenance matter. |

### WRITE 6A — the AI blind spot (comment #2)

AI code review tends to validate *local correctness* — the function compiles, returns the right shape,
and handles obvious errors — but it does not reason about **authorisation semantics** unless explicitly
told. A missing "does this user belong to the caller's organisation?" check looks perfectly fine to a
model because nothing is syntactically wrong; only a human who holds the multi-tenant threat model in
mind recognises it as a cross-tenant data-exposure bug.
