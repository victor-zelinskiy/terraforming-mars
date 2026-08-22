# Steam Deck Performance — Iteration 3 (2026-08-22)

Third production performance iteration. Target configuration unchanged:
**Steam Deck DOCKED, external TV, physical 1920×1080, `TV 4K` profile,
controller-first, generation-11+ game, long session.** All work is
shared-architecture — the same changes serve Windows Electron, Steam Machine
and browser play.

Baseline: commit `f5599af552` (iteration 2) + harness-only instrumentation
(`ingest:*` perf marks in `App.update`, no-ops unless `?perf=1`). Probe:
`tests/e2e/console-longgame-perf-probe.spec.ts` **v2** over the seeded
generation-11 save (`tests/perf/seed-longgame.ts`, now TWO variants). All
numbers: headless Chromium, 1920×1080, `consoleProfile=tv`, CPU ×4 —
**PROXY, not Deck hardware** (§16).

## 1 · Executive summary

1. **The idle main thread was ~55 % busy (at ×4) doing nothing — now 0.**
   A 3 s idle trace on the settled board: `Layerize 805 ms + UpdateLayoutTree
   429 ms + Paint 360 ms + PrePaint 71 ms` — a full style→layerize→paint
   pipeline ~58× per second, forever. Attribution: the three
   `box-shadow`-keyframe ambient loops (`con-active-dot`,
   `con-convert-glow-plants/-heat`); the four opacity loops are
   compositor-driven and innocent. **Fixed by architecture, not by
   reduction**: identical visuals now run as compositor-only
   opacity/transform loops on pseudo-element overlays (§14). After: the same
   idle trace totals **~96 ms per 10 s** (≈1 % at ×4), idle jank ticks
   **13→0**, and the probe's own 16 ms meter starts getting idle-throttled in
   the reduced modes because the renderer produces no frames at all (§4a).
2. **State delivery is NOT the bottleneck — measured, closed.** Late-game 2P
   payload ≈ 40 KB (early ≈ 15 KB); server model build 2.7 ms p50 / 4.6 p95,
   stringify 0.34 ms (§9). The full-snapshot protocol stays.
3. **Client ingest of an opponent's action: 118–179 → 96 ms** total at ×4
   (fetch TTFB ~31 / body+parse ~38 / share+commit **9.3–12.7 → 2.4** /
   flush ~38–43). The apply side got three reactive-graph fixes: raw-tree
   structural sharing, identity-stable MA HUD zones, the `handEntriesAll`
   release watcher re-keyed to a cheap membership computed (§10, §19).
4. **The gamepad poll loop was the largest permanent idle scheduler**
   (~185 samples/s: an 8 ms timer + an unconditionally re-arming rAF, each
   `getGamepads()` allocating a fresh pad graph; the armed rAF also forced
   frame production at display rate forever). Now idle-adaptive: at rest the
   rAF driver stops and the timer relaxes to 16 ms; the first active sample
   re-arms 8 ms + rAF in the same tick, worst-case +8 ms on the first press
   after 1.5 s of quiet (§19.2). Code-confirmed; hardware-verifiable only
   (headless has no pads).
5. **Wheel**: cold 154–184 → 130–134 ms; warm p50 80–91 → **71** ms; the
   baseline's warm→late degradation (p50 +15–25 %) **disappeared** (late
   65–73 ms — it was ambient-pipeline contention, not a leak). Clean traces
   now attribute the remaining cost: **Layerize** (compositing assignment
   under the dock-raise transitions + shade + overlay), not JS — sync JS is
   ≤0.4 ms and the Vue flush ≈ 71 ms(×4) ≈ ~18 ms native (§12).
6. **The hand album decoded 8 full-res arts ≈ 48 MB, every one oversized**
   (>2.5× its rendered size). The played grid already had the 512-px thumb
   tier; the hand did not. Now tiered by the same `artTierForWidth` rule
   (+ focused-card full-art prewarm, + the flight proxies decode the
   destination's tier): **48 MB → 5.3 MB, oversized 8 → 0** (§15).
7. JS allocation churn is a non-issue in this scenario: ~0.0 MB per 10 s
   idle, ~0.2–0.3 MB per 6 wheel cycles (§8).

## 2 · Code and configuration baseline

- Product: `f5599af552` (perf iteration 2), working tree clean.
- Harness delta measured WITH the baseline: `ingest:*`/`playerView:commit`
  marks in `src/client/components/App.vue` (gated by `perfMarks.perfEnabled`,
  i.e. `?perf=1` / `tm_perf=1` — zero-cost otherwise).
- Server: `LOCAL_FS_DB=1`, port 8127, production build (`npm run build`).
- Seeds: variant **A** `-perflong` (viewer to act — the wheel/idle scenario of
  iterations 1–2, unchanged) and variant **B** `-perflongb` (rival to act,
  rival holds sellable patents, `undoOption: true` — the ingest scenario).

## 3 · Benchmark methodology improvements (probe v2)

- **Warm-up before measurement**: the cold open is reported ALONE (it carries
  the action-preview pre-warm by design), then 2 uncounted warm-up cycles,
  then the measured batch.
- **Sample counts + distribution**: wheel warm batch n=10, late batch n=6;
  every batch reports p50 / p95 / max / mean / **MAD**, plus raw per-cycle
  samples in the JSON report. No single-best-run conclusions.
- **Cold / warm / late-repeat separated**; the late batch runs AFTER the six
  hand-workspace round trips — the progressive-degradation axis.
- **Per-interaction phase attribution**: press → end-of-sync-JS (a microtask
  enqueued from a capture listener — after every synchronous handler, before
  Vue's flush job) and press → surface-in-DOM (MutationObserver ≈ end of the
  Vue patch). Style/layout/paint attribution lives in
  `scripts/perf/trace-wheel.mjs` (per-event-name totals from a real Chromium
  trace); long tasks per cycle via PerformanceObserver.
- **Ingest cycles are REAL updates**: the rival sells a patent / undoes it
  through the production `/player/input` endpoint; the viewer's client (a
  real console shell) receives each update through its own poll/WS path; the
  `ingest:*` marks split fetch (TTFB) / body+parse / share+commit / flush.
- **Comparability**: every labeled run gets a fresh seed AND a fresh server
  process (`scripts/perf/run-longgame-matrix.sh` /
  `run-longgame-final.sh`); marks cleared per cycle; GC forced only BETWEEN
  phases; runs invalidated by concurrent host activity are called out
  explicitly (§22's fx/rm/both matrix singles ran beside editor activity —
  the controlled default pairs did not).
- **No brittle CI thresholds**: the probe stays env-gated
  (`LONGGAME_PERF=1`); its asserts are sanity-of-scenario only.
- Supporting tools: `scripts/perf/alloc-wheel.mjs` (heap sampling),
  `tests/perf/bench-model.ts` (server model cost),
  `scripts/perf/summarize-longgame.mjs` (side-by-side reports).

### 3a · A meter limitation this iteration exposed

The 16 ms tick-jitter meter conflates «main thread busy» with «renderer so
idle that Chromium throttles timers». With the ambient pipeline gone, the
fx/rm windows collect only ~132–136 ticks per 4 s (ideal ≈ 250) with
tick-gaps up to 689 ms — the page produces no frames at all and the METER
gets throttled. Interpret `tickJank50` together with `tickCount`: a
low-tick-count window is deeper idleness, not jank. The default mode keeps
compositor animations alive, so its meter stays honest (209 ticks, 0 jank).

## 4 · Before/after — deck-docked-tv, CPU ×4, same scenario

| Metric | base a | base b | final (default) |
| --- | --- | --- | --- |
| idle 4 s BEFORE: jank50 ticks (tickCount) | 13 (180) | 11 | **0 (209)** |
| idle 4 s AFTER interactions: jank50 | 17 (164) | 25 | **0 (205)** |
| wheel COLD press→DOM | 154.6 | 183.8 | **133.8** |
| wheel WARM p50 / p95 / MAD (n=10) | 80.1 / 92.7 / 4 | 90.7 / 168.8 / 15.8 | **71.0 / 75.8 / 4.3** |
| wheel LATE p50 / p95 (n=6) | 105 / 131.1 | 100.6 / 199.3 | **65.4 / 96.3** |
| longest task in wheel batches | 163 | 247 | **122** |
| ingest total p50 | 118.4 | 178.7 | **96.2** |
| — share+commit p50 | 9.3 | 12.7 | **2.4** |
| — flush p50 | 43.1 | 71 | **38.2** |
| hand album decoded images | 48 MB / 8 oversized | — | **5.3 MB / 0** |
| nodes / listeners across trips | flat 4368→4369 / 273 | flat | flat 4376 / 273 |
| heap (GC'd) | ~19.4 MB flat | flat | ~19.4 MB flat |
| hazard drift / anim restarts | 0 / 0 | 0 / 0 | 0 / 0 |

Board-home census (both before and after): 7 infinite animations by name,
will-change 5, doc nodes 2344, `<img>` 0, decoded images 0 MB. The SAME
loops exist after the fix — they simply run on the compositor.

## 5 · Idle trace attribution (the busy-idle root cause)

BEFORE (3 s, ×4): `Layerize 805.1 ms (175) · UpdateLayoutTree 429.4 (174) ·
Paint 360.1 (700) · PrePaint 71.2 (175) · FunctionCall 28.9 (8) · TimerFire
26.1 (7)` — ~58 full pipeline runs/s driven by the box-shadow keyframe
loops; JS idle work (leak detector, holds net, pollers — iteration 1's cuts)
is the small remainder.

AFTER (10 s, ×4): `UpdateLayoutTree 32.4 ms (8) · FunctionCall 32.1 (10) ·
TimerFire 31.8 (9) · Layerize 21.6 (7) · Paint 6.8 (14)` — ≈1 % duty at ×4;
the residue is the 1 Hz leak-detector pass + pollers. **The idle main thread
approaches quiescence while the small compositor-only loops keep breathing.**

## 6 · Hidden-surface / reactive-graph audit (what was found)

- 310 computed properties on the shell; 55 root template branches; ~72
  watchers. `v-show` surfaces stay fully live: board section (deliberately,
  with the engineered `fitKey`/`fitMode` idle-cost fix — the model), strategy
  rail, hand dock, collapsed endgame workspace.
- **Strategy rail**: `hudMilestoneZone`/`hudAwardZone` returned fresh objects
  per evaluation → the rail re-rendered and its `observeZone` ledger watchers
  ran on EVERY response — hidden included. Fixed: §19.3.
- **`handEntriesAll`** force-built (2 Sets + map + `potentiallyAvailable` per
  card + two filter passes) on every response by a watcher whose handler only
  clears one string. Fixed: §19.4.
- Collapsed endgame workspace stays fully reactive behind the board — real
  but endgame-scoped; deferred (§26).
- No `keep-alive` anywhere; every lifecycle above is a deliberate choice.
- Schedulers at rest: gamepad poll (~185/s → §19.2), leak detector 1 Hz
  (single combined traversal since iteration 1), focus tick 400 ms
  (console-owned scopes early-out), notification poller 2.2 s
  (version-gated, WS-stretched), waitingfor chain 1 s/20 s (WS-stretched).
  Dev-only: the overflow guard. Latent flagged: `ConsoleCardFocusFrame.vue`
  (unmounted dead component with an unbounded per-frame measure loop),
  `scaleTooltipState`'s never-removed capture scroll listener.

## 7 · State payload and ingestion (measured, mostly disproven)

- Payload late 2P: **39.6 KB** (`players` 11.8 K, `waitingFor` 10.6 K, `game`
  8.7 K incl. `spaces` 4.6 K, `thisPlayer` 7.1 K); early: 14.9 KB.
- Server model build (`bench-model.ts`, n=60 hot): early 0.32 ms p50 → late
  **2.73 p50 / 4.57 p95**; stringify 0.34 ms. `/api/player` E2E on the dev
  host 23–75 ms (HTTP + event loop, not model work).
- Client: the whole `PlayerViewModel` is deeply reactive; nothing opts out.
  The structural-sharing walk ran THROUGH the live proxy — per-property trap
  overhead + eager child-proxy materialization of the entire old tree on
  every commit. Fixed: raw-vs-raw walk (§19.5), share+commit p50 9.3–12.7 →
  2.4–3.8 ms across five runs.
- Verdict: **no protocol redesign warranted** — the costs worth taking were
  all on the apply side. Undo / reconnect / spectator / bot flows untouched.

## 8 · Allocation / GC

Heap sampling (8 KB interval): ~0.0 MB per 10 s idle; ~0.2–0.3 MB per 6
wheel cycles; retained heap ~19.4 MB flat through every run. The one
systematic churn source is `navigator.getGamepads()` (a fresh pad/button
graph per call, ~185 Hz with a pad attached) — cut ~3× at rest by §19.2;
verify minor-GC cadence on hardware. One 21.9 ms MajorGC appeared inside a
wheel-close trace — rare and not user-visible at this frequency.

## 9 · Server / payload work

See §7. Nothing server-side sits on the interaction critical path at this
scale (iteration 2's `overlayStatsCache` stands, its keying verified:
weak-keyed by game object, versioned by `gameAge:undoCount` — correct under
undo and game replacement). No server changes this iteration.

## 10 · Ingest pipeline (client, per real opponent update, ×4)

`fetch TTFB → body+parse → (stage placements + structural share + commit) →
reactive flush + render` = p50 ≈ 31 / 38 / 2.4 / 38 ms after (96 ms total),
with one ~50–65 ms long task per applied update in the baseline shrinking
with the commit fix. Own-action updates travel the WaitingFor POST path,
which shares the same share+commit+flush machinery.

## 11 · Wheel / con-ws / dock / bridge — findings

- Press → sync-JS ≤0.4 ms; press → in-DOM (Vue flush incl. the ~40-node
  wheel mount, `quickEntries`, command-bar rebuild, dock `raised` prop fan)
  ≈ 71 ms ×4 ≈ ~18 ms native; then style/compositing (§12).
- `.con-root--ws-open` (presence-bridge class) semantics kept; the bridge now
  scans only on mutation batches that could carry a marker (§19.6).
- **HandDock re-pose**: verdict — already sound. Posing is pure custom
  properties (no measured rects), FLIP deliberately disabled, the raised
  pose is one class flip whose transitions run on the compositor. No change.
- Keep-mounted wheel: **rejected for now** — the mount is ~18 ms native
  inside a 71 ms flush; a persistent wheel would trade permanent idle
  subscriptions for a fraction of that, and the dominant remaining cost is
  compositing, which a `v-show` wheel would not remove.

## 12 · AFTER traces (clean of ambient noise)

- IDLE: §5 — quiet.
- WHEEL WARM open (~1.2 s window incl. entry motion): `Layerize 140.2 ms
  (27, max 26.5) · UpdateLayoutTree 78.4 (103, max 18.7) · FunctionCall 37.1
  · Paint 32.9 · Layout 19.7`. **The wheel is now compositing-bound**: the
  dock-raise transitions promote ~20 card layers, the shade fades, the
  overlay mounts — every dirtied frame re-runs compositing assignment at
  ~5–26 ms (×4). Candidates if hardware ever shows it hot: fewer promoted
  dock layers during the raise, halo simplification (fx already removes it —
  its warm p50 62 vs 71 default).
- WHEEL FIRST open additionally carries `FunctionCall 53.8 + Layout 44.8`
  (the pre-warm + first-mount layout) — the cold/warm split the probe
  reports.
- WHEEL CLOSE: `Layerize 178 ms (60) · UpdateLayoutTree ~124 (2 big spans
  745/368 elements)` — the un-raise + `.con-root--ws-open` removal restyle.
- HAND OPEN: `UpdateLayoutTree 504.8 (202, max 101.3 @2537 elements) ·
  Paint 267.4 · Layout 153.2 (max 78.7) · Layerize 111.8` — the album is the
  heaviest single open in the console and stays iteration-4 material
  (staged-mount waves like the played tableau are the known pattern);
  the thumb tier already removed the decode share.

## 13 · Electron / Chromium

No Electron changes; no new flags. The measured costs were all in our CSS/JS
(ambient paint pipeline, reactive fan-out, schedulers). What this iteration
REMOVES at the renderer level is the app's own forced frame production at
rest (armed rAF + box-shadow loops) — with those gone, Chromium's normal
idle throttling engages on every platform (visible in §3a). Browser vs
Electron production behaviour is expected to track this identically; the
Electron smoke check rides the ordinary desktop build (§23).

## 14 · Default visual effects — compositor-only ambient loops

The three box-shadow loops re-implemented with identical visuals:

- `con-active-dot` → fixed-shadow `::after` ring breathing on
  `transform: scale` + `opacity` (`con-active-ping`);
- `con-convert-glow-plants/-heat` → static row shadow at the loop's resting
  frame + an `::after` overlay carrying the delta to the bright frame with
  composite-compensated alphas (rest + d·(1−rest) = peak), breathing on
  `opacity` (`con-convert-breathe`).

Overlays: base `opacity: 0`, `pointer-events: none` — so `animation: none`
(fx-lite) and the OS reduced-motion path rest exactly on the old static cue.
The fx-lite stop-list and `console_reduced_motion.less` were extended to
pseudo-elements (`*` never matched `::before/::after`; the «working
indicators» allowlist got the same pseudo forms). Both settings keep their
prior semantics — they now simply have less main-thread work left to remove.
Contract pinned in `.claude/rules/console-ui.md` § Paint baseline (4): a new
ambient loop must be compositor-only and join both gates.

## 15 · Image / GPU memory

Board home renders **zero** `<img>` (procedural chrome). The art-bearing
surface — the hand album — held 8 full-res decodes ≈ **48 MB, all >2.5×
oversized** for their ~272-px slots at 1080p. Fixed by the same tier rule
the played grid ships: `artTierForWidth(plan.slotW)` (the album's solved
slot width is real CSS px), full art at 4K's ~544-px slots, thumb (512-px
build) below; focused card's full art prewarmed (debounced 160 ms) for the
fullscreen inspector; the hand-open flight proxies read the destination
tier from `handRevealState.artTier` so a flight decodes the same file its
landing slot paints. Result: **5.3 MB decoded, 0 oversized**; `.pcard`
class signatures unchanged (the tier is a source swap), so the hand-open
parity contract holds.

## 16 · Real-device evidence vs proxy

Everything here is the headless ×4 PROXY. Hardware-only follow-ups:

- gamepad idle-adaptive drivers (headless has no pads): verify with the
  `[gamepad]` stdout lines + rest-state battery/thermals;
- Deck battery/thermal effect of the quiet idle pipeline (expected to be the
  headline on-device win);
- docked-TV frame pacing.

On-device capture stays lightweight and opt-in: `?perf=1` enables the marks
+ long-task logging; the probe runs against any reachable host
(`BASE_URL=…`); nothing heavy ships enabled.

## 17 · Confirmed root causes

1. Box-shadow keyframe ambient loops → full main-thread pipeline per frame,
   forever (≈55 % of ×4 main thread at idle).
2. Structural-sharing walk through the live reactive proxy → trap overhead +
   eager full-tree proxy materialization per commit (share+commit ~3–5×
   costlier than raw).
3. Fresh-identity MA HUD zones + the `handEntriesAll`-keyed watcher →
   hidden-surface work on every response.
4. Dual always-on gamepad drivers → permanent frame production + allocation
   churn at rest (code-confirmed).
5. Hand album on full-res art → 48 MB decoded, 8/8 oversized.
6. The baseline's wheel warm→late «degradation» → ambient-pipeline
   contention (disappeared with №1; late p50 now ≤ warm).

## 18 · Disproven hypotheses

1. «The payload / snapshot protocol is a bottleneck» — 40 KB, parse ~9 ms
   native-equivalent; NO.
2. «Server model construction is hot» — 2.7 ms p50; NO.
3. «UI JS allocates heavily» — ~0.2 MB per 6 wheel cycles; NO (the churn is
   the pad poll, addressed).
4. «The wheel's remaining cost is its mount / a v-if vs v-show question» —
   sync JS ≤0.4 ms, flush ~18 ms native; the remaining cost is compositing
   (Layerize), which keep-mounting would not remove; NO (for now).
5. «fx/rm idle jank ticks (13–17) mean reduced modes got slower» — meter
   throttling artifact of a fully idle renderer (§3a); the modes are
   QUIETER, not jankier.
6. «TV 4K secretly rasterizes 4K at 1080p» — re-confirmed disproven
   (census: uiScale 1, DPR 1, oversized 0 — unchanged from iteration 2).

## 19 · Implemented architectural changes

1. **Compositor-only ambient loops** (`console.less`, `console_fx_lite.less`,
   `console_reduced_motion.less`) — §14. Invalidation/lifecycle: pure CSS;
   gates extended to pseudos; rule pinned.
2. **Idle-adaptive gamepad drivers** (`gamepadCore.ts`): REST = 16 ms timer
   only; HOT (activity ≤1.5 s ago) = 8 ms + rAF; flip happens in the same
   tick as the first engaged sample, before its intents dispatch; the timer
   never stops while pads are present+visible (the «never rAF-only» contract
   intact); stopLoop/visibility/uninstall reset the mode.
3. **Identity-stable MA HUD zones** (`ConsoleShell.vue` + module-level
   `shareViewSnapshot` memo): unchanged content ⇒ same object ⇒ Vue 3.4
   computeds notify nothing; correctness is content-comparison (safe across
   remounts), zone data is plain JSON.
4. **`departingPlayCardGone`** tiny computed + re-keyed watcher
   (`ConsoleShell.vue`): tracks one string while idle; O(hand) only while a
   card is actually departing; releases the held slot the moment the card is
   gone (strictly earlier than the old entries-keyed watcher in the edge
   case, never later).
5. **Raw-tree structural sharing** (`viewSnapshotShare.nextViewSnapshot` →
   `shareViewSnapshot(toRaw(prev), next)`): identity guarantees unchanged —
   Vue caches proxies per raw target, so shared raw branches resolve to the
   same child proxies the previous render used. Guarded in
   `viewSnapshotShare.spec.ts` (reactive-prev case + undefined-in-array).
6. **Presence-bridge record filtering** (`conWsPresenceBridge.ts`):
   `recordsCouldMatter` — substring class test ('con-ws' /
   'con-board--pfocus', over-match = harmless extra scan) + added/removed
   subtree `matches`/`querySelector` (detached removals still queryable);
   `attributeOldValue: true` required for the removal edge. The scan stays
   the single source of truth. Guarded: deep-wrapper add/remove + unrelated
   churn cases in `conWsPresenceBridge.spec.ts`.
7. **Hand album art tier** (`CardFace.vue` artTier passthrough,
   `ConsoleCardFaceLite.vue` artTier, `ConsoleHandSection.vue` tier +
   prewarm + `handRevealState.artTier` stamp, `ConsoleHandRevealLayer.vue`) —
   §15.
8. Harness (not product): probe v2 + seed variant B + `ingest:*` marks +
   trace/alloc/bench/matrix/summarize scripts.

## 20 · Before/after — same scenario

§4 table. Every improvement above is same-seed / same-profile / same-probe;
default-mode pairs were collected on an otherwise idle host.

## 21 · Early vs late cycles

Baseline: warm p50 80–91 → late 100–105 with widened MAD (both runs) + idle
jank growth (13→17, 11→25). After: late p50 65–86 ≤ warm 71–95, idle after
= idle before = 0 jank, nodes/listeners/heap flat over 6 workspace trips
and 17+ wheel cycles. **Repeated interaction cost no longer grows within
the session** (proxy scale).

## 22 · Mode comparison (after build)

| Mode | loops running | wheel warm p50 | wheel late p50 | ingest p50 |
| --- | --- | --- | --- | --- |
| default | 7 (compositor) | 71.0–95.3 | 65.4–100.9 | 96–122 |
| fx | 0 | 62.2–75.3 | 72.4–73.3 | 122–136 |
| rm | ≤3 (one-shot rest) | 73.7 | 78.8 | 123 |
| both | 0 | 68.0 | 65.6 | 121 |

fx keeps a real wheel-open edge (the halo). Idle: all modes quiet; fx/rm
tick-meter numbers are the §3a artifact (deeper idleness). The fx/rm/both
matrix singles ran beside editor activity on the host — treat their
absolute values as coarser than the default pairs. Gameplay behaviour
identical across modes (same flows, same probe asserts green).

## 23 · Tests and builds executed

- `npm run make:css` · `make:cards` (via build:client) · `build:client` ×3 ·
  `build:test` — green.
- `npx eslint --no-cache` on every touched file — clean; `npm run
  lint:client` (vue-tsc) — clean ×2; full `npm run lint` — green (final
  battery).
- Server suite + client suite (floors 8500/4000) — green (final battery; the
  run-tests floor guard active).
- Probe: baseline ×2, after-matrix ×5 (default×2/fx/rm/both), final ×2 —
  every run's sanity asserts green (board present, hazards, wheel+hand
  opened, ≥8 warm samples, ingest ≥3 applied).
- Targeted e2e on the final build:
  `console-wheel-commit-geometry.spec.ts` + `console-workspace-band.spec.ts`
  — **9 passed** (the presence-bridge filtering and the wheel's commit
  geometry hold end-to-end across profiles).
- Guards added/extended: `viewSnapshotShare.spec.ts` (+2),
  `conWsPresenceBridge.spec.ts` (+2).

## 24 · Visual / controller verification

- BEFORE/AFTER board screenshots pixel-equivalent (convertible rims, active
  dot, chrome identical); wheel/hand screenshots per label under
  `screenshots/longgame-perf/<label>/`; dedicated open-wheel + open-hand
  shots (default and fx) under `screenshots/longgame-perf/visual-verify/`
  (`scripts/perf/shot-verify.mjs`) — the RT cross, halo, availability
  reasons, dock and album chrome intact; the thumb-tier hand is visually
  indistinguishable at slot size.
- Probe invariants in every mode: hazard drift 0, tile-animation restarts 0,
  `--intensifying`/`--placing` residue 0, no stale wheel (each cycle
  re-verifies `.con-quick` mount/unmount), hand opens/closes 6× per run.
- Controller semantics: input path untouched except poll cadence at REST
  (+8 ms worst-case first press after 1.5 s quiet, full 8 ms + rAF during
  any activity); keyboard bridge (the probe's driver) unaffected — all flows
  green.
- Reduced-motion: no stuck transitions (rm/both runs complete every trip;
  `animationend` semantics preserved — iteration-count:1 policy, `none` only
  on the fx stop-list).

## 25 · Real Steam Deck evidence

None this iteration (no hardware in the environment) — §16 lists the
on-device checks and the lightweight capture path. No hardware numbers are
claimed anywhere above.

## 26 · Remaining candidates for iteration 4 (ranked by expected value)

1. **Hand album open** — the heaviest single open (recalc 505 ms + layout
   153 + paint 267 at ×4): staged mount waves (the played-tableau pattern),
   and/or trimming the 2537-element restyle span.
2. **Wheel compositing** — fewer promoted dock layers during the raise
   (Layerize peaks 26 ms ×4); fx's halo cut as default-equivalent
   engineering (a cheaper halo, not a removed one).
3. Collapsed endgame workspace stays fully reactive (endgame-scoped).
4. Initial load (root visible 3.5–6 s at ×4) — bundle parse/eval dominated.
5. Delete `ConsoleCardFocusFrame.vue` (dead unbounded-rAF component);
   detach `scaleTooltipState`'s capture scroll listener.
6. On-device validation pass (the §16 list) — battery/thermals at rest
   should now be the visible win.
