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

- `albumSpecFor(profile)`: **handheld → 4×1** (four generous cards, one row);
  **every other profile → 5×2** (ten per page). The tv profile maps the same
  logical composition through `--con-ui-scale`; the page shape never forks per
  resolution.
- `planHandAlbum` solves the card zoom from the measured album box + the
  profile grid + the 320×460 premium aspect — **never from the hand size**.
  One card, four cards and ten cards are the same geometry; a growing hand
  only ever adds pages. Constants: `ALBUM_GAP_X/Y`, `ALBUM_GUTTER_*` (the top
  gutter reserves the pick-band overhang + the focus pop — the old TV
  `__pad { padding-top }` override is gone), `ALBUM_MAX_ZOOM` (art ceiling,
  × uiScale), `PAGE_STRIDE_EXTRA`.
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
- `pageJumpIndex`: the explicit page turn (right-stick flick — either axis,
  hold-to-repeat at `FLICK_REPEAT_MS`; mouse wheel; page-edge click) — same
  relative slot on the neighbouring page.
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
- Chrome: the header hosts the PAGE INDICATOR (`1–10 из 19 · 1/2`, arrows lit
  only toward existing pages; `margin-left: auto`, fixed height); the album
  edges show `.con-hand__pgedge` — thin layered hints, clickable, never a
  book. The `Pages` foot hint (`stickScroll` glyph) is shared by all four
  hand command bars via `handPagesHint`.

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
- A packet-bound proxy carries a **side clip** (`RevealClip.left/right`) —
  it WIPES behind the stage edge instead of sliding whole over the HUD
  beside the album, then dissolves late (`flight·0.72`). On close, packets
  spawn wiped + transparent at their anchors and emerge through the edge on
  the way home (the close branch releases clip AND fades in — two `if`s, not
  `else if`). `boundedPairs` still samples the off-page tail to 8 proxies.
- The FILTER episode is a RE-PAGINATION, not a dock trip: leavers gather
  into the right-edge packet (`section.packetHomeRects` feeds the episode's
  `dock` map — the name is historical), enterers glide out of it, survivors
  glide between slots. The flip language survives intact: packets are
  face-down stacks, so leaving = turning face-down, entering = turning
  face-up. Pairs parked before AND after are EXCLUDED from `before`
  (a packet→packet flight would paint a phantom card at the edge).
- `restoreScroll` / `ensureSelectedVisible` are kept as no-ops (the director
  hook shape + the filter measure path call them); `scrollTop` is always 0.

## What did NOT change

The episode machinery (one reversible GSAP timeline, B mid-open reverses,
`finishInstant` on resize/safety, the no-dip handoff «slots snap under
proxies, proxies fade above»), the mode props (sale / select / discard skin /
pick bridge / embedded-in-start), the descend stage + outcome zones and their
teleport-slot watchers, the verdict bar, `con-deal-hold` for the staged card,
art preload at arm time, `revealVisualFor` (the state flies with the card).

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
- **The teardown HANDOFF fade needs a WALL-CLOCK backstop.** GSAP ticks on
  rAF, and a quiet headless/backgrounded compositor stops delivering frames
  exactly when the fade runs (the screen has just gone still) — the fade's
  `onComplete` then never fires and the invisible proxy nodes linger on the
  layer forever (18 stuck proxies on the tv4k close). `teardown` now arms a
  `setTimeout(settle, HANDOFF + 700)` with the same epoch guard the fade's
  own completion uses — a normal completion makes it a no-op.
