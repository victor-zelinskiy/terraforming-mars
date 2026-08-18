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
npm run test:server          # mocha, ~8740 specs, ~50s
npm run test:client          # mochapack, ~4140 specs, ~85s
npm run build:test           # tsc --build tests/tsconfig.json

# one server spec
npx mocha --import=tsx --require tests/testing/setup.ts "tests/cards/base/Algae.spec.ts"

# one client spec — BOTH flags are required when invoking mochapack directly:
#   --webpack-config webpack.test.config.js   (single-chunk build; see below)
#   --include ./tests/client/components/bundleSetup.ts   (auto-unmount)
cross-env NODE_ENV=development npx mochapack \
  --webpack-config webpack.test.config.js \
  --require tests/client/components/setup.ts \
  --include ./tests/client/components/bundleSetup.ts "<spec>"
```

**Both `npm run test:*` scripts go through `scripts/run-tests.mjs`**, which fails the run when fewer tests are COLLECTED than the declared floor (`--min`). Raise a floor when a batch of specs lands; never lower one to make a run pass.

## Traps that have bitten before
- **`npm run build:test` is mandatory when you touch `tests/`** — it is the only thing that typechecks the test tree (mocha + tsx do not), and it is what catches case-sensitive import paths that break CI on Linux.
- ⚠️ **The client suite ran ZERO tests, green, from 2026-07-02 to 2026-08-14.** A fixed-name `vendors` split chunk that also collects lazily-imported deps makes `chunk.isOnlyInitial()` false for it, mochapack then never loads it, and `main.js` waits forever on a deferred startup — so the entry module (which runs the specs) never executes: «0 passing», exit 0, and every spec in the batch silenced. Fixed by `webpack.test.config.js` (no split chunks, no async chunks). **Never point the unit runner at `webpack.config.js`.** Full write-up in that file's header.
- **A mount that is never unmounted is a live subscriber.** Specs share one process and one module-state graph, so stale components re-render on every later spec's writes: measured 432 failures + 6 min together vs 19 failures + 55 s apart. `bundleSetup.ts` auto-unmounts after each test — so **mount in `beforeEach`, never in `before`** (a wrapper does not survive into the next `it`).
- `tests/client/components/setup.ts` exposes **every jsdom CONSTRUCTOR** (not a hand-picked list) — Vue's own `v-model` needs `Document`/`ShadowRoot`. Imperative APIs (`requestAnimationFrame`, `matchMedia`, …) are deliberately NOT added: feature detection must keep seeing this environment.
- `npm run lint:server` with `--cache` can mask errors; run `eslint --no-cache` when in doubt.
- ⚠️ **A LAYOUT GUARD CALIBRATED ON WINDOWS HAS NO MARGIN ON THE LINUX RUNNER — and a flat allowance cannot fix it.** Chromium lays HUD-sized text out with SUBPIXEL glyph advances on a dev box and with advances ROUNDED UP TO WHOLE PIXELS on CI (FreeType, below the size at which subpixel positioning turns on): «ДОСТИЖЕНИЯ» inks 95.41 px at 13.2 px locally and 100.41 px on the runner (+0.5 px per glyph), while the SAME string at 34 px costs nothing extra — which is why the strategy rail shipped an ellipsis only the FHD shard ever saw, at every retry, reproducible nowhere. **Simulate the rounding, never budget for it**: «keep N px per glyph spare» is right on the dev box and DOUBLE-COUNTS on the runner, where that margin has already been spent — the first fix failed a layout its own ellipsis check called whole. Reconstruct the worst case from the platform's own advances (∑⌈advance⌉ + tracking, via `canvas.measureText` on the PAINTED string — mind `text-transform`), clamp it to the laid-out ink so the measuring API's convention cannot change the budget, and assert the COLUMN clears it. The column is measured too: a `flex: 0 1 auto` title that fits reports its own ink and says nothing about the room it has — clone the real element at the real width and give it a string no line can hold. ⚠️ `getComputedStyle` is LIVE: read every property BEFORE detaching the clone, or the face silently reads «». Reference: `tests/e2e/console-strategy-rail.spec.ts` § `headFits`.
- **Module state is BUNDLE-SHARED in mochapack.** A spec that overrides an injected supplier or leaves module reactive state set (an open flow, a live animation hold, a foreground lease) corrupts every later spec — restore it in `after()`.
- A PURE helper spec with no Vue dependency also runs under the faster server runner.
- `eqeqeq` has no null exception here — `== null` fails lint.

## Guard specs are worklists, not decoration
Coverage specs enumerate the in-scope card set and FAIL with the exact list of cards needing attention (`cardPlayPreviewCoverage`, `actionReasonCoverage`, `cardInformation`, `effectSummaryCoverage`, `premiumCardViewModel`, `trackerCoverageGuard`, …). When widening expansion scope, widen their `SCOPE` sets first and let them tell you the work.

Prefer a cheap unit/integration spec over e2e; e2e (`tests/e2e/`) only when the bug cannot be reproduced otherwise — and after `npm run make:css`, since `build:client` does not compile LESS.
