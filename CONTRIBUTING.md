# Contributing to Acquisition OS

## Before you write code

1. Read [ENGINEERING_LAWS.md](./docs/engineering/ENGINEERING_LAWS.md)
2. Read [AGENTS.md](./AGENTS.md) if you are an AI/agent contributor
3. Confirm the **current sprint** is approved and previous sprint is **COMPLETE**
4. Run `npm run governance:pre-sprint -- <N>` for implementation work

Quality overrides speed. Out-of-scope features will be rejected.

## Development setup

See README → **Development bootstrap**.

```bash
npm install
cp .env.example .env.local
# set SESSION_PEPPER to a long random string
npm run env:check
npm run verify
```

## Branching

- Default branch: `main`
- Feature branches: `cursor/<short-description>` or `feat/<short-description>`
- Never force-push `main`

## Pull requests

- Use the PR template
- Keep PRs focused and in-sprint
- Isolation suite must pass for tenancy/auth changes
- One logical change set preferred

## Commit messages

Prefer imperative summary lines:

```
Add tenant isolation suite to CI
```

## Code owners

See `.github/CODEOWNERS`. Reviewers must follow ownership for critical paths.

## Do not

- Implement future sprints early
- Weaken tenant isolation
- Commit secrets
- Bypass CI or governance gates
