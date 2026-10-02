# PROMPTS.md — Live Copilot Prompt Log

> This log is appended to in real time as Copilot is actually used during the assessment. Each entry
> records the exact prompt, the Copilot feature, the technique applied, and the rationale. A closing
> **"Post-Generation Corrections"** section records every change made to Copilot's output.

## Prompt Chain (in execution order)

| # | Phase | Prompt Text (exact) | Copilot Feature | Technique | Rationale |
|---|-------|---------------------|-----------------|-----------|-----------|
| 1 | P2a | "Generate a Project model and a Project service with create, update status, get by team, and delete functions. Use a database." | Copilot Chat — Ask mode | Low-specificity / unconstrained (deliberate anti-pattern) | Required by the hard sequencing rule: simulate inherited contractor code. The prompt is intentionally vague (no stack, no tenancy, no validation) so the generation exposes the gaps that the review phase must catch. |
| 2 | P3 | "Scaffold a layered Notification & Audit service in TypeScript + Prisma for a multi-tenant app: an immutable AuditEntry (no update/delete), a Notification model, a repository (#file project.repository.ts as the pattern), and a service that records an audit entry and fans out notifications to all team members. Scope all audit reads by organisationId." | Copilot Chat — Agent/Edit mode + `#file` | Role-based + specificity + constraint | Multi-file scaffold that must match the existing repository pattern; `#file` anchors Copilot to the established layered style and tenancy rules. |
| 3 | P3 | "@workspace how should the Project Service call the Notification & Audit Service without the two becoming tightly coupled? Suggest an integration contract." | Copilot Chat — Ask mode + `@workspace` | Decomposition + role-based | Design question about the inter-service seam; `@workspace` lets Copilot reason across both services and propose the port/adapter boundary. |
| 4 | P3 | "Add an explicit service-layer immutability guard so any attempt to update or delete an audit entry throws, and explain why absence-of-method alone is insufficient." | Inline Chat / Edit mode | Constraint + iterative refinement | Hardens the immutability invariant so it is testable, not just implied by a missing method. |
| 5 | P3 | "Given this AuditEntry model and multi-tenant audit service, list every file and layer affected if I add a new event type and start storing the actor's IP address, and flag privacy/retention risks." | Copilot Chat — Ask mode | Decomposition + specificity | Drives the IMPACT_ANALYSIS file-impact map before any code is written. |

### WRITE 2A — Bad-generation first impressions

- **Copilot mode used:** Ask mode (Copilot Chat), single unconstrained prompt.
- **First impression / what jumps out as problematic:**
  - **SQL injection everywhere** — queries are built by string concatenation of user input.
  - **No multi-tenant isolation** — there is no `organisationId`; any team value from any tenant is trusted.
  - **No layering** — model, DB connection, and "service" are all in one file; the service imports the DB driver directly (should be Prisma via a repository).
  - **Hard-coded DB credentials** committed in source.
  - **Broken async/control flow** — `create` returns `new Project(result.insertId, ...)` but `result`
    is only defined inside the callback; `getByTeam` returns nothing to the caller.
  - **No validation, no typed contracts, no error handling** beyond `throw err` inside callbacks.
  - **Wrong stack** — plain JS + `mysql` driver instead of TypeScript + Prisma per our standards.

---

## Post-Generation Corrections

The raw generation (`project.js`) was **not** edited in place — per the sequencing rule it was kept
as the "before" baseline in git history, and a clean layered version was authored as separate files.
Corrections applied during remediation:

| # | What Copilot produced | What was wrong | How it was fixed |
|---|-----------------------|----------------|------------------|
| 1 | String-concatenated SQL in every method | SQL injection across all tenants | Rewrote on Prisma via a repository with parameterised queries. |
| 2 | No `organisationId` anywhere | No multi-tenant isolation | Added `organisationId` to the model and scoped every repository/service call by the caller's org. |
| 3 | Hard-coded DB credentials in source | Secret leak | Moved datasource to `env("DATABASE_URL")`; no credentials in code. |
| 4 | `create`/`getByTeam` returning from inside callbacks | Always-undefined results | Converted to async/await; service returns awaited repository results. |
| 5 | One file mixing model + DB + service | No layering | Split into `project.model.ts`, `project.repository.ts`, `project.service.ts`, `project.controller.ts`. |
| 6 | No validation, no typed contracts | Invalid data reaches DB | Added Zod validation + typed DTOs; `status` constrained to an enum. |
| 7 | `throw err` in callbacks, no logging | Process crashes, no observability | Added typed domain errors mapped to HTTP codes + structured logging (no PII). |
| 8 | Hard delete with no trail | Breaks audit/notification contract | Every mutation now calls the `AuditNotificationPort` with before/after state. |

### WRITE 4A — Three most important remediation changes + most useful mode

1. **Multi-tenant isolation** — adding `organisationId` scoping to every operation (the single most
   dangerous gap in the original).
2. **Layered architecture on Prisma** — splitting model/repository/service/controller and removing
   the raw `mysql` driver and SQL injection.
3. **Audit + notification integration** — wiring every milestone change to the `AuditNotificationPort`
   so the cross-service contract is honoured.

**Most useful Copilot mode for remediation:** Edit/Agent mode for the multi-file scaffold (generating
the four layered files consistently in one pass), with Inline Chat `/fix` and `/doc` for tightening
individual methods and adding docstrings. Ask mode was most useful earlier, for *review*; Edit/Agent
was most useful for *applying* the structural fix across files.

### WRITE 5A — Post-Generation Corrections (Notification & Audit Service, P3)

| # | What Copilot produced | What was wrong | How it was fixed |
|---|-----------------------|----------------|------------------|
| 1 | Audit service with a working `updateAudit`/`deleteAudit` for "admin corrections" | Breaks the immutability requirement | Removed those paths; added an explicit `modifyAuditEntry()` guard that always throws, plus a test. |
| 2 | Audit history query without org scoping | Cross-tenant audit leak | Added `actorOrgId` scoping in the repository `where` and threaded `principal.organisationId`. |
| 3 | Notification fan-out hard-coded to the actor only | Requirement is *all* team members | Introduced a `TeamMemberResolver` port and fan out to every member id. |
| 4 | For the IP change, Copilot added `logger.info('audit', { ip })` | Logs PII | Removed; IP is persisted in the audit store only and never logged. |
| 5 | `reopen` allowed from any status | Reopen should only apply to a `DONE` milestone | Added a `ValidationError` guard when status !== 'DONE'. |
