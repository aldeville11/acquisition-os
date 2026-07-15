# Changelog

All notable changes to **Acquisition OS** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
as described in [docs/engineering/VERSIONING.md](./docs/engineering/VERSIONING.md).

## [Unreleased]

_(none)_

## [0.3.0] — 2026-07-15

### Added
- RBAC Vocabulary platform contract (`docs/engineering/RBAC_VOCABULARY.md`)
- Deny-by-default AuthZ enforcement (ADR 0009)
- Durable AuditEvent foundation (`audit_events`)
- Mandatory Authorization Test Suite
- Organization/workspace PATCH + membership revoke surfaces

### Security
- Live permission checks on protected Identity + Tenancy routes
- Audit writers for login/logout, tenancy mutations, permission grant/deny

## [0.2.0] — 2026-07-15

### Added
- Tenancy domains: Organization, Location, Workspace, Membership
- SQL platform store (`pg` + PGlite) — ADR 0008
- AuthContext population from Membership
- Minimal domain events
- Permanent Tenant Isolation Test Suite
- Sprint 2 COMPLETE governance packet

### Security
- Hard organization tenant isolation on repository methods

## [0.1.0] — 2026-07-15

### Added
- Cookie session authentication (ADR 0002)
- Invite stub
- Sprint 1 COMPLETE governance packet

## [0.0.0] — 2026-07-15

### Added
- Initial monorepo foundation (Sprint 0): packages, Gate A, engineering org
