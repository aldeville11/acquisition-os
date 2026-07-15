# Authentication API notes (Sprint 1–3)

**Owner:** Backend Lead  
**Reviewers:** Security Engineer · Frontend Lead  
**ADR:** [0002-authentication.md](./adr/0002-authentication.md) · [0009-authz-audit.md](./adr/0009-authz-audit.md)  
**AuthZ vocabulary:** [RBAC_VOCABULARY.md](./RBAC_VOCABULARY.md) · Tenancy: [TENANCY.md](./TENANCY.md)

## Surface

`apps/api` (Hono modular monolith module) exposes Identity under `/api/v1`.

Cookie session contract is fixed by ADR 0002 (`aos_session`, HttpOnly, SameSite=Lax, Secure in production, HMAC-SHA-256 at rest with `SESSION_PEPPER`).

## AuthContext (RBAC hooks)

Login / `/auth/me` return AuthContext:

```json
{
  "userId": "...",
  "organizationId": null,
  "workspaceId": null,
  "role": null,
  "locationScope": []
}
```

| Field | Sprint 3 behavior |
|---|---|
| `organizationId` / `workspaceId` / `role` / `locationScope` | Populated from the user's **latest active Membership** when present; else null / `[]` |
| Role / permission **enforcement** | Live — [`RBAC_VOCABULARY.md`](./RBAC_VOCABULARY.md) deny-by-default via `assertPermission` / `authorize` |

AuthContext never mixes tenants: membership rows are org-scoped; isolation suite asserts `/me` does not expose foreign org data.

### RBAC probe

`GET /api/v1/auth/rbac/probe` evaluates `identity.manage` against the live matrix (`ready: true`, `allowed` true/false).

## Invite stub

`POST /api/v1/auth/invites` requires `identity.manage`. Creates a User with status `invited` and an Invite `pending`. No email delivery, no Activation playbook.

## Audit

Login success/failure and logout write `audit_events` (ADR 0009). See [AUDIT.md](./AUDIT.md).

## Local verify

```bash
export SESSION_PEPPER=dev-only-change-me
npm run dev -w @acquisition-os/api
npm run dev -w @acquisition-os/web-app
# Sign in with demo@acquisition-os.local / ChangeMe-Demo-Only-1!
```

Vite proxies `/api` → `http://localhost:3001`.
