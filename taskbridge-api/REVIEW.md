# REVIEW.md — Project Service Review (raw generation)

> Subject: the raw, unreviewed `src/projects/project.js` produced by the low-effort prompt
> *"Generate a Project model and a Project service with create, update status, get by team, and
> delete functions. Use a database."* (preserved in git history, commit `chore: add raw unreviewed
> project service`). This document reviews that baseline before remediation.
>
> **Detection process:** Ask-mode Copilot review of the file, `/explain` on the `create` and
> `getByTeam` blocks, `@workspace` to compare the output against `.github/copilot-instructions.md`,
> plus manual human inspection for issues Copilot did not surface (tenancy, credentials, design).

## Findings Table

| # | Location (file + function) | Category | Severity | What's Wrong & Impact (multi-tenant context) | How Detected | Recommended Fix |
|---|----------------------------|----------|----------|-----------------------------------------------|--------------|-----------------|
| 1 | `project.js` → `create`, `updateStatus`, `getByTeam`, `delete` | Security | Critical | SQL built by string concatenation of caller input → **SQL injection**. In a multi-tenant DB one injected query can read or destroy *every tenant's* rows. | Ask-mode review + manual | Use Prisma parameterised queries via a repository; never concatenate SQL. |
| 2 | `project.js` → whole file | Security | Critical | **No `organisationId` / tenant scoping** anywhere. Any user can read/update/delete any team's projects across all organisations. Total multi-tenant isolation failure. | Manual (Copilot did not flag) | Add `organisationId` to the model; scope every operation by the caller's org in the service layer. |
| 3 | `project.js` → `db` config | Security | Critical | **Hard-coded DB credentials** (`root`/`password`) committed in source. Secret leak; same creds across tenants. | Manual | Move to env/secret config; rotate; never commit credentials. |
| 4 | `project.js` → `create` | Bug | High | Returns `new Project(result.insertId, …)` but `result` exists only inside the async callback → `ReferenceError` / always-undefined id. The function never actually returns the created row. | `/explain` on `create` | Use async/await repository call; return the awaited created entity. |
| 5 | `project.js` → `getByTeam` | Bug | High | Returns inside the callback, not to the caller → the method resolves to `undefined`. Callers silently get no data. | `/explain` on `getByTeam` | Return an awaited `repository.findByTeam(orgId, teamId)` result. |
| 6 | `project.js` → whole file | Architecture | High | **No layering** — model, DB connection, and service in one file; the "service" imports the DB driver directly. Violates model→repository→service→controller. Other services depending on this one inherit the coupling. | `@workspace` vs standards | Split into `project.model`, `project.repository`, `project.service`, `project.controller`. |
| 7 | `project.js` → all methods | Bug/Standards | High | **No input validation** and no typed contracts. Invalid `status` strings, empty names, and arbitrary types reach the DB. | Ask-mode review | Validate with Zod; constrain `status` to an enum; typed request/response DTOs. |
| 8 | `project.js` → all callbacks | Standards | Medium | **Error handling is `throw err` inside a callback**, which crashes the process instead of returning a controlled error. No structured logging. | Ask-mode review | Throw typed domain errors; map to HTTP codes in the controller; add structured logging (no PII). |
| 9 | `project.js` → stack | Standards | Medium | **Wrong stack**: plain JavaScript + `mysql` driver instead of TypeScript + Prisma per `.github/copilot-instructions.md`. No types, no `strict` safety. | `@workspace` vs standards | Reimplement in TypeScript with Prisma. |
| 10 | `project.js` → `delete` | Architecture | Medium | **Hard delete** with no audit hook. A deleted project leaves no trail — incompatible with the required immutable audit log and notification fan-out. | Manual | Delete via service that also writes an audit entry + notifications; consider soft-delete semantics. |
| 11 | `project.js` → `updateStatus`/`delete` | Bug | Low | Returns `true` unconditionally even if the row does not exist or the async query later fails. Callers get false success. | Manual | Return the updated entity / affected-row result from an awaited repository call; 404 when not found. |

## Architectural & Security Issues Copilot Introduced That Required Human Judgment

These are issues that a vague prompt will *not* surface on its own and that an AI reviewer tends to
miss because they depend on **business and compliance context**, not local code correctness:

1. **Absence of multi-tenant isolation (Finding #2).** The generated code is "correct" as a
   single-tenant CRUD service, so syntactic AI review passes it. Only a human who knows TaskBridge is
   multi-tenant recognises that *missing* `organisationId` scoping is a critical data-leak: any
   tenant can read or delete another tenant's projects. Because downstream services (Notification &
   Audit) trust this service's identifiers, the breach silently propagates — a bad `teamId` fans out
   notifications and audit entries into the wrong organisation.

2. **No audit/notification integration on mutations (Findings #10/#11).** The prompt asked only for
   CRUD, so Copilot produced CRUD. A human catches that *every* milestone change in this system must
   emit an immutable audit entry and notify the team — a cross-service contract. Hard-deleting a row
   with no trail is dangerous precisely because other services depend on this one as the source of
   truth; losing the before-state makes the audit log incomplete and non-compliant.

3. **Committed credentials + injection as a combined blast radius (Findings #1/#3).** Individually an
   AI might flag either, but a human weighs them together in a *multi-tenant* setting: concatenated
   SQL plus shared hard-coded root credentials means a single injected string can traverse every
   organisation's data. The severity is contextual, not local — judgment about tenant blast radius is
   what elevates this from "style nit" to "ship-blocker."
