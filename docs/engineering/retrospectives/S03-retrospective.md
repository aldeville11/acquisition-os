# Sprint 03 — Retrospective

**Sprint:** 03 — authz-audit  
**Dates:** 2026-10-16 to 2026-10-17  
**Status:** Pre-merge — Sprint OPEN  
**Facilitator:** Engineering Manager / CTO  

## What went well

- A single catalog now drives all current server-side permission decisions for the frozen nine-role vocabulary.
- Route enforcement retained the existing Organization boundary and the permanent Tenant Isolation Suite remained unchanged and green.
- Denials, invites, login, and logout are recorded through the existing append-only `domain_events` path.
- The audit read surface is organization-scoped from AuthContext and is limited to owner and administrator.
- Incremental Stage 1–3 verification kept the final API suite at 36 passing tests plus nine isolation tests.

## What slowed us down

- The builder seat failed over from Claude to Codex mid-sprint after the Claude usage limit was reached; the handoff required evidence and scope revalidation.
- The ambient Node 24 runtime violated the repository's `engines.node` constraint (`<23`). Verification was rerun successfully with the brief's Node 22 runtime.
- Product Constitution and Engineering Architecture documents do not exist in this repository. Pre-sprint qualification recorded the limitation and reviewed the available Engineering Constitution, laws, playbook, organization docs, ADRs, and prior sprint artifacts instead.

## Unexpected discoveries

- The existing `domain_events` storage and natural authentication service points supported the required audit trail without a new table or auth restructuring.
- Location creation must fail for non-empty `locationScope`, because a new location cannot already be within the caller's scope.

## Architecture concerns

- AuthContext still selects the latest active Membership rather than an explicit user-selected workspace.
- Owner and administrator both receive the full per-merchant catalog; the convention should be revisited if a separate platform-administrator boundary is introduced.
- Domain events still have no durable outbox publisher; that remains the Sprint 4 direction identified in the Sprint 2 retrospective.

## Technical debt introduced

| Item | Tracking | Paydown |
|---|---|---|
| Latest-active-Membership AuthContext selection | Sprint memory / SECURITY.md | Explicit workspace or membership selector |
| Owner/administrator operations-admin convention | Sprint memory / SECURITY.md | Separate platform vs merchant administration when required |
| No async outbox publisher | ADR 0003 / Sprint 4 | Outbox/publisher sprint |

Existing #19 CSRF and #20 rate-limit debt remain OPEN by explicit not-in-sprint scope decisions for the CTO. #21 AuditEvent is resolved. #22 session idle/revoke-all remains open.

## Engineering lessons

- Authorization checks belong at every protected route while repository tenant contexts remain a separate required boundary.
- Carrying the attempted permission on denial errors makes consistent audit records possible without changing public error shapes.
- Runtime qualification should precede full verification to avoid false implementation failures.

## Product lessons

- An effective-permissions probe provides an inspectable contract without adding a role-management UI.
- A narrow audit read surface satisfies current operational review needs without pulling outbox, reporting, or audit UI work into Sprint 3.

## Documentation improvements

- AUTH.md now documents the catalog, role grants, route map, location scope, and audit surface.
- ADR 0009 records the permission model and D3–D6 decisions.
- Security debt now distinguishes resolved #21 from open #19, #20, and #22.

## Recommended process improvements

- Add an early engine-version check to every staged run sheet.
- Persist the missing Product Constitution and Engineering Architecture documents in this repository before relying on them as required reads.
- Preserve stage reports alongside sprint memory or link them from a durable review artifact.

## Risks for next sprint

| Risk | Mitigation |
|---|---|
| Publishing domain events without durable delivery semantics | Resolve ADR 0003 and implement an idempotent outbox/publisher in Sprint 4 |
| Confusing merchant administrator with future platform administrator | Keep v1 convention documented; create a boundary decision before platform-admin features |
| Ambiguous multi-membership selection | Do not add cross-workspace features until selection semantics are explicit |
| Regression in tenant boundaries during worker work | Keep the Tenant Isolation Suite mandatory in CI |

## Actions to carry forward

| Action | Owner |
|---|---|
| Sprint 4 outbox/publisher planning and ADR 0003 decision | Platform Engineer · CTO |
| Decide scope/timing for #19 CSRF and #20 rate limiting | CTO · Security Engineer |
| Design explicit workspace selection before multi-membership UX | Product · Frontend · Backend |
| Persist missing product/architecture source documents | CTO · Product Manager |

## Scorecard

[`scorecards/S03-scorecard.md`](../scorecards/S03-scorecard.md)
