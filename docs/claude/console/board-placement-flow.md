# Board placement flow — the two-phase confirm + the placement reticle

*(2026-09-02, the premium board-experience iteration. Code:
`src/client/console/tilePlacement/placementFlow.ts`,
`src/client/components/console/ConsoleBoardCursor.vue`,
`ConsoleBoardSection.vue`, `ConsoleBoardInput.vue`, the shell's placement
branches; styles in `console.less` § placement reticle + `board.less`.)*

## Why

A tile placement is the one everyday action no undo can honestly unwind: the
submit records events, pays the cell's printed bonuses, may draw a card. The
historical protection was a centre-screen confirm dialog (covers the very
cell being confirmed; this fork shipped with it OFF by default), so on a pad
`A — РАЗМЕСТИТЬ ЗДЕСЬ` was a single, instantly-irreversible press — and
misaimed placements happened. The fix is a SECOND PHASE OF THE BOARD ITSELF,
never a modal.

## The state machine (`placementFlow.ts`)

`navigate → locked → committing`, one module-reactive singleton.

- **navigate** — the reticle travels the legal set. A on a legal cell (two-step
  mode) → `lockPlacementCell`: PURE presentation. Nothing is submitted, no
  event exists, no bonus moves, no card is drawn.
- **locked** — the projection settles into the hex, the other legal cells
  recede (`.con-board--locked`), the bar relabels
  (`A Подтвердить размещение` / `B Изменить клетку`), the dossier's cell bar
  turns amber «· Выбрано». B → back to navigate (zero consequence); a d-pad
  step UNLOCKS AND MOVES in the same press (no dead input); the whole-flow
  cancel is one more B away — the back hierarchy stays one level per press.
- **committing** — entered in `ConsoleBoardInput.confirmPlacement()`, the ONE
  commit funnel every source drives (pad A, mouse click, the legacy dialog).
  All board input is absorbed by phase; the transport's
  `isServerSideRequestInProgress` is the second, independent barrier. The
  reticle holds an amber breathing pose — that IS the pending feedback, no
  new surface.

### Input safety is structural

1. Press intents are edge-detected upstream — a held A never re-fires.
2. The commit requires the locking press to have been **released**
   (`armedRelease`, observed off the intent bus exactly like
   `consoleHoldConfirm` — observers are non-consuming and run before the
   routing handler, so the locking press is already reflected in
   `confirmDown` when the shell asks). A mouse lock (no button on the bus)
   arms immediately.
3. A **minimum lock dwell** (`LOCK_COMMIT_DWELL_MS` = 280 ms, deliberately
   NOT motion-scaled — same rule as `HOLD_CONFIRM_MS`) separates the two
   presses, so a double-tap or pad bounce cannot ride through before the
   locked pose has painted.
4. The **entry hold-gate**: if A is physically down when placement mode
   engages (the press that opened the mode), every board confirm is refused
   until one release — in BOTH modes.
5. `beginPlacementCommit` arms an 8 s safety: a commit whose request was
   dropped (raced another in-flight submit) falls back to `locked`.

### Refusal / world-moved

- A server refusal / network failure → `rollbackPlacementCommit()` from the
  transport's abort battery: back to `locked` with the cell intact
  (single-press mode: navigate), and the registered re-arm hook re-wires the
  board — **`confirmPlacement` nulls every per-cell onclick before posting,
  and before this hook a refusal left the whole board click-dead** (a real
  pre-existing bug).
- The shell watches `gameStateVersion(view)` (`placementWorldVersion`): a
  version move while `committing` = the commit succeeded straight into a
  CHAINED placement → reset to navigate; while `locked` = an off-turn update
  → the lock survives only if its cell is still `.board-space--available`.
  A refusal never moves the version, so rollback stays the abort battery's.

## The preference

`placementFlowState.twoStep` (localStorage `tm_place_confirm`, default ON) —
a `controls` row in `consoleSettingsModel` («Размещение тайла»: Два нажатия /
Одно нажатие). Single-press keeps the entry hold-gate and the committing
absorb. Turning two-step off mid-lock folds the lock. The MOUSE follows the
same setting: click = lock, click the locked cell again = confirm, click
another legal cell = move the lock (`onTileSelected`'s two-step branch — the
last gate re-checks `placementCommitReady()`, so no path can bypass it).

## The reticle (`ConsoleBoardCursor.vue`)

ONE persistent element teleported INSIDE `.board-cont` (resolved once at
mount — the board never remounts), positioned in intrinsic board px
(keep-px), so the planet's scale/pan transform carries it for free. Travel is
a retargetable 120 ms transform transition — a held direction (nav repeat
≈130 ms) always redirects the glide mid-flight; nothing queues. Coordinates
come from a module-level cache keyed `${boardName}|${spaceId}` (rect division
cancels the transform exactly, so a mid-tween measure is still correct; the
map key protects a rematch onto another board).

Poses: **legal** (mint ring + breathing ::after + the tile PROJECTION — the
real `board-space-tile--*` art at 0.5 opacity, slightly lifted, with the
owner cube at its true seat and a soft ground shadow) · **blocked** (muted
red ring, no projection) · **locked** (projection settles: opacity .88,
scale 1, shadow deepens; the amber lockring converges in one shot) ·
**committing** (lockring breathes quietly). The projection yields the cell to
the HERO SCENE the moment the transaction verifies (`tilePlacementState`
phase past `armed`) — the flying tile is the object from there, and the
commit's view-apply resets the flow, so proxy → real tile stays seamless.
**…except the PLACE, which stays** (the landing marker — § THE TILE LANGUAGE
below): an ordinary landing keeps the reticle on the cell as the tile's
reserved place until the contact.

Paint budget: transform/opacity/box-shadow only (the paint baseline strips
`filter`); both infinite loops are compositor-only and registered in the
fx-lite stop-list, the workspace pause-list and the reduced-motion media
block (the class-bridge sheet's «loops play once» covers the override path —
both loops are 0%/100%-symmetric).

**A placement ONTO an ocean (`'city-over-ocean'`, TR44 Aquatic Research Station).**
The legal cells are the plain ocean tops — anybody's — so the reticle stands over
a TILE for the whole aim: it projects the city IN THE LIFT (`afloat` →
`con-bcur--afloat`: aim −5.5 px / .82, travel −8 px / .78, locked −3.5 px / .86)
and never hides the water under a full projection; `armTilePlacement({overOcean})`
licenses the landing onto the pile's second rung with the full-hex splash. The
dossier's title is the TILE («Город»), the cover's bill reads one line each
(«Без бонуса размещения · Бонус клетки уже получил океан.», «Океан остаётся под
городом»), and a bare reserve's refusal names the kind («Размещается только на
существующем океане»). Contract: `docs/TURMOIL_REDUX_AQUATIC_RESEARCH_STATION.md`.

## THE TILE LANGUAGE (the owner's decisions of 2026-10-20 — W1 · W2/W3/W4 · W6 · W7)

Every tile that lands on Mars speaks ONE language, whoever placed it and whatever paid for it. Seven words:

1. **THE PLACE IS HELD (W1 — «полёт, но с маркером»).** Past the commit the tile still flies in from the table edge,
   but the cell the player locked does not let go: `ConsoleBoardSection.cursorMarker` keeps the reticle on it
   (`con-bcur--marker`: the amber lock contour steady, the projection a 0.2 trace, no cube, no shadow,
   `[data-landing-marker]`) for an ORDINARY landing (`paying` / `approaching`; never a move, a tier or a
   remove-and-replace — they keep their own scenes) and lets go IN THE FRAME OF CONTACT (`tilePlacementState.touched`,
   set by the flight's / the sprout's `onContact`), under the landed tile, by a 140 ms leave (`con-bcur-out`).
2. **THE CONTACT SPEAKS BY KIND (W7).** `tileContactKind(tileType)`: a city lands with the tier's dust
   (`playStackDust`), an ocean with the water's ring (`playCoverSplash` on the full hex), a greenery GROWS
   (`playTileSprout` — bought with plants, with M€ or given by a card: a greenery is planted, never fetched from the
   table), the rest touch. Fired on the timeline (`TileFlightOpts.onContact` / `TileSproutOpts.onContact`), never
   after the settle. Same on the remote stage (`remoteDust`, the remote splash).
3. **ANOTHER SEAT'S TILE IS BORN WHOLE UNDER ITS CHIP AND DIVES (W2, PL-769).** `remoteBirthPoint(chip, hexH,
   profile)` — the tile's top edge at the chip's centre, never cut by the strip; `tileDivePlan` — the path never
   climbs above its start (the lob's apex `min(from.y, to.y) − lift` put the first third of the bot's city behind
   the screen's top edge at 4K). The OWN tile keeps the lob from the table edge.
4. **WHO PLACED IS THE SERVER'S RECORD (W2/W3).** `GameModel.tilePlacements` (`TilePlacementRecordModel` — `seq`,
   `spaceId`, the placer's `color`, `tileType`, what the cell `paid`, `cards`; a presentation ring like
   `tileMoves`, NOT serialized, bounded 8) — published by `Game.addTile` from `grantPlacementBonuses`' own return
   (MarsBot: 1 M€ per covered icon, Automa rulebook p. 9). An ocean carries no owner on its tile, so its placer is
   known only here. The remote stage claims a record per event (`claimPlacementRecordOf`, consumed once by `seq`).
5. **A BEACON NAMES THE PLACER (W4).** `playLandingBeacon` — a ring in the placer's colour (`player_bg_color_*`,
   masked to a ring) gathers on the cell `REMOTE_BEACON_LEAD_MS` before the touchdown and lets go after it.
6. **THE CELL PAYS ITS PLACER IN SIGHT (W3).** After the touchdown one token per printed unit leaves the cell's own
   icon (`bonusIconCentres`, measured before the tile covers them) for the placer's chip (`runPlacerBonusBeat`);
   a rival's greenery bought with plants shows its «−8» leaving their chip into the cell first
   (`provenPlantPrice` — the two views prove it; else no token).
7. **WHAT A LANDING PAYS IS ONE WAVE, AND THE SCALES' STORY STARTS WITH THE PULLBACK (W6).** `endTilePlacement`
   launches the printed bonus, the ocean adjacency, the Ares adjacency and the tile's VP shares together,
   `REWARD_WAVE_STAGGER_MS` (80) apart (`runRewardWave`; the members' own breaths dropped); the law's wave and a
   move's rating stay second statements after it (and then the VP keeps its place last). The camera pulls back at
   the last touchdown, and the park's drain may tell the scales' story from `PLANET_STORY_READY_MS` (400) into the
   exit (`planetFocusStoryReady` — read ONLY by the shell's watchable probe and the drain's scene gate
   `scaleStorySceneSettling`; the drain's own settle is the camera's landing — `scheduleSettle` 0 while
   `storyReady`). Every other automatic transition keeps `planetFocusSettling` — the whole tail. Measured on the
   4K GPU stand (greenery beside two oceans, plants): commit → the last token 8.4 s → 5.3 s.
8. **THE CELL IS WHERE IT STANDS NOW — the own landing is measured in the board's present space** (2026-10-22, the
   final functional run). The hex is measured at the verify, and the board can still be moving then (the finale's
   Planet Focus, a refit after a surface left): the own landing waits for a calm board and measures AGAIN whenever
   the board's coordinate space has moved since (`settledHexRect` — `boardGeometryStable` + `boardSpaceEpoch`, the
   remote stage's own rule; bounded 1.2 s, an unmeasurable cell keeps the verify's rect), once before the beats and
   once more after a price beat; the price itself is aimed at the cell ELEMENT (`cellEndOf` → `source: {end}` — T06's
   live end, re-measured on the approach), never the point the press cached. Aimed at the stale rect, a finale's
   «−8» touched down in the NEIGHBOUR cell while the greenery grew in its own. Guard:
   `consoleTilePlacement.spec` § THE CELL AS IT STANDS NOW; e2e `console-final-greenery` ② (landed on `cell:<id>`).

Guards: `tilePlacementModel.spec` (the dive never above its start, the birth whole, the contact by kind, the
beacon / wave constants), `planetFocus.spec` (the story-ready moment inside the exit, dropped by a reversal),
`tests/models/TilePlacementRecord.spec.ts` (the ring: a city's steel, an ocean's placer, a draw counted as cards,
MarsBot's M€ per icon, bounded + seq), `Game.spec` (the ring is not serialized); e2e `console-tile-language.spec.ts`
(fhd + tv4k: A the marker holds until the contact + the dust · B the greenery born on its cell, ≥ 2 tokens in the
air together, the oxygen glide starting inside `pfocus-exit` · C red's city whole below its chip, never above the
screen's top, the red beacon before the touchdown, the bonus at red's chip · D the remote splash).

## Field grammar around it

- `.con-board--placing` / `.con-board--locked` on the board root (never
  `body.placement-pending` — that class lost its writer with PlayerHome and
  its rules were dead; they are deleted).
- Non-focused availables dim to .74 while placing, .34 past the lock.
- The **availability wave**: on placement open each legal contour blooms in
  on a radial stagger (`--con-wave-d` per cell, set by
  `ConsoleBoardInput.playAvailabilityWave`); the classes are STRIPPED after
  playing — the board is `v-show`n and a display flip replays any standing
  CSS animation (the known trap).
- **Relation marks** (`ConsoleBoardSection.applyRelationMarks` over the pure
  `placementRelations.ts`): every cell that PARTICIPATES in the focused
  placement lights — paying oceans, the greeneries a city will score / the
  cities an adjacent greenery feeds, taxing hazards, Ares reward tiles, the
  hazards a planetary event rewrites. **Driven by the same server preview the
  dossier renders**: the engine names the participating cells on each spatial
  fact (`BoardFact.spaces`, filled from the very rule call that computed the
  fact's numbers — `oceanAdjacencyBonus` returns them, the scoring/cost/Ares
  walks contribute theirs), so field and panel cannot diverge; there is no
  client-side re-derivation. Five tones, form + colour (never colour alone):
  `ocean` (cool contour+wash) · `score` (VP gold — was the plants' green until
  TR67) · `reward` (the gain mint — was a soft gold until TR67: ONE palette
  with the dossier's sections and the column's neighbour ring) ·
  `penalty` (dashed warm-red contour — wins every conflict; a cost may never
  be masked) · `event` (faint pale rim, the quietest voice). **One cell, one
  tone — precedence `penalty > ocean > reward > score > event`** (`TONE_RANK`):
  a cell that PAYS NOW outranks one that SCORES AT THE END. TR21 Arboretum is
  the case that fixed the order — one's own city beside the greenery both pays
  its data this turn (the card's cell-decided reward, `reward`) and scores the
  greenery at the game's end (`score`); the payment is the decision, the VP the
  footnote, so the city lights gold (2026-10-04; before it, `score` won). Each wash is
  BIASED toward the shared edge with the focused cell (`--rel-x/--rel-y` from
  the intrinsic position cache — no per-step layout reads); a far participant
  gets `con-rel--far` and stays quieter than any true neighbour. A d-pad step
  strips the previous cell's marks in the same press; the new cell's marks
  arrive WITH its preview (async, guarded by `preview.space`), so a fast run
  never trails highlights and intermediate cells never light at all — the
  compact form for free. Past the LOCK the marks turn STANDING (a quiet
  opacity step, no restart). Guards: `placementRelations.spec.ts` (tone
  precedence), `boardFactSpaces.spec.ts` (server: facts name their cells),
  e2e `console-placement-relations.spec.ts` (field count == dossier count,
  no stale marks, lock keeps them, cancel strips all).
  **The INSPECTION lights them too** (TR67 «КЛЕТКА — ОДНО ДОСЬЕ»): with no
  placement, `focusedRelations` reads the HOVER's own facts for the focused cell
  (`relationsFromInfo` — the paying oceans of an empty square, the greeneries a
  city scores, the cities a greenery feeds), re-applied on `boardInfoState.info`;
  `.con-board--inspecting` wears the same five marks with NO entry fade (the
  d-pad is pointing — the marks are data). The column's neighbour ring
  (`ConsoleCellPortrait`) lights exactly the same set (`cellDossier.cellRing`,
  same classifier) — e2e `console-cell-dossier.spec.ts` asserts ring ≡ field.
  The same watcher WARMS the six neighbours' hover answers
  (`prefetchBoardCells`) so the next step's dossier is a cache hit.
- **The ghost yields to the reward** — the visual-hierarchy contract inside
  one hex. While AIMING the projection is a quiet silhouette (opacity .34):
  the mint ring already owns «where», so the ghost only says «what», and a
  second full-strength metal frame inside the focus contour is exactly what
  the bonus icons kept losing to. The cell's measured bonus cluster
  (`updateBonusZone` — union of `.board-space-bonus` rects, cached per
  map|cell) becomes the ghost's QUIET-ZONE mask (`--bcur-mask-*` →
  `.con-bcur__ghost--masked`, static per cell, never animated), so no line of
  the projection crosses an icon; the ownership cube stays unmasked. The LOCK
  is what turns the ghost MATERIAL (opacity .88, scale 1, deeper shadow) —
  the icons stay above it via the mask + their own lift. TRAVEL is a pose:
  while the reticle glides the ghost lifts and lightens
  (`.con-bcur--travel`, a re-armed settle timer ≈ travel+45 ms, so a held
  d-pad keeps it airborne for the whole run and lands ONCE, on the final
  cell; reduced motion never enters the pose).
- The focused cell's printed bonus icons take a 2 px seat-lift (2.5 px past
  the lock) and their grounding discs deepen into a contact shadow.
- The baseline hex contour gained an ~8 % interior well (board.less) — cells
  read as surveyed basins, separating the field from the terrain.

## A MOVE — the source level, the pickup pose, the vector (TR14 Re-settlement)

A prompt carrying `tileMove` (`placementEffect: 'move'`) is ONE server question
read at TWO levels — which city leaves, where it lands — and the level is module
state, not a shell branch (`tilePlacement/placementMove.ts`):

| | city level (`placementMoveState.from === undefined`) | cell level (a city is lifted) |
| --- | --- | --- |
| legal cells | the cities that may move (`tileMove.sources`) | that city's `to`, in the server's order |
| refusals | a city that may not — its ONE reason (`disabledSources`); every other cell «not your city» | the prompt's own + `source.illegal` (a sibling city's cell) |
| reticle | **`--pickup`**: a ring around the REAL tile, no ghost (a tile over a tile would be a second object); the focused city lifts 2 px | the ordinary projection (the `arrives` tile + cube) |
| A | «Взять город» — ONE press in both confirm modes, pure presentation | lock → «Подтвердить переселение» (the two-phase machine, untouched) |
| B | cancel the whole flow (when cancellable) | «Другой город» — the city is put down |

`moveLevelPrompt(prompt, from, boardIds)` derives the level's prompt from the
marker alone — the client computes no adjacency and no «is it my city» — and
both readers (the binder's `topLevelSpaceInput`, the shell's
`placementSpaceModel`) take it from there. The machine in `placementFlow.ts`
(dwell, release gate) is unchanged: a lifted city is not a phase of it.

**The levels are named for what they ARE — `source` and `cell` — and the
WORDS belong to the FAMILY** (TR39 Canyon Carving, 2026-10-10: the same two
levels move an OCEAN). The family is the prompt's own `placementType`
(`placementMove.moveFamily`: `'ocean-move'` → the ocean's, every other move
prompt the city's — a server marker, never a title), and every surface speaks
it:

| | city (`'city-move'`, TR14) | ocean (`'ocean-move'`, TR39) |
| --- | --- | --- |
| source-level banner | «Выберите свой город» | «Выберите океан» |
| legal cells on the source level | the player's own cities that may move | EVERY plain ocean that may move — anybody's (an ocean is nobody's) |
| a cell that is no source | «Не ваш город на Марсе» (`not-your-city`) | «Не тайл океана» (`not-an-ocean-tile`) |
| a source that may not move | `no-space-to-move` · `city-stands-on-ocean` | `ocean-no-space-to-move` · `upgraded-ocean` |
| A on the source level | «Взять город» | «Взять океан» |
| the dossier's source section | «ЭТОТ ГОРОД» (+ «Сейчас приносит», the stack) | «ЭТОТ ОКЕАН» (+ the Capital beside it that loses, whoever owns it) |
| the reticle's default tile | a plain city | a plain ocean |
| the projection on the cell level | the `arrives` tile + the owner's cube | the ocean — no cube |
| what the MOVE itself pays, after the landing's own rewards | nothing (a city move pays no rating) | +1 TR as the landing's LAST beat — the token born at the landed ocean flies to the score cell, the table's answer (the Greens' M€) one tick-gap after its touchdown; the server's `lastTileMoveReward` says both (PL-133) |
| B on the cell level | «Другой город» | «Другой океан» |
| A in single-press mode | «Переселить сюда» | «Перенести сюда» |
| A on the locked cell | «Подтвердить переселение» | «Подтвердить перенос» |
| the commit's status | «Переселение…» | «Перенос…» |
| the «ДАЛЕЕ» row of the composer | «переселите свой город» | «перенесите тайл океана» |
| the dossier's destination | the city's VP as one vector, «ПРЕЖНЯЯ КЛЕТКА» | +1 TR for the move, the OTHER oceans' adjacency, the Capitals as one vector each, «ПРЕЖНЯЯ КЛЕТКА» — never the ocean counter's line |
| the sibling-cell reason | `not-adjacent-to-the-city` | `not-adjacent-to-the-ocean` |

The family defaults to the city's wherever a caller predates the ocean, so
TR14 reads byte for byte as before (`placementMove.spec.ts` pins both).

On the field, once a city is lifted (all board px-space, transform / opacity
only, none of it a loop):
- **the origin** — the real tile STAYS (nothing has happened yet) and turns
  quieter under a dashed contour (`.board-space--move-source`,
  `.con-bmove-origin`); it is never hidden before the confirm;
- **the vector** — one thin line with a chevron from the origin toward the
  focused legal cell, re-aimed by the reticle's own 120 ms glide (the running
  angle turns the short way); amber and heavier at the lock;
- **the relation layer** never marks the cell being left.

The cursor follows the level: lifted → the city's FIRST destination (a focus,
never a choice); put down → back on the city. The bar is the pure
`placementCommands({…, moveLevel})`; the dossier reads the SOURCE at the city
level («ЭТОТ ГОРОД») and the destination with «ПРЕЖНЯЯ КЛЕТКА» and the city's VP
as one vector at the cell level. The preview is asked with `from=` (and
`staged=1` for a staged play).

At the commit the hero takes over (`tile-replacement.md` § THE FOURTH case): the
pose lets go for the scene's whole length (`sceneOwnsMove`) and the vector is
eaten behind the travelling tile (`--eaten` — one class, CSS one-shots whose
delay / duration mirror `MOVE_LIFT_MS` / `MOVE_CARRY_MS`).

e2e: drive the city level with `walkToSpace` + ONE `Enter` (verified by the
board's own `con-board--move-pick` → `--move-lifted`), the cell with
`walkToSpace` + the two-press commit. `placeTile` is wrong here — its first
press would lift whatever city the cursor stands on.

## e2e driving (the drivers changed!)

`placeTile` in `consoleStart.ts` presses Enter TWICE per cell attempt (lock →
confirm) and works in both modes. A spec whose subject is a landing scene or
a timing measurement — `zz-nomads-visual`, `console-board-card-bonus-
concurrency`, `console-tile-replacement` (mouse click = commit) — calls
`forceSwiftPlacement(page)` BEFORE boot. The flow's own guards:
`tests/client/components/console/placementFlow.spec.ts` (state machine,
release gate, dwell, rollback) and `tests/e2e/console-placement-confirm.spec.ts`
(server-truth: navigation/lock/B touch nothing; the second press commits
exactly once).
