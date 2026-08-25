# The Hand ALBUM — «Карты в руке» без скролла (2026-08-16)

The console hand workspace no longer scrolls. The hand is a horizontal ribbon
of STRICT PAGES — an album — and the viewport shows exactly one page:

```
previous page packets  ←  ACTIVE PAGE  →  next page packets
```

This document is the contract. Pure math: `consoleHandAlbum.ts` (beside the
section; `consoleHandGrid.ts` is NOT dead — it remains the engine of the
«Разыграно» category view and the deck pick). Guard spec:
`tests/client/components/console/consoleHandAlbum.spec.ts`.

## The page is a PROFILE fact, the size is a BOX fact

- `albumSpecFor(profile, layout)`: **handheld → 4×1** (four generous cards,
  one row); **every other profile → 5×2** (ten per page); the player's
  **«Компоновка альбома»** preference (`consoleAlbumLayout.ts`, localStorage
  `tm_console_album`, read AT IMPORT so the first measure — and the HandDock
  flight aiming at it — is already in the chosen composition) can force
  **`large` → 4×1 everywhere** («Крупные карты»: capacity traded for couch
  readability; on the handheld it coincides with the baseline — no
  artificial difference). The tv profile maps the same logical composition
  through `--con-ui-scale`; the page shape never forks per resolution.

## ADAPTIVE DENSITY — Showcase Pages (`planAlbumPage` / `pageRowsFor`)

Capacity is a PAGINATION fact (stable — pages and the pager never re-deal
under a density change); the page COMPOSITION and card size are a fact of
how many cards actually stand on that page:

- two-row capacity: **10→5+5 · 9→5+4 · 8→4+4 · 7→4+3 · 6→3+3** (balanced by
  construction — a weak 5+1/5+2 is unexpressible), **1–5 → ONE showcase
  row**; single-row capacities always compose one row.
- a TWO-ROW page keeps the STANDARD size (the base 5×2 solve — never
  «bigger because this page has six»); a SHOWCASE page solves its OWN zoom:
  width-fit for exactly `n` slots vs the one-row height budget with the
  `SHOWCASE_AIR_FRAC` hero air (a fraction of the box on each side — one
  SHARED budget for every showcase count, which is what keeps the size
  MONOTONE: fewer cards never render smaller), capped by the art ceiling
  and floored at the standard (a showcase never shrinks below it).
- ⚠️ **…but the DENSITY LADDER belongs to the ADAPTIVE composition alone.**
  A SINGLE-ROW CAPACITY («Крупные карты», and the handheld baseline that
  coincides with it) has ONE standard card — the one a FULL page of
  `spec.cols` renders — and every page keeps it: `showcaseSizingCols` feeds
  the solve the mode's CAPACITY rather than the page's own count, so `n`
  decides how many cards are drawn and nothing else. A partial last page is
  then the same card, the same gap and the same row seat, centred over
  honest air (`pageW`/`padX` are the only readers of the real `n`). Sizing
  it by its count made a 1-card tail nearly twice the standard card: every
  turn re-scaled the whole stage and read as an accidental inspect view —
  and because the height cap binds at n ≤ 2, 1 and 2 rendered identically,
  so the «ladder» was not even a rule the player could learn. Empty space on
  a thin page is deliberate air; nothing is ever added to fill it. Guards:
  the capacity-4 block in `consoleHandAlbum.spec.ts` (geometry identical for
  1..4, centred, no overflow, every profile scale) + the three
  `«Крупные карты» · tail N` e2e runs (`hand-album-probe.spec.ts`), which
  also sample every frame of the turn for a single card shape.
- the solved size is REAL layout (own `--con-hand-zoom` on the page, slots
  at final dims) — never a `transform: scale` over a small card: hitbox,
  focus ring, art sharpness and FLIP bounds are all the final geometry.
- each page berths on the strip in its own pads (a showcase row centres
  vertically), so a `10 → 3` turn slides two FINISHED surfaces past each
  other — nothing resizes mid-flight, nothing snaps after landing.
- vertical navigation walks the COMPOSED rows (`stepHandAlbum` takes the
  active page's `rows` — [5,4] clamps a col-4 down-step into the shorter
  row); a showcase page keeps up/down inert.
- a filter (or preference) change across a density boundary is the SAME
  measured FLIP episode as any filter change — movers glide AND SCALE
  between the compositions; the preference flip while the album is open
  routes through `setAlbumLayoutRecomposer` → `applyHandFilterChange`, and
  focus keeps its CARD (its new page opens by derivation — index 8 lands
  on page 3 of a capacity-4 album, never back on page 1).
- `planHandAlbum` solves the card zoom from the measured album box + the
  profile grid + the 320×460 premium aspect — **never from the hand size**.
  One card, four cards and ten cards are the same geometry; a growing hand
  only ever adds pages. Constants: `ALBUM_GAP_X/Y`, `ALBUM_GUTTER_*`,
  `ALBUM_MAX_ZOOM` (art ceiling, × uiScale), `PAGE_STRIDE_EXTRA`.
  **Every reserve is CONSTRAINT-DERIVED, not taste** (iteration 2): the TV
  page is height-bound, so each vertical px is card size — the gutters/gaps
  are the measured worst-case stack per boundary (focus pop ≈6px logical
  toward an edge + the 3px ring + the ~11px pick-band overhang where a band
  can stand), the additive GLOW may cross a gap, the hard ring may not.
  Shrinking one further must re-derive that stack, never eyeball it. The
  old TV `__pad { padding-top }` override is gone.
- An incomplete last row centres ITS GROUP; size, pitch and order never move.
  The focus lift is a transform — it can never reflow neighbours.

## THE ACTIVE PAGE IS DERIVED FROM THE FOCUS

`activePage = pageOfIndex(consoleState.handIndex)`. There is no second page
state to restore, desync or clamp: restoring the focus restores the page
(a workspace resumed on page 3 OPENS on page 3 — no walk from page 1), and
navigation across a page edge IS the page turn.

- `stepHandAlbum`: left/right walk the FLAT hand order (crossing the edge
  turns the page — the order continues); up/down move by a row WITHIN the
  page, column preserved, clamped into a partial row; nothing wraps.
- `pageJumpIndex`: the explicit page turn — **LB / RB, in EVERY album mode**
  (browse, sale, select, pick, embedded; the first/last page swallows the
  press), plus the unadvertised gestures: right-stick flick (either axis,
  hold-to-repeat at `FLICK_REPEAT_MS`), mouse wheel, spine-chip click. Same
  relative slot on the neighbouring page. **The TAG FILTER rides the
  TRIGGERS**: LT/RT cycle it in browse (LT stays the «only suitable» toggle
  in select modes, RT stays the sale/multi CONFIRM — those modes have no tag
  filters), R3 resets. One action — one hint: the pages hint lives ONLY on
  the spine, the filter hint ONLY in the command bar (`LT ◀ ФИЛЬТР ▶ RT`).
- **Focus is anchored to CARD IDENTITY** (`focusName` in the section): a
  re-sort follows the card, a removal falls back to the same slot (never to a
  random first page). A MODE flip (browse ↔ sale ↔ select/pick) adopts the
  shell's own seat as the new anchor — the `modeKey` watcher runs BEFORE the
  entries watcher by declaration order, which is load-bearing.

## The page turn is a TRANSFORM SLIDE, and it is interruptible by nature

The strip (`.con-hand__pagestrip`) carries every mounted page at
`translateX(page · stride)`; turning a page retargets ONE transform
transition (~180 ms). Retargeting mid-flight redirects the same motion —
rapid turns can never queue five animations. Everything is positioned by
transform inside an `overflow: hidden` album. ⚠️ TRANSFORMED bounds DO count
as scrollable overflow by CSS spec — the mounted right-neighbour page gives
the album an invisible, clipped `scrollWidth` excess. Two consequences,
both handled: the album clips, so NOTHING propagates to the root (the
`[console-overflow]` guard stays quiet and a scrollbar is unexpressible);
and an `overflow: hidden` box is still PROGRAMMATICALLY scrollable, so a
stray `scrollIntoView`/`focus()` could shift the strip — the album pins
`scrollLeft/Top` back to 0 on its own `scroll` event (`pinScroll`), which
can only ever be programmatic there.

- `--live` arms the transition only after the mount settles (a fresh open
  LANDS on its page, never slides from x = 0); `.con-hand--transit` pins the
  strip while a reveal/filter episode owns the cards (flight targets were
  measured against the current layout).
- The render window keeps the active page ± 1 AND the last SETTLED page's
  neighbourhood mounted (`settledPage`) — a page mid-slide never unmounts
  under the player.
## The EDGE AFFORDANCE and the SPINE (iteration 4 — the polish pass)

- **`.con-hand__pgedge` is a sheet STACK, never a rail.** Three leaves at the
  vertical centre of the boundary (each shorter, dimmer, further out) plus a
  compact chevron: «there is a page that way», in the album's own material.
  The previous full-height hairline read as the physical edge of the stage,
  which is what made the last card look cropped — the graphic was as wrong
  as the position. Both sides ALWAYS render (an unavailable one is `--off`),
  so the composition never shifts when the last page drops its next-edge,
  and a press answers on its own side (`--pulse`, one shot) before the
  ordinary slide carries on.
- **The edges have their OWN gutter** (`ALBUM_EDGE_GUTTER`, reserved on both
  sides and subtracted from the card band in BOTH solvers): the card's ring
  and glow clearance (`ALBUM_GUTTER_X`) sits inside it, so the two can never
  share room.
- **Gaps are density-aware** (`SHOWCASE_GAP_FRAC` — a bounded share of the
  card width: 5×1 tight … 2×1 generous, clamped `SHOWCASE_GAP_MIN/MAX`) and
  **BACK-SOLVED**: the fraction picks a gap, the gap is clamped, then the
  zoom is re-solved against the clamped gap — the gap you solve must be the
  gap the browser lays out (the ws-stage law).
- **A showcase page lifts optically** (`SHOWCASE_OPTICAL_LIFT_FRAC`, a share
  of the free space): two heavy bands sit below the album, so a
  mathematically centred single row reads low. Same share for every count —
  never a per-mode offset.
- ⚠️ **FOCUS DECORATION IS SCREEN-SPACE.** The slot's `zoom` multiplies its
  shadows too, so the ring/halo tripled on a showcase card. `--con-hand-fx`
  (`1.6 / max(1.6, zoom)`) divides that growth back out past a soft knee:
  1 at the standard card (byte-identical), capped screen thickness beyond.
  Every state shadow multiplies its lengths by it.
- Chrome: the page position lives in ONE place — **the ALBUM SPINE**
  (`.con-handdock__pager`, `ConsoleHandDock`'s `album` prop): the footer
  bay's centre line becomes `LB  1–10 из 15 · 1/2  RB` for the album's
  lifetime, replacing the «КАРТЫ n/m» counter (playable/total already live
  in the album header) and swapping back at the dock. Shell-computed
  (`handDockAlbum`), absolutely centred, tabular digits — the centre never
  walks; a direction with no page mutes, never hides; the glyph chips are
  the mouse's page controls. The spine yields to the plain counter PAST THE
  DESCENT (the composer owns LB/RB for its payment dial) but not during a
  pick bridge. The album edges still show `.con-hand__pgedge` — thin layered
  hints, clickable, never a book. A header pager is deliberately GONE: it
  split the navigation from its own controls and gave the top-right corner
  a competing centre of attention.

## THE WHOLE HAND LEAVES THE DOCK (the physical model)

`dockLiftedNames` lifts the **album UNIVERSE** (`handAlbumUniverse` — mode-
narrowed, NEVER view-filtered), so the dock genuinely empties for the whole
open hand — no «remainder pack» while the player leafs pages. A card outside
the tag / «only suitable» filter is not on any page, but it is IN the album:
parked with the far-right page packets (`packetExtras` prop → the section's
`transitionTargets` appends packet pairs for them).

- `transitionTargets` (the reveal transition's geometry source): active-page
  cards → real slot rects (`visible: true`, clip never set — a page cannot
  cross the viewport edge); other pages → `packetRect(side, depth, seq)`
  anchors beyond the stage edge (earlier pages LEFT, later + filtered-out
  RIGHT), converging with a micro-stagger so the flight reads as a packet
  assembling.
- A packet-bound proxy is erased by **THE STAGE WINDOW** — one static
  `clip-path` on the whole reveal layer (`handRevealState.stageClip`, the
  album's x-range, armed in the same flush as the flights and cleared at
  the teardown's settle). The card flies whole and opaque; the boundary
  clips exactly the part of it that is past the edge, both directions,
  magnets and reversals included — zero per-frame clip writes (the old
  per-proxy `edgeClipUpdater` invalidated paint on 11 cards every frame at
  the exact moment the transition's own mount work saturated the thread).
  `RevealClip.left/right` on packet pairs remains only as the DEGRADE
  signal for a stage-less caller (legacy alpha wipe). `boundedPairs` keeps
  every card's body (hard max 60 — a runaway guard, not a sampling cap).
- The FILTER episode is a RE-PAGINATION, not a dock trip: leavers gather
  into the right-edge packet (`section.packetHomeRects` feeds the episode's
  `dock` map — the name is historical), enterers glide out of it, survivors
  glide between slots. The flip language survives intact: packets are
  face-down stacks, so leaving = turning face-down, entering = turning
  face-up. Pairs parked before AND after are EXCLUDED from `before`
  (a packet→packet flight would paint a phantom card at the edge).
- `restoreScroll` / `ensureSelectedVisible` are kept as no-ops (the director
  hook shape + the filter measure path call them); `scrollTop` is always 0.

## THE EPISODE CLOCK (iteration 8 — the continuity rework)

The dock ⇄ album transition used to teleport under load («плотный веер за
один кадр превращается в страницу», the 15-card «Крупные карты» report):
`tl.play(0)` started the wall-clock in the same task as the proxy spawn,
the very next frames were consumed by the transition's own heaviest DOM
work (hand-section mount/unmount, the board's return patch, 15 proxy
mounts), and GSAP's ticker then advanced the timeline by the WHOLE missed
stretch on each rare tick — the convoy's launch (open) and the packets'
entire re-entry (close: they depart FIRST by rank) played out between two
painted frames. Four rules now hold, all in `handRevealDirector.ts`:

- **IGNITION IS PAINT-GATED**: the built timeline arms only after the spawn
  flush has painted (`settledPaint` — double-rAF with a wall-clock backstop
  for starved compositors). The pack answering the press instantly is the
  dock accent's job, not the flight's. `building` covers the gate; a B
  inside it rides `pendingReverse`; a reset mid-build is detected by
  `buildSeq` (never install a dead episode over fresh state).
- **THE TIMELINE NEVER RIDES GSAP'S TICKER**: it stays paused for life and
  the episode's own driver steps `tl.time()` — rAF where frames flow, a
  40 ms interval co-driver where they do not (the magnetToBerth
  discipline), back-to-back ticks coalesced (≥12 ms apart), every step's
  dt bounded by `MAX_STEP_MS` (28 ms ≈ one honest fast frame at the
  flight's peak speed, ~120 px). A stall slides the flight later in time
  instead of skipping it through space. The driver dies with the episode —
  zero standing cost while the hand is docked.
- **THE SAFETY IS PROGRESS-AWARE**: the bounded clock legitimately runs
  slower than wall time under load, so the watchdog re-checks a MOVING
  playhead (hard cap ~3.5× budget) and snaps only a genuinely stopped one.
- **THE FINAL APPROACH IS THE LANDING** (close): the 72 % corrective tween
  is gone — it rode the starved global ticker and caught up in ~300 px
  bursts. `beginLanding` fires at 72 % instead; the magnet re-reads the
  live berth every tick, its per-tick displacement is absolutely capped
  (110 logical px), its convergence tightens as its budget runs out
  (τ 70→24 ms), and the hard wall sits at ×4 where the cap has already
  delivered the card within a hop of its berth. `[hand-reveal]` warns mark
  every degrade path (driver boundary jump, magnet far start / wall snap,
  safety snap, conclude backstop) — a silent one is a bug.

Guard: `tests/e2e/hand-album-continuity.spec.ts` — per-card body tracking
across dock back / proxy / slot with stage-edge exemptions: no vanish or
pop deep inside the stage, no proxy hop faster than any tween in the flow
(matrix: 3/9/15/20 cards, page turns incl. a fast LB/RB burst, close from
first/middle/last page, reopen, mouse open, tv-4K and handheld profiles).

## What did NOT change

The episode machinery shape (one reversible timeline per episode, B
mid-open reverses from current progress, `finishInstant` on resize, the
no-dip handoff «slots snap under proxies, proxies fade above», per-card
gather landings + un-land on reverse), the mode props (sale / select /
discard skin / pick bridge / embedded-in-start), the descend stage +
outcome zones and their teleport-slot watchers, the verdict bar,
`con-deal-hold` for the staged card, art preload at arm time,
`revealVisualFor` (the state flies with the card).

## Traps already paid for

- The strip transition MUST be off while `transitHold` and until the first
  paint settles — a restored page must not animate from x = 0, and an
  episode's measured targets must not chase a sliding grid.
- Off-stage pages positioned by `left:` instead of `transform:` inflate the
  root's `scrollWidth` and trip the overflow guard — transform only (and see
  the scrollable-overflow note above: even transformed bounds overflow
  INSIDE the album, which is why `pinScroll` exists).
- The `.con-hand__shelf` wrapper is GONE (the album owns clipping); the old
  scroll-engine CSS (`__grid/__pad/__spacer/__scrollbar/__scrollthumb`) died
  with it — `consoleHandStageMotion`'s isolation query and the discarding
  recede rule now name `__pgedge`/`__pageind` instead.
- ⚠️⚠️ **A CONSTANT MULTIPLIER INSIDE A ZOOMED SLOT IS A LATENT BUG — it
  is only right at ONE card size.** The «Роботы» badge carried `zoom: 1.5`
  inside a slot that is itself `zoom: var(--con-hand-zoom)`; at the old fixed
  0.66 the product was ≈1 and it looked correct, so nothing flagged it — the
  first showcase page (zoom ~3) rendered it ~4.5× and it covered the card's
  own title. Same class, same file: the pick band compensated the WRONG
  variable (`1.15 / var(--con-ui-scale)`). Both now counter-zoom the card's
  density (`calc(k / var(--con-hand-zoom, 0.66))` — the `__chip` law), which is
  the only correct form for a badge inside a card slot. **When a density
  system raises a container's zoom, audit every descendant carrying a
  hard-coded `zoom`/size — the query is «what did this constant assume?».**
- **The teardown HANDOFF fade needs a WALL-CLOCK backstop.** GSAP ticks on
  rAF, and a quiet headless/backgrounded compositor stops delivering frames
  exactly when the fade runs (the screen has just gone still) — the fade's
  `onComplete` then never fires and the invisible proxy nodes linger on the
  layer forever (18 stuck proxies on the tv4k close). `teardown` now arms a
  `setTimeout(settle, HANDOFF + 700)` with the same epoch guard the fade's
  own completion uses — a normal completion makes it a no-op.
