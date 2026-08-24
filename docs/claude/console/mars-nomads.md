# Mars Nomads — the camp marker + the two flows (console-native)

The Mars Nomads camp (promo X59) is presented by ONE physical object — the
**NomadToken** (`src/client/components/NomadToken.vue` + `nomad_token.less`):
a low mobile module of dark iridium-titanium with electrum-copper seam light
and an engraved wayfinder mark. It is deliberately NOT a player cube: identity
is carried by MATERIAL + SEAMS + THE ENGRAVED MARK, never by hue alone
(colour-blind safe by construction, and it can never read as ownership).

ONE component serves every representation — the board cell (`BoardSpace` →
`.board-nomad`), the premium card face (`premiumCardIcons` `{kind:'nomad'}` →
`PremiumMechNode` → `.pcard-cube--nomad`), and the console flight proxy
(`ConsoleNomadMoveLayer`). The legacy render-DSL rows (`CardRenderData` inside
the action composer) draw the FLAT SVG TWIN (`.card-resource-nomads` in
`cards_v2.less`) — same palette, one visual language; change one, change both
(`body #232830/#1b1f26/#14171d · seams #f0a95e`).

## The two flows are the SERVER's declaration, never a client guess

`SelectSpaceModel.placementEffect` (invariant 1 — no DOM/text detection):

| effect | what it is | who presents it |
| --- | --- | --- |
| `'marker'` | the FIRST placement — seat the camp, grant **nothing** | Flow A: the shared marker framework |
| `'bonus-only'` | the MOVE — grant the destination's printed bonuses | Flow B: the nomad-move transaction |

`ConsoleBoardInput.saveData` (the ONE arming point of every console space
pick) branches on it: `'bonus-only'` → `armNomadMove`; `'marker'` → **no hero
arm at all**; default → `armTilePlacement`. `ConsoleShell.armBoardBonusIfCardCell`
is gated the same way: a `'marker'` pick never lifts a card cover (it would
promise a draw the commit never makes — this also fixed Land Claim / Arcadian
picks on card cells), and a `'bonus-only'` pick leaves the cover to the move
scene's own pre-lift beat.

## Flow A — the first landing (grants nothing, and nothing reacts)

Rides the shared **markerPlacementAnimation** framework (`'nomads'` joined
`MARKERS`): baseline map (no replay on polls), resume via negative delay,
`arePlacementAnimationsArmed()` window, the transport's marker hold (now
diff-aware: `markerPlacementHoldDurationMs(old, new)` covers the longest
landing in the response). The descent itself is the NomadToken's landing
keyframes (`nomad-landing-*`): cell focus halo → materialize over the surface
→ gravity descent with the contact shadow CONVERGING → micro-compression +
one dust breath → damped settle (~860 ms; reduced = 200 ms fade). The cell's
printed bonuses deliberately do not move — no lift, no chips, no counter, no
card cover.

A nomads flag APPEARING while some cell LOST it in the same response is a
MOVE, not a landing — `isMarkerMove` excludes it from `shouldHoldFor…` /
`applyMarkerPlacementPreview` / `landedMarkersIn` by construction.

## Flow B — the move (`src/client/console/nomads/`)

The tile-hero transaction contract 1:1 (`nomadMoveModel` pure / 
`consoleNomadMove` lifecycle / `nomadMoveDirector` GSAP /
`ConsoleNomadMoveLayer` fixed stage, `.con-nomadmove`, z 11650,
`con-flight-to-board`, registered in the leak detector's SERVING_SURFACES):

- **ARM** at the space submit; nothing visual before server proof.
- **DETECT** (`gameTransport`, after the tile-hero gate): `verifyNomadMove`
  demands the from→to diff onto the armed space; captures both hex rects +
  the destination's printed STOCK icon rects (`placementBonuses` — the tile
  hero's own extraction; DRAW_CARD is excluded, hazard destinations grant
  `[]`). A bare appearance (somebody armed a first placement here) refuses —
  Flow A can never leak into Flow B.
- **RUN** (commit held, `transportHolds.nomadMove`): lift-off (the module
  rises; the SOURCE contact shadow stays down and lets go) → the tall carried
  hop arc (lean into the travel direction; the DESTINATION shadow converges)
  → at 50% of the flight the DISPLACEMENT: the destination's printed icons
  rise off the surface (the shared `placeBonusProxies`/`playBonusPreLift`,
  refactored to take icon arrays), the real container blanks
  (`con-deal-hold`), and a DRAW_CARD cover arms `armBoardCardBonus` on the
  same beat → touchdown compression + settle → `adoptMarkerSilently` both
  cells + `applyNomadMovePreview` (the real token paints silently under the
  settled proxy) → proxy dissolves next frame.
- **SEED** (`seedNomadMoveRewardHold` in the transport's `seedRewardHolds`,
  same synchronous block as the commit — the phantom-chip rule).
- **END** (post-commit), in the order the story is told:
  1. **the CELL pays** — breath → `playBonusHandoff` (each hovering icon
     dissolves as its chip is born) → `runResourceTransfers` (per-icon hover
     origins; each touchdown releases its own panel hold → delta chip at
     contact);
  2. **the CELL recovers** — the RESTORE beat: un-blank + the one-shot
     `board-space-bonuses--nomad-restore` (scale-up materialization + one warm
     glint per icon, staggered; the class is stripped by a timer);
  3. **the WATER pays** — the SHARED ocean-adjacency beat (below).
  The card-bonus reveal is deferred (`rawDrawnRevealPending` reads
  `nomadMoveHolds`) until the camp has seated and the field restored.
- **ABORT** on refusal (`abortAllConsoleTransactions`), network failure, arm
  safety (12 s), scene safety, unmount — zero trace, gate always freed.

## If the rules fire it, the animation fires it — the OCEAN payout

`Game.grantPlacementBonuses` computes ocean adjacency for **every** placement
bonus it grants, tile or no tile: the card's own text is «collect the
placement bonus *as if placing a special tile there*», so a camp that hops
next to water is paid by that water exactly as a build is (`+2 M€` per
neighbouring ocean, `player.lastOceanBonus` published). The move scene showed
none of it — the money simply appeared. Fixed by making the beat SHARED
rather than by writing a second one:

`tilePlacement/oceanAdjacencyBeat.ts` now owns the whole payout (staging
state, `oceanBonusFor` manifest matching, `buildOceanCoins`,
`runOceanAdjacencyBeat`, `abortOceanBeat`) and BOTH callers use it — the tile
hero (`consoleTilePlacement.runOceanBonusBeat`) and the camp hop
(`consoleNomadMove.runOceanBonusBeat`). The DOM moved with it: the coins /
swells render at the ROOT of `ConsoleTilePlacementLayer` (outside the
tile-scene block — a hop has no tile proxy) and register through
`registerOceanBeatStage`; `TileStageEls` no longer carries ocean fields. The
transport passes `newView.lastOceanBonus` into `detectNomadMove`, the payout
joins the seeded hold as ONE aggregated M€ entry, and it is released once, at
the last coin's touchdown.

**What deliberately does NOT fire for a camp**: Ares adjacency, Turmoil
placement bonuses and the Arcadian M€ — the server gates all three on
`space.tile !== undefined`, so a move earns none of them (the card's published
ruling, pinned by `MarsNomads.spec.ts`). A scene that flew them would be lying
about money. `onTilePlaced` triggers (Geological Expedition's extra steel) DO
fire server-side and ride the ordinary commit's delta chips — exactly as they
do for a real tile placement, so the two placements stay in parity.

**Remote / undo** (post-commit reveal, the remote-tile design): staged in the
same synchronous block as the commit on BOTH poll (`App.update`) and submit
paths + the staged-bot closure. The source keeps a **ghost** token
(`nomadGhostAt`), the destination commits **hidden** (`nomadCellHidden`),
both flag flips are pre-adopted in the marker baseline, and the queued hop
waits for a watchable board (`boardCovered`, bounded 20 s) before flying.
No reward/restore beat for a foreign move — the viewer's counters never move.
An UNDO of a move diffs as the reverse pair and honestly walks the camp back.

## Holds and admission

`nomadMoveHolding` / `isRemoteNomadMoveActive` are animation-hold suppliers
(`'nomad-move'` / `'nomad-move-remote'`). The shell's reactive twin
`nomadMoveHolds` composes into: `rawAdmissionSignals.tileHero`,
`rawDrawnRevealPending`, both mandatory-announce gates,
`startExcursionQuietNow`, the pad-inert gate, `planetFocusTarget` (sustains
an engaged focus through the hop), and App's poll re-entrancy guard
(`isNomadMoveActive`). The deck-draw layer and the board-card-bonus
self-arm wait on `nomadMoveHolding()` like they do on the tile hero. The
board-card-bonus self-arm also picks its cover source by what stands on the
cell (`board-cell` for a tile-less nomad cell, `board-tile` otherwise).

## Reduced motion

Flow A: the token resolves in place (200 ms). Flow B: no proxies — the flags
flip with a short controlled beat, the commit's own delta chips announce the
bonus, the printed icons never blank. Remote: the plain commit (staging
returns after the baseline adoption).

## Guards

`tests/client/components/board/markerPlacementAnimation.spec.ts` (Flow A +
move exclusion + silent adoption), `tests/client/components/console/
nomadMoveModel.spec.ts` (diffs, rulings, geometry, the board.less anchor
contract), `tests/client/components/console/consoleNomadMove.spec.ts` (the
transaction: one-shot detect, Flow A refusal, held metrics, hazard, the ocean
payout + its stale-manifest refusal, abort, remote ghost/hold lifecycle),
`tests/client/components/console/oceanAdjacencyBeat.spec.ts` (the shared beat:
manifest matching + release-exactly-once on every degrade path), and the tile
hero's own ocean specs, which now exercise the same module.

Server rules are pinned by `tests/cards/promo/MarsNomads.spec.ts` — including
the two rows this iteration added: the move PUBLISHES `lastOceanBonus` naming
the destination and the paying water (the manifest the coin beat is staged
from), and a move with no water nearby publishes none. No server BEHAVIOUR
changed; the guards state what the client is entitled to rely on.

Manual/visual: `tests/e2e/zz-nomads-visual.spec.ts` — two probes, filmstrips
under `screenshots/zz-nomads-visual/`. (1) Flow A grants nothing and moves
nothing + Flow B hops, collects and restores; (2) the camp hops next to water
(the probe BUILDS the ocean with Flooding first, then derives a seat+shore
pair from the hexes' own on-screen centres) and the swell, the coin and the
chip are all observed, cross-checked against the server's own manifest.
