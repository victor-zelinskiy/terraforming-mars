/*
 * CARD DISCARD DIRECTOR — the GSAP half of "a card physically leaves the hand".
 *
 * The scene is deliberately the MIRROR of the deck-draw discard toss (the same
 * pull-back → flat toss → land-with-jitter → fade-on-contact language), so the
 * two places a card can end up on the discard pile speak one dialect. What it
 * adds is the half the draw never needs: the card starts FACE UP in the
 * player's own hand, so it TURNS as it goes — the identity closes at the apex
 * of the throw, which is the physical moment a card stops being yours.
 *
 * Beats (one paused timeline per beat, awaited by the transaction):
 *   1. SEIZE    — the proxy stands over the real slot (which is held empty in
 *                 the same synchronous block) and lifts with the discard rim.
 *   2. CONDEMN  — a short readable hold at the top of the lift.
 *   3. TOSS     — pull back, then the flat throw onto the tray; the face→back
 *                 turn rides the throw; landing rotation is the pile's jitter.
 *   4. LAND     — the proxy fades ON CONTACT while the real pile back
 *                 materialises under it (the count ticks at that exact frame).
 *
 * Transform/opacity only (con-perf-lite safe — the rim is a box-shadow class,
 * never a filter). Every duration goes through motionMs; every px constant is
 * multiplied by conUiScale() or the TV profile would stop growing it.
 */

import {nextTick} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {
  cardDiscardState,
  discardFlightEl,
  discardTrayEl,
  nextDiscardFlightId,
  noticeDiscardLanding,
  removeDiscardFlights,
} from '@/client/console/cardDiscard/cardDiscardState';
import {
  DiscardRect,
  DiscardTimings,
  pileJitterDeg,
  stackOffset,
  usableDiscardRect,
} from '@/client/console/cardDiscard/discardModel';

/** The shared "this slot is empty" cascade rule every exit flow uses. */
const HOLD_CLASS = 'con-deal-hold';
/** The rim that marks a card as condemned — a box-shadow class, perf-safe. */
const SEIZED_CLASS = 'con-discard-proxy--seized';

const s = (ms: number) => motionMs(ms) / 1000;

export type DiscardSource = {
  name: CardName,
  /** The live slot element, when the pick surface is still on screen. */
  el?: HTMLElement,
  /** A rect captured BEFORE the commit, for a source that unmounts. */
  rect?: DiscardRect,
};

export type SpawnedDiscard = {
  id: number,
  name: CardName,
  el: HTMLElement,
  flip: HTMLElement,
  rect: DiscardRect,
};

function elementRect(el: HTMLElement): DiscardRect {
  const card = el.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? el;
  const r = card.getBoundingClientRect();
  return {left: r.left, top: r.top, width: r.width, height: r.height};
}

/**
 * Resolve a source's launch rect. A LIVE element is re-measured (it may have
 * moved since the capture); a dead one falls back to its pre-commit snapshot,
 * so the card takes off from where the player last saw it instead of
 * teleporting to the viewport origin.
 */
export function resolveSourceRect(source: DiscardSource): DiscardRect | undefined {
  if (source.el?.isConnected === true) {
    const live = elementRect(source.el);
    if (usableDiscardRect(live)) {
      return live;
    }
  }
  return usableDiscardRect(source.rect) ? source.rect : undefined;
}

/**
 * Spawn one proxy per source, position each exactly over its card and hide the
 * real card in the SAME synchronous block (before the browser paints) — the
 * proxy appears and the original vanishes in one frame, never both at once.
 */
export async function spawnDiscardProxies(sources: ReadonlyArray<DiscardSource>): Promise<Array<SpawnedDiscard>> {
  const entries = sources
    .map((source) => ({source, rect: resolveSourceRect(source)}))
    .filter((e): e is {source: DiscardSource, rect: DiscardRect} => e.rect !== undefined)
    .map((e, index) => ({...e, id: nextDiscardFlightId(), z: index + 1}));
  if (entries.length === 0) {
    return [];
  }
  cardDiscardState.flights = entries.map((e) => ({id: e.id, name: e.source.name, z: e.z}));
  await nextTick();
  const out: Array<SpawnedDiscard> = [];
  for (const e of entries) {
    const el = discardFlightEl(e.id);
    const flip = el?.querySelector<HTMLElement>('.con-deal-proxy__flip') ?? undefined;
    if (el === undefined || flip === undefined) {
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
    gsap.set(flip, {rotateY: 0});
    const card = e.source.el?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? e.source.el;
    card?.classList.add(HOLD_CLASS);
    out.push({id: e.id, name: e.source.name, el, flip, rect: e.rect});
  }
  return out;
}

/** Kill + unregister a finished (or abandoned) flight set. */
export function disposeDiscardProxies(spawned: ReadonlyArray<SpawnedDiscard>): void {
  spawned.forEach((sp) => {
    gsap.killTweensOf(sp.el);
    gsap.killTweensOf(sp.flip);
  });
  removeDiscardFlights(spawned.map((sp) => sp.id));
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
    const safety = setTimeout(done, budgetMs + 1200); // rAF-stall net
    run(() => {
      clearTimeout(safety);
      done();
    });
  });
}

/**
 * BEAT 1+2 — SEIZE and CONDEMN. The chosen cards come off the hand with the
 * discard rim and hold for one readable beat. The player sees exactly WHICH
 * cards are going before anything irreversible looks like it happened.
 */
export function runDiscardSeize(spawned: ReadonlyArray<SpawnedDiscard>, t: DiscardTimings): Promise<void> {
  if (spawned.length === 0) {
    return Promise.resolve();
  }
  const unit = conUiScale();
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    spawned.forEach((sp, i) => {
      const at = i * s(t.stepMs);
      tl.call(() => sp.el.classList.add(SEIZED_CLASS), undefined, at);
      tl.to(sp.el, {
        y: sp.rect.top - 22 * unit,
        scale: `*=1.05`,
        rotation: pileJitterDeg(i) * 0.35,
        duration: s(t.seizeMs),
        ease: 'power2.out',
      }, at);
    });
    if (t.condemnMs > 0) {
      tl.to({}, {duration: s(t.condemnMs)});
    }
  }, motionMs(t.seizeMs + t.condemnMs + t.stepMs * spawned.length));
}

/**
 * BEAT 3+4 — the TOSS onto the pile with the face→back turn, and the LANDING.
 * `onLanded` fires per card at the exact frame the proxy touches the pile, so
 * the count ticks on physical contact and never a moment before.
 */
export function runDiscardToss(
  spawned: ReadonlyArray<SpawnedDiscard>,
  t: DiscardTimings,
  onLanded: (index: number) => void,
): Promise<void> {
  if (spawned.length === 0) {
    return Promise.resolve();
  }
  const unit = conUiScale();
  const tray = discardTrayEl();
  const trayRect = tray === undefined ? undefined : (() => {
    const r = tray.getBoundingClientRect();
    return {left: r.left, top: r.top, width: r.width, height: r.height};
  })();

  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    spawned.forEach((sp, i) => {
      const at = i * s(t.stepMs);
      const toss = s(t.tossMs);
      if (!usableDiscardRect(trayRect)) {
        // No believable pile anchor (degenerate layout): the card leaves
        // honestly downward instead of faking a landing on nothing.
        tl.to(sp.el, {y: `+=${140 * unit}`, autoAlpha: 0, duration: toss, ease: 'power1.in'}, at);
        tl.call(() => onLanded(i), undefined, at + toss * 0.8);
        return;
      }
      const trayScale = trayRect.width / CARD_NATURAL_W;
      const offset = stackOffset(i, spawned.length, unit);
      // The wrist flick: a short pull back away from the pile…
      tl.to(sp.el, {
        y: `-=${14 * unit}`,
        duration: toss * 0.22,
        ease: 'power2.out',
      }, at);
      // …then the flat throw. Lateral glide and vertical drop are separate
      // channels so the arc lands soft instead of arriving on a straight line.
      const landAt = at + toss * 0.22;
      const flight = toss * 0.78;
      tl.to(sp.el, {x: trayRect.left + offset.dx, duration: flight, ease: 'power1.inOut'}, landAt);
      tl.to(sp.el, {y: trayRect.top + offset.dy, duration: flight, ease: 'power2.in'}, landAt);
      tl.to(sp.el, {scale: trayScale, duration: flight, ease: 'power2.inOut'}, landAt);
      tl.to(sp.el, {rotation: pileJitterDeg(i), duration: flight, ease: 'power1.out'}, landAt);
      // The identity closes at the apex of the throw — the card is face down
      // by the time it reaches the pile, because it is not yours any more.
      tl.call(() => sp.el.classList.remove(SEIZED_CLASS), undefined, landAt);
      tl.to(sp.flip, {rotateY: 180, duration: s(t.turnMs), ease: 'power2.inOut'}, landAt + flight * 0.12);
      // It lands ON the pile: the real back materialises under it, so the
      // proxy fades on contact rather than vanishing in mid-air.
      tl.call(() => onLanded(i), undefined, landAt + flight);
      tl.to(sp.el, {autoAlpha: 0, duration: s(90), ease: 'power1.out'}, landAt + flight);
    });
  }, motionMs(t.tossMs + t.stepMs * spawned.length + 200));
}

/** Landing hook that thickens the pile and ticks its count. */
export function landOnPile(): void {
  noticeDiscardLanding();
}

/**
 * The closing beat: the pile holds the acknowledgement the player just watched
 * arrive, then the tray withdraws. A real tween, so the caller's release is the
 * animation's own completion signal rather than a timer.
 */
export function runDiscardTrayWithdraw(t: DiscardTimings): Promise<void> {
  const tray = discardTrayEl()?.closest<HTMLElement>('.con-discard__tray');
  if (tray === null || tray === undefined) {
    return Promise.resolve();
  }
  return guarded((done) => {
    gsap.timeline({onComplete: done})
      .to(tray, {duration: s(t.settleMs * 0.45)})
      .to(tray, {
        autoAlpha: 0,
        y: `+=${10 * conUiScale()}`,
        scale: 0.94,
        duration: s(t.settleMs * 0.55),
        ease: 'power2.in',
      });
  }, motionMs(t.settleMs));
}
