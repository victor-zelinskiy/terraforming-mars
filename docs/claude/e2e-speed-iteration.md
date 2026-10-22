# E2E SPEED — the capital iteration (started 2026-10-21)

Status: **IN PROGRESS** — phase 0. Owner's framing: «имплементация всех новых карт и фич сильно тормозится
именно медленным e2e — надо подойти основательно». The box: the Steam Machine (`docs/claude/e2e-remote.md`),
12 threads / 15 GB / Navi 33, two slots, `--exclusive` for a timing.

## Decisions (the owner, 2026-10-21)

1. **Motion ×0.5 for functional specs — try it.** Timing / storyboard specs stay at ×1 (and `--exclusive`).
2. **The main profile is «TV» = a big screen and the right layout for it, not necessarily 3840×2160.**
   fhd per card may go; the TV layout may be verified at a cheaper raster, the true 4K kept for storyboards.
3. **CI stays CI** (its own Linux runners); the Steam Machine is for the local e2e only.
4. **`sudo` on the box** (CPU EPP etc.) — if a measurement says it matters; the owner runs the command
   or hands the password for the one occasion.

## Where the time goes — the facts before measuring

| Item | Fact | Lever |
| --- | --- | --- |
| hard sleeps | 733 × `waitForTimeout` = 897 s + 85 × `cinematicBeat` = 106 s over 374 specs (≈2.7 s/spec; the top 8 hold 143 s) | state waits; the ratchet locks every fall |
| the opening | 160 specs boot a fixture, 42 drive the API, **174 walk the live start in the UI** | fixtures (26.9 s vs minutes, measured once) |
| profiles | 142 specs run fhd AND tv4k | one TV profile per card — DONE (phase 4: 103 specs, 1396 → 1172 tests); the 4K raster is free on the box |
| video | `retain-on-failure` recorded EVERY test at 4K (ffmpeg per worker) | off by default — DONE (phase 1.1) |
| workers | GMO: 2.2 min @1 worker → 1.2 min @2; load 2.7 of 12 threads at 2 workers | scaling curve 1…8 (phase 0) |
| the box | EPP `balance_performance` (freq at max under load anyway), Steam idle 18 % CPU | small; measure before touching |
| wrapper | ≈12 s per run (5 ssh handshakes, sync, results pull) | the dev loop (phase 5) |
| a test | 13–20 s per GMO test at 1 worker — boot + fixture + walk + cinematics + settles: **unmeasured** | phase 0 |

## Phases

### Phase 0 — instrument and measure (first)
- [ ] per-test PHASE TIMING in the harness: boot (`openConsole`) · fixture (`bootFixture*`) · presses · `settle`
      (count + total) · `cinematicBeat` · raw `waitForTimeout` (count + total) · the rest = the product and the
      assertions; an annotation per test + a JSON line per test (`TM_E2E_TIMINGS=<file>`), a report script
      («where the seconds go», per spec and suite-wide).
- [ ] the WORKER-SCALING CURVE on the box: a fixed 20-spec sample at 1 / 2 / 4 / 6 / 8 workers — throughput,
      per-test inflation, CPU / GPU / memory.
- [ ] the FULL-SUITE BASELINE once (the timings file of every spec) — the worklist for phases 2–4.
- [ ] 4K vs TV@1080 on the same spec (is the raster a cost on the GPU box at all?).

### Phase 1 — free wins
- [x] video off by default (`TM_E2E_VIDEO=1` opts in).
- [ ] default workers per run from the curve; `--exclusive` stays the timing's.
- [ ] warm caches across tests (a persistent profile per worker: shader cache + HTTP cache) — if phase 0
      shows the boot is a cost.
- [ ] the box: EPP `performance` — only if measured.

### Phase 2 — sleeps and live starts (the bulk)
- [ ] **334 direct `page.keyboard.press(` in 148 specs** — spec-local `key()` / `tap()` helpers (a press +
      a fixed sleep, 450–800 ms) that bypass the driver's `press`, so neither the echo wait nor the
      adaptive quiet reaches them (`console-action-focus`: 27 such sleeps = 47 s of a 102 s file). A
      codemod routes the common shape through `press(page, code, settleMs)`; the driver guard then
      forbids a new one.
- [ ] the top offenders by `waitForTimeout` → state waits (`settle` / `pressUntil*` / witnesses); the
      ratchet baseline locked after each file.
- [ ] live-start specs → fixtures where the opening is not the subject.

### Phase 3 — motion ×0.5 for functional specs
- [ ] the product's `?motion=` preset through the driver for the functional class; pilot on 20 specs,
      classify the reds (a timing window → the `@timing` class, a bug → fix), then the suite.

### Phase 4 — the profile policy
- [x] **The 4K raster costs nothing on the box** (2026-10-22 04:1x): `TM_E2E_TV_RASTER=1080` (the harness
      swaps a 3840×2160 viewport for 1920×1080, `consoleProfile=tv` untouched → `computeTvUiScale` = 1, the
      same layout at a quarter of the pixels) ran GMO's four tv4k tests in 7.9–11.1 s against 9.3 / 7.8 /
      11.0 / 8.8 s at the real 4K — identical. The GPU rasters 4K for free; the time is motion and holds.
      The switch stays as an experiment's tool; the specs keep their 4K viewport.
- [x] **fhd per card is GONE** (2026-10-22, `scripts/e2e-codemod-drop-fhd.mjs`): the second profile DOUBLED
      every card spec for a layout the profile sweeps already cover. The codemod dropped the `fhd` line of the
      PROFILES / PRESETS table in **103 specs** — the suite is **1396 → 1172 tests (−16 %)** in the same 373
      files — and moved the «once» gates to the TV (`if (preset.id === 'fhd') { test(…) }`, an early `return`,
      a `shoot(page, 'fhd', …)` label on a one-off test that boots `PRESETS[0]`: seven files, twelve spots —
      the raster is free on the box, so «once» is «once, on the TV»). It KEEPS both profiles where the fhd branch
      asserts fhd-specific numbers (`blue-action-purchase` 26px heading, `prompt-family` 120 / 900 ms thresholds,
      `desc-tier-fit` the 1080 ladder, `card-lore-measure` per-profile line budgets, `terraformed-scene`
      budgetMs + `const FHD`, `finale-podium` three profiles with `tv:`), skips the timing class and the profile
      sweeps by name (`profile` / `screens` / `hud-frame` / `parity` / `frame`). `build:test`, the liveness
      guard (7/7) and the ratchet (755 / 42, unchanged) are green; the dropped tests have not been run on the
      box since (it is down) — the next baseline is the proof. **Policy for new specs: the TV profile only**;
      a second profile needs a reason in the spec (a profile-specific number), not a habit.

### Phase 5 — the dev loop
- [ ] `--profile` / `--grep` conveniences, a warm server, fewer ssh round trips.

## Phase 0 — the first instrumented sample (2026-10-21, Steam Machine, 2 workers)

`aaa-driver-canary` + `console-classic-gmo-contract` (8, fixture) + `console-action-focus` (3, live start):
12 tests, 235.9 s summed.

| bucket | s | share | note |
| --- | --- | --- | --- |
| press | 88.5 | 38 % | 94 presses — **84.5 s of it the FIXED 700 ms sleep after each** |
| boot (`openConsole`) | 71.8 | 30 % | 12 boots ≈ **6 s each** |
| sleep (bare `waitForTimeout`) | 47.1 | 20 % | all in `console-action-focus` (27 calls) |
| settle | 3.9 | 2 % | 14× — the state wait is CHEAP |
| fixture POST | 0.2 | 0 % | |
| **rest = the product + the assertions** | **22.1** | **9 %** | |

**The product is 9 % of a run.** The levers, re-ranked by this: ① the press sleep (an adaptive quiet wait
with the old 700 ms as the ceiling), ② the boot (6 s — split into shell / load / veil next), ③ bare
sleeps → state waits, ④ motion ×0.5 touches only «rest» and the part of the press wait a cinematic
really needs — far smaller than assumed.

**The boot's 6 s, split** (the same sample): `shell` (goto + the 10 MB bundle to the first paint) **0.7–0.8 s**,
`load` (the `.con-load` curtain) **1.8–2.9 s**, `veil` (the `.boot-loader` GPU warm-up) **2.3–3.3 s**. The bundle
is not the cost — the product's boot CHOREOGRAPHY is: the warm-up runs N phases × `motionMs(900)` to compile
Graphite pipelines for the PLAYER's session (`AppBootLoader.vue`), and the curtain holds its status text
≥ 1150 ms + a 620 ms reveal (`loadingScreenState.ts`) so it never flashes. An e2e test is a fresh browser
context every time: the compiled pipelines die with it, the curtain's dwell protects nobody. ≈ 4.5 s of
every boot × ~1000 boots in the suite ≈ an hour. Lever: a URL switch (`fastboot`) that skips the warm-up
phases and zeroes the curtain's minima — functional class only; the storyboard/timing class keeps the
warm-up (the first-draw shader stall is exactly what it measures, PL-625).

**The adaptive press pilot** (`TM_E2E_FAST_PRESS=1`, the same 12 tests): press 88.5 → 45.7 s, the run
236 → 197 s, 12/12 green — but **94 → 142 presses**. The press trace (`TM_E2E_PRESS_TRACE=1`) named it:
`walkFocusUntil` pressed →←→←→→ where the normal press pressed →→ — the adaptive press returned at
~155 ms (the console quiet), the walk read its witness (the rail's card name) at once, it had not landed
yet, «wall», turn around. The law for every press-then-read loop: **the witness gets the WHOLE old window
to change before «no change» is believed** (`pressUntil` had it; `walkFocusUntil` has it now).

**The fast boot pilot** (`TM_E2E_FAST_BOOT=1` → `?fastboot=1`: no warm-up phases, no curtain minima; the
same 12 tests, with the fast press): boot **72.0 → 26.3 s** (veil 34.8 → 0, load 27.6 → 16.3 = 1.4 s per
boot of real readiness, shell unchanged 0.8), the run **236 → 151 s (−36 %)**, 12/12 green. The 1.4 s left
in the curtain is its READINESS holds — `fonts` (ConsoleShell), `start-scene`, `board-fit` (two settled
frames), `atmosphere` (the background decode) — paid per fresh context; only a warm cache across tests
(phase 1.3) can shorten them.

**The DOM-quiet press** (the second pilot build): the walk's ping-pong gone (94 presses again), but the
press now waits the surface's REAL entrance — RT's wheel ≈ 800 ms, X's viewer ≈ 950 ms (the census: the
idle board mutates nothing but the document title once a second, so those waits are the product's own
motion). The sample 151 → 175 s against the console-quiet-only press — honest, and exactly the number
motion ×0.5 halves.

## The broad sample (28 specs / 138 tests, two runs side by side on the box, load ≈ 5)

| run | result | time | press | rest |
| --- | --- | --- | --- | --- |
| CONTROL: fast boot + fast press, motion ×1 | 131 / 138 | 24.5 min | 794 s | 912 s |
| the same + motion **×0.5** | 131 / 138 | 21.4 min (**−14 %**) | 689 s | 748 s |

The reds, by class:
1. **The lock dwell** (`frontier-labs` B ×2, `tile-language` ×2 — in BOTH runs): `commitFocusedSpace` /
   `placeTile` pressed the confirm right after the lock press returned; the fixed 420 ms used to cover the
   product's 280 ms dwell by accident, the adaptive press returns at ~270 ms and the confirm landed INSIDE
   the dwell, ignored. Fixed: `lockedPlacementSeen` — the lock SEEN (`.con-board--locked`) and the dwell
   passed before the confirm. Re-run: 10 / 10.
2. **Timing witnesses** (`aerial-mappers` B tv4k, `supercomputer` B tv4k — `endsOverGlass`; `cursor` tv4k —
   «a face that jumped with no motion»; `parliament-sitting-reward` RX01/RX02 — «the tick rides the
   touchdown», flaky under the two-run load in BOTH runs): the storyboard / timing class — real motion,
   `--exclusive`, never the fast flags. The class is DECLARED (`tests/e2e/timingSpecs.ts`), the driver
   drops the flags for it.
3. `info-dossier` B fhd («the plate unfolds from the zone's own box») — in both runs, not motion: bisected
   — red with fastboot alone, with the fast press alone, AND with no flag at all (1 failed / 1 passed on the
   current build): a pre-existing flake of the unfold's first-frame sampler, not the iteration's. Reported.

## The class defaults (shipped after the sample)

`tests/e2e/timingSpecs.ts` declares the TIMING class (the seed: the four reds above, the motion-grammar
guards, every `*probe*` — 35 files); everything else is FUNCTIONAL and gets, with no env flag at all,
`?fastboot=1` + the adaptive press + `?motion=0.5`; a timing spec gets the real boot, the fixed settle,
motion ×1. The driver decides per test from `test.info().file`; `TM_E2E_FAST_BOOT` / `TM_E2E_FAST_PRESS`
(`0`/`1`) and `TM_E2E_MOTION=<x>` override for a bisect. The list grows from the full-suite run: a timing
red joins it with its reason, a logic red is fixed.

Verified with no flags (beside the owner's game, by their word — `TM_E2E_BESIDE_GAME=1`): the canary and
GMO booted in 1.6–1.9 s with the adaptive press (avg 420–680 ms per press, the surfaces' real entrances);
`console-cursor` booted in 6 s with the fixed settles, 8/8 at ×1. Two GMO fhd reds in that run («the
«Сработает» row stands», «board home never became live» with no press yet) did not reproduce on a
`--repeat-each=2` (4/4): a transient of the game's load, not the configuration.

## Phase 2, the `key()` codemod — and the OLD specs it exposed (2026-10-22, night)

`--write` rewrote 70 files (the ratchet locked 831 → 761). Validating on ten of them (old live-start specs:
`action-focus`, `auto-tile-landing`, `blue-action-*`, `board-framing`, `bot-corp-award-office`,
`wheel-rework`, `tv-profile-screens`, `colony-cube`, `hazard-placement`):

| configuration | result |
| --- | --- |
| the class defaults (fast boot + adaptive press + ×0.5) | 10 / 24 |
| the codemod, every fast flag OFF | 12 / 24 |
| three of them, fastboot ONLY | `action-focus` 3/3 · `tv-profile-screens` 2/4 · `wheel-rework` 2/3 |
| the same ten at HEAD (no codemod), every flag OFF | 12 / 24 — the SAME eight files red (only the flake count per file moves) |

So most of these reds are neither the flags' nor (pending the control) the codemod's: the files were last
touched 2026-09-08/09, six weeks of console rework ago — `wheel-rework` waits for `/базовые/i` on the
wheel's kicker, a copy the product no longer has; `tv-profile-screens` sleeps 1600 / 3500 ms for «fonts»
and «the deal» instead of waiting on state; «the Period wheel never opened», «standard projects sheet never
opened», «board home never became live». SPEC ROT, hidden until now because nobody ran them locally and
CI's flake ledger absorbs retries. The full functional baseline enumerates it; each red is then classified:
ROT (fix the witness or delete the check), TIMING (the list), LOGIC (a bug). The 28-spec sample of
RECENT specs is the honest measure of the defaults: 131 / 138.

**Phase 2 tooling ready**: `scripts/e2e-codemod-key-helper.mjs` rewrites the spec-local `key()` / `tap()`
helper (a press + a fixed sleep) into `await press(page, code, settleMs)` — a dry run matches 70 of the
78 files; the rest have a three-line body and go by hand. Run it the day the fast press is the default
(until then the driver's `press` is the slower of the two for a 450 ms helper).

## ⚠ SOURCES ARE PER TASK TOO — a shared `tests/` poisoned a running baseline (2026-10-22, 04:00)

The second full baseline (338 specs, 2 workers, the pad stubbed) was 90 ✓ / 607 ✘ fourteen minutes in.
Not the product: my TV-raster experiment had synced a broken `consoleTest.ts` (a `screen` fixture
Playwright refuses) into the SHARED `~/tm-e2e/repo/tests/` while the baseline ran — and Playwright
RESTARTS a worker after every failure, re-reading the harness, so one bad file turned every later test red
in seconds. The build had been made per task on day one for exactly this class; the sources had not. Now
`src/`, `tests/` and the config files are synced into `~/tm-e2e/builds/<task>/` as the task's own copies
(only `assets/` and `node_modules` stay shared links), the run's cwd is the task dir and `TM_E2E_ROOT` is
unset — a neighbour's sync can no longer touch a running run's sources. (The box went down right after the
owner's game ended, before this could be validated — the resume point is in memory.)

## ⚠ A PHYSICAL CONTROLLER ON THE BOX REACHES THE E2E BROWSERS (2026-10-22, 03:30)

After the load artifact was cleared, the 7-spec sample was STILL 16 / 48 red at 2 workers exclusive on a
cool box — while every red test passed alone. The canary's screenshot said it: «Действия карт» open on
the board home right after boot, and PlayStation glyphs on the bar where the evening's screenshots had
Xbox ones. A Steam Controller (its puck, `/dev/input/js0`) had been plugged into the Steam Machine with
the owner's game at 23:48; distrobox mounts the host's `/dev`, headless Chromium exposes the pad through
the Gamepad API, the console read it — a resting trigger opened the actions workspace, a drifting stick
walked the cursor. The harness now stubs `navigator.getGamepads` to `[]` on every page (the driver speaks
keyboard); the same sample: 48 / 48 in 4.8 min. **The worker-scaling curve of 03:0x is void** (orphans +
the pad); it re-runs on a clean box.

## ⚠ The full baseline of night 1 was a LOAD artifact — do not read it (2026-10-22, 03:00)

338 functional specs at `--workers=4` beside the owner's game: load 12.6 on 12 threads, 77 °C, 49 Chrome
processes at 100–137 % CPU each — and 374 ✓ / 366 ✘ by 03:00 (`console-parliament-gallery` 50 red / 67
green, the shape of timeouts, not of bugs). Killed. The lesson the plan already held and I skipped: **the
worker-scaling curve FIRST** (phase 0.2) — the 28-spec sample at 2 workers was 131/138; 4 workers on a
4K suite is past this box's knee. The full baseline re-runs on an idle box at the measured worker count.

## Journal
- 2026-10-21 — iteration opened; video off; the timing ledger (`tests/e2e/timing.ts`, the `timing`
  annotation, `TM_E2E_TIMINGS` + `scripts/e2e-timings-report.mjs`); the first sample above; the
  adaptive-press pilot behind `TM_E2E_FAST_PRESS=1`.
- 2026-10-21/22 (night) — shipped in order: `7ea2b3a42b` (phase 0 ledger, video off, the press pilot) ·
  `520da8095a` (`?fastboot=1`, the DOM-quiet press, the walk's witness window) · `4b349db242` (the lock
  dwell, `?motion=<x>`, the opening buckets, the A/B script, the codemod script) · `301f19b103` (the class
  defaults + `timingSpecs.ts` + `TM_E2E_BESIDE_GAME`) · `c999d5bae8` (the `key()` codemod, 70 files, the
  ratchet 831 → 761). Pending: the full FUNCTIONAL baseline (338 specs, 4 workers, auto-started when the
  owner's game ends — `.e2e-remote/baseline-functional.txt` + `.e2e-remote/baseline/test-results/timings.jsonl`
  → `scripts/e2e-timings-report.mjs`), then the classification of its reds (ROT / TIMING / LOGIC), the
  worker-scaling curve on an idle box, TV@1080 (phase 4), the sleeps pass and the live-start → fixture pass
  (phase 2), the eight `key()` helpers with a three-line body by hand.
- 2026-10-22 (morning, the box DOWN since ~04:05 — ssh times out, no ping) — `727172167f` (the last eight
  `key()` helpers, the ratchet 755, `TM_E2E_TV_RASTER=1080` measured: the 4K raster is free). The per-task
  SOURCES restructure of the wrapper is written and `node --check`-clean but UNVALIDATED (the canary runs the
  moment the box answers — a background waiter polls ssh). Meanwhile phase 4's last lever shipped without the
  box: `scripts/e2e-codemod-drop-fhd.mjs` dropped fhd from 103 card / feature specs (1396 → 1172 tests);
  `build:test`, the liveness guard and the ratchet green. Still pending: the canary on the per-task layout →
  commit the wrapper; the full FUNCTIONAL baseline at 2 workers and its ROT / TIMING / LOGIC classification;
  the worker-scaling curve; the sleeps and live-start passes.
- 2026-10-22 (midday) — **the e2e browser is the PRODUCTION engine's major** (the owner's call, path 1 of three):
  Electron 45.0.0 carries Chromium 156.0.8078.48; Playwright 1.62.1 drove Chromium 151.0.7922.34 — five majors
  behind the players. `@playwright/test` 1.62.1 → **1.64.1 = Chromium 156.0.8078.4**, the same release branch
  (8078). The 1.64 breaking change that bites here: the device descriptor's `screen` is forwarded into the
  emulation, so `window.screen` would read 1920×1080 under every 4K viewport while `consoleLayoutProfile.ts`
  reads the screen — the project opts out (`screen: undefined` → the screen is the viewport, as a TV reports its
  panel). Deferred, offered: Chrome for Testing 156.0.8078.47 via `executablePath` (exact-patch; the .48 exists only
  inside Electron) with a guard tied to the Electron version; the real Electron through `_electron` (full flag
  parity with `electron/perf.ts`, but Electron has no headless — a display on the box means xvfb = software
  raster against PL-211, or the owner's gamescope session). The box installs the new browser itself on its next
  run (`npm ci` on the lock change → `npx playwright install chromium`). Verified on the laptop: `--list` 1180
  tests, the e2e tsconfig clean, the liveness guard 7/7 (the shared tests tsconfig is red on a neighbour's
  in-progress file, not on the harness).
  **The owner's goal restated 2026-10-22: the fastest suite AND 100 % green on the Steam Machine — the old specs
  get updated, «гоняем и правим пока не будет полного покрытия», then the owner runs CI.**
- 2026-10-22 (afternoon) — **the box on the production engine and the first full functional baseline.**
  The Steam Machine ran Node 22 / npm 10, which refuses every lock npm 11 writes («Missing: webpack@5.112.0»),
  so the 1.64.1 bump never reached it: `~/tm-e2e/node` → `node-24/` (24.20.0, the laptop's), and an install now
  takes the WHOLE box (`e435691cde` — a lock mismatch makes the run exclusive; `npm ci` rebuilds the shared
  `node_modules`). The per-task sources layout validated (canary 5.6 s), its legacy `tests` link removed BEFORE
  the compare (`d9163632f5` — the first baseline found «No tests found»). Workers measured: 4 = load 3–12 of 12
  threads at 62–74 °C, clean; 4 + 4 = load 23, CPU 98 % — past the knee, the second shard stopped.
  **The baseline (337 functional specs, 1037 tests, 4 workers, one retry) as the worklist, each red classified
  and fixed the same afternoon:**
  | class | specs | what |
  | --- | --- | --- |
  | PRODUCT | bonus-action-handoff | «Фора»'s auto-resolve flew from a shelf still fading in → `98b5eda965` (the wave waits for a VISIBLE source) |
  | PRODUCT | parliament-actions, parliament-v2 | a card-actions workspace folds before a production-M€ token's birth (the T09 fold sentinel) — handed to a sub-investigation |
  | DRIVER | arboretum, aquatic, canyon, red-museum, re-settlement | a raw confirm inside the 280 ms lock dwell → `confirmLockedPlacement` (`382f70f874`) |
  | DRIVER | campaigns-list | a press that navigates threw in the quiet wait → tolerant (`b986accfdd`) |
  | DRIVER | gamepad-first-press, gamepad-reload-carryover | the harness's pad stub was read-only → `writable: true` (`3e2079731d`) |
  | DRIVER | parliament-aquifer / -biodome / -cloud | the walk home did not answer TR61's research buy → RT in `waitForBoardHome` (`c1fc0cbd89`) |
  | SPEC (read too late) | fringe-colony, notification-source, parliament-ban | an assertion on a surface that legitimately left (a receipt's one read, a card's TTL, the walk's next page) → read in the same sample |
  | SPEC (sub-pixel) | payment-panel | Chromium 156 re-rounds the same layout by 0.2 px → whole pixels |
  | TIMING (→ `timingSpecs.ts`) | delta-card-advance, expedition-mechs, ichtiology-grant, habitat-science, overclocked-equipment, ma-states, parliament-colonial / -reds-budget / -research / -sitting-v4 / -marsfirst-budget / -renewal / -urban, planet-focus | each red at ×0.5 and green with only `TM_E2E_MOTION=1` (or the full timing configuration) — durations, flight witnesses, storyboards |
  | FLAKY (to repeat) | colony-venus-cells | a 300 s timeout once, green on the retry |
  **Live start → API** (phase 2's biggest single lever, measured in this baseline): the 17 MarsBot corporation
  specs 62.0 → 9.3 s per test (`d664ce5754`), five more 48–71 → 8–14 s (`264178e2cc`). The specs that keep the
  UI walk photograph or assert the opening itself (start-*, firstact, tv-profile-screens).
  Next: the baseline's tail, the TIMING pass `--exclusive --workers=1` (38 + 16 specs), the second profile pass
  (46 files name their 1080 row `standard-1080` — the shared `PARLIAMENT_PRESETS` stays: the geometry guards
  of the Parliament are profile sweeps by contract), the sleep pass ranked by the full ledger.
- 2026-10-22 (evening) — **the baseline's reds closed; the TIMING class run whole.** The functional re-verify of
  every fixed spec: 156 / 156. The fixtures saved mid-opening (`startGamePrompt`) are now answered over the API
  when the spec wants the board (`58636197de` — colony-venus-cells had stood 300 s on the start's purchase plate):
  the seven specs on them 21 / 21. The TIMING class (58 files, `--exclusive --workers=2`): 196 passed, 0 red,
  4 flaky — re-judged at one worker (`--repeat-each=2`): finale-podium C′ 2 / 2 (it was the load);
  parliament-sitting-reward 9 / 18 red, TWO causes, both the driver's / the spec's:
  ① **a deciding press inside the decision's settle window** (`promptSequence.ts` — the shell swallows A / X / the
  bumpers / the triggers for 300 / 650 / 1100 ms after a decision arrives): RX01's recipient pick stood right
  after the reward wave and the fixed press landed in the window. `press()` now waits the window out for a
  deciding key (`__conPromptSequence().settleLeftMs`, bounded 1.5 s; a spec that ASSERTS the swallow presses raw);
  ② RX02 / RX04's «every hold released at rest» read the holds LIVE after the analysis — by then the walk had
  turned to the results page on its own and its beat (`parliament-sitting:results`) was standing: the next page's
  hold, not a leak → excluded by name. After both: 35 / 36 — RX01 once more, A consumed by the console and
  nothing sent, the settle window closed. The pick's A is now act → verify → retry (a retry only when the press
  moved NOTHING — no record, no request, no hold) with the state each swallowed press met printed. The re-run
  (`--exclusive --workers=1 --repeat-each=2`): **36 / 36**, the retry never fired — if the swallow comes back,
  its line in the run's output names the gate.
  **Where the seconds still are** (the full ledger, 1081 tests, 26 162 s summed): the adaptive press 31 % — of
  which 6 671 s is its own quiet wait, ≈ 410 ms a press, floored by `PRESS_MIN_MS` 120 + `DOM_QUIET_MS` 100 +
  `PRESS_QUIET_MS` 150 (a lever, not pulled while chasing green: every press race is a flake); bare sleeps 17 %
  (tv-profile-screens 474 s, parliament-biodome / -aquifer / -cloud ≈ 290 s each — 69 sleeps × 0.7 s in ONE
  enactment test, inside driver helpers, not the spec: the next pass traces them by call site); boot 10 %.
- 2026-10-22 (night) — **THE FINAL FUNCTIONAL RUN on fresh HEAD (`2e15e0f06d`, 318 specs / 937 tests,
  `--exclusive --workers=4 --retries=1`, 1.2 h): 930 passed · 0 failed · 3 flaky · 4 skipped.** No hard red — the
  owner's CI is next, and CI's runners are weaker than the box, so the three flakies are hardened rather than
  retried away:
  | spec | class | cause → fix |
  | --- | --- | --- |
  | console-final-greenery | PRODUCT | the own landing measured its cell at the verify while the finale's camera was still moving the board; the «−8» touched down in the NEIGHBOUR cell (`cell:24`, the greenery on 25). The landing now waits for a calm board and re-measures when the board's space moved (`settledHexRect` — the remote stage's own rule), and the price is aimed at the cell ELEMENT (T06 live end). `board-placement-flow.md` § THE TILE LANGUAGE, word 8 |
  | console-info-dossier (D) | SPEC (probe clock) | «the plate unfolds from the zone's box» read the FIRST `setInterval` tick, which came after the whole 160 ms door under load (3001 × 1736). The start pose is written in the same task as the plate's class (`fromTo`), so the first sample of either clock reads it; the door's OPENING is asserted from the plate's growth |
  | console-prelude-burn-gate | DRIVER | a stray pick («Metal-Rich Asteroid») held the second place before the walk began, so the limit refused «Business Empire» on three visits. `pickCards(…, {exclusive: true})` takes a stray back on the way; the shortfall trail now names what the step held at the start |
  **The TIMING class on fresh HEAD** (`4bb9907f76`, built in a clean worktree so a neighbour's uncommitted client
  could not enter the measure; 59 files, `--exclusive --workers=2 --retries=1`, 44 min): 202 passed · 1 red · 1 flaky ·
  10 skipped. Both closed: ① console-supercomputer (C) — a HARNESS hole: the gamepad stub and the DOM-quiet clock were
  installed only in the test's own context, so a second seat's `browser.newContext()` saw the box's physical pad, a
  phantom Y opened «Информация» on red's page and its R never reached the journal (3 / 4 at one worker). Every context a
  test opens now gets the same page harness (`pageHarnessScript`) and the same sleep book; the five specs with a second
  seat 36 / 36. ② console-social-heating — the read of the RESULT row was document-wide while the plan's row still
  stood in the DOM unpainted (its `innerText` «»); scoped to the result layer and read the moment it paints — 12 / 12.
