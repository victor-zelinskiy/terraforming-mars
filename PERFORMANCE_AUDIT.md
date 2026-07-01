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

`<player-home :key="playerkey">` **full-remounts** the entire game subtree on nearly
every server response (`App.vue` commit → `playerkey++`). WebSocket makes this fire
*sooner and more often* than polling did (RT4). This dominates board + panel cost:
Board, ~61 `BoardSpace`→`PlayerCube`, arc-scales, and every `AnimatedMetricValue`
re-mount and re-run their `mounted()` work on each poll (A3). The ~46 module-level
singletons exist *only* to survive this remount — direct evidence it's the pervasive
tax. This is `PERF_INVESTIGATION.md` **B1**; it stays **[MEASURE]** (highest potential
win, highest risk) and is NOT touched here — but two cheap down-payments below (`A6`,
`RT1`) reduce its cost / unblock it without behavior change.

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

---

## Measure-first backlog (Perf-2/3/4 — do after a capture confirms magnitude)

### Reactivity / per-poll work (biggest independent, non-architectural wins)
- **A1 [HOT/MEASURE]** `NotificationLayer` fires **2 network fetches + a full log/event diff on EVERY `playerView` swap** (`notifications/NotificationLayer.vue:135-274`), on top of its 2.2 s poller. Gate `fetchAndDiff()` on `gameAge`/`undoCount` change (streams can only grow when the game advanced) + wire the declared-but-unused `fetching` in-flight guard. **S-M, low risk, high value.**
- **A2 [HOT]** `setLiveCardResources` rebuilds a fresh global `Map` from every player's whole tableau on **every** `playerView` (`card/liveCardResources.ts:35-47`, `App.vue:462`), invalidating every card-popup consumer even when nothing changed. Early-out on unchanged `gameAge`, or diff before reassigning the `ref`. **S, low risk.**
- **A4 [HOT]** `actionsPreviewCacheKey` scans+sorts the whole tableau+hand into a big string on most polls **even while the Actions overlay is closed** (`PlayerHome.vue:1562-1606`). Gate the binding on `activeOverlay==='actions'`. **S.**
- **A5 [HOT]** ~8 `waitingFor` tree-walk computeds re-run per response, several fresh-allocating; `coloniesOverlayDisabledReasons` builds a `Record` looping every colony **while the colonies overlay is closed** (`PlayerHome.vue:1691-1904`). Collapse the 8 recursive walks into one `waitingForIndex` computed + gate the overlay-only ones. **S-M.**
- **A3 [MEASURE]** `AnimatedMetricValue` re-runs its `changeFeedbackManager` round-trip in `mounted()` per remount × player panel — *the quantified B1 tax*. This is the measurement target that says whether B1's remount rework is worth its risk, not a standalone fix. **L (=B1).**

### Card render
- **CARD-1 [HOT/MEASURE]** `CardRenderItemComponent` multiplies icon DOM by the resource **amount**, each node populated via `v-html` (`card/CardRenderItemComponent.vue:4,305-310`) — "gain 8 plants" = 8 `innerHTML` parses. Kill `v-html` on the repeated fixed-icon node (plain `:class` div, same visual). **S-M.**
- **CARD-2 [HOT/MEASURE]** No `v-once`/static hoisting anywhere in `card/`; the card graphic is derived from **immutable manifest data** yet fully re-renders whenever the parent overlay re-renders. Wrap the static graphic/requirements/VP/expansion in `v-once`, keep cost/resources/disabled live. Turns ~80-200 reactive nodes/card into ~5 on crowded overlays. **M, verify each block truly has no dynamic input.**
- **CARD-3 [MEASURE]** `card-hover-tall` animates card `height` → reflows the crowded hand grid (`Card.vue:203`, `cards_v2.less:1347`) — only when `experimental_ui` pref is on (default off). Pass `lightweight` to the hand overlay like Played already does, or expand via `transform`. **S.**

### Overlays / fit engines (layout thrash)
- **OV-1 [HOT]** Effects overlay's hidden measure-probe renders the **full effect graphic** per effect (`EffectsOverlay.vue:68-76`, `EffectDetailsPanel.vue:47-51`) — the Actions overlay already swaps in a spacer (`ActionDetailsPanel.vue:117`); mirror it. **S-M.**
- **OV-2 [HOT]** Effects/Actions `ResizeObserver` observes `root` while `fit()` writes `--*-overlay-width` onto `root` → self-trigger loop (the B7 class, uncovered for these overlays). Observe a non-resized ancestor + unchanged-width guard. **S.**
- **OV-3 [MEASURE]** Played `verifyShrink` (≤8×) + Hand `fit` (≤14×) + `CardSelectionContent` interleave **write-`--*-zoom`(CSS `zoom`)→read-`scrollHeight`** = forced full-subtree reflow per iteration (`PlayedCardsOverlay.vue:695-725`, `HandCardsOverlay.vue:795-804`, `CardSelectionContent.vue:615-686`). Solve the zoom analytically (one measure → compute fitting zoom). Extends B3/B8; the interleave is safe to remove even though B8's `zoom→transform` migration stays deferred. **M.**

### Board
- **BRD-3 [HOT]** `placementActive()` does `document.querySelector('.board-space--available')` on **every mouseover** during placement (`Board.vue:395`) + `BoardCellInfoPopover.cellRect` does `querySelector`+`getBoundingClientRect` inside a computed (`:241-264`). Capture the cell rect at hover-time + replace the query with a reactive flag. **S.**
- **BRD-4 [MEASURE]** `PlayerCube` renders ~30 SVG nodes (gradient defs + 3 faces) per owned cell, rebuilt every remount (`PlayerCube.vue`). Share gradient defs at board level / `content-visibility`. **M** (measure paint first).

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

## Priority order (do next, after a Perf-0 capture)
1. **A1 + A2 + A4 + A5** — stop per-poll network + Map-rebuild + big computeds firing when nothing relevant changed / overlays are closed. Biggest non-architectural wins, low risk.
2. **BND-1** — chart.js + markdown-it out of eager vendors (startup parse).
3. **OV-1 + OV-2 + BRD-3** — the [HOT] layout-thrash / self-trigger fixes.
4. **CARD-1 + CARD-2** — the crowded-overlay card-render reductions.
5. **OV-3 / CSS-3 / BND-3 / BRD-4** — [MEASURE] first (capture confirms magnitude).
6. **B1 (A3)** — the remount rework; the single biggest lever but highest risk — only after `AnimatedMetricValue`-mount-count measurement justifies it. `A6` (shipped) is the first unblock step.

Verified clean (do NOT re-investigate): `realtimeService`/`realtimeSync`/`realtimePoller` teardown + coalescing (RT6/7/8), `useBoardAutoScale` (B7 applied), `will-change` discipline, `aresMarkerGlide` rAF self-termination, VP overlay + Journal (no fit thrash), no deep-watch storm on `playerView`, no `JSON`/`structuredClone` in hot paths, `core-js` not bundled.
