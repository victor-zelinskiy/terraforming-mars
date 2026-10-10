# A tile that REPLACES one of yours — the removal beat

*Console-native. Files: `src/client/console/tilePlacement/` (`tilePlacementModel`,
`tilePlacementDirector`, `consoleTilePlacement`), `ConsoleTilePlacementLayer.vue`,
`src/client/components/board/placementRenderState.ts`, `src/styles/console_tile_placement.less`.
Guards: `tilePlacementModel.spec.ts` § the DEPARTURE beat, `consoleTilePlacement.spec.ts`
§ the removal beat, e2e `console-tile-replacement.spec.ts`.*

## The defect

Two cards operate on a cell the player **already owns**:

| card | board | what it does to the cell |
| --- | --- | --- |
| **Kaguya Tech** (promo X58) | Mars | remove 1 of YOUR greeneries → place a city there, "gain placement bonuses as usual" |
| **Lunar Mine Urbanization** (moon M55) | Moon | remove 1 of YOUR mines → place the urbanization tile there, same bonus clause |

Both were invisible to the landing hero. `verifyPlacement` accepted EMPTY → TILED
and, since Ares, a tile landing on a plain OCEAN (`covers`); a greenery becoming a
city is neither, so the arm unwound with zero trace. The generic board framework
cannot rescue it either — `observeTilePlacement` is deliberately silent when a tile
type changes without passing through `undefined` ("don't replay the placement
animation; the new graphic just swaps in"). So the whole placement was **a sprite
swap between two frames**: no flight, no removal, no reward beat, and the printed
bonus the card explicitly grants was never seen being collected.

## The scene: a REMOVAL, then an ordinary landing

The card does two physical things to one cell, so the scene shows two. Nothing
about the ARRIVAL is special-cased — the removal is a **prefix**, not a second
dialect of landing:

```
[picking]   the greenery STANDS (it is the object being sacrificed)
   ↓ A
[departing] proxy takes it over 1:1 → the real cell blanks to a bare hex
            → its printed bonus SURFACES underneath → the tile rises away,
              tipping, thickness edge decompressing, owner cube riding along
   ↓ one calm breath on the cleared cell
[approaching] …the ordinary flight, touchdown, silent under-proxy paint,
[rewarding]   …the ordinary printed-bonus payout with its delta chips
```

Measured on the real board (e2e trace): departure `157 → 512 ms`, cleared-cell
breath to `~700 ms`, flight `700 → 1397 ms`, city painted at `1397 ms`.

## The load-bearing decisions

**1. The prompt's `hiddenTiles` marker is the LICENCE, never a guess.**
`verifyPlacement(prev, next, id, {replacing})` reads a tile→tile diff as a
placement only when the arm declared it (`ConsoleBoardInput.saveData` →
`armTilePlacement({spaceId, replacing: isClearedTarget(spaceId)})`). The server
already publishes that marker (`createMarsSelectSpace({hideExistingTile: true})` /
`SelectSpace.hiddenTiles`), so this is the same server-authoritative discipline as
everything else in the scene — an *undeclared* type change is still refused, and a
hazard on either side keeps its own ominous language.

**2. `replaces` is NOT `covers`.** An Ares ocean cover grants NO printed bonuses
(the server skipped them: `coveringExistingTile`), so flying them would be a lie
about money. A removal EMPTIES the cell first (`game.removeTile` → `addTile` sees
`space.tile === undefined`), so the bonuses ARE granted and the reward beat runs
exactly as for a bare hex.

**3. The doomed tile is hidden DURING THE REMOVAL, not during the pick.**
`placementRenderState.hiddenTiles` used to be populated by `ConsoleBoardInput` on
mount and cleared on unmount — i.e. for the whole prompt. That made every candidate
greenery an identical bare hex: the player chose among objects they could not see,
and the uncovering (the card's own "gain placement bonuses as usual") was spent
before the card had done anything. The **cinematic is now the set's ONE owner** —
it opens the window as the proxy takes the tile over and closes it in the same
synchronous turn the replacement paints. What a cell is worth during the pick is
the placement dossier's job (`ВЫ ПОЛУЧИТЕ · Бонус клетки`), and it already did it.

**4. The bonus icons cannot be captured at detect.** Every other landing captures
the printed icons' live rects at detect, while the cell is still uncovered. A
remove-and-replace cell is the one case where they are **not in the DOM yet** — the
doomed tile is standing on them. The departure therefore captures them itself, the
frame after the removal window opens (`runDeparture`: hold → `nextTick` →
`captureBonusIcons` → *then* the reveal class → the lift). Capturing after the
reveal class would hand the reward beat a mid-animation, shrunken origin.

**5. The owner marker leaves ON the tile it was marking.** The proxy carries a
`PlayerCube` twin and the real cube is held (`holdCubeForHeroPlacement`) from the
departure through the landing's own drop. The board authors that socket in px
against the UNSCALED 46×51 cell (`right: 7px; bottom: 14px`, `:size="12"`) and then
rides the board's zoom transform — a `position: fixed` proxy posed at the MEASURED
(already-zoomed) rect does not inherit it, so `departingCubePose(color, hex)`
re-derives all three numbers as a fraction of the live hex. The e2e asserts the
twin's rect is inside the proxy's, so a zoom-induced drift fails.

**6. Every degrade path still clears the cell.** No stage, no measurable hex,
reduced motion, an abort mid-lift — the removal window is opened/closed by
`holdClearedCell` / `releaseClearedCell`, wired into `paintRealTile`, `finish` and
`abortTilePlacement`. A cell may never be left "cleared" (its new tile would be
blanked) and a refused placement must put the doomed tile back.

## The THIRD case: a CITY TIER (Turmoil Redux — Skyscrapers, RX20)

`Skyscrapers` places a city tile **on top of the player's own city** — a stack
(`Space.stackHeight`, one field, one owner, one tile object). The prompt declares
it (`placementType: 'city-tier'`), `ConsoleBoardInput.saveData` arms with
`stacking: true`, and `verifyPlacement(prev, next, id, {stacking})` reads a
same-tile diff whose stack grew by **exactly one** as a landing (`stacks: {from,
to}`) — an undeclared height change is refused exactly like an undeclared type
change. Nothing about the removal beat is reused: this is a different **landing**,
not a prefix.

```
[picking]     the city STANDS (it is the base); the dossier already says «No placement bonus»
   ↓ A
[approaching] THE SWING — the proxy (sized to the stack's LIFTED top rect,
              `stackLandingRect`) leaves the supply on one low arc, horizontal
              speed dying out (power2.out), carried large, and HANGS straight
              over the stack (`tierHoverPoint`, TIER_APPROACH_MS)
              THE LOAD — `cityStackScene.loading`: the real cell's contour
              tightens, its tile settles 1 px and compresses to @stack-scale,
              the counter APPEARS at «×1»; the owner cube is held (TIER_HOVER_MS)
              THE LOWERING — straight down, x fixed, lowered INTO the board's
              scale, the shadow tightening (TIER_DESCENT_MS, power1.inOut)
              CONTACT — edge 3 → 1 px, one brightness pass, a damped settle,
              NO bounce (TIER_CONTACT_MS)
[landed]      in the SAME synchronous turn: the real tile paints (the base
              becomes the lower tier at the scale it already stood at, the top
              tile appears lifted under the proxy) AND `stackContact` — the
              counter ticks «×2» with its one-shot pop, the cell jolts 1.2 px;
              the DUST ring bursts from under the tier (`playStackDust`); the
              proxy dissolves; the cube drops onto the new top (TIER_SETTLE_MS)
[done]        NO reward beat: nothing captured, nothing held — the receipt on
              the sitting says «no cell bonus», the journal line names the stack
```

Measured on the real board (e2e `console-parliament-skyscrapers`): see the spec's
sampler for the vertical-descent proof (the tier's x stays on the stack's centre
through the whole lowering; its y is monotone; the counter's text changes in the
same sample the top tile paints).

**Why the real cell is CSS, not GSAP.** The board's own stack look is a
`transform` on the top tile (`.board-space--stack`: lift + scale). A GSAP tween
on that same element would fight it at the paint; `cityStackScene` is a two-flag
reactive state the cell renders as classes, so the load (`--stack-loading`) and
the contact (`--stack-contact`) are transitions and one-shot keyframes on the
cell's OWN rules, and the frame of contact is one synchronous write (`stackContact`
+ `applySpacePreview`). Reduced motion / no stage: the paint with its tick.

**Geometry is mirrored, not shared.** `STACK_STEP_PX` / `STACK_SCALE` in the model
duplicate `@stack-step` / `@stack-scale` in `board.less` (the proxy must land where
the board will paint) — change one, change both; the model spec pins the numbers.

### THE TRUTHFUL STACK — a pile is drawn as the pieces lie (owner's ruling, 2026-10-04)

A stack is built ONE way: a **plain city tile** is put on top of a city that
already stands. So the top of a pile is a plain city and the cell's own tile —
a Capital, an Ocean City — is its **BASE**; the engine agrees (`liftTopCity`
takes `{tileType: CITY}` off a pile and never changes the base's kind). The first
cut drew the whole pile in the cell's art — a Capital under a tier read as two
Capitals — and a tier leaving it flew «as a Capital» and landed as a plain city:
a piece changing its kind in the frame of the landing. A piece cannot change its
kind by being carried.

Two pure functions in `common/boards/cityStack.ts` are the ONE answer, read by
the picture, the tier that lands and the tier that leaves alike:

- **`stackTopTile(tileType, stackHeight)`** — the piece on top: the tile itself
  for a single tile, `CITY` for any pile of cities;
- **`stackBuriedTile(tileType, stackHeight)`** — the special tile lying UNDER a
  tier (`undefined` for a single tile and for a pile of plain cities).

What reads them:

- `BoardSpace.vue` — the top tile wears `stackTopTile` (`BoardSpaceTile`'s
  `topArt`; `space.tileType` stays the cell's truth for everything else), the
  LOWEST drawn tier wears the cell's own art (`tierArtClassOf`), every tier
  between is a plain city;
- **the buried tile's MARK** (`.board-stack__under`, `[data-stack-under]`) — a
  miniature of the real tile's art on a dark hex plate, nested in the cell's
  lower vertex: inside the hex, clear of the counter (a pill) and of the owner
  cube (shapes, not boxes — the e2e measures the hex against the pill). A single
  Capital and a pile of plain cities carry none. Static — information never
  animates. The art is cropped to its inner 84 % so the pixels go to what tells
  one city from another;
- **the counter's offset is a fact of the cell's OWN tile**
  (`.board-space--stack-special`), never of the height: it stands in one place
  through the landing («×1» → «×2», the mark appearing at contact) and the
  departure («×2» → «×1», the mark going);
- `verifyPlacement(…, {stacking})` — the tier that LANDS is `stackTopTile(next)`:
  the proxy over a Capital is a plain city;
- `verifyMove` — the tier that LEAVES is `stackTopTile(prev)`: the proxy is the
  plain city from its first frame to its last, and «a Capital arriving off its
  own stack» is refused.

⚠ **The Capital's art in this fork differs from a plain city's by a star and a
skyline** — at 1080p the miniature says «a special city lies under» by its
PRESENCE more than by its detail; which one is the dossier's job (the cell's own
line names the tile).

Guards: `tests/boards/cityStackPieces.spec.ts` (the two functions + their
agreement with `liftTopCity`), `BoardSpace.spec.ts` § a stack over a SPECIAL
city, `tilePlacementModel.spec.ts` / `tileMoveScene.spec.ts` (the travelling
piece), e2e `console-re-settlement.spec.ts` § a stack on a Capital (two profiles:
the pile at rest, the mark's clearances, the proxy's art across the whole move,
the server's record).

## The FOURTH case: a MOVE (Turmoil Redux — Re-settlement, TR14)

`Re-settlement` takes the player's own city on Mars off its cell and puts it on
a NEIGHBOURING one. The pick declares it (`placementEffect: 'move'`; the answer
names both cells — `{spaceId, movedFrom}`), `ConsoleBoardInput.saveMove` arms
with `movedFrom`, and `verifyPlacement(prev, next, id, {movedFrom})` reads
exactly that PAIR (`verifyMove`): B «empty → a city of the owner who held A» (a
tile that left whole is the SAME tile; a stack's top tier lands as a plain
city), A «a city → empty» or «the same city one tier lower». A declared move
the response does not show is REFUSED — never read as a plain landing on B.

It is neither a landing nor a departure, and it borrows neither's signature:

```
[picking]   two levels of ONE prompt (board-placement-flow.md § A MOVE): the
            city is lifted (presentation only), the cell is locked, A commits
   ↓ A      (the one POST — the tail names both cells)
[moving]    HANDOFF (0) — ONE proxy (the `depart` twin, wearing the art of the
            PIECE THAT TRAVELS — the tile itself, or a stack's plain top tier —
            its owner cube and a touch overlay) is posed 1:1 over the real
            tile on A — its box IS the destination hex, scaled to the source
            rect — and in the SAME synchronous turn `applyVacatePreview` makes
            the real cell what the server left there: a bare hex with its
            printed bonus, or the same stack one tier lower. Nothing is seen
            to change. The pick's own pose lets go (the section reads the
            scene: `sceneOwnsMove`); the vector stays, to be eaten.
            LIFT (0 → 200) — straight up ≈ 10 board px, scale → 1.08, the
            thickness decompresses, the ground shadow separates; A's printed
            icons surface under it (the removal's own one-shot).
            CARRY (200 → 620) — one low arc across the shared edge, in-out;
            the shadow travels on the ground a touch behind; the vector is
            eaten from its tail (`.con-bmove--eaten`); A settles ONCE
            (`markCellVacated`) when the tile has cleared its contour (35 %);
            B's printed icons pre-lift at the landing's own fraction.
            LANDING (620 → 770) — lowered into the board's scale, the shadow
            tightening to contact, the thickness compresses, one brightness
            pass, a damped settle — no bounce.
[landed]    the REAL tile paints under the settled proxy (`applySpacePreview`),
            its cube at rest — it rode the tile, there is no drop — and the
            proxy is GONE the next painted frame (`removeMoveProxy`): show,
            then remove — never a dissolve.
[rewarding] the landing's own beats, unchanged (`endTilePlacement`): the cell's
            icons, the water, Ares, the law's wave, the card's seal wave.
```

Never: an arrival «from the table», a tilt, a fade, a thrown cube, a frame with
two cities or with none.

**One clock, one writer.** `playTileMove` drives the proxy from ONE progress
tween (`render(t)` computes the pose of every beat from the move's own clock and
the resting pose is WRITTEN at the end). The first cut chained three tweens plus
relative settle tweens on the element — and on a slow renderer (the 4K profile,
a handful of frames per scene) the proxy was measured resting one LIFT above the
destination, the real tile then appearing a whole lift below it. A pose computed
from the clock cannot skip or reorder a beat however long a frame is.

**A stack source is «the crane, reversed».** The proxy is the TOP TIER — the
plain city it is, whatever the base (§ THE TRUTHFUL STACK) — in its
lifted rect (`moveSourceRect` → `stackLandingRect`), the lift is strictly
vertical, and the real cell answers through `cityStackScene`'s mirrors of
`contact` / `loading`: **`released`** (the counter already reads the lower height
and ticks; at height 1 it has named «×1» and goes) and **`unloading`** (a cell
that is no longer a stack returns its tile from the stack's scale to the full
hex) — set by `stackRelease(id)` in the handoff turn, cleared by
`clearStackRelease(id)` with the scene. CSS one-shots on the cell's own rules,
for the reason the tier's landing gives.

**The remote stage plays the same move.** An opponent's Re-settlement, or the
viewer's own PARKED pin landing a response later, shows up in the diff as a
removal and a landing. They are paired ONLY by the server's record
(`game.tileMoves` → `tileMoveRecords.pairTileMoves`: a record is honoured when
this very diff bears it out — `verifyMove` again — and consumed once by `seq`),
queued as ONE event and played by `moveRemote` with the same director: A keeps
painting the city that left (`holdRemoteReveal(from, prevTile, prevColor)` — tile
AND owner cube; a stack keeps its former height through `holdStackHeight`) until
the proxy takes it over, B stays hidden until the touchdown. No record → the two
changes keep their separate beats. `stageRemoteTileEvents` skips BOTH cells of
the viewer's own live hero, and the hero claims its own record at detect.

**The piece has a KIND, and the kind decides what rides the proxy (TR39 Canyon
Carving — an ocean, 2026-10-10).** The same fourth case plays a tile NOBODY
owns: `verifyMove` reads the pair «a plain ocean of nobody's on A → EMPTY,
EMPTY → a plain ocean of nobody's on B» beside the city's pairs, and the proxy
is born in the OCEAN's art (`departingTile` = the record's tile) with **no
owner cube** — `departingCubePose(undefined)` is no cube, so neither the hero
(`landed.moves.color`) nor the remote stage (`move.color`) seats one; the
remote record's `color` is who MOVED the tile (whose scene it is), never an
owner. Nothing else differs: the same `playTileMove` clock, the same
`applyVacatePreview` (an ocean reserve surfaces its printed icons under the
lifting tile exactly as bare land does), the same `markCellVacated`, the same
landing rewards — and because the ocean parameter is read off the board and
the count does not change, no scale marker, no HUD «N/9» and no board-beat
park moves (the e2e samples all three on every tick). A second scene for a
second tile would have been the defect.

**What the MOVE itself pays is the landing's LAST beat (PL-133, 2026-10-10).**
The transaction holds and pays, in the engine's order, what `addTile` grants —
the cell, the water, the neighbours, the law. An ocean move pays a rating AFTER
`addTile`, and that rating is neither a scale step (the parameter stands, so
no scale story tells it) nor a cell bonus — so it was not held: it ticked as
a bare number at the commit (which the transport holds to the touchdown — so
right after the landing), BEFORE the cell's bonus and the water and with no
token of its own (the plant and the water are SHOWN by their beats; the
rating was merely told), and the Greens' answer to it was netted into the
card's price («−4» for −6 + 2). The server now publishes `thisPlayer.lastTileMoveReward`
(`TileMoveRewardModel` — the `lastOceanBonus` law: the pair, the rating, and
the table's answer MEASURED on the mover's stock around the grant), the detect
claims it on the armed pair only, `seedTilePlacementRewardHold` holds both,
and `runMoveRewardBeat` plays them after the law's wave: the rating token is
born at the landed tile and flies to the score cell, the answer is released
one tick-gap after the touchdown (PL-002 — an answer never before its cause).
The M€ row therefore makes three statements: the price alone at the commit,
the water after the cell's plant, the Greens one beat after the rating (fhd
trace: landing 1399 → price 1506 → plant 2496 → water 4212 → rating 5069 →
Greens 5170 ms). The e2e's «landed» is the SCENE's own word — the hero's
`data-tile-phase` reaching `landed` (the contact), the remote stage's reveal
hold releasing — never the DOM's «a tile exists on B»: the hero's real tile
can stand in the DOM under a proxy that is still flying.

**Degrades.** No stage / no measurable hex → both cells take their final poses
in one turn and the layer root carries `data-tile-move-degraded` for the scene's
length (the e2e demands its absence). Reduced motion is not a degrade: final
poses + the stack's tick, `TILE_REDUCED_MS`. An abort mid-carry leaves A vacated
and the commit paints B — a city is never lost.

**Not covered.** A move ONTO an Ares hazard: `verifyMove` demands an empty
destination (a hazard built over keeps its own cleanup sequence), so the hero
unwinds and the board plays a lift on A plus the hazard cleanup on B — two
beats, not one object.

Guards: `tests/client/components/console/tileMoveScene.spec.ts` (the pair, the
pinned numbers — beside a pin of the landing's, the removal's and the tier's —
the geometry of one object, the records, the hero transaction, the remote
stage) and e2e `console-re-settlement.spec.ts` (two profiles, both clients: one
proxy, a centre that never turns back, never two cities or none, `--vacated`
before the landing, the bonus counter after it).

## Where else this shape appears

The engine's tile→tile replacements are a **closed set**: the two cards above, plus
the Ares ocean covers, which already have their own splash. Nothing else in
`src/server` writes a tile over a tile.

One adjacent shape is now CLOSED, one is still open — the departure primitive
(`placeDepartProxy` / `playTileDeparture`) is what both reuse:

- **A pure REMOVAL** (tile → nothing) — **SHIPPED with Water Export (RX33,
  2026-09-26)**, on the REMOTE stage, for every viewer alike. The commit path
  never held anything: the tile's disappearance is a diff the shared
  `stageRemotePlacements` now reads beside the fresh placements
  (`detectFreshRemovals` — TILED → EMPTY, hazards excluded), queued through the
  same watchable-board wait and drained by `liftRemote`: the cell keeps painting
  the tile that LEFT (`holdRemoteReveal(space, prevTile)` on an EMPTY committed
  cell — `BoardSpaceTile.klass` paints the held art, `BoardSpace.showBonus` keeps
  the bonuses under it), the departure proxy is posed 1:1 over it and the hold is
  released in the same synchronous turn, the tile unseats and rises away
  (`playTileDeparture`), and the vacated hex settles once (`markCellVacated` →
  `board-space-tile--vacated`, a compositor-only one-shot the cell clears on its
  own `animationend`). The chooser's own answer and an observer's poll go through
  the ONE path — so the Reds' party action and the Dry Deserts event got the same
  frame for free. The parliament's world beat treats the record as a board story
  (`isBoardRecord`): a removal arriving under a covered sitting yields the frame
  and waits out the lift (`isRemotePlacementActive`); one arriving on a watchable
  board (the chooser standing on it for the pick) plays in place and goes
  straight to the receipt. **Still open in the same family**: the two HAZARD
  removals (World Government's «remove an unprotected hazard», Eris) keep the
  board's own language — `detectFreshRemovals` excludes hazards on purpose, as
  `detectFreshPlacements` does.
- **A REMOTE remove-and-replace** (an opponent plays Kaguya Tech): the observer
  still gets the silent swap. `detectFreshPlacements` skips tile→tile, and the
  remote stage deliberately declares `depart: undefined`. Wiring it up means a
  second departure proxy set on the layer, a departure leg in `flyRemote`, and
  switching `holdRemoteReveal(spaceId, prevTile)` to a bare-hex hold at the lift.
