# Steam Deck Performance — Iteration 1 (2026-08-22)

First end-to-end performance iteration targeting **progressive late-game lag on
Steam Deck** (the performance floor device). Everything here was measured and
implemented against the current production code; older perf reports were used
only as pattern references, never as evidence.

## 1 · The paint baseline is PERMANENT (the old performance flag is gone)

The opt-in «Производительность» profile (`con-perf-lite`) became the only
production behaviour:

- `src/styles/console_paint_baseline.less` — `html.console-native * { filter:
  none !important; text-shadow: none !important; }`, unconditional.
- Deleted: `consolePerfMode.ts` (runtime flag + persistence), the settings row
  (`consoleSettingsModel.ts` Graphics category), the RU locale keys, the
  `.con-perf-lite .con-card3d__edge` override (its cut is now the base rule),
  `console_perf.less`.
- Old persisted `tm_console_perf_lite` localStorage keys are simply never read
  again — старые установки стартуют как прежде.
- `box-shadow` is deliberately KEPT (the focus/selection ring language).
  Motion untouched. Desktop UI untouched (the gate is `html.console-native`).
- Contract: `.claude/rules/console-ui.md` § Paint baseline;
  `docs/claude/console/performance-mode.md` describes the history.

## 2 · The hazard-tile jump — root cause and fix

**Mechanism (confirmed, not guessed):** the console board section is `v-show`n
(the headless `SelectSpace` needs its cells mounted), so every section
workspace round trip (рука / колонии / гидросеть / журнал) takes `.con-board`
through `display:none → ''` — which, per the CSS Animations spec, RESTARTS
every CSS animation still standing in the subtree. The hazard-intensify pulse
(`board-space-tile--intensifying`, a one-shot `scale 1→1.16→1` keyframe) was
keyed off a CACHED computed whose reactive deps never change again, so the
class + its pinned negative delay stayed on the tile forever — the code
predates the no-remount rework and assumed a remount would clear it. Net: any
hazard that ever intensified replayed its pulse on every workspace close.

**Fix:** the pulse is now DATA + an expiry timer (`refreshIntensify` in
`BoardSpaceTile.vue`, mirroring the existing `--placing` pattern) — the class
leaves the DOM when the 1.4 s window ends, so a later display flip has nothing
to restart. Legitimate intensify pulses still play once, continuously across
re-renders. Regression spec: `tests/client/components/board/BoardSpaceTile.spec.ts`
(expiry + «appearance never pulses»). The board-framing invariants
(`--board-scale` / `--con-board-dx/dy` stability) already had their own guard
(`console-board-framing.spec.ts`) and the fit engine was confirmed keyed
(`fitKey`) — the container does not re-fit on a visibility flip.

## 3 · Action-wheel latency (late game)

**Найденный механизм:** `openQuick('actions')` ran `ensureActionPreviews`
SYNCHRONOUSLY before the wheel's first render: a whole-tableau fingerprint
string, an un-memoized `renderData` walk per action card, and a fetch burst —
one `/api/action-preview` per action source (10–20 late game) — fired in one
synchronous stack. On the Deck the embedded server shares the APU with the
renderer, so N preview computations landed exactly under the wheel's entry
animation.

**Fixes (все сохраняют горячий кэш к моменту «спуска» в ДЕЙСТВИЯ КАРТ):**
- the pre-warm now runs **after the render flush** (`$nextTick`), so the
  wheel's first frame owes it nothing;
- `collectActionNodes` is **memoized per CardName** (printed renderData is
  static) — `actionExtraction.ts`;
- the fetch fan-out is **bounded (4 concurrent)** with a FIFO queue; a
  fingerprint change **aborts** stale in-flight requests (`AbortController`)
  so fresh previews never wait behind garbage — `actionPreviewStore.ts`.
  Spec: `tests/client/components/console/actionPreviewStore.spec.ts`.

## 4 · Per-second ambient cost (progressive-feel killers)

- **Leak detector (1 Hz, session-long):** the serving/desktop-surface passes
  were ~30-38 separate whole-document `querySelector`s per tick (cost grows
  with the DOM, which only grows over a match). Now ONE combined
  `querySelectorAll` traversal per list; the desktop-telemetry reactive field
  is written only when it CHANGED (`consoleLeakDetector.ts`). Checking every
  match of the combined list is strictly more correct (a hidden twin can no
  longer mask a rendered surface).
- **`refreshAnimationHolds()` every second** (the phantom-hold net) bumped a
  version that invalidated a fresh `{all, blocking}` object each tick — every
  dependent (admission signals, idle flags, presentationFlow) re-derived once
  a second on a quiet board. The `counts` computed is now **identity-stable**
  (returns the previous object when nothing changed) — the tick ends at the
  counts boundary. The net's guarantee (≤1 s staleness for any supplier) is
  untouched. Spec: `animationHold.spec.ts` («does not re-fire dependents»).
- **NotificationLayer poller (2.2 s, unconditional):** the full-generation
  rebuild (`buildJournalView` + three diff walks + impact recompute) now
  SKIPS when the payload signature is unchanged
  (`undoCount:generation:len(messages):len(events)` — append-only within one
  undoCount, so equal lengths ⟹ identical content). The fetches stay (the
  simultaneous-phase fallback contract).
- **Server:** `/api/game/logs` walked the WHOLE log from index 0 for every
  generation request; `/api/game/journal-events` filtered the whole event
  stream. Both now find the requested generation's window **from the tail**
  (the hot request is the current generation) — O(generation), not O(match).
  Specs: `tests/routes/ApiGameLogs.spec.ts` (existing, green),
  `tests/routes/ApiGameJournalEvents.spec.ts` (new).
- **MarsBot turn archive:** `botReplayAvailableFor` scanned a reactive Map per
  journal row (O(rows × turns), and the ITERATE read re-ran every row's
  computed on any new turn). Now a per-key correlation index — O(1) per row,
  row-scoped invalidation (`marsBotTurnArchive.ts`).

## 5 · The reproducible long-game scenario

`tests/perf/seed-longgame.ts` — a REAL serialized save (все тайлы через
движок): 2 players, generation 11, ACTION phase (viewer to act), 37 tiles
(9 oceans + 10 cities + 14 greeneries + Ares dust storms + 3 seeded erosions),
tableaus 57/48 cards, 8 cards in hand, 671-entry log + the real event stream,
colonies on. Probe: `tests/e2e/console-longgame-perf-probe.spec.ts`
(`LONGGAME_PERF=1`, deck profile = 1280×800 + 4× CPU throttle; idle windows,
8 wheel cycles, 6 hand round trips with a board-stability census, CDP
node/listener/heap snapshots).

## 6 · Before/after (deck-handheld, CPU×4, headless — PROXY numbers, not
hardware Steam Deck)

| Metric | baseline (2 runs) | after (2 runs) |
| --- | --- | --- |
| Wheel FIRST open, press → in-DOM | 412.8 / 466.1 ms | **180.6 / 306.0 ms** |
| Wheel repeat open p50 | 213.7 / 93.4 ms | 95.9 / 187.4 ms (шумно) |
| Longest task during wheel cycles | 512 / 566 ms | **239 / 410 ms** |
| Long tasks in 4 s idle AFTER activity | 10 (547 ms) / 2 (116 ms) | **0 / 0** |
| Hazard-tile drift over 6 workspace trips | 0 px | 0 px |
| Tile animations running after close | 0 | 0 |
| Nodes / listeners across trips | flat 4256 / 270 | flat 4256 / 270 |

Host contention makes single runs noisy (repeat-open p50 overlaps); the
first-open and post-activity-idle deltas are consistent and mechanistically
explained. The intensify-restart jump is not reproducible in a seeded save
(it needs a LIVE mild→severe upgrade in-session), so its regression lives in
the unit spec, while the e2e pins the general invariant (no drift, no
animation restarts, no node/listener growth).

## 7 · Electron / runtime

Inspected, deliberately NOT changed in this iteration: the Deck runs the
measured-good recipe (ANGLE-Vulkan + Skia Graphite via the bypass switch;
Steam Machine on Ganesh-Vulkan after the flicker gate; Windows on D3D11
Graphite). The prior flag audit (PERFORMANCE_AUDIT.md, итерации 4-10) already
exhausted safe flag levers; this iteration's wins are in OUR code, exactly as
that audit predicted. No new flags were added; no user-facing performance
option was introduced.

## 8 · Deferred candidates (visually significant — NOT implemented)

1. **`.con-quick__halo`** — two large radial gradients re-rastered under the
   wheel's `scale .96→1` entry tween (area scales with viewport; biggest on
   4K TV). Options: pre-promoted layer for the entry's duration, or a smaller
   halo. Visible tradeoff: none if layered correctly, but layer-promotion has
   its own cost — measure on TV first.
2. **Effect/action stats fetches** (`/api/game/effect-stats`, `action-stats`)
   scan the whole event stream on each «ДЕЙСТВИЯ КАРТ» open — could be cached
   by `(gameAge)` server-side. Not visual; deferred as out of this
   iteration's risk budget.
3. **`conWsPresenceBridge` full-subtree scan** on every class mutation (3
   `querySelector`s per coalesced microtask) — already far better than the
   `:has()` it replaced; a further cut would need marker bookkeeping at every
   `con-ws` mount site (risk > win today).
4. **Hand-dock re-pose on wheel open** (6 custom props over the pack) — by
   design (the fan-out pose); could be gated to the RT wheel only if TV
   traces ever show it hot.

## 9 · Verification

- `npm run make:css` / `make:json` / `build:client` / `build:server` /
  `build:test` — green.
- `npm run lint:client` (vue-tsc) — green; eslint (`--no-cache`) on every
  touched file — clean; `npm run lint` — green (see the iteration commit).
- Server suite + client suite — green (counts above their floors).
- Targeted: `ApiGameLogs.spec` 13 ✓, `ApiGameJournalEvents.spec` 4 ✓ (new),
  client BoardSpaceTile/animationHold/consoleLeakDetector/actionPreviewStore
  31 ✓ (incl. 5 new regression specs).
- The long-game probe (baseline ×2, after ×2) with screenshots under
  `screenshots/longgame-perf/<label>/`.
