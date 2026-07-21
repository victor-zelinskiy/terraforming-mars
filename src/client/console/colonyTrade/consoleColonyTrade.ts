/*
 * CONSOLE COLONY TRADE — the orchestrator of the WHOLE premium trade
 * transaction (console-native only). One tradeId, one ordered story:
 *
 *   confirm (armed) → payment → the trade fleet flies + DOCKS (the existing
 *   `consoleTradeFleet` gate holds the commit) → the view commits WITH the
 *   reward metrics hidden under the panel REWARD HOLD and the colony track
 *   FROZEN at its pre-trade position → wave 1: the trade income physically
 *   leaves the tile's «ТОРГОВАТЬ» cell (chips / card covers) → wave 2: the
 *   viewer's own colony bonuses leave the «БОНУС» cell → all drawn cards of
 *   the trade assemble into ONE reveal modal (the server already merged the
 *   batches by tradeId) → the player confirms them → only then the white
 *   marker physically glides LEFT to its reset position and the «ТОРГОВАТЬ»
 *   readout morphs to the new reward → settle → unlock.
 *
 * Ownership split (the established convention — trade fleet / hydro marker /
 * colony build): PURE maths in `colonyTradeModel.ts`; GSAP in
 * `colonyTradeDirector.ts`; the app-level stage in
 * `ConsoleColonyTradeLayer.vue`; this module owns the reactive state, the
 * lifecycle (arm / detect / seed / run / advance / conclude / abort), the
 * reveal-batch claim (vs the deck-draw scene), the input gate and the
 * animation-hold registration.
 *
 * SERVER AUTHORITY: every amount comes from the trade's atomic
 * `ColonyTradeManifestModel` (+ the tradeId-stamped reveal batches for the
 * ACTUAL drawn cards). The client never re-derives rewards from rules tables
 * or the DOM. The track reset is presented ONLY after the server's own reset
 * committed (the server itself sequences it after every reward — see
 * Colony.handleTrade's finalizer).
 *
 * DESKTOP SAFETY: `armColonyTrade` is only called by the console shell at
 * the composer confirm, so on desktop (and for every non-armed trade — a
 * bot's, an opponent's, a Titan Floating action trade, a reload into a
 * pending manifest) `detectColonyTrade` returns undefined and NOTHING here
 * engages: the standard commit/delta-chip path plays. A reconnect therefore
 * never replays a finished transaction (the manifest may still ride the
 * view, but it was never armed → it is ignored; `seenTradeIds` additionally
 * guards a double-play within a session).
 */

import {reactive, watch} from 'vue';
import {Color} from '@/common/Color';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {ColonyTradeManifestModel} from '@/common/models/ColonyTradeManifestModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';
import {translateText} from '@/client/directives/i18n';
import {
  beginPanelRewardHold, releasePanelRewardHold, runResourceTransfers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {TRANSFER_RESIDUAL_PAUSE_MS} from '@/client/console/resourceTransfer/resourceTransferModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {
  ColonyTradeTargets, colonyTradeHeldSpecs, incomeTransferSpecs, ownBonusTransferSpecs,
  trackGlidePlan, TrackGlidePlan, TRACK_SETTLE_MS,
} from '@/client/console/colonyTrade/colonyTradeModel';

/**
 * The transaction's phases:
 *   idle      — nothing armed;
 *   armed     — confirm pressed, the fleet flies, the commit is still gated;
 *   chips     — post-commit: the income / own-bonus resource chips fly;
 *   awaiting  — chips done; waiting for the trade's reveal batches to be
 *               confirmed and/or the server's track reset to commit (input is
 *               FREE here — a Pluto discard prompt may need it);
 *   glide     — the white marker physically steps LEFT to the reset position;
 *   settle    — the landed marker's one-shot glow + the «ТОРГОВАТЬ» morph;
 *   (then idle again).
 */
export type ColonyTradePhase = 'idle' | 'armed' | 'chips' | 'awaiting' | 'glide' | 'settle';

/** The card-cover scene of a staged trade reveal batch (the layer drives it). */
export type ColonyTradeCardScene = 'idle' | 'fly' | 'frame' | 'handoff';

/** The tile-status caption of the beat currently playing on the traded tile. */
export type ColonyTradeBeat = '' | 'income' | 'bonus' | 'update';

type ColonyTradeState = {
  active: boolean;
  phase: ColonyTradePhase;
  cardScene: ColonyTradeCardScene;
  /** Which reward beat narrates the traded tile's status line right now. */
  beat: ColonyTradeBeat;
  colonyName: ColonyName | '';
  color: Color | '';
  tradeId: string;
  preTrackPosition: number;
  postTrackPosition: number;
  /** The tile shows `preTrackPosition` for this colony while true. */
  trackHold: boolean;
  /** Bumped when the glide should run — the layer measures + animates. */
  glideNonce: number;
  /** One-shot: the cell the marker just settled on (glow), −1 when none. */
  settledCell: number;
  /**
   * Reveal batch ids this transaction staged (its covers flew them in).
   * PERSISTS after the transaction ends — the reveal stays `currentRevealEvent`
   * until the player takes the cards, and a finished scene must never let the
   * deck-draw re-claim its batch (the colony-build lesson).
   */
  stagedRevealIds: Array<number>;
  /** Single-card staged batch: the fullscreen auto-open is held until ready. */
  zoomEntryReady: boolean;
  reducedMotion: boolean;
};

export const colonyTradeState = reactive<ColonyTradeState>({
  active: false,
  phase: 'idle',
  cardScene: 'idle',
  beat: '',
  colonyName: '',
  color: '',
  tradeId: '',
  preTrackPosition: 0,
  postTrackPosition: 0,
  trackHold: false,
  glideNonce: 0,
  settledCell: -1,
  stagedRevealIds: [],
  zoomEntryReady: false,
  reducedMotion: false,
});

// ── non-reactive transaction context ────────────────────────────────────────

type TradeCtx = {
  manifest: ColonyTradeManifestModel | undefined;
  targets: ColonyTradeTargets | undefined;
  claimed: boolean;
  seeded: boolean;
  chipsDone: boolean;
  /** The reward waves have been started (exactly once per transaction). */
  rewardsKicked: boolean;
  committedTrack: number | undefined;
  glideStarted: boolean;
};
const ctx: TradeCtx = {
  manifest: undefined,
  targets: undefined,
  claimed: false,
  seeded: false,
  chipsDone: false,
  rewardsKicked: false,
  committedTrack: undefined,
  glideStarted: false,
};

/** Trades already presented this session — a poll replay can never re-play one. */
const seenTradeIds = new Set<string>();

let armSafetyId = 0;
let ceilingId = 0;
let settleTimerId = 0;
let glideResolver: (() => void) | undefined;

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

/** Dev-only stage journal — one greppable line per transition, for
 *  desynchronization hunts (`[colony-trade] …`). */
export function tradeLog(...parts: ReadonlyArray<unknown>): void {
  if (DEV) {
    console.debug('[colony-trade]', ...parts);
  }
}

// ── predicates ──────────────────────────────────────────────────────────────

export function isColonyTradeActive(): boolean {
  return colonyTradeState.active;
}

/**
 * The pad is inert while a scene beat physically plays: the chip waves, the
 * card covers (until the reveal becomes interactive at handoff) and the
 * marker glide. DELIBERATELY FREE during `awaiting` (a Pluto discard prompt
 * between two bonus draws needs the pad) and `settle` (pure decoration).
 */
export function isColonyTradeInputLocked(): boolean {
  if (!colonyTradeState.active) {
    return false;
  }
  if (colonyTradeState.phase === 'chips' || colonyTradeState.phase === 'glide') {
    return true;
  }
  return colonyTradeState.cardScene === 'fly' || colonyTradeState.cardScene === 'frame';
}

/** A scene beat is on stage — notifications queue, mandatory surfaces wait.
 *  `awaiting` is excluded: the reveal / a discard prompt OWNS that window. */
function colonyTradeHolding(): boolean {
  if (!colonyTradeState.active) {
    return false;
  }
  return colonyTradeState.phase === 'chips' || colonyTradeState.phase === 'glide' ||
    colonyTradeState.cardScene !== 'idle';
}

registerAnimationHoldSupplier('colony-trade', colonyTradeHolding);

/**
 * The presented colony model: while the transaction FREEZES the traded
 * colony's track, every console surface (tile / focused summary / inspect)
 * reads the pre-trade position through this ONE helper — so the committed
 * reset can never flash through early on any of them. Everything else about
 * the colony (cubes, visitor, name) passes through untouched.
 */
export function presentedColonyModel(colony: ColonyModel): ColonyModel {
  if (!colonyTradeState.trackHold || colony.name !== colonyTradeState.colonyName) {
    return colony;
  }
  return {...colony, trackPosition: colonyTradeState.preTrackPosition};
}

// ── reveal-batch claim (vs the deck-draw scene) ─────────────────────────────

/**
 * A reveal batch belongs to THIS armed transaction. Claim key = tradeId once
 * the manifest is claimed; while the transaction is armed but the manifest
 * hasn't landed yet (a commit path that bypasses the gated detect — the
 * staged bot pipeline, a poll after a lost response), a trade-tagged batch
 * from the ARMED COLONY is still ours — no other trade can resolve while our
 * own is holding the moment.
 */
export function colonyTradeClaimsReveal(source: CardDrawRevealSource | undefined): boolean {
  if (!colonyTradeState.active || source?.type !== 'colony' || source.trade === undefined) {
    return false;
  }
  if (colonyTradeState.tradeId !== '') {
    return source.trade.tradeId === colonyTradeState.tradeId;
  }
  return source.colonyName === colonyTradeState.colonyName;
}

/** The batch was staged by this scene (persists past the transaction's end). */
export function isColonyTradeRevealStaged(eventId: number | undefined): boolean {
  return eventId !== undefined && colonyTradeState.stagedRevealIds.includes(eventId);
}

/**
 * The batch belongs to a trade THIS client presented (armed + claimed) this
 * session — even after the transaction closed, and even when reduced motion
 * skipped the cover flight. The deck-draw scene consults this so a
 * still-untaken trade batch can never be re-grabbed and re-launched "from
 * the deck" later. A FOREIGN trade-tagged batch (the viewer's own colony
 * bonus from an opponent's trade) is deliberately NOT covered: its cards
 * honestly come off the deck, which IS the deck-draw scene's story.
 */
export function isPresentedTradeReveal(source: CardDrawRevealSource | undefined): boolean {
  return source?.type === 'colony' &&
    source.trade !== undefined &&
    seenTradeIds.has(source.trade.tradeId);
}

/** Claim one batch's entrance (the layer flies its covers). */
export function stageColonyTradeReveal(eventId: number): boolean {
  if (!colonyTradeState.active || isColonyTradeRevealStaged(eventId)) {
    return false;
  }
  colonyTradeState.stagedRevealIds.push(eventId);
  colonyTradeState.zoomEntryReady = false;
  colonyTradeState.cardScene = 'fly';
  tradeLog('reveal staged', eventId);
  return true;
}

export function setColonyTradeCardScene(scene: ColonyTradeCardScene): void {
  if (colonyTradeState.active) {
    colonyTradeState.cardScene = scene;
    tradeLog('card scene', scene);
    if (scene === 'idle') {
      maybeAdvance();
    }
  }
}

/** Single-card staged batch: the flown cover is in its centre pose — release
 *  the fullscreen auto-open (it lifts the cover via the physical origin). */
export function markColonyTradeZoomReady(): void {
  colonyTradeState.zoomEntryReady = true;
}

/** The overlay holds the single-card auto-open while our cover still flies. */
export function colonyTradeHoldingSingleZoom(eventId: number | undefined): boolean {
  return colonyTradeState.active &&
    eventId !== undefined &&
    colonyTradeState.stagedRevealIds.includes(eventId) &&
    !colonyTradeState.zoomEntryReady;
}

let zoomOrigin: (() => HTMLElement | null) | undefined;
/** The layer registers where the single-card zoom FLIP should lift from. */
export function registerColonyTradeZoomOrigin(fn: (() => HTMLElement | null) | undefined): void {
  zoomOrigin = fn;
}
export function colonyTradeZoomOriginEl(): HTMLElement | null {
  return zoomOrigin?.() ?? null;
}

/**
 * Every batch this transaction staged has been fully confirmed (taken) by the
 * player — the reveal gate of the conclusion.
 */
function stagedRevealsConfirmed(): boolean {
  return colonyTradeState.stagedRevealIds.every((id) => {
    const e = drawnCardsState.events.find((ev) => ev.id === id);
    return e === undefined || e.dismissed;
  });
}

// The reveal-confirmed watcher: taking the last card of a staged batch is one
// of the three signals that advance the conclusion (module-level watch — the
// same idiom presentationFlow uses).
watch(
  () => colonyTradeState.active && stagedRevealsConfirmed(),
  (confirmed) => {
    if (confirmed) {
      maybeAdvance();
    }
  },
);

// ── lifecycle ───────────────────────────────────────────────────────────────

function clearArmSafety(): void {
  if (armSafetyId !== 0) {
    clearTimeout(armSafetyId);
    armSafetyId = 0;
  }
}

function clearCeiling(): void {
  if (ceilingId !== 0) {
    clearTimeout(ceilingId);
    ceilingId = 0;
  }
}

/**
 * ARM (the composer confirm, right next to `armTradeFleet`) — the transaction
 * exists from the player's own press. `targets` carries the composer's
 * pre-collected card-resource destinations so the chips can fly onto the
 * exact chosen host cards.
 */
export function armColonyTrade(colonyName: ColonyName, color: Color, targets?: ColonyTradeTargets): void {
  clearArmSafety();
  clearCeiling();
  ctx.manifest = undefined;
  ctx.targets = targets;
  ctx.claimed = false;
  ctx.seeded = false;
  ctx.chipsDone = false;
  ctx.rewardsKicked = false;
  ctx.committedTrack = undefined;
  ctx.glideStarted = false;
  colonyTradeState.active = true;
  colonyTradeState.phase = 'armed';
  colonyTradeState.cardScene = 'idle';
  colonyTradeState.beat = '';
  colonyTradeState.colonyName = colonyName;
  colonyTradeState.color = color;
  colonyTradeState.tradeId = '';
  colonyTradeState.trackHold = false;
  colonyTradeState.settledCell = -1;
  colonyTradeState.zoomEntryReady = false;
  colonyTradeState.reducedMotion = consoleReducedMotionActive();
  tradeLog('armed', colonyName);
  // The fleet's own 12 s abort net recalls the flight on a dropped submit;
  // this net just clears the never-claimed transaction shell after it.
  armSafetyId = setTimeout(() => {
    if (colonyTradeState.active && !ctx.claimed) {
      tradeLog('arm safety — never claimed, resetting');
      abortColonyTrade();
    }
  }, 15_000) as unknown as number;
}

/**
 * DETECT (WaitingFor commit path, BEFORE the seed/commit) — claim the armed
 * transaction against the response's authoritative manifest. Exactly once per
 * tradeId; undefined on desktop / non-trade submits / a replayed poll.
 * Claiming synchronously FREEZES the traded colony's track display, so the
 * commit right after can never flash the reset through.
 */
export function detectColonyTrade(newView: PlayerViewModel): {tradeId: string} | undefined {
  if (!colonyTradeState.active || ctx.claimed) {
    return undefined;
  }
  const manifest = newView.colonyTradeManifest;
  if (manifest === undefined ||
      manifest.colonyName !== colonyTradeState.colonyName ||
      seenTradeIds.has(manifest.tradeId)) {
    return undefined;
  }
  claimManifest(manifest);
  tradeLog('claimed', manifest.tradeId, 'track', manifest.preTradeTrackPosition, '→', manifest.postTradeTrackPosition);
  return {tradeId: manifest.tradeId};
}

/** The one claim: mark the tradeId seen, freeze the track, start the ceiling. */
function claimManifest(manifest: ColonyTradeManifestModel): void {
  seenTradeIds.add(manifest.tradeId);
  clearArmSafety();
  ctx.claimed = true;
  ctx.manifest = manifest;
  colonyTradeState.tradeId = manifest.tradeId;
  colonyTradeState.preTrackPosition = manifest.preTradeTrackPosition;
  colonyTradeState.postTrackPosition = manifest.postTradeTrackPosition;
  colonyTradeState.trackHold = manifest.postTradeTrackPosition < manifest.preTradeTrackPosition;
  // The whole transaction is bounded: whatever stalls (a lost reveal, a
  // never-arriving reset), the ceiling concludes honestly to committed truth.
  clearCeiling();
  ceilingId = setTimeout(() => {
    if (colonyTradeState.active) {
      tradeLog('transaction ceiling — concluding to committed state');
      concludeToCommitted();
    }
  }, 60_000) as unknown as number;
}

/**
 * SEED (inside WaitingFor.seedRewardHolds — the SAME synchronous block as the
 * commit, per the framework's phantom-chip contract): hide the viewer's own
 * reward metrics behind the panel REWARD HOLD so the commit fires no early
 * delta chips; each chip's touchdown releases exactly its amount. No-op
 * unless this response claimed an armed trade.
 */
export function seedColonyTradeRewardHold(): void {
  if (!ctx.claimed || ctx.seeded || ctx.manifest === undefined || colonyTradeState.color === '') {
    return;
  }
  ctx.seeded = true;
  const held = colonyTradeHeldSpecs(ctx.manifest, colonyTradeState.color, ctx.targets);
  if (held.length > 0) {
    beginPanelRewardHold(held);
    tradeLog('reward hold seeded', held);
  }
}

/**
 * RUN (next tick after the commit — the fleet just docked and handed off):
 * fly the chip waves. Wave 1 = the trade income out of the «ТОРГОВАТЬ» cell;
 * wave 2 = the viewer's own colony bonuses out of the «БОНУС» cell — two
 * visually distinct sequences even when both feed the same metric. Card
 * covers are the layer's reactive half (the staged reveal); this function
 * only owns the resource chips, then hands over to `awaiting`.
 */
export async function runColonyTradeRewards(): Promise<void> {
  if (!ctx.claimed || ctx.rewardsKicked || ctx.manifest === undefined || !colonyTradeState.active) {
    return;
  }
  ctx.rewardsKicked = true;
  const manifest = ctx.manifest;
  const viewer = colonyTradeState.color as Color;
  colonyTradeState.phase = 'chips';
  colonyTradeState.beat = 'income';
  tradeLog('chip waves start');
  const name = colonyTradeState.colonyName;
  const tileSel = `[data-test="con-colony-${name}"]`;
  const income = manifest.trader === viewer ? incomeTransferSpecs(manifest, ctx.targets) : [];
  if (income.length > 0) {
    await runResourceTransfers({
      specs: income,
      source: {selectors: [`${tileSel} [data-colony-trade-source]`, tileSel]},
      arrival: 'auto',
      onArrive: releasePanelRewardHold,
    });
  }
  const bonus = ownBonusTransferSpecs(manifest, viewer, ctx.targets);
  if (bonus.length > 0) {
    if (income.length > 0) {
      await pause(motionMs(TRANSFER_RESIDUAL_PAUSE_MS));
    }
    colonyTradeState.beat = 'bonus';
    await runResourceTransfers({
      specs: bonus,
      source: {selectors: [`${tileSel} [data-colony-bonus-source]`, tileSel]},
      arrival: 'auto',
      onArrive: releasePanelRewardHold,
    });
  }
  ctx.chipsDone = true;
  if (colonyTradeState.active && colonyTradeState.phase === 'chips') {
    colonyTradeState.phase = 'awaiting';
  }
  tradeLog('chip waves done');
  maybeAdvance();
}

/** The layer narrates the card waves (income covers → bonus covers). */
export function setColonyTradeBeat(beat: ColonyTradeBeat): void {
  if (colonyTradeState.active) {
    colonyTradeState.beat = beat;
  }
}

/**
 * The traded tile's status-line caption while the transaction narrates
 * itself — «Награда за торговлю» → «Бонус колонии» → «Обновление колонии»
 * (short, unobtrusive, inside the EXISTING summary line — never a toast).
 */
export function colonyTradeTileStatusText(colonyName: ColonyName): string | undefined {
  if (!colonyTradeState.active || colonyTradeState.colonyName !== colonyName || colonyTradeState.beat === '') {
    return undefined;
  }
  switch (colonyTradeState.beat) {
  case 'income': return translateText('Trade reward');
  case 'bonus': return translateText('Colony bonus payout');
  default: return translateText('Colony update');
  }
}

/** The shell's track watcher reports the traded colony's COMMITTED position. */
export function notifyColonyTradeTrackCommitted(colonyName: ColonyName, trackPosition: number): void {
  if (!colonyTradeState.active || colonyName !== colonyTradeState.colonyName) {
    return;
  }
  ctx.committedTrack = trackPosition;
  maybeAdvance();
}

/**
 * The universal COMMIT observer (the shell's playerView watcher calls it on
 * EVERY committed view while a transaction is live). Two jobs:
 *
 *   1. FALLBACK CLAIM — a commit path that bypasses the gated detect (the
 *      staged bot pipeline applying the buffered view, a poll after a lost
 *      response) still claims the manifest here, so the transaction can
 *      never strand armed while its reveal/track go unclaimed. A fallback
 *      claim runs POST-commit, so it deliberately does NOT seed the panel
 *      hold (the delta chips already fired with that commit — seeding now
 *      would visibly dip the values); the chip flights then play as pure
 *      decoration over already-honest numbers.
 *
 *   2. KICK — start the reward waves exactly once, after whichever commit
 *      carried the claimed manifest (the gated path also kicks explicitly;
 *      both are idempotent via `rewardsKicked`).
 */
export function noticeColonyTradeCommit(view: PlayerViewModel): void {
  if (!colonyTradeState.active) {
    return;
  }
  const manifest = view.colonyTradeManifest;
  if (!ctx.claimed) {
    if (manifest === undefined ||
        manifest.colonyName !== colonyTradeState.colonyName ||
        seenTradeIds.has(manifest.tradeId)) {
      return;
    }
    claimManifest(manifest);
    tradeLog('claimed from committed view (staged/poll path)', manifest.tradeId);
  }
  if (!ctx.rewardsKicked && ctx.manifest !== undefined &&
      manifest?.tradeId === ctx.manifest.tradeId) {
    void runColonyTradeRewards();
  }
}

/**
 * ADVANCE — the conclusion fires only when ALL THREE gates are open:
 *   1. the chip waves finished;
 *   2. every staged reveal batch was confirmed (cards taken);
 *   3. the server's track reset COMMITTED (or the marker never moves).
 * Called from each gate's own completion signal; re-entrant safe.
 */
function maybeAdvance(): void {
  if (!colonyTradeState.active || ctx.glideStarted || !ctx.claimed) {
    return;
  }
  if (colonyTradeState.phase !== 'awaiting' || colonyTradeState.cardScene !== 'idle') {
    return;
  }
  if (!ctx.chipsDone || !stagedRevealsConfirmed()) {
    return;
  }
  const moves = colonyTradeState.postTrackPosition < colonyTradeState.preTrackPosition;
  if (moves && !(ctx.committedTrack !== undefined && ctx.committedTrack <= colonyTradeState.postTrackPosition)) {
    return; // the server hasn't reset yet (an interactive bonus is still resolving)
  }
  ctx.glideStarted = true;
  colonyTradeState.beat = 'update';
  if (moves) {
    colonyTradeState.phase = 'glide';
    colonyTradeState.glideNonce++;
    tradeLog('track glide start', colonyTradeState.preTrackPosition, '→', colonyTradeState.postTrackPosition);
    // The layer measures the cells and runs the director; a closed colonies
    // screen (no measurable track) reports back immediately via
    // finishColonyTrackReset — the values then release honestly.
  } else {
    tradeLog('track holds position — confirm pulse');
    finishColonyTrackReset();
  }
}

/** The glide plan of the CURRENT transaction (the layer asks). */
export function colonyTradeGlidePlan(): TrackGlidePlan | undefined {
  return trackGlidePlan(colonyTradeState.preTrackPosition, colonyTradeState.postTrackPosition);
}

/**
 * The marker LANDED (or never moved / couldn't be staged): release the frozen
 * track — the tile snaps to the committed position under the settled proxy,
 * the «4/7» readout flips, the «ТОРГОВАТЬ» value morphs — then the one-shot
 * settle glow, then the transaction closes.
 */
export function finishColonyTrackReset(): void {
  if (!colonyTradeState.active) {
    return;
  }
  colonyTradeState.trackHold = false;
  colonyTradeState.settledCell = colonyTradeState.postTrackPosition;
  colonyTradeState.phase = 'settle';
  tradeLog('track settled at', colonyTradeState.postTrackPosition);
  const r = glideResolver;
  glideResolver = undefined;
  r?.();
  if (settleTimerId !== 0) {
    clearTimeout(settleTimerId);
  }
  settleTimerId = setTimeout(() => {
    settleTimerId = 0;
    colonyTradeState.settledCell = -1;
    finishTrade();
  }, motionMs(colonyTradeState.reducedMotion ? 120 : TRACK_SETTLE_MS + 640)) as unknown as number;
}

/** Close the transaction (staged ids + seen tradeIds are kept — memory). */
function finishTrade(): void {
  if (!colonyTradeState.active) {
    return;
  }
  clearCeiling();
  clearArmSafety();
  colonyTradeState.active = false;
  colonyTradeState.phase = 'idle';
  colonyTradeState.cardScene = 'idle';
  colonyTradeState.beat = '';
  colonyTradeState.trackHold = false;
  colonyTradeState.colonyName = '';
  colonyTradeState.color = '';
  colonyTradeState.tradeId = '';
  ctx.manifest = undefined;
  ctx.targets = undefined;
  tradeLog('transaction finished');
}

/** Ceiling / degraded conclusion: snap every presented value to committed. */
function concludeToCommitted(): void {
  colonyTradeState.trackHold = false;
  colonyTradeState.cardScene = 'idle';
  finishTrade();
}

/**
 * ABORT (submit rejected / network failure — the trade did NOT happen, or a
 * teardown): unwind with zero trace. The panel holds seeded by THIS
 * transaction release honestly (values snap to the committed truth).
 */
export function abortColonyTrade(): void {
  clearArmSafety();
  clearCeiling();
  if (settleTimerId !== 0) {
    clearTimeout(settleTimerId);
    settleTimerId = 0;
  }
  if (!colonyTradeState.active) {
    return;
  }
  tradeLog('aborted');
  if (ctx.seeded && ctx.manifest !== undefined && colonyTradeState.color !== '') {
    // Release exactly what we held — never a shared clear that could drop
    // another scene's pending holds.
    for (const spec of colonyTradeHeldSpecs(ctx.manifest, colonyTradeState.color, ctx.targets)) {
      releasePanelRewardHold(spec);
    }
  }
  const r = glideResolver;
  glideResolver = undefined;
  r?.();
  colonyTradeState.active = false;
  colonyTradeState.phase = 'idle';
  colonyTradeState.cardScene = 'idle';
  colonyTradeState.beat = '';
  colonyTradeState.trackHold = false;
  colonyTradeState.settledCell = -1;
  colonyTradeState.colonyName = '';
  colonyTradeState.color = '';
  colonyTradeState.tradeId = '';
  ctx.manifest = undefined;
  ctx.targets = undefined;
  ctx.claimed = false;
  ctx.seeded = false;
  ctx.chipsDone = false;
  ctx.rewardsKicked = false;
  ctx.committedTrack = undefined;
  ctx.glideStarted = false;
}

/** Test-only full reset (including the session memories). */
export function resetColonyTrade(): void {
  abortColonyTrade();
  seenTradeIds.clear();
  colonyTradeState.stagedRevealIds = [];
  colonyTradeState.zoomEntryReady = false;
  colonyTradeState.glideNonce = 0;
  registerColonyTradeZoomOrigin(undefined);
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
