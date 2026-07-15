# Tenancy API notes (Sprint 2–3)

**Owner:** Backend Lead  
**Reviewers:** Security Engineer · Product Manager  
**ADRs:** [0005](./adr/0005-workspace-location.md) · [0008](./adr/0008-durable-sql-store.md) · [0009](./adr/0009-authz-audit.md)  
**AuthZ:** [RBAC_VOCABULARY.md](./RBAC_VOCABULARY.md)

## Surface (`/api/v1`)

| Method | Path | Permission |
|---|---|---|
| POST | `/organizations` | `organizations.create` (bootstrap if no membership) |
| GET | `/organizations/:organizationId` | `organizations.read` |
| PATCH | `/organizations/:organizationId` | `organizations.update` |
| POST | `/organizations/:organizationId/locations` | `locations.create` (+ activation bootstrap) |
| GET | `/organizations/:organizationId/locations/:locationId` | `locations.read` |
| POST | `/organizations/:organizationId/workspaces` | `workspaces.create` (+ activation bootstrap) |
| GET | `/organizations/:organizationId/workspaces/:workspaceId` | `workspaces.read` |
| PATCH | `/organizations/:organizationId/workspaces/:workspaceId` | `workspaces.update` |
| POST | `/organizations/:organizationId/memberships` | `memberships.manage` (+ activation bootstrap) |
| GET | `/organizations/:organizationId/memberships` | `memberships.read` |
| POST | `/organizations/:organizationId/memberships/:membershipId/revoke` | `memberships.manage` |
| GET | `/organizations/:organizationId/audit-events` | `audit.read` |

All mutating/admin paths require authenticated session (`aos_session`) **and** explicit AuthZ (deny-by-default).

## Tenant isolation

- Hard boundary: `organization_id`
- Repository methods require `TenantContext`
- Membership cannot reference foreign Workspace/Location
- Actors with Membership for Org A receive **403** on Org B paths
- Permanent suites: `tenant-isolation.suite.test.ts` + `authorization.suite.test.ts`

## Domain events (minimal)

Persisted to `domain_events` (no async publisher in S3):

- `organization.created`
- `location.created`
- `workspace.created`
- `membership.assigned`
- `membership.revoked`

## AuthContext

After active Membership, `/auth/me` and login populate `organizationId`, `workspaceId`, `role`, `locationScope`.  
**RBAC enforcement is live** (`assertPermission` / Vocabulary matrix).

## Persistence

```bash
export SESSION_PEPPER=...
# optional: export DATABASE_URL=postgresql://...
npm run migrate -w @acquisition-os/api
npm run dev -w @acquisition-os/api
```

Without `DATABASE_URL`, API boots with embedded PGlite (dev/test convenience; production must set Postgres).
