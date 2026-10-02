# TOOL_STRATEGY.md — Copilot Tool Strategy

## Feature Usage Log (≥6 entries across ≥4 features)

| # | Where (task) | Copilot Feature | Why this feature (not another) | What happened |
|---|--------------|-----------------|--------------------------------|---------------|
| 1 | Generate the raw Project Service baseline | Copilot Chat — **Ask mode** | A single conversational prompt was enough to produce the deliberately low-effort output; no multi-file edit needed. | Produced sloppy single-file JS with SQL injection and no tenancy — exactly the "contractor code" baseline. |
| 2 | Review the raw service | **Ask mode + `/explain`** | `/explain` isolates a suspicious block and narrates its behaviour, faster than reading line-by-line. | Surfaced the broken async control flow in `create`/`getByTeam`. |
| 3 | Compare the output to our standards | **`@workspace`** | Needs cross-file context (the standards file) that a single-file prompt lacks. | Flagged the wrong stack and missing layering against copilot-instructions.md. |
| 4 | Scaffold the remediated layered files | **Agent/Edit mode + `#file`** | Multi-file, consistent structure; `#file` anchors generation to the existing repository pattern. | Generated model/repository/service/controller skeletons matching the established style. |
| 5 | Add the immutability guard + docstrings | **Inline Chat + `/doc`** | Targeted, in-place method edits without leaving the editor. | Added the `modifyAuditEntry` guard and public-method docstrings. |
| 6 | Harden a specific method | **`/fix`** | Applies a focused fix to flagged code quickly. | Tightened error handling / return types on service methods. |
| 7 | Scope the mid-sprint change | **Ask mode** | Decomposition question better suited to a chat answer than an edit. | Produced the file-impact checklist that seeded IMPACT_ANALYSIS.md. |

## Scenario Responses

1. **Understand a complex 500-line function before modifying it** — *Copilot Chat `/explain` with
   `#file`.* It summarises control flow, inputs/outputs, and side effects in place, so I can build a
   mental model before touching anything. `@workspace` adds cross-file callers when the function is
   widely used.
2. **Add consistent error handling across 8 existing route handlers** — *Edit/Agent mode with
   `#file`.* A single multi-file instruction applies the same typed-error pattern uniformly, which is
   faster and more consistent than editing each handler by hand or via separate inline prompts.
3. **Quickly check a regex handles edge cases** — *Inline Chat.* I select the pattern and ask for
   edge cases and counter-examples right where the code lives; it's a fast, local question that
   doesn't need workspace context.
4. **Automated code-quality checks on every PR with no human intervention** — *Copilot is the wrong
   tool; use CI (GitHub Actions) with lint + coverage gates.* Copilot assists authoring the workflow
   YAML, but enforcement must be a required status check, not an interactive assistant.
5. **Review a teammate's AI-generated authentication module for security vulns** — *Ask mode review +
   `/explain` on auth-critical blocks.* I ask Copilot to enumerate risks (token expiry, signature
   verification, timing), then manually validate — Copilot narrows the search but the human makes the
   security call.
6. **Make Copilot follow project naming conventions + architecture across all devs/sessions** —
   *`.github/copilot-instructions.md`.* A committed instructions file grounds every contributor's
   Copilot with the same stack, layering, and security rules, giving consistent output across sessions.

## Limitations Encountered (3 real situations from this case study)

| # | What I did | What Copilot produced | How I detected it | How I fixed it | What I'd do differently |
|---|-----------|------------------------|-------------------|----------------|-------------------------|
| 1 | Asked it to build the audit service | Included `updateAudit`/`deleteAudit` "admin correction" methods | Code review against the immutability requirement; the test for immutability made it explicit | Removed those paths; added a service-layer guard that always throws + a test | State the immutability invariant in the prompt up front, not after generation |
| 2 | Added IP capture for the mid-sprint change | Added `logger.info('audit', { ip })`, logging PII | Caught during review knowing IP is PII and our logger forbids PII | Removed the log; IP is persisted in the audit store only | Pre-declare "never log PII" as a constraint in the change prompt |
| 3 | Ran `prisma generate` to wire the real client | N/A — tooling, not Copilot code | `prisma generate` failed with TLS "unable to get local issuer certificate" (corporate proxy) | Kept tests on in-memory doubles so the suite runs without the generated client; flagged as a known gap | Configure the corporate CA / `NODE_EXTRA_CA_CERTS` before relying on Prisma engine downloads |
