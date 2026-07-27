---
description: Test helpers, runners and the runner-specific traps (build:test, mochapack config, bundle-shared module state).
paths:
  - "tests/**"
---

# Testing rules

## Helpers
- **`testGame(n, options?)`** (`tests/TestGame.ts`) → `[game, ...players]`; skips initial card selection and disables Ares hazards by default.
- **`TestPlayer`** extends `Player` with `popWaitingFor()` etc.
- **`tests/TestingUtils.ts`**: `runAllActions(game)` (drain the deferred queue — call it after anything that defers), `cast(value, Class)`, `setOxygenLevel()`, `setTemperature()`, `addOcean()`, `addGreenery()`, `addCity()`, `fakeCard()`.
- Server card specs: instantiate the card → `canPlay()` / `play()` / `action()` → assert state.
- Client specs: `@vue/test-utils` with `tests/client/components/setup.ts`.
- Framework: Mocha + Chai (`expect` style); client via mochapack.

## Runners
```bash
npm run test:server          # mocha, ~7400 specs
npm run test:client          # mochapack
npm run build:test           # tsc --build tests/tsconfig.json

# one server spec
npx mocha --import=tsx --require tests/testing/setup.ts "tests/cards/base/Algae.spec.ts"

# one client spec (the --webpack-config flag is REQUIRED when invoking mochapack directly)
npx mochapack --webpack-config webpack.config.js --require tests/client/components/setup.ts "<spec>"
cross-env NODE_ENV=development mochapack --require tests/client/components/setup.ts "<spec>"   # package-script form
```

## Traps that have bitten before
- **`npm run build:test` is mandatory when you touch `tests/`** — it is the only thing that typechecks the test tree (mocha + tsx do not), and it is what catches case-sensitive import paths that break CI on Linux.
- A full `npm run test:client` run can be **falsely green** (0 tests, exit 0) — verify by running groups through mochapack directly.
- `npm run lint:server` with `--cache` can mask errors; run `eslint --no-cache` when in doubt.
- **Module state is BUNDLE-SHARED in mochapack.** A spec that overrides an injected supplier or leaves module reactive state set (an open flow, a live animation hold, a foreground lease) corrupts every later spec — restore it in `after()`.
- A PURE helper spec with no Vue dependency also runs under the faster server runner.
- `eqeqeq` has no null exception here — `== null` fails lint.

## Guard specs are worklists, not decoration
Coverage specs enumerate the in-scope card set and FAIL with the exact list of cards needing attention (`cardPlayPreviewCoverage`, `actionReasonCoverage`, `cardInformation`, `effectSummaryCoverage`, `premiumCardViewModel`, `trackerCoverageGuard`, …). When widening expansion scope, widen their `SCOPE` sets first and let them tell you the work.

Prefer a cheap unit/integration spec over e2e; e2e (`tests/e2e/`) only when the bug cannot be reproduced otherwise — and after `npm run make:css`, since `build:client` does not compile LESS.
