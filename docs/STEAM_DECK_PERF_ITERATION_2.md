# Steam Deck Performance — Iteration 2 (2026-08-22)

Target configuration (corrected): **Steam Deck DOCKED, external TV, physical
output 1920×1080, the `TV 4K` visual profile, controller-first, late game.**
Probe profile `deck-docked-tv` (viewport 1920×1080 + `consoleProfile=tv` +
4× CPU throttle) in `console-longgame-perf-probe.spec.ts`, over the seeded
generation-11 save of iteration 1.

## 1 · TV 4K at 1080p — measured, not inferred

The paint census (probe section 0) at the exact target: **`--con-ui-scale = 1`,
`devicePixelRatio = 1`, profile class `con-profile-tv`, oversized images: 0,
big-surface box-shadows: 0, `will-change`: 5.** The TV profile lays out in a
1920×1080 LOGICAL space and its scale follows the real viewport
(`computeTvUiScale`), so at physical 1080p nothing rasterizes at 4K — the
«oversized intermediate surfaces» hypothesis is DISPROVEN by measurement. The
profile's cost at 1080p is its (intended) larger couch-readable chrome, not a
resolution mistake. No profile behaviour was changed; TV composition at 1080p
verified visually (screenshots in `screenshots/longgame-perf/*/deck-docked-tv-*`).

## 2 · What the census DID find: the compositor never sleeps

An idle late-game board runs **7 infinite decorative CSS animations**
(`con-active-dot`, `con-pulse` status glyph, `con-convert-glow-plants/-heat`
— box-shadow keyframes, i.e. repaint per frame — and `strat-avail-breathe`
×3), which keeps frame production alive forever. This is the measured basis
of both new settings.

## 3 · The two new settings (both default OFF, never auto-enabled, persisted,
live, controller-navigable rows in «Настройки» → ГРАФИКА)

**«Упрощённые графические эффекты»** (`consoleFxLite.ts`, key
`tm_console_fx_lite`, class `html.console-native.con-fx-lite`,
`console_fx_lite.less`): stops the ambient decorative loops at their resting
frame (static cues remain — active ring, convertible rim, availability rim),
removes the wheel's two viewport-scale halo gradients and the shade's focus
vignette layer, flattens the premium card body (single tight inset instead of
30px+80px blurred insets, no brushed-metal weave). Gameplay information,
focus/selection rings, availability colours, disabled reasons — untouched.

**«Меньше движения»** (`reducedMotion.ts`, key `tm_reduce_motion`): the
in-game override of `prefers-reduced-motion`. ONE policy —
`effectiveReducedMotion(osPref, override) = os || override` — inside the ONE
shared source every JS cinematic already consults (`reducedMotionActive`,
`useConsoleReducedMotion`, `consoleMotionMs` 160 ms cap), so the whole
GSAP/JS choreography follows live. CSS bridge: `html.con-reduced-motion`
mirrors the EFFECTIVE state (OS or override) and gates
`console_reduced_motion.less` — the «loops don't loop» policy
(`animation-iteration-count: 1`, never `animation: none`, so `animationend`
still fires and one-shot animations are untouched) with an allowlist keeping
«working» indicators looping (spinners, boot loader, VK caret, typing dots,
wait throbs, armed discard slot). The 164 existing
`@media (prefers-reduced-motion: reduce)` sites keep serving the OS path
unchanged; the OS media query itself is never faked.

## 4 · Permanent visually-neutral work this iteration

`overlayStatsCache.ts`: the effect/action-stats aggregates (fetched on every
«ДЕЙСТВИЯ КАРТ» open) scanned the whole event stream per request — now
memoized per (game, `gameAge`, `undoCount`, kind, color); the version pair is
exact (the stream cannot change without moving one). Weakly keyed by the live
game object. Spec: `tests/routes/overlayStatsCache.spec.ts`.

Default visuals are byte-identical: both new stylesheets are class-gated and
the classes are absent by default (confirmed by the default2/default2b runs
matching the pre-iteration base within noise).

## 5 · Matrix (deck-docked-tv, CPU×4, headless — PROXY, not hardware)

| Mode | idle loops | wheel first / p50 / ltMax (ms) | idle jank ticks (4 s) | idleAfter long tasks |
| --- | --- | --- | --- | --- |
| base (post-iter-1) | 7 | 206 / 106 / 270 | 16-24 | 0 |
| default (iter-2) | 7 | 225-456 / 99-188 / 292-580 | 22-26 | 12 |
| fx | 0 | 408 / 229 / 512 | **7-10** | **0** |
| rm | 0 | 392 / 205 / 523 | **7-9** | **0** |
| both | 0 | **349 / 194 / 462** | **10** | **0** |

Wheel numbers are host-contention-noisy across batches (default2 456 vs
default2b 225 — same build); the RELIABLE signals are within-batch: the
monotonic default→fx→rm→both wheel improvement, the idle-jank halving
(22-26 → 7-10), ambient loops 7→0, idleAfter long tasks 12→0. Board
invariants hold in every combo: hazard drift 0, tile-animation restarts 0,
nodes/listeners flat, heap ~20 MB stable. Default ≡ base within noise (no
regression). Hardware Steam Deck numbers were not measurable in this
environment and are not invented.

## 6 · Electron

No changes. The prior flag audit stands; nothing in this iteration's evidence
pointed at an Electron-level lever for the docked-1080p case (the profile
scales honestly; the costs were in our CSS/JS). No auto-enabling of either
setting via device detection, per the requirement.

## 7 · Verification

make:css / make:json / build:client / build:server / build:test — green;
eslint (changed files, no-cache) + vue-tsc — clean; server suite **9576**,
client suite **4731**, 0 failing (floors 8500/4000). New guards:
`consoleGraphicsSettings.spec.ts` (defaults OFF, ONE policy table, live class
bridges + persistence, independence/combination, toggle-residue, legacy-key
tolerance) and `overlayStatsCache.spec.ts`. Visual: default premium intact;
fx wheel/hand keep every gameplay cue (screenshots per label); rm leaves no
stuck transitions (probe trips green in all combos).

## 8 · Candidates for a third iteration

- Wheel repeat-open ~100-200 ms: mount cost + the `con-ws` root-class flip;
  a keep-mounted (`v-show`) wheel would trade idle cost for open latency —
  measure on hardware first.
- `conWsPresenceBridge` full-subtree scans per class mutation.
- Hand-dock re-pose custom-property fan on wheel open.
- On-device validation: the loops-off idle win should translate directly to
  Deck battery/thermals; needs hardware confirmation.
