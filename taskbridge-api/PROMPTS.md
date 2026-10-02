# PROMPTS.md — Live Copilot Prompt Log

> This log is appended to in real time as Copilot is actually used during the assessment. Each entry
> records the exact prompt, the Copilot feature, the technique applied, and the rationale. A closing
> **"Post-Generation Corrections"** section records every change made to Copilot's output.

## Prompt Chain (in execution order)

| # | Phase | Prompt Text (exact) | Copilot Feature | Technique | Rationale |
|---|-------|---------------------|-----------------|-----------|-----------|
| 1 | P2a | "Generate a Project model and a Project service with create, update status, get by team, and delete functions. Use a database." | Copilot Chat — Ask mode | Low-specificity / unconstrained (deliberate anti-pattern) | Required by the hard sequencing rule: simulate inherited contractor code. The prompt is intentionally vague (no stack, no tenancy, no validation) so the generation exposes the gaps that the review phase must catch. |

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
