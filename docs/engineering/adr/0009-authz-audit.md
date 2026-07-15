# ADR 0009: AuthZ matrix enforcement + AuditEvent store

## Status
**Proposed** — 2026-07-15  
**Sprint gate:** Required before/at Sprint 3 implementation (see [SPRINT_3_PLAN.md](../SPRINT_3_PLAN.md))  
**Owners:** Security Engineer · Backend Lead · Product Manager (matrix content) · CTO (architecture concurrence)

## Context

Sprint 1 shipped fail-closed RBAC hooks (`assertPermission` → `RBAC_NOT_READY`).  
Sprint 2 populated AuthContext from Membership and enforced **Organization** isolation, without capability enforcement.  
Sprint 3 (Execution Plan) must turn on **deny-by-default AuthZ** and durable **AuditEvent** writers (#21), without conflating audit with Sprint 2 `domain_events` (outbox remains Sprint 4).

Product Constitution owns RBAC intent; that matrix is not yet persisted under `docs/`. Role keys are already frozen in `CONSTITUTION_ROLE_KEYS`.

## Options

### AuthZ evaluation

1. **Server-side Constitution matrix** — pure `can(role, permission, context)` + route `assertPermission` (recommended)  
2. Client/UI-only role gating (rejected — Constitution requires server enforcement)  
3. Per-route ad-hoc role string compares (rejected — non-deny-by-default drift)

### Audit storage

1. **Dedicated `audit_events` table** in the SQL platform store (recommended)  
2. Reuse `domain_events` with a type flag (rejected — different consumers/retention/semantics; outbox later)  
3. External-only logging without durable rows (rejected — #21 / compliance trail)

## Decision (pending acceptance)

**Pending plan approval.** Intended decision on Accept:

1. Enforce AuthZ via Constitution capability matrix evaluated only on the server; deny-by-default for unknown permissions and missing tenant/membership context.  
2. Persist AuditEvent rows in a new `audit_events` migration on the ADR 0008 SQL store.  
3. Publish the authoritative role→permission matrix in this ADR appendix **or** a linked doc under `docs/engineering/` ratified by Product Manager — no invented product rules in code review.

### Non-goals

- CSRF (#19), auth rate limiting (#20), session idle/revoke-all (#22)  
- Outbox / workers (Sprint 4)  
- Audit product UI / Settings screens  
- Changing session cookie contract (ADR 0002)

## Consequences (when Accepted)

- `RBAC_NOT_READY` removed from production authorization path  
- Tenancy and Identity privileged routes call `assertPermission`  
- Login success/failure and authz denials write AuditEvents  
- Isolation suite expands with AuthZ cases  
- Open ADRs index marks 0009 Accepted

## Appendix — Matrix placeholder

*Do not implement from this placeholder. Replace with Product Constitution content on Accept.*

| Permission (draft keys) | Notes |
|---|---|
| `users.invite` | Existing probe string |
| `organizations.create` / `organizations.read` | Tenancy admin |
| `locations.create` / `locations.read` | Tenancy admin |
| `workspaces.create` / `workspaces.read` | Tenancy admin |
| `memberships.assign` / `memberships.read` | Tenancy admin |

Role grants: **TBD — Product Manager**.
