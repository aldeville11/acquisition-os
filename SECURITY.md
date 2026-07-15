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
- RBAC enforcement is Sprint 3+ — do not treat AuthContext role fields as authorization

## Known deferred hardening

Tracked debt (do not close without paydown): CSRF (#19), rate limiting (#20), audit module (#21), session idle/revoke-all (#22) — see Hostpitality issue history / Sprint memory until mirrored here.
