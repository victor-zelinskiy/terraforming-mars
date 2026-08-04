/*
 * startDockMotion — THE CARD FLIGHT CORE of the Game Start Workspace.
 *
 * One physical grammar for every start-flow transfer (collect / return /
 * summary reveal / summary stow / queue re-seat / extra-prelude arrival),
 * built on the SAME trajectory mathematics the played-card hero flies
 * (playedHeroModel: quadratic arc + the monotone progress profile), so a
 * card moves identically wherever it travels in this workspace.
 *
 * EVERY significant transfer reads as one physical object:
 *   1. MECHANICAL LIFT — the card separates from its surface: a short rise,
 *      a few percent of growth, the shadow deepens (ease-out — the hand
 *      picked it up, it did not teleport into motion);
 *   2. RELEASE + TRAVEL — a shallow arc driven through the hero progress
 *      profile: brisk cruise, decisive brake into the target (never linear,
 *      never full speed from frame one). Scale changes THROUGH the travel —
 *      the card approaches the destination, it is never snap-shrunk. A flip
 *      (face ↔ back) rides the middle of the arc;
 *   3. LOWERING + DOCK — the last stretch settles into the exact target box,
 *      the shadow collapses to a contact line;
 *   4. SETTLE — a microscopic damped drop; the handoff to the real DOM
 *      element happens only on this stable frame.
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
import {heroPoint, heroProgressAt, HeroPathPlan} from '@/client/console/played/playedHeroModel';

export type DockFlightSource = {name: CardName, el: HTMLElement};

type Rect = {x: number, y: number, w: number, h: number};

/** Flight timing (ms @ motion scale 1) — quick, never abrupt. */
const LIFT_MS = 130;
const TRAVEL_MS = 400;
const DOCK_SETTLE_MS = 110;
const STAGGER_MS = 70;
/** Follower cards in a multi-card package travel a touch faster. */
const FOLLOWER_TRAVEL_MS = 340;
/** The pile's press when a card lands (px @ uiScale 1 — the host scales). */
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

/** Spawn one flip-chassis proxy (face + back) on the layer, over `from`. */
function spawnProxy(name: CardName, from: Rect, faceUp: boolean): HTMLElement | undefined {
  if (layerEl === undefined || !layerEl.isConnected) {
    return undefined;
  }
  const proxy = document.createElement('div');
  proxy.className = 'con-startdock-proxy';
  proxy.innerHTML =
    `<div class="con-deal-proxy__flip">` +
      `<div class="con-deal-proxy__face" data-dock-face="${name}"></div>` +
      `<div class="con-deal-proxy__back"><div class="con-card-back con-card-back--flyer"></div></div>` +
    `</div>`;
  layerEl.appendChild(proxy);
  gsap.set(proxy, {x: from.x, y: from.y, width: from.w, height: from.h, transformOrigin: '50% 50%'});
  const flip = proxy.querySelector<HTMLElement>('.con-deal-proxy__flip');
  if (flip !== null) {
    gsap.set(flip, {rotationY: faceUp ? 0 : 180});
  }
  return proxy;
}

/** The face content: the REAL rendered face is snapshotted by cloning the
 *  source card's node — the proxy is the same pixels the slot showed (the
 *  premium face is static, so a clone is exact and costs no remount). */
function fillFace(proxy: HTMLElement, sourceCard: HTMLElement | undefined): void {
  const face = proxy.querySelector<HTMLElement>('.con-deal-proxy__face');
  if (face === null || sourceCard === undefined) {
    return;
  }
  const clone = sourceCard.cloneNode(true) as HTMLElement;
  clone.style.margin = '0';
  // The slot renders the face through a CSS zoom — carry it onto the clone so
  // the proxy's first frame is the same pixels the slot showed.
  const zoom = getComputedStyle(sourceCard).zoom;
  if (zoom !== '' && zoom !== 'normal' && zoom !== '1') {
    (clone.style as unknown as {zoom: string}).zoom = zoom;
  }
  face.appendChild(clone);
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

function clearLayer(): void {
  if (layerEl !== undefined) {
    layerEl.innerHTML = '';
  }
}

// ── the ONE flight primitive ────────────────────────────────────────────────

type FlightOpts = {
  /** Flip target (deg): 0 = land face-up, 180 = land face-down. */
  flipTo?: number,
  /** Timeline offset (s). */
  at?: number,
  /** Follower cards use the shorter cruise. */
  follower?: boolean,
  /** Fired the moment the card touches down (the stable dock frame). */
  onDock?: () => void,
  /** Fired when the card LEAVES its source (end of the lift). */
  onRelease?: () => void,
};

/**
 * Fly one proxy from where it stands to `to` — lift → arc travel (hero
 * progress profile, flip mid-arc) → dock → settle. Added onto `tl`.
 */
function addFlight(tl: gsap.core.Timeline, proxy: HTMLElement, from: Rect, to: Rect, opts: FlightOpts): void {
  const at = opts.at ?? 0;
  const lift = motionMs(LIFT_MS) / 1000;
  const travel = motionMs(opts.follower === true ? FOLLOWER_TRAVEL_MS : TRAVEL_MS) / 1000;
  const settle = motionMs(DOCK_SETTLE_MS) / 1000;
  const flip = proxy.querySelector<HTMLElement>('.con-deal-proxy__flip');
  const flipFrom = flip !== null ? Number(gsap.getProperty(flip, 'rotationY')) : 0;
  const flipTo = opts.flipTo ?? flipFrom;

  // The arc: a shallow quadratic through an apex slightly above the higher
  // endpoint — same construction as the hero path, scaled to shelf hops.
  // The apex is CLAMPED to the safe viewport band: a card may crest, it may
  // never clip out of the top of the screen.
  const s = {x: from.x + from.w / 2, y: from.y + from.h / 2};
  const t = {x: to.x + to.w / 2, y: to.y + to.h / 2};
  const dist = Math.hypot(t.x - s.x, t.y - s.y);
  const arcLift = Math.min(Math.max(dist * 0.1, from.h * 0.1), from.h * 0.45);
  const apexX = s.x + (t.x - s.x) * 0.5;
  const apexY = Math.max(from.h * 0.55 + 12, Math.min(s.y, t.y) - arcLift);
  const plan: HeroPathPlan = {
    p0: s,
    c: {x: 2 * apexX - (s.x + t.x) / 2, y: 2 * apexY - (s.y + t.y) / 2},
    p1: t,
    peakTilt: 0,
    targetScale: to.w / Math.max(1, from.w),
    apexScale: 1,
  };
  const liftScale = 1.045;
  const targetScale = plan.targetScale;

  // 1) MECHANICAL LIFT — separate from the surface (ease-out, shadow grows).
  tl.to(proxy, {
    y: from.y - from.h * 0.055,
    scale: liftScale,
    boxShadow: '0 14px 30px rgba(0,0,0,0.5)',
    duration: lift,
    ease: 'power2.out',
  }, at);
  if (opts.onRelease !== undefined) {
    tl.call(opts.onRelease, undefined, at + lift);
  }

  // 2) RELEASE + TRAVEL — the arc through the shared progress profile. One
  // driver tween maps linear q → path progress, so position, scale and the
  // flip share a single speed curve (brisk cruise, decisive brake).
  const drive = {q: 0};
  const liftedY = from.y - from.h * 0.055;
  tl.to(drive, {
    q: 1,
    duration: travel,
    ease: 'none', // the profile IS the easing — heroProgressAt shapes it
    onUpdate: () => {
      const p = heroProgressAt(drive.q);
      const pt = heroPoint(plan, p);
      // Scale eases across the WHOLE travel — the card approaches its
      // destination; it is never snap-shrunk at either end.
      const k = p < 0.25 ? 0 : (p - 0.25) / 0.75;
      const scale = liftScale + (targetScale - liftScale) * (k * k * (3 - 2 * k));
      gsap.set(proxy, {
        x: pt.x - from.w / 2,
        y: pt.y - from.h / 2 + (1 - p) * (liftedY - from.y),
        scale,
      });
      if (flip !== null && flipTo !== flipFrom) {
        // The flip occupies the middle of the arc (0.25 → 0.8).
        const f = p <= 0.25 ? 0 : p >= 0.8 ? 1 : (p - 0.25) / 0.55;
        const eased = f * f * (3 - 2 * f);
        gsap.set(flip, {rotationY: flipFrom + (flipTo - flipFrom) * eased});
      }
    },
  }, at + lift);

  // 3) LOWERING + DOCK — the contact frame: shadow collapses, count may tick.
  tl.to(proxy, {
    boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
    duration: travel * 0.3,
  }, at + lift + travel * 0.7);
  if (opts.onDock !== undefined) {
    tl.call(opts.onDock, undefined, at + lift + travel);
  }

  // 4) SETTLE — a microscopic damped drop, then the invisible handoff.
  tl.to(proxy, {
    y: `+=${Math.max(1, to.h * 0.008)}`,
    duration: settle * 0.5,
    ease: 'power1.out',
  }, at + lift + travel);
  tl.to(proxy, {
    y: `-=${Math.max(1, to.h * 0.008)}`,
    duration: settle * 0.5,
    ease: 'power1.inOut',
  }, at + lift + travel + settle * 0.5);
  tl.to(proxy, {autoAlpha: 0, duration: 0.1}, at + lift + travel + settle);
}

/** Total budget of one staggered flight batch (ms). */
function batchBudget(count: number): number {
  return motionMs(LIFT_MS + TRAVEL_MS + DOCK_SETTLE_MS + STAGGER_MS * Math.max(0, count - 1)) + 400;
}

// ── COLLECT: grid slots → a dock pile (face-down) ───────────────────────────

/**
 * The selected cards fly from their slots onto the dock pile, flipping
 * face-down mid-arc. `onCovered` fires the moment every source is covered by
 * its proxy (the host may swap panes / hide the sources there); `onDock`
 * fires PER CARD at its touchdown (the pile's count grows physically);
 * resolves at the last settle.
 */
export async function collectToDock(
  sources: ReadonlyArray<DockFlightSource>,
  pileEl: HTMLElement | null | undefined,
  onCovered?: () => void,
  onDock?: (name: CardName) => void,
): Promise<void> {
  const pile = rectOf(pileEl);
  const live = sources
    .map((s) => ({name: s.name, el: s.el, from: rectOf(s.el), card: s.el.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? undefined}))
    .filter((s): s is typeof s & {from: Rect} => s.from !== undefined);
  if (pile === undefined || live.length === 0 || consoleReducedMotionActive() || layerEl === undefined) {
    onCovered?.();
    live.forEach((s) => onDock?.(s.name));
    if (live.length === 0) {
      sources.forEach((s) => onDock?.(s.name));
    }
    return;
  }
  const proxies = live.map((s) => {
    const p = spawnProxy(s.name, s.from, true);
    if (p !== undefined) {
      fillFace(p, s.card);
    }
    return p;
  });
  onCovered?.();
  await guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    proxies.forEach((proxy, i) => {
      const src = live[i];
      if (proxy === undefined) {
        onDock?.(src.name);
        return;
      }
      // Land INTO the pile box (the clone keeps its own pixels — the flight
      // scales it by WIDTH into the pile's footprint, centred on the stack).
      const fit = pile.w / Math.max(1, src.from.w);
      addFlight(tl, proxy, src.from, {
        x: pile.x + pile.w / 2 - src.from.w / 2,
        y: pile.y + pile.h / 2 - src.from.h / 2,
        w: src.from.w * fit,
        h: src.from.h * fit,
      }, {
        at: (motionMs(STAGGER_MS) * i) / 1000,
        follower: i > 0,
        flipTo: 180,
        onDock: () => onDock?.(src.name),
      });
    });
  }, batchBudget(proxies.length));
  clearLayer();
}

// ── RETURN / REVEAL: a pile → target slots (face-up) ────────────────────────

/**
 * Cards fly OUT of a pile into their target slots, flipping face-up. The
 * targets stay held (invisible) under the proxies; `onDepart` fires per card
 * as it LEAVES the pile (the pile physically empties); `onLanded` fires per
 * card at its touchdown — the host reveals that slot in the same frame
 * (proxy → real card, pixel-true).
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
      const card = slot?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? undefined;
      return {name, to: rectOf(card ?? slot ?? undefined), card};
    })
    .filter((t): t is typeof t & {to: Rect} => t.to !== undefined);
  if (pile === undefined || targets.length === 0 || consoleReducedMotionActive() || layerEl === undefined) {
    names.forEach((n) => {
      onDepart?.(n);
      onLanded?.(n);
    });
    return;
  }
  // The proxy is born at the TARGET's natural size, scaled down into the
  // pile — its outbound flight simply scales back to 1 (pixel-true landing).
  const proxies = targets.map((t) => {
    const p = spawnProxy(t.name, {x: pile.x + pile.w / 2 - t.to.w / 2, y: pile.y + pile.h / 2 - t.to.h / 2, w: t.to.w, h: t.to.h}, false);
    if (p !== undefined) {
      fillFace(p, t.card);
      gsap.set(p, {scale: pile.w / Math.max(1, t.to.w)});
    }
    return p;
  });
  await guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    targets.forEach((t, i) => {
      const proxy = proxies[i];
      if (proxy === undefined) {
        onDepart?.(t.name);
        onLanded?.(t.name);
        return;
      }
      const at = (motionMs(STAGGER_MS) * i) / 1000;
      const born: Rect = {
        x: pile.x + pile.w / 2 - t.to.w / 2,
        y: pile.y + pile.h / 2 - t.to.h / 2,
        w: t.to.w, h: t.to.h,
      };
      addFlight(tl, proxy, born, t.to, {
        at,
        follower: i > 0,
        flipTo: 0,
        onRelease: () => onDepart?.(t.name),
        onDock: () => onLanded?.(t.name),
      });
    });
  }, batchBudget(targets.length));
  clearLayer();
}

// ── RE-SEAT: measured slots → measured slots (face-up, no pile) ─────────────

export type ReseatPair = {name: CardName, fromEl: HTMLElement, toEl: HTMLElement};

/**
 * Cards physically MOVE between two layouts of the same workspace (the
 * summary regrouping into the deployment queue; an extra prelude joining the
 * queue). Face-up the whole way, same lift/travel/dock grammar. `onLanded`
 * fires per card at touchdown (the host reveals the target slot then).
 */
export async function reseatCards(
  pairs: ReadonlyArray<ReseatPair>,
  onLanded?: (name: CardName) => void,
): Promise<void> {
  const live = pairs
    .map((p) => ({
      name: p.name,
      from: rectOf(p.fromEl.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? p.fromEl),
      to: rectOf(p.toEl.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? p.toEl),
      card: p.fromEl.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? undefined,
    }))
    .filter((p): p is typeof p & {from: Rect, to: Rect} => p.from !== undefined && p.to !== undefined);
  if (live.length === 0 || consoleReducedMotionActive() || layerEl === undefined) {
    pairs.forEach((p) => onLanded?.(p.name));
    return;
  }
  const proxies = live.map((p) => {
    const proxy = spawnProxy(p.name, p.from, true);
    if (proxy !== undefined) {
      fillFace(proxy, p.card);
    }
    return proxy;
  });
  await guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    live.forEach((p, i) => {
      const proxy = proxies[i];
      if (proxy === undefined) {
        onLanded?.(p.name);
        return;
      }
      addFlight(tl, proxy, p.from, p.to, {
        at: (motionMs(STAGGER_MS) * i) / 1000,
        follower: i > 0,
        onDock: () => onLanded?.(p.name),
      });
    });
  }, batchBudget(live.length));
  clearLayer();
}

/** Abort/unmount: drop every proxy (idempotent). */
export function resetStartDockMotion(): void {
  if (layerEl !== undefined) {
    gsap.killTweensOf(layerEl.querySelectorAll('.con-startdock-proxy, .con-deal-proxy__flip'));
    clearLayer();
  }
}
