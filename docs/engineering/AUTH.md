# Authentication, authorization, and audit API notes (Sprint 1–3)

**Owner:** Backend Lead  
**Reviewers:** Security Engineer · Frontend Lead  
**ADRs:** [0002 Authentication](./adr/0002-authentication.md) · [0005 Workspace ↔ Location](./adr/0005-workspace-location.md) · [0009 Permission model](./adr/0009-permission-model.md)  
**Tenancy:** [TENANCY.md](./TENANCY.md)

## Surface and sessions

`apps/api` is a Hono modular-monolith API exposing Identity, Tenancy, and Audit under `/api/v1`.

Cookie sessions follow ADR 0002: cookie name `aos_session`, `HttpOnly`, `SameSite=Lax`, `Secure` in production, and a high-entropy token whose HMAC-SHA-256 hash is stored at rest. `SESSION_PEPPER` is required for the HMAC and must be supplied through the environment; it must not be committed or logged.

Login and `/auth/me` return a server-derived AuthContext:

```json
{
  "userId": "...",
  "organizationId": "...",
  "workspaceId": "...",
  "role": "owner",
  "locationScope": []
}
```

The tenancy fields come from the user's latest active Membership. Without one they are `null`, with `locationScope: []`. Membership and repository operations retain the hard Organization boundary described in [TENANCY.md](./TENANCY.md); authorization does not replace tenant isolation.

## Permission catalog

[`permission-catalog.ts`](../../apps/api/src/identity/permission-catalog.ts) is the server-side source of truth. Permission names use `resource.action` form.

| Permission | Roles granted |
|---|---|
| `auth.read` | All nine roles |
| `sessions.read` | All nine roles |
| `users.invite` | owner, executive, operations_manager, sales_manager, administrator |
| `organizations.create` | owner, administrator |
| `organizations.read` | All nine roles |
| `locations.create` | owner, operations_manager, administrator |
| `locations.read` | All nine roles |
| `workspaces.create` | owner, operations_manager, administrator |
| `workspaces.read` | All nine roles |
| `memberships.create` | owner, operations_manager, administrator |
| `memberships.read` | owner, executive, operations_manager, sales_manager, support, administrator |
| `audit.read` | owner, administrator |

The frozen role vocabulary is `owner`, `executive`, `operations_manager`, `csr`, `sales_manager`, `marketing`, `read_only`, `support`, and `administrator`. Owner and administrator receive the full current catalog. An absent or unknown role, or an unknown permission, receives no grant. A denied enforced request returns HTTP 403 with `FORBIDDEN` and does not perform the protected mutation.

`GET /api/v1/auth/rbac/probe` remains an authenticated effective-permissions surface. It requires `auth.read` and returns the caller's catalog-derived permissions and public AuthContext fields.

## Route enforcement

Public routes are limited to health checks and `POST /api/v1/auth/login`. The protected map is:

| Method and route | Required permission |
|---|---|
| `POST /api/v1/auth/logout` | `sessions.read` |
| `GET /api/v1/auth/me` | `auth.read` |
| `POST /api/v1/auth/invites` | `users.invite` |
| `GET /api/v1/auth/rbac/probe` | `auth.read` |
| `POST /api/v1/organizations` | `organizations.create` |
| `GET /api/v1/organizations/:organizationId` | `organizations.read` |
| `POST /api/v1/organizations/:organizationId/locations` | `locations.create` |
| `GET /api/v1/organizations/:organizationId/locations/:locationId` | `locations.read` |
| `POST /api/v1/organizations/:organizationId/workspaces` | `workspaces.create` |
| `GET /api/v1/organizations/:organizationId/workspaces/:workspaceId` | `workspaces.read` |
| `POST /api/v1/organizations/:organizationId/memberships` | `memberships.create` |
| `GET /api/v1/organizations/:organizationId/memberships` | `memberships.read` |
| `GET /api/v1/audit/events` | `audit.read` |

## Location scope

Per ADR 0005, empty `locationScope` means all locations in the Membership's Workspace. A non-empty scope constrains location reads and requires every location on a workspace create/read to be in scope. Location creation is denied for a non-empty scope because a new location cannot already be in it. Organization, membership, and Identity routes have no target-location association, so their catalog permission and Organization boundary apply without a location-scope check.

## Audit trail

Audit records reuse the append-only `domain_events` store. The current event catalog is:

- `organization.created`, `location.created`, `workspace.created`, `membership.assigned`, and `membership.revoked`
- `permission.denied`
- `users.invited`
- `session.logged_in` and `session.logged_out`

Permission denials include the actor and tenant context when available, the attempted permission, HTTP method, and path. Audit persistence failure is logged but does not replace the enforced 403 response.

`GET /api/v1/audit/events?limit=50` requires `audit.read`, derives the Organization only from AuthContext, and returns that Organization's events newest first. `limit` accepts 1–100 and defaults to 50. Only owner and administrator have `audit.read` in v1. No audit mutation route exists.

## Invite stub

`POST /api/v1/auth/invites` creates a User with status `invited` and an Invite with status `pending`. It does not create a Membership, deliver email, or implement an activation playbook.

## Local verification

```bash
export PATH=/home/hatch/workspace/tools/node22/bin:$PATH
export SESSION_PEPPER=dev-only-change-me
npm run dev:api
```

The web app's Vite development server proxies `/api` to `http://localhost:3001`.
