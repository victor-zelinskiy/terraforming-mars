/**
 * IN-BUNDLE test setup — loaded through mochapack's `--include`, so it runs
 * INSIDE the webpack bundle (unlike `setup.ts`, which node loads before mocha's
 * globals even exist) and therefore shares ONE `@vue/test-utils` instance with
 * every spec.
 *
 * ── WHY: A MOUNT THAT IS NEVER UNMOUNTED IS A LIVE SUBSCRIBER ──────────────
 *
 * `mount()` leaves the component mounted until somebody unmounts it, and most
 * specs never do. Under mochapack the whole suite is ONE bundle in ONE process,
 * so those wrappers accumulate: by the end of a full run several thousand live
 * components are still subscribed to the module-level reactive state this fork
 * is built on (`consoleState`, `journalState`, `notificationState`,
 * `presentationFlow`, `workspaceOutcomeState`, …). Every later spec that writes
 * to any of it re-renders all of them.
 *
 * That is not a slow test — it is a WRONG one. Measured before this hook:
 *
 *   console specs alone         2126 passing,   2 failing,  32s
 *   everything else alone       1977 passing,  17 failing,  23s
 *   both together               3712 passing, 432 failing,  6m
 *
 * ~410 failures and a 6× wall-clock blow-up that exist only when the groups
 * share a process — stale components throwing from their own re-render, inside
 * whatever test happened to be running. The one thing a unit suite must never
 * do is make a spec's verdict depend on which other specs ran first.
 *
 * ⚠️ CONSEQUENCE FOR SPEC AUTHORS: a wrapper does NOT survive into the next
 * `it()`. Mount in `beforeEach`, never in `before`.
 */
import {disableAutoUnmount, enableAutoUnmount} from '@vue/test-utils';

/**
 * Teardown failures collected during the run, so ONE of them cannot take the
 * suite down with it.
 *
 * `@vue/test-utils`' own cleanup unmounts the tracked wrappers in a plain loop
 * and clears its list only afterwards, so a component that throws while
 * unmounting (a real defect — see the known issue below) fails the root
 * `afterEach`, and mocha treats a failing root hook as FATAL: the run stops
 * where it stands. Measured: 853 of 4144 tests before everything else was
 * simply never attempted, reported as a pass-looking early exit.
 *
 * So each wrapper is unmounted on its own and a thrower is recorded instead of
 * propagating. This is isolation, NOT suppression: the failure is printed the
 * moment it happens, named with the test that produced it, and the run FAILS at
 * the end through the `after` hook below. Nothing green ever hides one.
 *
 * The one component that used to land here (`ModuleItemFilter.vue`, «Cannot read
 * properties of null (reading 'style')» out of Vue's `v-show` teardown) was a
 * REAL defect reachable through the product's own close path, and is fixed at
 * the source. This net stays because the next one is a matter of time.
 */
const teardownFailures: Array<string> = [];

/**
 * ⚠️ AND A THROWER MUST NOT BE RETRIED. `@vue/test-utils` clears its tracked list
 * only AFTER the loop, so a wrapper that throws stays in it and is unmounted
 * again by every later test — one offender then reports as thousands (measured:
 * 3264 «failures» from a single component). `disableAutoUnmount()` is the only
 * exported way to empty that list, so a failure resets tracking and re-arms it.
 * The `afterEach` below is registered ONCE; re-arming only re-captures `cleanUp`.
 */
let cleanUp: () => void = () => {};
const arm = () => enableAutoUnmount((fn) => {
  cleanUp = fn;
});
arm();

/** Just the slice of mocha's hook context this file reads. */
type HookContext = {currentTest?: {fullTitle(): string}};

afterEach(function(this: HookContext) {
  const title = this.currentTest?.fullTitle() ?? '(unknown test)';
  try {
    cleanUp();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    teardownFailures.push(`${title} — ${message}`);

    console.error(`\n  ⚠ auto-unmount FAILED after «${title}»: ${message}\n`);
    disableAutoUnmount();
    arm();
  }
});

after(function() {
  if (teardownFailures.length > 0) {
    throw new Error(
      `${teardownFailures.length} component(s) threw while unmounting — a teardown ` +
      'defect, not a flake:\n  ' + teardownFailures.join('\n  '));
  }
});
