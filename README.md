# Cardiac Auscultation Trainer

Browser-based trainer for learning cardiac auscultation. Rebuild of the
[CON-XR Cardiac Auscultation Trainer](https://github.com/andrewfrueh/CON-XR_Cardiac_Auscultation_Trainer).

## Stack

- TypeScript, Vite, Three.js
- Vitest for tests, ESLint and Prettier for linting and formatting
- Conventional Commits enforced by commitlint

## Development

```sh
npm install
npm run dev
```

## Scripts

| Script                 | Purpose                    |
| ---------------------- | -------------------------- |
| `npm run dev`          | Start the dev server       |
| `npm run build`        | Typecheck and build        |
| `npm test`             | Run the test suite         |
| `npm run lint`         | Lint with ESLint           |
| `npm run typecheck`    | Run the TypeScript checker |
| `npm run format`       | Format with Prettier       |
| `npm run format:check` | Check formatting           |

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/),
for example `feat: add aortic listening site` or `fix: clamp bpm range`.
