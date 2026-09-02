# Cardiac Auscultation Trainer

A browser-based tool for learning cardiac auscultation: where to place the
stethoscope, what normal and abnormal heart sounds are heard at each site, and
how they change with heart rate and rhythm. It is aimed at first-year nursing
students practicing foundational cardiac assessment.

This is a ground-up rebuild of the
[CON-XR Cardiac Auscultation Trainer](https://github.com/andrewfrueh/CON-XR_Cardiac_Auscultation_Trainer)
with the same stack and a new architecture.

## Quick start

Requires Node 24. If you use nvm, `nvm use` picks up the version from `.nvmrc`.

```sh
git clone git@github.com:kevin-rav/cardiac-auscultation-trainer.git
cd cardiac-auscultation-trainer
npm install
npm run dev
```

The dev server prints a local URL, usually `http://localhost:5173`.

## Scripts

| Script                 | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Start the Vite dev server with hot reload    |
| `npm run build`        | Typecheck, then build a production bundle    |
| `npm run preview`      | Serve the production bundle locally          |
| `npm test`             | Run the test suite once                      |
| `npm run test:watch`   | Run tests in watch mode                      |
| `npm run typecheck`    | Run the TypeScript compiler without emitting |
| `npm run lint`         | Lint with ESLint                             |
| `npm run format`       | Rewrite files with Prettier                  |
| `npm run format:check` | Fail if any file is not Prettier-formatted   |

## Stack

- **TypeScript** with strict compiler options. See `tsconfig.json`.
- **Vite** for the dev server and production bundle. There is no framework.
  `index.html` is the entry point and everything reachable from `src/main.ts`
  is bundled.
- **Three.js** for the 3D scene.
- **Web Audio API** for sound playback.
- **Vitest** for tests, running in a jsdom environment.
- **ESLint** with type-aware rules and **Prettier** for formatting.
- **commitlint** and **husky** to enforce Conventional Commits locally.
- **GitHub Actions** for continuous integration.

## Repository layout

```
.github/workflows/  CI workflow
.husky/             git hooks, installed automatically by npm install
docs/               design documents
public/             static files copied to the build output as-is
src/                application source; everything here is bundled
index.html          entry page
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch and pull request
workflow, commit message rules, and the checks that run in CI.

## History

The original project was built by an earlier student team as the CON-XR
Cardiac Auscultation Trainer. This rebuild started in September 2026.
