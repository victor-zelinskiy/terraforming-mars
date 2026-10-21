/*
 * CONSOLE RESOURCE TRANSFER — the run lifecycle of the shared premium
 * "receiving resources" language (console-native only):
 *
 *   reward source → a physical resource chip carrying its amount → the exact
 *   destination zone in the left panel → the delta chip.
 *
 * Two clients today: the patent-sale payout (one M€ chip out of the trade
 * terminal, `arrival: 'hold'` — the chip rests on the M€ row until the gated
 * commit fires the delta chip, then `settleResourceTransfers()` absorbs it)
 * and the played-card reward beat (`arrival: 'auto'` — the view is ALREADY
 * committed under the PANEL REWARD HOLD, and each chip's touchdown releases
 * its metric from the hold, firing that delta chip at the exact contact).
 *
 * THE PANEL REWARD HOLD is the framework's delayed-visual-commit half (the
 * startSetupReveal idiom, generalized): ConsoleResourcePanel displays every
 * held metric MINUS its pending amount, so committing the authoritative view
 * doesn't fire the reward's delta chips early — each release makes the
 * displayed value jump by exactly the transferred amount, and the existing
 * AnimatedMetricValue fires the chip from that honest watch transition. One
 * value system (the committed view), one chip system (unchanged) — the hold
 * only re-times WHEN the panel shows the reward.
 *
 * Anchors are resolved from the REAL interface at flight time (never a fixed
 * trajectory): the played card's slot in «Разыграно», the sale terminal's
 * slit, the panel's stock DIGITS (the ink, never the column's reserve — see
 * `targetPointFor`) / production plate / the chosen host card / the
 * additional-resources satellite. A transfer whose source or target
 * can't be measured degrades honestly: no flight, its hold releases at once
 * (the delta chip fires marginally later than the commit — never lost).
 *
 * DESKTOP SAFETY: only console-shell flows call into this module; nothing
 * here is reachable from the desktop surfaces.
 */

import {reactive, nextTick} from 'vue';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {restingRectOf} from '@/client/console/cardFlight/landingRect';
import {
  ResourceTransferSpec, TransferEnd, TransferEndLike, TransferPoint, TransferRect,
  transferFlightBudgetMs, transferWaveDelayMs, sourceSpawnPoint, cardResourceKey, isTransferEnd, transferEndOf, transferEndPoint,
  TRANSFER_BEAT_MS, TRANSFER_DETACH_WAIT_MS, clampTransferPace, RATING_RAIL_KEY, VP_RAIL_KEY, isVpTransfer, transferLaunchFor,
  transferSignedAmount,
} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  TransferFlightReport, TransferStagePiece, runDetachedTransferFlight, runTransferFlight, settleTransferChip, killTransferPiece,
} from '@/client/console/resourceTransfer/resourceTransferDirector';
import {probeTick} from '@/client/console/probeTick';
import {firstVisibleEnd, TransferEndOptions, TransferEndVerdict, transferEndVerdict} from '@/client/console/resourceTransfer/transferEndVisible';

export type TransferFlight = {
  id: number,
  spec: ResourceTransferSpec,
  /** The run that launched this chip declared its source is the MARS BOARD
   *  (`ResourceTransferRun.fromBoard`) — the layer reads it to recede with
   *  the board under an open workspace. */
  fromBoard: boolean,
  /** The run plays INSIDE a standing decision surface (`ResourceTransferRun.inSurface`); absent = a blocking wave. */
  inSurface?: boolean,
};

export const resourceTransferState = reactive({
  flights: [] as Array<TransferFlight>,
  nonce: 0,
  /**
   * A wave is mid-flight (chips in the air before their touchdowns). Kept
   * REACTIVE (not a plain module `let`) on purpose: `isResourceTransferActive`
   * — the animation-hold supplier predicate — ORs it with `flights.length`, and
   * the animation-hold `watch` short-circuits `runActive || …`, so if this were
   * non-reactive the watcher would drop its `flights` dependency the moment it
   * read a `true` here and NEVER re-fire — orphaning the 35 s safety ceiling
   * (which then force-releases a hold that already ended). Reactive ⇒ the
   * watcher re-evaluates on every transition of BOTH terms.
   */
  runActive: false,
  /** How many IN-SURFACE waves are mid-flight (`ResourceTransferRun.inSurface`) — the same reactivity contract as `runActive`. */
  surfaceRuns: 0,
});

// ── leak diagnostics ────────────────────────────────────────────────────────
// A bounded in-memory trail of the module's lifecycle. It costs nothing at
// runtime (a capped ring of plain objects) and is dumped ONLY when the
// animation-hold safety ceiling force-releases `resource-transfer` — so a
// leaked hold prints the exact wave that never cleaned up (which run started,
// which flights were added, which were removed, whether it ended / threw /
// settled), instead of a bare "leaked hold?".

type TransferTrailEvent = {t: number, runId: number | undefined, ev: string, detail?: unknown};
const transferTrail: Array<TransferTrailEvent> = [];
const TRAIL_CAP = 60;
let runIdSeq = 0;

function trailNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ?
    Math.round(performance.now()) : 0;
}

function trail(runId: number | undefined, ev: string, detail?: unknown): void {
  transferTrail.push({t: trailNow(), runId, ev, detail});
  if (transferTrail.length > TRAIL_CAP) {
    transferTrail.splice(0, transferTrail.length - TRAIL_CAP);
  }
}

/** Dumped into the animation-hold ceiling warn — the full leak picture. */
export function resourceTransferDiagnostics(): unknown {
  return {
    runActive: resourceTransferState.runActive,
    flights: resourceTransferState.flights.map((f) => ({
      id: f.id, channel: f.spec.channel, resource: f.spec.resource, amount: f.spec.amount,
    })),
    heldChipIds: heldChips.map((h) => h.id),
    stageBound: stage !== undefined,
    trail: transferTrail.slice(-40),
  };
}

// ── the PANEL REWARD HOLD (delayed visual commit of reward metrics) ─────────

type PanelRewardHold = {
  /** Any metric held — ConsoleResourcePanel consults the maps only then. */
  active: boolean;
  /** Pending amounts by standard resource key (displayed = committed − held). */
  stock: Record<string, number>;
  production: Record<string, number>;
  /** Pending card-resource amounts by normalized icon key (the aux satellite). */
  cardRes: Record<string, number>;
  /**
   * Pending LOSSES (a parliament levy), kept apart from the gains: a loss is
   * held as a POSITIVE amount here and read as a negative hold (displayed =
   * committed − gains + losses — the row keeps its pre-loss value until the
   * chip leaves it). Two maps, never one signed number: a gain's release
   * clamps at zero from below and a loss's from above, and a stray second
   * release of either can never turn into a phantom hold of the other sign
   * (measured once with a single signed map: a late touchdown after a flush
   * left the M€ row +10 above the truth until the next reset).
   */
  stockLoss: Record<string, number>;
  productionLoss: Record<string, number>;
  /**
   * Pending card-resource LOSSES by icon key (the satellite) — a spend that
   * LEAVES a card on its own flight (TR28: two fighters off the capsule): the
   * satellite keeps them until the chip departs. Same two-map law as the stock.
   */
  cardResLoss: Record<string, number>;
  /**
   * THE CARD'S OWN CAPSULE, per card name — the pending gains and losses whose
   * spec names a `targetCard`. A surface that paints that card's capsule while
   * its tokens fly reads `heldCardCapsule` (the action composer's hero, TR28):
   * the capsule = the model + what has not departed − what has not landed.
   */
  capsule: Record<string, number>;
  capsuleLoss: Record<string, number>;
  /**
   * DERIVED victory points still in the air — the points a card resource
   * brings its card at its touchdown (a floater onto a «1 VP / 2» card). The
   * rail's VP cell is the score INCLUDING them, so it reads «committed − held»
   * until the token that brings them lands (`railReward.ts` holds and releases
   * them with the token's own spec).
   */
  vp: number;
  /**
   * DERIVED victory points still LEAVING — the points a card resource takes
   * with it when it departs a card that scores per resource (a fighter spent
   * off Formula Zero — TR29): the VP cell reads «committed − held» SIGNED, so
   * it shows the pre-spend score until the token leaves (a loss ticks on its
   * departure, the transfer language's own law).
   */
  vpLoss: number;
};

export const panelRewardHold = reactive<PanelRewardHold>({
  active: false,
  stock: {},
  production: {},
  cardRes: {},
  stockLoss: {},
  productionLoss: {},
  cardResLoss: {},
  capsule: {},
  capsuleLoss: {},
  vp: 0,
  vpLoss: 0,
});

function holdMapFor(spec: ResourceTransferSpec): Record<string, number> {
  const loss = spec.direction === 'loss';
  switch (spec.channel) {
  case 'stock': return loss ? panelRewardHold.stockLoss : panelRewardHold.stock;
  case 'production': return loss ? panelRewardHold.productionLoss : panelRewardHold.production;
  case 'card-resource': return loss ? panelRewardHold.cardResLoss : panelRewardHold.cardRes;
  }
}

function addHeld(map: Record<string, number>, key: string, amount: number): void {
  map[key] = (map[key] ?? 0) + amount;
}

function takeHeld(map: Record<string, number>, key: string, amount: number): void {
  const left = (map[key] ?? 0) - amount;
  if (left > 0) {
    map[key] = left;
  } else {
    delete map[key];
  }
}

/** Seed the hold BEFORE the commit — the panel keeps showing the pre-reward
 *  values of the held metrics while everything else commits normally. */
export function beginPanelRewardHold(specs: ReadonlyArray<ResourceTransferSpec>): void {
  for (const spec of specs) {
    if (spec.amount <= 0) {
      continue;
    }
    // THE VP TOKEN (TR55) is held in the ONE victory-point hold, signed by its way — never a second map.
    if (isVpTransfer(spec)) {
      beginPanelVpHold(transferSignedAmount(spec));
      continue;
    }
    addHeld(holdMapFor(spec), spec.resource, spec.amount);
    if (spec.channel === 'card-resource' && spec.targetCard !== undefined) {
      addHeld(spec.direction === 'loss' ? panelRewardHold.capsuleLoss : panelRewardHold.capsule, spec.targetCard, spec.amount);
    }
  }
  syncHoldActive();
}

/** Release ONE transfer's metric — the displayed value jumps by exactly the
 *  transferred amount and its delta chip fires from that transition. */
export function releasePanelRewardHold(spec: ResourceTransferSpec): void {
  if (isVpTransfer(spec)) {
    releasePanelVpHold(transferSignedAmount(spec));
    return;
  }
  takeHeld(holdMapFor(spec), spec.resource, spec.amount);
  if (spec.channel === 'card-resource' && spec.targetCard !== undefined) {
    takeHeld(spec.direction === 'loss' ? panelRewardHold.capsuleLoss : panelRewardHold.capsule, spec.targetCard, spec.amount);
  }
  syncHoldActive();
}

/**
 * CARD-RESOURCE TOUCHDOWNS, per host card — how much of the CURRENT payout has
 * physically landed on each card, bumped at the chip's own contact beat.
 *
 * It lives here, with the flights, because the touchdown IS a transfer event:
 * every host that stands a card on screen (a colony trade's presented target,
 * a colony BUILD's placement bonus, whatever comes next) reads ONE record and
 * ticks its frozen counter on contact instead of inventing a second tally.
 * A payout ARMS by resetting it — a stale count from the last one would tick a
 * fresh card before its chip ever left.
 */
export const cardResourceLandings = reactive<{by: Record<string, number>}>({by: {}});

export function resetCardResourceLandings(): void {
  cardResourceLandings.by = {};
}

/** How much has landed on this card in the current payout. */
export function cardResourceLanded(card: string): number {
  return cardResourceLandings.by[card] ?? 0;
}

/** Tally a card-resource spec as LANDED without a flight — a promise that did not verify ticks the capsule with the commit (К-S1). */
export function noteCardResourceLanding(spec: ResourceTransferSpec): void {
  if (spec.channel !== 'card-resource' || spec.targetCard === undefined) {
    return;
  }
  const prior = cardResourceLandings.by[spec.targetCard] ?? 0;
  cardResourceLandings.by = {...cardResourceLandings.by, [spec.targetCard]: prior + spec.amount};
  for (const listener of landingListeners) {
    listener(spec);
  }
}

/** Who wants to know a card-resource token has LANDED on its card (the score cell's ledger — TR55). */
const landingListeners = new Set<(spec: ResourceTransferSpec) => void>();

/** Listen to every card-resource touchdown (the contact beat, a degraded landing included); returns the unregister. */
export function onCardResourceLanded(listener: (spec: ResourceTransferSpec) => void): () => void {
  landingListeners.add(listener);
  return () => landingListeners.delete(listener);
}

/** Drop every pending hold at once (abort / safety) — the panel snaps to the
 *  committed truth and any remaining chips fire in one honest transition. */
export function clearPanelRewardHold(): void {
  panelRewardHold.stock = {};
  panelRewardHold.production = {};
  panelRewardHold.cardRes = {};
  panelRewardHold.stockLoss = {};
  panelRewardHold.productionLoss = {};
  panelRewardHold.cardResLoss = {};
  panelRewardHold.capsule = {};
  panelRewardHold.capsuleLoss = {};
  // The score cell's LEDGER keeps what it holds across a scene's belt-and-braces clear (TR55): its shares are released
  // by their own tokens (or its bounded ceiling) — a tile scene's end must not tick a card's printed points early.
  const kept = vpHoldKeeper?.() ?? {gain: 0, loss: 0};
  panelRewardHold.vp = Math.max(0, kept.gain);
  panelRewardHold.vpLoss = Math.max(0, kept.loss);
  syncHoldActive();
}

/** What the score cell's share ledger holds right now (gain · loss, both ≥ 0) — survives `clearPanelRewardHold`. */
let vpHoldKeeper: (() => {gain: number, loss: number}) | undefined;

/** The share ledger plugs in (`scoreCell/vpShareLedger.ts`) — one keeper; returns the unregister. */
export function registerPanelVpKeeper(keeper: () => {gain: number, loss: number}): () => void {
  vpHoldKeeper = keeper;
  return () => {
    if (vpHoldKeeper === keeper) {
      vpHoldKeeper = undefined;
    }
  };
}

function syncHoldActive(): void {
  panelRewardHold.active =
    Object.keys(panelRewardHold.stock).length > 0 ||
    Object.keys(panelRewardHold.production).length > 0 ||
    Object.keys(panelRewardHold.cardRes).length > 0 ||
    Object.keys(panelRewardHold.stockLoss).length > 0 ||
    Object.keys(panelRewardHold.productionLoss).length > 0 ||
    Object.keys(panelRewardHold.cardResLoss).length > 0 ||
    Object.keys(panelRewardHold.capsule).length > 0 ||
    Object.keys(panelRewardHold.capsuleLoss).length > 0 ||
    panelRewardHold.vp > 0 ||
    panelRewardHold.vpLoss > 0;
}

/**
 * Panel readers (ConsoleResourcePanel) — 0 when nothing is held. SIGNED: the
 * gains held minus the losses held, so a row under a levy AND a payout
 * (−10 held, +7 held → −3) shows its pre-sitting value until the first chip
 * moves, then each release moves it by exactly that chip's amount.
 */
export function heldStock(resource: string): number {
  return panelRewardHold.active ? (panelRewardHold.stock[resource] ?? 0) - (panelRewardHold.stockLoss[resource] ?? 0) : 0;
}
export function heldProduction(resource: string): number {
  return panelRewardHold.active ? (panelRewardHold.production[resource] ?? 0) - (panelRewardHold.productionLoss[resource] ?? 0) : 0;
}
/**
 * Hold N derived victory points, SIGNED: points a token brings (the score cell keeps them back until it lands) or
 * — negative — points a departing token takes away (the cell keeps them until it leaves).
 */
export function beginPanelVpHold(points: number): void {
  if (points > 0) {
    panelRewardHold.vp += points;
  } else if (points < 0) {
    panelRewardHold.vpLoss -= points;
  }
  syncHoldActive();
}

/** Release N held derived points (signed, as held) — the VP cell ticks by exactly that. Never below zero. */
export function releasePanelVpHold(points: number): void {
  if (points > 0) {
    panelRewardHold.vp = Math.max(0, panelRewardHold.vp - points);
  } else if (points < 0) {
    panelRewardHold.vpLoss = Math.max(0, panelRewardHold.vpLoss + points);
  }
  syncHoldActive();
}

/** The derived points still held, signed: brought minus taken away (0 when nothing is). */
export function heldVictoryPoints(): number {
  return panelRewardHold.active ? panelRewardHold.vp - panelRewardHold.vpLoss : 0;
}

/** SIGNED, like the stock: the card-resource gains held minus the losses held (the satellite reads «committed − held»). */
export function heldCardResource(iconKey: string): number {
  return panelRewardHold.active ? (panelRewardHold.cardRes[iconKey] ?? 0) - (panelRewardHold.cardResLoss[iconKey] ?? 0) : 0;
}

/**
 * ONE CARD'S CAPSULE, signed: the gains held on it minus the losses held off it.
 * Displayed = the model − this — TR28 at c fighters reads c (+1 not landed, −2
 * not departed: model c − 1 − (1 − 2)), then c + 1 on the landing, c − 1 on the
 * departure; never c − 2, never below zero by construction.
 */
export function heldCardCapsule(card: string): number {
  return panelRewardHold.active ? (panelRewardHold.capsule[card] ?? 0) - (panelRewardHold.capsuleLoss[card] ?? 0) : 0;
}

// ── stage registry (the layer plugs in) ─────────────────────────────────────

type TransferStageHandle = {piece: (id: number) => TransferStagePiece | undefined};
let stage: TransferStageHandle | undefined;

export function registerResourceTransferStage(handle: TransferStageHandle): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
}

// ── the run lifecycle ───────────────────────────────────────────────────────

export type ResourceTransferRun = {
  specs: ReadonlyArray<ResourceTransferSpec>;
  /**
   * Where the rewards visually emerge:
   *  - `point`     — an explicit stage point (the sale terminal's slit);
   *  - `selectors` — candidate DOM selectors tried in order (the played
   *    card's slot / the events backstack), spawn points spread across the
   *    matched element's lower band.
   */
  source: {point?: TransferPoint, selectors?: ReadonlyArray<string>, end?: TransferEnd};
  /**
   * PER-SPEC origin override, aligned with `specs` by index (the tile
   * placement scene: each printed bonus icon on the field is its own
   * birth point). An undefined entry falls back to the shared `source`.
   * An OBJECT end (`TransferEnd` — T06) is re-measured at the birth: a printed icon that is no longer painted (its
   * surface folded, its card left) gets no token at all — never one out of the pose it had at the press.
   */
  origins?: ReadonlyArray<TransferEndLike | undefined>;
  /**
   * `auto` — each chip is absorbed at its destination right after the
   * contact beat (the played-card reward wave);
   * `hold` — landed chips REST on their destination until
   * `settleResourceTransfers()` (the sale payout, whose commit is gated on
   * the touchdown).
   */
  arrival: 'auto' | 'hold';
  /**
   * Wave tempo relative to the standard language (clamped to [0.5, 1];
   * default 1). A wave flying CONCURRENTLY with a card cover (a placement
   * that pays a card AND resources) passes `TRANSFER_CONCURRENT_PACE` so
   * the chips stay ahead of the calmer card — same arcs, same easing, only
   * every duration (stagger, pop/arc/settle, absorb) a touch quicker.
   */
  pace?: number;
  /**
   * `quick` (PL-140): the tokens are prices drawn INTO the printed result they buy — no settle, the short absorb beat
   * — so the result is born out of them at once (the ACTION COMMIT's spend links).
   */
  absorb?: 'quick';
  /** Fired at each transfer's TOUCHDOWN (release the hold / free a gate). */
  onArrive?: (spec: ResourceTransferSpec) => void;
  /**
   * Fired for a transfer whose FLIGHT WAS LOST — beside its `onArrive` (the
   * amount has arrived either way; only the chip never flew, or stalled in the
   * air). A caller that owes its chip a NAMED degradation reads the reason
   * here (`railReward.ts`); everyone else keeps the silent, honest release.
   * Never fired for reduced motion — no flight is owed there.
   */
  onDegrade?: (spec: ResourceTransferSpec, why: TransferDegradeReason) => void;
  /**
   * The wave's visual SOURCE is the MARS BOARD (a cell's printed bonus, an
   * Ares/ocean adjacency payout, a nomad stage reward, a remote landing's
   * income). Board-sourced chips belong to the board's own story: while a
   * workspace covers the board, the flight layer recedes with it
   * (`con-flight-to-board` — see the z ladder in console.less) instead of
   * flying bright over the panel; the touchdown ticks, the panel-hold
   * releases and the delta chips are untouched. A wave born on a workspace
   * surface (a played card, the sale terminal, an action commit) leaves
   * this unset and keeps flying on top — its source is the lit panel.
   */
  fromBoard?: boolean;
  /**
   * The wave plays INSIDE a decision surface that is still standing and is
   * the chips' own destination (an enacted resolution's payout landing on the
   * candidate the player just chose in the shared picker). Its chips hold the
   * NOTIFICATION feed only (`notification-only` — the animation-hold contract
   * for a cinematic inside a mandatory surface): a blocking hold retracts
   * every mandatory surface, and the picker the chips are landing on would
   * unmount under its own payout. The caller's transport gate still withholds
   * the next prompt until the touchdown.
   */
  inSurface?: boolean;
  /**
   * An explicit LANDING POINT for every chip of the run — a payout that goes
   * to ANOTHER seat (TR21: the data an opponent's neighbouring cities paid,
   * landing on that seat's chip in the status strip). Absent → each spec's own
   * home (a panel row, a host card, the satellite cell). Nothing is held or
   * ticked by such a landing; `onArrive` still fires at the touchdown.
   */
  destination?: TransferEndLike;
  /**
   * A PER-SPEC destination, aligned with `specs` by index — for a run whose tokens land on DIFFERENT cards the
   * caller shows (TR44's action: the animal into the hero's capsule, the data onto the chosen card's miniature in
   * the composer row — one link, two touchdowns). `undefined` for a spec falls back to `destination`, then to the
   * spec's own home.
   */
  destinationOf?: (spec: ResourceTransferSpec, index: number) => TransferEndLike | undefined;
  /**
   * An explicit destination that is a visible DOUBLE of the spec's own home (a card's capsule in a composer row, the
   * hero's capsule — the counter that ticks is the card's): when that object is gone at the final approach the token
   * re-homes to the spec's own ladder (`targetPointFor` — the satellite cell of that resource, a rail row), never
   * into the pose the object had. Never for a landing on ANOTHER seat (their chip is no double of the viewer's row).
   */
  homeStandIn?: boolean;
  /**
   * EVERY token of the run has LEFT its source (its pop is over — or it was never born): the surface the sources
   * stand on may fold now. The law «a surface folds only after the token has left it», told by the tokens themselves
   * instead of a clock beside them (a wave's later tokens are born a stagger after the first).
   */
  onLeft?: () => void;
  /**
   * EVERY token of the run has been ABSORBED at its destination (or was never flown) — the run resolves at the
   * touchdowns, the absorb's contact beat runs on past them. A host whose SURFACE IS the destination (the play
   * scene's card receiving its own resource) may not dissolve before this: a token absorbing over a card that has
   * left is a token hanging over the board where the card was (the T06 stand: Pets' animal, 1094 px off any object).
   */
  onAbsorbed?: () => void;
  /**
   * THE RESULT OUTLIVES ITS SURFACE (PL-165 — the second half of the law of visible ends). A gain whose destination
   * EXISTS but is COVERED by the standing surface that produced it (the ДОП. РЕСУРСЫ satellite under the action
   * composer's glass) is not dropped: its token is born on the visible source, pops out of it, and WAITS in the
   * app-level layer while that surface leaves; once the destination is painted it flies there and the counter ticks
   * on the touchdown (`onArrive`). A destination that never opens within `TRANSFER_DETACH_WAIT_MS` absorbs the token
   * in place (the honest degradation). Opt-in: only a caller whose surface LEAVES right after the wave sets it (the
   * card's ledger, the action commit's wave) — a surface that stands (the Parliament's reward page) keeps degrading.
   * The run resolves for its caller once a detached token has LEFT its source (`onDetach`) — the caller's flow may
   * fold now; that token's own hold is released by its own `onArrive`, later. While it waits it holds the feed only.
   */
  detachCovered?: boolean;
  /** A detached token has left its source — its `onArrive` comes later, after the surface it rose from has gone. */
  onDetach?: (spec: ResourceTransferSpec) => void;
};

/** WHY a transfer's flight was lost: nothing to be born on, nowhere to land, no layer to fly in, or a wave that stalled past its budget. */
export type TransferDegradeReason = 'no-source' | 'no-destination' | 'no-stage' | 'stalled' | 'source-gone' | 'destination-gone';

let flightSeq = 0;
/** Landed hold-mode chips awaiting settle (id → its landing point). */
let heldChips: Array<{id: number, at: TransferPoint}> = [];

/** A wave OUTSIDE any standing surface is live — the BLOCKING hold (the default for every wave). */
export function isResourceTransferActive(): boolean {
  return resourceTransferState.runActive || resourceTransferState.flights.some((f) => f.inSurface !== true);
}

/** An IN-SURFACE wave is live — the notification-only hold. */
export function isInSurfaceResourceTransferActive(): boolean {
  return resourceTransferState.surfaceRuns > 0 || resourceTransferState.flights.some((f) => f.inSurface === true);
}

/** A BOARD-sourced chip is on stage (flying or absorbing) — the layer carries
 *  `con-flight-to-board` for exactly that span, so an open workspace covers
 *  the wave instead of being overflown by it. */
export function boardSourcedTransferActive(): boolean {
  return resourceTransferState.flights.some((f) => f.fromBoard);
}

// Chips in flight hold the presentation. Today every wave runs nested inside
// a blocking hero scene (played hero / patent sale / tile placement), so this
// is redundant cover — but a FUTURE standalone wave is protected by default.
// `diagnose` prints the leaked state if this hold ever trips the safety ceiling.
registerAnimationHoldSupplier('resource-transfer', isResourceTransferActive, {
  diagnose: resourceTransferDiagnostics,
  // Owner recovery on the ceiling: by then every run's own wave-budget
  // safety has long freed its caller gates — the abort only clears the
  // wedged stage/flight bookkeeping the "released" hold used to mask.
  expire: () => abortResourceTransfers(),
});
// …and a wave INSIDE a standing surface holds the feed only (see `inSurface`).
registerAnimationHoldSupplier('resource-transfer-in-surface', isInSurfaceResourceTransferActive, {
  scope: 'notification-only',
  diagnose: resourceTransferDiagnostics,
  expire: () => abortResourceTransfers(),
});

/**
 * Run one transfer wave. Resolves when EVERY transfer has ARRIVED (its
 * `onArrive` fired) — the absorb/dissolve tail continues past the resolve
 * for `auto` runs so the caller is never held on decoration. NEVER rejects;
 * a transfer whose geometry can't be measured releases immediately (the
 * reward is announced by its delta chip alone, marginally late, never lost).
 */
export async function runResourceTransfers(run: ResourceTransferRun): Promise<void> {
  const runId = ++runIdSeq;
  trail(runId, 'run:start', {arrival: run.arrival, specs: run.specs.length});
  // The caller hears «every token has left its source» and «every token was absorbed» ONCE, whichever way the run ends.
  let left = false;
  const leftOnce = (): void => {
    if (!left) {
      left = true;
      run.onLeft?.();
    }
  };
  let absorbed = false;
  const absorbedOnce = (): void => {
    if (!absorbed) {
      absorbed = true;
      run.onAbsorbed?.();
    }
  };
  // `origins` aligns with `run.specs` by index — pair them BEFORE filtering.
  const specEntries = run.specs
    .map((spec, i) => ({spec, origin: run.origins?.[i]}))
    .filter((e) => e.spec.amount > 0);
  if (specEntries.length === 0) {
    trail(runId, 'run:earlyreturn', 'no-positive-specs');
    leftOnce();
    absorbedOnce();
    return;
  }
  const releaseAll = (list: ReadonlyArray<{spec: ResourceTransferSpec}>) => {
    for (const e of list) {
      noteCardResourceLanding(e.spec);
      run.onArrive?.(e.spec);
    }
  };
  if (consoleReducedMotionActive() || typeof document === 'undefined') {
    releaseAll(specEntries);
    trail(runId, 'run:earlyreturn', 'reduced-or-nodom');
    leftOnce();
    absorbedOnce();
    return;
  }
  // What the ladders SKIPPED for this run (a covered satellite, a fading surface) — named in the trail and, in a
  // dev build, said out loud: a token that would have come from or gone to nothing is the class this law removes.
  const skipped: Array<SkippedEnd> = [];
  const sourceRef = resolveSourceEnd(run.source, skipped);
  if (sourceRef === undefined && !specEntries.some((e) => e.origin !== undefined)) {
    releaseAll(specEntries);
    specEntries.forEach((e) => run.onDegrade?.(e.spec, 'no-source'));
    trail(runId, 'run:earlyreturn', {why: 'no-source-geometry', skipped: coveredEnds(skipped)});
    warnCoveredEnds(skipped, 'source');
    leftOnce();
    absorbedOnce();
    return;
  }
  // Resolve each spec's destination NOW (the wave flies into real, settled
  // geometry); unresolvable ones release immediately and never fly.
  // A LOSS walks the same geometry BACKWARDS: its panel row is where it is
  // BORN and the run's source (the origin icon, else the source's box) is
  // where it lands — so `from` / `to` are fixed per spec, not per run.
  // A DETACHED flight (PL-165) has no `to` yet: its destination exists but is covered, and is measured when it opens.
  // Every end is kept as what it IS — an object re-measured in the frame it matters (T06), the spec's own HOME ladder
  // (re-run: the first VISIBLE match then), or a bare point (an explicit stage point, a board icon) — so the director
  // can ask again at the birth, on the final approach and at the touchdown.
  const flights: Array<{spec: ResourceTransferSpec, from: TransferPoint, to: TransferPoint, fromRef: EndRef, toRef: EndRef, detached?: boolean}> = [];
  for (const [i, e] of specEntries.entries()) {
    const skippedHere: Array<SkippedEnd> = [];
    const explicit = run.destinationOf?.(e.spec, i) ?? run.destination;
    let rowRef: EndRef = explicit === undefined ? 'home' : explicit;
    let row = measureEndRef(rowRef, e.spec, 'destination', skippedHere);
    if (row === undefined && explicit !== undefined && run.homeStandIn === true) {
      // The double is not painted (its surface already left): the token lands on the spec's own home instead.
      rowRef = 'home';
      row = targetPointFor(e.spec, skippedHere);
    }
    const srcRef: EndRef | undefined = e.origin ?? run.source.end ?? run.source.point ??
      (sourceRef === undefined ? undefined : spawnEndOf(sourceRef, i, specEntries.length));
    const sourcePoint = srcRef === undefined ? undefined : measureEndRef(srcRef, e.spec, 'source', skipped);
    if (row === undefined && sourcePoint !== undefined && srcRef !== undefined && detachable(run, e.spec, skippedHere)) {
      trail(runId, 'flight:detach', {channel: e.spec.channel, resource: e.spec.resource, targetCard: e.spec.targetCard ?? null, covered: coveredEnds(skippedHere)});
      flights.push({spec: e.spec, from: sourcePoint, to: sourcePoint, fromRef: srcRef, toRef: 'home', detached: true});
      continue;
    }
    if (row === undefined || sourcePoint === undefined) {
      trail(runId, 'run:no-dest', {
        channel: e.spec.channel, resource: e.spec.resource, targetCard: e.spec.targetCard ?? null,
        row: row !== undefined, source: sourcePoint !== undefined, probe: describeCardDestination(e.spec),
        skipped: coveredEnds([...skipped, ...skippedHere]),
      });
      warnCoveredEnds(skippedHere, 'destination');
      noteCardResourceLanding(e.spec); // degraded, but the amount HAS arrived
      run.onArrive?.(e.spec);
      run.onDegrade?.(e.spec, sourcePoint === undefined ? 'no-source' : 'no-destination');
    } else if (e.spec.direction === 'loss') {
      flights.push({spec: e.spec, from: row, to: sourcePoint, fromRef: rowRef, toRef: srcRef ?? sourcePoint});
    } else {
      flights.push({spec: e.spec, from: sourcePoint, to: row, fromRef: srcRef ?? sourcePoint, toRef: rowRef});
    }
  }
  if (flights.length === 0) {
    trail(runId, 'run:earlyreturn', 'no-resolvable-destinations');
    leftOnce();
    absorbedOnce();
    return;
  }

  // The run's own liveness flag: a surface wave counts apart (its hold is notification-only).
  const inSurface = run.inSurface === true;
  const markRun = (on: boolean) => {
    if (inSurface) {
      resourceTransferState.surfaceRuns = Math.max(0, resourceTransferState.surfaceRuns + (on ? 1 : -1));
    } else {
      resourceTransferState.runActive = on;
    }
  };
  markRun(true);
  resourceTransferState.nonce++;
  const pace = clampTransferPace(run.pace);
  const entries = flights.map((f, i) => ({
    id: ++flightSeq,
    spec: f.spec,
    to: f.to,
    from: f.from,
    fromRef: f.fromRef,
    toRef: f.toRef,
    detached: f.detached === true,
    delayMs: Math.round(motionMs(transferWaveDelayMs(i, flights.length)) * pace),
    index: i,
  }));
  // A DETACHED token waits for its surface to leave holding the FEED only (its wait must never be what keeps that
  // surface's flow from concluding); it turns into an ordinary flying chip once its arc starts (`onArc`).
  resourceTransferState.flights = [...resourceTransferState.flights,
    ...entries.map((e) => ({id: e.id, spec: e.spec, fromBoard: run.fromBoard === true, inSurface: inSurface || e.detached}))];
  trail(runId, 'run:flights', {arrival: run.arrival, ids: entries.map((e) => e.id)});
  try {
    await nextTick(); // the layer mounts the chips

    const uiScale = conUiScale();
    const waveBudget = motionMs(transferFlightBudgetMs()) * pace +
      motionMs(transferWaveDelayMs(entries.length - 1, entries.length)) * pace + 2200;
    let safetyFired = false;
    const safety = window.setTimeout(() => {
      // rAF stall / lost stage — release everything, never wedge the caller.
      safetyFired = true;
      trail(runId, 'run:safety', {arrival: run.arrival, ids: entries.map((e) => e.id)});
      entries.forEach((e) => {
        noteCardResourceLanding(e.spec);
        run.onArrive?.(e.spec);
        run.onDegrade?.(e.spec, 'stalled');
      });
    }, waveBudget);

    // The caller resolves at the TOUCHDOWNS (never held on the absorb tail);
    // the finish chain removes each piece when its decoration fully ends.
    // EVERY token's departure (its pop, or its refused birth) — the run's `onLeft` (the surface may fold).
    const departures: Array<Promise<void>> = [];
    const absorbs: Array<Promise<unknown>> = [];
    const touchdowns = entries.map((e) => {
      const piece = stage?.piece(e.id);
      if (piece === undefined) {
        if (!safetyFired) {
          run.onArrive?.(e.spec);
          run.onDegrade?.(e.spec, 'no-stage');
        }
        trail(runId, 'flight:no-piece', e.id);
        removeFlight(e.id);
        return Promise.resolve();
      }
      const liveFrom = () => measureEndRef(e.fromRef, e.spec, 'source');
      if (e.detached) {
        const detached = flyDetached(runId, run, piece, e, uiScale, pace, () => safetyFired, liveFrom);
        departures.push(detached);
        return detached;
      }
      const toHome = e.toRef === 'home';
      const handles = runTransferFlight(piece, {
        from: e.from,
        to: e.to,
        index: e.index,
        delayMs: e.delayMs,
        uiScale,
        hold: run.arrival === 'hold',
        pace,
        launch: transferLaunchFor(e.spec, run.destination !== undefined || run.destinationOf !== undefined),
        ...(run.absorb === undefined ? {} : {absorb: run.absorb}),
        // THE TWO ENDS ARE LIVE (T06): the source at the birth, the destination on the final approach and at the
        // touchdown — a bare point answers itself (and the sentinel asks what is painted under it).
        liveFrom,
        liveTo: () => measureEndRef(e.toRef, e.spec, 'destination'),
        // A double of the spec's own home that left → the home itself; the home's own ladder already IS the
        // stand-in chain (the first visible rung), and a landing on another seat has no stand-in of the viewer's.
        ...(!toHome && run.homeStandIn === true && e.spec.direction !== 'loss' ? {standIn: () => targetPointFor(e.spec)} : {}),
      });
      departures.push(handles.launched);
      absorbs.push(handles.finished);
      const loss = e.spec.direction === 'loss';
      // A LOSS is fixed at its DEPARTURE: the row's counter ticks the moment the chip leaves it.
      let released = false;
      const release = () => {
        if (!released && !safetyFired) {
          released = true;
          run.onArrive?.(e.spec);
        }
      };
      if (loss) {
        void handles.launched.then(release);
      }
      const touched = handles.touched.then(() => {
        // THE CONTACT BEAT, in one place: the tally a card-standing host reads
        // to tick its frozen counter, then the caller's own release (a loss
        // released at its launch; released here only if the launch never fired).
        noteCardResourceLanding(e.spec);
        release();
        reportEnds(runId, run, e, handles.report, safetyFired);
        // A hold-mode chip registers as RESTING synchronously with its
        // touchdown — the caller's commit/settle (which awaits the
        // touchdowns) can never race past an unregistered landed chip.
        if (run.arrival === 'hold' && handles.report.born !== 'unpainted') {
          heldChips.push({id: e.id, at: handles.report.restAt ?? e.to});
          trail(runId, 'flight:held', e.id);
        }
      });
      void handles.finished.then((outcome) => {
        if (outcome !== 'landed') {
          removeFlight(e.id); // 'auto' — absorbed at the destination
        }
      });
      return touched;
    });
    if (run.onLeft !== undefined) {
      void Promise.all(departures).then(leftOnce);
    }
    await Promise.all(touchdowns);
    void Promise.all(absorbs).then(absorbedOnce);
    window.clearTimeout(safety);
    markRun(false);
    trail(runId, 'run:end', {arrival: run.arrival});
  } catch (e) {
    // Documented contract: this function NEVER rejects. A throw here (e.g. a
    // stage piece unmounted mid-wave) once left `runActive` stuck true and
    // leaked the animation hold — record it, clean up, and resolve honestly.
    trail(runId, 'run:threw', String(e));
    console.error('[resource-transfer] wave threw — releasing gate', e);
    entries.forEach((entry) => {
      noteCardResourceLanding(entry.spec);
      run.onArrive?.(entry.spec);
      removeFlight(entry.id);
    });
    markRun(false);
    leftOnce();
    absorbedOnce();
  }
}

/** One end of a flight as it IS: an object (re-measured), the spec's own HOME ladder, or a bare point. */
type EndRef = TransferEndLike | 'home';

/**
 * MEASURE AN END NOW (T06 — «оба конца живые»). An object end must pass the ONE verdict of a visible end
 * (`transferEndVerdict`) — a source is measured as PAINTED (the chip is born where the object is now), a destination at
 * REST (`restingRectOf` — never where a settling zone is passing); the HOME ladder re-runs (its first visible rung); a
 * bare point answers itself. Undefined — the end is not painted: no birth, no landing there.
 */
function measureEndRef(ref: EndRef, spec: ResourceTransferSpec, role: 'source' | 'destination', skipped?: Array<SkippedEnd>, opts: TransferEndOptions = {}): TransferPoint | undefined {
  if (ref === 'home') {
    return targetPointFor(spec, skipped, opts);
  }
  if (!isTransferEnd(ref)) {
    return ref;
  }
  const verdict = transferEndVerdict(ref.el, opts);
  if (!verdict.visible) {
    skipped?.push({selector: describeEl(ref.el), verdict});
    return undefined;
  }
  const r = role === 'destination' ? restingRectOf(ref.el as HTMLElement) : ref.el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) {
    return undefined;
  }
  return transferEndPoint({x: r.left, y: r.top, w: r.width, h: r.height}, ref);
}

/** A short name of an element for the trail («div.pcard-ic» — its tag and first two classes). */
function describeEl(el: Element): string {
  return `${el.tagName.toLowerCase()}${Array.from(el.classList).slice(0, 2).map((c) => `.${c}`).join('')}`;
}

/** The run's shared source as an OBJECT end: the matched element's spawn band, kept as fractions of its box. */
function spawnEndOf(source: TransferEnd | TransferPoint, i: number, n: number): TransferEndLike {
  if (!isTransferEnd(source)) {
    return source;
  }
  const at = sourceSpawnPoint({x: 0, y: 0, w: 1, h: 1}, i, n);
  return {el: source.el, fx: at.x, fy: at.y};
}

/**
 * THE RUNTIME SENTINEL (T06): a token's two ends were PAINTED in the frame they mattered — said out loud otherwise, in
 * every build (the e2e harness turns `[transfer] end not painted` red on every spec). An OBJECT end cannot fail it by
 * construction (it is measured through the verdict — gone means not flown); what it watches is a BARE POINT, whose
 * object the framework cannot know: nothing painted under it (the console's root, the page) is a token born out of /
 * landed into nothing. A degraded end is named in the trail beside it.
 */
function reportEnds(runId: number, run: ResourceTransferRun, e: {id: number, spec: ResourceTransferSpec, fromRef: EndRef, toRef: EndRef}, report: TransferFlightReport, safetyFired: boolean): void {
  trail(runId, 'flight:ends', {id: e.id, born: report.born ?? null, end: report.end ?? null});
  if (report.born === 'unpainted') {
    if (!safetyFired) {
      run.onDegrade?.(e.spec, 'source-gone');
    }
    return;
  }
  if (report.end === 'lost' && !safetyFired) {
    run.onDegrade?.(e.spec, 'destination-gone');
  }
  const bare = (ref: EndRef) => ref !== 'home' && !isTransferEnd(ref);
  if (bare(e.fromRef) && report.bornAt !== undefined) {
    sentinel('birth', e.spec, report.bornAt);
  }
  if (bare(e.toRef) && report.restAt !== undefined && report.end !== 'lost') {
    sentinel('touchdown', e.spec, report.restAt);
  }
}

/**
 * An end's point NOW, through the same verdict a flight uses (an object must be painted; a bare point answers itself) —
 * for a caller that aims something else at the end (a token's formation leaning toward its destination).
 */
export function transferEndPointNow(end: TransferEndLike, role: 'source' | 'destination' = 'destination'): TransferPoint | undefined {
  if (!isTransferEnd(end)) {
    return end;
  }
  if (!transferEndVerdict(end.el).visible) {
    return undefined;
  }
  const r = role === 'destination' ? restingRectOf(end.el as HTMLElement) : end.el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? transferEndPoint({x: r.left, y: r.top, w: r.width, h: r.height}, end) : undefined;
}

/** What is painted under a point — undefined when something real is (any element but the page and the console's bare root). */
export function unpaintedUnder(point: TransferPoint): string | undefined {
  if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') {
    return undefined;
  }
  if (point.x < 0 || point.y < 0 || point.x > window.innerWidth || point.y > window.innerHeight) {
    return 'off-screen';
  }
  const top = document.elementsFromPoint(point.x, point.y).find((el) => el.closest('.con-transfer') === null);
  if (top === undefined) {
    return 'nothing';
  }
  if (top === document.documentElement || top === document.body || top.classList.contains('con-root')) {
    return describeEl(top);
  }
  return undefined;
}

function sentinel(end: 'birth' | 'touchdown', spec: ResourceTransferSpec, at: TransferPoint): void {
  const why = unpaintedUnder(at);
  if (why !== undefined) {
    console.warn(`[transfer] end not painted — the ${end} of ${spec.channel}:${spec.resource}${spec.targetCard !== undefined ? `@${spec.targetCard}` : ''} at (${Math.round(at.x)}, ${Math.round(at.y)}) stands over ${why}`);
  }
}

/** «Is this gain's destination COVERED by a surface that will leave?» — only then may its token wait for it (PL-165). */
function detachable(run: ResourceTransferRun, spec: ResourceTransferSpec, skipped: ReadonlyArray<SkippedEnd>): boolean {
  return run.detachCovered === true && run.arrival === 'auto' && run.destination === undefined && run.destinationOf === undefined &&
    spec.direction !== 'loss' && skipped.some((s) => !s.verdict.visible && s.verdict.why === 'covered');
}

/**
 * The destination, measured once the surface that covered it is GONE and the layout has come to rest — or undefined
 * once the budget is spent / the flight is gone. STRICT cover (a leaving surface still covers: it still imposes its
 * layout — the satellite stands in its workspace pose until the band is removed, then moves home) and a point that
 * holds for two consecutive probes: the 4K walk landed a floater in the empty pose the satellite had just left.
 */
function awaitVisibleDestination(spec: ResourceTransferSpec, budgetMs: number, alive: () => boolean): Promise<TransferPoint | undefined> {
  const deadline = performance.now() + budgetMs;
  let previous: TransferPoint | undefined;
  return new Promise((resolve) => {
    const poll = (): void => {
      if (!alive()) {
        resolve(undefined);
        return;
      }
      const point = targetPointFor(spec, undefined, {strict: true});
      if (point !== undefined && previous !== undefined && Math.abs(point.x - previous.x) <= 1 && Math.abs(point.y - previous.y) <= 1) {
        resolve(point);
        return;
      }
      if (performance.now() >= deadline) {
        resolve(undefined);
        return;
      }
      previous = point;
      probeTick(poll);
    };
    poll();
  });
}

/**
 * ONE DETACHED TOKEN (PL-165): born on its visible source, popped out of it, waiting in the app-level layer while the
 * surface that produced it leaves, flown to its destination once that is painted — or absorbed in place. The caller's
 * run counts it done at the POP (`onDetach`): its surface may fold now. Its own `onArrive` fires at the real touchdown.
 */
function flyDetached(
  runId: number,
  run: ResourceTransferRun,
  piece: TransferStagePiece,
  e: {id: number, spec: ResourceTransferSpec, from: TransferPoint, index: number, delayMs: number},
  uiScale: number,
  pace: number,
  safetyFired: () => boolean,
  liveFrom?: () => TransferPoint | undefined,
): Promise<void> {
  const alive = () => resourceTransferState.flights.some((f) => f.id === e.id);
  let reached = false;
  const handles = runDetachedTransferFlight(piece, {
    from: e.from,
    to: e.from,
    index: e.index,
    delayMs: e.delayMs,
    uiScale,
    hold: false,
    pace,
    launch: transferLaunchFor(e.spec, false),
    waitBudgetMs: motionMs(TRANSFER_DETACH_WAIT_MS),
    ...(liveFrom !== undefined ? {liveFrom} : {}),
    awaitTo: () => awaitVisibleDestination(e.spec, motionMs(TRANSFER_DETACH_WAIT_MS), alive).then((to) => {
      reached = to !== undefined;
      trail(runId, reached ? 'flight:detach-opened' : 'flight:detach-expired', e.id);
      return to;
    }),
    onArc: () => {
      // From here the chip FLIES (the surface has gone): an ordinary blocking chip for its last ~0.6 s.
      const record = resourceTransferState.flights.find((f) => f.id === e.id);
      if (record !== undefined && run.inSurface !== true) {
        record.inSurface = false;
      }
    },
  });
  void handles.touched.then(() => {
    noteCardResourceLanding(e.spec);
    if (!safetyFired()) {
      run.onArrive?.(e.spec);
      if (handles.report.born === 'unpainted') {
        run.onDegrade?.(e.spec, 'source-gone');
      } else if (!reached) {
        run.onDegrade?.(e.spec, 'no-destination');
      }
    }
    trail(runId, 'flight:ends', {id: e.id, born: handles.report.born ?? null, end: handles.report.end ?? null});
  });
  void handles.finished.then(() => removeFlight(e.id));
  return handles.launched.then(() => {
    trail(runId, 'flight:detached', e.id);
    run.onDetach?.(e.spec);
  });
}

/**
 * Finalize a `hold` run (the sale, post-commit): the landed chips are
 * absorbed into the (just updated) panel rows under one-shot halos.
 */
export async function settleResourceTransfers(): Promise<void> {
  const held = heldChips;
  heldChips = [];
  trail(undefined, 'settle:start', {heldIds: held.map((h) => h.id)});
  if (held.length === 0 || typeof document === 'undefined') {
    held.forEach((h) => removeFlight(h.id));
    return;
  }
  await Promise.all(held.map(async (h) => {
    const piece = stage?.piece(h.id);
    if (piece !== undefined) {
      await settleTransferChip(piece, h.at, motionMs(TRANSFER_BEAT_MS));
    }
    removeFlight(h.id);
  }));
  trail(undefined, 'settle:done');
}

/** Abort — unmount every chip with zero trace and drop the pending holds.
 *  Callers' own onArrive gates are freed by their run's safety net. */
export function abortResourceTransfers(): void {
  trail(undefined, 'abort', {flightIds: resourceTransferState.flights.map((f) => f.id), heldIds: heldChips.map((h) => h.id)});
  for (const f of resourceTransferState.flights) {
    const piece = stage?.piece(f.id);
    if (piece !== undefined) {
      killTransferPiece(piece);
    }
  }
  resourceTransferState.flights = [];
  heldChips = [];
  resourceTransferState.runActive = false;
  resourceTransferState.surfaceRuns = 0;
}

function removeFlight(id: number): void {
  resourceTransferState.flights = resourceTransferState.flights.filter((f) => f.id !== id);
}

// ── anchors (measured from the REAL interface, per profile) ─────────────────

/**
 * THE ENDS OF A FLIGHT ARE VISIBLE (the polish remediation iteration № 1, 2026-10-11 — `transferEndVisible.ts`).
 * Every ladder below measures the first VISIBLE match of a selector, never the first measurable one: a box under a
 * band surface's opaque glass (the ДОП. РЕСУРСЫ satellite under the composer — PL-137), a fading surface, a hidden
 * section are not places a token may be born on or land on. What a ladder skipped is collected for the trail, so a
 * degraded transfer names WHY («covered by con-cardactions»), and a dev build says it out loud once per run.
 */
type SkippedEnd = {selector: string, verdict: TransferEndVerdict};

/** LANDING measure: where the anchor will REST. A reward chip regularly aims
 *  at a zone that is still running its own entry (an embedded step's rise, a
 *  stage panel settling) — a raw rect lands the chip where the counter was
 *  PASSING and the touchdown tick happens off-target. */
function measureRestingRect(selector: string, skipped?: Array<SkippedEnd>, opts: TransferEndOptions = {}): TransferRect | undefined {
  const el = firstVisibleEnd(selector, skipped, opts);
  if (el === undefined) {
    return undefined;
  }
  const r = restingRectOf(el as HTMLElement);
  return r.width > 4 && r.height > 4 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

/** The ladder's skipped ends that were COVERED or FADED — the ones a player would have seen a token come from nowhere for. */
function coveredEnds(skipped: ReadonlyArray<SkippedEnd>): Array<string> {
  return skipped
    .filter((s) => !s.verdict.visible && (s.verdict.why === 'covered' || s.verdict.why === 'faded'))
    .map((s) => `${s.selector} (${s.verdict.visible ? '' : s.verdict.why}${!s.verdict.visible && s.verdict.by !== undefined ? ` by ${s.verdict.by}` : ''})`);
}

function centerOf(rect: TransferRect): TransferPoint {
  return {x: rect.x + rect.w / 2, y: rect.y + rect.h / 2};
}

/**
 * The run's shared source — an OBJECT end where it can be one (T06): an explicit end, else the first VISIBLE match of
 * the selectors (the law of visible ends — a parked layer may hold the same card identity under glass), kept as the
 * element so every token is born on it AS IT IS at its own birth; a bare point stays a point.
 */
function resolveSourceEnd(source: ResourceTransferRun['source'], skipped?: Array<SkippedEnd>): TransferEnd | TransferPoint | undefined {
  if (source.end !== undefined) {
    return source.end;
  }
  if (source.point !== undefined) {
    return source.point;
  }
  for (const sel of source.selectors ?? []) {
    const el = firstVisibleEnd(sel, skipped);
    if (el === undefined) {
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width > 4 && r.height > 4) {
      return transferEndOf(el, {x: r.left, y: r.top, w: r.width, h: r.height});
    }
  }
  return undefined;
}

/** Diagnostics only: what the card-resource destination ladder would see right now. */
function describeCardDestination(spec: ResourceTransferSpec): unknown {
  if (spec.channel !== 'card-resource' || spec.targetCard === undefined || typeof document === 'undefined') {
    return undefined;
  }
  const esc = escapeName(spec.targetCard);
  const round = (r: {left: number, top: number, width: number, height: number}) =>
    [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  return [
    `.con-colfocus [data-played-key="${esc}"] .pcard__res`,
    `.con-colfocus [data-played-key="${esc}"]`,
    `.con-fleetdock [data-played-key="${esc}"] .pcard__res`,
    `[data-played-key="${esc}"]`,
  ].map((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (el === null) {
      return {sel, found: false};
    }
    return {sel, found: true, raw: round(el.getBoundingClientRect()), rest: round(restingRectOf(el))};
  });
}

function escapeName(name: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(name) : name.replace(/"/g, '\\"');
}

/**
 * The exact landing point per destination channel (the left panel / the
 * chosen host card in the «Разыграно» table / the aux satellite).
 *
 * A TOKEN LANDS ON THE NUMBER IT CHANGES — the INK, never the column reserved
 * for it (PL-094, 2026-10-08). The rail's value column is reserved four digits
 * wide and right-aligned (the row contract), so its box's centre stands a
 * digit or two LEFT of a short number: measured at 4K a «12» sat 44 px right
 * of the landing, a «0» would sit a whole chip-width away — the token touched
 * down in the empty reserve, the counter ticked beside it, and the player read
 * «it flew off to the left, into nothing». The delta-chip anchor law already
 * made the ink-tight digits the ±N chip's anchor (`.con-res__digits`, the TR
 * cell's `.con-score__value`); the touchdown aims at the same ink, so the beat
 * halo wakes ON the number and the tick happens under the token. The
 * production plate's digits are centred IN the plate, so the plate is its ink;
 * a card's capsule and the satellite's cell are icon + count and stay whole.
 */
function targetPointFor(spec: ResourceTransferSpec, skipped?: Array<SkippedEnd>, opts: TransferEndOptions = {}): TransferPoint | undefined {
  const measure = (selector: string) => measureRestingRect(selector, skipped, opts);
  if (spec.channel === 'stock') {
    // The TERRAFORM RATING rides the stock channel under the rail's own key
    // (`RATING_RAIL_KEY`): its home is the score header's TR cell, not a
    // resource row (the Parliament's Agenda bonus and a rail reward fly there).
    // The VALUE is the ink; the valwrap is its reserved slot (3+ characters step
    // the type down INSIDE it), the cell the fallback of the fallback.
    if (spec.resource === RATING_RAIL_KEY) {
      const cell = measure('.con-res .con-score__cell--tr .con-score__value') ??
        measure('.con-res .con-score__cell--tr .con-score__valwrap') ??
        measure('.con-res .con-score__cell--tr');
      return cell !== undefined ? centerOf(cell) : undefined;
    }
    // …and the VICTORY POINTS (TR55) — the VP cell's own ink. A masked cell (the private score) paints no
    // `.con-score__value`, so there is no landing at all: a token never lands on the mask (the ledger flies none).
    if (spec.resource === VP_RAIL_KEY) {
      const cell = measure('.con-res .con-score__cell--vp .con-score__value');
      return cell !== undefined ? centerOf(cell) : undefined;
    }
    const r = measure(`.con-res__row--${spec.resource} .con-res__digits`) ??
      measure(`.con-res__row--${spec.resource} .con-res__stockwrap`) ??
      measure(`.con-res__row--${spec.resource}`);
    return r !== undefined ? centerOf(r) : undefined;
  }
  if (spec.channel === 'production') {
    const r = measure(`.con-res__row--${spec.resource} .con-res__prod`) ??
      measure(`.con-res__row--${spec.resource}`);
    return r !== undefined ? centerOf(r) : undefined;
  }
  // card-resource: the PRE-SELECTED host card when it's on screen — the
  // workspace RECEIVING STAGE's physical anchor (the front card / an emerged
  // target) first, then the COLONY FOCUS STAGE's presented target (a trade
  // reward's chosen host card, standing in the resolution scene — the chip
  // aims at the card's own stored-resource capsule, so the touchdown IS the
  // counter that ticks), the shared recipient picker's candidate, then the «Разыграно» table — else the
  // additional-resources satellite cell, else no flight.
  if (spec.targetCard !== undefined) {
    const esc = escapeName(spec.targetCard);
    // …the TERMINAL's receiving card (the patent sale — TR46: the data the slit pays land in its capsule), then
    // the RECEIVING CARD standing by the field (TR21's «cities pay» scene): its capsule is the counter that ticks.
    const r = measure(`.con-sale-hero [data-played-key="${esc}"] .pcard__res`) ??
      measure(`.con-sale-hero [data-played-key="${esc}"]`) ??
      measure(`.con-citypay [data-played-key="${esc}"] .pcard__res`) ??
      measure(`.con-recv [data-played-key="${esc}"] .pcard__res`) ??
      measure(`.con-recv [data-played-key="${esc}"]`) ??
      measure(`.con-colfocus [data-played-key="${esc}"] .pcard__res`) ??
      measure(`.con-colfocus [data-played-key="${esc}"]`) ??
      // …the FLEET-DOCK STAGE's receiving card (TR27: the dock pays a card it presents — or itself, its hero face):
      measure(`.con-fleetdock [data-played-key="${esc}"] .pcard__res`) ??
      measure(`.con-fleetdock [data-played-key="${esc}"]`) ??
      measure(`.con-hydro [data-played-key="${esc}"] .pcard__res`) ??
      measure(`.con-hydro [data-played-key="${esc}"]`) ??
      // …the SHARED recipient picker's candidate (an enacted resolution's
      // payout lands on the card the player just chose, while the pick is
      // still the standing view — the capsule is the counter that ticks):
      measure(`.con-cards__slot[data-zoom-slot="${esc}"] .pcard__res`) ??
      measure(`.con-cards__slot[data-zoom-slot="${esc}"]`) ??
      measure(`.con-start__played [data-played-key="${esc}"]`) ??
      measure(`.con-played [data-played-key="${esc}"]`);
    if (r !== undefined) {
      return centerOf(r);
    }
  }
  // …else the ДОП. РЕСУРСЫ satellite — ONLY while it is painted (the law of visible ends): under a band surface's
  // opaque glass it is a box, not a place, and the transfer degrades to its tick instead of flying into the glass.
  const aux = measure(`.con-res-aux__cell[data-aux-resource="${cardResourceKey(spec.resource)}"]`);
  return aux !== undefined ? centerOf(aux) : undefined;
}

/** Say it once per run in a dev build: an end the player would have seen a token come from / go to nothing for. */
function warnCoveredEnds(skipped: ReadonlyArray<SkippedEnd>, end: 'source' | 'destination'): void {
  const covered = coveredEnds(skipped);
  if (covered.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(`[transfer] no visible ${end} — ${covered.join('; ')} — the token is not flown (the law of visible ends); its counter ticks with its chip`);
  }
}
