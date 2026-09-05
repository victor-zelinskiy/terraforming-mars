/*
 * startDockMotion — THE CARD FLIGHT CORE of the Game Start Workspace.
 *
 * One physical grammar for every start-flow transfer (collect / return /
 * summary reveal / summary stow / queue re-seat / extra-prelude arrival),
 * written as a TABLETOP gesture — a hand takes a card, carries it, and lays
 * it down — never an arcade throw:
 *
 *   0. IMPULSE — the press answers IN THE SAME FRAME: the card compresses
 *      against the table (it is being pressed before it is picked up) and
 *      immediately releases into the take. This is the whole «instant
 *      response» budget; nothing textual is ever swapped for it.
 *   1. TAKE — the card rises TOWARD THE VIEWER in place: a small lift, a
 *      few percent of growth, a whisper of tilt, the shadow deepens. The
 *      take is readable AT THE SOURCE before anything travels.
 *   2. CARRY — one soft glide along a LOW arc (a gentle sag of a straight
 *      line, never a parabola over the screen), eased power2.inOut — the
 *      card accelerates gently and brakes gently, no launch snap, no hard
 *      stop. Scale approaches the destination footprint THROUGH the carry;
 *      the TURN (`Card3DInner`) rides the heart of the same path, so «fly»
 *      and «turn over» are one gesture and not two chained beats.
 *   3. LAY — the last stretch of the same glide IS the lowering: the card
 *      settles into the exact target box (pixel coordinates, never "toward
 *      the area"), the shadow collapses to a contact line, and the PILE
 *      ANSWERS — a small physical press of the stack under the new weight.
 *   4. HANDOFF — the real DOM back/tile paints under the proxy on one
 *      frame; the proxy is removed on the NEXT one. Never a crossfade:
 *      the two are pixel-identical, so a fade can only ever expose the
 *      difference between them (the proxy's shadow, its rounding) — which
 *      is exactly what read as a flicker.
 *
 * ── THE TWO STRUCTURAL RULES THIS MODULE EXISTS TO KEEP ──────────────────
 *
 * ① BATCH OWNERSHIP. A flight owns ITS OWN proxies and disposes only those.
 *    The old code cleared the WHOLE layer at the end of every convoy, so a
 *    combined transition (the projects gliding grid → summary WHILE the
 *    earlier piles open into theirs) had two convoys sharing one layer: the
 *    shorter one finished first, wiped the layer, and every still-airborne
 *    card of the longer one lost its body — while its timeline kept running
 *    and kept firing per-card `onDock`s. The visible result was precisely
 *    «the first cards fly, the last ones pop into place one by one», and it
 *    got worse the more projects were bought (the longer that convoy is
 *    relative to the pile one). There is no card cap anywhere in this file
 *    and no instant-placement path: EVERY card flies.
 *
 * ② MEASURED DESTINATIONS, NEVER GUESSED ONES. A flight is only ever built
 *    against rects that have already been measured on a settled layout
 *    (`measureTargets` + the host's prewarm), and it re-reads its
 *    destination ONCE near the end of the carry, applying the difference as
 *    a ramped correction — so a late re-flow (a fit engine settling, an art
 *    decoding) can no longer land a card next to its slot.
 *
 * Ownership honesty: pile COUNTS follow the physical cards (dockDrift) —
 * a back never appears before its card lands, and never remains after its
 * card left. DOM/GSAP only; the host owns state and calls these around its
 * own stage changes. Every entry point resolves (guarded budgets,
 * degenerate-geometry fallbacks) — a lost element can never wedge the flow.
 */
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {restingRectOf} from '@/client/console/cardFlight/landingRect';
import {
  addCard3DTurn, buildCard3DInner, Card3DInner, CARD3D_SHADOW, FACE_UP_DEG,
  readCard3DInner, setCard3DFace,
} from '@/client/console/cardFlight/card3dInner';

export type DockFlightSource = {name: CardName, el: HTMLElement};

export type Rect = {x: number, y: number, w: number, h: number};

/**
 * Flight timing (ms @ motion scale 1) — deliberate, never abrupt.
 *
 * The budget is spent where the eye needs it: the PRESS is the response and
 * must be under the "did it hear me" threshold; the TAKE is short (the card
 * is already travelling by the time it finishes rising — the carry's first
 * third blends the residual lift out, so take+carry read as one gesture); the
 * CARRY is the only long number, because it is the part the player actually
 * follows.
 */
const IMPULSE_MS = 44;
const TAKE_MS = 150;
const CARRY_MS = 700;
const SETTLE_MS = 150;
/** Convoy spacing — uniform speed, deliberate rhythm (never a race). */
const STAGGER_MS = 95;
/** Re-seats reposition rather than take — a lighter grip. */
const RESEAT_TAKE_MS = 150;
const RESEAT_CARRY_MS = 640;
/** The pile's physical answer to a landing card (px @ uiScale 1). */
export const DOCK_PRESS_PX = 2;

let layerEl: HTMLElement | undefined;

/** The scene mounts ONE fixed proxy layer and registers it here. */
export function registerStartDockLayer(el: HTMLElement | undefined): void {
  layerEl = el ?? undefined;
}

function rectOf(el: HTMLElement | null | undefined): Rect | undefined {
  const r = el?.getBoundingClientRect?.();
  return r !== undefined && r.width > 4 && r.height > 4 ?
    {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

/**
 * The rect a LANDING element will occupy at rest. A start-flow destination is
 * routinely measured while it (or the zone above it — the embed seat, the
 * queue, a descend stage) is still running its own entry translate; aiming a
 * carry at the mid-entry rect is what landed cards 9–18 px off and snapped
 * them at the handoff. Sources stay `rectOf` (raw): a proxy is born over the
 * pixels the player currently sees.
 */
function restingRectOfEl(el: HTMLElement | null | undefined): Rect | undefined {
  if (el === null || el === undefined || typeof el.getBoundingClientRect !== 'function') {
    return undefined;
  }
  const r = restingRectOf(el);
  return r.width > 4 && r.height > 4 ?
    {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

/** The measurable CARD inside a slot/tile (its padding/band would misplace
 *  and mis-size a proxy against the pixels the player actually sees). */
function cardIn(el: HTMLElement | null | undefined): HTMLElement | undefined {
  return el?.querySelector?.<HTMLElement>(':is(.card-container, .pcard)') ?? undefined;
}

/** The rect of the CARD a slot/tile hosts (falling back to the slot box). */
export function cardRectOf(el: HTMLElement | null | undefined): Rect | undefined {
  if (el === null || el === undefined) {
    return undefined;
  }
  return rectOf(cardIn(el) ?? el);
}

/** The RESTING rect of the card a slot hosts — for LANDING measurements. */
function restingCardRectOf(el: HTMLElement | null | undefined): Rect | undefined {
  if (el === null || el === undefined) {
    return undefined;
  }
  return restingRectOfEl(cardIn(el) ?? el);
}

// ── ONE FLIGHT'S PROXIES — the ownership unit (see rule ① above) ───────────

/**
 * Every proxy a single convoy spawned. Disposing a batch removes exactly its
 * own bodies and nothing else, so two convoys may share the layer and outlive
 * each other — which is the whole point.
 */
type ProxyBatch = {
  own(el: HTMLElement): void,
  dispose(): void,
};

function newBatch(): ProxyBatch {
  const owned: Array<HTMLElement> = [];
  let disposed = false;
  return {
    own(el: HTMLElement): void {
      owned.push(el);
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const el of owned) {
        gsap.killTweensOf(el);
        const card = readCard3DInner(el);
        if (card !== undefined) {
          gsap.killTweensOf(card.inner);
        }
        el.remove();
      }
      owned.length = 0;
    },
  };
}

/** The back art every start-flow flyer carries (one physical card family). */
const START_BACK_HTML = '<div class="con-card-back con-card-back--flyer"></div>';

/** Spawn one Card3DInner proxy on the layer, over `from`. */
function spawnProxy(batch: ProxyBatch, from: Rect, faceUp: boolean): Card3DInner | undefined {
  if (layerEl === undefined || !layerEl.isConnected) {
    return undefined;
  }
  const outer = document.createElement('div');
  layerEl.appendChild(outer);
  batch.own(outer);
  const card = buildCard3DInner(outer, {
    faceUp,
    backHtml: START_BACK_HTML,
    outerClass: 'con-startdock-proxy',
  });
  gsap.set(outer, {
    x: from.x, y: from.y, width: from.w, height: from.h,
    transformOrigin: '50% 50%', boxShadow: CARD3D_SHADOW.rest,
  });
  return card;
}

/** The face content: the REAL rendered face is snapshotted by cloning the
 *  source card's node — the proxy is the same pixels the slot showed (the
 *  premium face is static, so a clone is exact and costs no remount). */
function fillFace(card: Card3DInner, sourceCard: HTMLElement | undefined): void {
  if (sourceCard === undefined) {
    return;
  }
  const clone = sourceCard.cloneNode(true) as HTMLElement;
  clone.style.margin = '0';
  // THE EFFECTIVE zoom, measured — visual box ÷ layout box. The fit zoom
  // usually sits on an ANCESTOR (the strip/slot), where the card's own
  // computed `zoom` reads '1': cloning with that left the face at natural
  // size inside a zoom-sized proxy — the art filled only the top-left of the
  // flying card and snapped to full size at the handoff.
  const rect = sourceCard.getBoundingClientRect();
  const layoutW = sourceCard.offsetWidth;
  if (rect.width > 4 && layoutW > 4) {
    const eff = rect.width / layoutW;
    if (Math.abs(eff - 1) > 0.001) {
      (clone.style as unknown as {zoom: string}).zoom = String(eff);
    }
  }
  card.face.appendChild(clone);
}

function guarded(run: (done: () => void) => void, budgetMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(safety);
        resolve();
      }
    };
    const safety = window.setTimeout(done, budgetMs + 1400);
    run(done);
  });
}

/**
 * FLIGHT DURATION. Speed preset first (`motionMs`), then the SEPARATE
 * reduced-motion axis: a reduced flight is genuinely SHORTER, but it is still
 * a flight — the card still leaves its slot, still turns over, still lands in
 * the real destination. Reduced motion removes flourish, never causality (a
 * teleport would destroy the one thing the player needs to follow: which card
 * went where).
 */
function flightMs(base: number): number {
  const scaled = motionMs(base);
  return consoleReducedMotionActive() ? Math.max(80, Math.round(scaled * 0.42)) : scaled;
}

/** A tiny deterministic per-card tilt seed (±1.6°) — tabletop hands are
 *  never machine-straight, and determinism keeps replays identical. */
function tiltSeedFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return ((h % 33) - 16) / 10; // -1.6 … +1.6
}

/** THE PILE ANSWERS — a small press of the stack under the landing card.
 *  Transform-only, self-clearing; safe on any element. */
export function pressPile(el: HTMLElement | null | undefined): void {
  if (el === null || el === undefined || consoleReducedMotionActive()) {
    return;
  }
  const dy = DOCK_PRESS_PX * conUiScale();
  gsap.timeline()
    .to(el, {y: dy, duration: motionMs(70) / 1000, ease: 'power2.out', overwrite: 'auto'})
    .to(el, {y: 0, duration: motionMs(160) / 1000, ease: 'power2.inOut', clearProps: 'transform'});
}

// ── SURFACE PARKING — retire the SURFACE, never the cards ──────────────────

/**
 * RETIRE THE SURFACE, NOT THE CARDS. The cards the player did NOT take stay
 * exactly where they lie; the whole table they lie on steps back into depth
 * and dims out as ONE cached layer. Animating each unpicked card would be
 * both visual noise («why is that one leaving?») and, on a 10-card grid, ten
 * composited layers instead of one.
 *
 * Resolves on its own completion. `dir` +1 = the surface is being left going
 * FORWARD (it settles slightly away from the viewer and toward the shelf),
 * −1 = backward.
 */
export function parkSurface(el: HTMLElement | null | undefined, dir: 1 | -1 = 1): Promise<void> {
  if (el === null || el === undefined) {
    return Promise.resolve();
  }
  if (consoleReducedMotionActive()) {
    gsap.set(el, {autoAlpha: 0});
    return Promise.resolve();
  }
  gsap.killTweensOf(el);
  const ui = conUiScale();
  return new Promise<void>((resolve) => {
    gsap.to(el, {
      autoAlpha: 0,
      scale: 0.978,
      y: 6 * ui * dir,
      duration: motionMs(210) / 1000,
      ease: 'power2.in',
      transformOrigin: '50% 42%',
      onComplete: resolve,
    });
  });
}

/**
 * The parked surface comes back. A REVISITED table is the same table the
 * player left — it surfaces from just behind the glass, it never re-deals
 * and no card moves individually (`--settled` already killed the per-card
 * stagger; this is the surface's own return).
 */
export function unparkSurface(el: HTMLElement | null | undefined, dir: 1 | -1 = 1): Promise<void> {
  if (el === null || el === undefined) {
    return Promise.resolve();
  }
  if (consoleReducedMotionActive()) {
    gsap.set(el, {clearProps: 'opacity,visibility,transform'});
    return Promise.resolve();
  }
  gsap.killTweensOf(el);
  const ui = conUiScale();
  return new Promise<void>((resolve) => {
    gsap.fromTo(el,
      {autoAlpha: 0, scale: 0.99, y: 7 * ui * dir, transformOrigin: '50% 38%'},
      {
        autoAlpha: 1, scale: 1, y: 0,
        duration: motionMs(230) / 1000,
        ease: 'power3.out',
        onComplete: () => {
          // The pane must end up with NO inline transform: a residual matrix
          // on an ancestor makes every rect measured inside it (focus scroll,
          // a later flight's targets) subtly wrong.
          gsap.set(el, {clearProps: 'opacity,visibility,transform,transformOrigin'});
          resolve();
        },
      });
  });
}

/** Drop any parking transform without motion (abort / unmount / prewarm). */
export function clearSurfaceParking(el: HTMLElement | null | undefined): void {
  if (el !== null && el !== undefined) {
    gsap.killTweensOf(el);
    gsap.set(el, {clearProps: 'opacity,visibility,transform,transformOrigin'});
  }
}

// ── the ONE flight primitive — TAKE · CARRY · LAY · HANDOFF ────────────────

type FlightOpts = {
  /** Flip target (deg): 0 = land face-up, 180 = land face-down. */
  flipTo?: number,
  /** Timeline offset (s). */
  at?: number,
  /** A re-seat repositions (lighter grip, no flip drama). */
  reseat?: boolean,
  /** Deterministic tilt seed (deg). */
  tilt?: number,
  /** The pile/stack element that physically ANSWERS the landing. */
  pressEl?: HTMLElement | null,
  /** Re-read this element near the end of the carry and correct onto it. */
  retarget?: () => Rect | undefined,
  /** Fired the moment the card touches down (the stable contact frame). */
  onDock?: () => void,
  /** Fired when the card LEAVES its source (end of the take). */
  onRelease?: () => void,
};

/** One animation frame (the honest "let the layout settle" wait). */
function frame(): Promise<void> {
  return new Promise<void>((r) => (typeof requestAnimationFrame === 'function' ?
    requestAnimationFrame(() => r()) : setTimeout(r, 16)));
}

/**
 * THE HANDOFF — one frame, one owner (§EXACT HANDOFF CONTRACT).
 *
 * The proxy stands at the destination's exact geometry, in the destination's
 * exact rotation, carrying a contact shadow that matches the destination's
 * own. `reveal()` paints the real element UNDER it; the proxy is removed on
 * the NEXT animation frame — never faded.
 *
 * Why not a crossfade: a fade makes the two copies visible AS TWO for its
 * whole duration, and everything that differs between a proxy and a real
 * slot (shadow, rounding, the focus ring the slot is about to grow) shows up
 * during it. Why not "hide, then reveal": that is a blank frame. Two frames
 * of pixel-identical double is the only combination with neither artefact.
 */
function handoff(outer: HTMLElement, reveal: (() => void) | undefined): void {
  reveal?.();
  if (typeof requestAnimationFrame !== 'function') {
    outer.style.visibility = 'hidden';
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    outer.style.visibility = 'hidden';
  }));
}

/**
 * Fly one proxy from where it stands to `to` — take → carry (low-arc glide,
 * the turn through the heart) → lay + pile press → handoff. Added onto `tl`.
 */
function addFlight(tl: gsap.core.Timeline, card: Card3DInner, from: Rect, to: Rect, opts: FlightOpts): void {
  const proxy = card.outer;
  const at = opts.at ?? 0;
  const reduced = consoleReducedMotionActive();
  const take = flightMs(opts.reseat === true ? RESEAT_TAKE_MS : TAKE_MS) / 1000;
  const settle = flightMs(SETTLE_MS) / 1000;
  const ui = conUiScale();
  const flipFrom = Number(gsap.getProperty(card.inner, 'rotationY')) || 0;
  const flipTo = opts.flipTo ?? flipFrom;
  const tilt = opts.reseat === true ? 0 : (opts.tilt ?? 0);

  // Endpoints are CENTRES; the proxy's own x/y is its top-left at FROM size.
  const s = {x: from.x + from.w / 2, y: from.y + from.h / 2};
  const t = {x: to.x + to.w / 2, y: to.y + to.h / 2};
  const targetScale = to.w / Math.max(1, from.w);
  const takeScale = opts.reseat === true ? 1.015 : 1.035;
  const takeLift = (opts.reseat === true ? 0.03 : 0.05) * from.h;

  // THE LOW ARC — a straight line with a gentle upward sag, never a lob:
  // the peak rises 6% of the distance, capped at ~46 logical px. A tabletop
  // carry stays close to the table.
  const dist = Math.hypot(t.x - s.x, t.y - s.y);
  const sag = Math.min(dist * 0.06, 46 * ui);
  // A SHORT hop takes less time than a long one — a carry whose duration is
  // constant reads as slow motion when the shelf is two hand-widths away and
  // as a throw when the summary is across the screen. The reference distance
  // is roughly half a 1080p diagonal.
  const carry = flightMs((opts.reseat === true ? RESEAT_CARRY_MS : CARRY_MS) *
    Math.max(0.68, Math.min(1.16, 0.62 + dist / (1100 * ui)))) / 1000;
  const midX = (s.x + t.x) / 2;
  const midY = (s.y + t.y) / 2 - sag;
  // Quadratic Bézier through the sagged midpoint (control = 2M - (S+T)/2).
  const c = {x: 2 * midX - (s.x + t.x) / 2, y: 2 * midY - (s.y + t.y) / 2};
  const pointAt = (p: number) => {
    const inv = 1 - p;
    return {
      x: inv * inv * s.x + 2 * inv * p * c.x + p * p * t.x,
      y: inv * inv * s.y + 2 * inv * p * c.y + p * p * t.y,
    };
  };

  // THE LATE RE-READ. One rect read per card, at 80% of the carry, applied as
  // a correction that ramps 0 → 1 over the remaining fifth: the path stays
  // continuous (no jump at the moment of reading) and the LANDING is exact
  // even if the destination re-flowed after the flight was planned.
  const corr = {x: 0, y: 0, scale: 0};
  const RETARGET_AT = 0.8;

  // 1) TAKE — toward the viewer, in place (the grip is readable at the source).
  // `overwrite: 'auto'` so a press/lift the host already started (the impulse
  // that answered the button) is taken over rather than fought over.
  tl.to(proxy, {
    y: from.y - takeLift,
    scale: takeScale,
    rotationZ: tilt,
    boxShadow: CARD3D_SHADOW.lifted,
    duration: take,
    ease: 'power2.out',
    overwrite: 'auto',
  }, at);
  if (opts.onRelease !== undefined) {
    tl.call(opts.onRelease, undefined, at + take);
  }

  // 2) CARRY — ONE eased glide: position, scale and tilt share the same soft
  // power2.inOut clock, so nothing ever snaps or races. The TURN is layered
  // on the same timeline (below) instead of being driven from here: it is a
  // property of the card body, not of the path.
  const drive = {q: 0};
  const liftedY = from.y - takeLift;
  tl.to(drive, {
    q: 1,
    duration: carry,
    ease: 'power2.inOut',
    onUpdate: () => {
      const p = drive.q;
      const pt = pointAt(p);
      // The footprint approaches its destination smoothly across the WHOLE
      // carry — the card is being brought somewhere, never snap-shrunk.
      const k = p * p * (3 - 2 * p);
      const scale = takeScale + (targetScale - takeScale) * k;
      // The residual take-lift blends out over the first third.
      const liftBlend = p >= 0.33 ? 0 : 1 - p / 0.33;
      // The correction ramps in only over the final fifth.
      const cw = p <= RETARGET_AT ? 0 : (p - RETARGET_AT) / (1 - RETARGET_AT);
      gsap.set(proxy, {
        x: pt.x - from.w / 2 + corr.x * cw,
        y: pt.y - from.h / 2 + liftBlend * (liftedY - from.y) + corr.y * cw,
        scale: scale + corr.scale * cw,
        // The tilt breathes through the middle and squares out by 85%.
        rotationZ: tilt * (p < 0.85 ? Math.cos(p * Math.PI * 0.5) : 0),
      });
    },
  }, at + take);

  if (opts.retarget !== undefined) {
    const retarget = opts.retarget;
    tl.call(() => {
      const live = retarget();
      if (live === undefined) {
        return;
      }
      const lt = {x: live.x + live.w / 2, y: live.y + live.h / 2};
      corr.x = lt.x - t.x;
      corr.y = lt.y - t.y;
      corr.scale = live.w / Math.max(1, from.w) - targetScale;
    }, undefined, at + take + carry * RETARGET_AT);
  }

  // THE TURN — `Card3DInner` owns it, and it rides the HEART of the carry
  // (28% → 76%): the card leaves face-first, passes through its own edge in
  // mid-air, and arrives already showing the side it will lie on. A turn that
  // waited for the landing would be a face swap on a resting card, which is
  // the artefact this whole module exists to remove.
  if (flipTo !== flipFrom) {
    const turnAt = at + take + carry * 0.24;
    const turnDur = Math.max(0.12, carry * (reduced ? 0.3 : 0.52));
    addCard3DTurn(tl, {
      card,
      at: turnAt,
      dur: turnDur,
      to: flipTo,
      from: flipFrom,
      reduced,
      // A carried card is held closer to the table than a dealt one: the
      // depth push is restrained so the turn reads without theatre.
      push: 26 * ui,
      pitch: opts.reseat === true ? 7 : 12,
      glintClass: 'con-deal-proxy--revealing',
    });
  }

  // The shadow collapses to a contact line through the approach — and STAYS
  // there: the destination's own resting shadow is the same family, so the
  // handoff transfers it without a step (a fade to none blinked instead).
  tl.to(proxy, {
    boxShadow: CARD3D_SHADOW.contact,
    duration: carry * 0.32,
  }, at + take + carry * 0.68);

  // 3) LAY — contact: the pile answers under the weight, the card presses
  // and squares. The PROXY is the only visible owner through the whole
  // settle — the real element appears strictly AFTER it (see 4).
  if (opts.pressEl !== undefined && opts.pressEl !== null) {
    const pressEl = opts.pressEl;
    tl.call(() => pressPile(pressEl), undefined, at + take + carry);
  }
  tl.to(proxy, {
    scale: () => targetScale + corr.scale - 0.012,
    duration: settle * 0.4,
    ease: 'power2.out',
  }, at + take + carry);
  tl.to(proxy, {
    scale: () => targetScale + corr.scale,
    duration: settle * 0.6,
    ease: 'power2.inOut',
  }, at + take + carry + settle * 0.4);

  // 4) HANDOFF — see `handoff()`.
  tl.call(() => handoff(proxy, opts.onDock), undefined, at + take + carry + settle);
}

/**
 * The per-card STAGGER of a convoy. A convoy is a physical queue, so it may
 * take longer when there are more cards — but a 12-card buy at the full
 * per-card stagger would deal for over a second before the last card even
 * lifts, and the tail reads as a separate, slower event. The spread is
 * COMPRESSED as the batch grows (never below a beat that still reads as
 * one-after-another), so the whole convoy stays one continuous gesture.
 *
 * ADAPTIVE, NEVER TRUNCATING. The compression curve is deliberately gentle
 * enough that a 15-card set still reads as fifteen separate objects — the
 * alternative («animate the first N, place the rest») is the one thing this
 * module forbids.
 */
export function staggerFor(count: number): number {
  const n = Math.max(1, count - 1);
  // Total spread grows with the batch but sub-linearly: 4 cards ≈ 285 ms,
  // 10 ≈ 585 ms, 15 ≈ 770 ms, 20 ≈ 900 ms — the tail stays part of the same
  // gesture instead of becoming a second, slower event.
  const spread = Math.min(900, 300 + n * 32);
  return Math.max(38, Math.min(STAGGER_MS, Math.round(spread / n)));
}

/** Total budget of one staggered flight batch (ms). */
function batchBudget(count: number, reseat = false): number {
  const take = reseat ? RESEAT_TAKE_MS : TAKE_MS;
  const carry = reseat ? RESEAT_CARRY_MS : CARRY_MS;
  return flightMs(take + carry + SETTLE_MS + staggerFor(count) * Math.max(0, count - 1)) + 600;
}

/**
 * The beats of a CAPTURED convoy (the `flyTo` grammar, which flies `reseat`):
 * `arriving` — the first card is deep in its carry, the convoy is visibly
 * near home; `landed` — the last card has settled. A host that must time
 * something AGAINST the flight (a shell entrance, a chrome reveal) reads
 * these instead of copying the constants and drifting from them.
 */
export function convoyBeats(count: number): {arriving: number, landed: number} {
  const n = Math.max(1, count);
  return {
    arriving: flightMs(RESEAT_TAKE_MS + RESEAT_CARRY_MS * 0.74),
    landed: flightMs(RESEAT_TAKE_MS + RESEAT_CARRY_MS + SETTLE_MS + staggerFor(n) * (n - 1)),
  };
}

/** The live flight proxies (empty once every batch has been disposed). */
export function liveFlightProxies(): ReadonlyArray<HTMLElement> {
  return layerEl === undefined ? [] :
    Array.from(layerEl.querySelectorAll<HTMLElement>('.con-startdock-proxy'));
}

/**
 * MEASURE a set of destinations on a settled layout. Polls until every name
 * resolves to a real box (a big grid lays out over several frames — the fit
 * engine re-zooms, arts decode), and reports what is still missing so the
 * caller can decide BEFORE anything moves. Nothing here ever "gives up into"
 * an instant placement: measuring is a precondition of the transition, not a
 * step inside it.
 */
export async function measureTargets(
  names: ReadonlyArray<CardName>,
  targetFor: (name: CardName) => HTMLElement | null,
  maxFrames = 40,
): Promise<{rects: Map<CardName, Rect>, missing: ReadonlyArray<CardName>}> {
  const rects = new Map<CardName, Rect>();
  let missing: Array<CardName> = [...names];
  for (let i = 0; i <= maxFrames && missing.length > 0; i++) {
    const still: Array<CardName> = [];
    for (const name of missing) {
      // RESTING: these are landings — a slot measured mid-entry must yield
      // the rect it will settle on, or the whole carry aims short.
      const r = restingCardRectOf(targetFor(name));
      if (r === undefined) {
        still.push(name);
      } else {
        rects.set(name, r);
      }
    }
    missing = still;
    if (missing.length > 0 && i < maxFrames) {
      await frame();
    }
  }
  return {rects, missing};
}

// ── COLLECT: grid slots → a dock pile ───────────────────────────────────────
//
// (There is no separate collect entry point any more. A collect is a CAPTURE
// followed by a flyTo onto the pile — the same two calls every other transfer
// makes — because the host must be able to answer the button BEFORE the
// flight is planned, and to retire the surface underneath the cards while
// they travel. A self-contained `collectToDock` could do neither: it spawned
// its proxies and started its timeline in one call, which is why the stage
// commit had to be smuggled into its `onCovered` callback — i.e. at t = 0,
// which is exactly the ordering bug this rework removes.)

// ── RETURN / REVEAL: a pile → target slots (face-up) ────────────────────────

/**
 * Cards fly OUT of a pile into their target slots, turning face-up through
 * the carry. The targets stay held (invisible) under the proxies; `onDepart`
 * fires per card as it LEAVES the pile (the pile physically empties);
 * `onLanded` fires per card at its touchdown — the host reveals that slot in
 * the same frame (proxy → real card, pixel-true).
 */
export async function returnFromDock(
  names: ReadonlyArray<CardName>,
  pileEl: HTMLElement | null | undefined,
  slotFor: (name: CardName) => HTMLElement | null,
  onLanded?: (name: CardName) => void,
  onDepart?: (name: CardName) => void,
): Promise<void> {
  const pile = rectOf(pileEl);
  const targets = names
    .map((name) => {
      const slot = slotFor(name);
      const card = cardIn(slot);
      // `to` is a LANDING → resting rect (the slot may still be entering).
      return {name, slot, to: restingRectOfEl(card ?? slot ?? undefined), card};
    })
    .filter((t): t is typeof t & {to: Rect} => t.to !== undefined);
  if (pile === undefined || targets.length === 0 || layerEl === undefined) {
    names.forEach((n) => {
      onDepart?.(n);
      onLanded?.(n);
    });
    return;
  }
  const batch = newBatch();
  // The proxy is born at the TARGET's natural size, scaled down into the
  // pile — its outbound carry simply scales back to 1 (pixel-true landing).
  const proxies = targets.map((t) => {
    const born = {x: pile.x + pile.w / 2 - t.to.w / 2, y: pile.y + pile.h / 2 - t.to.h / 2, w: t.to.w, h: t.to.h};
    const p = spawnProxy(batch, born, false);
    if (p !== undefined) {
      fillFace(p, t.card);
      gsap.set(p.outer, {scale: pile.w / Math.max(1, t.to.w)});
    }
    return p;
  });
  await guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    targets.forEach((t, i) => {
      const card = proxies[i];
      if (card === undefined) {
        onDepart?.(t.name);
        onLanded?.(t.name);
        return;
      }
      const at = (flightMs(staggerFor(targets.length)) * i) / 1000;
      const born: Rect = {
        x: pile.x + pile.w / 2 - t.to.w / 2,
        y: pile.y + pile.h / 2 - t.to.h / 2,
        w: t.to.w, h: t.to.h,
      };
      // Leaving lightens the pile — a small counter-press upward.
      tl.call(() => pressPile(pileEl instanceof HTMLElement ? pileEl : undefined), undefined, at);
      addFlight(tl, card, born, t.to, {
        at,
        flipTo: FACE_UP_DEG,
        tilt: tiltSeedFor(t.name),
        retarget: () => restingCardRectOf(t.slot),
        onRelease: () => onDepart?.(t.name),
        onDock: () => onLanded?.(t.name),
      });
    });
  }, batchBudget(targets.length));
  batch.dispose();
}

// ── RISE: shelf tiles → stage seats (face-up, grows through the take) ───────

export type RisePair = {name: CardName, fromEl: HTMLElement, toEl: HTMLElement};

export type RiseConvoy = {
  /** Every card has settled (or the convoy degraded honestly). */
  settled: Promise<void>,
  /** Teardown mid-convoy (mode flip under the flight) — drops ONLY this
   *  convoy's proxies; per-card callbacks already fired stay fired. */
  dispose(): void,
};

/**
 * Cards RISE from their small shelf tiles into large stage seats (the legacy
 * overview's descend) — the `returnFromDock` grammar per-tile: the proxy is
 * born at the SEAT's natural size scaled down onto the tile and its face is
 * cloned from the SEAT's own card, so the raster is crisp where the flight
 * ENDS (a tile-size raster upsampled ~6× smeared exactly at the touchdown);
 * the take is the familiar bloom toward the viewer, the tile answers the
 * grip with the pile counter-press, and the carry/lay/handoff are the ONE
 * shared `addFlight`. `onDepart` fires as a card leaves its tile (the host
 * empties that tile then); `onLanded` at its touchdown (the host reveals the
 * seat in the same frame).
 */
export function riseToSeats(
  pairs: ReadonlyArray<RisePair>,
  onLanded?: (name: CardName) => void,
  onDepart?: (name: CardName) => void,
): RiseConvoy {
  const live = pairs
    .map((p) => ({
      name: p.name,
      from: cardRectOf(p.fromEl),
      // A LANDING → resting rect (the stage may still be running its rise).
      to: restingCardRectOf(p.toEl),
      fromEl: p.fromEl,
      toEl: p.toEl,
      card: cardIn(p.toEl),
    }))
    .filter((p): p is typeof p & {from: Rect, to: Rect} => p.from !== undefined && p.to !== undefined)
    // Reading order of the DESTINATIONS — the stage assembles left-to-right.
    .sort((a, b) => (a.to.y - b.to.y) || (a.to.x - b.to.x));
  if (live.length === 0 || layerEl === undefined) {
    pairs.forEach((p) => {
      onDepart?.(p.name);
      onLanded?.(p.name);
    });
    return {settled: Promise.resolve(), dispose: () => undefined};
  }
  // A pair with no measurable end resolves honestly (it reveals in place) —
  // and it is a BUG, not a mode: the seat/tile should have been measurable.
  for (const p of pairs) {
    if (!live.some((l) => l.name === p.name)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[start-flight] «${p.name}» has no measurable rise end — revealed in place.`);
      }
      onDepart?.(p.name);
      onLanded?.(p.name);
    }
  }
  const batch = newBatch();
  const proxies = live.map((t) => {
    // Born at the SEAT's size, scaled down over the tile (pixel-true source
    // cover, crisp landing) — the same trick `returnFromDock` plays.
    const born: Rect = {
      x: t.from.x + t.from.w / 2 - t.to.w / 2,
      y: t.from.y + t.from.h / 2 - t.to.h / 2,
      w: t.to.w, h: t.to.h,
    };
    const p = spawnProxy(batch, born, true);
    if (p !== undefined) {
      fillFace(p, t.card);
      gsap.set(p.outer, {scale: t.from.w / Math.max(1, t.to.w)});
    }
    return p;
  });
  const settled = guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    live.forEach((t, i) => {
      const card = proxies[i];
      if (card === undefined) {
        onDepart?.(t.name);
        onLanded?.(t.name);
        return;
      }
      const at = (flightMs(staggerFor(live.length)) * i) / 1000;
      const born: Rect = {
        x: t.from.x + t.from.w / 2 - t.to.w / 2,
        y: t.from.y + t.from.h / 2 - t.to.h / 2,
        w: t.to.w, h: t.to.h,
      };
      // The tile answers the grip — the counter-press of a card being taken.
      tl.call(() => pressPile(t.fromEl), undefined, at);
      addFlight(tl, card, born, t.to, {
        at,
        tilt: tiltSeedFor(t.name),
        retarget: () => restingCardRectOf(t.toEl),
        onRelease: () => onDepart?.(t.name),
        onDock: () => onLanded?.(t.name),
      });
    });
  }, batchBudget(live.length)).then(() => batch.dispose());
  return {settled, dispose: () => batch.dispose()};
}

// ── RE-SEAT: measured slots → measured slots (face-up, no pile) ─────────────

export type ReseatPair = {name: CardName, fromEl: HTMLElement, toEl: HTMLElement};

/**
 * Cards physically GLIDE between two layouts of the same workspace (the
 * summary regrouping into the deployment queue; an extra prelude joining the
 * queue). Face-up the whole way, the same take/carry/lay grammar with a
 * lighter grip; the convoy moves in reading order of its DESTINATIONS, so
 * the new layout assembles left-to-right. `onLanded` fires per card at
 * touchdown (the host reveals the target slot then).
 */
export async function reseatCards(
  pairs: ReadonlyArray<ReseatPair>,
  onLanded?: (name: CardName) => void,
): Promise<void> {
  const live = pairs
    .map((p) => ({
      name: p.name,
      from: cardRectOf(p.fromEl),
      to: cardRectOf(p.toEl),
      toEl: p.toEl,
      card: cardIn(p.fromEl),
    }))
    .filter((p): p is typeof p & {from: Rect, to: Rect} => p.from !== undefined && p.to !== undefined)
    // Reading order of the DESTINATION layout (top row first, then left→right).
    .sort((a, b) => (a.to.y - b.to.y) || (a.to.x - b.to.x));
  if (live.length === 0 || layerEl === undefined) {
    pairs.forEach((p) => onLanded?.(p.name));
    return;
  }
  const batch = newBatch();
  const proxies = live.map((p) => {
    const card = spawnProxy(batch, p.from, true);
    if (card !== undefined) {
      fillFace(card, p.card);
    }
    return card;
  });
  await guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    live.forEach((p, i) => {
      const card = proxies[i];
      if (card === undefined) {
        onLanded?.(p.name);
        return;
      }
      addFlight(tl, card, p.from, p.to, {
        at: (flightMs(staggerFor(live.length)) * i) / 1000,
        reseat: true,
        retarget: () => restingCardRectOf(p.toEl),
        onDock: () => onLanded?.(p.name),
      });
    });
  }, batchBudget(live.length, true));
  batch.dispose();
}

// ── CAPTURE → FLY: the two-phase transfer (a stage may SWAP underneath) ─────

export type FlyToOptions = {
  /** Land face-up (`FACE_UP_DEG`) or face-down (`FACE_DOWN_DEG`); omit to
   *  keep whichever side the card already shows. */
  flipTo?: number,
  /** A COLLECT is a full-weight take (the player is picking cards up); a
   *  re-seat is a lighter regrip between two layouts of the same set. */
  reseat?: boolean,
  /** The stack that physically answers each landing. */
  pressElFor?: (name: CardName) => HTMLElement | null,
};

export type CapturedFlight = {
  /** The names whose sources were measurable (a proxy carries each). */
  names: ReadonlyArray<CardName>,
  /** Names that could NOT be captured — the caller decides honestly (they
   *  are never silently teleported by this module). */
  uncaptured: ReadonlyArray<CardName>,
  /**
   * THE IMPULSE — the press answers in the same interaction frame: the cards
   * compress against the table and immediately release into the take. Nothing
   * else in the transition may run before this; resolves when the cards have
   * visibly SEPARATED from the surface (which is the earliest honest moment
   * to start retiring that surface).
   */
  impulse(accent?: CardName): Promise<void>,
  /** The rise beat alone — every card lifts slightly toward the viewer, the
   *  `accent` card (the corporation — the player's face) a notch more. */
  lift(accent?: CardName): Promise<void>,
  /** Carry every card into its slot — take/carry/lay grammar, convoy in the
   *  reading order of the DESTINATIONS. Targets must already be measurable
   *  (`measureTargets` / the host's prewarm); each landing re-reads its own
   *  destination once near touchdown, so a late re-flow cannot misplace it. */
  flyTo(targetFor: (name: CardName) => HTMLElement | null, onLanded?: (name: CardName) => void,
        opts?: FlyToOptions): Promise<void>,
  /** Abort — drop the proxies instantly (idempotent). */
  dispose(): void,
};

/**
 * CAPTURE the cards where they stand: proxies spawn over the live faces in
 * the SAME synchronous call (the host hides the originals in the same tick),
 * so the entire surface under them may then re-bound, park or unmount —
 * exactly how a stage transition retires a table under moving cards.
 */
export function captureCards(sources: ReadonlyArray<DockFlightSource>): CapturedFlight {
  const batch = newBatch();
  const live = layerEl === undefined ? [] : sources
    .map((s) => {
      const card = cardIn(s.el);
      return {name: s.name, from: cardRectOf(s.el), card};
    })
    .filter((s): s is {name: CardName, from: Rect, card: HTMLElement | undefined} => s.from !== undefined);
  const proxies = new Map<CardName, {card: Card3DInner, from: Rect}>();
  for (const s of live) {
    const p = spawnProxy(batch, s.from, true);
    if (p !== undefined) {
      fillFace(p, s.card);
      proxies.set(s.name, {card: p, from: s.from});
    }
  }
  let disposed = false;
  const allNames = sources.map((s) => s.name);
  const uncaptured = allNames.filter((n) => !proxies.has(n));

  const rise = (accent: CardName | undefined, atSec: number): void => {
    const ui = conUiScale();
    proxies.forEach(({card, from}, name) => {
      gsap.to(card.outer, {
        y: from.y - 8 * ui,
        scale: name === accent ? 1.055 : 1.03,
        boxShadow: CARD3D_SHADOW.lifted,
        duration: flightMs(180) / 1000,
        delay: atSec,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    });
  };

  return {
    names: allNames.filter((n) => proxies.has(n)),
    uncaptured,
    impulse(accent?: CardName): Promise<void> {
      if (disposed || proxies.size === 0) {
        return Promise.resolve();
      }
      const ui = conUiScale();
      // THE PRESS — the cards are pushed INTO the table before they are picked
      // up. 44 ms: below the threshold at which it reads as a delay, above the
      // one at which it reads as nothing. Deliberately NOT shortened by
      // reduced motion — this is the answer to the button, and an answer that
      // cannot be felt is the one thing reduced motion must not remove.
      const press = motionMs(IMPULSE_MS) / 1000;
      proxies.forEach(({card, from}) => {
        gsap.to(card.outer, {
          scale: 0.988,
          y: from.y + 1.5 * ui,
          boxShadow: CARD3D_SHADOW.contact,
          duration: press,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      });
      // The rise is queued behind the press and left RUNNING: the caller gets
      // its frame back as soon as the press has answered, and the cards keep
      // coming up while it prepares the destination. A flight started later
      // simply takes the rise over (`overwrite: 'auto'` on its take).
      rise(accent, press);
      return new Promise<void>((resolve) => window.setTimeout(resolve, motionMs(IMPULSE_MS)));
    },
    lift(accent?: CardName): Promise<void> {
      if (disposed || proxies.size === 0) {
        return Promise.resolve();
      }
      rise(accent, 0);
      return new Promise<void>((resolve) => window.setTimeout(resolve, flightMs(180)));
    },
    async flyTo(
      targetFor: (name: CardName) => HTMLElement | null,
      onLanded?: (name: CardName) => void,
      opts?: FlyToOptions,
    ): Promise<void> {
      if (disposed) {
        allNames.forEach((n) => onLanded?.(n));
        return;
      }
      // Targets are MEASURED, never assumed. The host is expected to have
      // prewarmed the destination layout; this poll is the safety net for a
      // late art decode, not the plan.
      const {rects} = await measureTargets(allNames, targetFor, 40);
      if (disposed) {
        return;
      }
      const flights = allNames
        .map((name) => ({name, proxy: proxies.get(name), to: rects.get(name), el: targetFor(name)}))
        .filter((f): f is typeof f & {proxy: {card: Card3DInner, from: Rect}, to: Rect} =>
          f.proxy !== undefined && f.to !== undefined)
        .sort((a, b) => (a.to.y - b.to.y) || (a.to.x - b.to.x));
      // Anything genuinely absent (no source pixels to carry, or a
      // destination that never mounted) resolves honestly — but it is a BUG,
      // not a mode: say so in dev, because the visible symptom is a card that
      // "just appears".
      for (const name of allNames) {
        if (flights.every((f) => f.name !== name)) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[start-flight] «${name}» has no ${proxies.has(name) ? 'destination' : 'source'} — ` +
              'it cannot be carried and will be revealed in place. Prewarm the destination layout before the transition.');
          }
          const p = proxies.get(name);
          if (p !== undefined) {
            handoff(p.card.outer, () => onLanded?.(name));
          } else {
            onLanded?.(name);
          }
        }
      }
      if (flights.length === 0) {
        batch.dispose();
        return;
      }
      const reseat = opts?.reseat !== false;
      await guarded((done) => {
        const tl = gsap.timeline({onComplete: done});
        flights.forEach((f, i) => {
          addFlight(tl, f.proxy.card, f.proxy.from, f.to, {
            at: (flightMs(staggerFor(flights.length)) * i) / 1000,
            reseat,
            flipTo: opts?.flipTo,
            tilt: reseat ? 0 : tiltSeedFor(f.name),
            pressEl: opts?.pressElFor?.(f.name) ?? undefined,
            retarget: () => restingCardRectOf(f.el),
            onDock: () => onLanded?.(f.name),
          });
        });
      }, batchBudget(flights.length, reseat));
      batch.dispose();
    },
    dispose(): void {
      if (!disposed) {
        disposed = true;
        batch.dispose();
      }
    },
  };
}

/** Set a captured/spawned body's side without motion (abort paths). */
export function faceProxy(card: Card3DInner, faceUp: boolean): void {
  setCard3DFace(card, faceUp);
}

/** Abort/unmount: drop every proxy on the layer (idempotent). */
export function resetStartDockMotion(): void {
  if (layerEl !== undefined) {
    layerEl.querySelectorAll<HTMLElement>('.con-startdock-proxy').forEach((el) => {
      gsap.killTweensOf(el);
      const card = readCard3DInner(el);
      if (card !== undefined) {
        gsap.killTweensOf(card.inner);
      }
    });
    layerEl.innerHTML = '';
  }
}
