# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| `main` (0.2.x) | Yes |
| Older tags | Best-effort until first supported release train |

## Reporting a vulnerability

**Do not** open a public GitHub issue for security vulnerabilities.

Email the repository owner (GitHub: [@aldeville11](https://github.com/aldeville11)) with:

- Description and impact
- Reproduction steps / PoC (non-destructive)
- Affected commit SHA or version
- Whether tenant isolation / session auth is implicated

Expect an acknowledgement within **72 hours**. Coordinated disclosure preferred.

## Security baselines (product)

- Cookie sessions per ADR 0002 — never log session tokens or `SESSION_PEPPER`
- Hard Organization tenant isolation — cross-tenant access must fail closed
- Secrets only via environment / cloud secrets manager — never commit `.env*`
- Server-side RBAC is catalog-backed and fail-closed; tenant isolation remains independently mandatory

## Known deferred hardening

- **OPEN #19:** CSRF protection beyond the current `SameSite=Lax` baseline — not in Sprint 3 scope; CTO scope decision required.
- **OPEN #20:** Authentication rate limiting — not in Sprint 3 scope; CTO scope decision required.
- **RESOLVED #21:** Sprint 3 delivered the AuditEvent module on `domain_events`, denial and lifecycle events, and the org-scoped `audit.read` surface.
- **OPEN #22:** Session idle timeout and revoke-all behavior.
- **OPEN:** AuthContext selects the latest active Membership; explicit multi-membership/workspace selection remains deferred.
- **OPEN:** Per-merchant `owner` and `administrator` currently act as operations administrators through the full current permission catalog; revisit if platform-level administration is separated from merchant administration.
