# SPEC.md — TaskBridge API Specification

> Scope: data models, API contracts, integration points, and constraints for the **Project Service**
> and the **Notification & Audit Service**. Annotations mark where Copilot drafted content versus
> where human judgment corrected or completed it.

---

## 1. Conventions

- All timestamps are ISO-8601 UTC.
- Every authenticated request carries a principal: `{ userId: string; organisationId: string }`.
- All data access is **scoped by `organisationId`** (multi-tenant isolation).
- IDs are UUID strings.

---

## 2. Data models

### 2.1 Project (Project Service)

| Field            | Type                                             | Notes                                  |
| ---------------- | ------------------------------------------------ | -------------------------------------- |
| `id`             | `string` (UUID)                                  | Primary key                            |
| `organisationId` | `string` (UUID)                                  | Tenant owner; all queries scoped by it |
| `teamId`         | `string` (UUID)                                  | Owning team                            |
| `name`           | `string`                                         | Required, 1–200 chars                  |
| `status`         | `enum: PLANNED \| ACTIVE \| BLOCKED \| DONE`     | Milestone/project status               |
| `createdAt`      | `string` (ISO-8601)                              | Set on create                          |
| `updatedAt`      | `string` (ISO-8601)                              | Set on each mutation                   |

> *Human-added:* `organisationId` and `teamId` — the low-effort prompt omits tenancy entirely.

### 2.2 AuditEntry (Notification & Audit Service) — IMMUTABLE

| Field            | Type                               | Notes                                            |
| ---------------- | ---------------------------------- | ------------------------------------------------ |
| `id`             | `string` (UUID)                    | Primary key                                      |
| `eventType`      | `enum: MILESTONE_CREATED \| MILESTONE_STATUS_UPDATED \| MILESTONE_DELETED` | Extended in Phase 3 impact analysis |
| `entityType`     | `string`                           | e.g. `"Project"`                                 |
| `entityId`       | `string` (UUID)                    | The affected entity                              |
| `actorUserId`    | `string` (UUID)                    | Who performed the action                         |
| `actorOrgId`     | `string` (UUID)                    | Actor's organisation; scopes audit reads         |
| `previousState`  | `json \| null`                     | Snapshot before change (null on create)          |
| `newState`       | `json \| null`                     | Snapshot after change (null on delete)           |
| `createdAt`      | `string` (ISO-8601)                | Append-only; never updated                       |

> **Immutability:** no `update`/`delete` operation is exposed at any layer. Enforced in the service.

### 2.3 Notification (Notification & Audit Service)

| Field            | Type                   | Notes                               |
| ---------------- | ---------------------- | ----------------------------------- |
| `id`             | `string` (UUID)        | Primary key                         |
| `recipientUserId`| `string` (UUID)        | Target user                         |
| `eventType`      | `string` (enum as above) | What happened                     |
| `projectId`     | `string` (UUID)        | Related project                     |
| `message`        | `string`               | Human-readable summary              |
| `read`           | `boolean`              | Default `false`                     |
| `createdAt`      | `string` (ISO-8601)    | Set on create                       |

---

## 3. API contracts

### Project Service

#### `POST /projects`
- Request: `{ teamId: string; name: string }`
- Response `201`: `Project`
- Errors: `400` validation, `401` unauthenticated.

#### `PATCH /projects/:id/status`
- Request: `{ status: 'PLANNED' | 'ACTIVE' | 'BLOCKED' | 'DONE' }`
- Response `200`: `Project`
- Errors: `400`, `401`, `404` (not found or not in caller's org).

#### `GET /projects?teamId=...`
- Response `200`: `Project[]` (only the caller's organisation).
- Errors: `401`.

#### `DELETE /projects/:id`
- Response `204`.
- Errors: `401`, `404` (not found or not in caller's org).

> Each mutation triggers an audit write + notification fan-out via the Notification & Audit Service.

### Notification & Audit Service

#### `POST /audit` (internal)
- Request: `{ eventType, entityType, entityId, actorUserId, actorOrgId, previousState, newState }`
- Response `201`: `AuditEntry`.
- Errors: `400`, `401`.

#### `GET /audit/:projectId`
- Query: `from?` (ISO), `to?` (ISO), `eventType?`.
- Response `200`: `AuditEntry[]` — **only** entries whose `actorOrgId` matches the caller's org.
- Errors: `401`, `403` (cross-tenant).

#### `GET /notifications/:userId`
- Response `200`: unread `Notification[]` for that user (within caller's org).
- Errors: `401`, `403`.

#### `PATCH /notifications/:id/read`
- Response `200`: updated `Notification`.
- Errors: `401`, `403`, `404`.

---

## 4. Integration points (Project ↔ Notification & Audit)

- On `create` / `update-status` / `delete`, the Project Service calls the Notification & Audit
  Service's `POST /audit` (or its service API in-process) with before/after snapshots.
- The Notification & Audit Service then creates one audit entry and fans out notifications to all
  team members of the affected project.
- Contract is the `POST /audit` request shape in §3. Both services agree on the `eventType` enum.

---

## 5. Constraints

- **Immutability:** audit entries cannot be updated or deleted (service-layer enforced + tested).
- **Authorisation:** all reads/writes scoped by `organisationId`; cross-tenant access rejected.
- **Validation:** all inbound payloads validated with Zod before the service layer.
- **No raw DB:** Prisma only; repositories are the sole database-aware layer.

---

## 6. Copilot annotation

- *Copilot drafted:* initial table scaffolding for the three models and the boilerplate endpoint list.
- *Human corrected/completed:* added `organisationId`/`actorOrgId` tenancy fields, the immutability
  constraint on `AuditEntry`, cross-tenant `403` behaviours, the integration contract in §4, and the
  explicit validation/no-raw-DB constraints — none of which the low-effort prompt implies.
