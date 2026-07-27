/*
 * CONSOLE CARDS-RETURN BEAT — the closing movement of a play that sends cards
 * from the TABLE back into the HAND (Astra Mechanica: «верните до 2
 * разыгранных событий в руку»).
 *
 * It is deliberately NOT a scene of its own: it is the last beat of the
 * PLAYED-CARD HERO transaction, played inside the still-open «Разыграно»
 * overlay, so the play reads as one continuous movement —
 *
 *   the played card lands on the tableau  (hero scene)
 *   → the returned cards RISE out of the events pile they were lying in
 *   → they TURN face to the camera and pose to be read
 *   → the STANDARD hand intake carries them down into the dock
 *   → only then does the table close and the transaction finish.
 *
 * Ownership map (nothing here is new machinery):
 *   - which cards returned / where they pose → playedReturnModel (pure);
 *   - the rise + turn GSAP                   → the board-bonus director
 *     (`runBonusSingleFlight` / `runBonusFanOut` — the SAME choreography a
 *     bonus card uses to come off the board: one `from` rect, a gather, a
 *     back→face turn on the way to the pose. Reused verbatim, never copied);
 *   - the carry into the dock                → runHandIntake (the one intake
 *     every card acquisition in the console ends with);
 *   - the proxy stage                        → ConsolePlayedHeroLayer.vue;
 *   - the beat's place in the lifecycle      → consolePlayedHero (phase
 *     'returning', between the result beat and the auto-close).
 *
 * The dock is WITHHELD from the commit (withholdDockCards) until the intake
 * takes over, so the returned cards never appear in the pack before they have
 * physically flown there. Every exit path releases that hold.
 */

import {reactive, nextTick} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {
  runHandIntake, withholdDockCards, releaseDockCards, HandIntakeRect,
} from '@/client/console/handDock/handDeliveryDirector';
import {
  bonusSceneTimings, gatherPoint, RectLike,
} from '@/client/console/boardCardBonus/boardCardBonusModel';
import {
  runBonusFanOut, runBonusSingleFlight, BonusSceneHandle,
} from '@/client/console/boardCardBonus/boardCardBonusDirector';
import {
  detectReturnedToHand, returnPoseSlots, returnPoseRect, ReturnedCard, ReturnDiffView,
  RETURN_READ_MS, RETURN_SAFETY_MS,
} from '@/client/console/played/playedReturnModel';

/** The premium face's natural box (320×460) — the flight scale reference. */
const CARD_NATURAL_H = 460;

/** WHERE a face-down (event) card lifts from: the events pile of the table. */
const EVENTS_PILE_SEL = '.con-played .con-played__family--event .con-played__backstack';

export type ReturnFlight = {
  id: number,
  name: CardName,
  faceDown: boolean,
};

export const playedReturnState = reactive({
  /** TRUE while the rise/turn/pose beat owns its proxies. */
  active: false,
  nonce: 0,
  flights: [] as Array<ReturnFlight>,
});

/** Detected at the response, consumed by the beat (cleared on every exit). */
let pending: ReadonlyArray<ReturnedCard> = [];
/** Names currently withheld from the dock by THIS beat. */
let withheld: ReadonlyArray<CardName> = [];
/**
 * Departure rects measured BEFORE the commit (the cards are still on the
 * table there — one frame later the pile may be gone entirely):
 *  - `pileRect` — the SHARED source of a packet that came off the events
 *    pile as one; present only when EVERY returned card is face-down, which
 *    is what the rise + turn presentation depends on;
 *  - `sources`  — the per-card rect (its own tableau slot for a face-up
 *    card), used by the plain carry when there is no presentation.
 */
let pileRect: RectLike | undefined;
const sources = new Map<CardName, RectLike>();
let flightId = 0;
let scene: BonusSceneHandle | undefined;
let aborted = false;

type ReturnEls = {proxy: HTMLElement, flip: HTMLElement};
const els = new Map<number, ReturnEls>();

/** The layer registers each proxy's chassis (function refs, like every
 *  console flight layer). A null element de-registers. */
export function registerReturnFlightEls(id: number, proxy: HTMLElement | null, flip: HTMLElement | null): void {
  if (proxy === null || flip === null) {
    els.delete(id);
    return;
  }
  els.set(id, {proxy, flip});
}

/** TRUE while the beat is armed or running — the hero holds its scene open. */
export function hasPendingPlayedReturns(): boolean {
  return pending.length > 0;
}

export function isPlayedReturnActive(): boolean {
  return playedReturnState.active;
}

/**
 * ARM at the response, BEFORE the commit: work out what came back from the
 * table (authoritative view diff) and withhold those cards from the dock so
 * the commit cannot show them in the pack ahead of their flight.
 */
export function stagePlayedCardReturns(prev: ReturnDiffView | undefined, next: ReturnDiffView): void {
  resetPlayedCardReturns();
  const cards = detectReturnedToHand(prev, next, isEventCard);
  if (cards.length === 0) {
    return;
  }
  aborted = false;
  pending = cards;
  withheld = cards.map((c) => c.name);
  withholdDockCards(withheld);
}

/**
 * Measure the departure rect while the PRE-COMMIT table is still on screen.
 * Must be called before `updatePlayerView` — the returned events are removed
 * from the tableau by the commit, and a player whose last events these were
 * loses the pile element entirely one frame later.
 */
export function capturePlayedCardReturnSource(): void {
  if (pending.length === 0 || typeof document === 'undefined') {
    return;
  }
  const pile = rectOf(document.querySelector<HTMLElement>(EVENTS_PILE_SEL));
  for (const c of pending) {
    const r = c.faceDown ? pile :
      rectOf(document.querySelector<HTMLElement>(
        `.con-played [data-played-key="${escapeName(c.name)}"] .con-played__face`));
    if (r !== undefined) {
      sources.set(c.name, r);
    }
  }
  // The rise + turn presentation needs ONE shared departure: it is the
  // packet that was lying face-down on the events pile together. A face-up
  // card lifts from its own slot with nothing to turn — the plain carry.
  pileRect = pending.every((c) => c.faceDown) ? pile : undefined;
}

/**
 * The beat itself (post-commit, inside the open table). Resolves when the
 * cards have LANDED in the dock — the hero closes the table after it.
 * NEVER rejects: every degradation still delivers the cards to the pack.
 */
export async function runPlayedCardReturns(): Promise<void> {
  const cards = pending;
  pending = [];
  if (cards.length === 0) {
    return;
  }
  try {
    await withSafety(deliver(cards));
  } finally {
    finishBeat();
  }
}

/** The plain carry: no rise, no turn — the intake lifts each card from where
 *  it actually lay on the table (an unmeasurable source degrades inside the
 *  intake to a quiet materialization; the card is never lost). */
function plainCarry(cards: ReadonlyArray<ReturnedCard>): Promise<void> {
  return intake(cards, cards.map((c) => sources.get(c.name)));
}

async function deliver(cards: ReadonlyArray<ReturnedCard>): Promise<void> {
  // Reduced motion is its own axis: the intake degrades to an instant
  // release, so the cards simply appear in the pack.
  if (consoleReducedMotionActive()) {
    await plainCarry(cards);
    return;
  }
  // No measurable pile (the table never opened / a face-up card came back):
  // skip the presentation, keep the acquisition.
  const from = pileRect;
  if (from === undefined) {
    await plainCarry(cards);
    return;
  }

  playedReturnState.nonce++;
  playedReturnState.flights = cards.map((c) => ({id: ++flightId, name: c.name, faceDown: c.faceDown}));
  playedReturnState.active = true;
  await nextTick(); // the layer mounts the proxies + registers their chassis

  const stage = playedReturnState.flights.map((f) => els.get(f.id));
  if (aborted || stage.some((e) => e === undefined)) {
    await plainCarry(cards);
    return;
  }
  const proxies = stage.map((e) => (e as ReturnEls).proxy);
  const flips = stage.map((e) => (e as ReturnEls).flip);

  const t = bonusSceneTimings();
  const poses = returnPoseSlots(cards.length, window.innerWidth, window.innerHeight, CARD_NATURAL_W, CARD_NATURAL_H);
  const targets = poses.map((p) => returnPoseRect(p, CARD_NATURAL_W, CARD_NATURAL_H));

  await new Promise<void>((done) => {
    let settled = false;
    const arrive = () => {
      if (!settled) {
        settled = true;
        done();
      }
    };
    if (cards.length === 1) {
      // ONE card — it owns the screen: a single arc up out of the pile that
      // turns face-to-camera around its apex and settles centred.
      scene = runBonusSingleFlight({
        proxy: proxies[0], flip: flips[0], from, to: poses[0],
        naturalW: CARD_NATURAL_W, naturalH: CARD_NATURAL_H,
        t, reduced: false, onArrived: arrive,
      });
    } else {
      // TWO+ — they leave the pile as ONE packet (they were stacked
      // together), gather, then peel apart into the row, each completing its
      // own turn on its fan leg: the player sees two distinct cards, not a
      // blur.
      scene = runBonusFanOut({
        proxies, flips, from, targets,
        gather: gatherPoint(from, targets),
        t, reduced: false, onAllLanded: arrive,
      });
    }
  });
  if (aborted) {
    return;
  }

  // The read beat at the pose — then the STANDARD intake takes over from the
  // proxies' own rects (measured live: the pose is where they actually are).
  await wait(motionMs(RETURN_READ_MS));
  if (aborted) {
    return;
  }
  const rects = proxies.map((p, i) => rectOf(p) ?? targets[i]);
  await intake(cards, rects);
}

/**
 * Hand over to the console's ONE hand intake. `commit` releases the dock
 * withhold in the same synchronous block the intake registers its in-flight
 * ledger, so the pack never shows the card between the two; `onStaged` blanks
 * our posed proxies the frame the intake's own proxies stand on them.
 */
function intake(
  cards: ReadonlyArray<ReturnedCard>,
  rects: ReadonlyArray<RectLike | undefined> | undefined,
): Promise<void> {
  const names = cards.map((c) => c.name);
  const entries = cards.map((c, i) => {
    const r = rects?.[i];
    const rect: HandIntakeRect | undefined = r !== undefined ?
      {left: r.left, top: r.top, width: r.width, height: r.height} : undefined;
    return {name: c.name, rect};
  });
  return runHandIntake(entries, {
    mode: 'cascade',
    commit: () => releaseWithhold(names),
    onStaged: () => blankProxies(),
  });
}

/** Server error / unmount / safety: kill the beat and give the cards back to
 *  the dock immediately — a withheld card must never be lost. */
export function abortPlayedCardReturns(): void {
  if (pending.length === 0 && !playedReturnState.active && withheld.length === 0) {
    return;
  }
  aborted = true;
  pending = [];
  scene?.kill();
  scene = undefined;
  killProxies();
  finishBeat();
}

/** Game switch / test teardown. */
export function resetPlayedCardReturns(): void {
  aborted = true;
  pending = [];
  scene?.kill();
  scene = undefined;
  killProxies();
  finishBeat();
}

// ── internals ───────────────────────────────────────────────────────────────

function finishBeat(): void {
  releaseWithhold(withheld);
  pileRect = undefined;
  sources.clear();
  playedReturnState.active = false;
  playedReturnState.flights = [];
  els.clear();
  scene = undefined;
}

function releaseWithhold(names: ReadonlyArray<CardName>): void {
  if (withheld.length === 0) {
    return;
  }
  releaseDockCards(names.length > 0 ? names : withheld);
  withheld = [];
}

function blankProxies(): void {
  for (const e of els.values()) {
    gsap.set(e.proxy, {autoAlpha: 0});
  }
}

function killProxies(): void {
  for (const e of els.values()) {
    gsap.killTweensOf(e.proxy);
    gsap.killTweensOf(e.flip);
  }
}

function escapeName(name: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(name) : name.replace(/"/g, '\\"');
}

function isEventCard(name: CardName): boolean {
  try {
    return getCard(name)?.type === CardType.EVENT;
  } catch {
    return false;
  }
}

function rectOf(el: HTMLElement | null | undefined): RectLike | undefined {
  if (el === null || el === undefined) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2 ?
    {left: r.left, top: r.top, width: r.width, height: r.height} : undefined;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The beat can never wedge the hero transaction (which holds the whole
 *  foreground): a stalled tween loses the race and the flow continues. */
function withSafety(work: Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const settle = () => {
      if (!done) {
        done = true;
        window.clearTimeout(timer);
        resolve();
      }
    };
    const timer = window.setTimeout(() => {
      aborted = true;
      scene?.kill();
      settle();
    }, RETURN_SAFETY_MS);
    void work.then(settle, settle);
  });
}
