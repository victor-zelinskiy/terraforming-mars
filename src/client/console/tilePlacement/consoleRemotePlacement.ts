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
  stackLandingRect, coverDescentPlan,
  SPROUT_PROFILE, TILE_SPROUT_MS, TIER_DUST_MS, tileContactKind, remoteBirthPoint, REMOTE_BEACON_LEAD_MS, REMOTE_BEACON_OUT_MS, REWARD_WAVE_STAGGER_MS,
} from '@/client/console/tilePlacement/tilePlacementModel';
import {claimTileMove, pairTileMoves} from '@/client/console/tilePlacement/tileMoveRecords';
import {stackRelease, clearStackRelease, stackDried} from '@/client/console/tilePlacement/cityStackScene';
import {TileMoveRecordModel} from '@/common/boards/TileMove';
import {SpaceId} from '@/common/Types';
import {probeTick} from '@/client/console/probeTick';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {
  AresAdjacencyFlight, ARES_WAVE_LEAD_MS,
  claimAresGrant, latestAresGrantFor, viewerAresAdjacencyFlights,
} from '@/client/console/tilePlacement/aresAdjacencyFlights';
import {AresAdjacencyGrantModel} from '@/common/models/AresAdjacencyGrantModel';
import {CardAdjacencyPayoutModel} from '@/common/models/CardAdjacencyPayoutModel';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {TilePlacementRecordModel} from '@/common/models/TilePlacementRecordModel';
import {claimCityPayout, cityPayoutVpSteps, cityPayoutsFor} from '@/client/console/tilePlacement/cityDataPayoutModel';
import {accumulatedVp} from '@/client/components/additionalResources/additionalResources';
import {claimVpShares, dropVpClaim, flyVpShares, holdsVpShares, isBoardVpShare, noteVpHeldElsewhere, releaseVpShares} from '@/client/console/scoreCell/vpShareLedger';
import {VpShare} from '@/common/game/vpAttribution';
import {cityPayoutReactionSpecs, runCityPayoutBeat, runCityPayoutSequence, runRemoteCityPayoutBeat, seatChipEnd, seatChipPoint} from '@/client/console/tilePlacement/cityDataPayoutBeat';
import {acceptSeatIntake, openSeatIntake, resetStatusIntakes, seatIntakeEnd} from '@/client/console/statusIntake';
import {ResourceTransferSpec, cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  placeTileProxy, playTileFlight, disposeTileProxy, killTileTweens,
  playAresSourcePulses, playCoverSplash, seatTileProxy,
  playTileSprout, playStackDust, playLandingBeacon,
  placeDepartProxy, playTileDeparture,
  placeMoveProxy, playTileMove, removeMoveProxy, placeStayingCover, hideStayingCover,
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
  runResourceTransfers, beginPanelRewardHold, releasePanelRewardHold, beginPanelVpHold, releasePanelVpHold, isResourceTransferActive,
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

/**
 * …unless the board is covered by a surface that has PROMISED to step aside for this very landing (PL-764 — a
 * Parliament sitting owes the board another seat's tile of the law's grant and will yield for it on its reward page):
 * the wait is then the sitting's walk, not a stall, and the clock waits with it — up to this hard bound.
 */
const BOARD_WAIT_KEPT_MAX_MS = 60000;

let boardWaitKeeper: (() => boolean) | undefined;

/** A surface that will yield the board for an owed landing says so here (one keeper — the sitting's world beat). */
export function registerRemoteBoardWaitKeeper(keeper: (() => boolean) | undefined): void {
  boardWaitKeeper = keeper;
}

/** …and once it IS back, the flight lets the screen settle first: the
 *  workspace's own leave is still dissolving over the board it just vacated,
 *  and a tile landing under it is the same invisible flight one beat later. */
const BOARD_SETTLE_MS = 320;

export const remotePlacementState = reactive({
  /**
   * TRUE while a remote proxy is on stage (drives the layer's remote block). Between two landings on a board in view
   * it stays up (the last one's splash and dust still play on its elements), but the moment the queue PARKS for a
   * covered board it comes down (`parkForBoard`): a stage reading «on» through a wait is a scene nobody is playing.
   */
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
   *
   * ⚠️ …AND THE WAIT OUTRANKS EVERY OTHER TERM (field log 2026-10-23, «Коммерческая сеть»: `{active: true,
   * waitingForBoard: true, queued: 1, draining: true}` for 35 s). The predicate used to read `active || (!waiting &&
   * queued)`, and `active` stayed true from the PREVIOUS landing of the same queue, so the second landing's wait held
   * the blocking hold after all: the player opened «Действия карт», the action's own draw waited for the blocking holds
   * («Берём карты из колоды…» standing still), the landing waited for the workspace to leave — a deadlock only the
   * 35 s ceiling ended. A waiting queue holds NOTHING, whatever was on stage a moment ago.
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
  /** TWO PIECES (TR44): the piece that STAYS while the piece under it leaves — the cover's art and cube. */
  stayingCover: undefined as {tileType: TileType, cube: DepartingCubePose | undefined} | undefined,
  /** A move could not be played as one carried object (no measurable hex, no
   *  stage) — both cells went straight to their final poses. A probe's witness. */
  moveDegraded: false,
  aresExtension: false,
  /** The VIEWER's own tiles answering the current remote placement (the
   *  Ares owner-income beat) — staged wakes, empty otherwise. */
  aresSources: [] as Array<AresSourceWake>,
  /** The placing seat's colour on the current landing's BEACON (W2) — undefined for the viewer's own auto-placed tile. */
  beaconColor: undefined as Color | undefined,
  nonce: 0,
});

/** A MOVE's other half, as the server's record + this diff proved it: the cell the city left. */
type RemoteMove = VerifiedMove & {
  /** The record's consumption key — claimed when the event is queued. */
  seq: number,
};

export type RemoteEvent = FreshPlacement & {
  /**
   * Every CARD this placement paid («ТАЙЛ ПЛАТИТ КАРТЕ», `cards/tilePayout.ts` —
   * TR21 Arboretum's cities, TR30 Red Museum / Pets / Martian Census answering
   * the tile itself), claimed at staging, in the engine's order: the senders
   * answer after the landing, their tokens flying to the paid seat's chip — or,
   * when the seat is the viewer's own (their Pets answering this foreign city,
   * a parked pin landing here), into their satellite cell, the holds seeded at
   * staging.
   */
  cityPayouts?: Array<{payout: CardAdjacencyPayoutModel, own: boolean, cardModel?: CardModel}>,
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
   * WHO PLACED IT, by the server's record (`GameModel.tilePlacements`) — an ocean carries no owner, so without this
   * its flight could not leave the placer's chip (it left the strip's middle). Undefined: no record (an old server,
   * a restart) — the tile's own colour, else the neutral origin.
   */
  placer?: Color,
  /** What the cell's PRINTED bonus paid the placer, by the same record — flown from the cell to the placer's chip
   *  after the touchdown (W3). Undefined / empty: nothing to fly. */
  cellPaid?: TilePlacementRecordModel['paid'],
  /**
   * The plants the placer paid for this GREENERY (the conversion — W4), proven against the two views (the placer's
   * plants fell by exactly their own price, the cell's printed plants added back). The «−N» leaves their chip into the
   * cell before the greenery grows. Undefined: not a conversion, or not provable.
   */
  plantPrice?: number,
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

// ── THE SCORE CELL'S SHARE OF A FOREIGN TILE (TR55, the owner's decision 5) ─────────────────────────────────────
// A rival's greenery beside the viewer's city, an ocean beside their Capital, a city under their Vermin: the
// viewer's points move because of a tile THIS stage lands. The ledger holds those shares from the apply block until
// the tile is on the board, then each is born on the cell that caused it and flies to the score cell. The claim
// lives for the stage's whole story and a short grace after it — the bot's pipeline lands its tiles turn by turn and
// applies the view (the score) only with its last turn.
export const REMOTE_TILE_VP_OWNER = 'remote-tiles';
const REMOTE_TILE_VP_RANK = 1;
const REMOTE_VP_GRACE_MS = 8000;
/** The cells this story landed (or lifted), in order — the shares' possible sources. */
let remoteVpCells: Array<string> = [];
let remoteVpDropTimer: number | undefined;

function claimRemoteVp(): void {
  if (remoteVpDropTimer !== undefined) {
    window.clearTimeout(remoteVpDropTimer);
    remoteVpDropTimer = undefined;
  }
  claimVpShares(REMOTE_TILE_VP_OWNER, isBoardVpShare, REMOTE_TILE_VP_RANK, {
    // Seeded after the story's tiles already landed (the bot's last turn): fly now, from the cells they landed on.
    onSeeded: () => {
      if (!draining) {
        void flyRemoteVp();
      }
    },
  });
}

function scheduleRemoteVpDrop(): void {
  if (remoteVpDropTimer !== undefined) {
    window.clearTimeout(remoteVpDropTimer);
  }
  remoteVpDropTimer = window.setTimeout(() => {
    remoteVpDropTimer = undefined;
    releaseVpShares(REMOTE_TILE_VP_OWNER, {why: 'the story of the foreign tiles is over'});
    dropVpClaim(REMOTE_TILE_VP_OWNER);
    remoteVpCells = [];
  }, REMOTE_VP_GRACE_MS);
}

/** The viewer's shares of this story, each from the cell that caused it (a city's — the nearest landed cell). */
async function flyRemoteVp(): Promise<void> {
  if (!holdsVpShares(REMOTE_TILE_VP_OWNER)) {
    return;
  }
  await nextTick();
  const cells = [...remoteVpCells];
  await flyVpShares(REMOTE_TILE_VP_OWNER, (share) => remoteVpOrigin(share, cells), {fromBoard: true});
}

/** The centre of the landed cell nearest to the share's own (a city); otherwise the last cell the story landed. */
function remoteVpOrigin(share: VpShare, cells: ReadonlyArray<string>): TransferPoint | undefined {
  const rects = cells.flatMap((id) => {
    const r = measureBoardHexRect(id);
    return r === undefined ? [] : [{x: r.x + r.w / 2, y: r.y + r.h / 2}];
  });
  if (rects.length === 0) {
    return undefined;
  }
  if (share.source.kind === 'city') {
    const own = measureBoardHexRect(share.source.space);
    if (own !== undefined) {
      const c = {x: own.x + own.w / 2, y: own.y + own.h / 2};
      return rects.reduce((best, p) => (Math.hypot(p.x - c.x, p.y - c.y) < Math.hypot(best.x - c.x, best.y - c.y) ? p : best));
    }
  }
  return rects[rects.length - 1];
}
/** Bumped by abort — a drain loop mid-await sees the change and exits
 *  without touching the (already cleaned) state. */
let epoch = 0;
let stageSafety: number | undefined;

/**
 * THE HOLD IS FOR THE SCENE, NEVER FOR THE WAIT: a proxy on stage or a queued landing holds — except while the queue
 * is PARKED for a board the player cannot see. The wait is read FIRST and outranks every other term: a landing that
 * waits for a covered board holds nothing, whatever was on stage a moment ago, so the very surface covering it (a
 * workspace whose own draw waits for the blocking holds) is never deadlocked against it.
 *
 * ⚠ ORDER IS LOAD-BEARING: this is an animation-hold supplier, read through a Vue `watch` that short-circuits. The
 * two REACTIVE terms come first — `waitingForBoard` (its falling edge re-raises the hold the moment the board is back,
 * its rising edge releases it the moment the queue parks) and `active`; `queue` is a plain array, read last, so the
 * watcher never drops its only reactive dependency (the bug that hit `isResourceTransferActive` when its first term
 * was a non-reactive `let`).
 */
export function isRemotePlacementActive(): boolean {
  return !remotePlacementState.waitingForBoard &&
    (remotePlacementState.active || queue.length > 0);
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
  /** The PREVIOUS view's ring — a record of THIS placement is one it did not carry. */
  prevCardPayouts?: ReadonlyArray<CardAdjacencyPayoutModel>,
  /** The SERVER's ring of tiles placed on Mars (`game.tilePlacements`) — who placed each, what the cell paid them. */
  placements?: ReadonlyArray<TilePlacementRecordModel>,
  /** The PREVIOUS view's ring — a record of THIS response is one it did not carry. */
  prevPlacements?: ReadonlyArray<TilePlacementRecordModel>,
  /** Every seat's public model in the APPLIED view and in the ANSWER — what a rival's greenery's plant price is proven
   *  against (W4). Absent: no price token (the honest default). */
  players?: {before: ReadonlyArray<PublicPlayerModel>, after: ReadonlyArray<PublicPlayerModel>},
  /**
   * The VIEWER's own tableau (their card's face): a payout onto the VIEWER's card that somebody else's placement
   * caused (Pets on a rival's city — TR53 iteration, case 4) rises THAT card by the field, the own scene, never a
   * token into the satellite.
   */
  viewerCards?: ReadonlyArray<CardModel>,
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
      // cube, every tier — until the proxy takes it over 1:1. TWO PIECES
      // (TR44): the cell keeps painting the city IN ITS LIFT over the water
      // whichever piece travels — the city off the water, or the water out
      // from under the city (`stays` names the other).
      if (move.stays !== undefined) {
        const cityStays = move.stays.tileType !== TileType.OCEAN;
        holdRemoteReveal(move.from, cityStays ? move.stays.tileType : move.tileType, cityStays ? move.stays.color : move.color, TileType.OCEAN);
      } else if (move.stack === undefined) {
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
      // leaves on the proxy. THE WATER FROM UNDER A CITY (TR44): the cell keeps
      // painting the city in its lift over the water — the city stays.
      if (e.stays !== undefined) {
        holdRemoteReveal(e.spaceId, e.stays.tileType, e.stays.color, TileType.OCEAN);
      } else {
        holdRemoteReveal(e.spaceId, e.tileType);
      }
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
    // THE SERVER'S RECORD OF THIS PLACEMENT (the tile language): who placed it, what the cell paid them.
    const record = claimPlacementRecordOf(e.spaceId, opts);
    queue.push({
      ...e,
      aresExtension: opts?.aresExtension === true,
      own: e.color !== undefined && e.color === opts?.viewerColor,
      income: claimIncome(e.spaceId, opts),
      cityPayouts: claimCityPayoutsOf(e.spaceId, opts),
      ...(record !== undefined ? {
        placer: record.color,
        cellPaid: record.paid,
        plantPrice: provenPlantPrice(record, events, opts),
      } : {}),
    });
    queued = true;
  }
  if (queued) {
    claimRemoteVp();
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

/**
 * THE RECORD OF THIS PLACEMENT (`game.tilePlacements`): a record of THIS response — one the previous view did not
 * carry — naming the cell, claimed once per client by `seq` (a poll and a submit reporting the same tile never fly
 * its bonus twice). Undefined without a ring (an old server, the bot's staging with no buffered view).
 */
function claimPlacementRecordOf(spaceId: string, opts: RemoteStageOpts | undefined): TilePlacementRecordModel | undefined {
  const known = new Set((opts?.prevPlacements ?? []).map((r) => r.seq));
  const record = [...(opts?.placements ?? [])].reverse().find((r) => r.spaceId === spaceId && !known.has(r.seq) && !claimedPlacementRecords.has(r.seq));
  if (record === undefined) {
    return undefined;
  }
  claimedPlacementRecords.add(record.seq);
  if (claimedPlacementRecords.size > 64) {
    claimedPlacementRecords.delete(claimedPlacementRecords.values().next().value as number);
  }
  return record;
}
const claimedPlacementRecords = new Set<number>();

/**
 * A RIVAL'S GREENERY BOUGHT WITH PLANTS (W4), proven, never guessed: the placer's plants fell by exactly their own
 * conversion price once the cell's printed plants are added back, and this response placed ONE greenery of theirs (two
 * would share one diff — nothing is flown then). The answer is the price; undefined is «not provable».
 */
function provenPlantPrice(
  record: TilePlacementRecordModel,
  events: ReadonlyArray<FreshPlacement>,
  opts: RemoteStageOpts | undefined,
): number | undefined {
  if (record.tileType !== TileType.GREENERY || opts?.players === undefined) {
    return undefined;
  }
  const greeneries = events.filter((e) => e.tileType === TileType.GREENERY && e.color === record.color);
  if (greeneries.length !== 1) {
    return undefined;
  }
  const before = opts.players.before.find((p) => p.color === record.color);
  const after = opts.players.after.find((p) => p.color === record.color);
  if (before === undefined || after === undefined) {
    return undefined;
  }
  const paidPlants = record.paid.filter((p) => p.resource === 'plants').reduce((sum, p) => sum + p.amount, 0);
  const price = before.plants - after.plants + paidPlants;
  return price > 0 && price === before.plantsNeededForGreenery ? price : undefined;
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
export function claimCityPayoutsOf(spaceId: string, opts: RemoteStageOpts | undefined): RemoteEvent['cityPayouts'] {
  const out = cityPayoutsFor(opts?.cardPayouts, spaceId, undefined, opts?.prevCardPayouts)
    .filter((payout) => claimCityPayout(payout.seq))
    .map((payout) => {
      const own = payout.color === opts?.viewerColor;
      const cardModel = own ? opts?.viewerCards?.find((c) => c.name === payout.target) : undefined;
      return {payout, own, ...(cardModel !== undefined ? {cardModel} : {})};
    });
  for (const item of out) {
    if (item.own) {
      beginPanelRewardHold(cityPayoutHoldSpecs(item.payout));
      beginPanelVpHold(cityPayoutVp(item.payout));
      // The score cell's ledger nets them out of the card's share — the payout's own token brings them (TR55).
      noteVpHeldElsewhere({kind: 'card', card: item.payout.target}, cityPayoutVp(item.payout));
    }
  }
  return out.length > 0 ? out : undefined;
}

/** The points a payout brings its card (the rail's VP cell is derived — it keeps them back with the count). */
function cityPayoutVp(payout: CardAdjacencyPayoutModel): number {
  return cityPayoutVpSteps(payout.before, payout.amount, (count) => accumulatedVp(payout.target, count)).reduce((a, b) => a + b, 0);
}

/** Release the viewer's own holds of ONE card payout of the event, once (the hold map is additive). */
function releaseCityPayoutHold(item: {payout: CardAdjacencyPayoutModel, own: boolean, cardModel?: CardModel}): void {
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
  // The seats' intake plaques the stage opened fold with it (an aborted payout never leaves a receiver waiting).
  resetStatusIntakes();
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
  // The viewer's shares of this story tick now, named (the tiles were revealed at once, with no flight).
  releaseVpShares(REMOTE_TILE_VP_OWNER, {why: 'the remote stage aborted'});
  dropVpClaim(REMOTE_TILE_VP_OWNER);
  remoteVpCells = [];
  clearRemoteRevealHolds(); // belt-and-braces: nothing may stay hidden
  draining = false;
  remotePlacementState.waitingForBoard = false;
  clearRemoteStage();
  clearStageSafety();
}

/**
 * The stage comes down: the proxy's art, the beacon, the departure, the move's pose, the Ares wakes — and `active`,
 * which says «a proxy is on stage». At the drain's end, at an abort, and whenever the queue PARKS for a covered board
 * (`parkForBoard`) — never merely between two landings on a board in view, where the last one's splash and dust are
 * still playing on these very elements while the next one takes its first look.
 */
function clearRemoteStage(): void {
  remotePlacementState.active = false;
  remotePlacementState.tileType = undefined;
  remotePlacementState.beaconColor = undefined;
  remotePlacementState.departingTile = undefined;
  clearMoveStage();
  remotePlacementState.aresSources = [];
}

/**
 * The queue PARKS for a board the player cannot see. The wait holds nothing (`isRemotePlacementActive` reads it first),
 * and nothing of the PREVIOUS landing stands through it: a degrade path leaves `active` up (`degradeMove` mounts the
 * root for its witness, a flight that found no proxy returns past it), and a stage still «on» through the next
 * landing's wait was the 35 s deadlock of the field log on `waitingForBoard`.
 */
function parkForBoard(): void {
  remotePlacementState.waitingForBoard = true;
  clearRemoteStage();
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
  remotePlacementState.stayingCover = undefined;
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
    // A tile queued WHILE the score's tokens fly is drained after them — the outer loop re-reads the queue.
    do {
      await drainEvents(myEpoch);
      // THE VIEWER'S SCORE answers the tiles it just watched land (TR55): their shares fly now, each from its cause.
      if (epoch === myEpoch) {
        await flyRemoteVp();
      }
    } while (queue.length > 0 && epoch === myEpoch);
    if (epoch === myEpoch) {
      scheduleRemoteVpDrop();
    }
  } finally {
    if (epoch === myEpoch) {
      draining = false;
      clearRemoteStage();
      clearStageSafety();
    }
  }
}

/** Land every queued event in turn (the drain's inner loop). */
async function drainEvents(myEpoch: number): Promise<void> {
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
        remoteVpCells.push(ev.spaceId);
      }
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
  if (boardCovered()) {
    parkForBoard();
  }
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
  // The water out from UNDER a city: the city that stays is painted over the leaving water (the cover).
  remotePlacementState.stayingCover = move.stays !== undefined && move.stays.tileType !== TileType.OCEAN ?
    {tileType: move.stays.tileType, cube: departingCubePose(move.stays.color, sourceHex)} :
    undefined;
  remotePlacementState.move = true;
  remotePlacementState.aresExtension = ev.aresExtension;
  remotePlacementState.nonce++;
  await nextTick(); // the layer mounts the proxy
  if (epoch !== myEpoch) {
    return;
  }
  const els = tileStageRemoteEls();
  // TWO PIECES (TR44): a city leaving its water starts in the pile's lift (the top of the two-piece cell); the water
  // leaving from under a city starts on the full hex it is the ground of (`stays` names the piece that keeps the cell).
  const sourceTiers = move.stack?.from ?? (move.stays?.tileType === TileType.OCEAN ? 2 : 1);
  const stays = move.stays !== undefined;
  if (els === undefined || !placeMoveProxy(els, moveSourceRect(sourceHex, sourceTiers), dest)) {
    await degradeMove(ev, myEpoch);
    return;
  }
  // THE COVER of the piece that stays (the water out from under a city) — posed in the same turn as the proxy.
  if (remotePlacementState.stayingCover !== undefined) {
    placeStayingCover(els, coverDescentPlan(sourceHex));
  }
  // THE HANDOFF: the proxy stands 1:1 over the city, so the real source cell
  // may become what was committed NOW — nothing is seen to change.
  releaseRemoteReveal(move.from);
  releaseStackHeight(move.from);
  if (move.stack !== undefined) {
    stackRelease(move.from as SpaceId);
  }
  if (move.stays !== undefined && move.stays.tileType !== TileType.OCEAN) {
    stackDried(move.from as SpaceId); // the city that stays settles onto the ground in this very turn
  }
  await playTileMove(els, {
    source: moveSourceRect(sourceHex, sourceTiers),
    dest,
    uiScale: ui,
    liftMs: motionMs(MOVE_LIFT_MS),
    carryMs: motionMs(MOVE_CARRY_MS),
    landMs: motionMs(MOVE_LAND_MS),
    onCleared: () => {
      hideStayingCover(els);
      if (epoch === myEpoch && move.stack === undefined && !stays) {
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
  remotePlacementState.stayingCover = undefined;
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
  remotePlacementState.stayingCover = undefined;
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
  if (boardCovered()) {
    parkForBoard();
  }
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
  // NOW — nothing is seen to change until the proxy starts to move. The water
  // from under a city (TR44): the city that stays settles onto the ground.
  releaseRemoteReveal(ev.spaceId);
  if (ev.stays !== undefined) {
    stackDried(ev.spaceId as SpaceId);
  }
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
  // The vacated cell settles once; the cube (if the tile had one) is gone with the tile. A cell whose city stays
  // (the water left from under it) is not vacated — it settled with its city.
  if (ev.stays === undefined) {
    markCellVacated(ev.spaceId);
  } else {
    clearStackRelease(ev.spaceId as SpaceId);
  }
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
  if (boardCovered()) {
    parkForBoard();
  }
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
  // A CITY ON TOP OF AN OCEAN (TR44): the tile lands INTO the pile's lift over the water — where the board paints the
  // top of a two-piece cell (`stackLandingRect`, the hero's own geometry) — while the splash stays the water's (the
  // full hex). A composite (an Ocean City) is one tile and lands on the hex as it always did.
  const afloat = ev.covers === TileType.OCEAN && ev.tileType === TileType.CITY;
  const landingOf = (h: TileRect): TileRect => (afloat ? stackLandingRect(h, 2) : h);
  // WHO PLACED IT — the tile's owner, else the server's record (an ocean carries no owner): the flight leaves THAT
  // seat's chip, the beacon wears THAT seat's colour, the cell's bonus flies back to THAT chip.
  const actor = ev.color ?? ev.placer;
  // THE CONTACT BY KIND (W7): a greenery GROWS out of its cell — never flown in — a city lands with dust, an ocean
  // with the water's ring. A cover keeps its own splash (below) and grows nothing.
  const kind = tileContactKind(ev.tileType);
  const sprout = kind === 'sprout' && ev.covers === undefined && !afloat;
  // The cell's printed icons, measured NOW — the held cell still paints them; the touchdown covers them, and the
  // placer's bonus tokens are born exactly where they were printed (W3).
  const iconCentres = !ev.own && (ev.cellPaid?.length ?? 0) > 0 ? bonusIconCentres(ev.spaceId) : [];
  remotePlacementState.active = true;
  remotePlacementState.tileType = ev.tileType;
  remotePlacementState.aresExtension = ev.aresExtension;
  remotePlacementState.beaconColor = ev.own ? undefined : actor;
  remotePlacementState.nonce++;
  await nextTick(); // the layer mounts the remote proxy
  if (epoch !== myEpoch) {
    return;
  }
  const els = tileStageRemoteEls();
  const profile = sprout ? SPROUT_PROFILE : ev.own ? OWN_FLIGHT_PROFILE : REMOTE_FLIGHT_PROFILE;
  // BORN WHOLE UNDER THE PLACER'S CHIP (PL-769): the chip point is the strip's lower edge — a tile centred on it was
  // half hidden behind the strip — and the path is a DIVE that never climbs above its start.
  const landing = landingOf(hex);
  const from = sprout ? {x: landing.x + landing.w / 2, y: landing.y + landing.h / 2} :
    ev.own ? tableSupplyPoint(ui) : remoteBirthPoint(remoteOriginPoint(actor, ui), landing.h, profile);
  if (els === undefined || !placeTileProxy(els, {hex: landing, from, profile})) {
    degradeReveal(ev);
    return;
  }
  // A RIVAL'S GREENERY BOUGHT WITH PLANTS (W4): the «−N» leaves their chip and is drawn quickly into the cell — then
  // the greenery grows out of it. Proven at staging, else not flown.
  const priceChip = sprout && ev.plantPrice !== undefined ? seatChipEnd(actor) : undefined;
  if (sprout && ev.plantPrice !== undefined && priceChip !== undefined) {
    await runResourceTransfers({
      specs: [{channel: 'stock', resource: 'plants', amount: ev.plantPrice, direction: 'loss'}],
      source: {point: {x: landing.x + landing.w / 2, y: landing.y + landing.h / 2}},
      destination: priceChip,
      arrival: 'auto',
      absorb: 'quick',
      fromBoard: true,
    });
    if (epoch !== myEpoch) {
      return;
    }
  }
  const flightMs = motionMs(sprout ? TILE_SPROUT_MS : TILE_FLIGHT_MS);
  const beaconLead = motionMs(REMOTE_BEACON_LEAD_MS);
  if (!ev.own) {
    // THE LANDING BEACON (W2): the cell lights in the placer's colour just before the tile arrives — a sprout is
    // announced the same lead before it starts to grow.
    playLandingBeacon(els.beacon, {hex, delayMs: sprout ? 0 : Math.max(0, flightMs - beaconLead), leadMs: beaconLead, outMs: motionMs(REMOTE_BEACON_OUT_MS)});
    if (sprout) {
      await wait(beaconLead);
      if (epoch !== myEpoch) {
        return;
      }
    }
  }
  const waterHex = hex;
  const onContact = (): void => {
    if (ev.covers !== undefined || afloat) {
      return; // a cover's splash is the water's, played below
    }
    if (kind === 'dust') {
      playStackDust(els, {hex: landing, uiScale: ui, dustMs: motionMs(TIER_DUST_MS)});
    } else if (kind === 'splash') {
      playCoverSplash(els, {hex: waterHex, uiScale: ui, splashMs: motionMs(OCEAN_SPLASH_MS)});
    }
  };
  await (sprout ?
    playTileSprout(els, {hex: landing, uiScale: ui, sproutMs: flightMs, settleMs: motionMs(TILE_SETTLE_MS), onContact}) :
    playTileFlight(els, {
      hex: landing,
      from,
      uiScale: ui,
      flightMs,
      settleMs: motionMs(TILE_SETTLE_MS),
      profile,
      path: ev.own ? 'lob' : 'dive',
      onContact,
      // The live-anchor contract: the final approach re-reads the cell and
      // blends the remaining leg onto it — a focus exit that lands mid-flight
      // no longer parks the tile hundreds of px off its hex.
      liveHex: () => {
        const live = measureBoardHexRect(ev.spaceId);
        return live === undefined ? undefined : landingOf(live);
      },
    }));
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
      seatTileProxy(els, landingOf(live));
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
  // ONE WAVE (W6), in the engine's order, `REWARD_WAVE_STAGGER_MS` apart:
  // THE CELL PAID ITS PLACER (W3): what the printed bonus gave them — the human's icons, MarsBot's M€ for the icons it
  // covered — lifts off the cell where it was printed and flies to their chip. The server's record, never a guess.
  // THE VIEWER'S OWN TILES ANSWER: the Ares owner-income beat — their tile
  // wakes at the edge it shares with the foreign build and sends the M€
  // home. Runs INSIDE the flight (the stage stays mounted), after the cube.
  const wave: Array<() => Promise<void>> = [];
  const placerPaid = ev.cellPaid;
  if (epoch === myEpoch && !ev.own && actor !== undefined && placerPaid !== undefined && placerPaid.length > 0) {
    wave.push(() => runPlacerBonusBeat(placerPaid, iconCentres, hex, actor));
  }
  if (epoch === myEpoch && ev.income.length > 0) {
    const breathMs = wave.length > 0 ? 0 : undefined;
    wave.push(() => runRemoteAresIncomeBeat(ev, hex, ui, myEpoch, breathMs));
  }
  await Promise.all(wave.map(async (run, i) => {
    if (i > 0) {
      await wait(motionMs(REWARD_WAVE_STAGGER_MS * i));
    }
    if (epoch === myEpoch) {
      await run(); // (an abort before the launch already settled everything this member would have held)
    }
  }));
  playCityPayouts(ev, hex, ui, myEpoch);
}

/**
 * THE PLACER'S BONUS (W3 — the tile language): ONE token per printed RESOURCE carrying its sum (T06 — a swarm of one
 * token per unit read as noise on the 4K field: two steel were two «+1» flying to one chip), born on the first icon it
 * was printed as (in the printed order; a cell whose icons could not be measured sends it from the tile's centre) and
 * landing on the placer's chip in the strip — an OBJECT end, re-measured on the approach (the ribbon may carry the chip
 * along); no chip on screen, no flight. Nothing on the viewer's panel moves — it is somebody else's money.
 */
async function runPlacerBonusBeat(
  paid: ReadonlyArray<{resource: string, amount: number}>,
  iconCentres: ReadonlyArray<TransferPoint>,
  hex: TileRect,
  actor: Color,
): Promise<void> {
  const chip = seatChipEnd(actor);
  if (chip === undefined) {
    return;
  }
  const centre = {x: hex.x + hex.w / 2, y: hex.y + hex.h / 2};
  const specs: Array<ResourceTransferSpec> = [];
  const origins: Array<TransferPoint> = [];
  let unit = 0;
  for (const p of paid) {
    if (p.amount <= 0) {
      continue;
    }
    specs.push({channel: 'stock', resource: p.resource, amount: p.amount});
    origins.push(iconCentres[unit] ?? centre);
    unit += p.amount;
  }
  if (specs.length === 0) {
    return;
  }
  // THE SEAT'S INTAKE (the owner's M1): the plaque under the placer's chip opens BEFORE the tokens are born, each token
  // lands on its resource's number and ticks it; a resource whose number is not painted lands on the chip itself.
  await openSeatIntake(actor, specs);
  await runResourceTransfers({
    specs,
    origins,
    source: {point: centre},
    destination: chip,
    destinationOf: (spec) => seatIntakeEnd(actor, spec.resource),
    arrival: 'auto',
    fromBoard: true,
    onArrive: (spec) => acceptSeatIntake(actor, spec),
  });
}

/** The cell's printed bonus icons (the board's own `.board-space-bonus` boxes), centres in the printed order. */
function bonusIconCentres(spaceId: string): Array<TransferPoint> {
  if (typeof document === 'undefined') {
    return [];
  }
  const cell = document.querySelector('.board-space[data_space_id="' + spaceId + '"]');
  return cell === null ? [] : [...cell.querySelectorAll<HTMLElement>('.board-space-bonus')]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 2 && r.height > 2)
    .map((r) => ({x: r.left + r.width / 2, y: r.top + r.height / 2}));
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
    // THE VIEWER'S OWN CARD answers a placement somebody else made (Pets on a rival's city — TR53 iteration, case 4):
    // the card RISES by the field and receives, exactly as for the viewer's own placement — never a token into the
    // satellite. Another seat's card is not on this screen: its units fly to that seat's chip.
    play: () => item.own && item.cardModel !== undefined ? runOwnPayoutOnRemoteStage(item, hex, ui) : runRemoteCityPayoutBeat({
      payout: item.payout,
      tileRect: hex,
      uiScale: ui,
      seat: item.own ? undefined : item.payout.color,
      release: () => releaseCityPayoutHold(item),
    }),
    release: () => releaseCityPayoutHold(item),
  })));
}

/**
 * The OWN scene of a payout onto the viewer's card on the remote stage: the holds seeded at staging (the satellite
 * cell, the table's answer, the points) are released by the scene, each at its own touchdown / landing.
 */
function runOwnPayoutOnRemoteStage(item: {payout: CardAdjacencyPayoutModel, own: boolean, cardModel?: CardModel}, hex: TileRect, ui: number): Promise<void> {
  // The scene owns every hold of this record from here on — the event-wide release (an abort mid-stage) skips it.
  item.own = false;
  const holds = cityPayoutHoldSpecs(item.payout);
  const card = holds[0];
  const reactions = holds.slice(1);
  let points = cityPayoutVp(item.payout);
  return runCityPayoutBeat({
    payout: item.payout,
    tileRect: hex,
    cardModel: item.cardModel,
    uiScale: ui,
    pace: 1,
    alive: () => true,
    releaseCard: () => releasePanelRewardHold(card),
    releaseReaction: (spec) => {
      const held = reactions.find((r) => r.channel === spec.channel && r.resource === spec.resource);
      if (held !== undefined) {
        reactions.splice(reactions.indexOf(held), 1);
        releasePanelRewardHold(held);
      }
    },
    vpSteps: cityPayoutVpSteps(item.payout.before, item.payout.amount, (count) => accumulatedVp(item.payout.target, count)),
    releaseVp: (released) => {
      points -= released;
      releasePanelVpHold(released);
    },
    onEnd: () => {
      // Whatever the scene did not release (a degrade, an abort) lets go here — the hold map is additive.
      reactions.splice(0).forEach((spec) => releasePanelRewardHold(spec));
      if (points !== 0) {
        releasePanelVpHold(points);
        points = 0;
      }
    },
  });
}

/**
 * The REMOTE half of the Ares adjacency beat: everything the VIEWER receives
 * from a placement somebody else made — their own tiles' owner income (and,
 * for an auto-placed own tile, the placer gains). Same wake language and the
 * same shared framework as the own hero's beat; the hold seeded at staging
 * is released chip by chip, and every degrade path releases it whole.
 */
async function runRemoteAresIncomeBeat(ev: RemoteEvent, tileRect: TileRect, ui: number, myEpoch: number, breathMs?: number): Promise<void> {
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
  await wait(motionMs(breathMs ?? OCEAN_BEAT_BREATH_MS));
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
/**
 * Is a remote landing still OWED — queued, waiting for a board the player can see, or flying? The question a surface
 * that STEPPED ASIDE for the board asks before it comes back (`ConsoleShell.resumeYieldedStackOverQuietBoard`): a
 * sitting that yielded for the viewer's own city must not re-cover the board while the next seat's city (the bot's —
 * the same response, RX38) still has to land on it. Not an animation hold: a queue parked for a covered board holds
 * nothing (see `waitingForBoard`).
 */
export function remoteLandingOwed(): boolean {
  return remotePlacementState.active || remotePlacementState.waitingForBoard || queue.length > 0 || draining;
}

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
  // ONE TICK BEFORE THE FIRST LOOK (RX38): this landing is staged INSIDE the apply block, while the SAME response's
  // own presentations register only after it (the viewer's own tile hero ends on this very commit and starts its
  // reward wave on the next tick). A tick is free; a race lost is a landing the player never sees.
  return new Promise<void>((ticked) => probeTick(() => ticked())).then(() => watchableBoardAfterTick(myEpoch));
}

/**
 * THE VIEWER'S OWN PLACEMENT STILL TELLS ITS STORY on this board — its landing, the cell's bonus wave, the ruling
 * party's answer flying to the rail (RX38). Another seat's tile WAITS for it: the seats go in turn, and the response
 * to the viewer's own answer routinely carries the next seat's tile too (the bot's city, placed by its own primitive
 * the moment the viewer answered). Flown at once, it shared the screen with the viewer's own payout and with the card
 * the ruling Mars First deals for the viewer's city — that deal arms half a second after the commit, so it is the
 * story's END that hands over, not a clock: by then the deal stands (`boardCovered`) and the tile waits for its take
 * and for the taken card's flight into the dock.
 */
function ownPlacementStoryLive(): boolean {
  const phase = tilePlacementState.phase;
  return (tilePlacementState.active && phase !== 'idle' && phase !== 'armed' && phase !== 'failed') || isResourceTransferActive() ||
    // …and the card that story dealt, still on its way into the dock after the take (the eye follows it there).
    handDeliveryState.flights.length > 0 || handDeliveryState.inFlight.length > 0;
}

/** The board is no stage for another seat's landing yet: covered, or still the viewer's own placement's. */
function boardBusyForRemote(): boolean {
  return boardCovered() || ownPlacementStoryLive();
}

function watchableBoardAfterTick(myEpoch: number): Promise<void> {
  if (epoch !== myEpoch) {
    return Promise.resolve();
  }
  if (!boardBusyForRemote()) {
    return Promise.resolve();
  }
  parkForBoard();
  const started = Date.now();
  const deadline = started + BOARD_WAIT_MAX_MS;
  const expired = (): boolean => {
    const now = Date.now();
    return now > deadline && (boardWaitKeeper?.() !== true || now > started + BOARD_WAIT_KEPT_MAX_MS);
  };
  return new Promise<void>((done) => {
    const poll = () => {
      if (epoch !== myEpoch || !boardBusyForRemote() || expired()) {
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
