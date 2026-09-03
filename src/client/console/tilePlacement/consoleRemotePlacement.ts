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
  FreshPlacement, detectFreshPlacements, OWN_FLIGHT_PROFILE, REMOTE_FLIGHT_PROFILE,
  TILE_FLIGHT_MS, TILE_SETTLE_MS, TileRect,
  OCEAN_PULSE_MS, OCEAN_BEAT_BREATH_MS, OCEAN_COIN_LIFT_PX, OCEAN_COIN_T, OCEAN_PULSE_T, OCEAN_PULSE_DRIFT,
  OCEAN_SPLASH_MS, oceanEdgePoint, oceanShoreDirection,
} from '@/client/console/tilePlacement/tilePlacementModel';
import {
  AresAdjacencyFlight, ARES_WAVE_LEAD_MS,
  claimAresGrant, latestAresGrantFor, viewerAresAdjacencyFlights,
} from '@/client/console/tilePlacement/aresAdjacencyFlights';
import {AresAdjacencyGrantModel} from '@/common/models/AresAdjacencyGrantModel';
import {
  placeTileProxy, playTileFlight, disposeTileProxy, killTileTweens,
  playAresSourcePulses, playCoverSplash,
} from '@/client/console/tilePlacement/tilePlacementDirector';
import {
  tilePlacementState, tileStageRemoteEls, measureBoardHexRect, tableSupplyPoint, AresSourceWake,
} from '@/client/console/tilePlacement/consoleTilePlacement';
import {
  holdRemoteReveal, releaseRemoteReveal, isRemoteRevealHeld, clearRemoteRevealHolds,
} from '@/client/console/tilePlacement/remoteRevealHold';
import {
  holdCubeForHeroPlacement, dropCubeForHeroPlacement, restCubeForHeroPlacement,
} from '@/client/components/board/cubeDropState';
import {
  runResourceTransfers, beginPanelRewardHold, releasePanelRewardHold,
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
  aresExtension: false,
  /** The VIEWER's own tiles answering the current remote placement (the
   *  Ares owner-income beat) — staged wakes, empty otherwise. */
  aresSources: [] as Array<AresSourceWake>,
  nonce: 0,
});

type RemoteEvent = FreshPlacement & {
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
registerAnimationHoldSupplier('tile-placement-remote', isRemotePlacementActive);

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
};

export function stageRemotePlacements(
  prevSpaces: ReadonlyArray<SpaceModel> | undefined,
  newSpaces: ReadonlyArray<SpaceModel> | undefined,
  opts?: RemoteStageOpts,
): void {
  if (prevSpaces === undefined || newSpaces === undefined) {
    return;
  }
  stageRemoteTileEvents(detectFreshPlacements(prevSpaces, newSpaces), opts);
}

/**
 * STAGE (the explicit-events form) — for callers that carry the tile list
 * themselves (the bot staging's per-turn visual footprint). Same contract:
 * same synchronous block as the mutation that commits the tiles.
 */
export function stageRemoteTileEvents(
  events: ReadonlyArray<FreshPlacement>,
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
    if (tilePlacementState.active && tilePlacementState.spaceId === e.spaceId) {
      continue; // the viewer's OWN armed hero owns that space
    }
    if (isRemoteRevealHeld(e.spaceId) || queue.some((q) => q.spaceId === e.spaceId)) {
      continue; // already staged (a poll/submit double-report of one tile)
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
    // The viewer's own share of this placement's Ares adjacency payouts
    // (usually: THEIR tile earned owner income from a foreign build). The
    // panel hold MUST be seeded here — the same synchronous block as the
    // commit — or Vue flushes a frame with a phantom −N chip.
    let income: ReadonlyArray<AresAdjacencyFlight> = [];
    const grant = latestAresGrantFor(opts?.aresGrants, e.spaceId);
    if (grant !== undefined && opts?.viewerColor !== undefined && claimAresGrant(grant.seq)) {
      income = viewerAresAdjacencyFlights(grant, opts.viewerColor);
      if (income.length > 0) {
        beginPanelRewardHold(income.map((f) => f.spec));
      }
    }
    queue.push({
      ...e,
      aresExtension: opts?.aresExtension === true,
      own: e.color !== undefined && e.color === opts?.viewerColor,
      income,
    });
    queued = true;
  }
  if (queued) {
    armStageSafety();
    void drainQueue();
  }
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
    if (ev.color !== undefined) {
      restCubeForHeroPlacement(ev.spaceId);
    }
    releaseIncomeHolds(ev); // the committed money shows at once, never stuck
  }
  queue.length = 0;
  clearRemoteRevealHolds(); // belt-and-braces: nothing may stay hidden
  draining = false;
  remotePlacementState.active = false;
  remotePlacementState.waitingForBoard = false;
  remotePlacementState.tileType = undefined;
  remotePlacementState.aresSources = [];
  clearStageSafety();
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
        await flyRemote(ev, myEpoch);
      } finally {
        if (epoch === myEpoch) {
          // Whatever happened, the COMMITTED tile must be visible.
          releaseRemoteReveal(ev.spaceId);
          queue.shift();
        }
      }
    }
  } finally {
    if (epoch === myEpoch) {
      draining = false;
      remotePlacementState.active = false;
      remotePlacementState.tileType = undefined;
      clearStageSafety();
    }
  }
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
  const hex = measureBoardHexRect(ev.spaceId);
  if (hex === undefined) {
    degradeReveal(ev); // still unmeasurable (a hidden section) — no flight
    return;
  }
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
  });
  if (epoch !== myEpoch) {
    return; // aborted mid-flight — abort already revealed everything
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
}

/**
 * Where a remote tile departs FROM — the acting player's chip in the top
 * status strip (the opponents literally live in the top HUD), so the
 * direction itself says WHO placed. An ownerless tile (an opponent's
 * ocean) or an unmounted strip falls back to the neutral top table edge —
 * still the mirror of the viewer's own bottom-centre supply.
 */
function remoteOriginPoint(color: Color | undefined, ui: number): TransferPoint {
  if (typeof document !== 'undefined' && color !== undefined) {
    const dot = document.querySelector<HTMLElement>(`.con-status__player .player_bg_color_${color}`);
    if (dot !== null) {
      const r = dot.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) {
        return {x: r.left + r.width / 2, y: r.bottom + Math.round(16 * ui)};
      }
    }
  }
  return {x: window.innerWidth / 2, y: Math.round(72 * ui)};
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
