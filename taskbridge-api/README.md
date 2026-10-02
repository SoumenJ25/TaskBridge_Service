# TaskBridge API

TaskBridge is a **multi-tenant B2B SaaS** platform that helps organisations coordinate project
milestones across teams. This repository contains the backend API, composed of two cooperating
services:

- **Project Service** — owns projects and their milestones (create, update status, query by team, delete).
- **Notification & Audit Service** — records an **immutable audit trail** of every milestone change
  and fans out **notifications** to the relevant team members.

## Tech Stack

| Concern            | Choice                                  |
| ------------------ | --------------------------------------- |
| Language           | TypeScript                              |
| Runtime            | Node.js                                 |
| Web framework      | Express                                 |
| ORM / data access  | Prisma (no raw DB driver)               |
| Validation         | Zod (typed request/response contracts)  |
| Testing            | Jest (+ Supertest for HTTP)             |
| Linting            | ESLint                                  |

## Architecture

The codebase uses a strict **layered architecture** in every service:

```
route / controller  →  service (business logic)  →  repository (data access)  →  model (Prisma)
```

- **Model** — Prisma schema types; the only layer that knows the database shape.
- **Repository** — all data access; the only layer that imports the Prisma client.
- **Service** — business logic only; no SQL, no Prisma imports. Enforces invariants such as
  multi-tenant isolation and audit immutability.
- **Controller / route** — HTTP concerns only: parse, validate, delegate, map errors to responses.

### Why this suits multi-tenant B2B SaaS

- **Tenant isolation** is enforced in one place (the service layer), so no route can accidentally
  leak another organisation's data.
- **Immutability** of the audit log is enforced in the service layer, independent of storage,
  so there is no update/delete code path to exploit.
- Clear seams make the two services independently testable and independently deployable.

## Project Structure

```
taskbridge-api/
├── .github/copilot-instructions.md   # team-wide Copilot standards
├── src/
│   ├── projects/                     # Project Service (model, repository, service, controller)
│   └── notifications/                # Notification & Audit Service
├── tests/                            # Jest test suite
├── SPEC.md                           # data models + API contracts
├── REVIEW.md                         # Project Service review findings
├── IMPACT_ANALYSIS.md                # mid-sprint change analysis
├── PROMPTS.md                        # live Copilot prompt log
├── PR_DESCRIPTION.md
├── TOOL_STRATEGY.md
├── ARCHITECTURE.md
└── package.json
```

## Getting Started

```bash
npm install
npx prisma generate
npm run dev        # start the API in watch mode
npm test           # run the Jest test suite
```

## Security Posture (summary)

- All endpoints are authenticated; the authenticated principal carries a `userId` and `organisationId`.
- Every query is scoped to the caller's `organisationId` — cross-tenant access is rejected.
- The audit log is append-only; there is no update or delete path at any layer.
- See [.github/copilot-instructions.md](.github/copilot-instructions.md) for the full coding and
  security standards that all contributors (and their Copilot sessions) must follow.
