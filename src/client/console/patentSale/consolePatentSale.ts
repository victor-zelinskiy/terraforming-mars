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
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {sellPatentsPayout} from '@/client/components/handCards/sellPatentsState';
import {
  PatentSalePhase, SalePoint,
  SALE_LIFT_MS, SALE_GATHER_MS, SALE_GATHER_STAGGER_MS, SALE_INSERT_MS,
  SALE_PROCESS_MIN_MS, SALE_PAYOUT_MS, SALE_REDUCED_MS, SALE_ARM_SAFETY_MS,
  SALE_FLIGHT_CAP,
} from '@/client/console/patentSale/patentSaleModel';
import {
  SaleStageEls, SaleSource, placeSaleProxies, playSaleGather, playSaleInsert,
  startSaleProcessing, playSalePayout, playSaleSettle, killSaleTweens,
} from '@/client/console/patentSale/patentSaleDirector';

export type SaleFlight = {
  id: number,
  name: CardName,
};

export const patentSaleState = reactive({
  /** TRUE from arm until finish/abort — the transaction lock. */
  active: false,
  phase: 'idle' as PatentSalePhase,
  nonce: 0,
  /** Every card being sold (the submit payload — the honest count). */
  cards: [] as Array<CardName>,
  /** M€ the terminal pays out (client math, verified by the commit). */
  payout: 0,
  /** The card proxies that physically fly (capped — a big sale is a pile). */
  flights: [] as Array<SaleFlight>,
  reducedMotion: false,
});

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

// ── the lifecycle ───────────────────────────────────────────────────────────

/**
 * ARM (the shell's sale confirm, BEFORE the submit). Captures the sold
 * cards' live hand-slot rects in this same synchronous turn — the hand is
 * still on screen — and starts the client leg at once (flip → gather →
 * insert → processing). Sets `active` synchronously so the input gate
 * closes immediately (no double submit) and the poll guard is live.
 */
export function armPatentSale(opts: {cards: ReadonlyArray<CardName>}): void {
  clearTimers();
  claimed = false;
  capturedSources = captureSources(opts.cards);
  patentSaleState.active = true;
  patentSaleState.phase = 'gathering';
  patentSaleState.nonce++;
  patentSaleState.cards = [...opts.cards];
  patentSaleState.payout = sellPatentsPayout(opts.cards.length);
  patentSaleState.flights = capturedSources.map((s) => ({id: s.id, name: s.name}));
  patentSaleState.reducedMotion = consoleReducedMotionActive();
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
    }, motionMs(SALE_LIFT_MS + SALE_GATHER_MS + SALE_INSERT_MS + SALE_PROCESS_MIN_MS + SALE_PAYOUT_MS) + 3000);
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
  if (els !== undefined && !patentSaleState.reducedMotion) {
    await playSaleSettle(els, conUiScale());
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
    }
  });
}

// ── internals ───────────────────────────────────────────────────────────────

/** The shared "slot is empty" cascade rule (cardExitDirector.HOLD_CLASS). */
const HOLD_CLASS = 'con-deal-hold';
/** Where a payout chip lands: the resource rail's M€ icon (always on). */
const MEGACREDITS_ANCHOR = '.con-res__row--megacredits .con-res__icon';

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
  // the sale UI + returns to the board UNDER the (independent) scene.
  patentSaleState.phase = 'inserting';
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
  const target = measureAnchor();
  if (patentSaleState.reducedMotion || els === undefined || target === undefined || capturedSources.length === 0) {
    // Degraded: no scene to pace — a minimal controlled beat, then commit.
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
  await playSalePayout(els, {
    to: target,
    uiScale: conUiScale(),
    durationMs: motionMs(SALE_PAYOUT_MS),
  });
}

function measureAnchor(): SalePoint | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const el = document.querySelector<HTMLElement>(MEGACREDITS_ANCHOR);
  if (el === null) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) {
    return undefined;
  }
  return {x: r.left + r.width / 2, y: r.top + r.height / 2};
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
  restoreSources();
  patentSaleState.active = false;
  patentSaleState.phase = 'idle';
  patentSaleState.cards = [];
  patentSaleState.payout = 0;
  patentSaleState.flights = [];
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
