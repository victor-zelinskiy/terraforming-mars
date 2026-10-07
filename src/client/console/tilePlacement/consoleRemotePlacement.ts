/*
 * CONSOLE REMOTE TILE PLACEMENT — the premium landing for tiles the VIEWER
 * did not place: another player's build or a MarsBot turn. The board never
 * pops a foreign tile in (the old generic impact ring) — every placement
 * lands with the SAME physical language as the viewer's own hero scene,
 * differing only in PROVENANCE:
 *
 *   - the flight departs from the ACTING player's chip in the top status
 *     strip (fallback: the neutral top table edge — the mirror of the
 *     viewer's bottom-centre supply), never from the player's hand zone;
 *   - the pose is REMOTE_FLIGHT_PROFILE — already near the board's scale
 *     (nobody picked it off the viewer's table) with the carried tilt
 *     mirrored; the arc / touchdown / thickness / shadow are identical;
 *   - the owner cube then drops with the shared premium `pc-place` beat.
 *
 * POST-COMMIT REVEAL (deliberately the opposite of the own hero's held
 * commit): remote placements arrive on paths where holding the commit is
 * fragile (the poll loop, the bot staging's synchronous per-turn visual
 * commits, the staged last-turn closure). So the caller COMMITS normally —
 * in the SAME synchronous block it first calls `stageRemotePlacements`,
 * which registers a REVEAL HOLD per fresh tile (remoteRevealHold → the
 * existing `placement-cleared` art suppression, so the cell keeps reading
 * as untouched, printed bonuses included) plus a cube hold, and queues the
 * flights. The queue then drains sequentially: each proxy flies in, the
 * committed tile is revealed frame-perfect at its touchdown, the cube
 * drops. No game state is ever mutated here and no commit is ever delayed
 * — a stalled flight degrades to an instant reveal, never a hidden tile.
 *
 * While flights are pending the scene registers an ANIMATION HOLD
 * ('tile-placement-remote', blocking) so notifications queue and mandatory
 * surfaces wait for the landing; the stage root `.con-tileplace` is already
 * a leak-detector serving surface, covering the held window.
 *
 * NO printed-bonus reward beat here: the cell's bonuses pay the ACTING
 * player, not the viewer — their impact rides the bot-turn / hostile
 * notification pipeline. The bonuses simply stay visible until touchdown
 * and are covered by the landed tile, like any pre-existing tile.
 *
 * A MOVE (Turmoil Redux — TR14 Re-settlement) is ONE event of this queue,
 * never «a removal here + a landing there»: the SERVER names the pair
 * (`game.tileMoves` — `tileMoveRecords.pairTileMoves`, a record honoured only
 * when this very diff shows the declared pair, consumed once by `seq`), and
 * `moveRemote` plays it with the hero's own director — one proxy born over
 * the city on A, lifted, carried across the shared edge, lowered onto B. A
 * keeps painting the city that left (tile, cube, a stack's full height) until
 * the proxy takes it over; B stays hidden until the touchdown. The viewer's
 * own PARKED pin lands this way too. No record (an old save, a restart) → the
 * two changes keep their separate beats — the pair is never guessed.
 *
 * DESKTOP SAFETY: every staging entry point gates on
 * `consoleModeState.enabled`, so on desktop the queue never fills and the
 * generic placement animation keeps its exact behaviour.
 */

import {reactive, nextTick} from 'vue';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {TileType} from '@/common/TileType';
import {SpaceModel} from '@/common/models/SpaceModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleModeState} from '@/client/console/consoleModeState';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {
  FreshPlacement, detectFreshPlacements, detectFreshRemovals, OWN_FLIGHT_PROFILE, REMOTE_FLIGHT_PROFILE,
  TILE_FLIGHT_MS, TILE_SETTLE_MS, TileRect,
  TILE_DEPART_MS, TILE_DEPART_SCALE, TILE_DEPART_TILT_DEG, TILE_DEPART_FADE_T, TILE_DEPART_BREATH_MS, departureLiftPx,
  OCEAN_PULSE_MS, OCEAN_BEAT_BREATH_MS, OCEAN_COIN_LIFT_PX, OCEAN_COIN_T, OCEAN_PULSE_T, OCEAN_PULSE_DRIFT,
  OCEAN_SPLASH_MS, oceanEdgePoint, oceanShoreDirection,
  MOVE_LIFT_MS, MOVE_CARRY_MS, MOVE_LAND_MS, moveSourceRect, departingCubePose, DepartingCubePose, VerifiedMove,
} from '@/client/console/tilePlacement/tilePlacementModel';
import {claimTileMove, pairTileMoves} from '@/client/console/tilePlacement/tileMoveRecords';
import {stackRelease, clearStackRelease} from '@/client/console/tilePlacement/cityStackScene';
import {TileMoveRecordModel} from '@/common/boards/TileMove';
import {SpaceId} from '@/common/Types';
import {probeTick} from '@/client/console/probeTick';
import {
  AresAdjacencyFlight, ARES_WAVE_LEAD_MS,
  claimAresGrant, latestAresGrantFor, viewerAresAdjacencyFlights,
} from '@/client/console/tilePlacement/aresAdjacencyFlights';
import {AresAdjacencyGrantModel} from '@/common/models/AresAdjacencyGrantModel';
import {CardAdjacencyPayoutModel} from '@/common/models/CardAdjacencyPayoutModel';
import {claimCityPayout, cityPayoutVpSteps, cityPayoutsFor} from '@/client/console/tilePlacement/cityDataPayoutModel';
import {accumulatedVp} from '@/client/components/additionalResources/additionalResources';
import {cityPayoutReactionSpecs, runCityPayoutSequence, runRemoteCityPayoutBeat, seatChipPoint} from '@/client/console/tilePlacement/cityDataPayoutBeat';
import {ResourceTransferSpec, cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  placeTileProxy, playTileFlight, disposeTileProxy, killTileTweens,
  playAresSourcePulses, playCoverSplash, seatTileProxy,
  placeDepartProxy, playTileDeparture,
  placeMoveProxy, playTileMove, removeMoveProxy,
} from '@/client/console/tilePlacement/tilePlacementDirector';
import {boardSpaceEpoch, waitBoardGeometryStable} from '@/client/console/boardSpaceGeometry';
import {
  tilePlacementState, tileStageRemoteEls, measureBoardHexRect, tableSupplyPoint, AresSourceWake,
} from '@/client/console/tilePlacement/consoleTilePlacement';
import {
  holdRemoteReveal, releaseRemoteReveal, isRemoteRevealHeld, clearRemoteRevealHolds, markCellVacated,
  holdStackHeight, releaseStackHeight,
} from '@/client/console/tilePlacement/remoteRevealHold';
import {
  holdCubeForHeroPlacement, dropCubeForHeroPlacement, restCubeForHeroPlacement,
} from '@/client/components/board/cubeDropState';
import {
  runResourceTransfers, beginPanelRewardHold, releasePanelRewardHold, beginPanelVpHold, releasePanelVpHold,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {TransferPoint, transferWaveDelayMs} from '@/client/console/resourceTransfer/resourceTransferModel';
import {workspaceStackActive} from '@/client/console/consoleWorkspaceStack';
import {playedHeroHolding} from '@/client/console/played/consolePlayedHero';
import {isDeckDrawActive} from '@/client/console/deckDraw/consoleDeckDraw';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';

/** A whole queue can legitimately take several seconds (N sequential
 *  flights) — far past that, something stalled and every held tile must
 *  become visible. Deliberately under the animation-hold 35 s ceiling. */
const REMOTE_STAGE_SAFETY_MS = 15000;

/**
 * HOW LONG A LANDING WILL WAIT FOR A BOARD THE PLAYER CAN SEE.
 *
 * A tile that places itself (a card's own reserved slot — Stratopolis,
 * Ganymede, Phobos) arrives while the player is still INSIDE the workspace
 * they played it from, and the board section is `display: none` behind it. Two
 * things followed, and they are the same bug: `measureBoardHexRect` reads a
 * zero rect and the flight degrades to an instant reveal, so by the time the
 * workspace folds the tile is simply THERE — the placement never happened as
 * far as the player is concerned.
 *
 * So the landing waits for the board instead. Bounded, because a hidden tile
 * is a worse lie than a missed animation: a player who parks a workspace and
 * walks away must still find their city on the map.
 */
const BOARD_WAIT_MAX_MS = 20000;

/** …and once it IS back, the flight lets the screen settle first: the
 *  workspace's own leave is still dissolving over the board it just vacated,
 *  and a tile landing under it is the same invisible flight one beat later. */
const BOARD_SETTLE_MS = 320;

export const remotePlacementState = reactive({
  /** TRUE while a remote proxy is on stage (drives the layer's remote block). */
  active: false,
  /**
   * TRUE while the queue is merely PARKED waiting for a watchable board.
   *
   * ⚠️ THE HOLD IS FOR THE FLIGHT, NEVER FOR THE WAIT. `isRemotePlacementActive`
   * counted a queued landing as a live animation, so a bot turn that placed a
   * tile while the player stood inside a WORKSPACE took a BLOCKING hold for the
   * whole of `awaitWatchableBoard` — up to {@link BOARD_WAIT_MAX_MS} = 20 s. In
   * that window every prompt surface is refused (`anyAnimation` /
   * `presentation`), the notification feed is silenced, and
   * `notificationsSettled()` never turns true, so the player's own next
   * decision is not even ANNOUNCED. That is «бот лагает 5–10 секунд, особенно
   * когда я в workspace во время его хода»: nothing was on screen and nothing
   * was moving — the scene was politely waiting for a board the player had
   * covered, and holding the game while it waited.
   */
  waitingForBoard: false,
  /** The CURRENT flight's tile art (one remote flight at a time — the
   *  queue is sequential, so one proxy set suffices). */
  tileType: undefined as TileType | undefined,
  /** The tile a REMOVAL takes OFF the cell (Water Export's ocean): the
   *  departure proxy's art — set for the lift, cleared once it is gone. */
  departingTile: undefined as TileType | undefined,
  /** A MOVE is on stage: the departing proxy is the ONE object that travels
   *  (it carries the owner cube and lands — so it wears a touch overlay). */
  move: false,
  /** The owner marker riding a MOVE's proxy (the twin's socket for the live hex). */
  departingCube: undefined as DepartingCubePose | undefined,
  /** A move could not be played as one carried object (no measurable hex, no
   *  stage) — both cells went straight to their final poses. A probe's witness. */
  moveDegraded: false,
  aresExtension: false,
  /** The VIEWER's own tiles answering the current remote placement (the
   *  Ares owner-income beat) — staged wakes, empty otherwise. */
  aresSources: [] as Array<AresSourceWake>,
  nonce: 0,
});

/** A MOVE's other half, as the server's record + this diff proved it: the cell the city left. */
type RemoteMove = VerifiedMove & {
  /** The record's consumption key — claimed when the event is queued. */
  seq: number,
};

type RemoteEvent = FreshPlacement & {
  /**
   * Every CARD this placement paid («ТАЙЛ ПЛАТИТ КАРТЕ», `cards/tilePayout.ts` —
   * TR21 Arboretum's cities, TR30 Red Museum / Pets / Martian Census answering
   * the tile itself), claimed at staging, in the engine's order: the senders
   * answer after the landing, their tokens flying to the paid seat's chip — or,
   * when the seat is the viewer's own (their Pets answering this foreign city,
   * a parked pin landing here), into their satellite cell, the holds seeded at
   * staging.
   */
  cityPayouts?: Array<{payout: CardAdjacencyPayoutModel, own: boolean}>,
  /**
   * The tile on `spaceId` did not come from the supply: it TRAVELLED from
   * `move.from` (TR14 Re-settlement). ONE event, ONE proxy — `moveRemote`.
   */
  move?: RemoteMove,
  /**
   * The tile LEAVES the cell instead of landing on it (a REMOVAL — Water
   * Export's ocean, the Reds' action): `tileType` is then the departing
   * tile's art, the held cell keeps painting it until the proxy takes it
   * over, and the drain LIFTS instead of flying. No income, no cube drop.
   */
  removal?: boolean,
  aresExtension: boolean,
  /** TRUE = the VIEWER's own tile that never went through a SelectSpace
   *  (an auto-placed reserved-slot city) — it departs from the viewer's
   *  own bottom supply with the OWN pose; provenance stays honest. */
  own: boolean,
  /**
   * Everything THIS VIEWER physically receives from the placement's Ares
   * adjacency manifest — usually the OWNER INCOME of their own neighbouring
   * tiles (an opponent built next to them), and for an auto-placed own tile
   * also the placer's own gains. The panel hold for these is seeded at
   * STAGING (the same synchronous block as the commit — the framework's
   * phantom-chip contract) and released chip by chip at the beat.
   */
  income: ReadonlyArray<AresAdjacencyFlight>,
};

const queue: Array<RemoteEvent> = [];
let draining = false;
/** Bumped by abort — a drain loop mid-await sees the change and exits
 *  without touching the (already cleaned) state. */
let epoch = 0;
let stageSafety: number | undefined;

export function isRemotePlacementActive(): boolean {
  // ⚠ ORDER IS LOAD-BEARING: the REACTIVE term (`active`) MUST come first. This
  // is an animation-hold supplier predicate, polled through a Vue `watch` that
  // short-circuits `a || b`. `queue` is a plain (non-reactive) array, so if it
  // were read first the watcher could drop its only reactive dependency and
  // orphan the 35 s safety ceiling (the bug that hit `isResourceTransferActive`
  // when its first term was a non-reactive `let`). Reading `active` first keeps
  // it tracked; `active` only goes false once `queue` is already empty
  // (drain-end / abort), so the false transition is always observed.
  // A PARKED queue is not an animation: nothing is on stage and nothing moves
  // until the board comes back (see `waitingForBoard`). Both terms read before
  // `queue` are reactive, so the watcher keeps its dependency either way.
  return remotePlacementState.active ||
    (!remotePlacementState.waitingForBoard && queue.length > 0);
}

// Queued/flying remote landings hold the presentation exactly like the own
// hero: notifications queue, mandatory surfaces wait for the touchdown.
// The ceiling's owner recovery is this scene's own abort — every held tile
// becomes visible at once and the queue drops; masking the hold alone left
// the queue/flight state wedged behind a "released" hold (field log
// 2026-09-10: 35 s, with the underlying stall intact).
registerAnimationHoldSupplier('tile-placement-remote', isRemotePlacementActive, {
  diagnose: () => ({
    active: remotePlacementState.active,
    waitingForBoard: remotePlacementState.waitingForBoard,
    queued: queue.length,
    draining,
  }),
  expire: () => abortRemotePlacements(),
});

/**
 * STAGE (the diff form) — call in the SAME synchronous block as the commit,
 * BEFORE the displayed spaces change: diffs the fresh EMPTY → TILED cells
 * (hazards excluded — their ominous materialization is its own language)
 * and holds each behind its flight. The caller then commits normally.
 */
export type RemoteStageOpts = {
  aresExtension?: boolean,
  gamePhase?: string,
  /** The viewer's own colour: their own tile arriving WITHOUT a SelectSpace
   *  (an auto-placed reserved-slot city) keeps the OWN departure pose — and
   *  it is who the Ares adjacency manifest's payouts are filtered for. */
  viewerColor?: Color,
  /** The SERVER's Ares adjacency manifest ring (`game.aresAdjacencyGrants`)
   *  — the owner-income beat's authority, consumed once per grant. */
  aresGrants?: ReadonlyArray<AresAdjacencyGrantModel>,
  /** The SERVER's move ring (`game.tileMoves`) — the only authority that a
   *  removal and a landing in one diff are ONE relocation. */
  tileMoves?: ReadonlyArray<TileMoveRecordModel>,
  /** The SERVER's per-neighbour card payout ring (`game.cardAdjacencyPayouts`, TR21) — consumed once per record. */
  cardPayouts?: ReadonlyArray<CardAdjacencyPayoutModel>,
};

export function stageRemotePlacements(
  prevSpaces: ReadonlyArray<SpaceModel> | undefined,
  newSpaces: ReadonlyArray<SpaceModel> | undefined,
  opts?: RemoteStageOpts,
): void {
  if (prevSpaces === undefined || newSpaces === undefined) {
    return;
  }
  // …and every tile the response TOOK OFF a cell (Water Export's ocean, the
  // Reds' action): the same queue, the same watchable-board wait, the same
  // stage — a LIFT instead of a flight. A removal is a board event: the
  // chooser's own answer and an observer's poll stage it through this one
  // path, so nobody sees a silent pop-out.
  // …and a MOVE the server declared and this diff bears out: its two cells
  // leave the ordinary lists and ride ONE event. (A record the diff does not
  // show is not this response's move — nothing is paired by geometry.)
  const moves = pairTileMoves(prevSpaces, newSpaces, opts?.tileMoves);
  const moved = new Set<string>();
  for (const m of moves) {
    moved.add(m.record.from);
    moved.add(m.record.to);
  }
  stageRemoteTileEvents([
    ...moves.map((m) => ({
      spaceId: m.record.to,
      tileType: m.landed.tileType,
      color: m.landed.color,
      move: {...m.landed.moves, seq: m.record.seq},
    })),
    ...detectFreshPlacements(prevSpaces, newSpaces).filter((p) => !moved.has(p.spaceId)),
    ...detectFreshRemovals(prevSpaces, newSpaces).filter((r) => !moved.has(r.spaceId)).map((r) => ({...r, removal: true})),
  ], opts);
}

/**
 * STAGE (the explicit-events form) — for callers that carry the tile list
 * themselves (the bot staging's per-turn visual footprint). Same contract:
 * same synchronous block as the mutation that commits the tiles.
 */
export function stageRemoteTileEvents(
  events: ReadonlyArray<FreshPlacement & {removal?: boolean, move?: RemoteMove}>,
  opts?: RemoteStageOpts,
): void {
  if (events.length === 0 || typeof window === 'undefined' || !consoleModeState.enabled) {
    return;
  }
  if (consoleReducedMotionActive()) {
    return; // the honest reduced path: tiles ride the generic short fade
  }
  if (opts?.gamePhase === Phase.END) {
    return; // the endgame experience owns the screen — no flights under it
  }
  let queued = false;
  for (const e of events) {
    // The viewer's OWN armed hero owns its space — and, for a MOVE, BOTH of
    // them: the cell the city left is the hero's too (else the scene would be
    // followed by a second, foreign lift on a cell it has already vacated).
    if (ownHeroOwns(e.spaceId) || (e.move !== undefined && ownHeroOwns(e.move.from))) {
      continue;
    }
    if (isRemoteRevealHeld(e.spaceId) || queue.some((q) => q.spaceId === e.spaceId || q.move?.from === e.spaceId)) {
      continue; // already staged (a poll/submit double-report of one tile)
    }
    if (e.move !== undefined) {
      const move = e.move;
      if (!claimTileMove(move.seq)) {
        continue; // this client has played (or is playing) that record
      }
      // A — the committed cell is what the city LEFT (a bare hex, or the stack
      // one tier lower), so it keeps painting what stood there — tile, owner
      // cube, every tier — until the proxy takes it over 1:1.
      if (move.stack === undefined) {
        holdRemoteReveal(move.from, move.tileType, move.color);
      } else {
        holdStackHeight(move.from, move.stack.from);
      }
      // B — hidden until the touchdown; its cube is the one riding the proxy.
      holdRemoteReveal(e.spaceId);
      if (e.color !== undefined) {
        holdCubeForHeroPlacement(e.spaceId);
      }
      queue.push({
        ...e,
        aresExtension: opts?.aresExtension === true,
        own: e.color !== undefined && e.color === opts?.viewerColor,
        income: claimIncome(e.spaceId, opts),
        // A move IS a placement on its new cell (the engine fans it out so): the cards that answer it pay there.
        cityPayouts: claimCityPayoutsOf(e.spaceId, opts),
      });
      queued = true;
      continue;
    }
    if (e.removal === true) {
      // A REMOVAL: the committed cell is EMPTY, so the hold keeps painting the
      // tile that LEFT until the departure proxy takes it over 1:1 — the
      // player must never see the tile vanish before it lifts. Nothing is
      // paid to anybody (no income hold), and the cube — if the tile had one —
      // leaves on the proxy.
      holdRemoteReveal(e.spaceId, e.tileType);
      if (e.color !== undefined) {
        holdCubeForHeroPlacement(e.spaceId);
      }
      queue.push({...e, aresExtension: opts?.aresExtension === true, own: false, income: []});
      queued = true;
      continue;
    }
    // A cover placement keeps painting the PREVIOUS tile (the ocean) while
    // held — a blank cell under an arriving Ocean City would erase water
    // that is still there.
    holdRemoteReveal(e.spaceId, e.covers);
    if (e.color !== undefined) {
      // Same synchronous block as the colour commit — observeCube keeps a
      // phase already in flight, so the cube waits for its explicit drop.
      holdCubeForHeroPlacement(e.spaceId);
    }
    queue.push({
      ...e,
      aresExtension: opts?.aresExtension === true,
      own: e.color !== undefined && e.color === opts?.viewerColor,
      income: claimIncome(e.spaceId, opts),
      cityPayouts: claimCityPayoutsOf(e.spaceId, opts),
    });
    queued = true;
  }
  if (queued) {
    armStageSafety();
    void drainQueue();
  }
}

/** A cell of the viewer's OWN live hero: the armed one — and, for a move, the one its city left. */
function ownHeroOwns(spaceId: string): boolean {
  return tilePlacementState.active &&
    (tilePlacementState.spaceId === spaceId || tilePlacementState.move?.from === spaceId);
}

/**
 * The viewer's own share of a placement's Ares adjacency payouts (usually:
 * THEIR tile earned owner income from a foreign build). The panel hold MUST be
 * seeded here — the same synchronous block as the commit — or Vue flushes a
 * frame with a phantom −N chip.
 */
function claimIncome(spaceId: string, opts: RemoteStageOpts | undefined): ReadonlyArray<AresAdjacencyFlight> {
  const grant = latestAresGrantFor(opts?.aresGrants, spaceId);
  if (grant === undefined || opts?.viewerColor === undefined || !claimAresGrant(grant.seq)) {
    return [];
  }
  const income = viewerAresAdjacencyFlights(grant, opts.viewerColor);
  if (income.length > 0) {
    beginPanelRewardHold(income.map((f) => f.spec));
  }
  return income;
}

/** The viewer's own holds of a card payout: the satellite's resource count and what the table answered. */
function cityPayoutHoldSpecs(payout: CardAdjacencyPayoutModel): Array<ResourceTransferSpec> {
  return [{channel: 'card-resource', resource: cardResourceKey(payout.resource), amount: payout.amount}, ...cityPayoutReactionSpecs(payout)];
}

/**
 * THIS placement's card payout records, each claimed once — the own hero
 * claims its placement's first, so a record reaching here belongs to somebody
 * else's placement: another seat's card, or the VIEWER's own answering it (their
 * Pets / Martian Census on a foreign city — PL-034: the count waits for the
 * token, never ahead of the landing) or landing on the remote stage (a parked
 * pin). The viewer's own holds are seeded here, in the commit's synchronous
 * block (the phantom-chip contract).
 */
function claimCityPayoutsOf(spaceId: string, opts: RemoteStageOpts | undefined): RemoteEvent['cityPayouts'] {
  const out = cityPayoutsFor(opts?.cardPayouts, spaceId, undefined)
    .filter((payout) => claimCityPayout(payout.seq))
    .map((payout) => ({payout, own: payout.color === opts?.viewerColor}));
  for (const item of out) {
    if (item.own) {
      beginPanelRewardHold(cityPayoutHoldSpecs(item.payout));
      beginPanelVpHold(cityPayoutVp(item.payout));
    }
  }
  return out.length > 0 ? out : undefined;
}

/** The points a payout brings its card (the rail's VP cell is derived — it keeps them back with the count). */
function cityPayoutVp(payout: CardAdjacencyPayoutModel): number {
  return cityPayoutVpSteps(payout.before, payout.amount, (count) => accumulatedVp(payout.target, count)).reduce((a, b) => a + b, 0);
}

/** Release the viewer's own holds of ONE card payout of the event, once (the hold map is additive). */
function releaseCityPayoutHold(item: {payout: CardAdjacencyPayoutModel, own: boolean}): void {
  if (item.own) {
    cityPayoutHoldSpecs(item.payout).forEach((spec) => releasePanelRewardHold(spec));
    releasePanelVpHold(cityPayoutVp(item.payout));
    item.own = false;
  }
}

/** Release every own hold of the event's card payouts still owed (an abort, a degrade, a skipped scene). */
function releaseCityPayoutHolds(ev: RemoteEvent): void {
  ev.cityPayouts?.forEach(releaseCityPayoutHold);
}

/**
 * ABORT — stage unmount (shell teardown / game switch) or the safety
 * ceiling. Every held tile becomes visible at once, every held cube rests;
 * the queue drops. There is no game state to restore — this scene never
 * mutates any.
 */
export function abortRemotePlacements(): void {
  epoch++;
  const els = tileStageRemoteEls();
  if (els !== undefined) {
    killTileTweens(els);
  }
  for (const ev of queue) {
    releaseRemoteReveal(ev.spaceId);
    releaseMoveSource(ev);
    if (ev.color !== undefined) {
      restCubeForHeroPlacement(ev.spaceId);
    }
    releaseIncomeHolds(ev); // the committed money shows at once, never stuck
    releaseCityPayoutHolds(ev);
  }
  queue.length = 0;
  clearRemoteRevealHolds(); // belt-and-braces: nothing may stay hidden
  draining = false;
  remotePlacementState.active = false;
  remotePlacementState.waitingForBoard = false;
  remotePlacementState.tileType = undefined;
  remotePlacementState.departingTile = undefined;
  clearMoveStage();
  remotePlacementState.aresSources = [];
  clearStageSafety();
}

/** A move's SOURCE cell shows what was committed: the held city, its cube, its former height and the release answer all go. */
function releaseMoveSource(ev: RemoteEvent): void {
  if (ev.move === undefined) {
    return;
  }
  releaseRemoteReveal(ev.move.from);
  releaseStackHeight(ev.move.from);
  clearStackRelease(ev.move.from);
}

/** The stage's own move state (the proxy's cube, its «it lands» marker, the degrade witness). */
function clearMoveStage(): void {
  remotePlacementState.move = false;
  remotePlacementState.departingCube = undefined;
  remotePlacementState.moveDegraded = false;
}

// ── internals ───────────────────────────────────────────────────────────────

async function drainQueue(): Promise<void> {
  if (draining) {
    return;
  }
  draining = true;
  const myEpoch = epoch;
  try {
    while (queue.length > 0 && epoch === myEpoch) {
      const ev = queue[0];
      try {
        if (ev.move !== undefined) {
          await moveRemote(ev, ev.move, myEpoch);
        } else if (ev.removal === true) {
          await liftRemote(ev, myEpoch);
        } else {
          await flyRemote(ev, myEpoch);
        }
      } finally {
        if (epoch === myEpoch) {
          // Whatever happened, the COMMITTED cell must be visible (a tile, or the bare hex it became).
          releaseRemoteReveal(ev.spaceId);
          releaseMoveSource(ev);
          queue.shift();
        }
      }
    }
  } finally {
    if (epoch === myEpoch) {
      draining = false;
      remotePlacementState.active = false;
      remotePlacementState.tileType = undefined;
      remotePlacementState.departingTile = undefined;
      clearMoveStage();
      clearStageSafety();
    }
  }
}

/**
 * THE MOVE — one relocation on the shared remote stage (TR14 Re-settlement):
 * an opponent's city, or the viewer's own PARKED pin landing a response later.
 * The hero's own beats and the hero's own director (`playTileMove`), on a
 * board that is watchable and standing still:
 *   1. the proxy is posed 1:1 over the city A is still painting, and the holds
 *      on A are RELEASED in that same synchronous turn — the real cell becomes
 *      what was committed (a bare hex, or the stack one tier lower, its counter
 *      ticking down) under a proxy that looks exactly like what stood there;
 *   2. LIFT → CARRY → LANDING: level, material, the owner cube riding the
 *      tile; A settles once when the tile has cleared its contour;
 *   3. CONTACT: B's hold is released — the committed city paints under the
 *      settled proxy with its cube at rest — and the proxy goes the frame after.
 * Then the viewer's own tiles answer (Ares owner income), as for any landing.
 * Degrades to both cells at their committed poses wherever the stage cannot
 * stand — named (`moveDegraded`), never a hidden city.
 */
async function moveRemote(ev: RemoteEvent, move: RemoteMove, myEpoch: number): Promise<void> {
  remotePlacementState.waitingForBoard = boardCovered();
  try {
    await awaitWatchableBoard(myEpoch);
  } finally {
    remotePlacementState.waitingForBoard = false;
  }
  if (epoch !== myEpoch) {
    return;
  }
  await waitBoardGeometryStable({alive: () => epoch === myEpoch});
  if (epoch !== myEpoch) {
    return;
  }
  const dest = measureBoardHexRect(ev.spaceId);
  const sourceHex = measureBoardHexRect(move.from);
  if (dest === undefined || sourceHex === undefined) {
    await degradeMove(ev, myEpoch);
    return;
  }
  const ui = conUiScale();
  remotePlacementState.active = true;
  remotePlacementState.tileType = ev.tileType;
  remotePlacementState.departingTile = move.tileType;
  remotePlacementState.departingCube = departingCubePose(move.color, dest);
  remotePlacementState.move = true;
  remotePlacementState.aresExtension = ev.aresExtension;
  remotePlacementState.nonce++;
  await nextTick(); // the layer mounts the proxy
  if (epoch !== myEpoch) {
    return;
  }
  const els = tileStageRemoteEls();
  if (els === undefined || !placeMoveProxy(els, moveSourceRect(sourceHex, move.stack?.from ?? 1), dest)) {
    await degradeMove(ev, myEpoch);
    return;
  }
  // THE HANDOFF: the proxy stands 1:1 over the city, so the real source cell
  // may become what was committed NOW — nothing is seen to change.
  releaseRemoteReveal(move.from);
  releaseStackHeight(move.from);
  if (move.stack !== undefined) {
    stackRelease(move.from as SpaceId);
  }
  await playTileMove(els, {
    source: moveSourceRect(sourceHex, move.stack?.from ?? 1),
    dest,
    uiScale: ui,
    liftMs: motionMs(MOVE_LIFT_MS),
    carryMs: motionMs(MOVE_CARRY_MS),
    landMs: motionMs(MOVE_LAND_MS),
    onCleared: () => {
      if (epoch === myEpoch && move.stack === undefined) {
        markCellVacated(move.from);
      }
    },
  });
  if (epoch !== myEpoch) {
    return; // aborted mid-move — abort already revealed everything
  }
  // CONTACT: the committed city becomes visible under the settled proxy, its
  // cube at rest (it rode the tile — there is no drop), and the proxy goes on
  // the next painted frame. Show, then remove — never a fade.
  releaseRemoteReveal(ev.spaceId);
  if (ev.color !== undefined) {
    restCubeForHeroPlacement(ev.spaceId);
  }
  await nextTick();
  await new Promise<void>((resolve) => probeTick(() => resolve()));
  if (epoch !== myEpoch) {
    return;
  }
  removeMoveProxy(els);
  remotePlacementState.departingTile = undefined;
  remotePlacementState.departingCube = undefined;
  remotePlacementState.move = false;
  clearStackRelease(move.from as SpaceId);
  if (ev.income.length > 0) {
    await runRemoteAresIncomeBeat(ev, dest, ui, myEpoch);
  }
  playCityPayouts(ev, dest, ui, myEpoch);
}

/** A move with no stage to stand on: both cells show what was committed, and the degrade names itself for one beat. */
async function degradeMove(ev: RemoteEvent, myEpoch: number): Promise<void> {
  degradeReveal(ev);
  releaseMoveSource(ev);
  remotePlacementState.departingTile = undefined;
  remotePlacementState.departingCube = undefined;
  remotePlacementState.move = false;
  remotePlacementState.active = true; // the stage root mounts — the witness below is readable
  remotePlacementState.moveDegraded = true;
  await wait(60);
  if (epoch === myEpoch) {
    remotePlacementState.moveDegraded = false;
  }
}

/**
 * THE LIFT — a REMOVAL's scene (Water Export's ocean, the Reds' action): the
 * departure half of the remove-and-replace beat, on the shared remote stage,
 * for every viewer alike. Waits for a watchable board and stable geometry
 * exactly as a flight does, then:
 *   1. the departure proxy is posed 1:1 over the held cell and the hold is
 *      RELEASED in the same synchronous turn — the real cell paints the bare
 *      hex under a proxy that looks exactly like the tile that stood there
 *      (the `con-deal-hold` swap discipline: nothing is seen to change);
 *   2. the tile UNSEATS and rises away — thickness edge decompressing, a
 *      small tip, dissolving on the way out (`playTileDeparture`), its owner
 *      cube (if any) held on the cell until the tile is gone;
 *   3. the vacated cell SETTLES once (`markCellVacated` → the board's own
 *      one-shot class) — a loss, no celebration; only this cell reacts.
 * Degrades to an instant reveal wherever the stage cannot stand (no board,
 * no proxy): the cell is never left hidden.
 */
async function liftRemote(ev: RemoteEvent, myEpoch: number): Promise<void> {
  remotePlacementState.waitingForBoard = boardCovered();
  try {
    await awaitWatchableBoard(myEpoch);
  } finally {
    remotePlacementState.waitingForBoard = false;
  }
  if (epoch !== myEpoch) {
    return;
  }
  await waitBoardGeometryStable({alive: () => epoch === myEpoch});
  if (epoch !== myEpoch) {
    return;
  }
  const hex = measureBoardHexRect(ev.spaceId);
  if (hex === undefined) {
    degradeReveal(ev);
    return;
  }
  remotePlacementState.active = true;
  remotePlacementState.tileType = ev.tileType;
  remotePlacementState.departingTile = ev.tileType;
  remotePlacementState.aresExtension = ev.aresExtension;
  remotePlacementState.nonce++;
  await nextTick(); // the layer mounts the departure proxy
  if (epoch !== myEpoch) {
    return;
  }
  const els = tileStageRemoteEls();
  if (els === undefined || !placeDepartProxy(els, hex)) {
    remotePlacementState.departingTile = undefined;
    degradeReveal(ev);
    return;
  }
  // THE SWAP: the proxy stands 1:1 over the tile, so the real cell may blank
  // NOW — nothing is seen to change until the proxy starts to move.
  releaseRemoteReveal(ev.spaceId);
  await playTileDeparture(els, {
    hex,
    liftPx: departureLiftPx(hex),
    departMs: motionMs(TILE_DEPART_MS),
    fadeAt: TILE_DEPART_FADE_T,
    tiltDeg: TILE_DEPART_TILT_DEG,
    scale: TILE_DEPART_SCALE,
  });
  if (epoch !== myEpoch) {
    return;
  }
  // The vacated cell settles once; the cube (if the tile had one) is gone with the tile.
  markCellVacated(ev.spaceId);
  if (ev.color !== undefined) {
    restCubeForHeroPlacement(ev.spaceId);
  }
  remotePlacementState.departingTile = undefined;
  await wait(motionMs(TILE_DEPART_BREATH_MS));
}

async function flyRemote(ev: RemoteEvent, myEpoch: number): Promise<void> {
  // THE BOARD MUST BE WATCHABLE FIRST. A landing nobody can see is not a
  // landing — and it is worse than that here, because the board section is
  // `display: none` behind a workspace, so the flight would not even resolve
  // a rect: it would degrade to an instant reveal and the tile would simply
  // BE there when the workspace folds. This is the whole reason the tile
  // stays held: the wait costs nothing (the cell reads untouched) and buys
  // the player the one moment the placement actually happens.
  remotePlacementState.waitingForBoard = boardCovered();
  try {
    await awaitWatchableBoard(myEpoch);
  } finally {
    remotePlacementState.waitingForBoard = false;
  }
  if (epoch !== myEpoch) {
    return;
  }
  // …AND ON STABLE GEOMETRY (boardSpaceGeometry, mechanism D): a Planet
  // Focus enter/exit or a fit pass moves the whole coordinate space, so a
  // measure taken mid-transition aims the flight at a rect that will not
  // exist at touchdown. Bounded — past the cap the flight flies at the best
  // measure it can take and the retarget/verify below own the residue.
  await waitBoardGeometryStable({alive: () => epoch === myEpoch});
  if (epoch !== myEpoch) {
    return;
  }
  let hex = measureBoardHexRect(ev.spaceId);
  if (hex === undefined) {
    degradeReveal(ev); // still unmeasurable (a hidden section) — no flight
    return;
  }
  const aimEpoch = boardSpaceEpoch();
  const ui = conUiScale();
  remotePlacementState.active = true;
  remotePlacementState.tileType = ev.tileType;
  remotePlacementState.aresExtension = ev.aresExtension;
  remotePlacementState.nonce++;
  await nextTick(); // the layer mounts the remote proxy
  if (epoch !== myEpoch) {
    return;
  }
  const els = tileStageRemoteEls();
  const profile = ev.own ? OWN_FLIGHT_PROFILE : REMOTE_FLIGHT_PROFILE;
  const from = ev.own ? tableSupplyPoint(ui) : remoteOriginPoint(ev.color, ui);
  if (els === undefined || !placeTileProxy(els, {hex, from, profile})) {
    degradeReveal(ev);
    return;
  }
  await playTileFlight(els, {
    hex,
    from,
    uiScale: ui,
    flightMs: motionMs(TILE_FLIGHT_MS),
    settleMs: motionMs(TILE_SETTLE_MS),
    profile,
    // The live-anchor contract: the final approach re-reads the cell and
    // blends the remaining leg onto it — a focus exit that lands mid-flight
    // no longer parks the tile hundreds of px off its hex.
    liveHex: () => measureBoardHexRect(ev.spaceId),
  });
  if (epoch !== myEpoch) {
    return; // aborted mid-flight — abort already revealed everything
  }
  // POST-FLIGHT VERIFY: the space can move even after the retarget point (an
  // exit transition finishing in the last 300 ms). One re-measure at rest;
  // a moved cell re-seats the settled proxy before the reveal, so the
  // handoff stays frame-perfect and the splash/income beats aim true.
  if (boardSpaceEpoch() !== aimEpoch) {
    const live = measureBoardHexRect(ev.spaceId);
    if (live !== undefined &&
        (Math.abs(live.x - hex.x) > 1 || Math.abs(live.y - hex.y) > 1 ||
         Math.abs(live.w - hex.w) > 1 || Math.abs(live.h - hex.h) > 1)) {
      seatTileProxy(els, live);
      hex = live;
    }
  }
  // Frame-perfect handoff: the COMMITTED tile becomes visible under the
  // settled proxy (identical geometry), the proxy dissolves on it, and the
  // owner cube drops — tile first, then the cube lands on it.
  if (ev.covers !== undefined) {
    // The tile landed ON the water — the sea acknowledges the mass while
    // the proxy dissolves onto the committed cover tile.
    playCoverSplash(els, {hex, uiScale: ui, splashMs: motionMs(OCEAN_SPLASH_MS)});
  }
  releaseRemoteReveal(ev.spaceId);
  await nextTick();
  await disposeTileProxy(els, motionMs(110));
  if (epoch === myEpoch && ev.color !== undefined) {
    dropCubeForHeroPlacement(ev.spaceId);
  }
  // THE VIEWER'S OWN TILES ANSWER: the Ares owner-income beat — their tile
  // wakes at the edge it shares with the foreign build and sends the M€
  // home. Runs INSIDE the flight (the stage stays mounted), after the cube.
  if (epoch === myEpoch && ev.income.length > 0) {
    await runRemoteAresIncomeBeat(ev, hex, ui, myEpoch);
  }
  playCityPayouts(ev, hex, ui, myEpoch);
}

/**
 * …and THE TILE PAYS (TR21's cities, TR30 / Pets / Martian Census — the tile itself) once the tile has landed —
 * a flight's or a move's: each record in the engine's order, its tokens flying to the paid seat — their chip in
 * the status strip, or the viewer's own satellite cell when the payout is theirs. Handed over, never awaited: the
 * scene waits for the scales' story, which waits for THIS stage to be quiet.
 */
function playCityPayouts(ev: RemoteEvent, hex: TileRect, ui: number, myEpoch: number): void {
  if (epoch !== myEpoch || ev.cityPayouts === undefined) {
    releaseCityPayoutHolds(ev);
    return;
  }
  void runCityPayoutSequence(ev.cityPayouts.map((item) => ({
    play: () => runRemoteCityPayoutBeat({
      payout: item.payout,
      tileRect: hex,
      uiScale: ui,
      destination: item.own ? undefined : remoteOriginPoint(item.payout.color, ui),
      release: () => releaseCityPayoutHold(item),
    }),
    release: () => releaseCityPayoutHold(item),
  })));
}

/**
 * The REMOTE half of the Ares adjacency beat: everything the VIEWER receives
 * from a placement somebody else made — their own tiles' owner income (and,
 * for an auto-placed own tile, the placer gains). Same wake language and the
 * same shared framework as the own hero's beat; the hold seeded at staging
 * is released chip by chip, and every degrade path releases it whole.
 */
async function runRemoteAresIncomeBeat(ev: RemoteEvent, tileRect: TileRect, ui: number, myEpoch: number): Promise<void> {
  const releaseAll = () => releaseIncomeHolds(ev);
  if (typeof document === 'undefined') {
    releaseAll();
    return;
  }
  const delays = ev.income.map((_, i) => motionMs(transferWaveDelayMs(i, ev.income.length)));
  const lift = Math.round(OCEAN_COIN_LIFT_PX * ui);
  const wakes: Array<AresSourceWake> = [];
  const pulseDelays: Array<number> = [];
  const origins: Array<TransferPoint | undefined> = ev.income.map((f, i) => {
    const rect = measureBoardHexRect(f.sourceSpaceId);
    if (rect === undefined) {
      return undefined; // chip falls back to the landed tile — money never lost
    }
    wakes.push({
      id: i,
      at: oceanEdgePoint(rect, tileRect, OCEAN_COIN_T, lift),
      pulseAt: oceanEdgePoint(rect, tileRect, OCEAN_PULSE_T),
      pulseSize: Math.round(rect.w * 0.66),
      shore: oceanShoreDirection(rect, tileRect),
      drift: Math.round(rect.w * OCEAN_PULSE_DRIFT),
    });
    pulseDelays.push(delays[i]);
    return oceanEdgePoint(rect, tileRect, OCEAN_COIN_T, lift);
  });
  await wait(motionMs(OCEAN_BEAT_BREATH_MS));
  if (epoch !== myEpoch) {
    releaseAll();
    return;
  }
  remotePlacementState.aresSources = wakes;
  await nextTick(); // the layer mounts the wake pulses
  const els = tileStageRemoteEls();
  if (els !== undefined && els.aresPulses.length === wakes.length && wakes.length > 0) {
    playAresSourcePulses(els.aresPulses, {
      delays: pulseDelays,
      shores: wakes.map((w) => w.shore),
      drifts: wakes.map((w) => w.drift),
      pulseMs: motionMs(OCEAN_PULSE_MS),
    });
    await wait(motionMs(ARES_WAVE_LEAD_MS));
    if (epoch !== myEpoch) {
      remotePlacementState.aresSources = [];
      releaseAll();
      return;
    }
  }
  await runResourceTransfers({
    specs: ev.income.map((f) => f.spec),
    origins,
    source: {point: {x: tileRect.x + tileRect.w / 2, y: tileRect.y + tileRect.h / 2}},
    arrival: 'auto',
    fromBoard: true,
    onArrive: (spec) => releasePanelRewardHold(spec),
  });
  remotePlacementState.aresSources = [];
}

/** Release every panel hold this event seeded (idempotent per amount — the
 *  hold map is additive, so releasing what was seeded is always exact). */
function releaseIncomeHolds(ev: RemoteEvent): void {
  for (const f of ev.income) {
    releasePanelRewardHold(f.spec);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * IS SOMETHING STANDING OVER THE BOARD? Each term is a surface that owns the
 * screen while it is up, and behind every one of them the board is either
 * hidden outright (`v-show` on the section) or unwatchable:
 *  · a WORKSPACE screen — the hand, the action centre, the colonies, the
 *    deployment… all of them are frames in the one stack (a PARKED stack is
 *    deliberately not: parking is the player going to look at the board);
 *  · the played-card scene, which owns the foreground through its landing;
 *  · the deck dealing — cards are physically crossing the screen;
 *  · a drawn batch still on the table.
 */
export function boardCovered(): boolean {
  return workspaceStackActive() || playedHeroHolding() || isDeckDrawActive() ||
    currentRevealEvent() !== undefined;
}

/**
 * Wait for the board to come back, then let it settle. Bounded (see
 * `BOARD_WAIT_MAX_MS`) — past that the tile shows without its flight, the same
 * honest degradation as an unmeasurable board.
 *
 * The stage safety is re-armed while we wait ON PURPOSE: nothing is stalled
 * here, so its 15 s stall clock must not spend itself on a deliberate hold —
 * it starts counting when the flight can actually run.
 */
function awaitWatchableBoard(myEpoch: number): Promise<void> {
  if (!boardCovered()) {
    return Promise.resolve();
  }
  const deadline = Date.now() + BOARD_WAIT_MAX_MS;
  return new Promise<void>((done) => {
    const poll = () => {
      if (epoch !== myEpoch || !boardCovered() || Date.now() > deadline) {
        // The board is back (or we gave up): let the workspace's own leave
        // finish before the tile flies into the space it just vacated.
        // The SETTLE is the scene's own lead-in on a board the player can see,
        // not the wait for a covered one — so the hold stands from here: the
        // board-beat drain (the scales' story, the HUD's ocean count) waits
        // for the tile's landing / departure instead of ticking in the gap
        // before it (measured on Water Export's observer: 0/9 read a beat
        // before the ocean lifted).
        remotePlacementState.waitingForBoard = false;
        window.setTimeout(done, epoch === myEpoch ? motionMs(BOARD_SETTLE_MS) : 0);
        return;
      }
      armStageSafety();
      window.setTimeout(poll, 140);
    };
    poll();
  });
}

/** The degraded path (no stage / unmeasurable board): the committed tile
 *  and its cube simply show — never a hidden cell, never a stranded hold. */
function degradeReveal(ev: RemoteEvent): void {
  releaseRemoteReveal(ev.spaceId);
  if (ev.color !== undefined) {
    restCubeForHeroPlacement(ev.spaceId);
  }
  releaseIncomeHolds(ev); // the income announces via its delta chips alone
  releaseCityPayoutHolds(ev);
}

/**
 * Where a remote tile departs FROM — the acting player's chip in the top
 * status strip (the opponents literally live in the top HUD), so the
 * direction itself says WHO placed. An ownerless tile (an opponent's
 * ocean) or an unmounted strip falls back to the neutral top table edge —
 * still the mirror of the viewer's own bottom-centre supply.
 */
export function remoteOriginPoint(color: Color | undefined, ui: number): TransferPoint {
  return seatChipPoint(color, ui);
}

function armStageSafety(): void {
  if (stageSafety !== undefined) {
    window.clearTimeout(stageSafety);
  }
  stageSafety = window.setTimeout(() => abortRemotePlacements(), REMOTE_STAGE_SAFETY_MS);
}

function clearStageSafety(): void {
  if (stageSafety !== undefined) {
    window.clearTimeout(stageSafety);
    stageSafety = undefined;
  }
}
