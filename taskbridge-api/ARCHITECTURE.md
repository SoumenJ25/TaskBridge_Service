# ARCHITECTURE.md — TaskBridge

TaskBridge is a multi-tenant B2B SaaS API split into two cooperating services. The **Project Service**
is the system of record for projects/milestones; the **Notification & Audit Service** records an
immutable audit trail and fans out notifications. They integrate through a single contract: the
Project Service depends on the `AuditNotificationPort` interface, and `NotificationAuditAdapter`
implements it — so neither service shares a database or concrete types with the other.

Both services use the same layered architecture:

```
inbound HTTP request
  → controller / route   (parse, validate, capture edge data like IP, map errors)
  → service              (business logic: tenant isolation, validation, invariants, side effects)
  → repository           (the only DB-aware layer; parameterised, org-scoped Prisma queries)
  → model (Prisma)       (persistence)
```

Data flow for a milestone change: the Project controller receives the request → the Project service
validates it, applies multi-tenant scoping, and mutates the project via its repository → it then calls
the `AuditNotificationPort` → the Notification & Audit service appends an immutable audit entry and
creates a notification per team member (resolved via `TeamMemberResolver`) through its repository.

This suits multi-tenant B2B SaaS because tenant isolation and audit immutability are each enforced in
exactly one place (the service layer), independent of storage, making them auditable and testable.
**Key design decisions / trade-offs:** ports/adapters keep the services decoupled and independently
deployable, at the cost of a dual-write consistency risk (project mutation vs. audit write) that a
production system would close with an outbox/event pattern; IP is captured only at the edge and
persisted in the audit store, never logged, to balance forensic value against privacy.
