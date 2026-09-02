/*
 * CONSOLE TILE PLACEMENT — the animation TRANSACTION behind the premium
 * "the tile physically lands on Mars and the field pays its printed
 * bonuses" hero scene (console-native only).
 *
 * The gate follows the established played-hero / patent-sale contract:
 *
 *   SelectSpace ARMS the transaction at the space submit (armTilePlacement
 *   — console-gated, BEFORE the POST; nothing visual happens yet — this
 *   covers EVERY console placement source: a card's follow-up placement, a
 *   standard project, a card action, WGT's ocean, convert-plants — they all
 *   funnel through the ONE headless SelectSpace). WaitingFor DETECTS it
 *   once per response (detectTilePlacement — consumes the arm and VERIFIES
 *   the server actually put a tile on the armed space: a refused placement
 *   / a hazard / a covered-tile case unwinds with zero trace), CAPTURES the
 *   cell's live geometry + printed bonus icons while the cell is still
 *   uncovered, HOLDS the commit through the flight (await runTilePlacement
 *   — supply lift-off → the low carried arc → touchdown → settle → the REAL
 *   tile paints silently under the proxy), SEEDS the panel reward hold for
 *   the printed stock bonuses, then COMMITS (payment / TR / everything else
 *   fires normally — the bonuses stay held), and finally endTilePlacement()
 *   plays the post-commit REWARD BEATS, in sequence:
 *     1. PRINTED bonuses — the cell's own icons rise through the placed tile,
 *        materialize into physical resource chips (the shared Resource
 *        Transfer Framework, per-icon origins) and pay out; each touchdown
 *        releases its metric, firing that delta chip at the contact.
 *     2. OCEAN ADJACENCY — every neighbouring ocean the SERVER says paid
 *        (`thisPlayer.lastOceanBonus`) wakes at the shore it shares with the
 *        new tile and condenses ONE M€ coin, which rides the SAME framework
 *        onto the M€ row. Its delta chip is AGGREGATED (one release at the
 *        last coin's touchdown), because the per-ocean story is told by the
 *        coins, not by three identical «+2 M€» chips.
 *   abortTilePlacement() is wired into every error path and a safety timer.
 *
 *   REMOVE-AND-REPLACE (Kaguya Tech on Mars, Lunar Mine Urbanization on the
 *   Moon — "remove 1 of yours and place this there, gain placement bonuses as
 *   usual") prefixes ONE beat to that sequence and changes nothing else: the
 *   arm carries the prompt's own `hiddenTiles` declaration, `verifyPlacement`
 *   is thereby licensed to read the tile→tile diff as a placement, and the
 *   scene opens with the REMOVAL — the doomed tile's proxy takes it over, the
 *   cell blanks to a bare hex with its printed bonus surfacing, the tile rises
 *   away carrying its owner cube, one breath, and then the ordinary flight
 *   brings the replacement in. Unlike an ocean COVER the cell was EMPTIED, so
 *   the printed bonuses are granted and paid out as for any bare hex — they
 *   are just captured a frame later, because they do not exist until the
 *   removal uncovers them. Contract: docs/claude/console/tile-replacement.md.
 *
 * Ownership map:
 *   - phases / geometry / bonus extraction → tilePlacementModel (pure);
 *   - GSAP work on the stage              → tilePlacementDirector;
 *   - the fixed proxy stage               → ConsoleTilePlacementLayer.vue;
 *   - the silent under-proxy tile paint   → applySpacePreview (model), the
 *     targeted twin of the shared applyTilePlacementPreview — the generic
 *     placement animation stays UNARMED, so desktop's own entrance is
 *     byte-identical and console never double-animates.
 *
 * DESKTOP SAFETY: `armTilePlacement` is only ever called when
 * `consoleModeState.enabled` (the SelectSpace hook is gated), so on desktop
 * `tilePlacementState.active` is false and `detectTilePlacement` returns
 * undefined → the WaitingFor hold never engages.
 */

import {reactive, nextTick} from 'vue';
import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {TileType} from '@/common/TileType';
import {SpaceModel} from '@/common/models/SpaceModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {
  holdCubeForHeroPlacement, dropCubeForHeroPlacement, restCubeForHeroPlacement,
} from '@/client/components/board/cubeDropState';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {OceanAdjacencyBonusModel} from '@/common/models/OceanAdjacencyBonusModel';
import {
  TilePlacementPhase, PlacementBonus, TileRect,
  placementBonuses, verifyPlacement, findSpace, applySpacePreview,
  TILE_FLIGHT_MS, TILE_SETTLE_MS, TILE_REDUCED_MS, TILE_ARM_SAFETY_MS,
  TILE_DEPART_MS, TILE_DEPART_SCALE, TILE_DEPART_TILT_DEG, TILE_DEPART_FADE_T,
  TILE_DEPART_REVEAL_T, TILE_DEPART_BREATH_MS, departureLiftPx, departingCubePose, DepartingCubePose,
  BONUS_PRELIFT_START_T, BONUS_RISE_MS, BONUS_HOVER_PX, BONUS_HANDOFF_BREATH_MS,
  OCEAN_BEAT_BREATH_MS, OCEAN_COIN_LIFT_PX, OCEAN_COIN_T, OCEAN_PULSE_T, OCEAN_PULSE_DRIFT,
  OCEAN_PULSE_MS, OCEAN_SPLASH_MS,
  oceanEdgePoint, oceanShoreDirection,
} from '@/client/console/tilePlacement/tilePlacementModel';
import {
  setPlacementHiddenTiles, clearPlacementHiddenTiles,
} from '@/client/components/board/placementRenderState';
import {
  abortOceanBeat, oceanBonusFor, runOceanAdjacencyBeat,
} from '@/client/console/tilePlacement/oceanAdjacencyBeat';
import {
  AresAdjacencyFlight, ARES_WAVE_LEAD_MS,
  claimAresGrant, latestAresGrantFor, viewerAresAdjacencyFlights,
} from '@/client/console/tilePlacement/aresAdjacencyFlights';
import {AresAdjacencyGrantModel} from '@/common/models/AresAdjacencyGrantModel';
import {
  TileStageEls, placeTileProxy, playTileFlight, disposeTileProxy,
  placeBonusProxies, playBonusPreLift, playBonusHandoff, killTileTweens,
  playAresSourcePulses, playCoverSplash,
  placeDepartProxy, playTileDeparture,
} from '@/client/console/tilePlacement/tilePlacementDirector';
import {
  runResourceTransfers, abortResourceTransfers, beginPanelRewardHold, releasePanelRewardHold, clearPanelRewardHold,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  TransferPoint, transferWaveDelayMs, TRANSFER_CONCURRENT_PACE,
} from '@/client/console/resourceTransfer/resourceTransferModel';
import {isBoardCardBonusActive} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {snapPlanetFocusSettled} from '@/client/console/planetFocus';

export type BonusProxy = {
  id: number,
  /** The board sprite suffix (`board-space-bonus--<icon>`). */
  icon: string,
  /** The printed icon's LIVE rect, captured while the cell was uncovered. */
  rect: TileRect,
};

/**
 * ONE paying Ares neighbour, ready to be staged: where the tile's wake
 * pulses, where its chip is born, and which way the shared edge faces. The
 * same shoreline geometry as the ocean beat — a different answer (warm
 * infrastructure, not water), the same physical language.
 */
export type AresSourceWake = {
  id: number,
  /** The chip's birth point — just inside the paying tile, lifted. */
  at: TransferPoint,
  /** The wake pulse's centre — nearer the shared edge. */
  pulseAt: TransferPoint,
  /** The pulse's box size (proportional to the source hex, never fixed px). */
  pulseSize: number,
  /** Unit vector source tile → placed tile (the light drifts along it). */
  shore: TransferPoint,
  /** How far back into the source tile the pulse's light starts, in px. */
  drift: number,
};

export const tilePlacementState = reactive({
  /** TRUE from arm until finish/abort — the transaction lock. */
  active: false,
  phase: 'idle' as TilePlacementPhase,
  nonce: 0,
  spaceId: '' as string,
  /** Set at detect (server-proven) — drives the proxy's tile art. */
  tileType: undefined as TileType | undefined,
  /** The plain ocean the placed tile landed ON (Ares ocean covers): the
   *  cell keeps painting the water through the flight (the commit is held
   *  anyway) and the touchdown answers with the landing splash. */
  coveredTile: undefined as TileType | undefined,
  /** REMOVE-AND-REPLACE (Kaguya Tech / Lunar Mine Urbanization): the tile the
   *  server took OFF the armed cell before placing on it. Set at detect —
   *  drives the departure proxy's art and, by its presence, the whole opening
   *  beat. Undefined for every ordinary landing. */
  departingTile: undefined as TileType | undefined,
  /** The owner marker standing on that doomed tile — it leaves ON it, so the
   *  proxy carries a twin posed for the live hex. */
  departingCube: undefined as DepartingCubePose | undefined,
  aresExtension: false,
  /** The printed stock-bonus icons that rise + pay out after the commit. */
  bonusProxies: [] as Array<BonusProxy>,
  /** The paying Ares neighbours, staged for the adjacency beat. */
  aresSources: [] as Array<AresSourceWake>,
  reducedMotion: false,
});

/** One-shot claim per response (mirrors the sibling transactions). */
let claimed = false;
let armSafety: number | undefined;
let sceneSafety: number | undefined;
/** Resolves the WaitingFor commit gate (abort must always free it). */
let runResolve: (() => void) | undefined;
/** The printed bonuses the reward beat carries (captured at detect). */
let pendingBonuses: ReadonlyArray<PlacementBonus> = [];
/** The SERVER's ocean-adjacency breakdown for THIS placement (captured at
 *  detect, matched on the armed space) — the ocean beat's manifest. */
let pendingOceanBonus: OceanAdjacencyBonusModel | undefined;
/** The SERVER's Ares adjacency manifest for THIS placement, reduced to the
 *  viewer's own flights (captured + claimed at detect) — the ares beat. */
let pendingAresFlights: ReadonlyArray<AresAdjacencyFlight> = [];
/** The armed hex's live rect (captured at detect — post pan/zoom truth). */
let hexRect: TileRect | undefined;
/** The REAL printed-icon container we blanked under the proxies (the
 *  `con-deal-hold` swap discipline) — restored on abort/finish. */
let heldBonusEl: HTMLElement | undefined;
/** The landed tile's owner (captured at detect) — drives the premium cube
 *  drop after the touchdown (undefined for oceans / neutral tiles). */
let landedColor: Color | undefined;
/** TRUE while the owner cube is explicitly held for THIS transaction —
 *  abort must release it (rest) so a cube can never stay invisible. */
let cubeHeld = false;
/** TRUE once the pre-lift ran — the icons already HOVER over the seated
 *  tile when the reward beat starts (no second rise). */
let bonusesHovering = false;
/** The hold was seeded for THIS transaction (the commit path's one-shot). */
let bonusHoldSeeded = false;
/** The armed pick named a DECLARED remove-and-replace cell (the prompt's
 *  `hiddenTiles` marker). Only such an arm may read a tile→tile diff as a
 *  placement — see `verifyPlacement`. */
let armedReplacing = false;
/** TRUE while THIS transaction is the one hiding the armed cell's tile
 *  (the removal window). Released the moment the new tile paints. */
let clearedCellHeld = false;
/** The printed-icon container we set the one-shot surfacing class on. */
let revealedBonusEl: HTMLElement | undefined;

// ── stage registry (the layer plugs in) ─────────────────────────────────────

type TileStageHandle = {
  els: () => TileStageEls | undefined,
  /** The REMOTE flight's own proxy set (consoleRemotePlacement) — separate
   *  elements so a remote landing can overlap the own transaction's reward
   *  beat without fighting over refs. */
  remoteEls?: () => TileStageEls | undefined,
};
let stage: TileStageHandle | undefined;

export function registerTilePlacementStage(handle: TileStageHandle): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
}

/** The remote-flight proxy set, when the console stage is mounted. */
export function tileStageRemoteEls(): TileStageEls | undefined {
  return stage?.remoteEls?.();
}

// ── predicates ──────────────────────────────────────────────────────────────

export function isTilePlacementActive(): boolean {
  return tilePlacementState.active;
}

/** TRUE while the scene owns the foreground (pad inert, surfaces held).
 *  `armed` deliberately does NOT hold — nothing visual happened yet. */
export function tilePlacementHolding(): boolean {
  const p = tilePlacementState.phase;
  return tilePlacementState.active && p !== 'idle' && p !== 'armed' && p !== 'failed';
}

// The flight + the post-commit reward beat hold the presentation; releases
// the instant the phase drops on end/abort (the scene's completion signal).
registerAnimationHoldSupplier('tile-placement', tilePlacementHolding);

/**
 * Resource rewards of the LIVE placement are still OWED or PAYING OUT —
 * captured at detect, not yet flown (`pending*`), or the reward beat itself
 * is running (`rewarding`). The card-bonus scene reads this (via
 * `rewardPayoutQuiet.concurrentResourcePayout`) to tell "this cover flies
 * CONCURRENTLY with chips" apart from a plain card-only landing — the broad
 * `tilePlacementHolding()` is true through every landing and would slow a
 * card that flies alone.
 */
export function tilePlacementRewardsSettling(): boolean {
  return tilePlacementState.active && (
    tilePlacementState.phase === 'rewarding' ||
    pendingBonuses.length > 0 || pendingOceanBonus !== undefined || pendingAresFlights.length > 0);
}

/**
 * The wave tempo of THIS placement's resource payouts. While the placed
 * cell's card-bonus cover is ALSO in flight (the board-card-bonus scene is
 * live — armed at this very submit), the chips run slightly quicker: the
 * resources stay ahead of the calmer card and land first, so the card's
 * covering surfaces never open over money still in the air (the concurrency
 * contract). A placement with no card keeps the standard tempo — same arcs,
 * same easing, same language either way.
 */
export function tileRewardTransferPace(): number {
  return isBoardCardBonusActive() ? TRANSFER_CONCURRENT_PACE : 1;
}

// ── the lifecycle ───────────────────────────────────────────────────────────

/**
 * ARM (SelectSpace's console-gated submit funnel, BEFORE the POST).
 * Nothing visual happens until the server proves the tile landed on the
 * armed space. Sets `active` synchronously — the input gate closes at once.
 */
export function armTilePlacement(opts: {
  spaceId: string,
  /** The prompt DECLARED this cell a remove-and-replace target (its
   *  `hiddenTiles` names it): the tile standing there is removed before the
   *  new one is placed, so the scene opens with the departure beat. */
  replacing?: boolean,
}): void {
  // A confirm that lands while Planet Focus is still GROWING the board
  // snaps the transition to its settled state NOW — the detect measures the
  // target hex right after the response, and the flight must never aim at
  // a board that is still moving. No-op outside the enter transition.
  snapPlanetFocusSettled();
  clearTimers();
  claimed = false;
  pendingBonuses = [];
  pendingOceanBonus = undefined;
  pendingAresFlights = [];
  hexRect = undefined;
  restoreHeldBonuses();
  releaseClearedCell();
  bonusesHovering = false;
  bonusHoldSeeded = false;
  landedColor = undefined;
  cubeHeld = false;
  armedReplacing = opts.replacing === true;
  tilePlacementState.active = true;
  tilePlacementState.phase = 'armed';
  tilePlacementState.nonce++;
  tilePlacementState.spaceId = opts.spaceId;
  tilePlacementState.tileType = undefined;
  tilePlacementState.coveredTile = undefined;
  tilePlacementState.departingTile = undefined;
  tilePlacementState.departingCube = undefined;
  tilePlacementState.bonusProxies = [];
  tilePlacementState.aresSources = [];
  tilePlacementState.reducedMotion = consoleReducedMotionActive();
  armSafety = window.setTimeout(() => abortTilePlacement(), TILE_ARM_SAFETY_MS);
}

/**
 * DETECT (WaitingFor commit path) — consume the arm exactly once per
 * response. VERIFIES the server actually put a tile on the armed space
 * (empty → tiled; hazards and covered-tile replacements ride their own
 * premium sequences), then CAPTURES the cell's live geometry + printed
 * bonus icons while the cell is still uncovered on the displayed board.
 *
 * `opts.oceanBonus` is the SERVER's own ocean-adjacency breakdown for this
 * response (`thisPlayer.lastOceanBonus`): it is accepted only when it names
 * the space WE armed, so a stale snapshot from an earlier input — or the
 * second tile of a two-tile card — can never mis-attribute a payout.
 */
export function detectTilePlacement(
  prevSpaces: ReadonlyArray<SpaceModel> | undefined,
  newSpaces: ReadonlyArray<SpaceModel> | undefined,
  opts?: {
    aresExtension?: boolean,
    oceanBonus?: OceanAdjacencyBonusModel,
    /** The SERVER's Ares adjacency manifest ring (`game.aresAdjacencyGrants`)
     *  — matched on the armed space + consumed once (`claimAresGrant`). */
    aresGrants?: ReadonlyArray<AresAdjacencyGrantModel>,
    viewerColor?: Color,
  },
): {spaceId: string} | undefined {
  if (!tilePlacementState.active || claimed) {
    return undefined;
  }
  claimed = true;
  if (armSafety !== undefined) {
    window.clearTimeout(armSafety);
    armSafety = undefined;
  }
  const spaceId = tilePlacementState.spaceId;
  const landed = prevSpaces !== undefined && newSpaces !== undefined ?
    verifyPlacement(prevSpaces, newSpaces, spaceId, {replacing: armedReplacing}) : undefined;
  if (landed === undefined) {
    abortTilePlacement();
    return undefined;
  }
  tilePlacementState.tileType = landed.tileType;
  tilePlacementState.coveredTile = landed.covers;
  tilePlacementState.aresExtension = opts?.aresExtension === true;
  landedColor = landed.color;
  // The cell is still UNCOVERED on the displayed board — capture the hex +
  // every printed stock icon's live rect now (post pan/zoom truth). The
  // reward beat replays these exact positions over the placed tile.
  // An OCEAN COVER grants no printed bonuses (the server skipped them:
  // `coveringExistingTile`) — flying them would be a lie about money.
  hexRect = measureBoardHexRect(spaceId);
  const space = prevSpaces !== undefined ? findSpace(prevSpaces, spaceId) : undefined;
  pendingBonuses = landed.covers === undefined && space !== undefined ? placementBonuses(space.bonus) : [];
  if (landed.replaces !== undefined) {
    // A REMOVE-AND-REPLACE cell is the one case where the printed icons are
    // NOT on screen yet: the doomed tile is still standing on them (the
    // server emptied the cell, so they ARE granted — `coveringExistingTile`
    // was false). Their rects are captured by the departure beat instead, the
    // frame after the removal uncovers them; here we only stage what leaves.
    tilePlacementState.departingTile = landed.replaces.tileType;
    tilePlacementState.departingCube = departingCubePose(landed.replaces.color, hexRect);
    tilePlacementState.bonusProxies = [];
  } else {
    tilePlacementState.bonusProxies = captureBonusIcons(spaceId, pendingBonuses);
  }
  const ocean = opts?.oceanBonus;
  pendingOceanBonus = oceanBonusFor(ocean, spaceId);
  // The Ares adjacency manifest: the newest grant CAUSED BY this placement,
  // consumed exactly once per client (the remote scene shares the ledger).
  const grant = latestAresGrantFor(opts?.aresGrants, spaceId);
  pendingAresFlights = grant !== undefined && opts?.viewerColor !== undefined && claimAresGrant(grant.seq) ?
    viewerAresAdjacencyFlights(grant, opts.viewerColor) : [];
  return {spaceId};
}

/**
 * RUN (WaitingFor await) — the PRE-COMMIT half: the tile lifts off the
 * table edge, crosses the board on one carried arc, touches down in the
 * live hex and settles; the REAL board tile paints SILENTLY under the
 * landed proxy (the targeted preview — the generic placement animation
 * stays unarmed). Resolves after seeding the panel reward hold — the
 * caller commits right after, then calls endTilePlacement() on nextTick.
 * NEVER rejects; every failure degrades and the gate can never hang.
 */
export function runTilePlacement(
  prevSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): Promise<void> {
  return new Promise<void>((resolve) => {
    runResolve = resolve;
    sceneSafety = window.setTimeout(() => {
      freeRunGate(); // rAF stall — force the gate open, degrade gracefully
    }, motionMs(TILE_FLIGHT_MS + TILE_SETTLE_MS) + 3000);
    void executeApproach(prevSpaces, newSpaces).finally(() => freeRunGate());
  });
}

async function executeApproach(
  prevSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): Promise<void> {
  if (!tilePlacementState.active) {
    return;
  }
  const departing = tilePlacementState.departingTile !== undefined;
  tilePlacementState.phase = departing ? 'departing' : 'approaching';
  // The removal window closes in the SAME synchronous turn the new tile
  // paints: the cell must never be simultaneously "cleared" and carrying its
  // replacement (that would blank the tile that just landed).
  const paintRealTile = () => {
    releaseClearedCell();
    applySpacePreview(prevSpaces, newSpaces, tilePlacementState.spaceId);
  };

  if (tilePlacementState.reducedMotion || hexRect === undefined || typeof document === 'undefined') {
    // Reduced / unmeasurable: the tile appears in place with a short
    // controlled beat — same commit semantics, no proxies.
    paintRealTile();
    tilePlacementState.phase = 'landed';
    await wait(tilePlacementState.reducedMotion ? TILE_REDUCED_MS : 60);
    return;
  }
  await nextTick(); // the layer mounts the proxy
  if (!tilePlacementState.active) {
    return;
  }
  if (departing) {
    // The doomed tile lifts off and the emptied cell surfaces its printed
    // bonus — the beat that makes "remove yours, place this there" physical.
    await runDeparture(hexRect);
    if (!tilePlacementState.active) {
      return;
    }
    tilePlacementState.phase = 'approaching';
    await nextTick(); // …and the bonus proxies the departure just staged mount
    if (!tilePlacementState.active) {
      return;
    }
  }
  const els = stage?.els();
  const ui = conUiScale();
  if (els === undefined || !placeTileProxy(els, {
    hex: hexRect,
    from: tableSupplyPoint(ui),
  })) {
    paintRealTile();
    tilePlacementState.phase = 'landed';
    await wait(60);
    return;
  }
  const flightMs = motionMs(TILE_FLIGHT_MS);
  if (els.bonusIcons.length > 0) {
    // The "revealed from under the tile" beat: the icon proxies take over
    // the printed icons 1:1 (the REAL ones blank in this same synchronous
    // turn — the swap discipline, no double vision), then the arriving
    // tile DISPLACES them upward — they rise while it descends and HOVER
    // over the seated tile; a bonus is never covered, never pops out from
    // beneath. Fire-and-forget: the rise rides the flight in parallel.
    placeBonusProxies(els.bonusIcons);
    holdRealBonuses();
    bonusesHovering = true;
    playBonusPreLift(els.bonusIcons, {
      delayMs: Math.round(flightMs * BONUS_PRELIFT_START_T),
      riseMs: motionMs(BONUS_RISE_MS),
      hoverPx: Math.round(BONUS_HOVER_PX * ui),
    });
  }
  await playTileFlight(els, {
    hex: hexRect,
    from: tableSupplyPoint(ui),
    uiScale: ui,
    flightMs,
    settleMs: motionMs(TILE_SETTLE_MS),
  });
  if (!tilePlacementState.active) {
    return; // aborted mid-flight — abort already cleaned up
  }
  // Frame-perfect handoff: the REAL tile paints under the settled proxy
  // (identical geometry, silent — the generic entrance stays unarmed),
  // then the proxy dissolves on it. The owner CUBE is held through the
  // handoff (same synchronous block as the colour paint — observeCube
  // respects a phase already in flight) and DROPS once the proxy is gone:
  // tile seats first, then the cube lands on it (the old choreography,
  // now in the hero's language).
  if (landedColor !== undefined) {
    holdCubeForHeroPlacement(tilePlacementState.spaceId as SpaceId);
    cubeHeld = true;
  }
  if (tilePlacementState.coveredTile !== undefined) {
    // The tile landed ON the water — the sea acknowledges the mass with one
    // calm ring while the proxy dissolves onto the committed tile.
    playCoverSplash(els, {hex: hexRect, uiScale: ui, splashMs: motionMs(OCEAN_SPLASH_MS)});
  }
  paintRealTile();
  tilePlacementState.phase = 'landed';
  await nextTick();
  await disposeTileProxy(els, motionMs(110));
  if (cubeHeld && tilePlacementState.active) {
    cubeHeld = false;
    dropCubeForHeroPlacement(tilePlacementState.spaceId as SpaceId);
  }
}

/**
 * THE REMOVAL (the opening beat of a remove-and-replace placement).
 *
 * Choreography, in the project's own physical grammar:
 *   1. a proxy of the doomed tile is posed 1:1 over it and the REAL cell is
 *      blanked in that same synchronous turn (the `con-deal-hold` swap
 *      discipline) — nothing is seen to change, but from now on the cell
 *      underneath is a bare hex WITH its printed bonuses;
 *   2. the owner marker is held: it leaves ON the tile it was marking, so the
 *      proxy carries the twin and the cell keeps none;
 *   3. those printed icons' rects are captured (they exist only now — the
 *      reward beat at the end replays these exact positions);
 *   4. the tile UNSEATS and rises away while the bonus it was standing on
 *      SURFACES underneath it (a one-shot CSS reveal, started partway into
 *      the lift so it reads as uncovered BY the departure);
 *   5. one calm breath on the cleared cell — then the ordinary flight brings
 *      the replacement in, exactly as for any empty hex.
 *
 * Degrades at every step: a missing stage still clears the cell and captures
 * the icons, so the landing + reward beat are never lost — only the lift is.
 */
async function runDeparture(hex: TileRect): Promise<void> {
  const spaceId = tilePlacementState.spaceId;
  const els = stage?.els();
  const posed = els !== undefined && placeDepartProxy(els, hex);
  holdClearedCell();
  if (tilePlacementState.departingCube !== undefined) {
    holdCubeForHeroPlacement(spaceId as SpaceId);
    cubeHeld = true;
  }
  await nextTick(); // the cell repaints as a bare hex — its icons exist now
  if (!tilePlacementState.active) {
    return;
  }
  tilePlacementState.bonusProxies = captureBonusIcons(spaceId, pendingBonuses);
  if (!posed || els === undefined) {
    return; // no lift to play; the cell is cleared and the landing follows
  }
  const departMs = motionMs(TILE_DEPART_MS);
  revealClearedBonuses(Math.round(departMs * TILE_DEPART_REVEAL_T));
  await playTileDeparture(els, {
    hex,
    liftPx: departureLiftPx(hex),
    departMs,
    fadeAt: TILE_DEPART_FADE_T,
    tiltDeg: TILE_DEPART_TILT_DEG,
    scale: TILE_DEPART_SCALE,
  });
  if (!tilePlacementState.active) {
    return;
  }
  await wait(motionMs(TILE_DEPART_BREATH_MS));
}

/**
 * Seed the PANEL REWARD HOLD for the cell's printed bonuses AND the ocean
 * adjacency M€ — the caller MUST
 * call this in the SAME SYNCHRONOUS BLOCK as `updatePlayerView` (WaitingFor's
 * commit path), never from inside the flight's promise chain: the panel shows
 * `committed − held`, so seeding a micro-task early lets Vue flush a frame
 * where the value is still the PRE-commit number minus the reward — an honest
 * but PHANTOM −N chip, immediately undone by the commit. Same block ⇒ one
 * transition (pre-reward → pre-reward: no chip), and the only real one is the
 * release at each chip's touchdown → +N.
 *
 * Idempotent; a no-op for a bonus-less cell / reduced motion (the honest
 * defaults — those chips ride the commit).
 */
export function seedTilePlacementRewardHold(): void {
  if (!tilePlacementState.active || bonusHoldSeeded ||
      (pendingBonuses.length === 0 && pendingOceanBonus === undefined && pendingAresFlights.length === 0)) {
    return;
  }
  if (tilePlacementState.reducedMotion) {
    pendingBonuses = [];
    pendingOceanBonus = undefined;
    pendingAresFlights = [];
    return;
  }
  bonusHoldSeeded = true;
  const specs = pendingBonuses.map((b) => b.spec);
  if (pendingOceanBonus !== undefined) {
    // ONE hold entry for the whole ocean payout (the map is keyed by resource
    // and additive, so this composes with a printed M€ bonus). It is released
    // in ONE go at the LAST coin's touchdown — which is exactly what makes the
    // delta chip read «+6 M€», not three separate «+2 M€».
    specs.push({channel: 'stock', resource: 'megacredits', amount: pendingOceanBonus.megacredits});
  }
  // The Ares adjacency flights release per chip — each paying tile's own
  // touchdown ticks its own metric (the neighbourhood pays tile by tile).
  specs.push(...pendingAresFlights.map((f) => f.spec));
  beginPanelRewardHold(specs);
}

/**
 * END (next tick, after the view committed) — the REWARD BEAT: the cell's
 * printed icons rise through the placed tile from their exact captured
 * positions, materialize into physical resource chips (the shared
 * framework, per-icon origins) and pay out onto the panel — each
 * touchdown releases its metric, firing that delta chip at the contact.
 * A bonus-less placement finishes IMMEDIATELY — not one extra frame.
 */
export async function endTilePlacement(): Promise<void> {
  if (!tilePlacementState.active) {
    return;
  }
  const bonuses = pendingBonuses;
  const ocean = pendingOceanBonus;
  const aresFlights = pendingAresFlights;
  pendingBonuses = [];
  pendingOceanBonus = undefined;
  pendingAresFlights = [];
  if (tilePlacementState.reducedMotion || (bonuses.length === 0 && ocean === undefined && aresFlights.length === 0)) {
    finish();
    return;
  }
  tilePlacementState.phase = 'rewarding';
  // The payouts of one placement run in SEQUENCE, never on top of each
  // other: what the CELL was printed with, then what the NEIGHBOURING WATER
  // pays, then what the NEIGHBOURING TILES pay (the Ares adjacency beat).
  // Each awaits its own touchdowns (not the absorb tail), so the next
  // beat starts while the previous chips are still being absorbed —
  // continuous, not queued.
  if (bonuses.length > 0) {
    await runPrintedBonusBeat(bonuses);
  }
  if (ocean !== undefined && tilePlacementState.active) {
    await runOceanBonusBeat(ocean);
  }
  if (aresFlights.length > 0 && tilePlacementState.active) {
    await runAresAdjacencyBeat(aresFlights);
  }
  // Belt-and-braces: any hold a degraded transfer left behind snaps to the
  // committed truth now (its chip fires marginally late, never lost).
  clearPanelRewardHold();
  finish();
}

/**
 * The PRINTED-BONUS beat (the cell's own icons). Unchanged behaviour, lifted
 * into its own function so the ocean beat can follow it.
 */
async function runPrintedBonusBeat(bonuses: ReadonlyArray<PlacementBonus>): Promise<void> {
  const els = stage?.els();
  const ui = conUiScale();
  const hoverPx = Math.round(BONUS_HOVER_PX * ui);
  // The icons ALREADY hover over the seated tile (displaced during the
  // approach) — each chip is born exactly at its hover point, and the icon
  // dissolves under it on the same wave stagger (the handoff): one
  // continuous printed-icon → physical-chip materialization.
  const origins: Array<TransferPoint | undefined> = bonuses.map((b) => {
    const proxy = tilePlacementState.bonusProxies.find((p) => p.id === b.bonusIndex);
    if (proxy === undefined) {
      return hexRect !== undefined ?
        {x: hexRect.x + hexRect.w / 2, y: hexRect.y + hexRect.h / 2 - hoverPx} : undefined;
    }
    return {x: proxy.rect.x + proxy.rect.w / 2, y: proxy.rect.y + proxy.rect.h / 2 - hoverPx};
  });
  // One calm breath: the player reads the bonuses hovering over the placed
  // tile (the commit just ticked the non-held metrics), then the wave goes.
  await wait(motionMs(BONUS_HANDOFF_BREATH_MS));
  if (!tilePlacementState.active) {
    return;
  }
  if (els !== undefined && bonusesHovering) {
    playBonusHandoff(els.bonusIcons, {count: bonuses.length});
  }
  await runResourceTransfers({
    specs: bonuses.map((b) => b.spec),
    origins,
    source: {point: hexRect !== undefined ?
      {x: hexRect.x + hexRect.w / 2, y: hexRect.y + hexRect.h / 2} : undefined},
    arrival: 'auto',
    pace: tileRewardTransferPace(),
    onArrive: (spec) => releasePanelRewardHold(spec),
  });
}

/**
 * The OCEAN ADJACENCY beat — "I built next to water, so THAT water paid me".
 *
 * The choreography itself is SHARED (`oceanAdjacencyBeat.ts`): the very same
 * water pays a Mars Nomads camp that merely MOVES onto the cell, so the two
 * scenes must play one animation, not two dialects of it. This is the tile
 * scene's half of the contract — its rect, its liveness, its hold release.
 */
async function runOceanBonusBeat(bonus: OceanAdjacencyBonusModel): Promise<void> {
  const tileRect = hexRect ?? measureBoardHexRect(tilePlacementState.spaceId);
  if (tileRect === undefined) {
    releasePanelRewardHold({channel: 'stock', resource: 'megacredits', amount: bonus.megacredits});
    return;
  }
  await runOceanAdjacencyBeat({
    bonus,
    tileRect,
    uiScale: conUiScale(),
    pace: tileRewardTransferPace(),
    alive: () => tilePlacementState.active,
    // ONE aggregated release: the counter moves after the money has physically
    // arrived and announces «+2/+4/+6 M€» once — the individual sources are
    // told by the coins themselves.
    release: () => releasePanelRewardHold(
      {channel: 'stock', resource: 'megacredits', amount: bonus.megacredits}),
  });
}

/**
 * The ARES ADJACENCY beat — "the neighbourhood answers the new tile".
 *
 * The server already granted everything and already named WHICH tile paid
 * WHAT to WHOM (`AresAdjacencyGrantModel`); this only stages the viewer's
 * own flights. Per paying tile: the shared edge WAKES (the same shoreline
 * pulse language as the ocean beat, in the tile's warm register — printed
 * infrastructure answering, not water), and the chip is born just inside
 * that tile, riding the shared Resource Transfer Framework onto the exact
 * panel zone — stock rows, or the single eligible card for an animal /
 * microbe. Each chip's touchdown releases its own metric.
 *
 * Degrades honestly at every step: an unmeasurable source tile flies its
 * chip from the placed tile itself; no stage at all releases the holds and
 * the reward is announced by its delta chips alone.
 */
async function runAresAdjacencyBeat(flights: ReadonlyArray<AresAdjacencyFlight>): Promise<void> {
  const releaseAll = () => flights.forEach((f) => releasePanelRewardHold(f.spec));
  const ui = conUiScale();
  const tileRect = hexRect ?? measureBoardHexRect(tilePlacementState.spaceId);
  if (tileRect === undefined || typeof document === 'undefined') {
    releaseAll();
    return;
  }
  // One wave stagger for pulses AND chips — index-aligned per FLIGHT, so a
  // tile's wake and its chip always share a launch beat (both sides carry
  // the same concurrent pace, or the wakes would outlive their chips).
  const pace = tileRewardTransferPace();
  const delays = flights.map((_, i) => Math.round(motionMs(transferWaveDelayMs(i, flights.length)) * pace));
  const lift = Math.round(OCEAN_COIN_LIFT_PX * ui);
  const wakes: Array<AresSourceWake> = [];
  const pulseDelays: Array<number> = [];
  const origins: Array<TransferPoint | undefined> = flights.map((f, i) => {
    const rect = measureBoardHexRect(f.sourceSpaceId);
    if (rect === undefined) {
      return undefined; // chip falls back to the placed tile — money never lost
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

  // One calm breath after the previous beat, then the neighbourhood answers.
  await wait(motionMs(OCEAN_BEAT_BREATH_MS));
  if (!tilePlacementState.active) {
    releaseAll();
    return;
  }
  tilePlacementState.aresSources = wakes;
  await nextTick(); // the layer mounts the wake pulses
  const els = stage?.els();
  if (els !== undefined && els.aresPulses.length === wakes.length && wakes.length > 0) {
    playAresSourcePulses(els.aresPulses, {
      delays: pulseDelays,
      shores: wakes.map((w) => w.shore),
      drifts: wakes.map((w) => w.drift),
      pulseMs: motionMs(OCEAN_PULSE_MS),
    });
    await wait(Math.round(motionMs(ARES_WAVE_LEAD_MS) * pace));
    if (!tilePlacementState.active) {
      tilePlacementState.aresSources = [];
      releaseAll();
      return;
    }
  }
  await runResourceTransfers({
    specs: flights.map((f) => f.spec),
    origins,
    source: {point: {x: tileRect.x + tileRect.w / 2, y: tileRect.y + tileRect.h / 2}},
    arrival: 'auto',
    pace,
    onArrive: (spec) => releasePanelRewardHold(spec),
  });
  tilePlacementState.aresSources = [];
}

/**
 * ABORT — refused placement, network failure, safety timer, unmount. Drops
 * the stage, the pending bonuses and any seeded hold; frees the commit
 * gate; flags `failed` for one flush. The board itself was never touched
 * before server proof, so there is nothing to restore.
 */
export function abortTilePlacement(): void {
  if (!tilePlacementState.active && runResolve === undefined) {
    return;
  }
  clearTimers();
  const els = stage?.els();
  if (els !== undefined) {
    killTileTweens(els);
  }
  abortResourceTransfers();
  abortOceanBeat(); // …and the shared water beat this placement may have staged
  clearPanelRewardHold();
  restoreHeldBonuses(); // the printed icons un-blank — the field is intact
  // …and a removal caught mid-lift puts the doomed tile back: the server may
  // have refused the placement, in which case that tile is still standing.
  releaseClearedCell();
  if (cubeHeld) {
    // The tile was already painted when the cube was held — show the cube
    // at rest (no drop beat) rather than leaving it stranded invisible.
    cubeHeld = false;
    restCubeForHeroPlacement(tilePlacementState.spaceId as SpaceId);
  }
  bonusesHovering = false;
  bonusHoldSeeded = false;
  pendingBonuses = [];
  pendingOceanBonus = undefined;
  pendingAresFlights = [];
  hexRect = undefined;
  armedReplacing = false;
  tilePlacementState.active = false;
  tilePlacementState.phase = 'failed';
  tilePlacementState.bonusProxies = [];
  tilePlacementState.aresSources = [];
  freeRunGate();
  void nextTick(() => {
    if (tilePlacementState.phase === 'failed') {
      tilePlacementState.phase = 'idle';
      tilePlacementState.spaceId = '';
      tilePlacementState.tileType = undefined;
      tilePlacementState.coveredTile = undefined;
      tilePlacementState.departingTile = undefined;
      tilePlacementState.departingCube = undefined;
    }
  });
}

function finish(): void {
  clearTimers();
  clearPanelRewardHold(); // safety — the reward beat leaves it empty
  // Un-blank the printed icons: the placed tile's art covers them on the
  // real board anyway (same as every pre-existing tile) — invisible swap.
  restoreHeldBonuses();
  // Belt-and-braces: the removal window normally closes at the handoff paint.
  releaseClearedCell();
  if (cubeHeld) {
    // Belt-and-braces: the drop normally fires at the proxy handoff.
    cubeHeld = false;
    dropCubeForHeroPlacement(tilePlacementState.spaceId as SpaceId);
  }
  bonusesHovering = false;
  bonusHoldSeeded = false;
  pendingBonuses = [];
  pendingOceanBonus = undefined;
  pendingAresFlights = [];
  hexRect = undefined;
  armedReplacing = false;
  tilePlacementState.active = false;
  tilePlacementState.phase = 'done';
  tilePlacementState.bonusProxies = [];
  tilePlacementState.aresSources = [];
  void nextTick(() => {
    if (tilePlacementState.phase === 'done') {
      tilePlacementState.phase = 'idle';
      tilePlacementState.spaceId = '';
      tilePlacementState.tileType = undefined;
      tilePlacementState.coveredTile = undefined;
      tilePlacementState.departingTile = undefined;
      tilePlacementState.departingCube = undefined;
    }
  });
}

// ── internals ───────────────────────────────────────────────────────────────

/** The neutral table-edge supply every OWN placement source shares (the
 *  same bottom-centre geography as the sale terminal / the player zone).
 *  Exported for the remote scene's "own tile without a SelectSpace" case
 *  (an auto-placed reserved-slot city) — same departure, same provenance. */
export function tableSupplyPoint(uiScale: number): TransferPoint {
  return {
    x: window.innerWidth / 2,
    y: window.innerHeight - Math.round(96 * uiScale),
  };
}

function escapeId(id: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(id) : id.replace(/"/g, '\\"');
}

/** The armed cell's printed-icon container (present only while the cell
 *  reads as empty — an occupied cell renders no bonuses at all). */
function bonusContainerEl(): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  return document.querySelector<HTMLElement>(
    `.board-space[data_space_id="${escapeId(tilePlacementState.spaceId)}"] .board-space-bonuses`);
}

/** Blank the REAL printed-icon container the same synchronous turn the
 *  proxies stand over it (the shared `con-deal-hold` swap discipline) —
 *  the takeover is 1:1, never a double vision. */
function holdRealBonuses(): void {
  const el = bonusContainerEl();
  if (el !== null) {
    heldBonusEl = el;
    el.classList.add('con-deal-hold');
  }
}

function restoreHeldBonuses(): void {
  heldBonusEl?.classList.remove('con-deal-hold');
  heldBonusEl = undefined;
}

/**
 * THE REMOVAL WINDOW. `placementRenderState.hiddenTiles` is the board's own
 * "this cell renders WITHOUT its tile graphic, with its placement bonus
 * instead" switch, and this transaction is its ONE owner: it opens the window
 * as the doomed tile's proxy takes over and closes it in the same synchronous
 * turn the replacement paints. (It also silences the generic placement chrome
 * on that cell — `BoardSpaceTile.refreshPlacement` reads the module state
 * directly — so no ring can flash over an apparently-empty hex.)
 */
function holdClearedCell(): void {
  clearedCellHeld = true;
  setPlacementHiddenTiles([tilePlacementState.spaceId as SpaceId]);
}

function releaseClearedCell(): void {
  clearBonusReveal();
  if (!clearedCellHeld) {
    return;
  }
  clearedCellHeld = false;
  clearPlacementHiddenTiles();
}

/** The uncovered bonus SURFACES (one-shot CSS, started partway into the lift
 *  — see `.board-space-bonuses.con-tileplace-reveal`). Applied AFTER the
 *  rects are captured: the keyframe scales the container, and a mid-animation
 *  `getBoundingClientRect` would hand the reward beat a shrunken origin. */
function revealClearedBonuses(delayMs: number): void {
  const el = bonusContainerEl();
  if (el === null) {
    return;
  }
  revealedBonusEl = el;
  el.style.setProperty('--con-tileplace-reveal-delay', `${delayMs}ms`);
  el.classList.add('con-tileplace-reveal');
}

function clearBonusReveal(): void {
  revealedBonusEl?.classList.remove('con-tileplace-reveal');
  revealedBonusEl?.style.removeProperty('--con-tileplace-reveal-delay');
  revealedBonusEl = undefined;
}

/** The live rect of a board hex (post pan/zoom truth) — shared with the
 *  remote-placement scene (consoleRemotePlacement). */
export function measureBoardHexRect(spaceId: string): TileRect | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const el = document.querySelector<HTMLElement>(`.board-space[data_space_id="${escapeId(spaceId)}"]`);
  if (el === null) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  return r.width > 8 && r.height > 8 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

/** The printed icons' LIVE rects, index-aligned with `space.bonus` (the
 *  board renders one `.board-space-bonus` per entry, in order). Captured
 *  BEFORE the tile covers them — the reward beat replays these positions. */
function captureBonusIcons(spaceId: string, bonuses: ReadonlyArray<PlacementBonus>): Array<BonusProxy> {
  if (typeof document === 'undefined' || bonuses.length === 0) {
    return [];
  }
  const icons = document.querySelectorAll<HTMLElement>(
    `.board-space[data_space_id="${escapeId(spaceId)}"] .board-space-bonus`);
  const out: Array<BonusProxy> = [];
  for (const b of bonuses) {
    if (b.icon === undefined) {
      continue; // no printed sprite (Ares M€) — hex-centre origin fallback
    }
    const el = icons[b.bonusIndex];
    if (el === undefined) {
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width > 3 && r.height > 3) {
      out.push({id: b.bonusIndex, icon: b.icon, rect: {x: r.left, y: r.top, w: r.width, h: r.height}});
    }
  }
  return out;
}

function freeRunGate(): void {
  if (sceneSafety !== undefined) {
    window.clearTimeout(sceneSafety);
    sceneSafety = undefined;
  }
  const r = runResolve;
  runResolve = undefined;
  r?.();
}

function clearTimers(): void {
  if (armSafety !== undefined) {
    window.clearTimeout(armSafety);
    armSafety = undefined;
  }
  if (sceneSafety !== undefined) {
    window.clearTimeout(sceneSafety);
    sceneSafety = undefined;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
