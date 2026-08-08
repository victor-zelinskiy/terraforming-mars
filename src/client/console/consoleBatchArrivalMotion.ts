/*
 * @console-shared LIVE — console native stands on this file.
 *
 * BATCH ARRIVAL — N cards physically leave the HUD project deck and land in N
 * PREPARED slots, opening on the way.
 *
 * This is the director half of `consoleCardArrival` (the pure plan). It moves
 * elements; every millisecond and every decision about WHEN comes from the
 * plan, and the card-opening motion itself is the fork's ONE premium turn
 * (`cardDeal/premiumTurn`) — the same function the deck-draw cinematic plays,
 * not a look-alike copy.
 *
 * ── THE CONTRACT ───────────────────────────────────────────────────────────
 *  · The batch's COUNT, its slots and its layout are decided BEFORE the first
 *    frame. Nothing is measured again once the flight starts.
 *  · Every card is its OWN object from the pile onward: its own launch time,
 *    its own trajectory, its own destination. A batch never divides in mid-air
 *    and a card is never conjured after another one has arrived.
 *  · The cards are born as a compact fanned STACK on the pile (arrivalSourceFan)
 *    and separate immediately, so the count is legible inside the first quarter
 *    of the scene.
 *  · The turn RIDES the trajectory. `in-flight-reveal` cards land face-up; a
 *    post-landing flip in that mode is a bug, not a fallback.
 *  · `awaiting-data` cards fly as backs to their real slots and wait THERE.
 *    When the answer lands, each card individually takes whichever opening is
 *    still visually continuous: still early enough → the normal in-flight turn
 *    on the rest of its own path; already committed → a short in-place cascade.
 *    A card never returns to a previous orientation, never re-launches and is
 *    never swapped for another element.
 *  · `onSettled` fires once, when the LAST card has finished arriving AND
 *    opening. It is the flow's completion signal — the caller opens input on
 *    it, never on a timer.
 *
 * Idioms shared with every other flight director in this fork: natural-width
 * (CARD_NATURAL_W) proxies with `transformOrigin: 'top left'` so a landing
 * scale maps onto a real slot rect pixel-true; a two-channel arc (lateral
 * `power1.inOut` + vertical `power3.out`) instead of a path plugin; `rotateY
 * 180` = back showing; deterministic jitter (the fork bans Math.random here).
 */

import {gsap} from 'gsap';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {DEAL_TURN_GLINT, addPremiumTurn} from '@/client/console/cardDeal/premiumTurn';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {runDeckSettleTick} from '@/client/console/deckDraw/deckDrawDirector';
import {motionMs} from '@/client/components/motion/motionTokens';
import {
  CardArrivalMode, CardArrivalPlan, CardArrivalTimings, arrivalSourceFan,
  cardArrivalTimings, planCardArrival, reducedCardArrivalTimings,
} from '@/client/console/consoleCardArrival';

/** The HUD project-deck pile — the physical source of every deck flight. */
const DECK_SEL = '.con-deckstack__pile';

/** Safety: force-settle even if GSAP stalls (a backgrounded tab). */
const SAFETY_MS = 9000;

/** BASE ms → seconds, through the fork-wide speed preset. */
function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/**
 * Deterministic per-card tilt, stable across re-runs — the SAME function and
 * the SAME magnitude the deck-draw cinematic uses (`deckDrawDirector`), so a
 * batch coming off the pile and a single search card coming off the pile are
 * physically the same object. This used to be a louder copy (a wider spread,
 * then multiplied by 1.6 instead of 0.5 at birth), and the difference read as
 * scattered cards rather than a stack being dealt.
 */
function jitterDeg(index: number): number {
  const magnitude = 1.5 + ((index * 137) % 5) * 0.6;
  return (index % 2 === 0 ? -1 : 1) * magnitude;
}

/** The flyer pair of one card: the fixed proxy chassis and its flip child. */
export type BatchArrivalCard = {proxy: HTMLElement, flip: HTMLElement};

export type BatchArrivalHandle = {
  /**
   * The server's answer landed — the faces exist. Safe to call at any time,
   * including before launch or after everything has settled.
   */
  notifyPayload(): void;
  /** Where the scene currently is (observability + the caller's own gating). */
  readonly plan: CardArrivalPlan;
  /** Abort (phase cancelled / unmount): kills every tween, fires nothing. */
  kill(): void;
};

export type BatchArrivalArgs = {
  /** One entry per card, in batch order. */
  cards: ReadonlyArray<BatchArrivalCard>;
  /** The prepared landing slots, in the SAME order. */
  slots: ReadonlyArray<HTMLElement>;
  /** How this batch is allowed to open (see consoleCardArrival). */
  mode: CardArrivalMode;
  /** A card's face became readable (index) — the status may tell the truth. */
  onFaceShown?: (index: number) => void;
  /** The first card has visibly committed to leaving the pile. */
  onDeparted?: () => void;
  /**
   * Every card has TOUCHED DOWN. In the normal mode this coincides with the
   * settle; in `awaiting-data` it is the honest «the cards are here, the
   * server is not» moment a loading affordance may finally appear on.
   */
  onLanded?: () => void;
  /** Every card has landed AND opened. The flow's completion signal. */
  onSettled: () => void;
};

/**
 * Launch the batch. Returns a handle the caller uses to release the reveal
 * once the payload lands and to abort cleanly.
 */
export function runBatchArrival(args: BatchArrivalArgs): BatchArrivalHandle {
  const {cards, slots, onFaceShown, onDeparted, onLanded, onSettled} = args;
  const n = Math.min(cards.length, slots.length);
  const reduced = consoleReducedMotionActive();
  const t: CardArrivalTimings = reduced ? reducedCardArrivalTimings() : cardArrivalTimings();
  const plan = planCardArrival(n, t, args.mode);

  let dead = false;
  let settled = false;
  let landedAll = false;
  let payloadReady = args.mode === 'in-flight-reveal';
  let safety = 0;
  /** Cards that still owe an opening (only ever non-empty off the normal mode). */
  const pendingOpen = new Set<number>();
  const timelines: Array<gsap.core.Timeline> = [];
  /** Per-card landing rect + rest scale, kept for the in-place turn. */
  const pose: Array<{scale: number}> = [];
  const shown = new Set<number>();
  let sceneStart = 0;

  const fireFace = (i: number) => {
    if (!dead && !shown.has(i)) {
      shown.add(i);
      onFaceShown?.(i);
    }
  };
  const fireSettled = () => {
    if (!dead && !settled) {
      settled = true;
      window.clearTimeout(safety);
      onSettled();
    }
  };
  /** Settled = the last card has touched down AND nothing still owes a turn. */
  const maybeSettle = () => {
    if (landedAll && pendingOpen.size === 0) {
      fireSettled();
    }
  };

  if (typeof window === 'undefined' || n === 0) {
    // No stage to fly on (JSDOM / a degenerate batch): never withhold the
    // outcome behind an animation that cannot run.
    fireSettled();
    return {
      notifyPayload: () => { /* nothing is flying */ },
      plan,
      kill: () => {
        dead = true;
      },
    };
  }

  const slotRects = slots.slice(0, n).map((el) => el.getBoundingClientRect());
  const usable = slotRects.every((r) => r.width >= 10 && r.height >= 10);
  if (!usable) {
    // An unmeasurable stage means the landing rect would be a guess, and a
    // guessed landing is exactly the visible teleport this system exists to
    // remove. Hand over immediately instead of faking a flight.
    cards.slice(0, n).forEach(({proxy}) => gsap.set(proxy, {autoAlpha: 0}));
    safety = window.setTimeout(fireSettled, SAFETY_MS);
    return {
      notifyPayload: () => fireSettled(),
      plan,
      kill: () => {
        dead = true;
        window.clearTimeout(safety);
      },
    };
  }

  const deckEl = document.querySelector<HTMLElement>(DECK_SEL);
  const deckRect = deckEl?.getBoundingClientRect();
  const hasDeck = deckRect !== undefined && deckRect.width > 4;
  const fan = arrivalSourceFan(n, hasDeck ? deckRect.width : 40);

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  sceneStart = now();

  cards.slice(0, n).forEach(({proxy, flip}, i) => {
    const beat = plan.beats[i];
    const slotRect = slotRects[i];
    const restScale = Math.max(0.05, slotRect.width / CARD_NATURAL_W);
    const naturalH = slotRect.height / restScale;
    pose[i] = {scale: restScale};

    // Born ON the pile: a compact fanned stack of N physical cards. The fan is
    // what makes «several cards» true from the very first frame instead of a
    // fact the player only learns on arrival.
    const startScale = hasDeck ?
      Math.max(0.04, Math.min(restScale, deckRect.width / CARD_NATURAL_W)) :
      restScale * 0.5;
    const fromCx = (hasDeck ? deckRect.left + deckRect.width / 2 : slotRect.left + slotRect.width / 2) + fan[i].dx;
    const fromCy = (hasDeck ? deckRect.top + deckRect.height / 2 : -naturalH * 0.1) + fan[i].dy;

    // CENTRE-ANCHORED POSE. The proxy's origin is `top left`, so a pose given
    // as a centre must be resolved by hand — and it must be resolved AGAIN for
    // every scale change, which is the whole point of this helper. The peel
    // used to nudge `y` alone while growing the card 12 %: with a top-left
    // origin that slides the visual centre right AND down, so the card crabbed
    // sideways off the pile instead of lifting out of it. That drift is what
    // read as "the cards appear crookedly".
    const at = (cx: number, cy: number, scale: number) => ({
      x: cx - (CARD_NATURAL_W * scale) / 2,
      y: cy - (naturalH * scale) / 2,
    });
    const born = at(fromCx, fromCy, startScale);

    gsap.set(proxy, {
      width: CARD_NATURAL_W,
      height: naturalH,
      transformOrigin: 'top left',
      x: born.x,
      y: born.y,
      scale: startScale,
      rotation: jitterDeg(i) * 0.5,
      autoAlpha: 0,
      zIndex: 10 + i,
    });
    gsap.set(flip, {rotateY: 180, rotateX: 0, z: 0}); // every card leaves face DOWN

    const tl = gsap.timeline({delay: s(beat.atMs)});
    timelines.push(tl);

    // PEEL — the card frees itself from the pile before it travels. Straight
    // UP out of the stack (BOTH axes re-solved for the bigger scale), exactly
    // the deck-draw cinematic's separation, and the pile TICKS as the first
    // card leaves so the deck visibly answers instead of standing inert.
    const peel = at(fromCx, fromCy - 10 - 14 * startScale, startScale * 1.14);
    tl.to(proxy, {
      autoAlpha: 1,
      x: peel.x,
      y: peel.y,
      scale: startScale * 1.14,
      duration: s(beat.peelMs),
      ease: 'power2.out',
    }, 0);
    if (i === 0) {
      tl.call(() => {
        if (!dead) {
          if (deckEl !== null && !reduced) {
            runDeckSettleTick(deckEl, reduced);
          }
          onDeparted?.();
        }
      }, undefined, s(beat.peelMs * 0.55));
    }

    // TRAVEL — the two-channel arc straight to THIS card's own slot. Lateral
    // and vertical ride different eases so the path bows; the scale grows over
    // the approach so arriving and enlarging are one gesture.
    const travelAt = s(beat.peelMs);
    const travel = s(beat.travelMs);
    tl.to(proxy, {x: slotRect.left, duration: travel, ease: 'power1.inOut'}, travelAt);
    tl.to(proxy, {y: slotRect.top, duration: travel, ease: 'power3.out'}, travelAt);
    tl.to(proxy, {scale: restScale, duration: travel, ease: 'power2.out'}, travelAt);
    tl.to(proxy, {rotation: 0, duration: travel * 0.82, ease: 'power2.out'}, travelAt);

    if (beat.flipAtMs !== undefined && !reduced) {
      // The NORMAL flow: the card tumbles open ON its trajectory and lands
      // face-up. One continuous physical event, never fly-then-flip.
      addPremiumTurn(tl, {
        proxy, flip,
        at: s(beat.flipAtMs - beat.atMs),
        dur: s(beat.flipMs),
        poseScale: restScale,
        push: t.turnPush,
        glintClass: DEAL_TURN_GLINT,
        // ⚠️ The FLIGHT LEG still owns `scale` for this whole window (it is
        // tweening `restScale` on the same proxy), so the turn must not add a
        // second writer: two live tweens on one property fight per tick and the
        // card visibly jitters mid-air. `openPending`'s early branch already
        // knew this; the primary path did not, and spent ~240 ms of every
        // card's flight in that fight.
        settleScale: false,
        onFaceShown: () => fireFace(i),
      });
    } else if (beat.flipAtMs !== undefined) {
      // Reduced motion: an honest short turn on the same leg, no theatrics.
      tl.to(flip, {rotateY: 0, duration: s(beat.flipMs), ease: 'power2.out'}, s(beat.flipAtMs - beat.atMs));
      tl.call(() => fireFace(i), undefined, s(beat.flipAtMs - beat.atMs) + s(beat.flipMs) * 0.5);
    } else {
      // Face-DOWN arrival: this card still owes an opening.
      pendingOpen.add(i);
    }

    // SETTLE — one soft touchdown breath (a few px of weight, then rest). No
    // bounce, no second hop, and never a move to another position afterwards.
    if (!reduced) {
      const give = Math.max(3, 5 * restScale);
      tl.to(proxy, {y: `+=${give}`, duration: s(t.settleMs * 0.42), ease: 'power2.out'}, travelAt + travel);
      tl.to(proxy, {y: slotRect.top, duration: s(t.settleMs * 0.58), ease: 'power2.inOut'}, travelAt + travel + s(t.settleMs * 0.42));
    }
    if (i === n - 1) {
      tl.call(() => {
        landedAll = true;
        if (!dead) {
          onLanded?.();
        }
        maybeSettle();
      }, undefined, travelAt + travel + s(t.settleMs));
    }
  });

  /**
   * The answer arrived. Each card that still owes an opening takes whichever
   * one is still CONTINUOUS for it — the point of the split is that no card
   * ever visibly changes its mind mid-path.
   */
  const openPending = () => {
    if (dead || pendingOpen.size === 0) {
      return;
    }
    const elapsed = now() - sceneStart;
    const indices = [...pendingOpen].sort((a, b) => a - b);
    let cascade = 0;
    indices.forEach((i) => {
      const beat = plan.beats[i];
      const {proxy, flip} = cards[i];
      const restScale = pose[i]?.scale ?? 1;
      pendingOpen.delete(i);
      const tl = gsap.timeline();
      timelines.push(tl);
      const finish = () => {
        fireFace(i);
        maybeSettle();
      };
      if (reduced) {
        tl.to(flip, {rotateY: 0, duration: s(t.turnMs), ease: 'power2.out'}, s(cascade * t.holdRevealStepMs));
        tl.call(finish);
        cascade++;
        return;
      }
      if (elapsed < beat.flipWindowEndsMs) {
        // STILL EARLY ENOUGH: the card simply continues into the very turn it
        // would have played anyway, on the rest of its own trajectory. There
        // is no seam because nothing changes except that the turn now happens.
        // The duration is trimmed to the travel that is actually LEFT, so the
        // turn still completes before the landing phase; and the turn does NOT
        // take the scale channel, which the flight leg is still driving.
        const remaining = Math.max(0, beat.landAtMs - elapsed);
        addPremiumTurn(tl, {
          proxy, flip,
          at: 0,
          dur: Math.min(s(beat.flipMs), Math.max(s(160), s(remaining) * 0.9)),
          poseScale: restScale,
          push: t.turnPush,
          glintClass: DEAL_TURN_GLINT,
          settleScale: false,
          onFaceShown: () => fireFace(i),
        });
        tl.call(maybeSettle);
        return;
      }
      // ALREADY COMMITTED TO ITS SLOT: it opens where it stands, in a short
      // cascade — the honest resolution of an honest wait.
      const at = Math.max(0, (beat.landAtMs + t.settleMs - elapsed)) / 1000 + s(cascade * t.holdRevealStepMs);
      addPremiumTurn(tl, {
        proxy, flip,
        at,
        dur: s(t.turnMs),
        poseScale: restScale,
        push: t.turnPush,
        glintClass: DEAL_TURN_GLINT,
        onFaceShown: () => fireFace(i),
      });
      tl.call(finish, undefined, at + s(t.turnMs));
      cascade++;
    });
  };

  // In the normal mode nothing owes an opening — the turns already ride the
  // flight timelines, so `landedAll` alone will settle the scene.
  safety = window.setTimeout(fireSettled, SAFETY_MS);

  return {
    plan,
    notifyPayload: () => {
      if (payloadReady) {
        return;
      }
      payloadReady = true;
      openPending();
    },
    kill: () => {
      dead = true;
      window.clearTimeout(safety);
      timelines.forEach((tl) => tl.kill());
      cards.forEach(({proxy}) => proxy.classList.remove(DEAL_TURN_GLINT));
    },
  };
}

/**
 * THE HANDOFF — the landed proxies give way to the REAL cards.
 *
 * The batch lands on the very slots the real surface will use (the stage is
 * prepared before anything moves), so this leg is normally a zero-distance
 * cross-over: the real card is held invisible while its proxy sits on its
 * exact rect, the two swap in one flush, and no frame shows either a double
 * card or an empty slot. When a target has moved a little (a profile re-fit
 * between the beat and the surface), the proxy TRAVELS the remainder rather
 * than teleporting — the same discipline `settleRevealProxyOnto` established
 * for the single-card case, generalized to a batch.
 *
 * `onDone` always fires exactly once, so a caller can rely on it to release
 * the flight layer.
 */
export function settleBatchProxiesOnto(args: {
  pairs: ReadonlyArray<{proxy: HTMLElement, target: HTMLElement | null | undefined}>,
  onDone: () => void,
}): void {
  const {pairs, onDone} = args;
  let done = false;
  const held: Array<HTMLElement> = [];
  const finish = () => {
    if (done) {
      return;
    }
    done = true;
    held.forEach((el) => el.classList.remove('con-deal-hold'));
    onDone();
  };
  const live: Array<{proxy: HTMLElement, target: HTMLElement}> = [];
  pairs.forEach((p) => {
    if (p.target !== null && p.target !== undefined) {
      live.push({proxy: p.proxy, target: p.target});
      p.target.classList.add('con-deal-hold');
      held.push(p.target);
    }
  });
  // A proxy with NO real counterpart (the promised count turned out larger
  // than what the server actually drew — only reachable on the predicted-count
  // path) leaves the way a card leaves: it fades where it stands rather than
  // being unmounted out of existence mid-frame.
  if (typeof window !== 'undefined') {
    pairs.filter((p) => p.target === null || p.target === undefined)
      .forEach((p) => gsap.to(p.proxy, {autoAlpha: 0, duration: s(140), ease: 'power1.in'}));
  }
  if (typeof window === 'undefined' || live.length === 0 || consoleReducedMotionActive()) {
    finish();
    return;
  }
  // ⚠️ WAIT FOR A STABLE RECT. The surface that takes the zone is still
  // ENTERING when this runs (its own frame transition, then the row's fit
  // pass), so a first measurement can be a rect that is itself still moving.
  // Two identical consecutive frames mean the layout has settled — the same
  // idiom the hand intake uses before it aims at a dock slot.
  const POLL_FRAMES = 40;
  let frames = 0;
  let prev = '';
  const aim = (): void => {
    if (done) {
      return;
    }
    const rects = live.map((p) => p.target.getBoundingClientRect());
    const sig = rects.map((r) => `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}`).join('|');
    if (rects.every((r) => r.width >= 10) && sig === prev) {
      let pending = live.length;
      const one = () => {
        pending--;
        if (pending <= 0) {
          finish();
        }
      };
      live.forEach((p, i) => {
        const r = rects[i];
        gsap.to(p.proxy, {
          x: r.left, y: r.top, scale: Math.max(0.05, r.width / CARD_NATURAL_W),
          // `rotation` too — the deck-draw assemble has always zeroed it here.
          // The travel leg normally lands it at 0, but an interrupted or
          // re-timed flight can leave a residual tilt that then survives the
          // handoff and rests, crooked, in a slot that is perfectly square.
          rotation: 0,
          duration: s(190), ease: 'power3.inOut', onComplete: one,
        });
      });
      window.setTimeout(finish, motionMs(190) + 400);
      return;
    }
    prev = sig;
    frames++;
    if (frames > POLL_FRAMES) {
      // Never chase forever: hand over in place rather than travel to a rect
      // that refuses to settle.
      finish();
      return;
    }
    requestAnimationFrame(aim);
  };
  requestAnimationFrame(aim);
}
