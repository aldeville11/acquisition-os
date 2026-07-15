# Audit API notes (Sprint 3)

**Owner:** Security Engineer · Backend Lead  
**ADR:** [0009-authz-audit.md](./adr/0009-authz-audit.md)  
**Vocabulary:** [RBAC_VOCABULARY.md](./RBAC_VOCABULARY.md)

## Purpose

Durable **AuditEvent** foundation for security-relevant outcomes.  
**Not** reporting, analytics, or product Audit UI.

Separate from Sprint 2 `domain_events` (integration facts; outbox remains Sprint 4).

## Persistence

Table `audit_events` (migration `002_sprint3_audit`) on the ADR 0008 SQL store.

| Column | Notes |
|---|---|
| `action` | e.g. `login`, `permission.denied`, `organization.created` |
| `actor_user_id` | Nullable (failed login) |
| `organization_id` / `workspace_id` | Tenant/workspace context when known |
| `permission` | Set for AuthZ grant/deny |
| `outcome` | `success` \| `failure` |
| `metadata_json` | Small structured extras |

## Actions (Sprint 3)

- `login` / `logout`
- `organization.created` / `organization.updated`
- `workspace.created` / `workspace.updated`
- `membership.assigned` / `membership.revoked`
- `permission.granted` / `permission.denied`

## API

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/organizations/:organizationId/audit-events` | `audit.read` |

Returns append-order events for the tenant. No aggregation.
