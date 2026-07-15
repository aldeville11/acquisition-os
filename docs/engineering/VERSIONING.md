# Versioning strategy

**Owner:** Repository Maintainer · CTO  
**Status:** Active  

## Scheme

[Semantic Versioning 2.0.0](https://semver.org/).

| Component | Meaning for Acquisition OS |
|---|---|
| MAJOR | Breaking HTTP API, auth cookie contract, tenancy model, or data migrations that require coordinated downtime |
| MINOR | New backward-compatible capability (typically a completed sprint) |
| PATCH | Bugfix, security patch, docs/CI/tooling without public contract change |

## Mapping to sprints

| Milestone | Suggested version |
|---|---|
| Sprint 0 Foundation | 0.0.x |
| Sprint 1 AuthN | 0.1.0 |
| Sprint 2 Tenancy | **0.2.0** (current) |
| Sprint 3 AuthZ + Audit | 0.3.0 (when COMPLETE) |
| First production GA | 1.0.0 (requires AuthZ + agreed security baselines) |

## Artifacts

- Root `package.json` `version` is the **product version**
- Git tags: `vMAJOR.MINOR.PATCH`
- Changelog: `CHANGELOG.md`

## Pre-release tags

Optional: `v0.3.0-rc.1` for candidate builds. Do not mark Sprint COMPLETE on RC tags alone.
