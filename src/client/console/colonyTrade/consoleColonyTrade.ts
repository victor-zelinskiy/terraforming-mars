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
import {cardDiscardColonyBonus} from '@/client/console/cardDiscard/consoleCardDiscard';
import {Color} from '@/common/Color';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {CardDrawRevealSource, intakeBatchSources} from '@/common/models/CardDrawRevealModel';
import {ColonyTradeManifestModel} from '@/common/models/ColonyTradeManifestModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {consoleFxLiteState} from '@/client/console/consoleFxLite';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';
import {translateText} from '@/client/directives/i18n';
import {
  beginPanelRewardHold, cardResourceLandings, declareHeldAnswers, releasePanelRewardHold, resetCardResourceLandings, runResourceTransfers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec, TRANSFER_RESIDUAL_PAUSE_MS, railRowKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {cardReactionAnswerFlight, reactionDeclarationBlock} from '@/client/console/cardReaction/cardReactionDirector';
import {motionMs} from '@/client/components/motion/motionTokens';
import {TradeReceiptBase} from '@/client/console/colonyTrade/colonyTradeReceipt';
import {settlementClaimsBatch} from '@/client/console/colonyTrade/settlementTable';
import {registerLivenessRelease} from '@/client/console/consoleLiveness';
import {
  ColonyTradeTargets, benefitCardCount, bonusHandsOverCard, colonyTradeAnswerSpecs, colonyTradeHeldSpecs, incomeTransferSpecs,
  ownBonusTransferSpecs, viewerBonusCubes,
  trackAdvancePlan, trackGlidePlan, TrackGlidePlan, TRACK_SETTLE_MS, trackWavePlan, TrackWavePlan, TrackMoveRhythm,
} from '@/client/console/colonyTrade/colonyTradeModel';
import {registerWaitSource} from '@/client/console/waitGraph/waitGraph';
import {consoleSessionScope, sessionState} from '@/client/console/session/consoleSession';
import {createFlowRun} from '@/client/console/session/flowRun';
import {onPressUnlanded} from '@/client/console/transport/pressUnwind';
import {owedAnswer} from '@/client/console/session/owedAnswer';

/**
 * The ADVANCE leg's own net: whatever happens to the track's measurability,
 * the payout must go on. Generous enough for the longest honest glide (a
 * 6-cell sweep + the settle) and short enough never to read as a stall.
 */
const TRACK_ADVANCE_SAFETY_MS = 1800;

/**
 * The receiving scene's hand-over between two waves that pay DIFFERENT cards — the pose transition of
 * `.con-colfocus__landcell` (280 ms) plus a short read of the new subject before its first token is born.
 */
const RECEIVING_HANDOVER_MS = 340;

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
export type ColonyTradePhase = 'idle' | 'armed' | 'advance' | 'chips' | 'awaiting' | 'glide' | 'settle';

/**
 * The card-cover scene of a staged trade reveal batch (the layer drives it).
 * `fly` covers the FAN + the early departures — the colony scene must still
 * stand under them; `ascend` is the layer's cue that the first cover is deep
 * into its travel and ALMOST GROWN, which is the moment the stage may start
 * dissolving underneath (the focus stage's handoff keys on it — releasing at
 * `fly` was «интерфейс уже исчез в момент отделения карт»).
 */
export type ColonyTradeCardScene = 'idle' | 'fly' | 'ascend' | 'frame' | 'handoff';

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
  /**
   * WHICH LEG the current glide nonce means — the layer runs ONE mechanism and
   * asks this for the plan and for who to report the landing to.
   *  · `advance` — the pre-trade offset step (a trade-offset card moved the
   *    track FORWARD before the reward was read);
   *  · `reset`   — the closing step back to the built-colony count.
   */
  glideKind: 'advance' | 'reset';
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
  glideKind: 'reset',
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
  /**
   * THE TRACK POSITION THE PLAYER PRESSED AT — captured at the arm, before the
   * server's pre-trade advance. `-1` = unknown (a path that armed without it),
   * where the advance leg is simply skipped: an animation is never invented
   * from a guessed origin.
   */
  advanceFrom: number;
  /** The advance leg is owed (claimed a manifest that moved the track up). */
  advancePending: boolean;
  /** Resolves when the advance leg has landed (the rewards await it). */
  advanceResolve: (() => void) | undefined;
  /**
   * A reveal batch of THIS trade has been observed at least once. The draws
   * ride the trade's own response, but the reveal list is reconciled by its
   * own watcher — so for a flush or two after the commit «no batch here» means
   * «not yet», not «none coming». Latched, never re-cleared.
   */
  revealSeen: boolean;
  /**
   * The colony's own WORKING AREA is handed over to the payout right now (the
   * focus stage publishes it). The track is drawn there, so the reset may not
   * play while it holds — see `setColonyStageYielded`.
   */
  stageYielded: boolean;
  /**
   * THE CARDS' ANSWER to this trade (P90 Venus Trade Hub — `colonyTradeAnswerSpecs`): the apply block the rows were
   * DECLARED in (`reactionDeclarationBlock`), handed back to `cardReactionAnswerFlight({block})` — 0 when none.
   */
  answerBlock: number;
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
  advanceFrom: -1,
  advancePending: false,
  advanceResolve: undefined,
  revealSeen: false,
  stageYielded: false,
  answerBlock: 0,
};

/** Trades already presented this session — a poll replay can never re-play one. */
const seenTradeIds = new Set<string>();

/**
 * THE RECEIPT'S BASE (`colonyTradeReceipt.ts`), remembered for the
 * transaction's whole life. The focus stage takes it at the commit boundary;
 * it is kept HERE, not in the stage, because a stage may MOUNT mid-resolution
 * (the post-discard restore) — and by then the live stock already holds the
 * payout. The transaction's own end paths forget it, so it never outlives the
 * trade it describes. The shell pins the stage BEFORE it arms the trade, so
 * the arm must not clear it.
 */
let receiptBase: {colony: string, base: TradeReceiptBase} | undefined;

/** The stage took its boundary snapshot of `colony` from a pre-answer view. */
export function noteColonyTradeReceiptBase(colony: string, base: TradeReceiptBase): void {
  receiptBase = {colony, base};
}

/**
 * The remembered base — ONLY once the server's answer has been CLAIMED for
 * this colony's trade (`ctx.claimed`: the claim runs in the same synchronous
 * block as the view apply, so from then on the live view holds the payout —
 * the phase stays `armed` until the rewards start, which is too late). Before
 * the claim the live view IS the pre-trade view, and the caller reads it (and
 * notes it) itself.
 */
export function colonyTradeReceiptBase(colony: string): TradeReceiptBase | undefined {
  if (!colonyTradeState.active || colonyTradeState.colonyName !== colony || !ctx.claimed) {
    return undefined;
  }
  return receiptBase?.colony === colony ? receiptBase.base : undefined;
}

/**
 * THE TRANSACTION'S RUN IN THE FLOW TREE (architecture v2 — PLAN §10 · C4): `scene:colony-trade#n` in the session, from
 * the arm to the transaction's end (finished, concluded, aborted). It OWNS every timer of the transaction — the arm's
 * safety, the reveal wait, the ceiling, the parked net, the advance net, the settle — so each is taken back when the
 * run ends and when a NEW trade arms (R6 by construction: a timer of the trade that is over cannot fire at all, rather
 * than firing and asking `isLiveRun`); the reward run's pauses are spans of it; and when the game screen leaves under
 * it the transaction is aborted (`orphaned`).
 */
const tradeFlow = createFlowRun('colony-trade', {orphaned: () => abortColonyTrade()});
const NO_TIMER = (): void => {};
let cancelArmSafety: () => void = NO_TIMER;
let cancelCeiling: () => void = NO_TIMER;
let cancelSettle: () => void = NO_TIMER;
let cancelRevealWait: () => void = NO_TIMER;
let cancelParkedNet: () => void = NO_TIMER;
/** The parked net is armed (its evidence stands) — `syncParkedEvidence` arms it once and disarms it when the proof goes. */
let parkedNetArmed = false;
let cancelAdvanceSafety: () => void = NO_TIMER;
const glideResolver = owedAnswer('colony-trade:glide', {orphaned: () => []});

/**
 * THE RUN'S OWN IDENTITY (wait graph R6). Bumped by every arm; every ENDING of a transaction — a timer (settle, the
 * parked net, the reveal wait, the ceiling, the arm safety, the advance net) and every continuation of the reward run
 * after an await — captures it when it is set up and acts only while it still names the live run. `active` is a
 * GLOBAL flag the NEXT trade raises again, so an ending keyed on it alone let an old trade's settle timer finish a new
 * trade (or its chip run write `chipsDone` into the new trade's context).
 */
let tradeRun = 0;

/** The run whose seeded holds an ABORT already released in full (a stale run must not release them again). */
let heldReleasedRun = -1;

/** The transaction `run` is still the live one (armed by this very arm and not ended since). */
function isLiveRun(run: number): boolean {
  return colonyTradeState.active && run === tradeRun;
}

/** The live run's identity — the spec reads it to prove an old run's ending cannot touch a new one. */
export function colonyTradeRunId(): number {
  return tradeRun;
}

/**
 * How long the conclusion waits for a PROMISED card that never arrived. The
 * draws ride the trade's own response, so this is only ever the degrade net of
 * the one case the server itself models: an exhausted deck yields no reveal
 * batch at all (`ColonyTradeManifest.spec.ts`). Bounded and named, so the
 * marker never sits frozen on a track whose payout is over.
 */
const REVEAL_WAIT_MS = 4_000;

/**
 * THE QUEUE IS PARKED ON SOMEBODY ELSE — the degrade net of a reset that
 * cannot arrive by anything the viewer does. The server sequences every
 * foreign colony bonus BEHIND the trade's own finalizer (detached delivery),
 * so the committed reset normally rides the trader's own response chain; but
 * a view can still prove the opposite shape (an off-turn forced reaction
 * wedged mid-trade, an older server). The proof is entirely in the fetched
 * view: the viewer owes nothing, another player holds the game's pending
 * input, every other conclusion gate is open, and the reset is still
 * uncommitted. Standing on that state is a frozen screen — the old blind
 * 60 s ceiling was exactly this hang — so the transaction concludes to
 * committed truth on a short, NAMED net instead, and the workspace releases
 * the player to the board where the waiting player's chip tells the story.
 */
const TRADE_PARKED_NET_MS = 2_500;

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
 * THE TRACK IS STILL MOVING TO THE CELL THIS PAYOUT IS READ AT.
 *
 * ONE authoritative fact, and every consumer of «may the payout begin?» obeys
 * it: the cover scene's wait, the colony stage's dissolve cue, the input lock,
 * the animation hold. The payout is a CONSEQUENCE of the marker arriving —
 * the covers, the reveal and the stage's own dissolve starting mid-glide read
 * as two unrelated things happening at once, and the interface the marker is
 * gliding across disappears from under it.
 */
export function colonyTrackAdvancing(): boolean {
  return colonyTradeState.active && colonyTradeState.phase === 'advance';
}

/**
 * THE PAYOUT HAS NOT BEGUN YET — the cover scene waits on this before a single
 * card moves, so the cards can never overlap the beats that CAUSE them.
 *
 * Three phases count, and `armed` is the one that is easy to miss: a batch is
 * claimed on a PRE-FLUSH watcher while the reward run starts a tick later, so
 * a predicate that only knew `advance`/`chips` could sample the phase before
 * it had been set and let the covers fly straight into the track glide. The
 * caller bounds its own wait — a transaction that never runs its rewards (a
 * degraded claim after a lost response) must not strand the batch.
 */
export function colonyPayoutPending(): boolean {
  const p = colonyTradeState.phase;
  return colonyTradeState.active && (p === 'armed' || p === 'advance' || p === 'chips');
}

/**
 * The pad is inert while a scene beat physically plays: the pre-trade track
 * advance, the chip waves, the card covers (until the reveal becomes
 * interactive at handoff) and the marker glide. DELIBERATELY FREE during
 * `awaiting` (a Pluto discard prompt between two bonus draws needs the pad)
 * and `settle` (pure decoration).
 */
/**
 * Other owners of the colonies' moment that lock the pad the same way (a play's raise owed before its pick —
 * `colonyTrackRaise.ts`, P48). Registered, so this module never imports its own clients.
 */
const colonyInputLocks: Array<() => boolean> = [];

export function registerColonyInputLock(lock: () => boolean): void {
  colonyInputLocks.push(lock);
}

export function isColonyTradeInputLocked(): boolean {
  if (colonyInputLocks.some((lock) => lock())) {
    return true;
  }
  // A LAW'S WAVE over every track (Unity Budget) owns the moment exactly as a trade's glide does: the
  // colonies stand as a SHOW step of the sitting, nothing is asked, and a press there could only open a
  // trade over a moving marker or fold the sitting under its own beat. Bounded by the wave's net.
  if (colonyTrackWaveState.active) {
    return true;
  }
  if (!colonyTradeState.active) {
    return false;
  }
  if (colonyTradeState.phase === 'advance' || colonyTradeState.phase === 'chips' ||
      colonyTradeState.phase === 'glide') {
    return true;
  }
  return colonyTradeState.cardScene === 'fly' || colonyTradeState.cardScene === 'ascend' ||
    colonyTradeState.cardScene === 'frame';
}

/** A scene beat is on stage — notifications queue, mandatory surfaces wait.
 *  `awaiting` is excluded: the reveal / a discard prompt OWNS that window. */
function colonyTradeHolding(): boolean {
  if (!colonyTradeState.active) {
    return false;
  }
  return colonyTradeState.phase === 'advance' || colonyTradeState.phase === 'chips' ||
    colonyTradeState.phase === 'glide' || colonyTradeState.cardScene !== 'idle';
}

// THE CEILING ENDS THE WEDGE, NOT JUST THE COUNT: a trade standing in a scene beat past the ceiling concludes to the
// committed truth — the transaction's own 60 s ceiling and its liveness rung, run at the hold's ceiling instead.
registerAnimationHoldSupplier('colony-trade', colonyTradeHolding, {
  expire: () => {
    if (!colonyTradeHolding()) {
      return;
    }
    console.warn(`[colony-trade] ${colonyTradeState.colonyName} ${colonyTradeState.phase}/${colonyTradeState.cardScene}: outlived its ceiling — ended`);
    concludeToCommitted();
  },
});

/**
 * The presented colony model: while the transaction FREEZES the traded
 * colony's track, every console surface (tile / focused summary / inspect)
 * reads the pre-trade position through this ONE helper — so the committed
 * reset can never flash through early on any of them. Everything else about
 * the colony (cubes, visitor, name) passes through untouched.
 */
export function presentedColonyModel(colony: ColonyModel): ColonyModel {
  // A LAW'S SHOW STEP holds every tile it has not yet moved on screen (the wave below) — the same freeze,
  // for the whole table: the value moves only through the glide.
  const held = heldTrackPositions.get(colony.name);
  if (held !== undefined) {
    return {...colony, trackPosition: held};
  }
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
 * ⚠️ THE ONE-FRAME FLASH GUARD. This batch belongs to the live transaction and
 * the scene is ABOUT to claim it — true from the instant the batch exists,
 * BEFORE the layer's watcher has run.
 *
 * The reveal modal must veil on THIS, not on `isColonyTradeRevealStaged`. The
 * claim rides `ConsoleColonyTradeLayer`'s pre-flush watcher, whose scheduler job
 * is ordered by the LAYER's component uid — which is higher than the shell's, so
 * the shell's render (which MOUNTS the modal) runs first. The modal therefore
 * gets one render with no veil classes: it paints its frame, header and source
 * chip at full opacity and starts its entrance, and the veil then fades it away
 * — the flash the player sees before the cards fly in.
 *
 * ⚠️ STRICTLY ONE-SHOT, per batch. `stagedRevealIds` is the latch: once the
 * layer has taken this batch, this must NEVER answer true again. The scene
 * returns `cardScene` to `'idle'` when it FINISHES (the transaction stays active
 * afterwards — it is still waiting for the player to take the cards), so
 * without the staged check the predicate fires a second time and re-veils the
 * modal that has just finished materializing: the cards are gone but the input
 * still works. Hands off cleanly instead — from the claim on,
 * `isColonyTradeRevealStaged` owns this batch exclusively.
 *
 * Bounded by the transaction's own lifetime (arm safety / ceiling / abort all
 * clear `active`), so an un-claimed batch can never stay veiled indefinitely.
 */
export function colonyTradeWillDressReveal(
  eventId: number | undefined,
  source: CardDrawRevealSource | undefined,
): boolean {
  return colonyTradeState.active &&
    !colonyTradeState.reducedMotion &&
    colonyTradeState.cardScene === 'idle' &&
    !isColonyTradeRevealStaged(eventId) &&
    colonyTradeClaimsReveal(source) &&
    // …and never a SETTLEMENT TABLE's later place (colony polish 1): the cover scene does not dress that batch —
    // its card already lies on the table and turns over in place — so «about to claim» would veil it forever.
    !settlementClaimsBatch(source);
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
  ctx.revealSeen = true; // a batch of ours exists, whatever the store says next
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
 * How many cards this trade is PLANNED to hand the VIEWER — the manifest's own
 * arithmetic (income only when they are the trader, plus one payout per cube
 * they own). Known at claim time, before any card has been drawn.
 */
function plannedViewerCards(): number {
  const m = ctx.manifest;
  const viewer = colonyTradeState.color;
  if (m === undefined || viewer === '') {
    return 0;
  }
  const income = m.trader === viewer ? benefitCardCount(m.tradeIncome) : 0;
  const bonus = m.colonyBonus === undefined ?
    0 :
    benefitCardCount(m.colonyBonus) * viewerBonusCubes(m, viewer as Color);
  return income + bonus;
}

/**
 * IS A CARD OF THIS TRADE STILL OWED? The reveal gate of the conclusion — and
 * the reason the track reset is the resolution's LAST beat.
 *
 * ⚠️ IT READS THE BATCHES BY TRADE ID, NEVER THE STAGING LIST. The staging list
 * is what the COVER SCENE has claimed, and it fills a tick or two after the
 * batch lands — so «nothing staged» is «not yet», not «nothing owed». Asking
 * it instead let the whole conclusion run inside that gap: with a colony whose
 * income IS the draw (Pluto), there are no chips to wait for, so the commit
 * went straight to `awaiting` → the gate saw an EMPTY list → the marker glided
 * across the track while the first card was still flying to the table.
 *
 * The second term covers the same gap from the other side: while the plan
 * promises cards and none has arrived yet, the trade is still mid-payout.
 * `revealSeen` latches on the first batch (and on the honest degrade net), so
 * a taken-and-acked batch — gone from the store — never re-opens the gate.
 */
function tradeCardsOutstanding(): boolean {
  const tradeId = colonyTradeState.tradeId;
  if (tradeId === '') {
    return false;
  }
  // ANY SEGMENT, never the root alone — a CLAIM answers for the batch when any of its segments is its own (the batch's
  // contract; a PARK holds by the root). The Redux Venus pays its step FIRST, so the trade's batch is rooted on the 8 %
  // card: read off the root, the trade never saw its own cards arrive, stood `awaiting` forever and the owner bonus's
  // discard never opened (`console-colony-venus-trade`, 2026-10-30).
  const mine = drawnCardsState.events.filter((e) => intakeBatchSources(e).some((source) =>
    source?.type === 'colony' && source.trade?.tradeId === tradeId));
  if (mine.length > 0) {
    ctx.revealSeen = true;
  }
  if (mine.some((e) => !e.dismissed)) {
    return true;
  }
  return plannedViewerCards() > 0 && !ctx.revealSeen;
}

// The reveal-confirmed watcher: the last card of this trade leaving the table
// is one of the three signals that advance the conclusion (module-level watch
// — the same idiom presentationFlow uses).
watch(
  () => colonyTradeState.active && !tradeCardsOutstanding(),
  (clear) => {
    if (clear) {
      maybeAdvance();
    }
  },
);

// The disposal-landed watcher: a colony-bonus discard flight ending is the
// fourth signal — the marker's closing glide waits out the whole disposal
// (`maybeAdvance`'s discard gate) and this falling edge re-asks it.
watch(
  () => cardDiscardColonyBonus() !== undefined,
  (live) => {
    if (!live) {
      maybeAdvance();
    }
  },
);

// ── lifecycle ───────────────────────────────────────────────────────────────

function clearArmSafety(): void {
  cancelArmSafety();
  cancelArmSafety = NO_TIMER;
}

function clearCeiling(): void {
  cancelCeiling();
  cancelCeiling = NO_TIMER;
}

function clearRevealWait(): void {
  cancelRevealWait();
  cancelRevealWait = NO_TIMER;
}

function clearSettleTimer(): void {
  cancelSettle();
  cancelSettle = NO_TIMER;
}

function clearAdvanceSafety(): void {
  cancelAdvanceSafety();
  cancelAdvanceSafety = NO_TIMER;
}

/**
 * EVERY TIMER AND EVERY AWAIT OF THE PREVIOUS RUN LETS GO (R6) — the arm of a new trade is the old one's last word.
 * The timers are cleared; a pending glide / advance await is resolved so its run unwinds, and the run identity it
 * captured no longer matches, so it writes nothing into the new transaction.
 */
function releasePreviousRun(): void {
  clearArmSafety();
  clearCeiling();
  clearRevealWait();
  clearParkedNet();
  clearSettleTimer();
  clearAdvanceSafety();
  const g = glideResolver.take();
  g?.();
  const a = ctx.advanceResolve;
  ctx.advanceResolve = undefined;
  a?.();
}

/**
 * ARM (the composer confirm, right next to `armTradeFleet`) — the transaction
 * exists from the player's own press. `targets` carries the composer's
 * pre-collected card-resource destinations so the chips can fly onto the
 * exact chosen host cards.
 */
export function armColonyTrade(
  colonyName: ColonyName,
  color: Color,
  targets?: ColonyTradeTargets,
  /** The colony's track position AS THE PLAYER PRESSED — the origin of the
   *  pre-trade advance leg (the server's own `increaseTrack` is what moves it
   *  from here to the manifest's `preTradeTrackPosition`). Omit and the
   *  advance is skipped rather than guessed. */
  trackPosition?: number,
): void {
  releasePreviousRun();
  const run = ++tradeRun;
  tradeFlow.begin(colonyName); // the previous run's scope ends here — whatever it still had armed goes with it
  ctx.manifest = undefined;
  ctx.targets = targets;
  ctx.claimed = false;
  ctx.seeded = false;
  ctx.chipsDone = false;
  ctx.rewardsKicked = false;
  ctx.committedTrack = undefined;
  ctx.glideStarted = false;
  ctx.advanceFrom = trackPosition ?? -1;
  ctx.advancePending = false;
  ctx.advanceResolve = undefined;
  ctx.revealSeen = false;
  ctx.stageYielded = false;
  ctx.answerBlock = 0;
  colonyTradeState.active = true;
  colonyTradeState.phase = 'armed';
  colonyTradeState.cardScene = 'idle';
  colonyTradeState.beat = '';
  colonyTradeState.colonyName = colonyName;
  colonyTradeState.color = color;
  colonyTradeState.tradeId = '';
  colonyTradeState.trackHold = false;
  colonyTradeState.glideKind = 'reset';
  colonyTradeState.settledCell = -1;
  resetCardResourceLandings();
  colonyTradeState.zoomEntryReady = false;
  colonyTradeState.reducedMotion = consoleReducedMotionActive();
  tradeLog('armed', colonyName);
  // The fleet's own 12 s abort net recalls the flight on a dropped submit;
  // this net just clears the never-claimed transaction shell after it.
  cancelArmSafety = tradeFlow.after(15_000, 'the arm\'s safety (no manifest claimed it)', () => {
    if (isLiveRun(run) && !ctx.claimed) {
      tradeLog('arm safety — never claimed, resetting');
      abortColonyTrade();
    }
  });
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
  const run = tradeRun;
  seenTradeIds.add(manifest.tradeId);
  clearArmSafety();
  ctx.claimed = true;
  ctx.manifest = manifest;
  colonyTradeState.tradeId = manifest.tradeId;
  colonyTradeState.preTrackPosition = manifest.preTradeTrackPosition;
  colonyTradeState.postTrackPosition = manifest.postTradeTrackPosition;
  colonyTradeState.trackHold = manifest.postTradeTrackPosition < manifest.preTradeTrackPosition;
  /*
   * THE PRE-TRADE ADVANCE. A trade-offset card («Торговая колония») moved the
   * track FORWARD before the reward was read — the server did it inside this
   * very response, so the committed position is already the advanced one and
   * the marker would simply APPEAR further along. Hold the display at the cell
   * the player pressed on and owe an advance leg: the same physical glide as
   * the reset, in the other direction, played BEFORE the income is paid.
   *
   * Several offset cards are one summed move by construction — the origin is
   * the pressed cell and the destination is the server's own post-advance
   * position, never a client sum of card behaviours.
   */
  ctx.advancePending = ctx.advanceFrom >= 0 && manifest.preTradeTrackPosition > ctx.advanceFrom;
  if (ctx.advancePending) {
    colonyTradeState.glideKind = 'advance';
    colonyTradeState.preTrackPosition = ctx.advanceFrom;
    colonyTradeState.trackHold = true;
  } else {
    colonyTradeState.glideKind = 'reset';
  }
  // A PROMISED card that never arrives (an exhausted deck) must not freeze the
  // marker on the track: the wait for it is bounded and names itself.
  clearRevealWait();
  if (plannedViewerCards() > 0) {
    cancelRevealWait = tradeFlow.after(REVEAL_WAIT_MS, 'the promised cards\' reveal', () => {
      if (isLiveRun(run) && !ctx.revealSeen) {
        tradeLog('promised cards never arrived — concluding without them');
        ctx.revealSeen = true;
        maybeAdvance();
      }
    });
  }
  // The whole transaction is bounded: whatever stalls (a lost reveal, a
  // never-arriving reset), the ceiling concludes honestly to committed truth.
  clearCeiling();
  cancelCeiling = tradeFlow.after(60_000, 'the transaction\'s ceiling', () => {
    if (isLiveRun(run)) {
      tradeLog('transaction ceiling — concluding to committed state');
      concludeToCommitted();
    }
  });
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
  // The cards' answer (Venus Trade Hub's +3 M€) is held above WITH the income and DECLARED here: the card-reaction
  // seeder (last in the same block) then attaches the card's record to this scene instead of holding the row twice.
  const answers = colonyTradeAnswerSpecs(ctx.manifest, colonyTradeState.color as Color);
  if (answers.length > 0) {
    declareHeldAnswers(answers);
    ctx.answerBlock = reactionDeclarationBlock();
  }
}

/**
 * THE CARD ANSWERS THE TRADE (P90 — «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК», ATTACHED): the reactor rises (in its place
 * when its face is on screen, else at the rail's edge), each token is born on its printed effect icon and the row
 * ticks on its own touchdown. Nothing attached (reduced motion, a reload, no record) or no place to be born → the
 * rows tick at once. Never rejects.
 */
async function flyTradeAnswer(specs: ReadonlyArray<ResourceTransferSpec>): Promise<void> {
  const flight = cardReactionAnswerFlight({block: ctx.answerBlock, rows: [...new Set(specs.map((spec) => railRowKey(spec)))]});
  if (flight === undefined) {
    specs.forEach((spec) => releasePanelRewardHold(spec));
    tradeLog('answer ticked (nothing attached)');
    return;
  }
  try {
    await flight.prepare?.();
    const tokens = specs.flatMap((spec) => flight.tokensOf?.(spec) ?? [spec]);
    const origins = tokens.map((spec) => flight.originOf(spec));
    if (!origins.every((o) => o !== undefined)) {
      specs.forEach((spec) => releasePanelRewardHold(spec));
      tradeLog('answer ticked (no origin)');
      return;
    }
    await runResourceTransfers({specs: tokens, source: {}, origins, arrival: 'auto', onArrive: (spec) => releasePanelRewardHold(spec)});
    tradeLog('answer landed', tokens.length);
  } finally {
    flight.onLeft();
    flight.onDone?.();
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
  // Every continuation below re-asks THIS run (R6): an await may resume after the next trade's arm, and `active` is
  // that trade's flag — a stale run must never write its phase / `chipsDone` into the new transaction.
  const run = tradeRun;
  const manifest = ctx.manifest;
  const viewer = colonyTradeState.color as Color;
  const targets = ctx.targets;
  const seeded = ctx.seeded;
  const income = manifest.trader === viewer ? incomeTransferSpecs(manifest, targets) : [];
  const answers = colonyTradeAnswerSpecs(manifest, viewer);
  const bonus = ownBonusTransferSpecs(manifest, viewer, targets);
  // ── THE ADVANCE LEG FIRST. The reward is READ at the advanced cell, so the
  //    marker gets there before anything is paid: the player watches the
  //    position they are about to be paid at being earned. Bounded — a track
  //    that cannot be measured releases the gate honestly (the layer's own
  //    degrade), and the payout continues either way.
  await runTrackAdvance();
  if (!isLiveRun(run)) {
    releaseUnflownHolds(run, seeded, [...income, ...answers, ...bonus]);
    return;
  }
  colonyTradeState.phase = 'chips';
  colonyTradeState.beat = 'income';
  tradeLog('chip waves start');
  const name = colonyTradeState.colonyName;
  const tileSel = `[data-test="con-colony-${name}"]`;
  const sel = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name;
  // The trade RESOLVES ON THE FOCUS STAGE when it is up: the income launches
  // from the stage's own TIGHT reward value and the owners' bonus from the
  // berth zone that pays it — never from a whole panel, or the chips read as
  // "born somewhere in that area" instead of "born from that number". The
  // stage's anchors lead the selector ladder and are KEYED BY COLONY (the
  // stage shows one colony, but an unkeyed match would fire for whichever it
  // happens to be showing); a closed stage simply doesn't match and the wave
  // falls back to the overview tile (the Pluto hand-discard detour case).
  // The touchdown is ONE beat with two consequences: the panel hold releases
  // (the rail's number ticks) and — for a card-resource reward — the chosen
  // host card's own frozen counter ticks and pops on the presented scene.
  if (income.length > 0) {
    await runResourceTransfers({
      specs: income,
      source: {selectors: [`.con-colfocus [data-colony-trade-source="${sel}"]`, `${tileSel} [data-colony-trade-source]`, tileSel]},
      arrival: 'auto',
      onArrive: releasePanelRewardHold,
    });
    if (!isLiveRun(run)) {
      releaseUnflownHolds(run, seeded, [...answers, ...bonus]);
      return;
    }
  }
  // THE CARDS' ANSWER rides the wave's TAIL — launched once the income has landed (the reactor answers the trade it
  // just watched pay), in parallel with the colony bonus, never after a pause of its own.
  const answered = answers.length > 0 ? flyTradeAnswer(answers) : Promise.resolve();
  if (bonus.length > 0) {
    if (income.length > 0 && bonusHandsOverCard(income, bonus)) {
      // TWO CARDS, TWO WAVES: the beat turns FIRST — the bonus's card stands forward, the income's steps back —
      // and the bonus's first token is born only once that hand-over has played (the receiving scene's own pose
      // transition), so the next wave is seen going somewhere new, never landing on a card still in the shade.
      colonyTradeState.beat = 'bonus';
      await tradeFlow.sleep(motionMs(RECEIVING_HANDOVER_MS));
    } else if (income.length > 0) {
      await tradeFlow.sleep(motionMs(TRANSFER_RESIDUAL_PAUSE_MS));
    }
    if (!isLiveRun(run)) {
      releaseUnflownHolds(run, seeded, bonus);
      return;
    }
    colonyTradeState.beat = 'bonus';
    await runResourceTransfers({
      specs: bonus,
      source: {selectors: [`.con-colfocus [data-colony-bonus-source="${sel}"]`, `${tileSel} [data-colony-bonus-source]`, tileSel]},
      arrival: 'auto',
      onArrive: releasePanelRewardHold,
    });
  }
  await answered;
  if (!isLiveRun(run)) {
    return;
  }
  ctx.chipsDone = true;
  if (colonyTradeState.phase === 'chips') {
    colonyTradeState.phase = 'awaiting';
  }
  tradeLog('chip waves done');
  maybeAdvance();
}

/**
 * A STALE RUN STOPS FLYING, BUT IT NEVER KEEPS A NUMBER HIDDEN (R6). A run that lost its identity mid-payout (the
 * ceiling / the liveness rung concluded it, or the next trade was armed) does not launch its remaining waves into a
 * transaction that is no longer its own — the rows those waves would have ticked snap to the committed truth instead.
 * An ABORT already released everything this run held (`heldReleasedRun`), so nothing is released twice.
 */
function releaseUnflownHolds(run: number, seeded: boolean, specs: ReadonlyArray<ResourceTransferSpec>): void {
  if (!seeded || heldReleasedRun === run) {
    return;
  }
  specs.forEach((spec) => releasePanelRewardHold(spec));
  tradeLog('stale run — unflown holds released', specs.length);
}

/**
 * THE CLOSING BEAT NEEDS ITS STAGE BACK — the colony focus stage publishes
 * whether its WORKING AREA is currently handed over to the payout.
 *
 * The track is drawn in that area, and a payout stands ON it (`--handing`
 * takes `.con-colfocus__main` to `opacity: 0`). Starting the reset there sent
 * the white marker gliding across an invisible track — «трек уже бежит по
 * пустому интерфейсу». The reset is the resolution's LAST beat in every
 * sense: the cards are taken, the colony is back on screen, and only then
 * does the marker move.
 *
 * Falling edge advances the conclusion; nothing else consults this.
 */
export function setColonyStageYielded(yielded: boolean): void {
  if (ctx.stageYielded === yielded) {
    return;
  }
  ctx.stageYielded = yielded;
  tradeLog('stage yielded', yielded);
  if (!yielded) {
    maybeAdvance();
  }
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
  syncParkedEvidence(view);
}

/**
 * Track the «parked on somebody else» proof across committed views (see
 * `TRADE_PARKED_NET_MS`). One writer: evidence arms the bounded net once,
 * losing it disarms — and the FIRE re-verifies everything live, so a reset
 * that commits (or a prompt that arrives) between views wins the race.
 */
function syncParkedEvidence(view: PlayerViewModel): void {
  const viewerColor = view.thisPlayer?.color;
  const parked = viewerColor !== undefined && view.waitingFor === undefined &&
    (view.players ?? []).some((p) => p.color !== viewerColor && p.isWaitingForInput);
  if (parked && resetStillOwed() && !parkedNetArmed) {
    tradeLog('view proves the queue is parked on another player — arming the bounded conclusion net');
    const run = tradeRun;
    parkedNetArmed = true;
    cancelParkedNet = tradeFlow.after(TRADE_PARKED_NET_MS, 'the queue parked on another player', () => {
      parkedNetArmed = false;
      if (!isLiveRun(run) || ctx.glideStarted || !resetStillOwed()) {
        return;
      }
      if (colonyTradeState.phase !== 'awaiting' || colonyTradeState.cardScene !== 'idle' ||
          !ctx.chipsDone || tradeCardsOutstanding() || ctx.stageYielded) {
        return; // some beat of the viewer's own is still playing — the ceiling still guards
      }
      tradeLog('queue parked on another player — concluding to committed truth');
      concludeToCommitted();
    });
  } else if (!parked && parkedNetArmed) {
    clearParkedNet();
  }
}

/** The one gate the parked net exists for: the reset is owed and uncommitted. */
function resetStillOwed(): boolean {
  const moves = colonyTradeState.postTrackPosition < colonyTradeState.preTrackPosition;
  return moves && !(ctx.committedTrack !== undefined && ctx.committedTrack <= colonyTradeState.postTrackPosition);
}

function clearParkedNet(): void {
  cancelParkedNet();
  cancelParkedNet = NO_TIMER;
  parkedNetArmed = false;
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
  if (!ctx.chipsDone || tradeCardsOutstanding()) {
    return;
  }
  // The colony's own track is not on screen yet (its working area is still
  // handed over to the payout, or coming back from it) — see
  // `setColonyStageYielded`. Its release calls back here.
  if (ctx.stageYielded) {
    return;
  }
  // THE MARKER IS THE FINAL BEAT — official rules: «после полного разрешения
  // наград белый маркер торговли опускается на самую нижнюю свободную
  // позицию трека». A colony-bonus DISCARD whose card is still physically
  // leaving the hand IS part of the rewards' resolution, so the reset may
  // not start under it — it used to launch into the tray-seating and the
  // restored stage's own entrance at once. The falling-edge watcher below
  // re-asks the moment the disposal lands.
  if (cardDiscardColonyBonus() !== undefined) {
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

/**
 * The glide plan of the CURRENT leg (the layer asks, one mechanism for both):
 * the pre-trade ADVANCE steps right off the pressed cell, the closing RESET
 * steps left to the built-colony count.
 */
export function colonyTradeGlidePlan(): TrackGlidePlan | undefined {
  if (colonyTradeState.glideKind === 'advance') {
    return trackAdvancePlan(ctx.advanceFrom, ctx.manifest?.preTradeTrackPosition ?? ctx.advanceFrom);
  }
  return trackGlidePlan(colonyTradeState.preTrackPosition, colonyTradeState.postTrackPosition);
}

/**
 * Run the pre-trade ADVANCE and wait for it to land. Resolves at once when
 * nothing is owed; bounded by its own net so a track that never becomes
 * measurable (a folded stage, a reduced-motion run) can never hold the payout
 * — the leg is a beat, never a gate on the game.
 */
function runTrackAdvance(): Promise<void> {
  if (!ctx.advancePending) {
    return Promise.resolve();
  }
  ctx.advancePending = false;
  if (colonyTradeState.reducedMotion) {
    finishColonyTrackAdvance();
    return Promise.resolve();
  }
  const run = tradeRun;
  return new Promise<void>((resolve) => {
    ctx.advanceResolve = resolve;
    colonyTradeState.phase = 'advance';
    colonyTradeState.glideKind = 'advance';
    colonyTradeState.glideNonce++;
    tradeLog('track advance', ctx.advanceFrom, '→', ctx.manifest?.preTradeTrackPosition);
    // The net is THIS run's (R6): kept by id, cleared by the landing and by the next arm, and it re-asks the run —
    // an old trade's net must never settle a NEW trade's advance leg.
    clearAdvanceSafety();
    cancelAdvanceSafety = tradeFlow.after(motionMs(TRACK_ADVANCE_SAFETY_MS), 'the advance leg\'s landing', () => {
      if (isLiveRun(run)) {
        finishColonyTrackAdvance();
      }
    });
  });
}

/**
 * The ADVANCE landed (or its net fired): the display moves to the position the
 * reward is read at, the leg hands over to the RESET one, and the payout goes
 * on. Idempotent — the net and the real landing may both arrive.
 */
export function finishColonyTrackAdvance(): void {
  if (colonyTradeState.glideKind !== 'advance') {
    return;
  }
  clearAdvanceSafety();
  colonyTradeState.glideKind = 'reset';
  const manifest = ctx.manifest;
  if (manifest !== undefined) {
    colonyTradeState.preTrackPosition = manifest.preTradeTrackPosition;
    colonyTradeState.trackHold = manifest.postTradeTrackPosition < manifest.preTradeTrackPosition;
    colonyTradeState.settledCell = manifest.preTradeTrackPosition;
  }
  tradeLog('track advance settled at', colonyTradeState.preTrackPosition);
  const r = ctx.advanceResolve;
  ctx.advanceResolve = undefined;
  r?.();
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
  const r = glideResolver.take();
  r?.();
  clearSettleTimer();
  // The settle ends THIS run only (R6) — the next trade armed inside the settle window owns `active` now.
  const run = tradeRun;
  cancelSettle = tradeFlow.after(motionMs(colonyTradeState.reducedMotion ? 120 : TRACK_SETTLE_MS + 640), 'the settle\'s glow', () => {
    if (!isLiveRun(run)) {
      return;
    }
    colonyTradeState.settledCell = -1;
    finishTrade();
  });
}

/** Close the transaction (staged ids + seen tradeIds are kept — memory). */
function finishTrade(): void {
  if (!colonyTradeState.active) {
    return;
  }
  clearCeiling();
  clearArmSafety();
  clearRevealWait();
  clearParkedNet();
  clearSettleTimer();
  clearAdvanceSafety();
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
  receiptBase = undefined;
  tradeLog('transaction finished');
  tradeFlow.end();
}

// THE LIVENESS ARBITER'S RUNG (rank 20): a transaction standing while the player cannot act (a cover scene whose
// flight never landed — `cardScene` locks the pad; a reset the server never committed) concludes to committed truth
// — the 60 s ceiling's own cure, run the moment the arbiter proves the stall instead of a minute later.
registerLivenessRelease({
  rank: 20,
  name: 'colony-trade',
  release: () => {
    if (!colonyTradeState.active) {
      return '';
    }
    const what = `${colonyTradeState.colonyName} ${colonyTradeState.phase}/${colonyTradeState.cardScene}`;
    tradeLog('liveness — concluding to committed state');
    concludeToCommitted();
    return `concluded ${what}`;
  },
});

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
/**
 * READ-ONLY snapshot for the e2e timeline probes (`__conColonyDiag().trade`):
 * the transaction's phase, what it ARMED (the pre-collected card targets), what
 * the server MANIFESTED (the income grants) and what has physically LANDED —
 * «the chip never flew» and «the chip flew onto nothing» stop looking alike.
 */
export function colonyTradeDiagnostics(): unknown {
  return {
    active: colonyTradeState.active,
    phase: colonyTradeState.phase,
    beat: colonyTradeState.beat,
    cardScene: colonyTradeState.cardScene,
    tradeId: colonyTradeState.tradeId,
    claimed: ctx.claimed,
    rewardsKicked: ctx.rewardsKicked,
    chipsDone: ctx.chipsDone,
    targets: ctx.targets ?? null,
    income: ctx.manifest?.tradeIncome ?? null,
    fixed: ctx.manifest?.tradeIncomeFixed ?? null,
    trader: ctx.manifest?.trader ?? null,
    viewer: colonyTradeState.color,
    landings: {...cardResourceLandings.by},
  };
}

export function abortColonyTrade(): void {
  clearArmSafety();
  clearCeiling();
  clearRevealWait();
  clearParkedNet();
  clearSettleTimer();
  clearAdvanceSafety();
  receiptBase = undefined;
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
    heldReleasedRun = tradeRun;
  }
  const r = glideResolver.take();
  r?.();
  // …and the ADVANCE leg's own gate: an abort mid-advance must free the
  // payout's await, or `runColonyTradeRewards` would sit on a promise whose
  // transaction no longer exists.
  const a = ctx.advanceResolve;
  ctx.advanceResolve = undefined;
  a?.();
  colonyTradeState.active = false;
  colonyTradeState.phase = 'idle';
  colonyTradeState.cardScene = 'idle';
  colonyTradeState.beat = '';
  colonyTradeState.trackHold = false;
  colonyTradeState.glideKind = 'reset';
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
  ctx.advanceFrom = -1;
  ctx.advancePending = false;
  ctx.revealSeen = false;
  ctx.stageYielded = false;
  ctx.answerBlock = 0;
  tradeFlow.end({how: 'cancelled', reason: 'the trade was aborted'});
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

// ── THE WAVE: every colony track at once (Turmoil Redux — Unity Budget, RX29) ─

/*
 * A LAW MOVES THE WHOLE TABLE. «Advance each colony track 2 steps» is a WORLD
 * step of the sitting: the server has already moved every tile when the view
 * arrives, and the sitting hosts the colonies screen as its own SHOW step so
 * the player watches the programme roll over every world. Three things live
 * here, in the trade module on purpose — the marker's physics is ONE
 * mechanism (the trade's advance leg, generalized to N tiles and a stagger),
 * and the tile reads its presented position through the ONE helper above:
 *
 *   · HELD POSITIONS — while the show has not yet moved a tile on screen, its
 *     marker stays where it STOOD (`presentedColonyModel` reads the hold),
 *     exactly as the traded tile stays pre-reset under `trackHold`. Released
 *     tile by tile, on each landing — the value moves ONLY through the glide;
 *   · THE WAVE STATE — the moves, a nonce the layer runs on, which tiles are
 *     mid-glide (their resting marker dims) and where each just settled (its
 *     one-shot glow, and the trade cell's «reward comes alive»);
 *   · THE REQUEST — a promise that resolves when every marker has landed and
 *     the table has been read, bounded by its own named net (the scene is a
 *     beat of the sitting, never a gate on the game).
 *
 * The plan (`trackWavePlan`) is pure: the breath, the stagger, the two
 * countable steps, the read. Reduced motion and the fx-lite preset play the
 * short form — the markers still arrive one after another, without impulses.
 */

/** A HELD track position per tile: the presented marker until the wave moves it. Reactive — the tiles read it. */
const heldTrackPositions = reactive(new Map<ColonyName, number>());

/** HOLD every listed tile at its BEFORE position (the model already carries the after). */
export function holdColonyTracks(holds: ReadonlyArray<{colony: ColonyName, position: number}>): void {
  for (const hold of holds) {
    heldTrackPositions.set(hold.colony, hold.position);
  }
}

/** The tile's marker may show the model's own position again (its glide landed). */
export function releaseColonyTrack(colony: ColonyName): void {
  heldTrackPositions.delete(colony);
}

/** Every hold released at once — the wave's end, or a scene that could not play. */
export function releaseColonyTracks(): void {
  heldTrackPositions.clear();
}

/** The held position of `colony`, if the show still holds it. */
export function heldColonyTrackPosition(colony: ColonyName): number | undefined {
  return heldTrackPositions.get(colony);
}

export type ColonyTrackWaveMove = {colony: ColonyName, before: number, after: number};

/**
 * WHERE a track move is PLAYED — the anchors the layer measures:
 *  · `tile` — the overview tiles only (a law's wave over the whole table,
 *    RX29: the colonies stand as a show step, never a focus stage);
 *  · `stage` — the colony's FOCUS STAGE first (its expanded instrument — the
 *    big rail the player is looking at), the tile as the fallback (TR07: the
 *    marker of the tile the player picked moves on the very stage they
 *    confirmed it on). The trade's own glide reads the same two-rung ladder.
 */
export type ColonyTrackMoveAnchors = 'tile' | 'stage';

export const colonyTrackWaveState = reactive({
  /** A wave is on stage (the hold the transport and the notifications wait on). */
  active: false,
  /** Bumped when the wave should run — the layer measures and animates. */
  nonce: 0,
  moves: [] as Array<ColonyTrackWaveMove>,
  /** The short form (reduced motion / fx-lite): the markers arrive in order, without impulses. */
  reduced: false,
  /** The tiles whose marker proxy is mid-glide (their resting marker dims). */
  gliding: {} as Record<string, boolean>,
  /** One-shot: the cell a tile's marker just settled on (its glow; the trade cell's morph) — absent when none. */
  settled: {} as Record<string, number>,
  /**
   * The furthest cell the moving marker has TOUCHED, per tile — the cells it
   * crossed light up on the touch («пройдено», one after another), and the
   * last touched cell's income answers once. Cleared with the wave.
   */
  touched: {} as Record<string, number>,
  /** Which surface the wave plays on (see `ColonyTrackMoveAnchors`). */
  anchors: 'tile' as ColonyTrackMoveAnchors,
  /** The rhythm the wave plays in (see `TrackMoveRhythm`). */
  rhythm: 'wave' as TrackMoveRhythm,
  /** How the last wave ended (`landed` · `net` · `no standing table` · …) — a diagnostic for the probes. */
  lastFinish: '',
});

/** The wave's own readiness facts (`__conReady`): whether one is on stage, and how the last one ended. */
export function colonyTrackWaveDiag(): {active: boolean, tiles: number, lastFinish: string} {
  return {active: colonyTrackWaveState.active, tiles: colonyTrackWaveState.moves.length, lastFinish: colonyTrackWaveState.lastFinish};
}

const waveResolver = owedAnswer('colony-trade:wave', {orphaned: () => []});
/**
 * THE WAVE'S RUN (the same law): `scene:colony-track-wave#n`, from the request to the wave's end. It owns the wave's
 * net; when the game screen leaves under it the wave is finished (`orphaned` — every hold released, the request
 * resolved).
 */
const waveFlow = createFlowRun('colony-track-wave', {orphaned: () => finishColonyTrackWave('session')});
/** The landed cells' one-shot glow outlives the wave by design: which wave's glow stands (a newer wave supersedes it). */
let waveGlowSeq = 0;

/**
 * The wave's own net, PAST the plan's whole length AND past the layer's own
 * wait for a standing table (6 s — the table is being hosted while this waits):
 * a table that never stands (the frame left early, a tile with no track) can
 * never hold the sitting — the scene is a beat, never a gate on the game.
 */
const TRACK_WAVE_NET_MS = 8_000;

/** How long the last landing's glow is kept before the one-shots are cleared (cosmetic — the wave is already over). */
const TRACK_WAVE_GLOW_MS = 900;

/** The plan the layer runs — from the requested moves, in the short form when the wave is. */
export function colonyTrackWavePlan(): TrackWavePlan | undefined {
  if (!colonyTrackWaveState.active || colonyTrackWaveState.moves.length === 0) {
    return undefined;
  }
  return trackWavePlan(colonyTrackWaveState.moves, {reduced: colonyTrackWaveState.reduced, rhythm: colonyTrackWaveState.rhythm});
}

/**
 * RUN the wave over `moves` (the server's list, in the table's order) and
 * resolve when every marker has landed and the table has been read. The
 * tiles are expected to be HELD at their before positions by the caller
 * (`holdColonyTracks`) — each landing releases its own tile. Resolves at once
 * for an empty list.
 */
export function requestColonyTrackWave(
  moves: ReadonlyArray<ColonyTrackWaveMove>,
  opts: {reduced?: boolean, anchors?: ColonyTrackMoveAnchors, rhythm?: TrackMoveRhythm} = {},
): Promise<void> {
  if (moves.length === 0) {
    return Promise.resolve();
  }
  // A wave already on stage ends here (impossible in one sitting, idempotent all the same). A wave that is NOT
  // on stage must not be «finished»: the caller has just placed the holds this wave will release tile by tile.
  if (colonyTrackWaveState.active) {
    finishColonyTrackWave('re-request');
  }
  const reduced = opts.reduced ?? (consoleReducedMotionActive() || consoleFxLiteState.enabled);
  const rhythm = opts.rhythm ?? 'wave';
  const plan = trackWavePlan(moves, {reduced, rhythm});
  colonyTrackWaveState.moves = moves.map((move) => ({colony: move.colony, before: move.before, after: move.after}));
  colonyTrackWaveState.reduced = reduced;
  colonyTrackWaveState.anchors = opts.anchors ?? 'tile';
  colonyTrackWaveState.rhythm = rhythm;
  colonyTrackWaveState.gliding = {};
  colonyTrackWaveState.settled = {};
  colonyTrackWaveState.touched = {};
  colonyTrackWaveState.active = true;
  colonyTrackWaveState.nonce++;
  tradeLog('track wave', moves.length, 'tiles', reduced ? '(short form)' : '');
  return new Promise<void>((resolve) => {
    waveResolver.arm(resolve);
    waveFlow.begin(`${moves.length} tile(s)`);
    waveFlow.after(motionMs(plan.totalMs + TRACK_WAVE_NET_MS), 'the wave\'s net', () => finishColonyTrackWave('net'));
  });
}

/** The layer: this tile's marker proxy started (or stopped) gliding — the resting marker dims meanwhile. */
export function noteColonyTrackWaveGliding(colony: ColonyName, on: boolean): void {
  if (!colonyTrackWaveState.active) {
    return;
  }
  colonyTrackWaveState.gliding = {...colonyTrackWaveState.gliding, [colony]: on};
}

/** The layer: the moving marker TOUCHED `cell` of this tile — the cell lights up as crossed, its income answers once. */
export function noteColonyTrackWaveTouched(colony: ColonyName, cell: number): void {
  if (!colonyTrackWaveState.active) {
    return;
  }
  colonyTrackWaveState.touched = {...colonyTrackWaveState.touched, [colony]: cell};
}

/**
 * The layer: this tile's marker LANDED on `cell` — the hold is released under
 * the settled proxy (the real marker paints on the landed cell, the «4/7»
 * readout flips, the trade cell morphs), and the one-shot glow is armed. A
 * tile at the end of its track lands where it stood: released, no glow.
 */
export function noteColonyTrackWaveLanded(colony: ColonyName, cell: number, moved: boolean): void {
  releaseColonyTrack(colony);
  if (!colonyTrackWaveState.active) {
    return;
  }
  colonyTrackWaveState.gliding = {...colonyTrackWaveState.gliding, [colony]: false};
  if (moved) {
    colonyTrackWaveState.settled = {...colonyTrackWaveState.settled, [colony]: cell};
  }
}

/**
 * THE WAVE IS OVER (every marker landed and the table read — or the net
 * fired, or the scene could not stand): every hold is released, the stage
 * clears, the request resolves. Idempotent.
 */
export function finishColonyTrackWave(why = 'landed'): void {
  waveFlow.end(); // its net goes with it
  if (!colonyTrackWaveState.active) {
    // No wave on stage: the holds are somebody else's (the beat's, placed BEFORE its request) — never released here.
    return;
  }
  releaseColonyTracks();
  tradeLog('track wave finished:', why);
  colonyTrackWaveState.lastFinish = why;
  colonyTrackWaveState.active = false;
  colonyTrackWaveState.gliding = {};
  colonyTrackWaveState.moves = [];
  // The last landing's glow finishes on its own; the one-shots are cleared after it (cosmetic, never a gate).
  // The marks outlive the wave, so their span is the SESSION's — and taking them down is a release: it happens when
  // the span has passed or the game screen has left, whichever comes first.
  const glow = ++waveGlowSeq;
  void consoleSessionScope().sleep(motionMs(TRACK_WAVE_GLOW_MS)).then(() => {
    if (glow === waveGlowSeq) {
      colonyTrackWaveState.settled = {};
    }
  });
  // The touched cells are the LIVE marker's business — once every hold is released the model's own
  // position draws them (`passed` below the marker), so the trail ends with the wave.
  colonyTrackWaveState.touched = {};
  const resolve = waveResolver.take();
  resolve?.();
}

/** The wave is a scene beat — notifications queue, the transport's view apply waits, mandatory surfaces wait. */
registerAnimationHoldSupplier('colony-track-wave', () => colonyTrackWaveState.active, {
  // A wave past the ceiling ends through its own finish (every hold released, the request resolved) — the net's path.
  expire: () => {
    if (!colonyTrackWaveState.active) {
      return;
    }
    console.warn(`[colony-track-wave] wave of ${colonyTrackWaveState.moves.length} tile(s): outlived its ceiling — ended`);
    finishColonyTrackWave('ceiling');
  },
});

/**
 * THE TRADE AS A WAIT (the wait graph, Э4): one run, keyed by its own id (R6), bounded by the transaction's ceiling.
 */
registerWaitSource('flow:colony-trade', () => (colonyTradeState.active ? [{
  id: `flow:colony-trade#${tradeRun}`, family: 'flow' as const, owner: 'colonyTrade',
  targets: [{kind: 'motion' as const, what: `the trade (${colonyTradeState.phase})`}], boundMs: 60_000,
}] : []));

// THE GAME SCREEN LEAVES: this state goes with it — declared here, taken down by the session's ordered pass
// (architecture v2 — PLAN §10 · C5; the number is its place in that pass — `leaveConsoleSession`).
// Unwind any trade-reward transaction (zombie-safe)
sessionState('colony-trade', abortColonyTrade, 490);

// A PRESS THAT DID NOT LAND (refused, lost): what this module armed for it unwinds — declared here, run by the
// transport's ordered pass (architecture v2 — PLAN §5 · L1; the number is its place — `unwindUnlandedPress`).
// The whole trade-reward transaction with it
onPressUnlanded('colony-trade', abortColonyTrade, 20);
