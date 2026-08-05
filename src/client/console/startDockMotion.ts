/*
 * startDockMotion — THE CARD FLIGHT CORE of the Game Start Workspace.
 *
 * One physical grammar for every start-flow transfer (collect / return /
 * summary reveal / summary stow / queue re-seat / extra-prelude arrival),
 * written as a TABLETOP gesture — a hand takes a card, carries it, and lays
 * it down — never an arcade throw:
 *
 *   1. TAKE — the card rises TOWARD THE VIEWER in place: a small lift, a
 *      few percent of growth, a whisper of tilt, the shadow deepens. The
 *      take is readable AT THE SOURCE before anything travels.
 *   2. CARRY — one soft glide along a LOW arc (a gentle sag of a straight
 *      line, never a parabola over the screen), eased power2.inOut — the
 *      card accelerates gently and brakes gently, no launch snap, no hard
 *      stop. Scale approaches the destination footprint THROUGH the carry;
 *      the flip (face ↔ back) turns through the heart of the path with a
 *      slight page-turn pitch; the tilt breathes and squares out before
 *      arrival.
 *   3. LAY — the last stretch of the same glide IS the lowering: the card
 *      settles into the exact target box (pixel coordinates, never "toward
 *      the area"), the shadow collapses to a contact line, and the PILE
 *      ANSWERS — a small physical press of the stack under the new weight.
 *   4. HANDOFF — the real DOM back/tile appears under the proxy on the
 *      stable contact frame; the proxy releases above it.
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

export type DockFlightSource = {name: CardName, el: HTMLElement};

type Rect = {x: number, y: number, w: number, h: number};

/** Flight timing (ms @ motion scale 1) — deliberate, never abrupt. */
const TAKE_MS = 220;
const CARRY_MS = 780;
const SETTLE_MS = 150;
/** Convoy spacing — uniform speed, deliberate rhythm (never a race). */
const STAGGER_MS = 95;
/** Re-seats reposition rather than take — a lighter grip. */
const RESEAT_TAKE_MS = 160;
const RESEAT_CARRY_MS = 680;
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

// ── the ONE flight primitive — TAKE · CARRY · LAY ───────────────────────────

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
  /** Fired the moment the card touches down (the stable contact frame). */
  onDock?: () => void,
  /** Fired when the card LEAVES its source (end of the take). */
  onRelease?: () => void,
};

/**
 * Fly one proxy from where it stands to `to` — take → carry (low-arc glide,
 * flip through the heart) → lay + pile press → handoff. Added onto `tl`.
 */
function addFlight(tl: gsap.core.Timeline, proxy: HTMLElement, from: Rect, to: Rect, opts: FlightOpts): void {
  const at = opts.at ?? 0;
  const take = motionMs(opts.reseat === true ? RESEAT_TAKE_MS : TAKE_MS) / 1000;
  const carry = motionMs(opts.reseat === true ? RESEAT_CARRY_MS : CARRY_MS) / 1000;
  const settle = motionMs(SETTLE_MS) / 1000;
  const ui = conUiScale();
  const flip = proxy.querySelector<HTMLElement>('.con-deal-proxy__flip');
  const flipFrom = flip !== null ? Number(gsap.getProperty(flip, 'rotationY')) : 0;
  const flipTo = opts.flipTo ?? flipFrom;
  const turns = flipTo !== flipFrom;
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

  // 1) TAKE — toward the viewer, in place (the grip is readable at the source).
  tl.to(proxy, {
    y: from.y - takeLift,
    scale: takeScale,
    rotationZ: tilt,
    boxShadow: '0 16px 34px rgba(0,0,0,0.52)',
    duration: take,
    ease: 'power2.out',
  }, at);
  if (opts.onRelease !== undefined) {
    tl.call(opts.onRelease, undefined, at + take);
  }

  // 2) CARRY — ONE eased glide: position, scale, flip and tilt share the
  // same soft power2.inOut clock, so nothing ever snaps or races.
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
      gsap.set(proxy, {
        x: pt.x - from.w / 2,
        y: pt.y - from.h / 2 + liftBlend * (liftedY - from.y),
        scale,
        // The tilt breathes through the middle and squares out by 85%.
        rotationZ: tilt * (p < 0.85 ? Math.cos(p * Math.PI * 0.5) : 0),
      });
      if (flip !== null && turns) {
        // The turn owns the HEART of the carry (28% → 72%) with a slight
        // page-turn pitch — a half-turn in the hand, not a coin toss.
        const f = p <= 0.28 ? 0 : p >= 0.72 ? 1 : (p - 0.28) / 0.44;
        const eased = f * f * (3 - 2 * f);
        gsap.set(flip, {rotationY: flipFrom + (flipTo - flipFrom) * eased});
        gsap.set(proxy, {rotationX: Math.sin(eased * Math.PI) * 5});
      }
    },
  }, at + take);

  // The shadow collapses to a contact line through the approach.
  tl.to(proxy, {
    boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
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
    scale: targetScale * 0.988,
    duration: settle * 0.4,
    ease: 'power2.out',
  }, at + take + carry);
  tl.to(proxy, {
    scale: targetScale,
    duration: settle * 0.6,
    ease: 'power2.inOut',
  }, at + take + carry + settle * 0.4);

  // 4) HANDOFF — ONE moment, one owner: the settle has finished, the proxy
  // stands at the exact final geometry; the real element materializes UNDER
  // it in this same timeline slot and the proxy releases right on top of it.
  // (Revealing at contact — while the proxy still pressed — was the visible
  // "doubling": two copies at slightly different scales for a beat.)
  if (opts.onDock !== undefined) {
    tl.call(opts.onDock, undefined, at + take + carry + settle);
  }
  tl.to(proxy, {autoAlpha: 0, duration: 0.09}, at + take + carry + settle);
}

/**
 * The per-card STAGGER of a convoy. A convoy is a physical queue, so it may
 * take longer when there are more cards — but a 12-card buy at the full
 * per-card stagger would deal for over a second before the last card even
 * lifts, and the tail reads as a separate, slower event. The spread is
 * COMPRESSED as the batch grows (never below a beat that still reads as
 * one-after-another), so the whole convoy stays one continuous gesture.
 */
function staggerFor(count: number): number {
  const n = Math.max(1, count - 1);
  return Math.max(46, Math.min(STAGGER_MS, Math.round(900 / n)));
}

/** Total budget of one staggered flight batch (ms). */
function batchBudget(count: number, reseat = false): number {
  const take = reseat ? RESEAT_TAKE_MS : TAKE_MS;
  const carry = reseat ? RESEAT_CARRY_MS : CARRY_MS;
  return motionMs(take + carry + SETTLE_MS + staggerFor(count) * Math.max(0, count - 1)) + 600;
}

/** One animation frame (the honest "let the layout settle" wait). */
function frame(): Promise<void> {
  return new Promise<void>((r) => (typeof requestAnimationFrame === 'function' ?
    requestAnimationFrame(() => r()) : setTimeout(r, 16)));
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
    arriving: motionMs(RESEAT_TAKE_MS + RESEAT_CARRY_MS * 0.74),
    landed: motionMs(RESEAT_TAKE_MS + RESEAT_CARRY_MS + SETTLE_MS + STAGGER_MS * (n - 1)),
  };
}

/** The live flight proxies (empty once the layer is cleared). */
export function liveFlightProxies(): ReadonlyArray<HTMLElement> {
  return layerEl === undefined ? [] :
    Array.from(layerEl.querySelectorAll<HTMLElement>('.con-startdock-proxy'));
}

// ── COLLECT: grid slots → a dock pile (face-down) ───────────────────────────

/**
 * The selected cards fly from their slots onto the dock pile, flipping
 * face-down mid-carry and LAYING onto the stack coordinates exactly.
 * `onCovered` fires the moment every source is covered by its proxy (the
 * host may swap panes / hide the sources there); `onDock` fires PER CARD at
 * its touchdown (the pile physically answers and its count grows); resolves
 * at the last settle.
 */
export async function collectToDock(
  sources: ReadonlyArray<DockFlightSource>,
  pileEl: HTMLElement | null | undefined,
  onCovered?: () => void,
  onDock?: (name: CardName) => void,
): Promise<void> {
  const pile = rectOf(pileEl);
  const live = sources
    .map((s) => {
      const card = s.el.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? undefined;
      // Measure the CARD, not the slot: a slot's padding/band would misplace
      // and mis-size the proxy against the pixels the player actually sees.
      return {name: s.name, el: s.el, from: rectOf(card ?? s.el), card};
    })
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
      // Land INTO the pile box — the target rect is CENTRED ON THE STACK
      // (its own centre, never the source-width offset that drifted every
      // landing left of the shelf), sized to the pile's footprint.
      const fit = pile.w / Math.max(1, src.from.w);
      addFlight(tl, proxy, src.from, {
        x: pile.x + pile.w / 2 - (src.from.w * fit) / 2,
        y: pile.y + pile.h / 2 - (src.from.h * fit) / 2,
        w: src.from.w * fit,
        h: src.from.h * fit,
      }, {
        at: (motionMs(staggerFor(live.length)) * i) / 1000,
        flipTo: 180,
        tilt: tiltSeedFor(src.name),
        pressEl: pileEl,
        onDock: () => onDock?.(src.name),
      });
    });
  }, batchBudget(proxies.length));
  clearLayer();
}

// ── RETURN / REVEAL: a pile → target slots (face-up) ────────────────────────

/**
 * Cards fly OUT of a pile into their target slots, flipping face-up through
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
  // pile — its outbound carry simply scales back to 1 (pixel-true landing).
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
      const at = (motionMs(staggerFor(targets.length)) * i) / 1000;
      const born: Rect = {
        x: pile.x + pile.w / 2 - t.to.w / 2,
        y: pile.y + pile.h / 2 - t.to.h / 2,
        w: t.to.w, h: t.to.h,
      };
      // Leaving lightens the pile — a small counter-press upward.
      tl.call(() => pressPile(pileEl instanceof HTMLElement ? pileEl : undefined), undefined, at);
      addFlight(tl, proxy, born, t.to, {
        at,
        flipTo: 0,
        tilt: tiltSeedFor(t.name),
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
      from: rectOf(p.fromEl.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? p.fromEl),
      to: rectOf(p.toEl.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? p.toEl),
      card: p.fromEl.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? undefined,
    }))
    .filter((p): p is typeof p & {from: Rect, to: Rect} => p.from !== undefined && p.to !== undefined)
    // Reading order of the DESTINATION layout (top row first, then left→right).
    .sort((a, b) => (a.to.y - b.to.y) || (a.to.x - b.to.x));
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
        at: (motionMs(staggerFor(live.length)) * i) / 1000,
        reseat: true,
        onDock: () => onLanded?.(p.name),
      });
    });
  }, batchBudget(live.length, true));
  clearLayer();
}

// ── CAPTURE → FLY: the two-phase transfer (a stage may SWAP underneath) ─────

export type CapturedFlight = {
  /** The names whose sources were measurable (a proxy carries each). */
  names: ReadonlyArray<CardName>,
  /** The rise beat — every card lifts slightly toward the viewer, the
   *  `accent` card (the corporation — the player's face) a notch more. */
  lift(accent?: CardName): Promise<void>,
  /** Measure the targets NOW (the new stage must already stand in its final
   *  geometry) and carry every card into its slot — take/carry/lay grammar,
   *  convoy in the reading order of the DESTINATIONS. */
  flyTo(targetFor: (name: CardName) => HTMLElement | null, onLanded?: (name: CardName) => void): Promise<void>,
  /** Abort — drop the proxies instantly (idempotent). */
  dispose(): void,
};

/**
 * CAPTURE the cards where they stand: proxies spawn over the live faces in
 * the SAME synchronous call (the host hides the originals in the same tick),
 * so the entire surface under them may then re-bound, swap or unmount —
 * exactly how a stage transition slides a new screen UNDER moving cards.
 */
export function captureCards(sources: ReadonlyArray<DockFlightSource>): CapturedFlight {
  const reduced = consoleReducedMotionActive() || layerEl === undefined;
  const live = reduced ? [] : sources
    .map((s) => {
      const card = s.el.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? undefined;
      return {name: s.name, from: rectOf(card ?? s.el), card};
    })
    .filter((s): s is {name: CardName, from: Rect, card: HTMLElement | undefined} => s.from !== undefined);
  const proxies = new Map<CardName, {el: HTMLElement, from: Rect}>();
  for (const s of live) {
    const p = spawnProxy(s.name, s.from, true);
    if (p !== undefined) {
      fillFace(p, s.card);
      proxies.set(s.name, {el: p, from: s.from});
    }
  }
  let disposed = false;
  const allNames = sources.map((s) => s.name);

  return {
    names: allNames,
    lift(accent?: CardName): Promise<void> {
      if (disposed || proxies.size === 0) {
        return Promise.resolve();
      }
      const ui = conUiScale();
      return new Promise<void>((resolve) => {
        const safety = window.setTimeout(resolve, motionMs(220) + 600);
        const tl = gsap.timeline({onComplete: () => {
          window.clearTimeout(safety);
          resolve();
        }});
        proxies.forEach(({el, from}, name) => {
          const boost = name === accent ? 1.055 : 1.03;
          tl.to(el, {
            y: from.y - 8 * ui,
            scale: boost,
            boxShadow: '0 16px 34px rgba(0,0,0,0.52)',
            duration: motionMs(180) / 1000,
            ease: 'power2.out',
          }, 0);
        });
      });
    },
    async flyTo(targetFor: (name: CardName) => HTMLElement | null, onLanded?: (name: CardName) => void): Promise<void> {
      if (disposed) {
        allNames.forEach((n) => onLanded?.(n));
        return;
      }
      const readFlights = () => allNames
        .map((name) => {
          const proxy = proxies.get(name);
          const slot = targetFor(name);
          const card = slot?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? undefined;
          return {name, proxy, to: rectOf(card ?? slot ?? undefined)};
        });
      // TARGETS ARE POLLED, NEVER ASSUMED. A big batch's destination tiles
      // are laid out over SEVERAL frames (the grid re-flows, the fit engine
      // re-zooms, arts decode), so a single-shot read finds the first few
      // and misses the rest — and every missed one silently degraded to
      // «just appear», which is exactly the physicality this convoy exists
      // to keep. Poll until every proxy has a measurable target (or the
      // budget is out); only what is genuinely absent degrades.
      let flights = readFlights();
      for (let i = 0; i < 30 && flights.some((f) => f.proxy !== undefined && f.to === undefined); i++) {
        await frame();
        if (disposed) {
          return;
        }
        flights = readFlights();
      }
      const flyable = flights
        .filter((f): f is typeof f & {proxy: {el: HTMLElement, from: Rect}, to: Rect} =>
          f.proxy !== undefined && f.to !== undefined)
        .sort((a, b) => (a.to.y - b.to.y) || (a.to.x - b.to.x));
      // Degenerate entries (no proxy / no target) resolve honestly right away.
      for (const f of flights) {
        if (f.proxy === undefined || f.to === undefined) {
          if (f.proxy !== undefined) {
            gsap.to(f.proxy.el, {autoAlpha: 0, duration: 0.12});
          }
          onLanded?.(f.name);
        }
      }
      if (flyable.length === 0) {
        return;
      }
      await guarded((done) => {
        const tl = gsap.timeline({onComplete: done});
        flyable.forEach((f, i) => {
          addFlight(tl, f.proxy.el, f.proxy.from, f.to, {
            at: (motionMs(staggerFor(flyable.length)) * i) / 1000,
            reseat: true,
            onDock: () => onLanded?.(f.name),
          });
        });
      }, batchBudget(flyable.length, true));
      clearLayer();
    },
    dispose(): void {
      if (!disposed) {
        disposed = true;
        proxies.forEach(({el}) => gsap.killTweensOf(el));
        clearLayer();
      }
    },
  };
}

/** Abort/unmount: drop every proxy (idempotent). */
export function resetStartDockMotion(): void {
  if (layerEl !== undefined) {
    gsap.killTweensOf(layerEl.querySelectorAll('.con-startdock-proxy, .con-deal-proxy__flip'));
    clearLayer();
  }
}
