# PERFORMANCE_AUDIT.md — Electron Performance Initiative (§17)

Consolidated, prioritized performance audit of the client (Vue 3 Options API, `src/client`)
for both the browser and the Electron desktop shell. **Additive** to the pre-existing
`PERF_INVESTIGATION.md` (B1–B15, some applied) — this doc collects the §17 initiative's
findings (7 parallel read-only subsystem audits) and drives the Perf-0…5 phases.

**Discipline (§17):** measure-first. Every finding is tagged:
- **[HOT]** = clearly-understood hot path, look/behavior-preserving, safe to apply now.
- **[MEASURE]** = real mechanism, but the *magnitude* needs a DevTools/contentTracing capture before investing.
- **[ELECTRON]** = desktop-only (gate behind `desktopMode` / build flag).

No optimization removes a premium visual — the fixes drop *wasted* work (blur over an
opaque background, an unused `mix-blend-mode`, a re-query in a computed) or shrink the
package. Every applied change is verified against `build:desktop` + the test suite.

---

## Perf-0 — instrumentation (SHIPPED in this pass)

`src/client/utils/perfMarks.ts` — zero-cost unless enabled via `?perf=1` /
`localStorage tm_perf=1`. Provides `mark()` / `measure()` / `time()` (User Timing →
shows in DevTools Performance + Electron `contentTracing`) + a **long-task observer**
(logs every main-thread task ≥ 50 ms — the fastest way to find jank without per-site
marks). Wired at: app bootstrap (`main.ts`), the model-apply + `playerkey` remount
(`App.vue`), and the WS-invalidation wake. Add more `mark()`s at any suspected hot path.

**How to measure the baseline (Perf-0/1, your part — needs the GUI):**
1. Launch `?perf=1` (browser) or set `localStorage.tm_perf='1'` in the desktop app.
2. DevTools → Performance → record: startup→menu, enter a game, open each overlay,
   an opponent's turn (WS update), a tile placement, endgame reveal.
3. Read the **User Timing** track (our marks) + the **long-task** console warnings.
4. Compare Electron vs browser on the same flows.

---

## The systemic root cause (context for everything)

`<player-home :key="playerkey">` **used to full-remount** the entire game subtree on
nearly every server response (`App.vue` commit → `playerkey++`). WebSocket made this
fire *sooner and more often* than polling did (RT4). It dominated board + panel cost:
Board, ~61 `BoardSpace`→`PlayerCube`, arc-scales, and every `AnimatedMetricValue`
re-mounted and re-ran their `mounted()` work on each poll (A3). The ~46 module-level
singletons existed *only* to survive this remount — direct evidence it was the
pervasive tax. This was `PERF_INVESTIGATION.md` **B1**.

> **✅ RESOLVED (2026-07 NO-REMOUNT rework — `REMOUNT_ANIMATION_REWORK_DESIGN.md`).**
> `<player-home>` is now keyed on a CONSTANT `playerHomeKey` and lives for the whole
> session; every response applies a fresh `playerView` **reactively** through
> **structural sharing** (`src/client/utils/viewSnapshotShare.ts` — `nextViewSnapshot`:
> a content-identical tree in which every deep-equal branch keeps the PREVIOUS ref, so
> ~61 `BoardSpace`s stop re-rendering on a resource-only update and the panels stop
> re-rendering on a board-only update). `playerkey` survives as the transient-UI RESET
> EPOCH (`PlayerHome.resetTransientUi()` via the `:reset-epoch` prop), NOT a `:key`.
> **A3** is closed: `AnimatedMetricValue` now fires chips ONLY from honest watch
> transitions; a genuine mount is a SILENT baseline (mount-diff only under the legacy
> `?remount=1` flag). The unified **motion system** (`motion/motionTokens.ts` — presets
> `calm|standard|swift`, `--motion-scale`, `createFrameGate` FPS cap, `MOTION_EASE`) is
> the brief's Цель B, shipped. Rollback ladder: `?patch=0` (wholesale swap) / `?remount=1`
> (legacy keyed remount). Verified: `build:desktop` green, 20 rework specs passing.
> The module-level singletons were deliberately KEPT (they still carry the legacy-flag
> remount + survive the reload-game boundary). **B1 is no longer the lever — the backlog
> below is now the whole remaining surface**, re-triaged for the post-remount world.

---

## Applied now (Perf-2 safe shared wins — SHIPPED in this pass)

| ID | Fix | File | Why safe |
|---|---|---|---|
| PKG-1 | **Exclude tooling/backup/legacy art + source-maps from the desktop package** (`assets/generated/refs/backup*` ≈105 MB, `assets/original`+`assets/resources/original` ≈5 MB, `**/*.map` ≈11 MB) | `electron-builder.yml` | grep-verified 0 runtime references; maps only used by DevTools. **Big installer shrink.** |
| CSS-1 | **Notification card `backdrop-filter: blur(10px)` → removed** (background is already ~95 % opaque, blur is wasted; layer is App-level, always mounted over the animating board) | `notifications.less` | Look-preserving; the glass reads from the opaque gradient+border+shadow. |
| CSS-2 | **Drop `mix-blend-mode: screen` on the always-visible bar-button shimmer** (forces a per-frame blended composite pass on the bottom rail whenever a milestone is claimable) | `player_home.less` | White-on-dark `screen` ≈ plain opacity here; sweep + gradient unchanged. |
| BRD-1 | **`Board.spaceMap` → `computed`** (was rebuilt in `data()`, non-reactive to `spaces` — worked only because of the remount; latent bug) | `Board.vue` | Zero behavior change today; **unblocks** moving the board off the remount later. |
| BRD-2 | **Drop the native `:title` on every board tile** (61 `$t()` translate calls per remount for a tooltip the fork's design bans — the premium hover popover supersedes it) | `board/BoardSpaceTile.vue` | Aligns with the no-native-`title` rule; the popover already shows the info. |
| RT-1 | **Fix the `PlayerTimer` `setTimeout` leak** (self-re-arming 1 Hz chain with no teardown → orphaned timers accumulate across every remount, wake the event loop each second — bad for Electron idle power) | `overview/PlayerTimer.vue` | Store id + clear in `beforeUnmount`; real leak fix. |

(These are applied + verified in the same change as this doc. Instrumentation above is also shipped.)

### WAVE 2 — SHIPPED (post-remount, this pass)

| ID | Fix | File(s) | Verified result |
|---|---|---|---|
| A1 | **Gate `NotificationLayer`'s 2 network fetches + full log/event diff on a `(gameAge, undoCount)` change** — a playerView re-commit that didn't advance the game (structural-sharing re-swap, same-state repoll, PoV read) no longer re-fetches. Synchronous turn/generation/pass signals still run every swap; the 2.2 s poller stays the unconditional fallback for simultaneous phases. Re-seeds on gen-backwards. | `notifications/NotificationLayer.vue` | `lint:client` clean, 45 notification specs passing. |
| A2 | **`setLiveCardResources` early-out on an unchanged `players` branch ref** — structural sharing keeps that ref identical whenever no player object changed, so a board-only / sub-prompt / same-state commit skips the whole-tableau `Map` rebuild. An actual card-resource change reallocates the player → array ref → rebuild (correct). | `card/liveCardResources.ts` | `lint:client` clean. |
| BND-1 | **chart.js (endgame VP chart) + markdown-it (card-help popup) out of the eager `vendors.js`** — dynamic-`import()`ed by their sole consumers + dedicated `chunks:'async'` cacheGroups + negative-lookahead exclusion from the catch-all `vendors` group (which was hoisting the async-only libs into the initial bundle). | `webpack.config.js`, `gameend/VictoryPointChart.vue`, `card/CardHelp.vue` | **vendors.js 516 → 272 KB raw (−243 KB); ~69 KB brotli off the eager path** (chartjs 55.6 + markdownit 13.7). Verified on web + desktop builds; `lint:client` clean. |
| BRD-3 | **Board hover no longer DOM-queries.** `placementActive()` (ran `document.querySelector('.board-space--available')` on EVERY mouseover) + `BoardCellInfoPopover.shouldShow` now read a reactive `placementRenderState.highlightActive` flag SelectSpace sets alongside the class. The popover's `cellRect` (a `querySelector`+`getBoundingClientRect` in a position computed) now prefers a rect captured at hover-enter (the delegate already holds the element); querySelector kept only as a fallback for the `i` badge. | `board/placementRenderState.ts`, `SelectSpace.vue`, `Board.vue`, `board/boardInfoState.ts`, `board/BoardCellInfoPopover.vue` | `lint:client` clean, 8 board specs passing (Board / BoardCellInfoPopover / placementCleared). |
| OV-2 | **Effects + Actions fit-engine `ResizeObserver` self-trigger killed.** Each RO observes `root`, and `fit()` writes `--*-overlay-width` onto `root` (which IS root's width) → the write re-fired the RO. `fit()` derives its width purely from `window.innerWidth` (idempotent), so an unchanged-output guard (`lastFitWidth`+`cols`) skips the no-op CSS write and breaks the loop. | `effects/EffectsOverlay.vue`, `actions/ActionsOverlay.vue` | `lint:client` clean; consolidated `build:desktop` green. |
| CARD-1 | **`CardRenderItemComponent` skips `v-html` on the multiplied pure-icon node.** "gain 8 plants" rendered 8 copies each with a `v-html` innerHTML write, though the content is empty for CSS-drawn icons. A `hasInnerHtml` guard renders those as plain class-divs (visual-identical); `v-html` kept only when there's real markup. Helps the mount burst when a crowded overlay (Played/Hand/CardSelection) mounts many cards at once. | `card/CardRenderItemComponent.vue` | `lint:client` clean, `CardRenderItemComponent` + `CardRenderData` specs passing. |

---

## Measure-first backlog (Perf-2/3/4 — do after a capture confirms magnitude)

### Reactivity / per-poll work (biggest independent, non-architectural wins)
- **A1 [HOT/MEASURE — STILL OPEN post-rework]** `NotificationLayer` fires **2 network fetches + a full log/event diff on EVERY `playerView` swap** (`notifications/NotificationLayer.vue:135-274`), on top of its 2.2 s poller. Structural sharing does NOT help here — the ROOT `playerView` identity always changes (by design, so identity-watchers keep firing), and NotificationLayer's watcher is one of them. Gate `fetchAndDiff()` on `gameAge`/`undoCount` change (streams can only grow when the game advanced) + wire the declared-but-unused `fetching` in-flight guard. **S-M, low risk, high value — the #1 remaining independent win.**
- **A2 [HOT — STILL OPEN post-rework]** `setLiveCardResources` rebuilds a fresh global `Map` from every player's whole tableau on **every** `playerView` commit (`card/liveCardResources.ts:35-47`, `App.vue`), invalidating every card-popup consumer even when nothing changed. Structural sharing gives a clean early-out lever: if the incoming `players` branch kept its previous ref (deep-equal) the Map is identical — skip the rebuild. Else early-out on unchanged `gameAge`, or diff before reassigning the `ref`. **S, low risk.**
- **A4 [LOW — mitigated by structural sharing]** `actionsPreviewCacheKey` scans+sorts the whole tableau+hand into a big string (`PlayerHome.vue:1562-1606`). Post-rework, its reactive deps (tableau/hand/tags branches) keep their PREVIOUS refs when unchanged (structural sharing), so it no longer recomputes on unrelated polls — only when those slices actually change (even while the overlay is closed). Gating the binding on `activeOverlay==='actions'` is now a small residual win, not per-poll. **S, low priority.**
- **A5 [LOW — mitigated by structural sharing]** ~8 `waitingFor` tree-walk computeds (`PlayerHome.vue:1691-1904`). `waitingFor` is a sub-branch of `playerView`; when it's deep-equal it keeps its ref → the computeds don't re-run. Residual: when `waitingFor` DOES change, 8 fresh walks still run; collapsing them into one `waitingForIndex` computed is a minor allocation win. **S-M, low priority.**
- **A3 ✅ DONE (2026-07 rework)** — `AnimatedMetricValue` no longer re-runs a `changeFeedbackManager` round-trip in `mounted()` per remount. It fires chips ONLY from watch transitions; a genuine mount is a SILENT baseline. `metricValue:mount` (perf counter) now fires once/session, not once/response. Was the quantified B1 tax; B1 itself is resolved (see the systemic-root-cause note above).

### Card render
- **CARD-1 [HOT/MEASURE]** `CardRenderItemComponent` multiplies icon DOM by the resource **amount**, each node populated via `v-html` (`card/CardRenderItemComponent.vue:4,305-310`) — "gain 8 plants" = 8 `innerHTML` parses. Kill `v-html` on the repeated fixed-icon node (plain `:class` div, same visual). **S-M.**
- **CARD-2 [LOW — largely subsumed by structural sharing]** No `v-once`/static hoisting in `card/`; the card graphic is derived from **immutable manifest data**. Post-rework, an UNCHANGED card keeps its `CardModel` ref (structural sharing) → the `<Card>` component skips re-render entirely, so the crowded-overlay-wide re-render on every poll is GONE. `v-once` would now only help within the ONE card that actually changed (a resource added) — marginal. **M, low priority; revisit only if a trace shows a single changed card is still heavy.**
- **CARD-3 [MEASURE]** `card-hover-tall` animates card `height` → reflows the crowded hand grid (`Card.vue:203`, `cards_v2.less:1347`) — only when `experimental_ui` pref is on (default off). Pass `lightweight` to the hand overlay like Played already does, or expand via `transform`. **S.**

### Overlays / fit engines (layout thrash)
- **OV-1 ❌ NOT A GAP (investigated Wave 2)** — the premise was a misdiagnosis. `EffectDetailsPanel` ALREADY swaps a spacer for the heavy fixed-height source `<Card>` (`:121`) and renders only the VARIABLE effect graphic — exactly parallel to `ActionDetailsPanel` (spacers the `<Card>`, renders the variable action graphic). The effect graphic's height varies per effect, so it MUST render for the max-height probe to be correct; spacering it would corrupt the split min-height (the very thing the probe exists to fix). No change. (The real overlay win was OV-2.)
- **OV-2 [HOT]** Effects/Actions `ResizeObserver` observes `root` while `fit()` writes `--*-overlay-width` onto `root` → self-trigger loop (the B7 class, uncovered for these overlays). Observe a non-resized ancestor + unchanged-width guard. **S.**
- **OV-3 [MEASURE]** Played `verifyShrink` (≤8×) + Hand `fit` (≤14×) + `CardSelectionContent` interleave **write-`--*-zoom`(CSS `zoom`)→read-`scrollHeight`** = forced full-subtree reflow per iteration (`PlayedCardsOverlay.vue:695-725`, `HandCardsOverlay.vue:795-804`, `CardSelectionContent.vue:615-686`). Solve the zoom analytically (one measure → compute fitting zoom). Extends B3/B8; the interleave is safe to remove even though B8's `zoom→transform` migration stays deferred. **M.**

### Board
- **BRD-3 [HOT]** `placementActive()` does `document.querySelector('.board-space--available')` on **every mouseover** during placement (`Board.vue:395`) + `BoardCellInfoPopover.cellRect` does `querySelector`+`getBoundingClientRect` inside a computed (`:241-264`). Capture the cell rect at hover-time + replace the query with a reactive flag. **S.**
- **BRD-4 [LOW — rebuild-part closed by no-remount]** `PlayerCube` renders ~30 SVG nodes (gradient defs + 3 faces) per owned cell. The "rebuilt every remount" cost is GONE — an unchanged space keeps its ref → the cube isn't re-mounted. Residual: per-cube paint weight when a cube DOES first render / a space changes; sharing gradient defs at board level is a minor paint win. **M, low priority (measure paint first).**

### CSS
- **CSS-3 [HOT/MEASURE]** Right-sidebar parameter bars `transition: width/height/left` (`right_sidebar.less:188,734,752`) = animated **reflow** per global-parameter change. Swap to `transform: scaleX/scaleY/translateX` (GPU composite, identical look). **M** (verify cap alignment).
- **CSS-4 [MEASURE]** Leaf-level `contain: paint` absent everywhere; a single cell/card `filter`/`box-shadow` invalidation isn't clipped. Apply `contain: paint` at the small leaf (not a big container — that caused a documented atmosphere-edge regression). **M.**
- **CSS-5 [MEASURE]** Trim other always-mounted `backdrop-filter` over near-opaque surfaces (bar-rail chip 6px, sidebar toggle 7px, hand tray 5-6px over 98.5 %-opaque). **S.**

### Bundle / assets (startup + memory)
- **BND-1 [HOT]** `chart.js` (only used by the endgame VP chart) + `markdown-it` (only card-help) are in the **eager `vendors.js`** (`webpack.config.js:117` single vendors group) → parsed on the login/menu/board by 100 % of sessions. Dynamic-`import()` them in `gameend/VictoryPointChart.vue:8` + `card/CardHelp.vue:16`, or dedicated `chunks:'async'` cacheGroups. **S each, clear startup-parse win.**
- **BND-2 [MEASURE]** `main.js` = 1.25 MB raw / 170 KB br (largest eager). Run `webpack-bundle-analyzer`; move game-only module-state stores out of the shell entry. **M.**
- **BND-3 [MEASURE]** Oversized runtime textures (`board/mars.png` 4.9 MB, `resources/card.png` 3.1 MB, `board_icons_ares.png` 2.9 MB, tag/resource PNGs 460-800 KB) → GPU decode = `w×h×4` VRAM regardless of PNG size. Convert to `.webp` (protocol already maps it) / ship a `--board-scale`-appropriate mars. **M** (measure decoded size + check quality at max zoom).
- **BND-4 [ELECTRON]** Add `<link rel="preload" as="image">` for `mars.png` + core sprites in a desktop index (Electron skips the SW cache-warm). **S, low priority.**

---

## Electron-specific tuning (Perf-3 — apply after profiling)
Candidates only, each needs a trace + must NOT weaken security (§17: *security is not a performance knob*):
- `BrowserWindow.webPreferences.backgroundThrottling: false` — keep the game rendering at full rate when not focused (fullscreen game). **[ELECTRON] measure power vs smoothness.**
- GPU/hardware-acceleration status on the target Windows box — decide `app.disableHardwareAcceleration()` **only** from a trace (never by guess).
- `app://` protocol response **cache headers** (`Cache-Control: immutable` on hashed-content assets) so Chromium memory-caches decoded textures across in-app reloads.
- Verify DevTools is not auto-opened in prod; keep `contentTracing` available behind the perf flag.

---

## Priority order — WAVE 2 (post-remount; B1 + A3 already resolved)
The systemic lever (B1) is done. The remaining surface is the independent per-poll and
layout-thrash work, re-triaged for the post-remount world (several items downgraded to
LOW because structural sharing now skips re-render of unchanged branches).
1. ~~**A1**~~ ✅ SHIPPED (Wave 2).
2. ~~**A2**~~ ✅ SHIPPED (Wave 2).
3. ~~**BND-1**~~ ✅ SHIPPED (Wave 2) — −243 KB raw / ~69 KB br off the eager path.
4. ~~**BRD-3**~~ ✅ SHIPPED (Wave 2).
5. ~~**OV-2**~~ ✅ SHIPPED (Wave 2). ~~**OV-1**~~ ❌ investigated → not a gap (Effects already mirrors Actions).
6. ~~**CARD-1**~~ ✅ SHIPPED (Wave 2).
7. **CSS-3 [DEFERRED — needs on-screen verification]** — the fill bar carries a gradient + box-shadow + border-radius (all distort under `scaleX`) and the cap `::after` is positioned by a PARENT-relative `left: calc(var(--fill) - 4px)` that `translateX` can't cleanly reproduce, so a faithful swap needs restructuring (fixed-width gradient bar clipped by a scaleX mask) + a visual pass on cap alignment. The cost is a one-shot 750 ms transition a few times per generation (local sidebar reflow, not a sustained loop), so the risk/reward doesn't justify a blind change. Do it WITH the app on screen.
8. **[MEASURE] after a Perf-0 capture (needs the running GUI):** OV-3, CSS-4/5, BND-2/3, BRD-4, A4/A5, CARD-2 — confirm magnitude before spending risk.

**Downgraded to LOW by the rework (mitigated/subsumed, not deleted):** A4, A5 (structural sharing stops the recompute-when-unchanged), CARD-2 (unchanged cards skip re-render), BRD-4 (cubes not re-mounted per response).

### Wave 2 — done boundary
The **blind-applicable [HOT] wins are all shipped**: A1, A2, BND-1, BRD-3, OV-2, CARD-1 (OV-1 investigated → not a gap). Everything remaining needs the user's environment:
- **Visual-risk CSS** (CSS-3, CSS-4/5, BND-3 texture quality) — must be eyeballed at real resolution / max zoom (this project's standing rule).
- **[MEASURE] items** (OV-3, BND-2, BRD-4, and confirming the LOW-downgraded A4/A5/CARD-2) — need a `?perf=1` capture from the running client to confirm magnitude before spending refactor risk.

Next session with the GUI: run `?perf=1`, capture `playerView:commit` + long-task timings before/after opening the heavy overlays, then decide CSS-3 / OV-3 from the trace.

### Trace findings — 2026-07-02 (234 MB DevTools trace, ~264 s active play, `scripts/analyze-trace.cjs`)

**No-remount rework CONFIRMED in the wild.** During 264 s of active play: `playerHome:mount` = **0**, `metricValue:mount` = **0** (both fired once at load, before recording), only `playerView:commit` = 8 and `playerHome:resetTransientUi` = 11. Pre-rework these would have re-mounted on every one of the 8 commits. JS is no longer the bottleneck.

**The remaining jank is RENDERING/COMPOSITING-bound, NOT JavaScript.** Global time by primitive over the trace:
- `UpdateLayoutTree` (style recalc) **8140 ms** · `Layerize` **7991 ms** · `Commit` 3279 ms · `Paint`+`PrePaint` ~3100 ms · `EventDispatch` 1108 ms — vs `FunctionCall` only **867 ms** / `Layout` 604 ms.
- 148 main-thread tasks ≥50 ms, summing ~13.8 s. The biggest are (a) **GPUTask** 200–273 ms (texture raster/upload → BND-3) and (b) **input→overlay-open** clicks: ~200 ms JS mount + ~110 ms forced style recalc (card-mount burst → CARD-1/2, OV).

**Layer/paint sources (grep):** `backdrop-filter` ×**73**, `filter:` ×**549**, `clip-path` ×**122**, `will-change` ×**33** (11 in `mandatory_input_modal.less` alone), `mix-blend-mode` ×12. The premium glassmorphic chrome is the Layerize/Paint driver. `Layerize` = 7991 ms is a layer-EXPLOSION signature.

**⇒ Priority REDIRECT.** The JS-side backlog (A4/A5/OV-3) is now LOW (JS is 867 ms of the whole trace). The real levers are rendering:
1. **Cull `backdrop-filter`** over near-opaque surfaces (the CSS-1 pattern, ×73 to audit) — biggest Layerize/Paint win, low visual risk when the surface is already ~90 %+ opaque.
2. **Static `will-change` audit** — it permanently promotes a layer; should be set only DURING an animation. 33 static uses (mandatory_input_modal ×11) to move to dynamic / drop.
3. **`filter` on many-card overlays** (×549 — disabled-card grayscale/glow): bound with `contain: paint` on the leaf, or reduce; 50 dimmed cards = 50 filter layers.
4. **CSS-4 `contain: layout style`** on card/overlay leaves → shrinks the 8140 ms style-recalc scope.
5. **BND-3 textures → webp / smaller** (mars.png 4.9 MB, card.png 3.1 MB) → the 200–273 ms GPUTasks.

All are CSS/asset changes needing on-screen verification — but the backdrop-filter cull + static-will-change removal are the CSS-1-class "near-identical over opaque" low-risk wins to do first. **Note:** the other-chat "pure-CSS rework" left a broken `production.png` (500) and may have shifted paint/layer cost — worth checking it didn't regress rendering.

### Rendering cull — PILOT + GLOBAL SWEEP (2026-07-02)
**PILOT (user-verified OK):** `hand_cards.less` — dropped 3 backdrop-filters over ≥92%-opaque surfaces (`.hand-board-overlay` full-screen blur(5px)/95-97%, sort dropdown blur(6px)/98%, `.opp-hand` blur(4px)/92-94%). Matches the existing `.hand-reason`/`.hand-soft-reason` pattern.

**GLOBAL SWEEP (`scripts/audit-backdrop.cjs` classified all 73 by nearest-bg min-alpha):** applied the SAME cull to the other **≥0.90-opaque** glass surfaces (blur genuinely wasted): `endgame.less` ×2 (0.93/0.96), `final_scoring_reveal.less` (0.98), `played_cards.less` (full-screen overlay, 0.95), and the two ALWAYS-MOUNTED chrome panels `player_home.less` (0.95) + `right_sidebar.less` (0.94) — the last two pay every frame the board animates. Compiled backdrop-filter lines 55→45. `make:css` + `build:desktop` clean.

**Honest boundary — the cull is BOUNDED, not a Layerize silver bullet.** The audit shows **44 of the backdrop-filters are LEGITIMATELY over translucent surfaces (0.35–0.82)** — the full-screen dim backdrops behind modals + panels where the board IS meant to show through frosted. Removing those would change the look, so they stay. The remaining `Layerize`/`Paint` cost is dominated by (a) those legit FULL-SCREEN backdrop blurs while an overlay is open, and (b) the `filter:` ×549 + many card layers. **will-change:** audited → already disciplined (only animating/transient/overlay or `will-change:auto`), no cull.

**Also fixed (user-requested): the broken `production.png` (500).** The other-chat pure-CSS rework deleted `production.png` but left 3 refs. Replaced each with the `.production-surface()` brown fill (`linear-gradient(180deg,#cb9e6f,#ae7f52,#87603b)` + `#a87a4e`): `DeltaProjectBoard.vue` (prod box, plain-CSS scoped style → inline), `cards.less` `.mined-metal`, `resources.less` `.shield_production_protection`. Consistent with the surface used by every other production box; kills the 500.

**Next lever (needs a fresh trace + a visual call):** the biggest remaining rendering costs are `UpdateLayoutTree` (8140 ms — inherent to mounting ~50 cards per overlay open; hard to cut safely) and the LEGIT full-screen backdrop blurs. Candidate safe-ish global step: **reduce the blur RADIUS** on the full-screen dim backdrops (blur cost ≈ area × radius; halving the radius ~halves the composite while staying frosted — a subtle, verifiable change). Then re-capture `?perf=1` and compare `Layerize`/`UpdateLayoutTree`.

### Rendering cull — BATCH 3 (full-screen backdrops; 2026-07-02)
Auditing the "reduce blur radius" candidates revealed that several full-screen panels the earlier pass had classified KEEP=`?` (their bg is a LESS VARIABLE the script couldn't resolve) are actually **≥0.92 opaque** — so the blur is wasted → **full removal** (better than a radius cut). Removed: `victory_points` `.vp-board-overlay` (0.95/0.97), **`journal` `.journal-panel`** (0.92/0.95 — the big one: a long-lived side panel while the board animates beside it), `hydronetwork` `.hydronetwork-overlay` (0.92/0.95), `final_scoring_reveal` root (0.97/0.99), and `endgame` `.eg-results__bg` (a translucent radial over a 0.96-0.985 `@eg-bg` base → composite near-opaque; the single biggest backdrop at blur(8px)). Only the ONE genuinely-translucent full-screen scrim got a **radius reduction**: `preferences` `::backdrop` `blur(7px)→blur(4px)` (~86%-opaque center, stays frosted, ~halves the cost). **The frequent mid-game dim scrims (`mandatory-input-modal` blur(2px), colonies blur(3px), actions blur(2px), drawn_cards blur(4px)) were ALREADY minimized by prior perf work — no radius headroom left there.** Compiled backdrop-filter blur lines across the whole cull: **55 → 35**. `make:css` clean; all-`.less` (no webpack rebuild needed). This is the last big backdrop-filter win — remaining `Layerize`/`Paint` is the `filter:`×549 + card layers, and `UpdateLayoutTree` is the card-mount cost. **Re-capture `?perf=1` to quantify the cumulative Layerize drop before deciding BND-3 (textures/GPUTask) vs stopping.**

Verified clean (do NOT re-investigate): `realtimeService`/`realtimeSync`/`realtimePoller` teardown + coalescing (RT6/7/8), `useBoardAutoScale` (B7 applied), `will-change` discipline, `aresMarkerGlide` rAF self-termination, VP overlay + Journal (no fit thrash), no deep-watch storm on `playerView`, no `JSON`/`structuredClone` in hot paths, `core-js` not bundled.
