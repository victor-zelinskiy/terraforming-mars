# THE TEST CONTOUR — what «green» is allowed to mean

2026-08-14. A health pass over the whole test contour. The premise it fixes: a
run has to be able to tell the next agent whether THEIR change broke something.
Before this, it could not — the client unit suite had been reporting success
while executing nothing for six weeks, and the E2E report hid three tests behind
a cascade and blamed the product for its own boot.

Read `.claude/rules/tests.md` for the working rules; this file is the WHY.

---

## 1. «0 passing, exit 0» — the class, not the file

`CONSOLE_BLUE_ACTION_PARITY.md` carried a note about ONE spec
(`consoleRevealResultFlight.spec.ts`) that silently collected no tests. The file
was not the subject: **the whole `npm run test:client` suite behaved that way
from 2026-07-02 to 2026-08-14.**

The mechanism, end to end:

1. `webpack.config.js` splits `node_modules` into a cache group with a **fixed
   name** (`vendors`) and `chunks: 'all'`. A fixed name merges every matching
   module into ONE output chunk — including modules reachable only through a
   lazy `import()` (markdown-it's transitive deps via `CardHelp.vue`, gsap's via
   `gsapMotionBridge`, chart.js's via `VictoryPointChart`).
2. `vendors` is therefore a child of BOTH the initial entrypoint AND an async
   chunk group ⇒ `chunk.isOnlyInitial()` is **false** for it.
3. mochapack hands mocha only the `isOnlyInitial()` chunks
   (`mochapack/lib/webpack/util/getBuildStats.js`), so `vendors.js` is never
   loaded.
4. `main.js` starts up through `__webpack_require__.O(0, ['vendors'], …)` — a
   startup deferred until a chunk that will never arrive. **The entry module
   never executes**, and the entry module is what requires the specs.
5. No `describe` is registered. Mocha prints «0 passing» and exits **0**.

Every spec of a batch shares that one entry module, which is why a single spec
whose import graph touched a lazy chunk silenced the entire batch — and why
hand-picked batches (the ones the iteration notes reported as green) really were
green: they happened to contain no such spec.

**Fixed by `webpack.test.config.js`** — the unit runner builds ONE chunk: no
split chunks, and no async chunks at all (`dynamicImportMode: 'eager'`). The
production bundle (the BND-1 split) is untouched.
⚠️ `LimitChunkCountPlugin({maxChunks: 1})` is NOT a substitute — merging the
async chunk into `main` makes `main` a member of the async group, `isOnlyInitial`
goes false for it too, and mocha then receives no files at all.

**And the count is now an assertion.** Both `npm run test:server` and
`npm run test:client` go through `scripts/run-tests.mjs --min <floor>`, which
fails a run that collected fewer tests than the floor. Raise a floor when specs
land; never lower one to make a run pass.

## 2. A mount that is never unmounted is a live subscriber

With the suite finally executing, it failed 432 times in 6 minutes. Run in two
halves it failed 19 times in 55 seconds. The difference was not the specs:

| what ran | result |
| --- | --- |
| console specs alone | 2126 passing, 2 failing, 32s |
| everything else alone | 1977 passing, 17 failing, 23s |
| both together | 3712 passing, **432 failing**, **6m** |

Most specs never unmount their wrapper, and mochapack runs the whole suite in
one process. Several thousand live components stay subscribed to the fork's
module-level reactive state (`consoleState`, `journalState`, `notificationState`,
`presentationFlow`, `workspaceOutcomeState`, …), so every later spec's write
re-renders all of them — and stale components throw from inside whatever test is
running at the time.

`tests/client/components/bundleSetup.ts` (mochapack `--include`, so it shares one
`@vue/test-utils` instance with the specs) enables `enableAutoUnmount`.
**Consequence for spec authors: mount in `beforeEach`, never in `before`.**

Two traps it paid for, both now handled there:
* VTU clears its tracked list only AFTER its unmount loop, so ONE component that
  throws while unmounting is retried by every later test — a single offender
  reported as 3264 failures. A failure now resets tracking (`disableAutoUnmount`
  + re-arm) and is recorded, not propagated; the run still FAILS at the end.
* Mocha treats a failing root `afterEach` as fatal — that one offender stopped
  the run at 853 of 4144 tests, which looks like an early success.

The offender was real: `ModuleItemFilter.vue` threw out of Vue's `v-show`
teardown once it had re-rendered, reproducible through the product's own close
path. Fixed at the source (the list is filtered at its source instead).

## 3. `serial` turns one failure into silence

The CI report's «3 did not run» was not `maxFailures`, not a job timeout and not
a web-server crash: `console-colony-focus-probe` and `console-colony-trade-probe`
were declared `test.describe.configure({mode: 'serial'})`, so a failure in one
test marked the rest of the file as never-attempted. Two of those three tests
were in fact FAILING for their own reasons — the cascade had been hiding them.

Every test in those files (and in `console-play-landing-probe`) creates its own
game over the API and drives its own page. `serial` bought nothing and cost the
report. Removed there. Still present, unverified, in `console-card-lore`,
`console-colony-pluto-embed`, `console-colony-reward-rail` and
`console-trade-target-step` — check independence before removing.

## 4. The walk is SETUP — a spec must fail on its own claim

Four of the eight CI failures were one cause: `console-board-framing.spec.ts`
hand-rolled its pregame as a fixed cadence of key presses and decided the wizard
was over by counting nodes. All four tests died five minutes in with «boot stuck
— mounted: [.con-start__frame .con-handdock]», i.e. still inside the wizard,
having never exercised the framing they exist to guard. Moving them onto
`consoleStart.bootIntoGame` (the API path) fixed all four AND took the file from
four 300-second timeouts to 2.8 minutes green.

The same swap on `tv-profile-screens.spec.ts` (two blind press loops = ~80s of
unconditional sleeping per preset, five presets) took it from **10.8m to 3.8m**.

## 5. Probes must record, not poll

`console-colony-trade-probe` asked Playwright for five `count()`s between 200 ms
sleeps and concluded «the track-reset marker glide never played». Everything it
watched is transient by construction, and one polling pass cost ~0.5s of round
trips. It now arms an in-page recorder (`MutationObserver` + a 50 ms
`setInterval` — **never `requestAnimationFrame`**, which headless Chromium stops
driving exactly when the screen goes quiet) and **asserts its own sample count**,
so a dead probe can never read as «the product did nothing».

## 6. A blind press is not a test step

Three separate E2E failures were one shape: a single `keyboard.press` that a
heavy frame swallowed, reported as a product defect («the workspace refused to
fold», «the take is dead», «the trade did nothing»). The pattern that fixes it is
press → wait for the flow's OWN next observable → retry only if it never came,
bounded. Where the surface absorbs input during a beat, a re-press is safe by
construction and cannot double-submit.

## 7. What a gate must produce

`.github/workflows/playwright-e2e.yml` now shards the suite across four
independent runners (each with its own app + server, so isolation is structural),
merges the shards' `blob` reports into ONE HTML report, and records the exact
commit / shard / command / config next to the traces. `fail-fast: false` — the
point of a run is to learn the state of the whole suite.

## 8. The two failures that survived §1–§7 — one real bug, one removed door

2026-08-15, the point pass over what was still red. The split matters: one spec
was RIGHT and had caught a product bug; the other was WRONG about the product's
current grammar and had been passing its own first half silently for the same
reason it failed its second.

**`console-community-marker` — a REAL BUG, honestly caught.** After a
corporation first action that produces nothing card-shaped (Arcadian's marker
claim: `space`, then the action menu), the start workspace stood for twenty
seconds on an empty «ПЕРВОЕ ДЕЙСТВИЕ» stage swallowing every press — exactly
the window the spec pressed RT in, which is why it failed identically on all
three CI attempts. The mechanism was a DEADLOCK between two holds each waiting
for the other: `reconcileWorkspaceOutcome` kept the optimistic first-action
claim while the stage machine was running, and the stage machine
(`firstActionChainQuiet` → `firstActionLeaveDue`) could not go idle while the
claim stood (`embedActive`). Only the claim's 20 s backstop broke the loop.
Fixed by removing the stage arm from the reconciler (ConsoleShell): the
artifact-trail window it existed for (Celestic) is covered by the POSITIVE
evidence arms — `cardDrawReveals` rides the very answer that resolves a draw
(`DrawCards.keepAll` → `enqueueCardDrawReveal`), a pick is a claimed prompt
kind, an effect decision is its own predicate. The general lesson: **a claim
may be held only by evidence of its artifact, never by a stage that is itself
waiting on the claim** — a self-referential hold is a deadlock with a timer on
it, and the timer's duration is what the player experiences.

**`console-colony-focus-probe` (build test) — an OUTDATED spec probing a
REMOVED door.** The colonies overview deliberately lost its X («Осмотреть» and
«Выбрать» led to the same stage, so the bar advertised a choice that did not
exist — `ConsoleShell.handleSectionIntent`, `case 'inspect'`); the spec still
pressed KeyX to descend. Its first half — probe-only, no assertions — «passed»
silently over a stage that never mounted and printed numbers about nothing;
the guard half then read zeros off the same absent stage while the PRODUCT was
correct throughout (the cube seated on Luna, the std-projects flow concluded to
the board per the North Star). The spec now descends with A and additionally
pins the conclusion (`.con-stdp` and `.con-colonies` gone after the build).
The lesson extends §5: **a probe half with no assertion of its own subject is a
silent lie** — if a beat matters enough to sample, assert at least that its
surface MOUNTED, or the sampler reports the void as data.

## 9. An unbounded action against a panel that legitimately leaves

Found while verifying §8's product fix against its neighbours:
`console-corp-first-action` timed out at its full 300 s on EVERY run — before
and after the fix, i.e. pre-existing — with a healthy board home in the final
snapshot. The sink: the config leaves Playwright's `actionTimeout` at its
default **0 (unlimited)**, so `locator('.con-context').innerText()` against a
panel that has UNMOUNTED auto-waits until the test's own timeout reaps it —
and the placement loop's verdict read runs exactly one press after the press
that makes the panel leave. The `.catch(() => '')` around it guards a rejection
that never comes: with no action timeout there is nothing to reject.

The rule: **a read whose subject is ALLOWED to be absent must carry its own
`{timeout}`** — an absent panel is an ANSWER («the placement resolved»), never
a thing to wait for. A bare locator action is only safe when something else in
the spec already guarantees the node's presence (an assertion on the same
surface immediately before it).

## 10. A walk budget must not race an input gate — wait for the gate's own fall

The same sweep's second neighbour: `console-play-landing-probe · 4K` failed
intermittently (across BOTH builds, so unrelated to §8's fix) at «hand cursor
never reached <card>» — over a perfectly healthy, fully populated grid. The
hand's dock→grid OPEN REVEAL deliberately gates navigation until its flights
settle, and at 4K that episode can outlast the walk's entire 60-press budget:
the spec spent its patience knocking on a gated grid. §6 already names the
cure — press → wait for the flow's OWN observable — and the observable exists:
`.con-hand--transit` falls when the reveal episode releases input (the shared
driver's `playCardFromHand` waits on exactly that marker; the probe's local
walk predates it). A budget only measures what it is pointed at: pointed at
«presses until the cursor lands», it silently also pays for «presses until the
gate opens», and the second bill is load-shaped.
