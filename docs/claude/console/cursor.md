# THE CURSOR IS ONE LIVING OBJECT — it ARRIVES, it never appears

TR58 «КУРСОР — ОДИН ЖИВОЙ ОБЪЕКТ» (2026-10-16). The one language of focus for every console surface — the hand album,
«Действия карт», the colonies, the standard projects, both composers' rows, the variant tiles, the target step, the
stage rows (draw / deck pick / reveal / draft / task host), the start workspace. A new surface speaks it or it is not
done. Rule (short form): `.claude/rules/console-ui.md` § THE CURSOR IS ONE LIVING OBJECT. Card + measurements:
`docs/TURMOIL_REDUX_REPROCESSING_PLANT.md` § КУРСОР.

## Why (the owner's 4K report)

«Фокус по умолчанию появляется одним кадром; карта делает микро-прыжок.» The prepared diagnosis
(`docs/claude/prompts/project-tr58-reprocessing-plant.md` § ДИАГНОЗ) found one class behind fifteen surfaces:

* **two elements, two clocks** — the ring was a `box-shadow` on the card FACE (`.pcard`, no transition) while the lift
  ran 150 ms on the SLOT: the ring snapped on, the card was still growing — the «kick»;
* **shadow lists that cannot interpolate** — the variant tile's rest `[inset, inset, outer]` vs focus
  `[inset, outer, outer]`: the stylesheet SAID 160 ms and the browser snapped (a transition between lists of different
  inset-ness is discrete);
* **a default focus born under a copy** — the hand album mounted with its first card already ringed and lifted under
  the flying copies (opacity 0) and revealed it in ONE frame, while the copies cross-faded over it (two different
  pictures of one card);
* **fifteen clocks** — 140 / 150 / 160 / 240 / 260 ms, `ease` or `standard`, per surface;
* **`scrollIntoView` and instant `scrollTop`** following the cursor, measured on the LIFTED box.

## The grammar (`src/styles/console.less`, after `.con-focus-outer`)

**ONE CLOCK.** `--con-cursor-ms` / `--con-cursor-move-ms` (180 ms × `--motion-scale`) + `--con-cursor-ease`
(`MOTION_EASE.standard`); JS mirror `CURSOR_MS` / `CURSOR_EASE` in `motionTokens.ts` (equality guarded). The lift has its
own token because in-game reduced motion stills it (`--con-cursor-move-ms: 0ms`) while the ring keeps a short fade
(`--con-cursor-ms: 90ms`, `console_reduced_motion.less`).

**`.con-cursor(@shadow; @radius; @transform; @z; @pseudo; @bg; @layer-z)`** on the HOST (the element that moves):

* the RING (+ halo + shadow, and a focus GRADIENT via `@bg` — gradients never interpolate) is a LAYER (`::after`, or
  `::before` when `::after` is taken) that carries its paint ONCE, at rest and on the cursor alike; only its `opacity`
  moves — compositor-only, always interpolable;
* the LIFT is the host's own `transform`, written as a function of `--con-cursor-on` (0 at rest, 1 on the cursor:
  `scale(calc(1 + .035 * var(--con-cursor-on)))`), so ring and lift ride ONE variable and ONE clock;
* `@layer-z: -1` lays the layer UNDER the host's content (the host must then be a stacking context — `isolation:
  isolate` or its own z) — where the host's own box-shadow used to paint;
* `z-index` is a DISCRETE transition (`allow-discrete`): immediate on the way up, delayed by the lift on the way down
  (`--con-cursor-zdelay`), so a card still enlarged never dives under its neighbour; at rest the host stays
  `z-index: auto` (no stacking context — its content keeps the stacking it had).

**`.con-cursor-on()`** on the cursor state (`--focused` / `--selected`): `--con-cursor-on: var(--con-cursor-gate, 1)`,
the z up at once. **`.con-cursor-paint(@shadow)`** — a state colour (playable mint / refused red / not-now amber,
the card actions' steel `--rules` / `--soft` / `--activated`) is another paint of the SAME layer: a state change while
focused swaps the paint, the cursor never re-arrives. **`.con-cursor-shadow()`** — the same grammar for a host that
CLIPS its children (`overflow: hidden` — the colony tile): its own box-shadow written as a function of
`--con-cursor-on` (one list, the same shape at rest and on the cursor), on the cursor's clock.
**`.con-cursor-glow()`** — the same as `-shadow` with NO lift and NO z, for a host something ELSE moves or a host
whose contract forbids a lift (the Parliament's plates are tweened by GSAP; the vote mode's cards stand still while the
player points): one box-shadow list scaled by `--con-cursor-on`. **`.con-cursor-ring(@shadow; …)`** — the LAYER of
`.con-cursor()` alone (no host transform, no z), for a host whose transform belongs to someone else (the composers'
commit row: the ACTION COMMIT presses it with a GSAP scale — a CSS transform transition would chase every frame).

**Rings speak the profile tokens** (`--con-focus-ring`, `--con-glow-r`): the TV widens them by its tokens. The old TV
ring LIST (`console_tv.less`) — a later rule that out-painted every state colour (a refused tile got the full cyan ring
on the couch) — no longer names a migrated surface.

## The default cursor ARRIVES (`src/client/console/cursorArrival.ts`)

The cursor is LOGICALLY there from the first frame (the pad routes to it, the bar reads its verbs, the first press
steps from it); it may not PAINT there before the surface is ready. The surface root wears `[data-cursor-pending]`
while it waits → `--con-cursor-gate: 0` → the focused host stands at REST. On the surface's own ready edge the gate
lets go on the NEXT painted frame (`probeTick`), and the very transition that carries a step carries the arrival.

| Surface | Ready edge | Mechanism |
| --- | --- | --- |
| Hand album | the frame after the copies hand over (`releaseBodies` → `onHandedOver`) | `handCursor` record (`holdCursor` before `holdSlots = false`, `arriveCursor` after the bodies are hidden) — also on close / filter episodes |
| Band surfaces with `data-motion-surface` («Действия карт», colonies, std projects, composers, Parliament) | the entry's own `done` | `surfaceEnterHook` wraps `done` with `gateCursorDuringEntry(el, done)`; cancelled → `releaseEntryCursorGate` |
| Start workspace | the deal and the pane's entry animations finished | `data-cursor-pending` while `deal.state.active`; `gateCursorUntilAnimationsEnd(pane)` |
| Reveal overlay | the deal scene's copies left (deck draw, the board card-bonus lift) | `revealPoseHeld` → `data-cursor-pending="reveal"` on the root — the focused CLASS stays (the cursor is logically there); the colony payout is NOT a term (its scene keeps the batch staged for the whole resolution) |
| Deck pick | the row fitted, then the next painted frame | `finishDeal`: `fitRow()` synchronously → `probeTick` → `beginDeckPickChoosing()` |
| Stage rows (`.con-cards__slot`) | the gate of the row's root | `--focused` transform / ring and the `--has-focus` neighbour dim are scaled by `var(--con-cursor-gate, 1)` |

⚠ **Gate the POSE, never the focused class.** Withholding `--focused` until a scene lets go withheld the cursor itself — the pad, the bar and every probe read the class — and a scene that legitimately holds its batch for a whole resolution (the colony payout) left the owner-bonus card with no cursor at all (`console-colony-miranda-bonus`, caught by the regression). The class says WHERE the cursor is; `data-cursor-pending` says whether its pose may paint yet.

Three rules: **input is never delayed** (a nav / press during an ARRIVING window releases the gate at once —
`installCursorArrivalInput` → `releaseCursorsOnInput`; the step IS the arrival); **no timer stands for a signal** (the
one clock is the painted frame; `CURSOR_PENDING_MAX_MS` = 4 s is a named backstop with a dev warn, never the
mechanism); **reduced motion has no gate** (the cursor simply stands).

**A host's ENTRY gate (`[data-cursor-pending="entry"]`) zeroes the POSE's own clock** (`--con-cursor-ring-ms` /
`--con-cursor-lift-ms`, never the shared `--con-cursor-ms`): the enter hook runs after the inserted element's style was
resolved, so a pose lit at that moment must DROP before the first paint, and lifting the gate restores the clock in the
same style change — the arrival runs the ordinary transition.

### After TR58 — the four routes it left open (the smoothness iteration, PL-473 / 508 / 509 / 510)

**A warmed picture shows WITH its card (PL-517).** Decoding the art ahead (`preloadPremiumCardArt`) is half of it: the face still waited for the async `load` and faded its picture 240 ms from black, so a step entered as lit frames with black bodies. `PremiumCardArt` reads `img.complete && naturalWidth` at MOUNT and shows a picture the browser already holds at once (`pcard__art--ready` — no transition); a face re-pointed in place and a picture still on the wire keep the fade. The beat witness measures the card's opacity, not its picture — only the 4K storyboard sees this.

| Route | Was (witness, GPU, `.e2e-tr58`) | Is |
| --- | --- | --- |
| The hand's CHROME (PL-508) | the header, the status rail, the page edges and the dock spine rose in the handoff's own flush, the cursor a frame later — three events in one beat | `handRevealState.chrome` `held → frame → all`: the FRAME (header, page edges) rises as the copies take off — it is never on their path; the handoff; the READING (the rail, the spine) comes with the cursor, after the copies have gone (`--frame-wait` / `--chrome-wait`); a cancelled open never raises the rail |
| The target step's entry (PL-473) | the step (its cards decoded at the FULL art tier in the press's own frames) appeared in one frame after a 64–111 ms long task; the action composer had no entry at all | the step's full-tier art is decoded while the cursor stands on its row (`targetWarmNames` → `preloadPremiumCardArt`); BOTH composers play the carry (`payloadCarry` — the price-side «ИЛИ»'s shared result is the carried print, TR58); a step with nothing to carry still ENTERS (its groups surface), and so does the review coming back |
| The Parliament (PL-509) | hand-painted `--focus` / `--selected` box-shadow swaps; the default cursor (the voting plate) born WITH the frame; the ruler zone ringed the block AND the plaque; the retired government zone ringed after a sitting | `.con-cursor-glow()` on the plaques, the voting plate, the vote cards (the seat pick's mint lists share their four-layer shape); the ruler's TILE carries the one ring; `closeStage` maps `government` → `ruler`; the entry gate holds the plate's ring |
| A late preview (PL-510) | on a cache miss the review, its rows and the commit row appeared in ONE flush with the cursor posed on them; the commit row's ring was hand-painted | the late content enters as a cascade (`arriveLateContent` → `descendCascade`) and the cursor ARRIVES after it (`lateCursor`, a press releases it at once); the hand stage's own entry gates the cursor too (`handStageEnterHook` → `gateCursorDuringEntry`); the commit row is `.con-cursor-ring()` |

## The hand handoff — show, then remove

The copies are IDENTICAL to the resting slot (the playable mint hairline `con-deal-proxy__face--playable`, the body's
corner and fx scale — `console_card_deal.less`), the targets are measured on RESTING slots (the focus pose is gated
during the flight), and the handoff is «reveal the destination, remove the proxy on the NEXT frame» — `releaseBodies`
hides the shelf bodies on the next `probeTick` (no fade; `HANDOFF_MS` is gone), clears `flightVisuals` only after
(the blocker chip no longer blinks on a still-opaque copy), then lets the cursor arrive.

## Scroll follows the cursor smoothly (`src/client/console/cursorScroll.ts`)

`cursorEnsureVisible(container, el, {axis, margin, align, instant})` / `cursorScrollTo` — one gsap tween per container
on the cursor's clock, retargetable (a held d-pad re-aims the running tween), measured on the RESTING box
(`restingRect` removes the host's own transform, so the lift never scrolls by itself); `instant` for reduced motion and
for a surface that is still busy arriving. `ConsoleScrollArea.ensureVisible` / `scrollToStart` ride it.
`scrollIntoView` is banned in the console (guard).

## Composers

ONE seed: `resetFromPreview` sets the cursor synchronously (`commitCursorTarget`) — no `$nextTick` re-seat; a refetched
preview of the SAME shape (`samePreviewShape`, shared with the play composer) keeps the cursor and every capture. The
standard projects seed their row in `openSheet` before the first render (`seedSheetCursor`), not the last visit's
index followed by a re-seat.

## Guards

* `tests/console/cursorGrammarGuard.spec.ts` (server runner): the reader of `console*.less` (nesting, `&`, comma lists,
  media blocks, mixin calls); ONE clock (CSS = JS); every MIGRATED surface stays on the grammar (host `.con-cursor()` /
  `.con-cursor-shadow()`, state `.con-cursor-on()`); a focus box-shadow beside a resting one with a box-shadow
  transition is INTERPOLABLE (pairwise the same inset-ness); THE RATCHET — hand-painted focus rules per stylesheet
  (`cursorGrammarBaseline.json`; a fall is locked in with `CURSOR_GRAMMAR_BASELINE=write`, the report's BEFORE read with
  `CURSOR_GRAMMAR_STYLES=<git archive of src/styles>`); no `scrollIntoView` in the console.
* `tests/console/cubicBezier.spec.ts` — the CSS curve the scroll tween evaluates.
* `tests/client/console/cursorArrival.spec.ts` — hold / arrive / release, epochs, reduced motion, input release.
* `tests/e2e/focusWitness.ts` — `armFocusWitness(page, {candidates, face, keyAttr, proxy, proxyFace, scroller})` /
  `focusWitness(page)` / `analyseFocusTrail`: on every sample (MutationObserver + `setInterval`, never rAF) the box of
  the FACE under the cursor, its transform, the ring's strength (the layer's opacity, or an outer/inset spread ring
  with alpha ≥ 0.4), the visibility chain, the copy's box, the scroller's offset, long tasks. Report: `snaps` (ring
  0 → ≥ 80 % in one sample on a visible card), `bornHidden` (a focus pose on an invisible card revealed with it),
  `jumps` (> 1.5 px between samples with no running animation), `handoffDelta` + `coexistMs`, `scrollJumps`, `zFlips`.
* `tests/e2e/console-cursor.spec.ts` (fhd + tv4k, `--workers=1`, GPU): the hand (open + step — and the chrome's three
  beats, PL-508), «Действия карт», the colonies, the standard projects — every surface living (no born-hidden / snaps /
  jumps / z flips / scroll jumps).
* `tests/e2e/beatWitness.ts` — the CHROME's witness: named parts (a header, a rail, a step, a block of rows), each one's
  effective opacity per sample and whether an opacity animation / transition was RUNNING on it; `t05` / `t95` (the
  order of beats), `snapped` (≤ 5 % → ≥ 95 % with nothing running — a cut). Sample density proves nothing in this
  harness (timers are coarse, compositor fades progress while the main thread starves): what ran is what tells a fade
  from a cut. `tests/e2e/console-smoothness.spec.ts` (fhd + tv4k): the target step's entry in both composers (PL-473),
  the Parliament's entry + walk + the ruler's one ring (PL-509), a late preview's content (PL-510).

## Adding a surface

1. The host is positioned; call `.con-cursor(<ring list>; <radius>; <lift as a function of --con-cursor-on>; <z>)`
   (or `.con-cursor-shadow()` if it clips its children); the focus state calls `.con-cursor-on()`; state colours are
   `.con-cursor-paint()`. Never a `--focused { box-shadow / transform / background }` by hand (the ratchet grows).
2. Its root gates the default cursor until its ready edge — a `data-motion-surface` band gets it for free; anything
   else binds `data-cursor-pending` off a `createCursorArrival` record (or its own ready flag).
3. A cursor-driven scroll goes through `ConsoleScrollArea.ensureVisible` / `cursorEnsureVisible`.
4. Add the surface to `MIGRATED` in the guard and a scenario to `console-cursor.spec.ts`.
