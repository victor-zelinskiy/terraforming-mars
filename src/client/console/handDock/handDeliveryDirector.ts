/*
 * HAND DELIVERY DIRECTOR — the starting-cards delivery cinematic: "I paid
 * for my starting cards, and now they flew from the deck and landed in my
 * hand."
 *
 * CHOREOGRAPHY. The bought cards depart the PROJECT DECK in the top HUD
 * (`.con-deckstack` — the thematic source: you bought them from the deck),
 * lift as one small stack, FAN out, then arc down the screen and settle
 * one-by-one into their real positions in the bottom-centre hand dock bay.
 * Each card materializes under its landed proxy (the standard handoff), and
 * the dock counter ticks UP as the cards arrive — 0 → N, counted into the
 * hand. A long, weighty arc with a soft landing: a deliberate start-of-game
 * beat, not a UI refresh.
 *
 * ONE CARD — ONE VISIBLE REPRESENTATION. The bought names are HELD out of
 * the dock from SUBMIT time (`handDeliveryState.held`, read by the dock:
 * hidden + excluded from the shown count), so a paid card can never flash
 * in the hand before its delivery lands. The flying proxies are the only
 * visible version of each card until touchdown; releasing a held name is
 * its materialization (the dock card's own 160ms fade-in under the proxy's
 * fade-out at an identical rect).
 *
 * LIFECYCLE. `armStartingCardsDelivery(names)` at start-buy submit sets the
 * hold. `maybeRunDelivery(handNames, dockEl, deckEl)` on each playerView
 * commit fires the flight the moment ALL bought names are in the hand and
 * the dock/deck are on screen. Registered as an animation hold so
 * notifications/modals wait. Reduced motion / unmeasurable geometry →
 * instant release (no proxies), the project convention. A safety timeout
 * force-releases a stalled flight.
 */

import {nextTick} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {
  clearDeliveryFlights, deliveryEl, handDeliveryState, nextDeliveryId,
} from '@/client/console/handDock/handDeliveryState';

type Pending = {
  names: Array<CardName>,
  fired: boolean,
};

let pending: Pending | undefined;
let running = false;
let safety: ReturnType<typeof setTimeout> | undefined;

/** True while a delivery is armed or in flight (gates + the notification
 *  hold). */
export function isHandDeliveryActive(): boolean {
  return running || (pending !== undefined && !pending.fired);
}
// The delivery plays OVER the start ceremony (its proxies sit above every
// surface, landing in the always-on-top footer dock) — a blocking hold
// would be wrong (it must not withhold the prelude ceremony the player
// continues into). Like deck-draw: hold NOTIFICATIONS behind the beat only.
registerAnimationHoldSupplier('hand-delivery', isHandDeliveryActive, {scope: 'notification-only'});

/* ── choreography (base ms — motionMs scales; the whole beat ~1.1s) ─── */
const LIFT_MS = 200; // the bought stack lifts off the deck
const FAN_MS = 160; // it fans out before the descent
const ARC_MS = 620; // the long arc down into the dock
const HANDOFF_MS = 190;
/** Bounded fan-out window regardless of how many cards were bought. */
function stagger(n: number): number {
  return n <= 3 ? 120 : n <= 6 ? 90 : 64;
}

/**
 * ARM at the start-buy submit: withhold the bought cards from the dock the
 * instant they arrive (set BEFORE the commit, so no pre-payment flash). A
 * repeat arm (a re-submit) replaces the pending set.
 */
export function armStartingCardsDelivery(names: ReadonlyArray<CardName>): void {
  if (names.length === 0) {
    return;
  }
  pending = {names: [...names], fired: false};
  handDeliveryState.active = true;
  handDeliveryState.held = [...names];
  clearSafety();
  // A whole-scene backstop: the commit might never bring these names (an
  // error, a reconnect) — never withhold the dock forever.
  safety = setTimeout(() => resetHandDelivery(), 12_000);
}

function clearSafety(): void {
  if (safety !== undefined) {
    clearTimeout(safety);
    safety = undefined;
  }
}

function pileRect(deckEl: HTMLElement | null): DOMRect | undefined {
  const pile = deckEl?.querySelector<HTMLElement>('.con-deckstack__pile') ?? deckEl;
  const r = pile?.getBoundingClientRect();
  return r !== undefined && r.width > 4 && r.height > 4 ? r : undefined;
}

/**
 * FIRE the delivery when the bought cards are in the hand and the dock is on
 * screen. Called from the shell's playerView watcher (every commit) with the
 * live hand names + the dock/deck roots. No-op until every pending name is
 * present. Returns true once it has fired (or released) — the caller can stop
 * re-checking.
 */
export function maybeRunDelivery(handNames: ReadonlyArray<CardName>, dockEl: HTMLElement | null, deckEl: HTMLElement | null): boolean {
  if (pending === undefined || pending.fired) {
    return false;
  }
  const want = new Set(pending.names);
  const have = new Set(handNames);
  if (![...want].every((n) => have.has(n))) {
    return false; // the paid cards haven't landed in the hand yet
  }
  pending.fired = true;
  running = true;
  clearSafety();

  if (consoleReducedMotionActive() || dockEl === null) {
    finish();
    return true;
  }
  void fly(pending.names, dockEl, deckEl);
  return true;
}

/** Measure each held card's real dock rect (visible layout even while the
 *  card is hidden), fly a proxy deck → rect, release the hold per landing. */
async function fly(names: ReadonlyArray<CardName>, dockEl: HTMLElement, deckEl: HTMLElement | null): Promise<void> {
  handDeliveryState.flights = names.map((name) => ({id: nextDeliveryId(), name}));
  const ids = handDeliveryState.flights.map((f) => f.id);
  await nextTick();
  // Two frames so the dock has laid out the (hidden) cards we target.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined))));

  const deck = pileRect(deckEl);
  const targets = names.map((name) => {
    const card = dockEl.querySelector<HTMLElement>(`[data-hand-dock-card="${CSS.escape(name)}"]`);
    const r = card?.getBoundingClientRect();
    return r !== undefined && r.width > 4 ? r : undefined;
  });
  // Nothing believable to measure → release honestly (no stuck hold).
  if (targets.every((t) => t === undefined)) {
    finish();
    return;
  }
  // The departure point: the deck pile, else just above the dock centre.
  const anyTarget = targets.find((t): t is DOMRect => t !== undefined);
  if (anyTarget === undefined) {
    finish();
    return;
  }
  const src = deck ?? new DOMRect(anyTarget.left, anyTarget.top - 260 * conUiScale(), anyTarget.width, anyTarget.height);

  const s = (ms: number) => motionMs(ms) / 1000;
  const step = stagger(names.length);
  const scaleTo = anyTarget.width / CARD_NATURAL_W;
  const scaleFrom = src.width / CARD_NATURAL_W;
  const mid = (names.length - 1) / 2;
  let landed = 0;
  const total = names.filter((_, i) => targets[i] !== undefined).length;

  const budget = motionMs(LIFT_MS + FAN_MS + ARC_MS + step * names.length + HANDOFF_MS) + 1600;
  safety = setTimeout(() => {
    finish();
  }, budget);

  const land = (name: CardName) => {
    // Materialize: drop the hold so the real dock card fades in (its own
    // 160ms transition) under the proxy — which then fades out.
    handDeliveryState.held = handDeliveryState.held.filter((n) => n !== name);
    landed++;
    if (landed >= total) {
      finish();
    }
  };

  names.forEach((name, i) => {
    const el = deliveryEl(ids[i]);
    const target = targets[i];
    if (el === undefined || target === undefined) {
      // Unmeasurable card: release it immediately (never a stuck hold).
      handDeliveryState.held = handDeliveryState.held.filter((n) => n !== name);
      return;
    }
    // Depart clustered at the deck, a small physical fan offset per card.
    const fanX = (i - mid) * 5 * conUiScale();
    gsap.set(el, {
      width: CARD_NATURAL_W,
      height: src.height / scaleFrom,
      x: src.left,
      y: src.top,
      scale: scaleFrom,
      rotation: (i - mid) * -1.2,
      autoAlpha: 0,
      transformOrigin: 'top left',
    });
    const at = s(LIFT_MS) + s(step) * i;
    const tl = gsap.timeline();
    tl.set(el, {autoAlpha: 1}, 0);
    // Lift + fan off the deck.
    tl.to(el, {y: src.top - 22 * conUiScale(), x: src.left + fanX, scale: scaleFrom * 1.05, duration: s(LIFT_MS + FAN_MS), ease: 'power2.out'}, 0);
    // The long arc down — X eases across, Y is a soft power2 descent, scale
    // shrinks to the dock size, rotation settles to level.
    tl.to(el, {x: target.left, duration: s(ARC_MS), ease: 'power2.inOut'}, at);
    tl.to(el, {y: target.top, duration: s(ARC_MS), ease: 'power2.in'}, at);
    tl.to(el, {scale: scaleTo, duration: s(ARC_MS), ease: 'power2.inOut'}, at);
    tl.to(el, {rotation: 0, duration: s(ARC_MS) * 0.7, ease: 'power2.out'}, at);
    // Touchdown: release the hold, cross-fade the proxy out.
    tl.call(() => land(name), undefined, at + s(ARC_MS));
    tl.to(el, {autoAlpha: 0, duration: s(HANDOFF_MS), ease: 'power1.out'}, at + s(ARC_MS));
  });
}

/** End the delivery: release any residual hold, drop the proxies. */
function finish(): void {
  clearSafety();
  running = false;
  pending = undefined;
  handDeliveryState.active = false;
  handDeliveryState.held = [];
  clearDeliveryFlights();
}

/** A game switch / error / stall: reconcile so the dock never sticks empty. */
export function resetHandDelivery(): void {
  clearSafety();
  running = false;
  pending = undefined;
  handDeliveryState.active = false;
  handDeliveryState.held = [];
  handDeliveryState.flights.forEach((f) => {
    const el = deliveryEl(f.id);
    if (el !== undefined) {
      gsap.killTweensOf(el);
    }
  });
  clearDeliveryFlights();
}
