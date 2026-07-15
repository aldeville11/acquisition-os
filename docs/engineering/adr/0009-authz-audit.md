# ADR 0009: AuthZ matrix enforcement + AuditEvent store

## Status
**Accepted** — 2026-07-15  
**Sign-off:** Product Manager · CTO · Backend Lead · Security Engineer (Sprint 3 Plan approval + required amendment)

## Context

Sprint 1 shipped fail-closed RBAC hooks (`assertPermission` → `RBAC_NOT_READY`).  
Sprint 2 populated AuthContext from Membership and enforced Organization isolation without capability enforcement.  
Sprint 3 must enable **deny-by-default AuthZ** and durable **AuditEvent** writers without conflating audit with Sprint 2 `domain_events` (outbox remains Sprint 4).

Canonical role and permission vocabulary is locked in [`RBAC_VOCABULARY.md`](../RBAC_VOCABULARY.md). Implementations must not invent permission names.

## Decision

### Authorization architecture

1. **Server-side only.** UI checks are non-authoritative.  
2. **Vocabulary-driven matrix.** Role keys and permission strings come exclusively from `RBAC_VOCABULARY.md`.  
3. **`can(role, permission)`** pure evaluation + **`assertPermission(actor, permission, opts?)`** for route guards.  
4. **Deny-by-default:** unknown permission, unknown/null role (except bootstrap), missing membership for tenant-scoped actions ⇒ deny.  
5. **Tenant isolation remains first.** Cross-org requests fail before or alongside AuthZ; AuthZ never grants foreign-org access.  
6. **Bootstrap:** authenticated users with no Membership may `organizations.create` once to establish a tenant; thereafter matrix applies.  
7. **Location scope:** when non-empty on AuthContext, location-targeted actions outside scope are denied.

### Permission naming conventions

- Format: `resource.action` in lowercase with a single dot.  
- Resources and actions enumerated in RBAC Vocabulary only.  
- No ad-hoc strings in handlers (e.g. former probe `users.invite` is replaced by `identity.manage`).

### AuditEvent architecture

1. Dedicated **`audit_events`** table in the ADR 0008 SQL store — **not** `domain_events`.  
2. Append-only writers for security-relevant outcomes.  
3. Minimum event types (Sprint 3 foundation):

| `action` | When |
|---|---|
| `login` | Successful authentication |
| `logout` | Session revoke / logout |
| `organization.created` | Org create |
| `organization.updated` | Org update |
| `workspace.created` | Workspace create |
| `workspace.updated` | Workspace update |
| `membership.assigned` | Membership assign |
| `membership.revoked` | Membership revoke |
| `permission.granted` | Successful `assertPermission` (sampled/on protected routes) |
| `permission.denied` | Failed `assertPermission` |

4. Record shape (logical): `id`, `action`, `actor_user_id`, `organization_id`, `workspace_id`, `resource_type`, `resource_id`, `permission`, `outcome` (`success`|`failure`), `metadata_json`, `created_at`.  
5. **No** reporting, analytics, or Audit UI in Sprint 3 — persistence + read foundation only.

### Extension strategy

- New permissions/roles: amend `RBAC_VOCABULARY.md` + this ADR appendix; expand matrix tests; never silent grants.  
- New audit actions: add typed constants; keep append-only; do not overload `domain_events`.  
- Async fan-out / outbox consumers: **Sprint 4** (not this ADR).

## Non-goals

- CSRF (#19), auth rate limiting (#20), session idle/revoke-all (#22)  
- Outbox / workers (Sprint 4)  
- Audit product UI / reporting  
- Changing session cookie contract (ADR 0002)  
- Inventing permissions outside RBAC Vocabulary  

## Consequences

- `RBAC_NOT_READY` removed from production authorization path.  
- Tenancy + Identity privileged routes call `assertPermission` with Vocabulary permissions.  
- Isolation / Authorization suites mandatory in CI.  
- Version target **0.3.0** when Sprint 3 COMPLETE.

## Appendix — Role keys (stable)

`owner` · `administrator` · `manager` · `operator` · `viewer`

See [`RBAC_VOCABULARY.md`](../RBAC_VOCABULARY.md) for the full default mapping table.
