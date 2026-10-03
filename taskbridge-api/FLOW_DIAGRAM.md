# TaskBridge — Application Flow Diagrams

> A visual walkthrough of how TaskBridge works, from the big picture down to request-level flows.
> Diagrams use [Mermaid](https://mermaid.js.org/), which renders natively on GitHub and in VS Code's
> Markdown preview.

---

## 1. System overview — two services, one contract

```mermaid
flowchart LR
    Client([Client / API consumer])

    subgraph PS[Project Service]
        PC[Controller / Routes]
        PSV[Service<br/>tenant isolation + validation]
        PR[Repository]
        PM[(Prisma: Project)]
        PC --> PSV --> PR --> PM
    end

    subgraph NAS[Notification & Audit Service]
        NSV[Service<br/>immutable audit + fan-out]
        NR[Repository]
        AM[(Prisma: AuditEntry - immutable)]
        NM[(Prisma: Notification)]
        NSV --> NR --> AM
        NR --> NM
    end

    Client -->|HTTP| PC
    PSV -->|AuditNotificationPort| ADP[NotificationAuditAdapter]
    ADP --> NSV

    classDef store fill:#eef,stroke:#669;
    class PM,AM,NM store;
```

**Key idea:** the Project Service never imports the other service directly — it depends only on the
`AuditNotificationPort` interface, which `NotificationAuditAdapter` implements. This keeps the two
services decoupled and independently deployable.

---

## 2. Layered architecture (same in both services)

```mermaid
flowchart TD
    A[Inbound HTTP request] --> B[Controller / Route<br/>parse, validate input, capture edge data IP, map errors]
    B --> C[Service<br/>business logic, tenant isolation, invariants, side effects]
    C --> D[Repository<br/>the only DB-aware layer, parameterised + org-scoped]
    D --> E[(Model / Prisma<br/>persistence)]

    note[Rule: a layer only talks to its direct neighbour.<br/>No controller touches a repository directly.]
    B -.-> note
```

---

## 3. Milestone change flow (create / update-status / delete / reopen)

This is the core cross-service flow: every milestone change produces an **audit entry** plus
**notifications** to all team members.

```mermaid
sequenceDiagram
    actor User
    participant PC as Project Controller
    participant PSV as Project Service
    participant PR as Project Repository
    participant Port as AuditNotificationPort
    participant NSV as Notification & Audit Service
    participant NR as Notification Repository

    User->>PC: PATCH /projects/:id/status
    PC->>PC: authenticate (userId + organisationId)
    PC->>PSV: updateStatus(principal, id, body)
    PSV->>PSV: validate (Zod) + enforce tenant scope
    PSV->>PR: findByIdForOrg(orgId, id)
    PR-->>PSV: existing project (or null → 404)
    PSV->>PR: updateStatus(id, status)
    PR-->>PSV: updated project
    PSV->>Port: recordMilestoneChange(before, after, actor)
    Port->>NSV: recordMilestoneChange(...)
    NSV->>NR: createAudit(entry)  %% append-only
    NSV->>NR: createNotification(...) for each team member
    NR-->>NSV: ok
    NSV-->>PSV: done
    PSV-->>PC: updated project
    PC-->>User: 200 OK
```

---

## 4. Audit immutability (why there is no update/delete)

```mermaid
flowchart LR
    W[Milestone change] --> C[createAudit - append only]
    C --> S[(AuditEntry store)]

    X[Attempt to update/delete audit] --> G{Service-layer guard}
    G -->|always| T[throw ForbiddenError]

    S -. no update/delete method exists .-> R[Repository]

    classDef bad fill:#fee,stroke:#c33;
    class X,T bad;
```

**Two defences:** (1) the repository exposes **no** update/delete method for audit entries, and
(2) an explicit service-layer guard throws on any modification attempt — so immutability is provable
by a test, not just implied.

---

## 5. Multi-tenant isolation (audit read example)

```mermaid
flowchart TD
    Req[GET /audit/:projectId<br/>caller org = ORG_B] --> SVC[Notification & Audit Service]
    SVC --> REPO[Repository query<br/>WHERE entityId = projectId AND actorOrgId = caller org]
    REPO --> Q{Entry's org == caller's org?}
    Q -->|ORG_A entry, caller ORG_B| N[Excluded → not returned]
    Q -->|ORG_B entry| Y[Returned]

    classDef deny fill:#fee,stroke:#c33;
    class N deny;
```

Every data access is scoped by `organisationId`. A caller from one organisation can never see
another organisation's audit entries — enforced in the service/repository, verified by test #6.

---

## 6. The four Notification & Audit endpoints

```mermaid
flowchart LR
    subgraph Endpoints
        E1[POST /audit<br/>internal: record an event]
        E2[GET /audit/:projectId<br/>filters: from, to, eventType]
        E3[GET /notifications/:userId<br/>unread only]
        E4[PATCH /notifications/:id/read<br/>mark read]
    end

    E1 --> SVC[NotificationService]
    E2 --> SVC
    E3 --> SVC
    E4 --> SVC
    SVC --> DB[(Audit + Notification stores)]
```

---

## Quick legend

| Symbol | Meaning |
|--------|---------|
| Rounded box | Actor / external client |
| Rectangle | Code layer (controller / service / repository / adapter) |
| Cylinder `[( )]` | Persistent store (Prisma model) |
| Red fill | A blocked / rejected path (immutability or tenant denial) |
