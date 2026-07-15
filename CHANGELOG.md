# Changelog

All notable changes to **Acquisition OS** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
as described in [docs/engineering/VERSIONING.md](./docs/engineering/VERSIONING.md).

## [Unreleased]

### Added
- Sprint 3 Planning: AuthZ + Audit plan (pending approval); Proposed ADR 0009
- Repository hardening: CI, Dependabot, templates, CODEOWNERS, SECURITY, CONTRIBUTING, RELEASE, env validation

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
