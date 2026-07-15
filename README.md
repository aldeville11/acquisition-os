# Customer Acquisition OS

[![CI](https://github.com/aldeville11/acquisition-os/actions/workflows/ci.yml/badge.svg)](https://github.com/aldeville11/acquisition-os/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-20.x-brightgreen)](./package.json)
[![License](https://img.shields.io/badge/license-proprietary-lightgrey)](./SECURITY.md)
[![Version](https://img.shields.io/badge/version-0.2.0-blue)](./CHANGELOG.md)

Monorepo for **Acquisition OS** (Customer Acquisition Operating System).

**Repository:** https://github.com/aldeville11/acquisition-os  
**Status:** Sprint **2 (Tenancy) COMPLETE** · Sprint **3 not started**

**Governance:** [ENGINEERING_LAWS.md](./docs/engineering/ENGINEERING_LAWS.md) · [Constitution](./docs/engineering/ENGINEERING_CONSTITUTION.md) · [Sprint Playbook](./docs/engineering/SPRINT_PLAYBOOK.md) · [ADR 0007](./docs/engineering/adr/0007-sprint-governance.md)

```bash
npm run governance:pre-sprint -- <N>   # required before implementation
npm run governance:close -- <N>        # required before Status=COMPLETE
```

## Packages

| Path | Purpose |
|---|---|
| `apps/api` | Modular monolith API — Identity + Tenancy |
| `apps/web-app` | Authenticated product application |
| `apps/web-marketing` | Public front door (product-frames) |
| `packages/design-tokens` | Design system tokens |
| `packages/ui` | Shared UI primitives |
| `packages/product-frames` | Command Center / Pipeline / Report shells |
| `packages/fixtures` | Demo/test datasets |

## Development bootstrap

**Requirements:** Node.js `>=20.9.0 <23`, npm workspaces.

```bash
git clone https://github.com/aldeville11/acquisition-os.git
cd acquisition-os
npm install
cp .env.example .env.local
```

Edit `.env.local` and set a long random `SESSION_PEPPER` (required for the API).

```bash
export SESSION_PEPPER="$(grep SESSION_PEPPER .env.local | cut -d= -f2-)"
# Windows PowerShell:
# $env:SESSION_PEPPER = "replace-with-long-random-dev-pepper"

npm run env:check
npm run verify
npm run test:isolation   # mandatory forever

npm run dev:api   # :3001
npm run dev:web   # :5173 (proxies /api)
```

Demo login (non-production seed): `demo@acquisition-os.local` / `ChangeMe-Demo-Only-1!`

Optional Postgres: set `DATABASE_URL`. Without it, the API uses embedded **PGlite** (dev/test only — not for production).

## Environment validation

`npm run env:check` validates Node engines and critical secrets:

| Variable | Dev | Production |
|---|---|---|
| `SESSION_PEPPER` | warned if missing | **required** |
| `DATABASE_URL` | optional (PGlite) | **required** |

## Documentation

| Doc | Purpose |
|---|---|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |
| [SECURITY.md](./SECURITY.md) | Vulnerability reporting |
| [CHANGELOG.md](./CHANGELOG.md) | Released changes |
| [RELEASE.md](./RELEASE.md) | How to cut a release |
| [VERSIONING.md](./docs/engineering/VERSIONING.md) | SemVer policy |
| [BRANCH_PROTECTION.md](./docs/ops/BRANCH_PROTECTION.md) | Required `main` protections |
| [REPOSITORY_HEALTH.md](./docs/ops/REPOSITORY_HEALTH.md) | Hardening scorecard |
| [TENANCY.md](./docs/engineering/TENANCY.md) | Tenancy API notes |
| [AUTH.md](./docs/engineering/AUTH.md) | Auth notes |
| [project-memory](./docs/project-memory/) | Sprint memory |

## CI

GitHub Actions (`.github/workflows/ci.yml`):

1. `env:check`
2. `npm run verify` (typecheck, lint, test, build)
3. **Tenant Isolation Suite** (mandatory)
4. Coverage report
5. `governance:close -- 2` smoke (Sprint 2 remains COMPLETE)

## Sprint status

| Sprint | Status |
|---|---|
| 00 Foundation | COMPLETE |
| 01 AuthN | COMPLETE |
| 02 Tenancy | **COMPLETE** |
| 03 AuthZ + Audit | **Planning** — [SPRINT_3_PLAN.md](./docs/engineering/SPRINT_3_PLAN.md) **PENDING APPROVAL** (no implementation) |

Do **not** implement Sprint 3 until the Sprint 3 Plan is approved, ADR 0009 is Accepted, and `npm run governance:pre-sprint -- 3` PASSes.
