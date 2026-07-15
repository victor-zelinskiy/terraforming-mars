/*
 * patentSaleDirector — the GSAP hands of the console patent-sale hero scene.
 *
 * Owns ONLY the DOM/tween work on the fixed stage (ConsolePatentSaleLayer):
 * placing the card proxies over their live hand slots, the lift + back-flip
 * + gather into the neat stack, the terminal slide-in, the stack sinking
 * through the slit (a static clip line on the well — cards vanish INTO the
 * table, never fade in mid-air), the working scanline, the payout chip's
 * pop + arc onto the resource rail, the settle halo, and the kill switch.
 * No game state, no Vue.
 *
 * Physics discipline (the project flight rules): transform/opacity only, all
 * rects measured BEFORE a timeline starts, `will-change` scoped to the
 * stage's own CSS classes, every entry point resolves (guarded budgets) and
 * `killSaleTweens` reverts everything.
 */

import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {motionMs} from '@/client/components/motion/motionTokens';
import {
  SalePoint, saleStackSlot,
  SALE_STACK_W, SALE_TERMINAL_REVEAL_MS,
} from '@/client/console/patentSale/patentSaleModel';

/** Natural design width of the premium card face (`.pcard`). */
const CARD_NATURAL_W = 320;

export type SaleRect = {x: number, y: number, w: number, h: number};

export type SaleSource = {
  id: number,
  name: CardName,
  rect: SaleRect,
};

export type SaleProxyEls = {
  id: number,
  root: HTMLElement,
  flip: HTMLElement | undefined,
};

export type SaleStageEls = {
  well: HTMLElement,
  terminal: HTMLElement,
  slit: HTMLElement,
  scan: HTMLElement | undefined,
  glow: HTMLElement | undefined,
  proxies: ReadonlyArray<SaleProxyEls>,
};

type ProxyGeometry = {
  baseScale: number,
  naturalH: number,
};

/** Per-proxy launch geometry, captured at placement (keyed by flight id). */
let geometry = new Map<number, ProxyGeometry>();
/** The slit mouth centre (the stack target + the chip's launch point). */
let slitCenter: SalePoint | undefined;

/** The payout chip's launch point — the RESOURCE-TRANSFER framework spawns
 *  the M€ chip here (the sale's reward source is the terminal, not a card). */
export function saleSlitCenter(): SalePoint | undefined {
  return slitCenter;
}

/**
 * Position every proxy pixel-perfect over its captured source rect and the
 * terminal at its resting pose (xPercent -50 owns the CSS centring so the
 * later slide-in composes cleanly), then measure the slit mouth. MUST run in
 * the same synchronous turn as blanking the sources. Returns false when the
 * stage is degenerate (caller degrades to the no-flight path).
 */
export function placeSaleProxies(els: SaleStageEls, sources: ReadonlyArray<SaleSource>): boolean {
  geometry = new Map();
  slitCenter = undefined; // never inherit a previous transaction's geometry
  // Measure the slit at its RESTING pose (y 0) — the stack point + clip line
  // key off the final position — THEN wind the terminal to its slide-in start.
  gsap.set(els.terminal, {xPercent: -50, y: 0, autoAlpha: 0});
  const slitRect = els.slit.getBoundingClientRect();
  gsap.set(els.terminal, {y: 18});
  if (els.glow !== undefined) {
    gsap.set(els.glow, {autoAlpha: 0});
  }
  if (slitRect.width < 10) {
    return false;
  }
  slitCenter = {x: slitRect.left + slitRect.width / 2, y: slitRect.top + slitRect.height / 2};
  let placed = 0;
  for (const src of sources) {
    const proxy = els.proxies.find((p) => p.id === src.id);
    if (proxy === undefined || src.rect.w < 10) {
      continue;
    }
    const baseScale = src.rect.w / CARD_NATURAL_W;
    const naturalH = src.rect.h / baseScale;
    geometry.set(src.id, {baseScale, naturalH});
    // CENTER origin: the back-flip pivots around the card's middle and the
    // position math collapses to "centre at the point" — scale-independent.
    gsap.set(proxy.root, {
      width: CARD_NATURAL_W,
      height: naturalH,
      x: src.rect.x + src.rect.w / 2 - CARD_NATURAL_W / 2,
      y: src.rect.y + src.rect.h / 2 - naturalH / 2,
      scale: baseScale,
      rotation: 0,
      transformOrigin: 'center center',
      autoAlpha: 1,
      zIndex: 10 + placed, // later cards land ON TOP of the pile
    });
    if (proxy.flip !== undefined) {
      gsap.set(proxy.flip, {rotationY: 0});
    }
    placed++;
  }
  return placed > 0;
}

/** Bounded-promise wrapper (the guarded() discipline of cardExitDirector). */
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
    const safety = window.setTimeout(done, budgetMs + 1200);
    run(done);
  });
}

export type SaleGatherOpts = {
  uiScale: number,
  liftMs: number,
  gatherMs: number,
  staggerMs: number,
};

/**
 * The GATHER: each card lifts off its slot (a physical pick-up, no pop),
 * then arcs to the stack point over the slit while its back-flip rides the
 * SAME flight (one object on one curve — the flip is the travel, never a
 * separate beat). Rotations converge into the neat pile; the terminal
 * slides open under the converging cards mid-gather.
 */
export function playSaleGather(els: SaleStageEls, opts: SaleGatherOpts): Promise<void> {
  const at = slitCenter;
  if (at === undefined || els.proxies.length === 0) {
    return Promise.resolve();
  }
  const stackScale = (SALE_STACK_W * opts.uiScale) / CARD_NATURAL_W;
  const n = els.proxies.length;
  const total = opts.liftMs + opts.gatherMs + opts.staggerMs * n + 200;
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    els.proxies.forEach((p, i) => {
      const g = geometry.get(p.id);
      if (g === undefined) {
        return;
      }
      const slot = saleStackSlot(i);
      // The stack hovers just above the slit mouth — its bottom edge kisses
      // the line the insert will sink it through.
      const stackX = at.x + slot.dx * opts.uiScale - CARD_NATURAL_W / 2;
      const stackY = at.y - (g.naturalH * stackScale) * 0.62 + slot.dy * opts.uiScale - g.naturalH / 2;
      const t0 = (opts.staggerMs / 1000) * i;
      // Pick-up: off the table, a hair larger — separation, not a pop.
      tl.to(p.root, {
        y: `-=${Math.round(12 * opts.uiScale) + 4}`,
        scale: g.baseScale * 1.045,
        rotation: (i % 2 === 0 ? -1 : 1) * 1.6,
        duration: opts.liftMs / 1000,
        ease: 'power2.out',
      }, t0);
      // The flight into the pile — position, scale and roll on one curve.
      tl.to(p.root, {
        x: stackX,
        y: stackY,
        scale: stackScale,
        rotation: slot.rot,
        duration: opts.gatherMs / 1000,
        ease: 'power2.inOut',
      }, t0 + opts.liftMs / 1000);
      // The back-flip RIDES the flight (face → back across its middle).
      if (p.flip !== undefined) {
        tl.to(p.flip, {
          rotationY: 180,
          duration: (opts.gatherMs / 1000) * 0.78,
          ease: 'power1.inOut',
        }, t0 + opts.liftMs / 1000 + (opts.gatherMs / 1000) * 0.08);
      }
    });
    // The terminal slides open UNDER the converging cards — the scene forms
    // around the moving pile, never as a separate step.
    tl.to(els.terminal, {
      y: 0,
      autoAlpha: 1,
      duration: motionMs(SALE_TERMINAL_REVEAL_MS) / 1000,
      ease: 'power2.out',
    }, (opts.liftMs + opts.gatherMs * 0.35) / 1000);
  }, total);
}

export type SaleInsertOpts = {
  uiScale: number,
  durationMs: number,
};

/**
 * The INSERT: the whole pile sinks through the slit as ONE object — the
 * well's static clip line swallows it at the mouth (cards go INTO the
 * table, they don't fade in mid-air). The slit rim wakes as the cards pass.
 */
export function playSaleInsert(els: SaleStageEls, opts: SaleInsertOpts): Promise<void> {
  const at = slitCenter;
  if (at === undefined || els.proxies.length === 0) {
    return Promise.resolve();
  }
  // The clip line arms ONLY now: everything below the slit mouth is TABLE —
  // a sinking card vanishes at the line. (Armed at gather time it would clip
  // cards LAUNCHING from the hand's bottom rows, which sit below the slit.)
  gsap.set(els.well, {clipPath: `inset(0px 0px ${Math.max(0, Math.round(window.innerHeight - at.y))}px 0px)`});
  // Deep enough that the TALLEST card's box fully passes the clip line: the
  // stack hovers with its centre ~0.62·H above the slit (top ≈ 1.12·H over
  // the line, plus the pile's own upward micro-offsets) — 1.25·H + margin
  // sinks every card completely, never a stuck sliver.
  let depth = 0;
  els.proxies.forEach((p) => {
    const g = geometry.get(p.id);
    if (g !== undefined) {
      const stackScale = (SALE_STACK_W * opts.uiScale) / CARD_NATURAL_W;
      depth = Math.max(depth, g.naturalH * stackScale * 1.25);
    }
  });
  depth = Math.round(depth + 40 * opts.uiScale);
  const roots = els.proxies.map((p) => p.root);
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    tl.to(roots, {
      y: `+=${depth}`,
      rotation: 0, // the mechanism takes them in square
      duration: opts.durationMs / 1000,
      ease: 'power2.in',
    }, 0);
    if (els.glow !== undefined) {
      // The rim wakes while the cards pass the mouth, then relaxes.
      tl.to(els.glow, {autoAlpha: 0.55, duration: (opts.durationMs * 0.5) / 1000, ease: 'power1.in'}, 0);
      tl.to(els.glow, {autoAlpha: 0.28, duration: 0.18, ease: 'power1.out'});
    }
  }, opts.durationMs + 300);
}

/**
 * PROCESSING — the mechanism works while the server round-trip resolves: a
 * restrained scanline sweep inside the slit + a soft rim breath. Bounded by
 * the transaction itself (killed at payout / abort; the arm safety net is
 * the hard ceiling) — never a decorative infinite loop.
 */
export function startSaleProcessing(els: SaleStageEls): void {
  if (els.scan !== undefined) {
    gsap.set(els.scan, {xPercent: -130, autoAlpha: 1});
    gsap.to(els.scan, {xPercent: 330, duration: 0.85, ease: 'power1.inOut', repeat: -1, repeatDelay: 0.22});
  }
  if (els.glow !== undefined) {
    gsap.to(els.glow, {autoAlpha: 0.45, duration: 0.5, ease: 'power1.inOut', yoyo: true, repeat: -1});
  }
}

/**
 * The DISPENSE flash: the mechanism stops working and announces the payout
 * with one bright beat on the slit — fired the moment the shared
 * resource-transfer framework ejects the M€ chip from `saleSlitCenter()`.
 * Fire-and-forget (the chip's own flight is the awaited beat).
 */
export function playSaleDispense(els: SaleStageEls): void {
  stopProcessingTweens(els);
  if (els.glow !== undefined) {
    gsap.timeline()
      .to(els.glow, {autoAlpha: 0.9, duration: 0.09, ease: 'power1.in'}, 0)
      .to(els.glow, {autoAlpha: 0, duration: 0.3, ease: 'power1.out'}, 0.09);
  }
}

/**
 * The SETTLE (post-commit): the terminal retracts into the table while the
 * framework absorbs the landed chip into the (just updated) M€ row — the
 * standard delta chip is already ticking beside it.
 */
export function playSaleSettle(els: SaleStageEls, uiScale: number): Promise<void> {
  const budget = 480;
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    tl.to(els.terminal, {y: `+=${Math.round(16 * uiScale)}`, autoAlpha: 0, duration: 0.26, ease: 'power2.in'}, 0.05);
  }, budget);
}

function stopProcessingTweens(els: SaleStageEls): void {
  if (els.scan !== undefined) {
    gsap.killTweensOf(els.scan);
    gsap.set(els.scan, {autoAlpha: 0});
  }
  if (els.glow !== undefined) {
    gsap.killTweensOf(els.glow);
  }
}

/** Abort/unmount: kill every tween on the stage (idempotent). */
export function killSaleTweens(els: SaleStageEls): void {
  els.proxies.forEach((p) => {
    gsap.killTweensOf(p.root);
    if (p.flip !== undefined) {
      gsap.killTweensOf(p.flip);
    }
  });
  gsap.killTweensOf(els.terminal);
  stopProcessingTweens(els);
}
