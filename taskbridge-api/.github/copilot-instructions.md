# TaskBridge — Copilot & Engineering Standards

> These instructions configure GitHub Copilot for **every** contributor and session on this
> repository. The goal is that any teammate's Copilot produces code that is consistent with
> TaskBridge's architecture and security rules without rework. Treat every rule here as binding.

## 1. Product context

TaskBridge is a **multi-tenant B2B SaaS** platform. Data belongs to an **organisation (tenant)**,
not just a user. Two services cooperate:

- **Project Service** — projects and milestones (create, update status, get by team, delete).
- **Notification & Audit Service** — immutable audit trail + notification fan-out for milestone changes.

## 2. Stack (do not substitute)

- Language: **TypeScript** (strict mode).
- Runtime: **Node.js**.
- Web: **Express**.
- Data access: **Prisma ORM only** — never a raw SQL driver, never hand-built query strings.
- Validation: **Zod** for all inbound payloads and typed response contracts.
- Tests: **Jest** (+ Supertest for HTTP-level tests).

## 3. Layered architecture (enforced in both services)

```
controller / route  →  service  →  repository  →  model (Prisma)
```

- **model** — Prisma types only.
- **repository** — the ONLY layer allowed to import `@prisma/client` / touch the database.
- **service** — business logic and invariants ONLY. No Prisma imports, no SQL, no `req`/`res`.
- **controller / route** — HTTP only: validate input, call a service, map results/errors to responses.

Never let a layer reach across its neighbour (e.g. a controller must not call a repository directly).

## 4. Coding standards

- **Naming:** `camelCase` for variables/functions, `PascalCase` for types/classes, `UPPER_SNAKE_CASE`
  for constants and enum values. Files are `kebab-case.ts`.
- **Types:** no `any`. Public functions have explicit parameter and return types. Prefer
  discriminated unions over boolean flags for state.
- **Contracts:** request and response shapes are explicit TypeScript types validated by Zod.
- **Error handling:** throw typed domain errors (e.g. `NotFoundError`, `ForbiddenError`,
  `ValidationError`); controllers map them to specific HTTP status codes. Never swallow errors or
  return a generic 500 for an expected condition.
- **Logging:** use structured logging (`{ level, message, context }`). Never log secrets, tokens,
  passwords, or full PII. Treat IP addresses as sensitive.
- **Docstrings:** every exported/public method has a docstring describing purpose, parameters,
  return value, thrown errors, and any tenancy/immutability guarantees.

## 5. Security rules (multi-tenant B2B SaaS)

- **Authentication:** every endpoint requires an authenticated principal carrying `userId` and
  `organisationId`. Reject unauthenticated requests with 401.
- **Authorisation / tenant isolation:** EVERY data access is scoped by `organisationId`. A user may
  only read or mutate resources belonging to their own organisation. Cross-tenant access returns 404
  or 403 — never leak existence of another tenant's data. This check lives in the service layer and
  must never be skipped "for convenience" in a controller or repository.
- **Data exposure:** never return another organisation's data, internal IDs of other tenants, or
  stack traces. Serialise explicit response DTOs, not raw Prisma rows.
- **Input validation:** validate and narrow all input with Zod before it reaches the service layer.
- **Audit immutability:** audit entries are **append-only**. There must be NO update or delete path
  for audit records at any layer. Enforce this in the service layer, not just via DB permissions.
- **PII / IP addresses:** capturing IP or other PII is a compliance decision (privacy, retention,
  exposure). Minimise, document, and never log it in plaintext application logs.

## 6. Testing expectations

- Use **Jest**; HTTP routes tested with **Supertest**.
- Every service method with business logic has unit tests, including the failure paths.
- Mandatory coverage themes: **multi-tenant isolation** (a user cannot reach another org's data) and
  **audit immutability** (no path updates/deletes an audit entry).
- Tests are deterministic and isolated; no reliance on external network or shared mutable state.

## 7. How to prompt Copilot on this repo

- Always state the **layer** you are editing and the **tenant-scoping** requirement.
- Ask for typed contracts and Zod validation explicitly.
- When generating a service method, remind Copilot: "business logic only, no Prisma import,
  scope by organisationId, throw typed errors."
- Review every generation against sections 3–6 before accepting.
