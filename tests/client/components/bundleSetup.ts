/**
 * IN-BUNDLE test setup — the FIRST module of the client test bundle (`scripts/client-tests.mjs`), so it runs
 * INSIDE the webpack bundle (unlike `setup.ts`, which node loads before mocha's
 * globals even exist) and therefore shares ONE `@vue/test-utils` instance with
 * every spec.
 *
 * ── WHY: A MOUNT THAT IS NEVER UNMOUNTED IS A LIVE SUBSCRIBER ──────────────
 *
 * `mount()` leaves the component mounted until somebody unmounts it, and most
 * specs never do. The whole client suite is ONE bundle in ONE process,
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
import {config, disableAutoUnmount, enableAutoUnmount} from '@vue/test-utils';
import {vaporInteropPlugin} from 'vue';
import {auditReactivity} from '@/client/components/presentation/reactivityWitness';

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

/*
 * ── EVERY MOUNT CAN HOST A VAPOR COMPONENT ──────────────────────────────────
 *
 * The PRODUCT is one Vapor application — `createVaporApp(App)`, no virtual-DOM renderer and no interop plugin
 * (docs/claude/vapor/ROADMAP.md, V4). The UNIT SUITE is the one place where a virtual-DOM renderer still stands, and
 * only as scaffolding: `@vue/test-utils` mounts through `createApp`, its stubs and its hosts are virtual-DOM
 * components — and a Vapor component mounts NOTHING under a plain virtual-DOM renderer (it is an unknown kind of
 * component to it). So `vaporInteropPlugin` is installed here, once, for every `mount()` of the bundle. It is the
 * suite's own business: nothing in `src/client` may name it (the readiness ledger's `virtual-dom` row).
 *
 * And a spec never has to know that its OWN component was converted either: the `@vue/test-utils` and the `vue` of
 * this bundle are the suite's layer (`tests/client/testing/vaporTestUtils.ts` · `vueForTests.ts`, aliased by
 * `webpack.test.config.js`) — a Vapor root is mounted under a host and wrapped, the mount's stubs reach the children a
 * Vapor render creates, `findComponent` walks one tree over both runtimes.
 */
config.global.plugins = [...(config.global.plugins ?? []), vaporInteropPlugin];

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

/**
 * ── EVERY TEST IS A REACTIVITY SCAN ─────────────────────────────────────────
 *
 * A module predicate that a cache reads (every animation-hold supplier, the shell's admission terms — declared
 * through `reactivePredicate`, `src/client/components/presentation/reactivityWitness.ts`) must change ONLY through
 * reactive state, or every cache of it latches (the dead board of 2026-10-30: a placement grid that never lit). The
 * witness keeps a cache of its own per predicate; after every test it is compared with a fresh read, and a
 * difference — a predicate that moved without a reactive edge during THIS test — is recorded with the test's name
 * and fails the run at the end (a failing root hook would be fatal — see the teardown net above).
 */
const reactivityFailures: Array<string> = [];

afterEach(function(this: HookContext) {
  const latches = auditReactivity();
  if (latches.length > 0) {
    const title = this.currentTest?.fullTitle() ?? '(unknown test)';
    for (const latch of latches) {
      const line = `${title} — «${latch.label}» changed without a reactive edge (cached ${String(latch.cached)} → now ${String(latch.now)})`;
      reactivityFailures.push(line);
      console.error(`\n  ⚠ REACTIVITY LATCH after «${title}»: «${latch.label}» ${String(latch.cached)} → ${String(latch.now)}\n`);
    }
  }
});

after(function() {
  if (reactivityFailures.length > 0) {
    throw new Error(
      `${reactivityFailures.length} reactivity latch(es) — a predicate that caches read changed without a reactive ` +
      'edge (a plain let / array / Map term); make the term reactive at its source:\n  ' + reactivityFailures.join('\n  '));
  }
  if (teardownFailures.length > 0) {
    throw new Error(
      `${teardownFailures.length} component(s) threw while unmounting — a teardown ` +
      'defect, not a flake:\n  ' + teardownFailures.join('\n  '));
  }
});
