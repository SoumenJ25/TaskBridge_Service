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

_(to be filled during P2c remediation)_
