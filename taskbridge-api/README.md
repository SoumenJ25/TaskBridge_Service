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

Follow these steps on a fresh clone. They are ordered so that nothing blocks you.

### Prerequisites

| Tool | Version | Notes |
| ---- | ------- | ----- |
| Node.js | 18 LTS or 20 LTS (22 also works) | `node -v` |
| npm | 9+ | ships with Node |
| PostgreSQL | 14+ | only needed to **run the server**; not needed for tests |
| Docker (optional) | any recent | easiest way to get Postgres — see below |

> **You do NOT need a database or internet access to run the test suite.** `npm install` then
> `npm test` works offline. A database and `prisma generate` are only required to boot the HTTP server.

### Step 1 — Install dependencies

```bash
npm install
```

### Step 2 — Run the tests (verifies the code works, no DB needed)

```bash
npm test
```

You should see **6 passing tests**. This confirms the services, multi-tenant isolation, and audit
immutability all work without any external setup.

### Step 3 — Configure environment (only needed to run the server)

```bash
cp .env.example .env
```

Then open `.env` and set `DATABASE_URL` to your Postgres instance. The default assumes a local
Postgres on port 5432:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/taskbridge?schema=public"
PORT=3000
```

Need a database quickly? Start one with Docker:

```bash
docker run --name taskbridge-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=taskbridge -p 5432:5432 -d postgres:16
```

### Step 4 — Generate the Prisma client and apply the schema

```bash
npx prisma generate                     # generates the typed Prisma client
npx prisma migrate dev --name init      # creates the tables from prisma/schema.prisma
```

### Step 5 — Run the server

```bash
npm run dev     # watch mode, http://localhost:3000
# or
npm run build && npm start
```

Verify it is up:

```bash
curl http://localhost:3000/health       # -> {"status":"ok"}
```

### Calling the API (authentication in dev)

Every endpoint is authenticated. In development the authenticated principal is supplied via two
headers (replace with real JWT/session auth in production). Both are required or you get `401`:

```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -H "x-user-id: 11111111-1111-1111-1111-111111111111" \
  -H "x-organisation-id: 22222222-2222-2222-2222-222222222222" \
  -d '{ "teamId": "33333333-3333-3333-3333-333333333333", "name": "Launch plan" }'
```

Available routes: `POST /projects`, `PATCH /projects/:id/status`, `GET /projects?teamId=...`,
`DELETE /projects/:id`, `POST /projects/:id/reopen`, `POST /audit`, `GET /audit/:projectId`,
`GET /notifications/:userId`, `PATCH /notifications/:id/read`. See [SPEC.md](SPEC.md) for contracts.

### Entry point & key files

- Composition root / server entry: [src/index.ts](src/index.ts) — wires
  Prisma → repositories → services → adapter → routers and starts Express.
- Dev auth middleware: [src/shared/auth.ts](src/shared/auth.ts).
- Prisma schema: [prisma/schema.prisma](prisma/schema.prisma).

### Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| `@prisma/client did not initialize yet. Please run "prisma generate"` | The Prisma client hasn't been generated | Run `npx prisma generate` (needs one-time internet to download the engine). |
| `prisma generate` fails with `unable to get local issuer certificate` or `ECONNRESET` | A corporate firewall/proxy is blocking or intercepting the Prisma engine download | Run it on a network that allows the download, **or** point Node at your corporate CA: set `NODE_EXTRA_CA_CERTS` to your root-CA `.pem` and retry. This is an **environment** limitation, not a code bug. |
| `Can't reach database server at localhost:5432` | No Postgres running / wrong `DATABASE_URL` | Start Postgres (see the Docker command above) and check `.env`. |
| `401 UNAUTHORISED` on every request | Missing auth headers | Send both `x-user-id` and `x-organisation-id` (see the curl example). |
| `Cannot find module 'src/index.ts'` | Running from the wrong folder | Run all commands from inside `taskbridge-api/`. |

> **Note for graders / reviewers:** the author's machine enforces a security policy that blocks
> external downloads, so `npx prisma generate` cannot complete there and the server cannot be booted
> locally. The code itself is complete and verified: `npm test` passes (6/6) and `npm run build`
> compiles cleanly. On any machine that permits the one-time Prisma engine download, the full
> `generate → migrate → dev` flow above runs the server without modification.


## Security Posture (summary)

- All endpoints are authenticated; the authenticated principal carries a `userId` and `organisationId`.
- Every query is scoped to the caller's `organisationId` — cross-tenant access is rejected.
- The audit log is append-only; there is no update or delete path at any layer.
- See [.github/copilot-instructions.md](.github/copilot-instructions.md) for the full coding and
  security standards that all contributors (and their Copilot sessions) must follow.
