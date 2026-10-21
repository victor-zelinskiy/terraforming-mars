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
| profiles | 142 specs run fhd AND tv4k | one TV profile per card; 4K only where the raster is the subject |
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
- [ ] one TV profile per card (the layout at a cheaper raster if phase 0 says the raster costs), 4K only
      for storyboards / timings; fhd dropped where it duplicates.

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

**Phase 2 tooling ready**: `scripts/e2e-codemod-key-helper.mjs` rewrites the spec-local `key()` / `tap()`
helper (a press + a fixed sleep) into `await press(page, code, settleMs)` — a dry run matches 70 of the
78 files; the rest have a three-line body and go by hand. Run it the day the fast press is the default
(until then the driver's `press` is the slower of the two for a 450 ms helper).

## Journal
- 2026-10-21 — iteration opened; video off; the timing ledger (`tests/e2e/timing.ts`, the `timing`
  annotation, `TM_E2E_TIMINGS` + `scripts/e2e-timings-report.mjs`); the first sample above; the
  adaptive-press pilot behind `TM_E2E_FAST_PRESS=1`.
