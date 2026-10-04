# AGENTS.md

Instructions, architecture invariants, and development guidelines for AI agents and human contributors working in this repository.

---

## 1. Project Overview

- **Project:** Cardiac Auscultation Trainer
- **Target Audience:** First-year nursing students learning foundational cardiac assessment.
- **Goal:** A browser-based web application teaching stethoscope placement, normal and abnormal heart sounds (murmurs, gallops, clicks, rubs), physiological timing across heart rates, and irregular rhythms.
- **Origin:** Ground-up rebuild of [CON-XR Cardiac Auscultation Trainer](https://github.com/andrewfrueh/CON-XR_Cardiac_Auscultation_Trainer) with a modern stack and decoupled architecture.

---

## 2. Technology Stack & Runtime

- **Node Version:** Node 24 (`.nvmrc` is the source of truth).
- **Language:** TypeScript (`~6.0.2` / strict mode with aggressive compiler checks).
- **Build / Dev:** Vite (`^8.2.2`).
- **UI Framework:** React (`^19.3.0`).
- **State Management:** Zustand (`^5.0.15`).
- **Validation / Schemas:** Zod (`^4.5.4`).
- **3D Scene:** Three.js (`^0.185.1`).
- **Audio:** Web Audio API (scheduled lookahead clock).
- **Testing:** Vitest (`^4.1.11`) + React Testing Library (`^16.3.3`) in `jsdom` environment.
- **Linting & Formatting:** ESLint flat config with `@typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked`, `eslint-plugin-react-hooks`, Prettier (`printWidth: 100`, `singleQuote: true`).
- **Git Hooks / Commit Rules:** Husky + Commitlint enforcing Conventional Commits.

---

## 3. Architecture & Invariants

### 3.1 One-Way Dependency Layering

Code must adhere strictly to the one-way dependency chain:

```
data → engine → audio → store → components → App → main
```

```
src/
├── engine/             # Pure TypeScript logic. ZERO DOM, ZERO Web Audio.
│   ├── schema/         # Zod schemas and inferred TS types.
│   ├── cycle.ts        # RR interval to systole/diastole landmarks (Weissler formula).
│   ├── beats.ts        # Rhythm generators yielding beat timestamps.
│   ├── envelope.ts     # Murmur shape to gain curves.
│   ├── resolve.ts      # Sound set + location resolution to cycle events.
│   └── scheduler.ts    # Beats + events + time window to scheduled events.
├── audio/              # The ONLY layer allowed to touch Web Audio API.
│   ├── context.ts      # AudioContext creation and resumption on user gesture.
│   ├── loader.ts       # AudioBuffer preloading from sample manifest.
│   ├── graph.ts        # Master gain, dynamics compressor, destinations.
│   └── player.ts       # Lookahead scheduling loop and voice tracking.
├── data/               # Static JSON configuration files validated against Zod schemas.
│   ├── manifest.json
│   ├── sound-sets/
│   ├── rhythms/
│   ├── locations.json
│   └── scenarios/
├── store/              # Zustand store: application state and mutating actions.
├── components/         # React UI components (interactive controls, steth placement, 3D viewport).
├── App.tsx             # Root component shell.
├── main.tsx            # Application entry point mounting into index.html.
└── style.css           # Global stylesheet.
```

### 3.2 Layer Isolation Rules

1. **`src/engine/` must remain pure:**
   - Never import DOM APIs (`window`, `document`, `HTMLElement`).
   - Never import Web Audio (`AudioContext`, `AudioBuffer`, `GainNode`, etc.).
   - All scheduling and cycle computations must be runnable headlessly in Node/Vitest tests.
2. **`src/audio/` owns Web Audio:**
   - Web Audio primitives live solely under `src/audio/`.
   - Never instantiate or trigger Web Audio nodes directly inside React components or stores.
3. **`src/components/` must not bypass `src/store/`:**
   - React components read state and invoke actions defined in the Zustand store (`src/store/`).
   - Components must not import `src/audio/` or `src/engine/` directly.
4. **Data files are schema-validated:**
   - Everything under `src/data/` must have a corresponding Zod schema under `src/engine/schema/`.
   - Test suites must validate all JSON data files against their schemas on test runs.

### 3.3 Domain Vocabulary & Timing Model

Do not conflate these terms in code, types, or documentation:

| Term          | Definition                                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sample**    | An individual audio asset (e.g., recorded S1 sound, murmur noise loop, mechanical click).                                                             |
| **Sound Set** | Which sound components occur during a single cardiac cycle and their relative positions/gains (e.g., "Normal S1-S2", "Aortic Stenosis", "S3 Gallop"). |
| **Rhythm**    | Temporal beat distribution over time (e.g., regular sinus rhythm, atrial fibrillation, premature ventricular contractions).                           |
| **Location**  | An auscultation site (Aortic, Pulmonic, Erb's Point, Tricuspid, Mitral/Apex) and its EQ/attenuation filter profile.                                   |
| **Scenario**  | A user-selectable preset binding a sound set, rhythm, heart rate (BPM), and location together.                                                        |

All sound events are anchored to landmarks within a single beat:

- `S1`: Start of mechanical systole (Time 0).
- `S2`: End of mechanical systole / start of diastole (`S1 + systoleMs`).
- `nextS1`: Start of next beat (`S1 + rrMs`).
- `systole`: Interval `[S1, S2]`.
- `diastole`: Interval `[S2, nextS1]`.
- Systole duration dynamically adjusts with heart rate using Weissler's regression:
  $$\text{systoleMs} = \text{clamp}(546 - 2.1 \times \text{bpm},\, 200,\, 450)$$

### 3.4 TypeScript Discipline

- `noUncheckedIndexedAccess: true`: Accessing arrays or records returns `T | undefined`. Always verify presence or provide explicit defaults before using indexed values.
- `exactOptionalPropertyTypes: true`: Do not pass `{ prop: undefined }` if `prop` is optional unless the type explicitly permits `undefined` (`prop?: string | undefined`). Omit the key instead.
- `erasableSyntaxOnly: true`: Do not use TypeScript constructs that cannot simply be erased to JavaScript (avoid `enum`, non-ambient `namespace`). Use string literal unions or `const` objects (`as const`).
- `noImplicitOverride: true`: Use `override` keyword when overriding class methods.
- Avoid type assertions (`as Foo`) or non-null assertions (`!`). Fix typing upstream or use type guards/narrowing.
- Avoid `any` under all circumstances. Use `unknown` with validation or type guards when types are uncertain.

---

## 4. Code Review & Simplicity Gate (Two-Pass Review)

Agents must review their own staged diff before committing code to ensure clean, maintainable architecture:

### Pass 1: Ponytail Review (Anti-Overengineering & YAGNI Hunt)

- **delete**: Cut dead code, unused flexibility, speculative features, or configuration options nobody requested.
- **stdlib**: Reach for the standard library before pulling in third-party dependencies.
- **native**: Use native platform, CSS, and framework capabilities rather than external utility libraries.
- **yagni**: Eliminate premature abstractions with only one implementation, single-caller wrapper classes, or unnecessary indirection.
- **shrink**: Compress verbose boilerplate into idiomatic, readable code (net: -`<N>` lines). Lean code ships faster and breaks less.

### Pass 2: Regular Quality & Correctness Review

- **Error Boundaries**: Ensure graceful fallbacks and error handling.
- **Domain Standards**: Verify strict adherence to auscultation cycle timing, landmarks, and schema definitions.
- **Type Safety & Linting**: 100% type coverage, 0 lint warnings (`npm run typecheck`, `npm run lint`).

---

## 5. Git Commit Protocol & Reviewability Rules

To keep pull requests trackable and prevent review fatigue:

### Diff Size Hard Ceiling (< 600 lines)

- **NO COMMIT MAY EXCEED 600 LINES OF DIFF.**
- Target bite-sized, atomic commits between 150 and 350 lines.
- Always run pre-commit diff checks before committing:
  ```sh
  git diff --cached --stat
  ```
- If changes approach 500 lines, split the work into separate logical commits (e.g. interfaces/schemas first, implementation second, tests third).

### Commit Often with Clear, Concise Messages

- Use Conventional Commit format: `<type>(<scope>): <imperative summary>` (≤50 chars subject, no trailing period).
- Valid types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`, `build`, `ci`, `revert`.
- Examples:
  - `feat(engine): add weissler cycle duration calculations`
  - `test(audio): add lookahead clock drift unit tests`
  - `fix(cycle): clamp heart rate between 30 and 220 bpm`

### Quality Gate & Pre-Commit Verification

Because ESLint and Prettier formatting checks take time, run them **just before each commit** rather than after every micro-edit:

- **During active iteration**: Rely on fast feedback (`npm run typecheck` and focused Vitest unit tests). Defer full linter and formatting runs during rapid prototyping.
- **Immediately before staging and committing**: Run formatting and linting to ensure clean commits:
  ```sh
  npm run format       # Auto-formats code with Prettier
  npm run lint         # Runs ESLint strict type checks
  ```
- Every commit must compile, be properly formatted, pass linting, and pass relevant tests before being recorded. Never commit broken code.

---

## 6. Mandatory Definition of Done (Pre-PR Checklist)

Before creating or updating a Pull Request, agents MUST execute and pass these gates:

### Upstream Synchronization & Conflict Check

- Always ensure your branch is strictly up-to-date with `main` before submitting:
  ```sh
  git fetch origin main
  git merge origin/main  # or git pull --rebase origin main
  ```
- Verify zero merge conflicts and confirm no conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) exist in any file:
  ```sh
  git diff --check
  ```
- If conflicts occur, resolve them explicitly, re-run all checks, and stage the resolution.

### Verification Execution

Run the full local test and build suite in order:

```sh
npm run typecheck      # Verifies TypeScript types with tsc --noEmit
npm run lint           # Lints all code with ESLint strict type checks
npm run format:check   # Checks code formatting with Prettier (run `npm run format` to fix)
npm test               # Executes test suite with Vitest
npm run build          # Runs tsc and builds production bundle via Vite
```

Expected: 0 errors, 0 warnings, all tests green.

### Review & Diff Check

- Run Ponytail Review pass (cut over-engineering, unneeded deps, and boilerplate).
- Run `git diff --stat origin/main...HEAD` to verify all individual commits remain under the 600-line reviewability ceiling.

---

## 7. Automated PR Creation & Description Protocol

Once all checks in the Definition of Done (Section 6) pass with zero errors, agents MUST automatically open the Pull Request using GitHub CLI (`gh`).

### 1. Branch Strategy & Push

- Never push directly to `main`.
- Work on a semantic branch named after the task (e.g. `feat/murmur-envelope`, `fix/bpm-clamp`).
- Push your branch to remote:
  ```sh
  git push -u origin HEAD
  ```

### 2. Standardized PR Description Template

Agents must populate the PR description using this structured format:

```markdown
## Summary of Changes

- <High-level bullet point of core change>
- <Component or pipeline modified>
- <Key architectural, data model, or domain decisions made>

## Related Issue

Closes #<issue-number> <!-- or Fixes #<issue-number>, omit if standalone -->

## Pre-PR & CI Verification Checklist

- [x] Synced with `origin/main` (0 merge conflicts, no conflict markers)
- [x] Checks passed (`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`)
- [x] Ponytail Simplicity Gate passed (minimal code, standard library preferred, no dead code)
- [x] Reviewability ceiling respected (individual commits < 600 lines)

## Verification Evidence

- **Status**: All tests green, typecheck clean, bundle built cleanly.
```

### 3. Automated PR Creation Command

Generate the PR via `gh pr create` with a Conventional Commit title:

```sh
gh pr create \
  --title "<type>(<scope>): <concise imperative summary>" \
  --body "$(cat <<'EOF'
## Summary of Changes
- <Bullet point 1>
- <Bullet point 2>

## Related Issue
Closes #<issue-number>

## Pre-PR & CI Verification Checklist
- [x] Synced with `origin/main` (0 merge conflicts)
- [x] Checks passed (typecheck, lint, format, test, build)
- [x] Ponytail Simplicity Gate passed (<600 lines diff, no over-engineering)

## Verification Evidence
- Verification suite clean locally.
EOF
)"
```

### 4. Post-PR Verification & Mergeability Check

After creating the PR:

- Verify GitHub reports the PR as cleanly mergeable:
  ```sh
  gh pr view --json mergeable,state
  ```
  Expected: `"mergeable": "MERGEABLE"`
- Check CI status:
  ```sh
  gh pr checks
  ```
- If any CI check fails or a conflict is detected on GitHub, immediately pull `origin/main`, resolve the discrepancy, re-test locally, and push the fix.

---

## 8. Reference Documents

For deeper domain and architectural context, refer to:

- [`README.md`](README.md): Quick start, high-level scripts, stack description.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): Detailed contributor workflow, branch protection rules, and CI setup.
- [`docs/audio-engine-design.md`](docs/audio-engine-design.md): In-depth design of the cardiac cycle engine, Web Audio player, voice management, and Zod schemas.
