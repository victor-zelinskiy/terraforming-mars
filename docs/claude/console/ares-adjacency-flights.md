# Ares adjacency flights + ocean covers (console placement scenes)

Premium answers to the two Ares-specific placement moments (2026-08-24):
the neighbourhood PAYS the new tile (adjacency bonuses fly off the paying
tiles), and a tile LANDS ON an ocean (Ocean City family — previously a
silent sprite swap).

## The manifest (the `lastOceanBonus` pattern, generalized)

The rule is server-authoritative and already applied; the client may not
re-derive it (Marketing Experts ×2, the single-target card rule, the
MarsBot conversion, Crashlanding's callback all live server-side). So the
grant path publishes WHAT it did:

- **`AresAdjacencyGrantModel`** (`src/common/models/`): per placement —
  `spaceId`, `placerColor`, `grants[]` (one entry per adjacency icon:
  `sourceSpaceId` + `bonus` + **`delivery`** `stock | card-resource | draw |
  prompt | none` + the stock resource / the single target card), and
  `ownerPayouts[]` (`sourceSpaceId`, `ownerColor`, `megacredits` — 1, or 2
  with Marketing Experts).
- Recorded in `AresHandler.earnAdjacencyBonuses` beside the grants
  themselves; the delivery channel is REPORTED by the code that granted
  (`grantSpaceBonus` returns `SpaceBonusGrant`; the card-resource closure
  returns its target) — never a second rule.
- Lives on `game.aresAdjacencyGrants` — a bounded ring (8), **never
  serialized** (a restart loses only the animation). `seq` derives from the
  serialized `gameAge`, so it stays monotonic across restarts. Rides
  `GameModel` for every viewer (public facts — the log already names every
  payout).
- **`CardDrawRevealSource {type:'tile'}` now carries `spaceId?`** — the
  PAYING cell: the placed cell for its own printed DRAW_CARD bonus
  (`grantSpaceBonuses` passes it), or the NEIGHBOURING tile for an
  adjacency draw (Restricted Area:ares).
- Server honesty fixes riding along: the adjacency logs use a typed
  `.tileType()` token (journal chip), and a card-resource bonus with NO
  eligible card now logs `'${0} loses the ${1} adjacency bonus (no card can
  hold it)'` instead of a silent skip.

## The client half (`aresAdjacencyFlights.ts`)

`viewerAresAdjacencyFlights(grant, viewerColor)` → everything THIS viewer
physically receives, one chip per unit, each with its `sourceSpaceId`:
placer stock + single-target card resources (when the viewer placed) plus
the owner income of every paying tile the viewer owns. `draw` rides the
cover-lift cinematic, `prompt`/`none` fly nothing (their own surfaces).
**`claimAresGrant(seq)` is the shared once-only ledger** — the own hero's
detect and the remote staging both consume through it, so a grant that
rides every later response can never re-fly.

## The three presentation sites

1. **Own hero** (`consoleTilePlacement`): detect matches the newest grant
   for the armed space + claims it; `seedTilePlacementRewardHold` includes
   the flights (same synchronous block as the commit — the phantom-chip
   contract); `endTilePlacement` runs the beat printed → ocean → **ares**:
   each paying tile WAKES at the shared edge (`playAresSourcePulses` — the
   ocean swell's exact choreography in a warm amber register,
   `.con-tileplace__oceanpulse--ares`) and its chip is born just inside the
   tile (`oceanEdgePoint`), riding the shared framework; each touchdown
   releases its own metric.
2. **Remote landing** (`consoleRemotePlacement`): staging computes the
   viewer's `income` (usually THEIR OWN tiles' owner M€ from a foreign
   build) + seeds the hold in the staging block; after the foreign tile's
   touchdown + cube, `runRemoteAresIncomeBeat` wakes the viewer's tiles and
   flies the M€ home. Every degrade/abort path releases the held specs.
3. **Card draw** (`ConsoleBoardCardBonusLayer`): a tile reveal WITH
   `spaceId` and no armed scene **self-arms** `{kind:'board-tile', spaceId}`
   (the venus pattern: arm + stage atomically, `stagedEventId` guards the
   re-arm loop) — gated on `!tilePlacementHolding()` so the cause lands
   first. The cover rises out of the paying tile itself (`tileCoverRect` —
   a card-proportioned patch at the hex centre; a `board-tile` cell has no
   printed icon, so `resolveSourceIcons` legitimately resolves empty).
   `revealMatchesSource` is spaceId-tightened: an armed cell claims only
   its OWN draw, so a cell draw + an adjacency draw in one response play in
   sequence. The deck-draw scene never races this — `isDeckDrawSource`
   already excludes `tile` sources.

## Ocean covers (Ocean City / Farm / Sanctuary / New Holland)

All four placement detectors used to demand `prev === undefined`, so a
cover was invisible to every scene (a silent sprite swap). Now:

- `verifyPlacement` / `detectFreshPlacements` accept the ONE legal
  non-hazard replacement (`prev === OCEAN && next !== OCEAN`, mirroring
  `MarsBoard.canCover`) and carry **`covers`**.
- A covered placement grants NO printed bonuses server-side
  (`coveringExistingTile`) — the hero flies none (a held plant would lie
  about money). Ocean-adjacency M€ and the Ares manifest still play.
- **Own hero:** the board keeps showing the water for free (the commit is
  held through the flight). **Remote:** `holdRemoteReveal(spaceId,
  prevTileType)` — a held cover cell keeps painting the WATER's own art
  (`BoardSpaceTile` renders `heldPrevTileOf` without the cleared blanking;
  printed bonuses stay hidden exactly as under the real ocean).
- Touchdown answers with the **cover splash** (`playCoverSplash`,
  `.con-tileplace__splash`): one thin ring + a soft wash from under the
  seated tile — an acknowledgement, calmer than the payment pulses.
- MarsBot staged turns stage covers too (`applyTurnVisual` passes the
  buffered LATEST view's manifest — the presented view predates the batch).

## Guards

`tests/ares/AresAdjacencyGrants.spec.ts` (manifest: channels, targets,
owner ×2, draw source spaceId, loss log, seq/ring),
`tests/deferredActions/DrawCardRevealSource.spec.ts`,
`aresAdjacencyFlights.spec.ts` (viewer filtering + ledger),
`tilePlacementModel.spec.ts` (cover acceptance),
`consoleTilePlacement.spec.ts` (seed/beat/once-only/cover),
`consoleBoardCardBonus.spec.ts` (spaceId matching),
`placementCleared.spec.ts` (held water rendering).
