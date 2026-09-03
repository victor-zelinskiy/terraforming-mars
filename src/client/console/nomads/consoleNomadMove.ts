/*
 * CONSOLE MARS NOMADS MOVE — the animation TRANSACTION behind Flow B of the
 * nomad choreography: the camp module physically lifts off its cell (its
 * contact shadow stays on the surface and lets go), hops to the adjacent
 * hex on one tall carried arc, DISPLACES the destination's printed bonuses
 * on its approach, seats — and the bonuses are collected through the SHARED
 * premium flows (stock chips ride the Resource Transfer Framework onto the
 * exact rail zones; a card bonus rides the board-card-bonus cover scene) —
 * after which the printed icons MATERIALIZE BACK onto the field, because
 * the rules never exhaust the cell.
 *
 * The gate follows the tile-placement hero contract 1:1:
 *
 *   ConsoleBoardInput ARMS at the space submit — ONLY for a prompt the
 *   server itself declared `placementEffect: 'bonus-only'` (Mars Nomads'
 *   move is the only producer). The transport DETECTS once per response
 *   (verify from→to on the authoritative diff — a refusal unwinds with
 *   zero trace), CAPTURES the live geometry + the destination's printed
 *   stock icons, HOLDS the commit through lift + hop + touchdown (the real
 *   destination token paints silently under the settled proxy via the
 *   targeted preview + the marker baseline pre-adoption), SEEDS the panel
 *   reward hold in the commit's own synchronous block, COMMITS, and
 *   endNomadMove() plays the post-commit reward + restore beats.
 *
 * REMOTE moves (another player's move — and an UNDO of a move, which is
 * honestly the camp walking back) are POST-COMMIT REVEAL, the remote-tile
 * design: staged in the same synchronous block as the commit — the source
 * cell keeps a GHOST token, the destination commits HIDDEN — then the
 * proxy flies and the committed token reveals at its touchdown. No reward
 * or restore beat there: the viewer's counters never move for a foreign
 * payout, and the destination's icons are never touched.
 *
 * FIRST PLACEMENT is deliberately NOT here — it is Flow A, a plain marker
 * LANDING with no reward of any kind (markerPlacementAnimation + the
 * NomadToken landing keyframes). Never detect the two apart by DOM or by
 * resource deltas: the server's `placementEffect` marker is the authority.
 *
 * DESKTOP SAFETY: arming is console-gated at the binder; the remote
 * staging gates on `consoleModeState.enabled` — desktop keeps its exact
 * historical behaviour (the flag flips reactively).
 */

import {reactive, nextTick} from 'vue';
import {SpaceId} from '@/common/Types';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceModel} from '@/common/models/SpaceModel';
import {Phase} from '@/common/Phase';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleModeState} from '@/client/console/consoleModeState';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {adoptMarkerSilently, forgetMarkerSilently} from '@/client/components/board/markerPlacementAnimation';
import {
  NomadMovePhase, NomadMoveDiff,
  detectNomadMoveDiff, verifyNomadMove, nomadMoveBonuses, applyNomadMovePreview,
  nomadAnchorOf, nomadSizeOf,
  NOMAD_LIFT_MS, NOMAD_FLIGHT_MS, NOMAD_SETTLE_MS, NOMAD_REDUCED_MS, NOMAD_ARM_SAFETY_MS,
  NOMAD_PRELIFT_START_T, NOMAD_BONUS_RISE_MS, NOMAD_BONUS_HOVER_PX, NOMAD_HANDOFF_BREATH_MS,
  NOMAD_RESTORE_MS, NOMAD_RESTORE_STAGGER_MS, NOMAD_RESTORE_BREATH_MS,
} from '@/client/console/nomads/nomadMoveModel';
import {
  NomadStageEls, placeNomadProxy, playNomadFlight, disposeNomadProxy, killNomadTweens,
} from '@/client/console/nomads/nomadMoveDirector';
import {
  placeBonusProxies, playBonusPreLift, playBonusHandoff,
} from '@/client/console/tilePlacement/tilePlacementDirector';
import {
  BonusProxy, measureBoardHexRect,
} from '@/client/console/tilePlacement/consoleTilePlacement';
import {
  abortOceanBeat, oceanBonusFor, runOceanAdjacencyBeat,
} from '@/client/console/tilePlacement/oceanAdjacencyBeat';
import {OceanAdjacencyBonusModel} from '@/common/models/OceanAdjacencyBonusModel';
import {boardCovered} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {PlacementBonus, TileRect, findSpace} from '@/client/console/tilePlacement/tilePlacementModel';
import {
  runResourceTransfers, abortResourceTransfers, beginPanelRewardHold, releasePanelRewardHold, clearPanelRewardHold,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {armBoardCardBonus} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {snapPlanetFocusSettled} from '@/client/console/planetFocus';

/** A queued remote hop can wait for a covered board — far past this,
 *  something stalled and the committed truth must show. */
const NOMAD_REMOTE_SAFETY_MS = 15000;
/** How long a remote hop will wait for a board the player can see. */
const NOMAD_BOARD_WAIT_MAX_MS = 20000;
/** …and the settle breath after the board comes back. */
const NOMAD_BOARD_SETTLE_MS = 320;

export const nomadMoveState = reactive({
  /** TRUE from arm until finish/abort — the OWN transaction lock. */
  active: false,
  phase: 'idle' as NomadMovePhase,
  nonce: 0,
  fromId: '' as string,
  toId: '' as string,
  /** The destination's printed stock icons (displaced + collected + restored). */
  bonusProxies: [] as Array<BonusProxy>,
  /** The flying proxy's footprint (px) — the layer sizes the token from it. */
  tokenSizePx: 18,
  reducedMotion: false,
  /** TRUE while a REMOTE hop's proxy is on stage (drives the layer). */
  remoteActive: false,
  /** TRUE while the remote queue merely waits for a watchable board —
   *  a parked queue is NOT an animation (the remote-tile lesson). */
  remoteWaiting: false,
});

/** Destination cells whose committed token is HELD hidden until its remote
 *  proxy's touchdown (BoardSpace render-gates on this). */
const hiddenCells = reactive(new Set<SpaceId>());
/** Source cells that keep painting a GHOST token after the commit removed
 *  the flag — object permanence while the remote hop waits its turn. */
const ghostCells = reactive(new Set<SpaceId>());

export function nomadCellHidden(id: SpaceId): boolean {
  return hiddenCells.has(id);
}

export function nomadGhostAt(id: SpaceId): boolean {
  return ghostCells.has(id);
}

// ── own-transaction internals ───────────────────────────────────────────────

/** One-shot claim per response (mirrors the sibling transactions). */
let claimed = false;
let armSafety: number | undefined;
let sceneSafety: number | undefined;
let preLiftTimer: number | undefined;
let restoreTimer: number | undefined;
/** Resolves the transport commit gate (abort must always free it). */
let runResolve: (() => void) | undefined;
/** The printed bonuses the reward beat carries (captured at detect). */
let pendingBonuses: ReadonlyArray<PlacementBonus> = [];
/**
 * The SERVER's ocean-adjacency breakdown for THIS hop (captured at detect,
 * matched on the destination). The camp collects the destination's placement
 * bonus «as if placing a special tile there», and `grantPlacementBonuses`
 * computes ocean adjacency for EVERY such grant — no tile required. So the
 * water pays a moving camp exactly as it pays a build, and it must be the
 * SAME beat (`oceanAdjacencyBeat`), never a silent counter tick.
 */
let pendingOceanBonus: OceanAdjacencyBonusModel | undefined;
/** The destination hex's live rect (captured at detect). */
let destHexRect: TileRect | undefined;
/** The source hex's live rect (captured at detect). */
let srcHexRect: TileRect | undefined;
/** TRUE when the destination prints a DRAW_CARD bonus whose icon is live in
 *  the DOM — the board-card-bonus cover scene is armed at the PRE-LIFT
 *  moment (the cover separates exactly as the arriving module displaces
 *  the cell), never at submit. */
let cardBonusPending = false;
/** The REAL board token element hidden under the proxy (swap discipline). */
let heldTokenEl: HTMLElement | undefined;
/** The REAL printed-icon container blanked under the bonus proxies. */
let heldBonusEl: HTMLElement | undefined;
/** …and the container the RESTORE beat re-materializes (kept past the
 *  blank so abort can strip the one-shot class deterministically). */
let restoreEl: HTMLElement | undefined;
let bonusesHovering = false;
let bonusHoldSeeded = false;

// ── stage registry (the layer plugs in) ─────────────────────────────────────

type NomadStageHandle = {
  els: () => NomadStageEls | undefined,
};
let stage: NomadStageHandle | undefined;

export function registerNomadStage(handle: NomadStageHandle): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
}

// ── predicates ──────────────────────────────────────────────────────────────

export function isNomadMoveActive(): boolean {
  return nomadMoveState.active;
}

/** TRUE while the OWN scene owns the foreground (pad inert, surfaces held).
 *  `armed` deliberately does NOT hold — nothing visual happened yet. */
export function nomadMoveHolding(): boolean {
  const p = nomadMoveState.phase;
  return nomadMoveState.active && p !== 'idle' && p !== 'armed' && p !== 'failed';
}

/** TRUE while a REMOTE hop is presenting (proxy on stage or a queue that is
 *  actually runnable). ⚠ The REACTIVE terms come first — this is a hold
 *  supplier predicate polled through a Vue watch (the remote-tile lesson:
 *  a non-reactive first term orphans the watcher's dependency). */
export function isRemoteNomadMoveActive(): boolean {
  return nomadMoveState.remoteActive ||
    (!nomadMoveState.remoteWaiting && remoteQueue.length > 0);
}

// ── the OWN lifecycle ───────────────────────────────────────────────────────

/**
 * ARM (ConsoleBoardInput's submit funnel, BEFORE the POST) — only for a
 * `placementEffect: 'bonus-only'` prompt. Nothing visual happens until the
 * server proves the camp moved onto the armed space.
 */
export function armNomadMove(opts: {toSpaceId: string}): void {
  // A confirm mid-Planet-Focus-growth settles the board FIRST — the detect
  // measures both hexes right after the response (same rule as the tile arm).
  snapPlanetFocusSettled();
  clearTimers();
  clearRestoreTimer();
  stripRestoreClass(); // a previous move's one-shot class must not survive
  claimed = false;
  pendingBonuses = [];
  pendingOceanBonus = undefined;
  destHexRect = undefined;
  srcHexRect = undefined;
  cardBonusPending = false;
  restoreHeldToken();
  restoreHeldBonuses();
  bonusesHovering = false;
  bonusHoldSeeded = false;
  nomadMoveState.active = true;
  nomadMoveState.phase = 'armed';
  nomadMoveState.nonce++;
  nomadMoveState.fromId = '';
  nomadMoveState.toId = opts.toSpaceId;
  nomadMoveState.bonusProxies = [];
  nomadMoveState.reducedMotion = consoleReducedMotionActive();
  armSafety = window.setTimeout(() => abortNomadMove(), NOMAD_ARM_SAFETY_MS);
}

/**
 * DETECT (transport commit path) — consume the arm exactly once per
 * response. VERIFIES the server moved the camp onto the armed space (the
 * from→to diff), then CAPTURES both hexes' live geometry + the
 * destination's printed stock icons while the displayed board still shows
 * the pre-move state.
 */
export function detectNomadMove(
  prevSpaces: ReadonlyArray<SpaceModel> | undefined,
  newSpaces: ReadonlyArray<SpaceModel> | undefined,
  opts?: {
    /** The SERVER's own ocean-adjacency breakdown for this response
     *  (`thisPlayer.lastOceanBonus`) — accepted only when it names the
     *  destination WE armed, so a stale snapshot can never mis-attribute. */
    oceanBonus?: OceanAdjacencyBonusModel,
  },
): NomadMoveDiff | undefined {
  if (!nomadMoveState.active || claimed) {
    return undefined;
  }
  claimed = true;
  if (armSafety !== undefined) {
    window.clearTimeout(armSafety);
    armSafety = undefined;
  }
  const diff = prevSpaces !== undefined && newSpaces !== undefined ?
    verifyNomadMove(prevSpaces, newSpaces, nomadMoveState.toId) : undefined;
  if (diff === undefined) {
    abortNomadMove();
    return undefined;
  }
  nomadMoveState.fromId = diff.fromId;
  srcHexRect = measureBoardHexRect(diff.fromId);
  destHexRect = measureBoardHexRect(diff.toId);
  const destination = findSpace(prevSpaces ?? [], diff.toId);
  pendingBonuses = nomadMoveBonuses(destination);
  nomadMoveState.bonusProxies = captureBonusIcons(diff.toId, pendingBonuses);
  // …and what the NEIGHBOURING WATER paid for the same move. Ocean adjacency
  // is granted whether or not a tile lands (`Game.grantPlacementBonuses`),
  // so the camp earns it — and it gets the same coins the tile hero flies.
  pendingOceanBonus = oceanBonusFor(opts?.oceanBonus, diff.toId);
  // The card-draw bonus keeps ITS OWN premium scene (the cover lift): flag
  // it now, arm it at the pre-lift moment so the cover separates exactly
  // when the arriving module displaces the cell's bonuses.
  cardBonusPending = destination !== undefined && destination.tileType === undefined &&
    destination.bonus.includes(SpaceBonus.DRAW_CARD) && cardIconLive(diff.toId);
  return diff;
}

/**
 * RUN (transport await) — the PRE-COMMIT half: lift-off → the hop arc →
 * the bonus displacement on approach → touchdown; the REAL destination
 * token paints SILENTLY under the settled proxy (marker baseline
 * pre-adopted + the targeted preview). Resolves at rest — the caller
 * seeds the reward hold and commits right after, then calls endNomadMove()
 * on nextTick. NEVER rejects; every failure degrades and the gate can
 * never hang.
 */
export function runNomadMove(
  prevSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): Promise<void> {
  return new Promise<void>((resolve) => {
    runResolve = resolve;
    sceneSafety = window.setTimeout(() => {
      freeRunGate(); // rAF stall — force the gate open, degrade gracefully
    }, motionMs(NOMAD_LIFT_MS + NOMAD_FLIGHT_MS + NOMAD_SETTLE_MS) + 3000);
    void executeHop(prevSpaces, newSpaces).finally(() => freeRunGate());
  });
}

async function executeHop(
  prevSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): Promise<void> {
  if (!nomadMoveState.active) {
    return;
  }
  nomadMoveState.phase = 'approaching';
  const diff: NomadMoveDiff = {fromId: nomadMoveState.fromId as SpaceId, toId: nomadMoveState.toId as SpaceId};
  const paintRealMove = () => {
    // Pre-adopt BOTH cells in the marker baseline so the flag flips are
    // silent even if this response armed the placement window for another
    // landing — then flip the displayed view under the settled proxy.
    adoptMarkerSilently(diff.toId, 'nomads');
    forgetMarkerSilently(diff.fromId, 'nomads');
    applyNomadMovePreview(prevSpaces, newSpaces, diff);
  };

  if (nomadMoveState.reducedMotion || destHexRect === undefined || srcHexRect === undefined ||
      typeof document === 'undefined') {
    // Reduced / unmeasurable: the camp appears on its new cell with a short
    // controlled beat — same commit semantics, no proxies. The result is
    // still explicit: the token changes cells, the commit's own delta chips
    // announce the bonus, the printed icons never leave the field.
    if (cardBonusPending) {
      cardBonusPending = false;
      armBoardCardBonus({kind: 'board-cell', spaceId: diff.toId});
    }
    paintRealMove();
    nomadMoveState.phase = 'landed';
    await wait(nomadMoveState.reducedMotion ? NOMAD_REDUCED_MS : 60);
    return;
  }
  await nextTick(); // the layer mounts the proxy
  if (!nomadMoveState.active) {
    return;
  }
  const els = stage?.els();
  const ui = conUiScale();
  const from = nomadAnchorOf(srcHexRect);
  const to = nomadAnchorOf(destHexRect);
  const sizePx = nomadSizeOf(srcHexRect);
  nomadMoveState.tokenSizePx = sizePx;
  if (els === undefined || !placeNomadProxy(els, {from, to, sizePx, uiScale: ui})) {
    if (cardBonusPending) {
      cardBonusPending = false;
      armBoardCardBonus({kind: 'board-cell', spaceId: diff.toId});
    }
    paintRealMove();
    nomadMoveState.phase = 'landed';
    await wait(60);
    return;
  }
  // The proxy stands pixel-exact over the resting token — hide the real one
  // in this same synchronous turn (the swap discipline, never double vision).
  holdRealToken(diff.fromId);
  const liftMs = motionMs(NOMAD_LIFT_MS);
  const flightMs = motionMs(NOMAD_FLIGHT_MS);
  // THE DISPLACEMENT: as the module bears down, the destination's printed
  // bonuses rise off the surface (the tile hero's shared physical rule) and
  // the card bonus' cover separates on the same beat.
  const preLiftAt = Math.round(liftMs + flightMs * NOMAD_PRELIFT_START_T);
  preLiftTimer = window.setTimeout(() => {
    preLiftTimer = undefined;
    if (!nomadMoveState.active) {
      return;
    }
    if (cardBonusPending) {
      cardBonusPending = false;
      armBoardCardBonus({kind: 'board-cell', spaceId: diff.toId});
    }
    const liveEls = stage?.els();
    if (liveEls !== undefined && liveEls.bonusIcons.length > 0) {
      placeBonusProxies(liveEls.bonusIcons);
      holdRealBonuses(diff.toId);
      bonusesHovering = true;
      playBonusPreLift(liveEls.bonusIcons, {
        delayMs: 0,
        riseMs: motionMs(NOMAD_BONUS_RISE_MS),
        hoverPx: Math.round(NOMAD_BONUS_HOVER_PX * ui),
      });
    }
  }, preLiftAt);
  await playNomadFlight(els, {
    from, to, sizePx, uiScale: ui,
    liftMs,
    flightMs,
    settleMs: motionMs(NOMAD_SETTLE_MS),
  });
  if (!nomadMoveState.active) {
    return; // aborted mid-hop — abort already cleaned up
  }
  // Frame-perfect handoff: the REAL destination token paints under the
  // settled proxy (identical geometry, silent), then the proxy dissolves.
  paintRealMove();
  nomadMoveState.phase = 'landed';
  await nextTick();
  await disposeNomadProxy(els, motionMs(110));
}

/**
 * Seed the PANEL REWARD HOLD for the destination's printed stock bonuses.
 * The caller MUST call this in the SAME SYNCHRONOUS BLOCK as the commit
 * (the transport's seedRewardHolds) — never earlier, or Vue flushes a
 * frame with a phantom −N chip. Idempotent; a no-op for a bonus-less
 * destination / reduced motion (those chips honestly ride the commit).
 */
export function seedNomadMoveRewardHold(): void {
  if (!nomadMoveState.active || bonusHoldSeeded ||
      (pendingBonuses.length === 0 && pendingOceanBonus === undefined)) {
    return;
  }
  if (nomadMoveState.reducedMotion) {
    pendingBonuses = [];
    pendingOceanBonus = undefined;
    return;
  }
  bonusHoldSeeded = true;
  const specs = pendingBonuses.map((b) => b.spec);
  if (pendingOceanBonus !== undefined) {
    // ONE hold entry for the whole ocean payout (the map is keyed by resource
    // and additive, so this composes with a printed M€ bonus). Released in ONE
    // go at the LAST coin's touchdown — which is what makes the delta chip
    // read «+6 M€» rather than three separate «+2 M€».
    specs.push({channel: 'stock', resource: 'megacredits', amount: pendingOceanBonus.megacredits});
  }
  beginPanelRewardHold(specs);
}

/**
 * END (next tick, after the view committed) — the REWARD + RESTORE beats, in
 * the order the STORY is told:
 *   1. THE CELL pays: its displaced printed icons hand off into physical
 *      resource chips (the shared framework, per-icon hover origins; each
 *      touchdown releases its own metric);
 *   2. THE CELL RECOVERS — the nomad-specific epilogue: the printed bonuses
 *      MATERIALIZE BACK in place, because the camp collected the bonus and
 *      the field was not exhausted;
 *   3. THE WATER pays: every neighbouring ocean the SERVER says paid wakes at
 *      the shore it shares with the destination and condenses ONE M€ coin —
 *      the SAME shared beat a tile placement plays (`oceanAdjacencyBeat`),
 *      because the rule that granted it is the same rule.
 * A hop that collected nothing finishes IMMEDIATELY — not one extra frame.
 */
export async function endNomadMove(): Promise<void> {
  if (!nomadMoveState.active) {
    return;
  }
  const bonuses = pendingBonuses;
  const ocean = pendingOceanBonus;
  pendingBonuses = [];
  pendingOceanBonus = undefined;
  if (nomadMoveState.reducedMotion || (bonuses.length === 0 && ocean === undefined)) {
    finish();
    return;
  }
  nomadMoveState.phase = 'rewarding';
  if (bonuses.length > 0) {
    await runPrintedBonusBeat(bonuses);
    if (!nomadMoveState.active) {
      return;
    }
    // THE RESTORE: the field answers the emptiness — the printed icons
    // re-form from a small scale with one warm glint each, staggered. The
    // un-blank and the one-shot class land in the same synchronous turn.
    nomadMoveState.phase = 'restoring';
    await wait(motionMs(NOMAD_RESTORE_BREATH_MS));
    if (!nomadMoveState.active) {
      return;
    }
    await wait(playBonusRestore());
    if (!nomadMoveState.active) {
      return;
    }
  }
  if (ocean !== undefined) {
    nomadMoveState.phase = 'rewarding';
    await runOceanBonusBeat(ocean);
  }
  finish();
}

/**
 * THE CELL'S OWN PAYOUT — the printed icons hovering over the seated camp
 * become physical chips and fly to the rail (each touchdown ticks its own
 * metric). Byte-for-byte the tile hero's printed beat, on the hop's geometry.
 */
async function runPrintedBonusBeat(bonuses: ReadonlyArray<PlacementBonus>): Promise<void> {
  const els = stage?.els();
  const ui = conUiScale();
  const hoverPx = Math.round(NOMAD_BONUS_HOVER_PX * ui);
  const origins: Array<TransferPoint | undefined> = bonuses.map((b) => {
    const proxy = nomadMoveState.bonusProxies.find((p) => p.id === b.bonusIndex);
    if (proxy === undefined) {
      return destHexRect !== undefined ?
        {x: destHexRect.x + destHexRect.w / 2, y: destHexRect.y + destHexRect.h / 2 - hoverPx} : undefined;
    }
    return {x: proxy.rect.x + proxy.rect.w / 2, y: proxy.rect.y + proxy.rect.h / 2 - hoverPx};
  });
  // One calm breath (the commit just ticked the non-held metrics), then the
  // hovering icons become chips on the framework's own wave stagger.
  await wait(motionMs(NOMAD_HANDOFF_BREATH_MS));
  if (!nomadMoveState.active) {
    return;
  }
  if (els !== undefined && bonusesHovering) {
    playBonusHandoff(els.bonusIcons, {count: bonuses.length});
  }
  await runResourceTransfers({
    specs: bonuses.map((b) => b.spec),
    origins,
    source: {point: destHexRect !== undefined ?
      {x: destHexRect.x + destHexRect.w / 2, y: destHexRect.y + destHexRect.h / 2} : undefined},
    arrival: 'auto',
    fromBoard: true,
    onArrive: (spec) => releasePanelRewardHold(spec),
  });
  // ⚠ NO belt-and-braces `clearPanelRewardHold()` here: the OCEAN payout's
  // own hold may still be standing, and clearing it would tick the M€ counter
  // before a single coin has left the water. `finish()` clears everything
  // once, at the very end of the whole sequence.
}

/**
 * THE NEIGHBOURING WATER'S PAYOUT — the SHARED beat, on the hop's geometry.
 * The camp collects the destination's placement bonus «as if placing a
 * special tile there», and the server computes ocean adjacency for every such
 * grant, so this is the same event the tile hero shows and it gets the same
 * coins. Ares adjacency deliberately has NO counterpart here: the server
 * gates it on a tile actually being placed, so the camp earns none.
 */
async function runOceanBonusBeat(bonus: OceanAdjacencyBonusModel): Promise<void> {
  const tileRect = destHexRect ?? measureBoardHexRect(nomadMoveState.toId);
  if (tileRect === undefined) {
    releasePanelRewardHold({channel: 'stock', resource: 'megacredits', amount: bonus.megacredits});
    return;
  }
  await runOceanAdjacencyBeat({
    bonus,
    tileRect,
    uiScale: conUiScale(),
    alive: () => nomadMoveState.active,
    release: () => releasePanelRewardHold(
      {channel: 'stock', resource: 'megacredits', amount: bonus.megacredits}),
  });
}

/**
 * ABORT — refused move, network failure, safety timer, unmount. Drops the
 * stage, the pending bonuses and any seeded hold; frees the commit gate;
 * un-hides everything hidden; flags `failed` for one flush. The board was
 * never touched before server proof, so there is nothing to restore.
 */
export function abortNomadMove(): void {
  if (!nomadMoveState.active && runResolve === undefined) {
    return;
  }
  clearTimers();
  clearRestoreTimer();
  const els = stage?.els();
  if (els !== undefined) {
    killNomadTweens(els);
  }
  abortResourceTransfers();
  abortOceanBeat(); // …and the shared water beat this hop may have staged
  clearPanelRewardHold();
  restoreHeldToken();
  restoreHeldBonuses();
  stripRestoreClass();
  bonusesHovering = false;
  bonusHoldSeeded = false;
  cardBonusPending = false;
  pendingBonuses = [];
  pendingOceanBonus = undefined;
  destHexRect = undefined;
  srcHexRect = undefined;
  nomadMoveState.active = false;
  nomadMoveState.phase = 'failed';
  nomadMoveState.bonusProxies = [];
  freeRunGate();
  void nextTick(() => {
    if (nomadMoveState.phase === 'failed') {
      nomadMoveState.phase = 'idle';
      nomadMoveState.fromId = '';
      nomadMoveState.toId = '';
    }
  });
}

function finish(): void {
  clearTimers();
  clearPanelRewardHold(); // safety — the reward beat leaves it empty
  restoreHeldToken();
  restoreHeldBonuses();
  bonusesHovering = false;
  bonusHoldSeeded = false;
  cardBonusPending = false;
  pendingBonuses = [];
  pendingOceanBonus = undefined;
  destHexRect = undefined;
  srcHexRect = undefined;
  nomadMoveState.active = false;
  nomadMoveState.phase = 'done';
  nomadMoveState.bonusProxies = [];
  void nextTick(() => {
    if (nomadMoveState.phase === 'done') {
      nomadMoveState.phase = 'idle';
      nomadMoveState.fromId = '';
      nomadMoveState.toId = '';
    }
  });
}

// ── the REMOTE leg (another player's move / an undo walking back) ───────────

type RemoteNomadEvent = NomadMoveDiff;

const remoteQueue: Array<RemoteNomadEvent> = [];
let remoteDraining = false;
/** Bumped by abort — a drain loop mid-await sees the change and exits. */
let remoteEpoch = 0;
let remoteSafety: number | undefined;

export type RemoteNomadStageOpts = {
  gamePhase?: string,
};

/**
 * STAGE — call in the SAME synchronous block as the commit, BEFORE the
 * displayed spaces change. Diffs the camp's from→to pair, keeps a GHOST on
 * the source (object permanence while the hop waits its turn), commits the
 * destination HIDDEN, pre-adopts both cells in the marker baseline (the
 * flag flips must be silent), and queues the hop. The caller then commits
 * normally — no commit is ever delayed on this path.
 */
export function stageRemoteNomadMove(
  prevSpaces: ReadonlyArray<SpaceModel> | undefined,
  newSpaces: ReadonlyArray<SpaceModel> | undefined,
  opts?: RemoteNomadStageOpts,
): void {
  if (prevSpaces === undefined || newSpaces === undefined ||
      typeof window === 'undefined' || !consoleModeState.enabled) {
    return;
  }
  if (opts?.gamePhase === Phase.END) {
    return; // the endgame experience owns the screen — no hops under it
  }
  const diff = detectNomadMoveDiff(prevSpaces, newSpaces);
  if (diff === undefined) {
    return;
  }
  if (nomadMoveState.active && nomadMoveState.toId === diff.toId) {
    return; // the viewer's OWN armed move owns this pair
  }
  if (hiddenCells.has(diff.toId) || remoteQueue.some((q) => q.toId === diff.toId)) {
    return; // already staged (a poll/submit double-report)
  }
  // Silence the marker framework for BOTH flag flips (a move is never a
  // landing), whatever the placement-animation window happens to be.
  adoptMarkerSilently(diff.toId, 'nomads');
  forgetMarkerSilently(diff.fromId, 'nomads');
  if (consoleReducedMotionActive()) {
    return; // honest reduced path: the flags flip with the plain commit
  }
  ghostCells.add(diff.fromId);
  hiddenCells.add(diff.toId);
  remoteQueue.push(diff);
  armRemoteSafety();
  void drainRemoteQueue();
}

/**
 * ABORT the remote leg — stage unmount or the safety ceiling. Every held
 * token becomes visible at once, every ghost drops; the queue empties.
 */
export function abortRemoteNomadMoves(): void {
  remoteEpoch++;
  const els = stage?.els();
  if (els !== undefined) {
    killNomadTweens(els);
  }
  remoteQueue.length = 0;
  hiddenCells.clear();
  ghostCells.clear();
  remoteDraining = false;
  nomadMoveState.remoteActive = false;
  nomadMoveState.remoteWaiting = false;
  clearRemoteSafety();
}

async function drainRemoteQueue(): Promise<void> {
  if (remoteDraining) {
    return;
  }
  remoteDraining = true;
  const myEpoch = remoteEpoch;
  try {
    while (remoteQueue.length > 0 && remoteEpoch === myEpoch) {
      const ev = remoteQueue[0];
      try {
        await flyRemoteHop(ev, myEpoch);
      } finally {
        if (remoteEpoch === myEpoch) {
          // Whatever happened, the COMMITTED truth must be visible.
          hiddenCells.delete(ev.toId);
          ghostCells.delete(ev.fromId);
          remoteQueue.shift();
        }
      }
    }
  } finally {
    if (remoteEpoch === myEpoch) {
      remoteDraining = false;
      nomadMoveState.remoteActive = false;
      clearRemoteSafety();
    }
  }
}

async function flyRemoteHop(ev: RemoteNomadEvent, myEpoch: number): Promise<void> {
  // A hop nobody can see is not a hop (the remote-tile lesson): wait for a
  // watchable board — the wait costs nothing, the source keeps its ghost
  // and the destination reads untouched. Bounded: a hidden camp is a worse
  // lie than a missed animation.
  nomadMoveState.remoteWaiting = boardCovered();
  try {
    await awaitWatchableBoard(myEpoch);
  } finally {
    nomadMoveState.remoteWaiting = false;
  }
  if (remoteEpoch !== myEpoch) {
    return;
  }
  const srcHex = measureBoardHexRect(ev.fromId);
  const dstHex = measureBoardHexRect(ev.toId);
  if (srcHex === undefined || dstHex === undefined) {
    return; // still unmeasurable — the finally-reveal shows the truth
  }
  const ui = conUiScale();
  const from = nomadAnchorOf(srcHex);
  const to = nomadAnchorOf(dstHex);
  const sizePx = nomadSizeOf(srcHex);
  nomadMoveState.tokenSizePx = sizePx;
  nomadMoveState.remoteActive = true;
  nomadMoveState.nonce++;
  await nextTick(); // the layer mounts the proxy
  if (remoteEpoch !== myEpoch) {
    return;
  }
  const els = stage?.els();
  if (els === undefined || !placeNomadProxy(els, {from, to, sizePx, uiScale: ui})) {
    return;
  }
  // The proxy stands over the GHOST — retire the ghost in this same
  // synchronous turn (the swap discipline).
  ghostCells.delete(ev.fromId);
  await playNomadFlight(els, {
    from, to, sizePx, uiScale: ui,
    liftMs: motionMs(NOMAD_LIFT_MS),
    flightMs: motionMs(NOMAD_FLIGHT_MS),
    settleMs: motionMs(NOMAD_SETTLE_MS),
  });
  if (remoteEpoch !== myEpoch) {
    return;
  }
  // Frame-perfect handoff: the COMMITTED token reveals under the settled
  // proxy, the proxy dissolves on it.
  hiddenCells.delete(ev.toId);
  await nextTick();
  await disposeNomadProxy(els, motionMs(110));
}

function awaitWatchableBoard(myEpoch: number): Promise<void> {
  if (!boardCovered()) {
    return Promise.resolve();
  }
  const deadline = Date.now() + NOMAD_BOARD_WAIT_MAX_MS;
  return new Promise<void>((done) => {
    const poll = () => {
      if (remoteEpoch !== myEpoch || !boardCovered() || Date.now() > deadline) {
        window.setTimeout(done, remoteEpoch === myEpoch ? motionMs(NOMAD_BOARD_SETTLE_MS) : 0);
        return;
      }
      armRemoteSafety();
      window.setTimeout(poll, 140);
    };
    poll();
  });
}

function armRemoteSafety(): void {
  if (remoteSafety !== undefined) {
    window.clearTimeout(remoteSafety);
  }
  remoteSafety = window.setTimeout(() => abortRemoteNomadMoves(), NOMAD_REMOTE_SAFETY_MS);
}

function clearRemoteSafety(): void {
  if (remoteSafety !== undefined) {
    window.clearTimeout(remoteSafety);
    remoteSafety = undefined;
  }
}

// ── internals ───────────────────────────────────────────────────────────────

function escapeId(id: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(id) : id.replace(/"/g, '\\"');
}

/** Hide the REAL resting token the same synchronous turn the proxy stands
 *  over it (the `con-deal-hold` swap discipline). */
function holdRealToken(spaceId: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  const el = document.querySelector<HTMLElement>(
    `.board-space[data_space_id="${escapeId(spaceId)}"] .board-nomad`);
  if (el !== null) {
    heldTokenEl = el;
    el.classList.add('con-deal-hold');
  }
}

function restoreHeldToken(): void {
  heldTokenEl?.classList.remove('con-deal-hold');
  heldTokenEl = undefined;
}

/** Blank the REAL printed-icon container under the bonus proxies (same
 *  discipline as the tile hero — the takeover is 1:1). */
function holdRealBonuses(spaceId: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  const el = document.querySelector<HTMLElement>(
    `.board-space[data_space_id="${escapeId(spaceId)}"] .board-space-bonuses`);
  if (el !== null) {
    heldBonusEl = el;
    restoreEl = el;
    el.classList.add('con-deal-hold');
  }
}

function restoreHeldBonuses(): void {
  heldBonusEl?.classList.remove('con-deal-hold');
  heldBonusEl = undefined;
}

/**
 * The RESTORE beat: un-blank the real icons and play the one-shot
 * re-materialization (scale-up + warm glint, per-icon stagger — the
 * `board-space-bonuses--nomad-restore` keyframes). Returns the total beat
 * length. The class is stripped by a timer — never left behind (a lingering
 * one-shot class replays on any display flip; the project lesson).
 */
function playBonusRestore(): number {
  restoreHeldBonuses();
  const el = restoreEl;
  const count = Math.max(1, nomadMoveState.bonusProxies.length);
  const total = motionMs(NOMAD_RESTORE_MS) + motionMs(NOMAD_RESTORE_STAGGER_MS) * (count - 1);
  if (el === undefined) {
    return 0;
  }
  el.classList.add('board-space-bonuses--nomad-restore');
  restoreTimer = window.setTimeout(() => {
    restoreTimer = undefined;
    stripRestoreClass();
  }, total + 60);
  return total;
}

function stripRestoreClass(): void {
  restoreEl?.classList.remove('board-space-bonuses--nomad-restore');
  restoreEl = undefined;
}

/** The destination's printed STOCK icons' live rects, index-aligned with
 *  `space.bonus` (one `.board-space-bonus` per entry, in order). */
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

/** Is the destination's printed CARD icon actually in the DOM? (The cover
 *  scene needs a physical source — no icon, no arm; the standard reveal
 *  then stays untouched.) */
function cardIconLive(spaceId: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.querySelector(
    `.board-space[data_space_id="${escapeId(spaceId)}"] .board-space-bonus--card`) !== null;
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

/** ⚠ Deliberately does NOT clear the restore timer: `finish()` runs at the
 *  restore beat's END and the one-shot class must still be stripped by its
 *  own (+60 ms) timer — a lingering animation class replays on any display
 *  flip of the board (the project lesson). Abort/arm clear it explicitly. */
function clearTimers(): void {
  if (armSafety !== undefined) {
    window.clearTimeout(armSafety);
    armSafety = undefined;
  }
  if (sceneSafety !== undefined) {
    window.clearTimeout(sceneSafety);
    sceneSafety = undefined;
  }
  if (preLiftTimer !== undefined) {
    window.clearTimeout(preLiftTimer);
    preLiftTimer = undefined;
  }
}

function clearRestoreTimer(): void {
  if (restoreTimer !== undefined) {
    window.clearTimeout(restoreTimer);
    restoreTimer = undefined;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── the animation-hold suppliers ────────────────────────────────────────────
//
// The own hop + reward + restore hold the presentation; remote hops hold
// exactly like remote tile landings. Release = the phase falling on end/abort
// (the scene's own completion signal), never a timer.
//
// ⚠️ REGISTERED AT THE BOTTOM ON PURPOSE: a supplier is READ the moment it is
// registered (the registry re-derives its counts synchronously), so registering
// one above the state it reads runs that read while this module is still
// initialising — `isRemoteNomadMoveActive` touches `remoteQueue`, a `const`
// declared far below, and threw `Cannot access 'remoteQueue' before
// initialization` on every single load, printing a stack trace and counting as
// «not holding» for that first read. Keep every registration after ALL module
// state.
registerAnimationHoldSupplier('nomad-move', nomadMoveHolding);
registerAnimationHoldSupplier('nomad-move-remote', isRemoteNomadMoveActive);
