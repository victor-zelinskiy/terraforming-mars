/*
 * HAND INTAKE DIRECTOR — the ONE "cards physically arrive in the player's
 * hand" cinematic of the console shell. Every flow that puts project cards
 * into the hand ends HERE, with the same physical gesture: the face-up card
 * lifts off its surface, arcs down toward the bottom-centre hand dock,
 * flips face → back through the flight's heart (the hand is backs) and LAYS
 * DOWN onto its real slot in the pack — a soft decelerating placement with
 * a settle press, never a dive off-screen.
 *
 * Clients:
 *  - the STARTING-CARDS delivery (armDeliveryHold + runHandDelivery — the
 *    ceremony payment confirm flies the paid cards from the pay grid);
 *  - the reveal modal's takes («взять» = one cascade flight, «взять все» =
 *    the stack gesture: gather → flip → descend → peel into slots);
 *  - the SINGLE-CARD fullscreen take (consoleZoomMotion.playZoomDepart
 *    delegates the flight here — the inspected card itself flies into the
 *    hand);
 *  - the research/buy purchase confirm (ConsoleTaskHost) — the kept cards
 *    fly into the dock while the server processes the submit.
 *
 * ── THE THREE CONTRACTS ────────────────────────────────────────────────
 *
 * 1. THE COUNTER TICKS ONLY ON A PHYSICAL LANDING. `runHandIntake` fires
 *    `commit` (the host's submit / take state change) synchronously, then
 *    registers every name in `handDeliveryState.inFlight` in the SAME
 *    synchronous block — so the dock keeps the card hidden (with layout)
 *    and out of the shown count no matter when the server response lands.
 *    Each touchdown releases ONE copy: the real dock card materializes
 *    under the proxy (its own 260ms fade) and the «КАРТЫ» count ticks up.
 *    State is never delayed behind animation — only its PRESENTATION is.
 *
 * 2. DOCK ORDER IS THE LAW. Flights are sorted by the card's position in
 *    the hand pack (oldest → newest): a card lower in the pack departs and
 *    lands FIRST, each next card lands ON TOP of the one it covers in the
 *    final hand, and the proxies carry matching z — mid-flight overlap can
 *    never contradict the final stacking.
 *
 * 3. TARGETS ARE POLLED, NEVER ASSUMED. A delivered card may not be in
 *    `cardsInHand` yet (the research buy submits at lift — the response
 *    lands mid-flight). Each flight lifts off immediately and POLLS for its
 *    real dock slot (mounted held-hidden once the server response lands),
 *    arcing in the moment the slot's rect is stable. A card that never
 *    reaches the hand (or an unmeasurable dock) degrades to a quiet fade —
 *    the hold is released on every path, the dock can never stick withheld.
 *
 * Reduced motion → instant commit + release (no proxies), the project
 * convention. A safety timeout force-finishes a stalled run.
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
  deliveryEl, handDeliveryState, nextDeliveryId, clearDeliveryFlights,
  releaseInFlight, removeDeliveryFlights,
} from '@/client/console/handDock/handDeliveryState';

export type HandIntakeRect = {left: number, top: number, width: number, height: number};

export type HandIntakeEntry = {
  name: CardName,
  /** The LIVE source slot (reveal strip / buy strip): measured AND held
   *  hidden (`.con-deal-hold`) the frame its proxy stands over it. */
  el?: HTMLElement,
  /** A pre-measured departure rect for a source that unmounts on commit
   *  (the pay grid, the fullscreen stage). Ignored when `el` is given. */
  rect?: HandIntakeRect,
};

export type HandIntakeOptions = {
  /**
   * The host's state commit (submit / mark-taken / dismiss). Fired
   * synchronously BEFORE the in-flight hold registers — the two land in one
   * reactive flush, so the arriving card is never visible in the dock
   * between "committed" and "landed".
   */
  commit?: () => void,
  /**
   * 'cascade' (default) — every card flies its own staggered arc (dock
   * order). 'stack' — «взять все»: the fan gathers into one back-stack
   * above the dock, pulses, then peels bottom-first into the slots.
   */
  mode?: 'cascade' | 'stack',
  /**
   * Fires once every proxy is positioned + visible (before the first flight
   * frame). The fullscreen depart hides its stage + closes the dialog here
   * — the proxy takes over in the same paint. Guaranteed to fire once on
   * EVERY path (incl. reduced motion / degenerate).
   */
  onStaged?: () => void,
};

/* ── run bookkeeping ─────────────────────────────────────────────────── */

let activeRuns = 0;
/** Bumped by resetHandDelivery — in-progress runs abort at their next gate. */
let gen = 0;

/** True while ANY intake flight is running — the notification hold. */
export function isHandDeliveryActive(): boolean {
  return activeRuns > 0;
}
// The intake plays OVER whatever surface released the cards (its proxies
// land in the always-on-top footer dock) — a blocking hold would withhold
// surfaces the player continues into. Like deck-draw: hold NOTIFICATIONS
// behind the beat only.
registerAnimationHoldSupplier('hand-delivery', isHandDeliveryActive, {scope: 'notification-only'});

/* ── choreography (base ms — motionMs scales; a weighty, well-eased beat) ── */
const LIFT_MS = 240; // the card comes off its surface ("picked up")
const ARC_MS = 820; // the long soft carry down into the dock
const FLIP_LEAD = 0.26; // the flip starts at 26% of the arc…
const FLIP_SPAN = 0.5; // …and turns over half of it (through the heart)
const SETTLE_PRESS_MS = 90; // the touchdown presses into the pack…
const SETTLE_BACK_MS = 150; // …and eases back level
const FADE_MS = 200; // proxy fade over the materializing real card
const GATHER_MS = 340; // stack mode: the fan converges
const PEEL_MS = 420; // stack mode: one card slips into its slot
const PEEL_STEP_MS = 60; // stack mode: bottom-first landing cascade
/** The target-slot poll budget (frames ≈ 1.8s): covers the research buy's
 *  server round-trip + the pack's own 340ms re-spread transition. */
const POLL_FRAMES = 110;

/** Bounded cascade window regardless of how many cards arrive. */
function stagger(n: number): number {
  return n <= 3 ? 160 : n <= 6 ? 115 : 82;
}

const HOLD_CLASS = 'con-deal-hold';

function esc(name: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
}

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function tween(el: HTMLElement, vars: gsap.TweenVars): Promise<void> {
  return new Promise((done) => gsap.to(el, {...vars, onComplete: done}));
}

function awaitTimeline(tl: gsap.core.Timeline): Promise<void> {
  return new Promise((r) => tl.eventCallback('onComplete', () => r(undefined)).play());
}

function usable(r: {width: number} | undefined): r is DOMRect {
  return r !== undefined && r.width > 4;
}

/**
 * Claim the dock element for one arriving copy of `name` — the LAST
 * unclaimed match in DOM order. Incoming copies are the hand's newest, so
 * end-claiming never steals the slot of a copy the player already held
 * visible. (Two copies arriving in one run pair up end-first between
 * themselves — adjacent same-name slots, visually indistinguishable.)
 */
function claimTargetEl(dock: HTMLElement, name: CardName, claimed: Set<HTMLElement>): HTMLElement | undefined {
  const els = dock.querySelectorAll<HTMLElement>(`[data-hand-dock-card="${esc(name)}"]`);
  for (let i = els.length - 1; i >= 0; i--) {
    if (!claimed.has(els[i])) {
      claimed.add(els[i]);
      return els[i];
    }
  }
  return undefined;
}

/**
 * Poll for the entry's REAL dock slot until its rect is STABLE (two equal
 * consecutive frames — outwaits the pack's re-spread transition and the
 * research buy's response). Resolves undefined when the card never reaches
 * the hand within the budget (the caller degrades gracefully).
 */
function stableTargetRect(dock: HTMLElement, name: CardName, claimed: Set<HTMLElement>, isAborted: () => boolean): Promise<DOMRect | undefined> {
  return new Promise((done) => {
    let tries = 0;
    let lastSig = '';
    let el: HTMLElement | undefined;
    const poll = () => {
      tries++;
      if (isAborted()) {
        done(undefined);
        return;
      }
      if (el === undefined || !el.isConnected) {
        if (el !== undefined) {
          claimed.delete(el);
        }
        el = claimTargetEl(dock, name, claimed);
      }
      const r = el?.getBoundingClientRect();
      const ok = usable(r);
      const sig = ok ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}` : '';
      if (ok && sig === lastSig) {
        done(r);
        return;
      }
      lastSig = sig;
      if (tries < POLL_FRAMES) {
        requestAnimationFrame(poll);
      } else {
        if (el !== undefined) {
          claimed.delete(el);
        }
        done(undefined);
      }
    };
    requestAnimationFrame(poll);
  });
}

/**
 * Sort key per entry = the card's DOCK position (its index among the dock's
 * `[data-hand-dock-card]` anchors, claimed end-first per name; a card not in
 * the hand yet keys to the append order after the current tail). Flights run
 * bottom-first in this order and carry matching z — contract 2.
 */
function dockOrderKeys(dock: HTMLElement, entries: ReadonlyArray<HandIntakeEntry>): Array<number> {
  const anchors = Array.from(dock.querySelectorAll<HTMLElement>('[data-hand-dock-card]'));
  const byName = new Map<string, Array<number>>();
  anchors.forEach((el, i) => {
    const n = el.getAttribute('data-hand-dock-card') ?? '';
    const list = byName.get(n) ?? [];
    list.push(i);
    byName.set(n, list);
  });
  let appendSeq = 0;
  return entries.map((e) => {
    const list = byName.get(e.name);
    if (list !== undefined && list.length > 0) {
      return list.pop() as number; // end-claim (the newest copy)
    }
    return anchors.length + appendSeq++;
  });
}

/* ── the generic engine ──────────────────────────────────────────────── */

/**
 * Fly `entries` into the hand dock. Fires `commit` + registers the
 * in-flight hold synchronously (see contract 1), then runs the cinematic;
 * resolves when every card has landed (or degraded). Safe to call from any
 * surface — proxies live on the app-level delivery layer and survive the
 * caller unmounting.
 */
export async function runHandIntake(entries: ReadonlyArray<HandIntakeEntry>, opts?: HandIntakeOptions): Promise<void> {
  const names = entries.map((e) => e.name);
  if (names.length === 0) {
    opts?.commit?.();
    opts?.onStaged?.();
    return;
  }
  // Measure every DEPARTURE rect NOW, before the commit — the commit may
  // swap/unmount the source surface (the research buy's submit closes the
  // strip) long before the proxies spawn (~3 frames later). A source still
  // alive at spawn time is re-measured fresh; this snapshot is the fallback
  // that keeps the card visibly lifting OFF ITS SLOT, never teleporting.
  const snapshots = entries.map((e) => {
    if (e.el !== undefined && e.el.isConnected) {
      const card = e.el.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? e.el;
      const r = card.getBoundingClientRect();
      if (usable(r)) {
        return {left: r.left, top: r.top, width: r.width, height: r.height};
      }
    }
    return e.rect !== undefined && e.rect.width > 4 ? e.rect : undefined;
  });
  // Contract 1: commit first, hold in the SAME synchronous block.
  opts?.commit?.();
  handDeliveryState.inFlight = [...handDeliveryState.inFlight, ...names];
  const myGen = gen;
  const landed = entries.map(() => false);
  const land = (i: number) => {
    if (!landed[i]) {
      landed[i] = true;
      releaseInFlight(names[i]);
    }
  };
  const releaseRemaining = () => entries.forEach((_e, i) => land(i));

  const dock = document.querySelector<HTMLElement>('.con-handdock');
  if (consoleReducedMotionActive() || dock === null) {
    releaseRemaining();
    opts?.onStaged?.();
    return;
  }

  activeRuns++;
  try {
    await fly(entries, snapshots, opts, dock, {myGen, land, releaseRemaining});
  } finally {
    releaseRemaining();
    activeRuns--;
  }
}

type RunCtx = {
  myGen: number,
  land: (i: number) => void,
  releaseRemaining: () => void,
};

async function fly(entries: ReadonlyArray<HandIntakeEntry>, snapshots: ReadonlyArray<HandIntakeRect | undefined>, opts: HandIntakeOptions | undefined, dock: HTMLElement, ctx: RunCtx): Promise<void> {
  // A single card has no fan to gather — the stack gesture degrades to the
  // plain cascade arc.
  const mode = opts?.mode === 'stack' && entries.length > 1 ? 'stack' : 'cascade';
  const ui = conUiScale();

  // Contract 2: dock order — bottom-first departure/landing, matching z.
  const keys = dockOrderKeys(dock, entries);
  const order = entries.map((_e, i) => i).sort((a, b) => keys[a] - keys[b]);

  // Spawn one proxy per entry, z = dock rank inside the layer.
  const flightIds = new Map<number, number>(); // entry idx → flight id
  handDeliveryState.flights = [
    ...handDeliveryState.flights,
    ...order.map((entryIdx, rank) => {
      const id = nextDeliveryId();
      flightIds.set(entryIdx, id);
      return {id, name: entries[entryIdx].name, z: 10 + rank};
    }),
  ];
  const myIds = [...flightIds.values()];
  let safety: ReturnType<typeof setTimeout> | undefined;
  let aborted = false;
  const isAborted = () => aborted || gen !== ctx.myGen;
  const finish = () => {
    aborted = true;
    if (safety !== undefined) {
      clearTimeout(safety);
      safety = undefined;
    }
    ctx.releaseRemaining();
    myIds.forEach((id) => {
      const el = deliveryEl(id);
      if (el !== undefined) {
        gsap.killTweensOf(el);
      }
    });
    removeDeliveryFlights(myIds);
  };

  await nextTick();
  // Two frames so the (held) dock cards have laid out and the proxy
  // elements have registered.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined))));
  if (isAborted()) {
    finish();
    return;
  }

  // Position + reveal every proxy over its source in ONE synchronous block;
  // live sources are held hidden in the same frame (no double-vision), then
  // the stage callback lets the host drop its own surface under the proxies.
  // The dock rect anchors the stack point / bank direction — a dock that is
  // somehow unmeasurable (it should never be: a covering overlay only
  // CONCEALS it, layout kept) falls back to the bottom-centre hand zone so
  // a flight can never aim at the (0,0) corner.
  const rawDockR = dock.getBoundingClientRect();
  const dockR = rawDockR.width > 8 ? rawDockR :
    new DOMRect(window.innerWidth / 2 - 160 * ui, window.innerHeight - 110 * ui, 320 * ui, 80 * ui);
  type Live = {entryIdx: number, rank: number, name: CardName, el: HTMLElement, src?: HandIntakeRect};
  const live: Array<Live> = [];
  order.forEach((entryIdx, rank) => {
    const entry = entries[entryIdx];
    const el = deliveryEl(flightIds.get(entryIdx) as number);
    if (el === undefined) {
      ctx.land(entryIdx);
      return;
    }
    // Prefer a FRESH measure of a still-mounted source (pixel-perfect over
    // the live slot); fall back to the pre-commit snapshot when the commit
    // already unmounted the surface (the card still lifts off the spot the
    // player saw it at — never a teleport into the stack).
    let src: HandIntakeRect | undefined;
    if (entry.el !== undefined && entry.el.isConnected) {
      const card = entry.el.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? entry.el;
      const r = card.getBoundingClientRect();
      if (usable(r)) {
        src = r;
        card.classList.add(HOLD_CLASS);
      }
    }
    if (src === undefined) {
      src = snapshots[entryIdx];
    }
    if (src !== undefined) {
      const scaleFrom = src.width / CARD_NATURAL_W;
      gsap.set(el, {
        width: CARD_NATURAL_W,
        height: src.height / scaleFrom,
        x: src.left,
        y: src.top,
        scale: scaleFrom,
        rotation: 0,
        autoAlpha: 1,
        transformOrigin: 'top left',
      });
      const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
      if (flip !== null) {
        gsap.set(flip, {rotationY: 0}); // face out — the card being taken
      }
    }
    live.push({entryIdx, rank, name: entry.name, el, src});
  });
  opts?.onStaged?.();
  if (live.length === 0) {
    finish();
    return;
  }

  const n = live.length;
  const step = stagger(n);
  const pollBudget = (POLL_FRAMES / 60) * 1000;
  const budget = mode === 'stack' ?
    motionMs(GATHER_MS + 45 * n + 200 + PEEL_STEP_MS * n + PEEL_MS + SETTLE_PRESS_MS + SETTLE_BACK_MS + FADE_MS) + pollBudget + 2000 :
    motionMs(LIFT_MS + ARC_MS + step * n + SETTLE_PRESS_MS + SETTLE_BACK_MS + FADE_MS) + pollBudget + 2000;
  safety = setTimeout(finish, budget);

  const claimed = new Set<HTMLElement>();
  const touchdown = async (f: Live, rect: DOMRect, scaleTo: number) => {
    // Materialize the real dock card under the proxy (contract 1) and press
    // the proxy INTO the pack — the settle beat — fading it out on top.
    ctx.land(f.entryIdx);
    const tl = gsap.timeline();
    tl.to(f.el, {y: rect.top + 2.5 * ui, scale: scaleTo * 1.035, duration: s(SETTLE_PRESS_MS), ease: 'power1.out'}, 0);
    tl.to(f.el, {y: rect.top, scale: scaleTo, duration: s(SETTLE_BACK_MS), ease: 'power2.out'}, s(SETTLE_PRESS_MS));
    tl.to(f.el, {autoAlpha: 0, duration: s(FADE_MS), ease: 'power1.out'}, s(70));
    await awaitTimeline(tl);
  };
  const quietOut = async (f: Live) => {
    // No believable slot (the card never reached the hand / unmeasurable):
    // release honestly + a quiet dip-fade — never a stuck hold or proxy.
    ctx.land(f.entryIdx);
    await tween(f.el, {y: `+=${30 * ui}`, scale: '*=0.9', autoAlpha: 0, duration: s(240), ease: 'power2.in'});
  };

  if (mode === 'stack') {
    await flyStack(live, dock, dockR, {ui, claimed, isAborted, touchdown, quietOut, ctx});
  } else {
    await flyCascade(live, dock, dockR, {ui, step, claimed, isAborted, touchdown, quietOut, ctx});
  }
  finish();
}

type LiveFlight = {entryIdx: number, rank: number, name: CardName, el: HTMLElement, src?: HandIntakeRect};

type FlightTools = {
  ui: number,
  step?: number,
  claimed: Set<HTMLElement>,
  isAborted: () => boolean,
  touchdown: (f: LiveFlight, rect: DOMRect, scaleTo: number) => Promise<void>,
  quietOut: (f: LiveFlight) => Promise<void>,
  ctx: RunCtx,
};

/**
 * CASCADE — every card flies its own arc, bottom-first with a gentle
 * stagger: lift off the surface, a soft carried descent (lateral ease + a
 * decelerating drop — the card is PLACED, never dropped), the face→back
 * flip through the heart, the settle press.
 */
async function flyCascade(live: Array<LiveFlight>, dock: HTMLElement, dockR: DOMRect, t: FlightTools): Promise<void> {
  const step = t.step ?? 100;
  const dockCx = dockR.left + dockR.width / 2;
  await Promise.all(live.map(async (f) => {
    if (f.rank > 0) {
      await delay(motionMs(step) * f.rank);
    }
    if (t.isAborted()) {
      return;
    }
    // LIFT: the card comes off the table, banking toward its flight; the
    // target resolves while it hovers (usually instantly — the research
    // buy's server response lands mid-hover). The lift is AWAITED before
    // the arc: two live tweens on one property fight and read as jitter.
    const lift = f.src !== undefined ?
      tween(f.el, {
        y: f.src.top - 24 * t.ui,
        scale: '*=1.05',
        rotation: (f.src.left + f.src.width / 2) < dockCx ? 2.4 : -2.4,
        duration: s(LIFT_MS),
        ease: 'power2.out',
      }) : Promise.resolve();
    const [rect] = await Promise.all([
      stableTargetRect(dock, f.name, t.claimed, t.isAborted),
      lift,
    ]);
    if (t.isAborted()) {
      return;
    }
    if (rect === undefined) {
      await t.quietOut(f);
      return;
    }
    if (f.src === undefined) {
      // A source that could not be measured: fabricate a departure just
      // above the slot so the card still visibly ARRIVES, never pops.
      const scaleTo = rect.width / CARD_NATURAL_W;
      gsap.set(f.el, {
        width: CARD_NATURAL_W,
        height: rect.height / scaleTo,
        x: rect.left,
        y: rect.top - 220 * t.ui,
        scale: scaleTo,
        rotation: 0,
        autoAlpha: 1,
        transformOrigin: 'top left',
      });
      const flipEl = f.el.querySelector<HTMLElement>('.con-deal-proxy__flip');
      if (flipEl !== null) {
        gsap.set(flipEl, {rotationY: 0});
      }
    }
    const scaleTo = rect.width / CARD_NATURAL_W;
    const flight = s(ARC_MS);
    const tl = gsap.timeline();
    // The carry: X leads laterally, Y is a decelerating descent (inOut — a
    // card LAID into the hand, not dropped), scale eases to the pack size.
    tl.to(f.el, {x: rect.left, duration: flight, ease: 'power1.inOut'}, 0);
    tl.to(f.el, {y: rect.top, duration: flight, ease: 'power2.inOut'}, 0);
    tl.to(f.el, {scale: scaleTo, duration: flight, ease: 'power2.inOut'}, 0);
    tl.to(f.el, {rotation: 0, duration: flight * 0.62, ease: 'power2.out'}, flight * 0.3);
    const flipEl = f.el.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flipEl !== null) {
      tl.to(flipEl, {
        rotationY: 180,
        duration: flight * FLIP_SPAN,
        ease: 'power2.inOut',
      }, flight * FLIP_LEAD);
    }
    await awaitTimeline(tl);
    if (t.isAborted()) {
      return;
    }
    await t.touchdown(f, rect, scaleTo);
  }));
}

/**
 * STACK — «взять все»: the whole fan GATHERS into one neat stack above the
 * dock (flipping to backs on the way — "I picked them all up"), one
 * confirmation pulse, then the cards PEEL off the stack bottom-first, each
 * slipping into its own slot as the counter ticks up.
 */
async function flyStack(live: Array<LiveFlight>, dock: HTMLElement, dockR: DOMRect, t: FlightTools): Promise<void> {
  const n = live.length;
  const sample = dock.querySelector<HTMLElement>('[data-hand-dock-card]');
  const sampleW = sample !== null ? sample.getBoundingClientRect().width : 0;
  const targetScale = (sampleW > 4 ? sampleW : 63 * t.ui) / CARD_NATURAL_W;
  const stackScale = targetScale * 1.9;
  const stackW = CARD_NATURAL_W * stackScale;
  const stackX = dockR.left + dockR.width / 2 - stackW / 2;
  const stackY = dockR.top - 235 * t.ui;

  // GATHER: converge into the stack (dock-order micro offsets keep it
  // physical), flipping each card to its back on the way in.
  const gather = gsap.timeline();
  live.forEach((f, k) => {
    if (f.src === undefined) {
      // No visible departure — start the card inside the forming stack.
      gsap.set(f.el, {
        width: CARD_NATURAL_W,
        height: CARD_NATURAL_W * 1.44,
        x: stackX,
        y: stackY - 40 * t.ui,
        scale: stackScale,
        rotation: 0,
        autoAlpha: 1,
        transformOrigin: 'top left',
      });
    }
    const centered = k - (n - 1) / 2;
    const at = k * s(45);
    gather.to(f.el, {
      x: stackX + centered * 3 * t.ui,
      y: stackY + centered * 2.2 * t.ui,
      rotation: centered * 2.1,
      scale: stackScale,
      duration: s(GATHER_MS),
      ease: 'power2.inOut',
    }, at);
    const flipEl = f.el.querySelector<HTMLElement>('.con-deal-proxy__flip');
    if (flipEl !== null) {
      gather.to(flipEl, {rotationY: 180, duration: s(300), ease: 'power2.inOut'}, at + s(50));
    }
  });
  await awaitTimeline(gather);
  if (t.isAborted()) {
    return;
  }

  // The confirmation pulse — the stack acknowledges the take.
  const els = live.map((f) => f.el);
  await new Promise((r) => gsap.to(els, {
    scale: stackScale * 1.05,
    duration: s(80),
    yoyo: true,
    repeat: 1,
    ease: 'power1.inOut',
    onComplete: () => r(undefined),
  }));
  if (t.isAborted()) {
    return;
  }

  // PEEL: bottom-first, each card slips off the stack into its own slot —
  // the counter ticks with every landing.
  await Promise.all(live.map(async (f, k) => {
    if (k > 0) {
      await delay(motionMs(PEEL_STEP_MS) * k);
    }
    if (t.isAborted()) {
      return;
    }
    const rect = await stableTargetRect(dock, f.name, t.claimed, t.isAborted);
    if (t.isAborted()) {
      return;
    }
    if (rect === undefined) {
      await t.quietOut(f);
      return;
    }
    const scaleTo = rect.width / CARD_NATURAL_W;
    const tl = gsap.timeline();
    tl.to(f.el, {x: rect.left, duration: s(PEEL_MS), ease: 'power1.inOut'}, 0);
    tl.to(f.el, {y: rect.top, duration: s(PEEL_MS), ease: 'power2.inOut'}, 0);
    tl.to(f.el, {scale: scaleTo, duration: s(PEEL_MS), ease: 'power2.inOut'}, 0);
    tl.to(f.el, {rotation: 0, duration: s(PEEL_MS) * 0.7, ease: 'power2.out'}, 0);
    await awaitTimeline(tl);
    if (t.isAborted()) {
      return;
    }
    await t.touchdown(f, rect, scaleTo);
  }));
}

/* ── the STARTING-CARDS delivery episode (the original client) ────────── */

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
 * grid unmounts as the payment resolves, so they are measured up front).
 * The episodic hold hands over to the flight ledger in the same synchronous
 * block (`held` → `inFlight` — the dock union makes it seamless). No-op
 * unless we are holding this deal — it can never double-fire.
 */
export function runHandDelivery(
  names: ReadonlyArray<CardName>,
  sourceRects: ReadonlyMap<CardName, DOMRect>,
): void {
  if (phase !== 'holding' || names.length === 0) {
    return;
  }
  phase = 'flying';
  const drop = new Set(names);
  handDeliveryState.held = handDeliveryState.held.filter((n) => !drop.has(n));
  const entries = names.map((name) => ({name, rect: sourceRects.get(name)}));
  void runHandIntake(entries, {mode: 'cascade'}).then(() => {
    if (phase === 'flying') {
      phase = 'done';
    }
  });
}

/** A game switch / error / stall: reconcile so the dock never sticks empty. */
export function resetHandDelivery(): void {
  gen++;
  phase = 'idle';
  deliveryKey = '';
  handDeliveryState.held = [];
  handDeliveryState.inFlight = [];
  handDeliveryState.flights.forEach((f) => {
    const el = deliveryEl(f.id);
    if (el !== undefined) {
      gsap.killTweensOf(el);
    }
  });
  clearDeliveryFlights();
}
