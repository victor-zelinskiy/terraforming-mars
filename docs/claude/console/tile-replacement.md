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

## Where else this shape appears

The engine's tile→tile replacements are a **closed set**: the two cards above, plus
the Ares ocean covers, which already have their own splash. Nothing else in
`src/server` writes a tile over a tile.

Two adjacent, still-unanimated shapes — the departure primitive
(`placeDepartProxy` / `playTileDeparture`) is what they would reuse:

- **A pure REMOVAL** (tile → nothing): `RemoveOceanTile` (Turmoil Reds action, the
  Dry Deserts global event) and the two hazard removals (World Government's
  "remove an unprotected hazard", Eris). The player picks a tile and it simply
  stops existing — today's silent pop-out is the same class of defect this beat
  fixes, and the lift half already exists.
- **A REMOTE remove-and-replace** (an opponent plays Kaguya Tech): the observer
  still gets the silent swap. `detectFreshPlacements` skips tile→tile, and the
  remote stage deliberately declares `depart: undefined`. Wiring it up means a
  second departure proxy set on the layer, a departure leg in `flyRemote`, and
  switching `holdRemoteReveal(spaceId, prevTile)` to a bare-hex hold at the lift.
