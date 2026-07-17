/*
 * HAND DELIVERY DIRECTOR — the starting-cards delivery cinematic: "I paid
 * for the project cards I bought at setup, and now they physically flew into
 * my hand."
 *
 * WHERE THE CARDS COME FROM (the correction). The bought project cards are
 * ALREADY in `cardsInHand` from the moment the wizard submits — the ceremony
 * PAYMENT (`corporationPay`) only deducts the M€, it never adds the cards.
 * So the delivery is NOT a "cards arrive in hand" data event and NOT a flight
 * from the top deck (they were never in the deck at payment time — the player
 * had already chosen them). It is a purely CLIENT beat, sequenced by hand:
 *
 *  1. HOLD. From the first ceremony frame the bought names are withheld from
 *     the dock (`handDeliveryState.held`, read by the dock: hidden-with-
 *     layout + excluded from the shown count) — so a card the player has not
 *     yet PAID for never shows in their hand. Meanwhile they are shown FACE
 *     UP in the payment element (ConsoleStartScene) so the player sees
 *     exactly WHICH cards they are buying.
 *  2. FLY. The instant the player confirms the payment, the SAME face-up
 *     cards lift off the payment grid, flip face → back (the hand is backs),
 *     arc down into the bottom-centre hand dock and settle one-by-one onto
 *     their real dock positions.
 *  3. MATERIALIZE. Each touchdown releases that card's hold — the real dock
 *     card fades in (its own 160ms transition) under the proxy's fade-out at
 *     an identical rect (the standard handoff), and the counter ticks 0 → N.
 *
 * ONE CARD — ONE VISIBLE REPRESENTATION. Held out of the dock, shown once in
 * the pay grid, then carried by the proxy the whole flight: a paid card is
 * never in two places.
 *
 * A slow, weighty, well-eased beat: a deliberate start-of-game moment, not a
 * UI refresh. Reduced motion / unmeasurable geometry → instant release (no
 * proxies), the project convention. A safety timeout force-releases a stalled
 * flight so the dock can never stick withheld.
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

/** The delivery lifecycle:
 *  - `idle`    — nothing to deliver.
 *  - `holding` — the bought cards are withheld from the dock (shown face-up
 *                in the payment element), waiting for the pay confirm.
 *  - `flying`  — the cinematic is running (proxies in flight).
 *  - `done`    — delivered for this deal; a re-render must NOT re-hold. */
type DeliveryPhase = 'idle' | 'holding' | 'flying' | 'done';

let phase: DeliveryPhase = 'idle';
/** The deal signature this delivery belongs to (consoleStartState.signature).
 *  A different deal (new game) resets the episode; the same deal is honoured
 *  once — a re-render can never re-hold after the flight. */
let deliveryKey = '';
let safety: ReturnType<typeof setTimeout> | undefined;

/** True only while the cinematic is ACTUALLY running — the notification hold.
 *  The `holding` phase (which can span the corp-play → pay steps) must NOT
 *  gate notifications; only the flight itself does. */
export function isHandDeliveryActive(): boolean {
  return phase === 'flying';
}
// The delivery plays OVER the start ceremony (its proxies sit above every
// surface, landing in the always-on-top footer dock) — a blocking hold would
// withhold the prelude ceremony the player continues into. Like deck-draw:
// hold NOTIFICATIONS behind the beat only.
registerAnimationHoldSupplier('hand-delivery', isHandDeliveryActive, {scope: 'notification-only'});

/* ── choreography (base ms — motionMs scales; a slow, well-eased beat) ─── */
const LIFT_MS = 260; // the face-up card gathers off the pay grid
const ARC_MS = 900; // the long, soft arc down into the dock
const FLIP_LEAD = 0.30; // the flip starts at 30% of the arc…
const FLIP_SPAN = 0.52; // …and turns over 52% of it (through the heart)
const HANDOFF_MS = 240; // the proxy fades as the dock card materializes
/** Bounded fan-out window regardless of how many cards were bought — a
 *  gentle cascade so the hand fills as a wave, not all at once. */
function stagger(n: number): number {
  return n <= 3 ? 170 : n <= 6 ? 125 : 88;
}

function clearSafety(): void {
  if (safety !== undefined) {
    clearTimeout(safety);
    safety = undefined;
  }
}

/**
 * ARM THE HOLD at the first ceremony frame (the wizard has submitted, the
 * bought cards are in hand). Withholds the bought names from the dock so they
 * never show before payment; the pay element shows them face-up meanwhile.
 * Idempotent per deal: a re-render re-affirms the SAME hold, but once the
 * flight has run (`flying`/`done`) it is never re-held.
 */
export function armDeliveryHold(key: string, names: ReadonlyArray<CardName>): void {
  if (names.length === 0) {
    return;
  }
  if (deliveryKey === key) {
    // Same deal: only (re)affirm the hold while still holding — never rewind
    // a flight that already ran (that would flash the cards back out).
    if (phase === 'holding') {
      handDeliveryState.held = [...names];
    }
    return;
  }
  // A NEW deal — reset the episode and begin holding.
  resetHandDelivery();
  deliveryKey = key;
  phase = 'holding';
  handDeliveryState.held = [...names];
}

/**
 * FIRE the delivery on the pay confirm. `sourceRects` are the face-up card
 * rects captured from the payment grid the instant the player pressed (the
 * grid unmounts as the payment resolves, so they are measured up front). The
 * dock is found live; targets are its real per-card slots (laid out even
 * while held-hidden). No-op unless we are holding this deal — so it can never
 * double-fire or fire without a hold.
 */
export function runHandDelivery(
  names: ReadonlyArray<CardName>,
  sourceRects: ReadonlyMap<CardName, DOMRect>,
): void {
  if (phase !== 'holding' || names.length === 0) {
    return;
  }
  phase = 'flying';
  clearSafety();

  const dock = document.querySelector<HTMLElement>('.con-handdock');
  if (consoleReducedMotionActive() || dock === null) {
    finish();
    return;
  }
  void fly(names, sourceRects, dock);
}

/** Spawn a face-up proxy per card at its pay-grid rect, fly it down into the
 *  card's real dock slot flipping to a back, release the hold per landing. */
async function fly(
  names: ReadonlyArray<CardName>,
  sourceRects: ReadonlyMap<CardName, DOMRect>,
  dock: HTMLElement,
): Promise<void> {
  handDeliveryState.flights = names.map((name) => ({id: nextDeliveryId(), name}));
  const ids = handDeliveryState.flights.map((f) => f.id);
  await nextTick();
  // Two frames so the dock has laid out the (hidden) cards we target and the
  // proxy elements have registered.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined))));

  const targets = names.map((name) => {
    const card = dock.querySelector<HTMLElement>(`[data-hand-dock-card="${CSS.escape(name)}"]`);
    const r = card?.getBoundingClientRect();
    return r !== undefined && r.width > 4 ? r : undefined;
  });
  // Nothing believable to measure → release honestly (never a stuck hold).
  if (targets.every((t) => t === undefined)) {
    finish();
    return;
  }

  const s = (ms: number) => motionMs(ms) / 1000;
  const step = stagger(names.length);
  const scale = conUiScale();
  const mid = (names.length - 1) / 2;
  let landed = 0;
  const total = names.filter((_, i) => targets[i] !== undefined).length;

  const budget = motionMs(LIFT_MS + ARC_MS + step * names.length + HANDOFF_MS) + 1800;
  safety = setTimeout(() => finish(), budget);

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
    // Depart EXACTLY where the face-up pay card sat (seamless lift-off); fall
    // back to just above the dock target if the grid rect is missing.
    const src = sourceRects.get(name) ??
      new DOMRect(target.left, target.top - 220 * scale, target.width, target.height);
    const scaleFrom = src.width / CARD_NATURAL_W;
    const scaleTo = target.width / CARD_NATURAL_W;
    const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');

    gsap.set(el, {
      width: CARD_NATURAL_W,
      height: src.height / scaleFrom,
      x: src.left,
      y: src.top,
      scale: scaleFrom,
      rotation: 0,
      autoAlpha: 0,
      transformOrigin: 'top left',
    });
    if (flip !== null) {
      gsap.set(flip, {rotationY: 0}); // face out — the card the player bought
    }

    const at = s(step) * i; // staggered departure — a gentle cascade
    const tl = gsap.timeline();
    tl.set(el, {autoAlpha: 1}, at);
    // GATHER: a small lift + slight grow off the pay grid (the card "peels").
    tl.to(el, {
      y: src.top - 26 * scale,
      scale: scaleFrom * 1.06,
      rotation: (i - mid) * -1.4,
      duration: s(LIFT_MS),
      ease: 'power2.out',
    }, at);
    // ARC: X eases across, Y is a soft accelerating descent, scale shrinks to
    // the dock size, rotation settles level — the different X/Y curves make a
    // natural falling arc, not a straight line.
    const arcAt = at + s(LIFT_MS);
    tl.to(el, {x: target.left, duration: s(ARC_MS), ease: 'power1.inOut'}, arcAt);
    tl.to(el, {y: target.top, duration: s(ARC_MS), ease: 'power2.in'}, arcAt);
    tl.to(el, {scale: scaleTo, duration: s(ARC_MS), ease: 'power2.inOut'}, arcAt);
    tl.to(el, {rotation: 0, duration: s(ARC_MS) * 0.8, ease: 'power2.out'}, arcAt);
    // FLIP face → back strictly around the edge, through the flight's heart,
    // so the card turns over as it descends (the hand is backs).
    if (flip !== null) {
      tl.to(flip, {
        rotationY: 180,
        duration: s(ARC_MS) * FLIP_SPAN,
        ease: 'power2.inOut',
      }, arcAt + s(ARC_MS) * FLIP_LEAD);
    }
    // TOUCHDOWN: release the hold, cross-fade the proxy out.
    tl.call(() => land(name), undefined, arcAt + s(ARC_MS));
    tl.to(el, {autoAlpha: 0, duration: s(HANDOFF_MS), ease: 'power1.out'}, arcAt + s(ARC_MS));
  });
}

/** End the delivery: release any residual hold, drop the proxies, mark done. */
function finish(): void {
  clearSafety();
  phase = 'done';
  handDeliveryState.held = [];
  clearDeliveryFlights();
}

/** A game switch / error / stall: reconcile so the dock never sticks empty. */
export function resetHandDelivery(): void {
  clearSafety();
  phase = 'idle';
  deliveryKey = '';
  handDeliveryState.held = [];
  handDeliveryState.flights.forEach((f) => {
    const el = deliveryEl(f.id);
    if (el !== undefined) {
      gsap.killTweensOf(el);
    }
  });
  clearDeliveryFlights();
}
