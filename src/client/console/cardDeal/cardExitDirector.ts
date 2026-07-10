/*
 * CARD EXIT DIRECTOR — the "cards leave the table" half of the console card
 * motion language (the outbound twin of cardDealDirector). One GSAP module
 * drives every exit/transfer cinematic over the app-level exit layer
 * (ConsoleCardExitLayer, mounted in ConsoleShell):
 *
 *  runCardTake      — the player takes ONE card: a small lift/tilt beat,
 *                     then a confident dive toward the player zone (bottom
 *                     centre — the same table geography the dealer's deck
 *                     uses), fading on the last third.
 *  runCardCollect   — «взять все» / the researching purchase: a staged
 *                     GATHER (the fan collapses into a neat stack at a
 *                     collection point, per-card rotation converging),
 *                     one confirmation pulse of the whole stack, then the
 *                     stack drops to the player as ONE object.
 *  runHeroPick      — the draft choice: the chosen card gets the HERO beat
 *                     (lift + rim accent) and departs with dignity, while
 *                     the rejected cards leave via the cheap CSS discard
 *                     (applyDiscardExit) — subdued, never competing.
 *  runCardTransfer  — hand → play-modal (and back on cancel): a FaceLite
 *                     proxy flies slot→slot with the deal-style handoff
 *                     (target held empty, revealed under the proxy, cross-
 *                     fade) — the same language as the fullscreen handoff.
 *  runCardDepart    — the play-confirm SUCCESS finale: the card lifts off
 *                     the modal toward the board ("played onto the table").
 *
 * Lifecycle contract (every entry point):
 *  - the host calls with LIVE source elements; the director spawns proxies,
 *    positions them, and ONLY THEN fires `onLift()` — the host updates the
 *    game/UI state inside it, so the real card disappears in the SAME frame
 *    its proxy stands ready (no blink, no double-vision);
 *  - state is never delayed behind animation (submits happen at onLift);
 *  - reduced motion: no proxies at all — onLift fires immediately and the
 *    promise resolves (the host's own short CSS fades carry the change);
 *  - zombie-safe: proxies are killed + unregistered in a finally-style
 *    cleanup with a safety timeout; the layer itself never unmounts while
 *    the shell lives.
 *
 * All durations resolve through motionMs; transform/opacity only; the layer
 * is clipped — off-screen dives can never create scrollable overflow.
 */

import {nextTick} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {cardExitState, flightEl, nextFlightId, removeFlights} from '@/client/console/cardDeal/cardExitState';

export type ExitSource = {
  name: CardName,
  /** The live slot element (the inner `.card-container` is preferred). */
  el: HTMLElement,
};

const HOLD_CLASS = 'con-deal-hold'; // the shared "slot is empty" cascade rule

function cardRect(el: HTMLElement): DOMRect {
  const card = el.querySelector<HTMLElement>('.card-container') ?? el;
  return card.getBoundingClientRect();
}

function usable(r: DOMRect): boolean {
  return r.width > 10 && r.height > 10;
}

type Spawned = {id: number, el: HTMLElement, rect: DOMRect};

/**
 * Spawn proxies for the given sources, position each exactly over its
 * source rect, and return the live elements. Sources with degenerate rects
 * are skipped (their state change simply happens without a flight).
 */
async function spawnProxies(sources: ReadonlyArray<ExitSource>, hero: boolean): Promise<Array<Spawned>> {
  const entries = sources
    .map((s) => ({id: nextFlightId(), name: s.name, rect: cardRect(s.el)}))
    .filter((e) => usable(e.rect));
  if (entries.length === 0) {
    return [];
  }
  cardExitState.flights = [...cardExitState.flights, ...entries.map((e) => ({id: e.id, name: e.name, hero}))];
  await nextTick();
  const out: Array<Spawned> = [];
  for (const e of entries) {
    const el = flightEl(e.id);
    if (el === undefined) {
      continue;
    }
    const scale = e.rect.width / CARD_NATURAL_W;
    gsap.set(el, {
      width: CARD_NATURAL_W,
      height: e.rect.height / scale,
      x: e.rect.left,
      y: e.rect.top,
      scale,
      rotation: 0,
      autoAlpha: 1,
      transformOrigin: 'top left',
    });
    out.push({id: e.id, el, rect: e.rect});
  }
  return out;
}

/** Kill + unregister a finished (or abandoned) flight set. */
function cleanup(spawned: ReadonlyArray<Spawned>): void {
  spawned.forEach((s) => gsap.killTweensOf(s.el));
  removeFlights(spawned.map((s) => s.id));
}

/** The player zone the cards dive toward (bottom centre, off-screen). */
function playerPoint(): {x: number, y: number} {
  return {x: window.innerWidth / 2, y: window.innerHeight + 80};
}

/** The gather point for group collects (centre, above the command bar). */
function gatherPoint(): {x: number, y: number} {
  return {x: window.innerWidth / 2, y: window.innerHeight * 0.6};
}

function guarded(run: (done: () => void) => void, budgetMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    setTimeout(done, budgetMs + 1200); // rAF-stall safety
    run(done);
  });
}

/**
 * TAKE ONE — lift/tilt beat, then the dive to the player zone. `onLift`
 * fires the moment the proxy stands over the real card (the host updates
 * state there — same-frame swap, no blink).
 */
export async function runCardTake(source: ExitSource, onLift: () => void): Promise<void> {
  if (consoleReducedMotionActive()) {
    onLift();
    return;
  }
  const spawned = await spawnProxies([source], false);
  onLift();
  if (spawned.length === 0) {
    return;
  }
  const s = spawned[0];
  const p = playerPoint();
  const drift = (p.x - s.rect.left) * 0.18;
  await guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    // The pick-up beat: the card comes off the table.
    tl.to(s.el, {y: s.rect.top - 16, rotation: -2.2, scale: `*=1.04`, duration: motionMs(120) / 1000, ease: 'power2.out'});
    // The dive home.
    tl.to(s.el, {x: s.rect.left + drift, y: p.y, rotation: -7, scale: `*=0.55`, duration: motionMs(380) / 1000, ease: 'power2.in'}, '>-0.02');
    tl.to(s.el, {autoAlpha: 0, duration: motionMs(150) / 1000, ease: 'power1.in'}, '<55%');
  }, motionMs(700));
  cleanup(spawned);
}

/**
 * COLLECT — the group gesture («взять все» / the purchase confirm): the fan
 * COLLAPSES into a neat stack at the gather point (rotations converge, a
 * tiny per-card offset keeps the stack physical), ONE confirmation pulse,
 * then the whole stack drops to the player as a single object. One
 * timeline, N light tweens — never N independent choreographies.
 * A single card degrades to the take gesture.
 */
export async function runCardCollect(sources: ReadonlyArray<ExitSource>, onLift: () => void): Promise<void> {
  if (sources.length === 1) {
    return runCardTake(sources[0], onLift);
  }
  if (consoleReducedMotionActive() || sources.length === 0) {
    onLift();
    return;
  }
  const spawned = await spawnProxies(sources, false);
  onLift();
  if (spawned.length === 0) {
    return;
  }
  const g = gatherPoint();
  const n = spawned.length;
  const stackScale = 0.6;
  const stackW = CARD_NATURAL_W * stackScale;
  await guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    const gather = motionMs(300) / 1000;
    const stagger = motionMs(45) / 1000;
    spawned.forEach((s, i) => {
      const centered = i - (n - 1) / 2;
      tl.to(s.el, {
        x: g.x - stackW / 2 + centered * 3,
        y: g.y - (s.rect.height / s.rect.width) * stackW / 2 + centered * 2,
        rotation: centered * 2.6,
        scale: stackScale,
        duration: gather,
        ease: 'power2.inOut',
      }, i * stagger);
    });
    const gathered = (n - 1) * stagger + gather;
    // The confirmation pulse — the stack acknowledges the collect.
    tl.to(spawned.map((s) => s.el), {scale: stackScale * 1.06, duration: motionMs(80) / 1000, yoyo: true, repeat: 1, ease: 'power1.inOut'}, gathered + 0.02);
    // The stack goes home as ONE object.
    tl.to(spawned.map((s) => s.el), {y: '+=420', rotation: '-=3', scale: stackScale * 0.8, duration: motionMs(280) / 1000, ease: 'power2.in'}, gathered + motionMs(210) / 1000);
    tl.to(spawned.map((s) => s.el), {autoAlpha: 0, duration: motionMs(140) / 1000, ease: 'power1.in'}, '<45%');
  }, motionMs(300 + 45 * n + 600));
  cleanup(spawned);
}

/**
 * HERO PICK — the draft choice: the chosen card lifts with the hero rim,
 * holds a readable beat, then departs to the player. The REJECTED cards
 * are the host's cheap CSS discard (applyDiscardExit) — subdued by design.
 */
export async function runHeroPick(source: ExitSource, onLift: () => void): Promise<void> {
  if (consoleReducedMotionActive()) {
    onLift();
    return;
  }
  const spawned = await spawnProxies([source], true);
  onLift();
  if (spawned.length === 0) {
    return;
  }
  const s = spawned[0];
  const p = playerPoint();
  await guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    // The hero beat: up, slightly larger, rim glowing — "this one".
    tl.to(s.el, {y: s.rect.top - 22, scale: `*=1.07`, rotation: -1.4, duration: motionMs(150) / 1000, ease: 'power2.out'});
    tl.to(s.el, {duration: motionMs(110) / 1000}); // the readable hold
    // The departure to the player.
    tl.to(s.el, {x: s.rect.left + (p.x - s.rect.left) * 0.22, y: p.y, rotation: -6, scale: `*=0.6`, duration: motionMs(360) / 1000, ease: 'power2.in'});
    tl.to(s.el, {autoAlpha: 0, duration: motionMs(150) / 1000, ease: 'power1.in'}, '<55%');
  }, motionMs(800));
  cleanup(spawned);
}

/**
 * The subdued DISCARD of non-chosen cards — a cheap CSS animation on the
 * REAL slots (class + per-slot delay), never proxies: they drift toward
 * the discard side and fade, clearly secondary to the hero/collect. The
 * `forwards` fill keeps them hidden until the frame swap replaces them.
 */
export function applyDiscardExit(els: ReadonlyArray<HTMLElement>, opts?: {stepMs?: number, delayMs?: number}): void {
  if (consoleReducedMotionActive()) {
    els.forEach((el) => el.classList.add(HOLD_CLASS));
    return;
  }
  const step = opts?.stepMs ?? 24;
  // `delayMs` sequences the read: the HERO beat lands first, THEN the
  // rejected cards start tumbling — the eye follows one thing at a time.
  const base = opts?.delayMs ?? 0;
  els.forEach((el, i) => {
    el.style.animationDelay = `${motionMs(base + i * step)}ms`;
    el.classList.add('con-exit-reject');
  });
}

export type TransferArgs = {
  name: CardName,
  /** Where the card starts (live slot element). */
  from: HTMLElement,
  /** Resolve the landing slot (polled until mounted + stable). */
  resolveTo: () => HTMLElement | null,
  /** Hold/release the DESTINATION slot while the proxy is in flight. */
  holdTarget?: boolean,
  /**
   * Hold the SOURCE slot for the flight's duration (released at the end):
   * the card visibly LEAVES the table while its proxy travels — no
   * double-vision — and honestly reappears afterwards (e.g. the hand card
   * behind the composer backdrop: playing isn't committed yet).
   */
  holdFrom?: boolean,
  /** Fires once the proxy stands over the source (host updates state). */
  onLift?: () => void,
  /**
   * Fires the frame the proxy TOUCHES DOWN (right before its cross-fade)
   * — hosts that keep the destination hidden via their OWN reactive state
   * (Vue-managed holds are patch-proof, classList isn't) reveal it here so
   * the card materializes exactly under the proxy. Guaranteed to fire once
   * on EVERY path (landing, dive fallback, safety timeout).
   */
  onTouchdown?: () => void,
};

/**
 * TRANSFER — slot → slot (hand → play-modal card slot, and the reverse on
 * cancel). The deal-style handoff: the destination is HELD empty while the
 * proxy flies, revealed UNDER the proxy on touchdown, then the proxy
 * cross-fades out — one continuous materialization, the same language as
 * the fullscreen → modal handoff. An unresolvable/unstable destination
 * degrades to the dive-away exit (never a stuck proxy, never a fake slot).
 */
export async function runCardTransfer(args: TransferArgs): Promise<void> {
  if (consoleReducedMotionActive()) {
    args.onLift?.();
    args.onTouchdown?.();
    return;
  }
  const spawned = await spawnProxies([{name: args.name, el: args.from}], false);
  args.onLift?.();
  if (spawned.length === 0) {
    return;
  }
  const s = spawned[0];
  let held: HTMLElement | null = null;
  let heldFrom: HTMLElement | null = null;
  let touched = false;
  const touchdown = () => {
    if (!touched) {
      touched = true;
      args.onTouchdown?.();
    }
  };
  if (args.holdFrom === true) {
    heldFrom = args.from.querySelector<HTMLElement>('.card-container') ?? args.from;
    heldFrom.classList.add(HOLD_CLASS);
  }
  // Pre-hold the destination in the SAME flush (before its first paint):
  // the landing slot's own card must never flash before the proxy arrives.
  if (args.holdTarget === true) {
    const pre = args.resolveTo();
    const preCard = pre !== null ? (pre.querySelector<HTMLElement>('.card-container') ?? pre) : null;
    if (preCard !== null) {
      held = preCard;
      preCard.classList.add(HOLD_CLASS);
    }
  }
  await guarded((done) => {
    let tries = 0;
    let lastSig = '';
    const dive = () => {
      touchdown(); // no believable slot — reveal the host state honestly
      const tl = gsap.timeline({onComplete: done});
      tl.to(s.el, {y: '+=26', scale: '*=0.92', autoAlpha: 0, duration: motionMs(200) / 1000, ease: 'power2.in'});
    };
    const poll = () => {
      tries++;
      const slot = args.resolveTo();
      const card = slot !== null ? (slot.querySelector<HTMLElement>('.card-container') ?? slot) : null;
      const r = card !== null ? card.getBoundingClientRect() : undefined;
      const ok = r !== undefined && usable(r);
      const sig = ok ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}` : '';
      if (!ok || sig !== lastSig) {
        lastSig = sig;
        if (tries < 45) {
          requestAnimationFrame(poll);
        } else {
          dive();
        }
        return;
      }
      if (args.holdTarget === true && card !== null && held !== card) {
        held?.classList.remove(HOLD_CLASS);
        held = card;
        card.classList.add(HOLD_CLASS);
      }
      const scale = r.width / CARD_NATURAL_W;
      const tl = gsap.timeline({onComplete: done});
      tl.to(s.el, {
        x: r.left, y: r.top, scale, rotation: 0,
        duration: motionMs(340) / 1000,
        ease: 'power3.inOut',
      });
      tl.call(() => {
        held?.classList.remove(HOLD_CLASS);
        touchdown();
      });
      tl.to(s.el, {autoAlpha: 0, duration: motionMs(130) / 1000, ease: 'power1.out'});
    };
    requestAnimationFrame(poll);
  }, motionMs(340) + 900);
  if (held !== null) {
    (held as HTMLElement).classList.remove(HOLD_CLASS); // safety-path release
  }
  heldFrom?.classList.remove(HOLD_CLASS);
  touchdown(); // safety: the reveal callback never strands host state
  cleanup(spawned);
}

/**
 * DEPART — the play-confirm SUCCESS finale: the card lifts OFF the modal
 * toward the board above ("played onto the table"), never a fake return
 * to a hand it already left.
 */
export async function runCardDepart(source: ExitSource): Promise<void> {
  if (consoleReducedMotionActive()) {
    return;
  }
  const spawned = await spawnProxies([source], false);
  if (spawned.length === 0) {
    return;
  }
  const s = spawned[0];
  await guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    tl.to(s.el, {y: s.rect.top - 110, scale: '*=0.82', rotation: 1.6, duration: motionMs(300) / 1000, ease: 'power2.in'});
    tl.to(s.el, {autoAlpha: 0, duration: motionMs(140) / 1000, ease: 'power1.in'}, '<40%');
  }, motionMs(650));
  cleanup(spawned);
}
