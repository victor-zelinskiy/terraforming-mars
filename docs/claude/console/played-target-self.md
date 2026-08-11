# The SELF-TARGET of a played-card target step

*«ИСТОЧНИК · ЭТА КАРТА» — one physical card, a navigation proxy, and a measured
wire between them.*

Scope: `ConsolePlayedTargetStep.vue` (`.con-ptsel`) and its two hosts,
`ConsolePlayCardConfirm.vue` (a card being PLAYED) and `ConsoleActionComposer.vue`
(the blue ACTION of a card already on the table). Everything here is host-agnostic
— a third host inherits the behaviour by publishing one attribute.

---

## The problem

Some cards are a legal target of their own effect. Titan Floating Launch-pad is a
Jovian card and adds two floaters to ANY Jovian card; Comet Aiming puts its
asteroid on any card, and it is a card. The selector's first cut drew that
candidate as a second full-size face — two copies of one physical object on one
screen, which is precisely the continuity this fork spends its whole motion
budget defending, and the source card was already standing in the hero column
half a screen to the left.

So the self-target is a **PROXY**: a compact navigation stop that stands in the
same horizontal row as the physical targets and points at the real card.

---

## 1 · The proxy is a CELL, not a chip (the reflow contract)

`.con-ptsel__cards` is a wrapping flex row bounded by the section's **solved
span** — `cols × cardW + gaps`, computed by `planPlayedTargetSizing` on the
assumption that every cell is at most one card wide. The proxy is the one cell
whose content is text rather than a card face, so it is the one cell that can
measure anything at all.

It measured its CONTENT, and its content depended on STATE: the ✓ badge was an
in-flow child, so choosing the self-target grew the chip past a card width, the
row broke to a second line, and **a horizontal pair became a vertical stack at
the exact moment of selection**. The bug looked like a layout mode change; it was
one cell overflowing by the width of a badge.

Two rules, both guarded in `tests/styles/playedTargetLayoutContract.spec.ts`:

- **The box is solved, never intrinsic.** The step publishes
  `--con-ptsel-slot-w` (`SLOT_W_PX × cardZoom`, the same width every card cell
  gets) and the proxy is `width: min(var(--con-ptsel-slot-w), 15rem)` with
  `box-sizing: border-box`. Narrower than a cell is safe (the row only wraps on
  overflow); wider is the bug. No profile override may re-declare a width that
  is not bounded by that variable.
- **A state marker is never a term in the width of the thing it marks.** The ✓ is
  `position: absolute` in a permanently reserved right gutter — the same grammar
  `&__lock` already used on card cells. Focus, selection and deselection are
  PAINT on this surface and nothing else.

⚠️ The direction of the layout must depend on **geometry alone**. A vertical
fallback is legitimate only when the row genuinely does not fit; it may never be
a function of what is selected.

## 2 · The wire (`ConsolePlayedTargetLink.vue`, `.con-ptlink`)

The proxy used to carry a `↰` glyph. It read as «назад» — the one meaning B
already owns on that screen. It is replaced by a physical connector between the
two **real boxes**.

- **Mounted on the BAND**, by each host, because the band (`.con-composer__playmain`
  / `.con-composer__actmain`, both `position: relative`) is the only element
  containing both ends. It is `position: absolute; inset: 0; pointer-events: none`,
  so a flex or grid host gains no item and loses no hit target — and it is
  `v-if`-gated on `playedTargetSelfState.present`, so the overwhelming majority
  of prompts (which have no self-target) never mount the overlay or its
  ResizeObserver at all.
- **Two marker attributes are the whole contract** — it names no host, no card
  and no coordinate:
  - `[data-ptsel-source]` — the hero card's box (the composer publishes it)
  - `[data-ptsel-self]` — the proxy's box (the step publishes it)
- **Every number is measured**, then divided back into the frame's own layout
  space by the established `effZoom = rect.width / offsetWidth` ratio: this
  subtree sits under at least one CSS `zoom` ladder on every profile, so client
  px and local px differ by a factor only measurement knows. That ratio is the
  shared `effectiveZoom(el)` in `cssUnits.ts`, not a fourth inline copy.
- **It degrades by disappearing.** The wire is drawn only while the proxy is
  genuinely to the RIGHT of the card and vertically inside it. When the row falls
  back to a stacked layout those tests fail and it renders nothing — no rotated
  line, no elbow, no special case.
- Re-measured on: presence, the step's geometry nonce (a new model, a re-solved
  card size, an owner-tab switch — `invalidateGeometry`), a band resize
  (`useResizeObserver`), and a **focus move** (the step scrolls the cursored
  candidate inside its own viewport, which moves the proxy while nothing
  resizes). Coalesced to one rAF.

## 3 · Three roles, three voices

Around ONE card, these must never blur into competing frames:

| role | cue |
| --- | --- |
| SOURCE / CONTEXT | no ring at all — standing in the hero column IS the statement |
| NAVIGATION FOCUS | cyan ring + a hairline lift + one short light down the wire; leaves with the cursor |
| SELECTED TARGET | emerald ring, **no lift** — a settled fact does not hover |

Reduced motion is answered in **CSS only** (`@media (prefers-reduced-motion:
reduce)` hides the pulse). A JS mirror of the same policy was a snapshot of a
live media query and the two could disagree mid-prompt.

The pulse fires on the **rising edge of focus only** (`playedTargetSelfState.pulse`
is a nonce, and the edge detection lives in the setter so «one pulse per arrival»
is true for every reader by construction). It is never a loop: a permanent pulse
turns a physical connection into decoration, and the eye stops reading decoration
within a second.

**Where the lift rides matters.** It is on an element we own INSIDE the measured
anchor (`.con-composer__actcard` inside `[data-zoom-slot][data-motion-anchor]`),
so the boxes the zoom entrance and the outcome FLIP solve against keep their
geometry. The transition is declared under the `.con-composer--ptsel` phase
marker, not on the base class — outside the target step neither element is ever
transformed, and an always-on transform transition would be a rule every future
FLIP has to be checked against.

## 4 · X inspects the REAL card (`consolePlayedTargetZoom.ts`)

The step gave every candidate a `data-zoom-slot` and inspected through the
generic `slotZoomOrigin`. For an ordinary candidate that is exactly right. For
the self-target it was wrong twice: the origin resolved to the little proxy chip
(so the card rose out of a text box, at a text box's aspect), and the slot held
empty was that chip — while the card the proxy NAMES stood untouched in the hero
column.

`playedTargetZoomOrigin(getRoot, keyOf, sourceCardName)` **redirects**: the
candidate whose key is the source card resolves to `[data-ptsel-source]`,
everything else falls through to `slotZoomOrigin`. Everything downstream is the
console's one zoom choreography, unbranched — including `.con-zoom-hold`, which
empties the resolved slot **from before the proxy's first painted frame until
after it is gone** (`playZoomOpenFlight` calls `holdSlot` synchronously before
the tween; `playZoomClose` releases it 60 ms before touchdown so the card
dissolves back into its own seat). The connector hides with `body.con-zoom-open`
— a wire drawn to an empty seat points at nothing.

`getRoot` is the HOST's root, never `document`: a parked / `v-show`-hidden second
composer would otherwise shadow the live one with a zero-rect slot and
`usableRect` would silently degrade the entrance to the textual rise.

The source card's identity is read once, from the model's own decision, via
`playedTargetSourceCardName(owners)` — never re-derived from a card name at a
call site, which is what would let the two disagree.

## 5 · One counter, and it is the CARD'S OWN (`.pcard__res`)

«How many of this card's own resource are on it» was told in four incompatible
dialects at once: a gold disc carrying a BARE NUMBER (no icon — the player had to
already know what the card stores), a compact icon+number chip inside the proxy,
a full-width «2 на этой карте» plate under the hero, and the Result line's
`2 → 3`. Three of those state the same fact.

The division of labour that settles it:

| surface | says |
| --- | --- |
| the card's own capsule (`.pcard__res`) | the CURRENT count. Neutral warm gold. |
| the chip in the PROXY (`.con-cardres`) | the self-target option's own count |
| the Result / Summary | the PROJECTED change (`2 → 3`). Emerald. |

Green belongs to what WILL happen; a standing quantity is not an event, so it
never wears the gain colour.

**THE CARD ALREADY HAD THE ANCHOR — the console just wasn't feeding it.** The
premium face carves the count into the panel at bottom-left, beside the expansion
stamp (`.pcard__res`, built by `buildResource`). Every console host was handing
that face a card NAME and nothing else, so it printed a permanent `0` and the
true count had to be repeated somewhere else — which is how three dialects were
born. Passing the live `CardModel` down (`ConsoleCardFaceLite`'s optional `card`
prop → `PremiumCard`) makes the one anchor true, and the count then rides the
card's zoom, its focus lift, its scale, a FLIP and the fullscreen inspect **by
construction**: it is a child of the face, not a layer above it.

An overlay chip drawn on top of the card shipped first and was removed for
exactly this: it put the reading at a SECOND anchor whose position followed the
overlay's own layout, so the number sat mid-art on one surface and at the foot on
another — the reported «компоновка скачет». One place on every card, always.
`ConsoleCardResourceChip` survives for the one candidate that has no face to
carry it: the «ИСТОЧНИК · ЭТА КАРТА» proxy is a navigation stop, so its count is
ordinary rem-authored UI.

The plate is **dark** on purpose: the resource sprites are full-bleed gold-framed
tiles (the ornate frame is baked into the 512² art), so a gold plate under one
doubles the gold.

**ZERO IS A READING, NOT AN ABSENCE.** Once a step moves this resource, every
candidate the server offered can by construction hold it — so the current amount
is part of the decision on ALL of them. The card face gets this free
(`model?.resources ?? 0`), and the proxy's `playedTargetResourceFor` returns
`showZero: true` to match. An empty card answering with no counter says something
else entirely («this card does not take floaters»), which is the opposite of true
and the one thing the player would act on. `card.resources` is omitted rather
than sent as 0, so the absent field IS the zero.

A host that FREEZES the count for a beat (the action commit holds it at the
pre-reveal value until the reward wave lands) passes a spread model with
`resources` overridden — `heroCardModel` in `ConsoleActionComposer`. The freeze
belongs to the host's timeline, never to the face.

## 6 · The inline chip scale (`--con-chip-c-*`)

The hero's «ВЫ ПОЛУЧИТЕ [icon] +1 на карту» took the system chip size PLUS a
notch, so the loudest capsule on the screen described a consequence the player
had not chosen yet — it out-shouted the action text, the target card and the
confirm button, and its icon alone was taller than the whole label beside it.

`--con-chip-c-fs / -icon / -pad / -note / -gap / -radius` are the COMPACT variant
of the existing chip tokens, raised once per profile. They serve the hero chip
and the Result line's `2 → 3`: both are result METADATA sitting next to a label,
not controls. The capsule loses ~35 % of its height and the pill becomes a modest
radius, so the button silhouette goes with it.

⚠️ Size the icon against the **visible symbol**, not the CSS box: the sprite's
gold frame is ~40 % of the art, so the icon box is set slightly LARGER than the
digit's cap height to land the two at the same optical weight.

## 7 · Overflow ownership (why two rails appeared with two cards)

Two independent arithmetic errors, neither of them about content:

1. **The cap was measured against the BAND.** The step does not sit on the band —
   in the action host it is four boxes deeper, inside the stage plate's own
   scroll area, whose viewport ends `.6rem` above the band. Sized to the band the
   step grew PAST its container: the outer scroller gained travel (a second rail)
   and clipped the last element of the step's column — the Result line. The
   budget now subtracts **every bottom padding + border between the step and the
   band**. Those are fixed by the layout, so the read stays acyclic.
   ⚠️ Reading the scroll VIEWPORT's own height instead is the tempting version
   and it is CIRCULAR: that box is `flex: 0 1 auto`, i.e. content-sized, so it
   reports back whatever the cards last came out as. It collapsed the budget
   until a two-card row stacked vertically — a fresh bug wearing the fix's face.
2. **The solver under-reserved the viewport chrome** — 40 px against a real 65
   (`PLAYED_TARGET_VIEWPORT_CHROME_H`), plus a hardcoded three column gaps where
   a single-owner step has two. So a two-card step with `overflows: false` still
   had travel and advertised a journey of nothing.

`ConsoleScrollArea` was never at fault: its rail is `v-if`-gated on real overflow
and there is no native scrollbar chrome anywhere in console mode. Its epsilon is
now scale-aware (`4 × conUiScale()`) — a flat 2 px is half a logical pixel at 4K,
i.e. below the rounding noise it exists to absorb.

The adaptation ladder is unchanged and already correct: `planPlayedTargetSizing`
enumerates row shapes and takes the biggest readable card, shrinking before it
ever reports `overflows` — scrolling is what is LEFT when every arrangement lands
under the readable floor, never a first resort.

---

## Guards

| what | where |
| --- | --- |
| the proxy's width is bounded by the solved cell; the ✓ is out of flow; no profile override | `tests/styles/playedTargetLayoutContract.spec.ts` |
| the viewport chrome sum, the column gap, and the acyclic budget | `tests/styles/playedTargetLayoutContract.spec.ts` |
| zero counts render; the chip carries a real sprite | `tests/client/components/console/consolePlayedTargetPreview.spec.ts` |
| no scroll rail, no clipped Result line, compact gain chip, chips on every target | `tests/e2e/console-self-target.spec.ts` |
| the proxy is not a zoom slot, publishes the connector anchor, and the hero publishes the source anchor | `tests/client/components/console/composerRender.spec.ts` |
| the origin redirection, its host scoping and its degradation | `tests/client/components/console/consolePlayedTargetZoom.spec.ts` |
| `playedTargetSourceCardName` across owner groups | `tests/client/components/console/consolePlayedTargetModel.spec.ts` |
| the whole flow with a real layout engine, at 1080p and 4K, in BOTH hosts | `tests/e2e/console-self-target.spec.ts` |

The e2e is the one that matters for the reflow: the claim is «these boxes did not
move», which is a number, and no unit test can see it — the solver's arithmetic
stayed right for the entire life of the bug while the stylesheet overruled it.

## Known adjacent issue (not this subsystem)

Pressing X again **immediately** after closing the fullscreen viewer can do
nothing: the shell opens the viewer from an `undefined → defined` watcher on
`consoleCardZoom.card`, and the module state is cleared on the dialog's own
`close` event. A press that lands inside that window sets an already-defined
value, so the watcher never fires. It is reachable from any surface that inspects
twice in a row and is why `tests/e2e/console-self-target.spec.ts` waits for
`body:not(.con-zoom-open)` between inspects.
