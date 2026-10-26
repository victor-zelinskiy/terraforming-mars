/*
 * CONSOLE PATENT SALE — the animation TRANSACTION behind the "cards feed the
 * trade terminal, the terminal pays" hero scene of sell patents
 * (console-native only).
 *
 * The gate follows the established trade-fleet / played-hero contract:
 *
 *   ConsoleShell ARMS the transaction at the sale confirm (armPatentSale —
 *   the sold cards' live hand-slot rects are captured in the SAME synchronous
 *   turn, then the client leg starts at once: flip → gather → insert →
 *   processing, absorbing the server round-trip inside the terminal's
 *   working beat), WaitingFor DETECTS it once per response (detectPatentSale
 *   — consumes the arm and VERIFIES the server actually removed the sold
 *   cards from the hand: no server success → no payout, ever), HOLDS the
 *   commit through the payout leg (await runPatentSale — the M€ chip pops
 *   out of the slit and arcs onto the resource rail's M€ row), then COMMITS
 *   the authoritative view (the M€ counter + the standard delta chip land
 *   exactly at the chip's touchdown — the chip gate IS the commit hold), and
 *   finally endPatentSale() plays the post-commit settle (chip absorbed into
 *   the row + a one-shot halo, terminal retracts). abortPatentSale() is
 *   wired into every error path and a safety timer — the gate can never hang
 *   and a refused sale never leaves ghost cards or a stuck lock.
 *
 * Ownership map:
 *   - phases / geometry / timings → patentSaleModel (pure, tested);
 *   - GSAP work on the stage      → patentSaleDirector;
 *   - the fixed proxy stage       → ConsolePatentSaleLayer.vue;
 *   - sale UI close / section     → ConsoleShell watcher on `phase`.
 *
 * DESKTOP SAFETY: `armPatentSale` is ONLY called by the console shell, so on
 * desktop (and for every non-sale submit) `patentSaleState.active` is false
 * and `detectPatentSale` returns undefined → the WaitingFor hold never
 * engages. The feature is entirely console-native + fully gated.
 */

import {reactive, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {
  PatentSalePhase,
  SALE_LIFT_MS, SALE_GATHER_MS, SALE_GATHER_STAGGER_MS, SALE_INSERT_MS,
  SALE_PROCESS_MIN_MS, SALE_REDUCED_MS, SALE_ARM_SAFETY_MS,
  SALE_FLIGHT_CAP, SALE_RECEIVERS_RISE_MS,
} from '@/client/console/patentSale/patentSaleModel';
import {
  SaleStageEls, SaleSource, placeSaleProxies, playSaleGather, playSaleInsert,
  startSaleProcessing, playSaleDispense, playSaleSettle, killSaleTweens, saleSlitCenter,
} from '@/client/console/patentSale/patentSaleDirector';
import {
  runResourceTransfers, settleResourceTransfers, abortResourceTransfers,
  beginPanelRewardHold, declareHeldAnswers, releasePanelRewardHold, resetCardResourceLandings,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec, TransferPoint, transferFlightBudgetMs} from '@/client/console/resourceTransfer/resourceTransferModel';
import {PatentSaleAnswer, answerTransferSpec, patentSaleReceivers} from '@/client/console/patentSale/patentSaleAnswers';
import {cardArtUrlAtTier, premiumCardArt} from '@/client/cards/cardArt';

export type SaleFlight = {
  id: number,
  name: CardName,
};

export type PatentSaleSource = 'standard-project' | 'resolution';

/**
 * A card the terminal stands up beside itself while it pays (TR46 — the
 * owner's decision 2026-10-12: «the receiving card at the terminal»): the card
 * a data token lands ON (its capsule is the counter that ticks — `before` +
 * the landings of this sale) and the card a stock answer comes FROM (Martian
 * Fiber — its face is its chip's birth point). Both ends of every answer's
 * flight are thereby on screen (the law of visible ends).
 */
export type SaleReceiver = {card: CardName, before: number};

export const patentSaleState = reactive({
  /** TRUE from arm until finish/abort — the transaction lock. */
  active: false,
  phase: 'idle' as PatentSalePhase,
  nonce: 0,
  /** Every card being sold (the submit payload — the honest count). */
  cards: [] as Array<CardName>,
  /** M€ the terminal pays out (client math, verified by the commit). */
  payout: 0,
  /**
   * WHO runs the terminal: the standard project (1 M€ per card, the hand's
   * own sale mode) or the enacted RESOLUTION's action (Open IP Trade: 3 M€
   * per card, a step of the action workspace) — the SAME scene, the caller's
   * rate and kicker. The shell's phase watcher reads it to know whose flow
   * closes when the stack enters the terminal.
   */
  source: 'standard-project' as PatentSaleSource,
  /** The terminal's printed kicker (an i18n key). */
  kicker: 'Patent sale',
  /** The card proxies that physically fly (capped — a big sale is a pile). */
  flights: [] as Array<SaleFlight>,
  reducedMotion: false,
  /** The table's answers to THIS sale (`patentSaleAnswers` — the server's rate × the cards sold), frozen at arm. */
  answers: [] as Array<PatentSaleAnswer>,
  /** The cards the terminal stands up for those answers, in their order. */
  receivers: [] as Array<SaleReceiver>,
  /** The receivers stand (they rise once the cards are inside the terminal, and sink with it). */
  receiversUp: false,
});

/**
 * The answers' STOCK chips (Martian Fiber's M€ for the data) are HELD on the
 * rail from the COMMIT until their own chip lands: the view commits at the
 * project's touchdown and must not show money whose chip has not flown yet.
 * Owed from the payout (`pendingAnswerSpecs`), seeded in the transport's
 * apply block — the SAME block as the commit (`seedPatentSaleRewardHold`):
 * a hold seeded before it would show the rail BELOW its pre-sale value — and
 * released at each touchdown, and by every way out (finish / abort).
 */
let pendingAnswerSpecs: Array<ResourceTransferSpec> = [];
/** The receivers' art, warmed at arm: a card stands up only with its face painted (never an empty frame). */
let receiversArt: Promise<void> = Promise.resolve();
let heldAnswerSpecs: Array<ResourceTransferSpec> = [];

/** The transport's apply block, beside the commit: the answers' rail half is held from this very commit on. */
export function seedPatentSaleRewardHold(): void {
  if (!patentSaleState.active || pendingAnswerSpecs.length === 0) {
    return;
  }
  heldAnswerSpecs = [...pendingAnswerSpecs];
  pendingAnswerSpecs = [];
  beginPanelRewardHold(heldAnswerSpecs);
  // Declared for the card-reaction seeder (CN): the terminal flies the table's answers itself, off the answering
  // cards standing beside it — the records' shares are this host's, never the chain's second flight.
  declareHeldAnswers(heldAnswerSpecs);
}

/** One-shot claim per response (mirrors tradeFleet's `claimed`). */
let claimed = false;
let armSafety: number | undefined;
let sceneSafety: number | undefined;
/** Resolves the WaitingFor commit gate (abort must always free it). */
let runResolve: (() => void) | undefined;
/** When the terminal reached `processing` (the min working beat anchors here). */
let processingStartedAt = 0;
/** The hand-slot cards we visually blanked under the proxies (abort restores). */
let heldSourceEls: Array<HTMLElement> = [];
/** The captured launch geometry (rect per flying card), taken at arm time. */
let capturedSources: Array<SaleSource & {holdEl: HTMLElement}> = [];
let flightSeq = 0;

// ── stage registry (the layer plugs in) ─────────────────────────────────────

type SaleStageHandle = {els: () => SaleStageEls | undefined};
let stage: SaleStageHandle | undefined;

export function registerPatentSaleStage(handle: SaleStageHandle): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
}

// ── predicates ──────────────────────────────────────────────────────────────

export function isPatentSaleActive(): boolean {
  return patentSaleState.active;
}

/** TRUE while the scene owns the foreground (pad inert, bar quiet). */
export function patentSaleHolding(): boolean {
  const p = patentSaleState.phase;
  return patentSaleState.active && p !== 'idle' && p !== 'failed';
}

// The whole trade-terminal scene — incl. the post-commit settle — holds the
// presentation (notifications queue, mandatory surfaces wait); releases the
// instant the phase drops on end/abort (the scene's real completion signal).
registerAnimationHoldSupplier('patent-sale', patentSaleHolding);

// ── the lifecycle ───────────────────────────────────────────────────────────

/**
 * ARM (the shell's sale confirm, BEFORE the submit). Captures the sold
 * cards' live hand-slot rects in this same synchronous turn — the hand is
 * still on screen — and starts the client leg at once (flip → gather →
 * insert → processing). Sets `active` synchronously so the input gate
 * closes immediately (no double submit) and the poll guard is live.
 */
export function armPatentSale(opts: {
  cards: ReadonlyArray<CardName>,
  /** The M€ each card pays — the server's rate (`PatentSaleModel.megacreditsPerCard` / the law's). */
  payoutPerCard: number,
  source?: PatentSaleSource,
  /** The terminal's kicker (an i18n key — «Patent sale» by default). */
  kicker?: string,
  /** The table's answers to this sale (the standard project's model × the cards); none for a law's sale. */
  answers?: ReadonlyArray<PatentSaleAnswer>,
  /** A receiver card's capsule at arm (its stored resources on the viewer's table). */
  capsuleOf?: (card: CardName) => number,
}): void {
  clearTimers();
  claimed = false;
  capturedSources = captureSources(opts.cards);
  patentSaleState.active = true;
  patentSaleState.phase = 'gathering';
  patentSaleState.nonce++;
  patentSaleState.cards = [...opts.cards];
  patentSaleState.payout = opts.payoutPerCard * opts.cards.length;
  patentSaleState.source = opts.source ?? 'standard-project';
  patentSaleState.kicker = opts.kicker ?? 'Patent sale';
  patentSaleState.flights = capturedSources.map((s) => ({id: s.id, name: s.name}));
  patentSaleState.reducedMotion = consoleReducedMotionActive();
  patentSaleState.answers = [...(opts.answers ?? [])];
  patentSaleState.receivers = patentSaleReceivers(patentSaleState.answers).map((card) => ({card, before: opts.capsuleOf?.(card) ?? 0}));
  patentSaleState.receiversUp = false;
  heldAnswerSpecs = [];
  pendingAnswerSpecs = [];
  receiversArt = warmReceiverArt(patentSaleState.receivers.map((r) => r.card));
  resetCardResourceLandings();
  // A submit the server never answers (dropped / errored before the
  // WaitingFor detect) can never strand the terminal mid-work — the arm
  // self-aborts and the UI unwinds with zero trace.
  armSafety = window.setTimeout(() => abortPatentSale(), SALE_ARM_SAFETY_MS);
  void executeClientLeg();
}

/**
 * DETECT (WaitingFor commit path) — consume the arm exactly once per
 * response. Returns undefined — and fully aborts — unless the SERVER
 * actually removed every sold card from the hand (the authoritative
 * success proof; a refused sale can never fake a payout).
 */
export function detectPatentSale(view: PlayerViewModel): {payout: number} | undefined {
  if (!patentSaleState.active || claimed) {
    return undefined;
  }
  claimed = true;
  if (armSafety !== undefined) {
    window.clearTimeout(armSafety);
    armSafety = undefined;
  }
  const inHand = new Set((view.cardsInHand ?? []).map((c) => c.name));
  const sold = patentSaleState.cards.every((name) => !inHand.has(name));
  if (!sold) {
    abortPatentSale();
    return undefined;
  }
  return {payout: patentSaleState.payout};
}

/**
 * RUN (WaitingFor await) — the server confirmed the sale: let the terminal
 * finish its working beat, then fire the payout chip to the resource rail's
 * M€ row. Resolves at the chip's TOUCHDOWN — the caller then commits the
 * view (the counter + delta chip land on a chip that has arrived) and calls
 * endPatentSale() on nextTick. NEVER rejects; every failure degrades to a
 * short controlled beat and the promise still resolves (the commit gate can
 * never hang).
 */
export function runPatentSale(): Promise<void> {
  return new Promise<void>((resolve) => {
    runResolve = resolve;
    sceneSafety = window.setTimeout(() => {
      // rAF stall / lost element — force the gate open, degrade gracefully.
      freeRunGate();
    }, motionMs(SALE_LIFT_MS + SALE_GATHER_MS + SALE_INSERT_MS + SALE_PROCESS_MIN_MS + transferFlightBudgetMs()) + 3000);
    void executePayout().finally(() => freeRunGate());
  });
}

/**
 * END (next tick, after the view committed) — the M€ counter just ticked and
 * the standard delta chip fired under the landed payout chip: absorb the
 * chip into the row (one-shot halo), retract the terminal, unmount.
 */
export async function endPatentSale(): Promise<void> {
  if (!patentSaleState.active) {
    return;
  }
  patentSaleState.phase = 'settling';
  const els = stage?.els();
  if (!patentSaleState.reducedMotion && heldAnswerSpecs.length > 0) {
    // The landed chips absorb (the money into the row, the data into the
    // capsule) while the answer to the answer — Martian Fiber's M€ for the
    // data it just saw land — leaves ITS card for the rail (PL-189: an effect
    // answering another effect holds its own chips, after the one it answers).
    const settled = settleResourceTransfers();
    const specs = [...heldAnswerSpecs];
    await runResourceTransfers({
      specs,
      // Each chip from the face of the card that pays it; the receivers' strip is the fallback birth band.
      source: {selectors: ['.con-sale-hero__recvs']},
      origins: specs.map((spec) => receiverPoint(payerOf(spec))),
      arrival: 'auto',
      onArrive: (spec) => {
        releasePanelRewardHold(spec);
        heldAnswerSpecs = heldAnswerSpecs.filter((h) => h !== spec);
      },
    });
    await settled;
    patentSaleState.receiversUp = false;
    if (els !== undefined) {
      await playSaleSettle(els, conUiScale());
    }
  } else if (!patentSaleState.reducedMotion) {
    // The framework absorbs the landed chips (the M€ into the just-updated row,
    // a data token into its capsule) under their one-shot halo while the
    // terminal retracts into the table — the receivers with it.
    patentSaleState.receiversUp = false;
    await Promise.all([
      settleResourceTransfers(),
      els !== undefined ? playSaleSettle(els, conUiScale()) : Promise.resolve(),
    ]);
  } else {
    await settleResourceTransfers(); // no landed chips under reduced motion
  }
  finish();
}

/**
 * ABORT — server error, network failure, safety timer, unmount. Restores
 * the blanked hand cards, drops the stage, frees the commit gate, and flags
 * `failed` for one flush. If the sale UI was still open (an error before
 * the stack entered the terminal), the player's picks are intact.
 */
export function abortPatentSale(): void {
  if (!patentSaleState.active && runResolve === undefined) {
    return;
  }
  clearTimers();
  const els = stage?.els();
  if (els !== undefined) {
    killSaleTweens(els);
  }
  abortResourceTransfers(); // a mid-flight payout chip unmounts with zero trace
  releaseAnswerHolds(); // an answer held on the rail is never stranded
  restoreSources();
  patentSaleState.active = false;
  patentSaleState.phase = 'failed';
  patentSaleState.flights = [];
  freeRunGate();
  // One flush later the transaction is fully idle (watchers saw 'failed').
  void nextTick(() => {
    if (patentSaleState.phase === 'failed') {
      patentSaleState.phase = 'idle';
      patentSaleState.cards = [];
      patentSaleState.payout = 0;
      patentSaleState.answers = [];
      patentSaleState.receivers = [];
      patentSaleState.receiversUp = false;
    }
  });
}

// ── internals ───────────────────────────────────────────────────────────────

/** The shared "slot is empty" cascade rule (cardExitDirector.HOLD_CLASS). */
const HOLD_CLASS = 'con-deal-hold';

/**
 * The CLIENT LEG (starts at arm): proxies stand over the real cards (which
 * blank in the same frame), lift, flip to backs and converge into the neat
 * stack while the terminal slides open; the stack sinks through the slit
 * (`inserting` — the shell closes the sale UI here); the mechanism starts
 * working (`processing` — the server round-trip hides inside this beat).
 * Every degraded path (no rects / no stage / reduced motion) still walks
 * the SAME phases so the shell watcher + the payout leg stay in step.
 */
async function executeClientLeg(): Promise<void> {
  if (!patentSaleState.active) {
    return;
  }
  if (patentSaleState.reducedMotion || capturedSources.length === 0) {
    // No flights: the phase ladder still runs so the sale UI closes and the
    // payout leg finds `processing` — one short controlled beat, no proxies.
    patentSaleState.phase = 'inserting';
    await wait(patentSaleState.reducedMotion ? SALE_REDUCED_MS : 0);
    enterProcessing();
    return;
  }
  await nextTick(); // the layer + proxies mount
  if (!patentSaleState.active) {
    return; // aborted while mounting — abort already cleaned up
  }
  const els = stage?.els();
  if (els === undefined || !placeSaleProxies(els, capturedSources)) {
    patentSaleState.phase = 'inserting';
    enterProcessing();
    return;
  }
  // Blank the real hand cards in the SAME synchronous turn the proxies stand
  // over them — one physical card per frame, never double vision.
  holdSources();
  const uiScale = conUiScale();
  await playSaleGather(els, {
    uiScale,
    liftMs: motionMs(SALE_LIFT_MS),
    gatherMs: motionMs(SALE_GATHER_MS),
    staggerMs: motionMs(SALE_GATHER_STAGGER_MS),
  });
  if (!patentSaleState.active) {
    return; // aborted mid-scene — abort already cleaned up
  }
  // The hand has physically given the cards away — the shell watcher closes
  // the sale UI + returns to the board UNDER the (independent) scene. The cards
  // that will answer the sale stand up beside the terminal as the stack sinks —
  // the table listens before it answers, and stands painted at the payout.
  patentSaleState.phase = 'inserting';
  raiseReceivers();
  await playSaleInsert(els, {uiScale, durationMs: motionMs(SALE_INSERT_MS)});
  if (!patentSaleState.active) {
    return;
  }
  enterProcessing();
  const live = stage?.els();
  if (live !== undefined) {
    startSaleProcessing(live);
  }
}

function enterProcessing(): void {
  if (!patentSaleState.active) {
    return; // an abort mid-await must never resurrect the phase ladder
  }
  patentSaleState.phase = 'processing';
  processingStartedAt = Date.now();
}

/** The PAYOUT LEG (runs under the WaitingFor hold, after server proof). */
async function executePayout(): Promise<void> {
  // The client leg may still be gathering/inserting — the payout never
  // preempts it (the chip can only come out of a terminal that has taken
  // the cards in). Frame-polled with a hard deadline: a stalled leg can
  // never wedge the commit.
  const deadline = Date.now() + motionMs(SALE_LIFT_MS + SALE_GATHER_MS + SALE_INSERT_MS) + 2500;
  while (patentSaleState.active && patentSaleState.phase !== 'processing' && Date.now() < deadline) {
    await frame();
  }
  if (!patentSaleState.active) {
    return;
  }
  const els = stage?.els();
  const slit = saleSlitCenter();
  if (patentSaleState.reducedMotion || els === undefined || slit === undefined || capturedSources.length === 0) {
    // Degraded: no scene to pace — a minimal controlled beat, then commit (every answer with it: nothing held).
    patentSaleState.phase = 'paying';
    await wait(patentSaleState.reducedMotion ? 0 : 60);
    return;
  }
  // The mechanism is SEEN working even when the server answers instantly.
  const minBeat = motionMs(SALE_PROCESS_MIN_MS) - (Date.now() - processingStartedAt);
  if (minBeat > 0) {
    await wait(minBeat);
  }
  if (!patentSaleState.active) {
    return;
  }
  patentSaleState.phase = 'paying';
  // The dispense flash announces the payout, then the SHARED resource-
  // transfer framework ejects the M€ chip from the slit and arcs it onto the
  // resource rail's M€ row — `arrival: 'hold'`: the chip RESTS there until
  // the (gated) commit fires the delta chip and endPatentSale absorbs it.
  // Resolves at the chip's touchdown — the caller commits right after.
  playSaleDispense(els);
  // THE TERMINAL PAYS TWICE (TR46): the project's money onto the rail and the
  // data its answer stores into the receiving card's capsule — one wave out of
  // the slit; both REST on their destination until the commit, which lands at
  // their touchdowns. The answers to THOSE answers (Martian Fiber's M€) fly
  // after the commit, from their own card, so they are held on the rail now.
  const {fromSlit, fromCards} = answerSpecs();
  pendingAnswerSpecs = [...fromCards];
  // A token lands only on an end that is PAINTED (the law of visible ends): the receivers' rise has to be up.
  if (patentSaleState.receivers.length > 0) {
    await receiversStanding();
  }
  if (!patentSaleState.active) {
    return;
  }
  await runResourceTransfers({
    specs: [{channel: 'stock', resource: 'megacredits', amount: patentSaleState.payout}, ...fromSlit],
    source: {point: slit},
    arrival: 'hold',
  });
}

/** The answers' flights: card-resource chips leave the slit, stock chips leave their own card. */
function answerSpecs(): {fromSlit: Array<ResourceTransferSpec>, fromCards: Array<ResourceTransferSpec>} {
  const fromSlit: Array<ResourceTransferSpec> = [];
  const fromCards: Array<ResourceTransferSpec> = [];
  for (const answer of patentSaleState.answers) {
    const spec = answerTransferSpec(answer);
    if (spec === undefined) {
      continue;
    }
    (spec.channel === 'card-resource' ? fromSlit : fromCards).push(spec);
  }
  return {fromSlit, fromCards};
}

/** Release whatever of the answers' rail hold has not landed (finish / abort — never a stranded M€). */
function releaseAnswerHolds(): void {
  for (const spec of heldAnswerSpecs) {
    releasePanelRewardHold(spec);
  }
  heldAnswerSpecs = [];
  pendingAnswerSpecs = [];
}

/**
 * The THUMB tier of every receiver's art, fetched AND decoded — the tier the
 * receivers paint (`art-tier="thumb"`): `img.src` only guarantees the bytes,
 * and a face standing up before its decode is an empty frame (the first 4K
 * storyboard: two blank cards for ~0.3 s). Never rejects.
 */
function warmReceiverArt(cards: ReadonlyArray<CardName>): Promise<void> {
  if (typeof Image === 'undefined' || cards.length === 0) {
    return Promise.resolve();
  }
  return Promise.all(cards.map((name) => {
    const img = new Image();
    img.src = cardArtUrlAtTier(premiumCardArt(name).url, 'thumb');
    return img.decode?.().catch(() => undefined) ?? Promise.resolve();
  })).then(() => undefined);
}

/** The receivers stand up once their faces are painted — bounded: a slow decode never holds the payout. */
function raiseReceivers(): void {
  if (patentSaleState.receivers.length === 0) {
    return;
  }
  const nonce = patentSaleState.nonce;
  const raise = () => {
    if (patentSaleState.active && patentSaleState.nonce === nonce) {
      patentSaleState.receiversUp = true;
    }
  };
  void Promise.race([receiversArt, wait(motionMs(SALE_INSERT_MS))]).then(raise);
}

/** The receivers' rise has landed: every receiver card painted at full opacity (bounded — a lost frame never wedges the payout). */
async function receiversStanding(): Promise<void> {
  const deadline = Date.now() + motionMs(SALE_RECEIVERS_RISE_MS) + 400;
  while (patentSaleState.active && Date.now() < deadline) {
    const strip = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.con-sale-hero__recvs--up');
    if (strip !== null && Number(getComputedStyle(strip).opacity) >= 0.98) {
      return;
    }
    await frame();
  }
}

/** The card whose answer a held stock spec is — its face is the chip's birth point. */
function payerOf(spec: ResourceTransferSpec): CardName | undefined {
  return patentSaleState.answers.find((a) => {
    const own = answerTransferSpec(a);
    return own !== undefined && own.channel === spec.channel && own.resource === spec.resource && own.amount === spec.amount;
  })?.card;
}

/** The birth point of a stock answer: the face of the card that pays it (standing beside the terminal). */
function receiverPoint(card: CardName | undefined): TransferPoint | undefined {
  if (card === undefined || typeof document === 'undefined') {
    return undefined;
  }
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-sale-hero__recv-card'))) {
    if (el.dataset.saleReceiver !== card) {
      continue;
    }
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 ? {x: r.left + r.width / 2, y: r.top + r.height * 0.42} : undefined;
  }
  return undefined;
}

function captureSources(cards: ReadonlyArray<CardName>): Array<SaleSource & {holdEl: HTMLElement}> {
  if (typeof document === 'undefined') {
    return [];
  }
  const out: Array<SaleSource & {holdEl: HTMLElement}> = [];
  for (const name of cards) {
    if (out.length >= SALE_FLIGHT_CAP) {
      break;
    }
    const el = document.querySelector<HTMLElement>(
      `.con-hand__slot[data-zoom-slot="${String(name).replace(/"/g, '\\"')}"] :is(.card-container, .pcard)`);
    if (el === null) {
      continue; // scrolled out of the virtualized grid — it rides the pile
    }
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) {
      continue;
    }
    out.push({id: ++flightSeq, name, rect: {x: r.left, y: r.top, w: r.width, h: r.height}, holdEl: el});
  }
  return out;
}

function holdSources(): void {
  heldSourceEls = capturedSources.map((s) => s.holdEl);
  heldSourceEls.forEach((el) => el.classList.add(HOLD_CLASS));
}

function restoreSources(): void {
  heldSourceEls.forEach((el) => el.classList.remove(HOLD_CLASS));
  heldSourceEls = [];
  capturedSources = [];
}

function finish(): void {
  clearTimers();
  releaseAnswerHolds();
  restoreSources();
  patentSaleState.active = false;
  patentSaleState.phase = 'idle';
  patentSaleState.cards = [];
  patentSaleState.payout = 0;
  patentSaleState.flights = [];
  patentSaleState.answers = [];
  patentSaleState.receivers = [];
  patentSaleState.receiversUp = false;
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

function frame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 16);
    }
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
