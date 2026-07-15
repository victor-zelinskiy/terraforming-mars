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
 *   plays the post-commit REWARD BEAT: the printed icons rise through the
 *   placed tile, materialize into physical resource chips (the shared
 *   Resource Transfer Framework, per-icon origins) and pay out — each
 *   touchdown releases its metric, firing that delta chip at the contact.
 *   abortTilePlacement() is wired into every error path and a safety timer.
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
import {TileType} from '@/common/TileType';
import {SpaceModel} from '@/common/models/SpaceModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {
  TilePlacementPhase, PlacementBonus, TileRect,
  placementBonuses, verifyPlacement, findSpace, applySpacePreview,
  TILE_FLIGHT_MS, TILE_SETTLE_MS, TILE_REDUCED_MS, TILE_ARM_SAFETY_MS,
  BONUS_PRELIFT_START_T, BONUS_RISE_MS, BONUS_HOVER_PX, BONUS_HANDOFF_BREATH_MS,
} from '@/client/console/tilePlacement/tilePlacementModel';
import {
  TileStageEls, placeTileProxy, playTileFlight, disposeTileProxy,
  placeBonusProxies, playBonusPreLift, playBonusHandoff, killTileTweens,
} from '@/client/console/tilePlacement/tilePlacementDirector';
import {
  runResourceTransfers, abortResourceTransfers, beginPanelRewardHold, releasePanelRewardHold, clearPanelRewardHold,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';

export type BonusProxy = {
  id: number,
  /** The board sprite suffix (`board-space-bonus--<icon>`). */
  icon: string,
  /** The printed icon's LIVE rect, captured while the cell was uncovered. */
  rect: TileRect,
};

export const tilePlacementState = reactive({
  /** TRUE from arm until finish/abort — the transaction lock. */
  active: false,
  phase: 'idle' as TilePlacementPhase,
  nonce: 0,
  spaceId: '' as string,
  /** Set at detect (server-proven) — drives the proxy's tile art. */
  tileType: undefined as TileType | undefined,
  aresExtension: false,
  /** The printed stock-bonus icons that rise + pay out after the commit. */
  bonusProxies: [] as Array<BonusProxy>,
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
/** The armed hex's live rect (captured at detect — post pan/zoom truth). */
let hexRect: TileRect | undefined;
/** The REAL printed-icon container we blanked under the proxies (the
 *  `con-deal-hold` swap discipline) — restored on abort/finish. */
let heldBonusEl: HTMLElement | undefined;
/** TRUE once the pre-lift ran — the icons already HOVER over the seated
 *  tile when the reward beat starts (no second rise). */
let bonusesHovering = false;
/** The hold was seeded for THIS transaction (the commit path's one-shot). */
let bonusHoldSeeded = false;

// ── stage registry (the layer plugs in) ─────────────────────────────────────

type TileStageHandle = {els: () => TileStageEls | undefined};
let stage: TileStageHandle | undefined;

export function registerTilePlacementStage(handle: TileStageHandle): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
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

// ── the lifecycle ───────────────────────────────────────────────────────────

/**
 * ARM (SelectSpace's console-gated submit funnel, BEFORE the POST).
 * Nothing visual happens until the server proves the tile landed on the
 * armed space. Sets `active` synchronously — the input gate closes at once.
 */
export function armTilePlacement(opts: {spaceId: string}): void {
  clearTimers();
  claimed = false;
  pendingBonuses = [];
  hexRect = undefined;
  restoreHeldBonuses();
  bonusesHovering = false;
  bonusHoldSeeded = false;
  tilePlacementState.active = true;
  tilePlacementState.phase = 'armed';
  tilePlacementState.nonce++;
  tilePlacementState.spaceId = opts.spaceId;
  tilePlacementState.tileType = undefined;
  tilePlacementState.bonusProxies = [];
  tilePlacementState.reducedMotion = consoleReducedMotionActive();
  armSafety = window.setTimeout(() => abortTilePlacement(), TILE_ARM_SAFETY_MS);
}

/**
 * DETECT (WaitingFor commit path) — consume the arm exactly once per
 * response. VERIFIES the server actually put a tile on the armed space
 * (empty → tiled; hazards and covered-tile replacements ride their own
 * premium sequences), then CAPTURES the cell's live geometry + printed
 * bonus icons while the cell is still uncovered on the displayed board.
 */
export function detectTilePlacement(
  prevSpaces: ReadonlyArray<SpaceModel> | undefined,
  newSpaces: ReadonlyArray<SpaceModel> | undefined,
  opts?: {aresExtension?: boolean},
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
    verifyPlacement(prevSpaces, newSpaces, spaceId) : undefined;
  if (landed === undefined) {
    abortTilePlacement();
    return undefined;
  }
  tilePlacementState.tileType = landed.tileType;
  tilePlacementState.aresExtension = opts?.aresExtension === true;
  // The cell is still UNCOVERED on the displayed board — capture the hex +
  // every printed stock icon's live rect now (post pan/zoom truth). The
  // reward beat replays these exact positions over the placed tile.
  hexRect = measureHex(spaceId);
  const space = prevSpaces !== undefined ? findSpace(prevSpaces, spaceId) : undefined;
  pendingBonuses = space !== undefined ? placementBonuses(space.bonus) : [];
  tilePlacementState.bonusProxies = captureBonusIcons(spaceId, pendingBonuses);
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
  tilePlacementState.phase = 'approaching';
  const paintRealTile = () => applySpacePreview(prevSpaces, newSpaces, tilePlacementState.spaceId);

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
  const els = stage?.els();
  const ui = conUiScale();
  if (els === undefined || !placeTileProxy(els, {
    hex: hexRect,
    from: supplyPoint(ui),
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
    placeBonusProxies(els);
    holdRealBonuses();
    bonusesHovering = true;
    playBonusPreLift(els, {
      delayMs: Math.round(flightMs * BONUS_PRELIFT_START_T),
      riseMs: motionMs(BONUS_RISE_MS),
      hoverPx: Math.round(BONUS_HOVER_PX * ui),
    });
  }
  await playTileFlight(els, {
    hex: hexRect,
    from: supplyPoint(ui),
    uiScale: ui,
    flightMs,
    settleMs: motionMs(TILE_SETTLE_MS),
  });
  if (!tilePlacementState.active) {
    return; // aborted mid-flight — abort already cleaned up
  }
  // Frame-perfect handoff: the REAL tile paints under the settled proxy
  // (identical geometry, silent — the generic entrance stays unarmed),
  // then the proxy dissolves on it.
  paintRealTile();
  tilePlacementState.phase = 'landed';
  await nextTick();
  await disposeTileProxy(els, motionMs(110));
}

/**
 * Seed the PANEL REWARD HOLD for the cell's printed bonuses — the caller MUST
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
  if (!tilePlacementState.active || bonusHoldSeeded || pendingBonuses.length === 0) {
    return;
  }
  if (tilePlacementState.reducedMotion) {
    pendingBonuses = [];
    return;
  }
  bonusHoldSeeded = true;
  beginPanelRewardHold(pendingBonuses.map((b) => b.spec));
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
  pendingBonuses = [];
  if (bonuses.length === 0 || tilePlacementState.reducedMotion) {
    finish();
    return;
  }
  tilePlacementState.phase = 'rewarding';
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
    playBonusHandoff(els, {count: bonuses.length});
  }
  await runResourceTransfers({
    specs: bonuses.map((b) => b.spec),
    origins,
    source: {point: hexRect !== undefined ?
      {x: hexRect.x + hexRect.w / 2, y: hexRect.y + hexRect.h / 2} : undefined},
    arrival: 'auto',
    onArrive: (spec) => releasePanelRewardHold(spec),
  });
  // Belt-and-braces: any hold a degraded transfer left behind snaps to the
  // committed truth now (its chip fires marginally late, never lost).
  clearPanelRewardHold();
  finish();
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
  clearPanelRewardHold();
  restoreHeldBonuses(); // the printed icons un-blank — the field is intact
  bonusesHovering = false;
  bonusHoldSeeded = false;
  pendingBonuses = [];
  hexRect = undefined;
  tilePlacementState.active = false;
  tilePlacementState.phase = 'failed';
  tilePlacementState.bonusProxies = [];
  freeRunGate();
  void nextTick(() => {
    if (tilePlacementState.phase === 'failed') {
      tilePlacementState.phase = 'idle';
      tilePlacementState.spaceId = '';
      tilePlacementState.tileType = undefined;
    }
  });
}

function finish(): void {
  clearTimers();
  clearPanelRewardHold(); // safety — the reward beat leaves it empty
  // Un-blank the printed icons: the placed tile's art covers them on the
  // real board anyway (same as every pre-existing tile) — invisible swap.
  restoreHeldBonuses();
  bonusesHovering = false;
  bonusHoldSeeded = false;
  pendingBonuses = [];
  hexRect = undefined;
  tilePlacementState.active = false;
  tilePlacementState.phase = 'done';
  tilePlacementState.bonusProxies = [];
  void nextTick(() => {
    if (tilePlacementState.phase === 'done') {
      tilePlacementState.phase = 'idle';
      tilePlacementState.spaceId = '';
      tilePlacementState.tileType = undefined;
    }
  });
}

// ── internals ───────────────────────────────────────────────────────────────

/** The neutral table-edge supply every placement source shares (the same
 *  bottom-centre geography as the sale terminal / the player zone). */
function supplyPoint(uiScale: number): TransferPoint {
  return {
    x: window.innerWidth / 2,
    y: window.innerHeight - Math.round(96 * uiScale),
  };
}

function escapeId(id: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(id) : id.replace(/"/g, '\\"');
}

/** Blank the REAL printed-icon container the same synchronous turn the
 *  proxies stand over it (the shared `con-deal-hold` swap discipline) —
 *  the takeover is 1:1, never a double vision. */
function holdRealBonuses(): void {
  if (typeof document === 'undefined') {
    return;
  }
  const el = document.querySelector<HTMLElement>(
    `.board-space[data_space_id="${escapeId(tilePlacementState.spaceId)}"] .board-space-bonuses`);
  if (el !== null) {
    heldBonusEl = el;
    el.classList.add('con-deal-hold');
  }
}

function restoreHeldBonuses(): void {
  heldBonusEl?.classList.remove('con-deal-hold');
  heldBonusEl = undefined;
}

function measureHex(spaceId: string): TileRect | undefined {
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
