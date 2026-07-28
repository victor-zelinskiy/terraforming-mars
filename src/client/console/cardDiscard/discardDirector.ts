/*
 * CARD DISCARD DIRECTOR — the GSAP half of "a card physically leaves the hand".
 *
 * The gesture it plays is a TABLETOP one, not a UI effect: you pick the cards
 * out of your hand, you turn them over where they lie, you square them into a
 * packet, you carry the packet across and you put it down on the pile. Every
 * beat below is one of those movements, and each is its own awaited timeline so
 * the transaction can interleave the overlay's own close between them.
 *
 *   A · fixate  — the chosen cards come off the row (the rest recede via CSS).
 *   B · flip    — face → back IN PLACE, cascaded, with weight through the turn.
 *   C · gather  — squared up into one compact packet at their own centroid.
 *   D · hold    — the packet breathes while the overlay goes home behind it.
 *   E · carry   — picked up, then carried on an ARC with an early decelerating
 *                 approach and a tilt into the direction of travel.
 *   F · land    — contact settle; the proxy fades exactly as the real pile back
 *                 materialises under it, which is when the count ticks.
 *
 * Transform/opacity only (con-perf-lite safe — the condemned rim is a
 * box-shadow class, never a filter). Every duration goes through motionMs;
 * every px constant is multiplied by conUiScale() or the TV profile would stop
 * growing it.
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
  packetCentre,
  packetOffset,
  pileJitterDeg,
  stackOffset,
  usableDiscardRect,
} from '@/client/console/cardDiscard/discardModel';

/** The shared "this slot is empty" cascade rule every exit flow uses. */
const HOLD_CLASS = 'con-deal-hold';
/** The rim that marks a card as chosen — a box-shadow class, perf-safe. */
const SEIZED_CLASS = 'con-discard-proxy--seized';
/** Mid-turn: the drop shadow widens as the card comes off the table. Purely
 *  decorative (a `filter`), so perf-lite dropping it costs no information. */
const TURNING_CLASS = 'con-discard-proxy--turning';

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
 * PHASE A — FIXATE. The chosen cards come off the row a little and settle; the
 * rest of the hand recedes behind them (that half is CSS, driven by the shell's
 * `.con-hand--discarding` root class, so it costs no timeline).
 *
 * Deliberately short: this is a grip, not a presentation.
 */
export function runDiscardFixate(spawned: ReadonlyArray<SpawnedDiscard>, t: DiscardTimings): Promise<void> {
  if (spawned.length === 0) {
    return Promise.resolve();
  }
  const unit = conUiScale();
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    spawned.forEach((sp, i) => {
      sp.el.classList.add(SEIZED_CLASS);
      tl.to(sp.el, {
        y: sp.rect.top - 16 * unit,
        scale: `*=1.035`,
        rotation: pileJitterDeg(i) * 0.3,
        duration: s(t.fixateMs),
        ease: 'power2.out',
      }, i * s(24));
    });
  }, motionMs(t.fixateMs + 24 * spawned.length + 60));
}

/**
 * PHASE B — TURN THEM OVER, IN PLACE. Each card rotates face → back where it
 * lies, with a small rise + scale swell through the half-turn so it reads as a
 * solid object being turned rather than a texture swap. Several cards cascade,
 * the way a hand turns them one after another — never in machine unison.
 */
export function runDiscardFlip(spawned: ReadonlyArray<SpawnedDiscard>, t: DiscardTimings): Promise<void> {
  if (spawned.length === 0) {
    return Promise.resolve();
  }
  const unit = conUiScale();
  const half = s(t.flipMs) / 2;
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    spawned.forEach((sp, i) => {
      const at = i * s(t.flipStepMs);
      // The turn: accelerate off the table, decelerate onto its back.
      tl.to(sp.flip, {rotateY: 90, duration: half, ease: 'power2.in'}, at);
      tl.to(sp.flip, {rotateY: 180, duration: half, ease: 'power2.out'}, at + half);
      // The card takes weight through the turn — up and slightly larger at the
      // edge-on moment, back down as it comes to rest on its back.
      tl.to(sp.el, {y: `-=${9 * unit}`, scale: `*=1.05`, duration: half, ease: 'power2.out'}, at);
      tl.to(sp.el, {y: `+=${9 * unit}`, scale: `/=1.05`, duration: half, ease: 'power2.inOut'}, at + half);
      // The shadow widens at the apex and closes again (decorative only).
      tl.call(() => sp.el.classList.add(TURNING_CLASS), undefined, at);
      tl.call(() => sp.el.classList.remove(TURNING_CLASS), undefined, at + half * 2);
      // Face down = not yours any more: the chosen rim has said its piece.
      tl.call(() => sp.el.classList.remove(SEIZED_CLASS), undefined, at + half);
    });
  }, motionMs(t.flipMs + t.flipStepMs * spawned.length + 80));
}

/**
 * PHASE C — SQUARE THEM UP. The turned cards converge into one compact packet
 * at their own centroid (where they were lying — never at some arbitrary
 * collection point the player never looked at). A single card just gets a small
 * settling nudge: there is nothing to square up, and pretending otherwise would
 * read as mechanical.
 */
export function runDiscardGather(spawned: ReadonlyArray<SpawnedDiscard>, t: DiscardTimings): Promise<void> {
  if (spawned.length === 0) {
    return Promise.resolve();
  }
  const unit = conUiScale();
  const centre = packetCentre(spawned.map((sp) => sp.rect));
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    if (spawned.length === 1) {
      const sp = spawned[0];
      tl.to(sp.el, {y: `-=${5 * unit}`, duration: s(t.gatherMs) * 0.45, ease: 'power2.out'});
      tl.to(sp.el, {y: `+=${5 * unit}`, duration: s(t.gatherMs) * 0.55, ease: 'power2.inOut'});
      return;
    }
    spawned.forEach((sp, i) => {
      const offset = packetOffset(i, spawned.length, unit);
      const scale = sp.rect.width / CARD_NATURAL_W;
      tl.to(sp.el, {
        x: centre.x - sp.rect.width / 2 + offset.dx,
        y: centre.y - sp.rect.height / 2 + offset.dy,
        rotation: offset.rotation,
        scale,
        duration: s(t.gatherMs),
        ease: 'power3.inOut',
      }, i * s(18));
    });
  }, motionMs(t.gatherMs + 18 * spawned.length + 60));
}

/**
 * PHASE D — the packet HOLDS while the overlay goes home behind it. Nothing
 * travels: a barely-perceptible breath keeps it alive as a physical object
 * instead of a frozen sprite, while the unchosen cards gather back into the
 * dock underneath it.
 */
export function runDiscardHold(spawned: ReadonlyArray<SpawnedDiscard>, t: DiscardTimings): Promise<void> {
  if (spawned.length === 0 || t.handoffMs <= 0) {
    return Promise.resolve();
  }
  const unit = conUiScale();
  const els = spawned.map((sp) => sp.el);
  return guarded((done) => {
    gsap.timeline({onComplete: done})
      .to(els, {y: `-=${3 * unit}`, duration: s(t.handoffMs) * 0.5, ease: 'sine.inOut'})
      .to(els, {y: `+=${3 * unit}`, duration: s(t.handoffMs) * 0.5, ease: 'sine.inOut'});
  }, motionMs(t.handoffMs + 60));
}

/**
 * PHASE E+F — PICK UP, CARRY, LAND.
 *
 * The carry is the beat the first cut got wrong: it snapped straight into a
 * throw. Now the packet is LIFTED first (a short rise + scale, no travel), then
 * carried on an ARC — the lateral and vertical channels run on different eases,
 * so the path bends and the approach decelerates EARLY rather than braking at
 * the pile. The pack tilts into the direction of travel and levels off as it
 * arrives, then takes one contact settle.
 *
 * `onLanded` fires per card at the exact frame it touches the pile, so the
 * count ticks on contact and never a moment before.
 */
export function runDiscardCarry(
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
  const lift = s(t.liftMs);
  const carry = s(t.carryMs);
  const land = s(t.landMs);

  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    spawned.forEach((sp, i) => {
      // The packet travels as ONE object; only the final approach staggers, so
      // the cards settle onto the pile one after another instead of merging.
      const at = i * s(t.carryStepMs);
      if (!usableDiscardRect(trayRect)) {
        // No believable pile anchor (degenerate layout): leave honestly
        // downward rather than fake a landing on nothing.
        tl.to(sp.el, {y: `+=${140 * unit}`, autoAlpha: 0, duration: carry, ease: 'power1.in'}, at);
        tl.call(() => onLanded(i), undefined, at + carry * 0.8);
        return;
      }
      const trayScale = trayRect.width / CARD_NATURAL_W;
      const offset = stackOffset(i, spawned.length, unit);
      const toX = trayRect.left + offset.dx;
      const toY = trayRect.top + offset.dy;
      const goingRight = toX > Number(gsap.getProperty(sp.el, 'x'));

      // ── PICK UP: it comes off the table before it goes anywhere. ──────────
      tl.to(sp.el, {
        y: `-=${18 * unit}`,
        scale: `*=1.04`,
        duration: lift,
        ease: 'power2.out',
      }, at);

      // ── CARRY: two channels, two eases → a bent path, never a translate. ──
      const carryAt = at + lift * 0.72; // the lift blends into the carry
      tl.to(sp.el, {x: toX, duration: carry, ease: 'power2.inOut'}, carryAt);
      // The vertical channel leads (holds height early, comes down late) —
      // that is what makes the path read as an arc over the table.
      tl.to(sp.el, {y: toY, duration: carry, ease: 'power3.inOut'}, carryAt);
      tl.to(sp.el, {scale: trayScale, duration: carry, ease: 'power2.inOut'}, carryAt);
      // Tilt INTO the direction of travel, then level onto the pile.
      tl.to(sp.el, {rotation: goingRight ? 5.5 : -5.5, duration: carry * 0.45, ease: 'power2.out'}, carryAt);
      tl.to(sp.el, {rotation: pileJitterDeg(i), duration: carry * 0.55, ease: 'power2.inOut'}, carryAt + carry * 0.45);

      // ── LAND: contact settle. The real pile back materialises under it, so
      //    the proxy fades ON CONTACT rather than vanishing in mid-air. ──────
      const landAt = carryAt + carry;
      tl.call(() => onLanded(i), undefined, landAt);
      tl.to(sp.el, {scale: trayScale * 0.965, duration: land * 0.35, ease: 'power2.out'}, landAt);
      tl.to(sp.el, {scale: trayScale, duration: land * 0.65, ease: 'power1.inOut'}, landAt + land * 0.35);
      tl.to(sp.el, {autoAlpha: 0, duration: land * 0.6, ease: 'power1.out'}, landAt + land * 0.2);
    });
  }, motionMs(t.liftMs + t.carryMs + t.landMs + t.carryStepMs * spawned.length + 200));
}

/** Landing hook that thickens the pile and ticks its count. */
export function landOnPile(): void {
  noticeDiscardLanding();
}

/**
 * The pile takes the weight: one short impulse of the WHOLE tray as the packet
 * comes to rest on it. Small — the cards did the travelling, the pile only
 * acknowledges. Runs after the last landing, alongside the count's own pulse.
 */
export function runDiscardPileSettle(t: DiscardTimings): Promise<void> {
  const pile = discardTrayEl()?.closest<HTMLElement>('.con-discard__pile');
  if (pile === null || pile === undefined) {
    return Promise.resolve();
  }
  return guarded((done) => {
    gsap.timeline({onComplete: done})
      .to(pile, {y: `+=${2.5 * conUiScale()}`, duration: s(t.landMs) * 0.35, ease: 'power2.out'})
      .to(pile, {y: 0, duration: s(t.landMs) * 0.65, ease: 'back.out(1.6)'});
  }, motionMs(t.landMs));
}

/**
 * The closing beat. The pile does NOT vanish the moment the cards touch it: it
 * holds the acknowledgement the player just watched arrive (long enough to read
 * the new count), and only then withdraws — settling down and fading rather
 * than being cut. A real tween, so the caller's release is the animation's own
 * completion signal and never a timer.
 */
export function runDiscardTrayWithdraw(t: DiscardTimings): Promise<void> {
  const tray = discardTrayEl()?.closest<HTMLElement>('.con-discard__tray');
  if (tray === null || tray === undefined) {
    return Promise.resolve();
  }
  const hold = s(t.settleMs) * 0.58; // the READ: the count has landed, look at it
  const out = s(t.settleMs) * 0.42;
  return guarded((done) => {
    gsap.timeline({onComplete: done})
      .to(tray, {duration: hold})
      .to(tray, {
        autoAlpha: 0,
        y: `+=${7 * conUiScale()}`,
        scale: 0.965,
        duration: out,
        ease: 'power2.inOut',
      });
  }, motionMs(t.settleMs));
}
