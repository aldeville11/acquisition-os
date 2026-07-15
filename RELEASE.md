# Release process

## Versioning

See [docs/engineering/VERSIONING.md](./docs/engineering/VERSIONING.md).

- **MAJOR**: breaking API / tenancy / auth contract changes
- **MINOR**: backward-compatible sprint deliverables (e.g. Sprint 3 AuthZ)
- **PATCH**: fixes, docs, CI, debt paydowns without contract changes

Pre-1.0 (`0.y.z`): `MINOR` may include breaking changes; call them out in CHANGELOG.

## Checklist (maintainer)

1. `main` is green (CI `verify` + `governance-smoke` + isolation)
2. Sprint COMPLETE if releasing a sprint boundary (`governance:close -- N` PASS)
3. Update `CHANGELOG.md` — move Unreleased → versioned section with date
4. Bump `version` in root `package.json` (and workspace packages if published later)
5. Commit: `chore(release): vX.Y.Z`
6. Tag annotated: `git tag -a vX.Y.Z -m "Acquisition OS vX.Y.Z"`
7. Push: `git push origin main --follow-tags`
8. GitHub → **Releases** → draft from tag → paste CHANGELOG section
9. Confirm production secrets rotated / present (`SESSION_PEPPER`, `DATABASE_URL`, etc.)

## Hotfix

1. Branch from the release tag
2. Minimal fix + tests
3. Patch bump + CHANGELOG
4. Merge to `main` and retag, or cherry-pick per ops decision

## Non-goals (until AuthZ / platform sprints land)

- Automated semantic-release bots
- Publishing packages to npm
