# _PROGRESS.md — Session State (gitignored scaffolding)

**Assessment:** TaskBridge SBA (GitHub Copilot, Practitioner Level)  
**Date Started:** October 3, 2026  

---

## Phase Tracking

| Phase | Title | Status | Capture + Write Status |
|-------|-------|--------|-------------------------|
| P1 | Scaffold + standards & spec | not-started | Awaiting SS-1.1, SS-1.2, WRITE 1A |
| P2 | Project Service (bad gen → review → remediate) | not-started | Awaiting SS-2.1, SS-2.2, WRITE 2A, SS-3.1, SS-3.2, Review Findings Table, WRITE 3A, SS-4.1, SS-4.2, WRITE 4A |
| P3 | Notification & Audit Service build | not-started | Awaiting SS-5.1, SS-5.2, SS-5.3, Prompt Engineering Table, WRITE 5A |
| P4 | Tests | not-started | Awaiting SS-5.4 |
| P5 | Docs & collaboration | not-started | Awaiting WRITE §6, WRITE §7, WRITE §8 |

---

## Key Decisions

- Domain locked to **TaskBridge** only; ignore fintech example naming.
- Stack confirmed: **Node.js + TypeScript + Express + Prisma + Jest**.
- Build location confirmed: **`taskbridge-api/`** inside the repository root.
- `PROMPTS.md` is a live deliverable and must be appended in real time.
- Phase 2a remains protected: raw generated Project Service must be saved unmodified before review/remediation.
- `_AGENT_BRIEF.md`, `_CAPTURE_GUIDE.md`, and `_PROGRESS.md` are scaffolding only and must stay gitignored.

---

## Open Questions / Blockers

- None. Awaiting SS-0 and explicit P1 go-ahead.

---

## Proposed Conventional Commit Sequence

1. **chore: scaffold standards workspace**
   - Create the required root structure and placeholder files for the assessment
   - Keep `src/projects/` empty through P2a per sequencing rule

2. **docs: define copilot standards and system spec**
   - Add `.github/copilot-instructions.md`, `README.md`, and `SPEC.md`
   - Record stack, architecture, security rules, and contracts

3. **docs: capture project service review findings**
   - Preserve the bad-generation review trail in `REVIEW.md`
   - Document security, architecture, and multi-tenant risks with fixes

4. **refactor: remediate project service architecture**
   - Implement the layered Project Service with ORM, validation, and tenancy controls
   - Separate repository, service, and controller responsibilities

5. **feat: build notification and audit service**
   - Add immutable audit flow, notification fan-out, endpoints, and impact analysis
   - Wire Project Service milestone events into audit and notification creation

6. **test: add required multi-tenant service coverage**
   - Add the six required test scenarios and verify passing results

7. **docs: finalize collaboration and architecture deliverables**
   - Complete `PROMPTS.md`, `PR_DESCRIPTION.md`, `TOOL_STRATEGY.md`, and `ARCHITECTURE.md`
   - Record AI usage, limitations, review simulation, and design trade-offs

---

## Exact Next Action for Resuming

1. User takes SS-0.
2. On explicit go-ahead, begin P1 only.

---

## Session Rules Confirmed

✅ Work only inside this repository  
✅ Domain locked to TaskBridge  
✅ `PROMPTS.md` stays live and is updated as prompts are actually used  
✅ Phase 2a raw output remains unreviewed until after `REVIEW.md`  
✅ `_AGENT_BRIEF.md`, `_CAPTURE_GUIDE.md`, and `_PROGRESS.md` are gitignored  

---

## P1 — COMPLETE (appended)

**Status:** done. Stack = Node.js + TypeScript + Express + Prisma + Jest. Build folder = `taskbridge-api/`.

**Work done:**
- Scaffolded §4 tree: `.github/`, `src/projects/` (empty placeholder only), `src/notifications/`, `tests/`.
- Authored `.github/copilot-instructions.md`, `README.md`, `SPEC.md`.
- Added tooling: `package.json`, `tsconfig.json`, `jest.config.js`.
- Seeded live `PROMPTS.md`; added empty placeholder docs (REVIEW, IMPACT_ANALYSIS, PR_DESCRIPTION, TOOL_STRATEGY, ARCHITECTURE).

**Key decisions:**
- `src/projects/` deliberately left empty until P2a per hard sequencing rule.
- Tenancy fields (`organisationId`, `actorOrgId`) and audit immutability baked into SPEC up front.

**Commits:**
- `chore: scaffold standards workspace` (a323d38)
- `docs: define copilot standards and system spec` (ed1f08c)

**Capture + write status:** SS-0, SS-1.1, SS-1.2 captured; WRITE 1A drafted by user. ✅

**Open TODOs:** none for P1.

**EXACT next action to resume:** On P2 go-ahead, begin P2a — user runs the exact low-effort prompt
("Generate a Project model and a Project service with create, update status, get by team, and delete
functions. Use a database.") and saves the RAW output unmodified into `src/projects/`. I must NOT
generate or fix that code. Then pause for SS-2.1 / SS-2.2 and WRITE 2A before any review.

---

## P2 — COMPLETE (appended)

**Capture waiver:** User cannot take screenshots. By user instruction, written deliverables carry
the evidence instead (prompt text, mode/feature, first impressions, detection method all recorded in
PROMPTS.md and REVIEW.md). SS-2.1, SS-2.2, SS-3.1, SS-3.2, SS-4.1, SS-4.2 are waived; their content
is covered textually.

**P2a (bad gen):** Raw sloppy `project.js` generated from the exact low-effort prompt and committed
UNMODIFIED to preserve the baseline (commit `2bf67ce`). Prompt + WRITE 2A logged in PROMPTS.md.

**P2b (review):** `REVIEW.md` written with an 11-row findings table + the named "Architectural &
Security Issues Copilot Introduced That Required Human Judgment" section (commit `d828d05`).

**P2c (remediation):** Layered TS + Prisma Project Service authored as separate files
(model/repository/service/controller) + shared errors/logger/principal + Prisma schema +
`AuditNotificationPort`. Raw `project.js` removed from tree (kept in history). Post-Generation
Corrections + WRITE 4A logged in PROMPTS.md (commit `ad72110`).

**Key decisions:**
- `AuditNotificationPort` interface defines the Project ↔ Notification/Audit integration contract;
  the concrete implementation is built in P3.
- Repository is the sole DB-aware layer; service holds tenancy + validation + audit side effects.

**Commits:** `2bf67ce` (raw), `d828d05` (review), `ad72110` (remediation).

**Open TODOs:** `npm install` + `prisma generate` not yet run (no node_modules); real compile/test
happens in P4. Project Service currently depends on the yet-to-be-built Notification & Audit Service.

**EXACT next action to resume:** On P3 go-ahead, build the Notification & Audit Service in
`src/notifications/` — immutable Audit model/repository/service (no update/delete path), Notification
model/repository/service, the four endpoints, the concrete `AuditNotificationPort` implementation,
and write `IMPACT_ANALYSIS.md` BEFORE coding the `MILESTONE_REOPENED` + IP-capture change.

---

## P3 — COMPLETE (appended)

**Capture waiver:** continues (user cannot screenshot). SS-5.1/5.2/5.3 content covered textually in
PROMPTS.md (prompt-engineering table, 5 prompts, 2+ modes, 3+ techniques, `#file`/`@workspace` shown).

**Work done:**
- Built Notification & Audit Service (`src/notifications/`): `notification.model.ts`,
  `notification.repository.ts` (no audit update/delete method), `notification.service.ts`
  (immutable guard, org-scoped history, fan-out via `TeamMemberResolver`), `notification.controller.ts`
  (4 endpoints), `notification-audit.adapter.ts` (implements `AuditNotificationPort`).
- Wrote `IMPACT_ANALYSIS.md` BEFORE the change, then implemented `MILESTONE_REOPENED` + actor IP
  capture at the HTTP edge (persisted only, never logged); reopen restricted to DONE milestones.
- Added `ProjectService.reopen()` + `POST /projects/:id/reopen` route.
- PROMPTS.md: prompt-engineering table (5 prompts) + WRITE 5A Post-Generation Corrections.

**Endpoints:** `POST /audit`, `GET /audit/:projectId` (from/to/eventType), `GET /notifications/:userId`
(unread), `PATCH /notifications/:id/read`.

**Key decisions:**
- Immutability enforced two ways: no repo update/delete for audit + explicit `modifyAuditEntry()` guard.
- Fan-out decoupled via `TeamMemberResolver` port (resolver impl is a P4 test double / later wiring).
- IP capture isolated to controllers; services receive it as plain data.

**Commit:** `84a3f5c` (feat: build notification and audit service).

**Open TODOs:** `npm install` still not run; team-member resolver has no production implementation yet
(test double in P4). Compile/test verification happens in P4.

**EXACT next action to resume:** On P4 go-ahead, add the ≥6 required Jest tests in `tests/` using
in-memory repository/resolver doubles: (1) equal notification dispatch to all team members,
(2) audit created on milestone update, (3) audit immutability enforced, (4) audit filtered by date
range, (5) audit filtered by event type, (6) cross-tenant audit access denied. Run `npm install` +
`npm test` and capture SS-5.4 (waived → results pasted textually). Then commit `test:`.

---

## P4 — COMPLETE (appended)

**Capture waiver:** continues. SS-5.4 covered textually by the pasted passing run below.

**Work done:**
- Added `tests/in-memory.ts` (in-memory Prisma + static team-resolver doubles; audit store is
  append-only to mirror production immutability).
- Added `tests/notification.service.test.ts` with the 6 required scenarios.
- Ran `npm install` (488 packages) and executed the suite.

**Test result (SS-5.4 equivalent):**
```
PASS tests/notification.service.test.ts
  Notification & Audit Service
    √ 1. dispatches a notification to every team member on a state change
    √ 2. creates a correct audit entry when a milestone is updated
    √ 3. enforces audit immutability (no update/delete path)
    √ 4. filters audit history by date range
    √ 5. filters audit history by event type
    √ 6. denies access to another organisation's audit log (multi-tenant isolation)
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

**Notes / known gaps:**
- `prisma generate` fails on this machine (TLS "unable to get local issuer certificate" when
  downloading the query engine) — a corporate-proxy/cert issue, not a code issue. Tests do not need
  the generated client (in-memory doubles), so the suite runs green regardless.
- Team-member resolver still has only a test double, no production implementation.

**Commit:** `<new>` (test: add required multi-tenant service coverage).

**EXACT next action to resume:** On P5 go-ahead, write the collaboration/docs deliverables (no code):
`PR_DESCRIPTION.md` (summary, AI Tool Disclosure, integration + contracts, testing + gaps, ≥1
risk/trade-off, self-review checklist, Peer Review Simulation with ≥1 AI-blind-spot comment + WRITE 6A),
`TOOL_STRATEGY.md` (≥6-entry feature usage log across ≥4 features, 6 scenario responses, ≥3
limitations), and `ARCHITECTURE.md` (10–15 lines). Then final `docs:` commit and push.

---

## P5 — COMPLETE (appended) — ASSESSMENT COMPLETE

**Capture waiver:** continues. P5 is written-only (no screenshots required by the guide).

**Work done:**
- `PR_DESCRIPTION.md`: summary, AI Tool Disclosure (~60/40 split, accept vs override), inter-service
  contracts, testing + gaps, dual-write risk/trade-off, self-review checklist, Peer Review Simulation
  (3 comments; #2 is the tenant-scoping AI blind spot) + WRITE 6A.
- `TOOL_STRATEGY.md`: 7-entry feature usage log across ≥4 features, 6 scenario responses, 3 real
  limitations (admin update/delete, IP logging, Prisma TLS failure).
- `ARCHITECTURE.md`: two-service port/adapter integration, layered data flow, fit for multi-tenant
  SaaS, trade-offs.
- `PROMPTS.md`: completed the prompt chain with the P4 test-generation prompt (6 prompts total).

**Commit:** `bc4a249` (docs: finalize collaboration and architecture deliverables).

**Final commit story (≥5 Conventional Commits, all with bodies):**
1. `chore: scaffold standards workspace`
2. `docs: define copilot standards and system spec`
3. `chore: add raw unreviewed project service`
4. `docs: capture project service review findings`
5. `refactor: remediate project service architecture`
6. `feat: build notification and audit service`
7. `test: add required multi-tenant service coverage`
8. `docs: finalize collaboration and architecture deliverables`

**Submission checklist — all present in `taskbridge-api/`:** README, copilot-instructions, SPEC,
REVIEW (+ Architectural & Security section), remediated Project Service (model/repo/service/controller),
Notification & Audit Service (model/service/controller), tests (6), IMPACT_ANALYSIS, PROMPTS
(+ Post-Generation Corrections), PR_DESCRIPTION (AI Disclosure + Peer Review), TOOL_STRATEGY, ARCHITECTURE.

**EXACT next action to resume:** Push `bc4a249` to origin (if not already). Assessment deliverables
complete; only the user's screenshot Word doc assembly remains (outside this repo).
