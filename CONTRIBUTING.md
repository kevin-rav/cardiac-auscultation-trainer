# Contributing

This document describes how changes get into the repository. It is written
for whoever maintains the project next, so it spells out the rules that the
tooling enforces and the ones it does not.

## Workflow

1. Branch from `main`. Name the branch by type and topic, for example
   `feat/location-selector` or `fix/bpm-clamp`.
2. Make your change with commits that follow the message format below.
3. Run the local checks. `npm run format` fixes formatting; the rest report.
   ```sh
   npm run typecheck
   npm run lint
   npm run format:check
   npm test
   npm run build
   ```
4. Push the branch and open a pull request against `main`.
5. Wait for the `ci` and `commitlint` checks to pass.
6. A person merges the pull request. Merges are squash-only, so the pull
   request title becomes the commit subject on `main` and the pull request
   body becomes the commit body. Write both to the format below.

Direct pushes to `main` are rejected for everyone, including repository
admins. Force pushes and branch deletion on `main` are blocked. The branch is
deleted automatically after merge.

## Commit messages

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description, imperative, lowercase, no trailing period>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`. Add `!` after the type for a breaking change.

```
feat: add location selector
fix: clamp bpm to valid range
docs: add audio engine design
```

A git hook runs commitlint on every local commit, and the `commitlint` job in
CI checks every commit in a pull request. The hook is installed by
`npm install`; if commits are not being checked, run it again.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on every push to
`main`. It has two jobs:

- `ci` runs, in order: `npm ci`, typecheck, lint, format check, tests, build.
  It stops at the first failure.
- `commitlint` runs only on pull requests and lints every commit between the
  base branch and the head.

Both are required status checks on `main`. The branch must also be up to date
with `main` before it can merge; if `main` moves, rebase or merge it in and
push again.

CI uses the Node version in `.nvmrc`. Change that file to change the Node
version everywhere.

## Code standards

- TypeScript runs with `strict` plus the extra checks in `tsconfig.json`. Do
  not loosen them. Fix the type rather than casting.
- ESLint uses the type-aware `strictTypeChecked` preset. Suppress a rule
  inline only with a comment explaining why.
- Prettier owns formatting. Run `npm run format`.
- Tests sit next to the code they cover as `*.test.ts`. Behavior changes come
  with a test.
- Keep dependencies few. Commit `package-lock.json` with any change.
