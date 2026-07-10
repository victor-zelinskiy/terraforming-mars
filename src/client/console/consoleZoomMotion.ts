/*
 * CONSOLE ZOOM MOTION — the open/close choreography of the fullscreen card
 * inspector (the console CardZoomModal instance). The companion of
 * cardDealDirector: GSAP owns the STAGED one-shot transitions, the modal's
 * own WAAPI slide owns the LB/RB browsing, CSS owns the chrome fades.
 *
 * Modes (consoleCardZoom.ts → ZoomOrigin):
 *  physical — FLIP lift: the REAL fullscreen stage (`.card-zoom-stage`, the
 *      parent of the persistent card) starts transformed onto the source
 *      slot's rect and expands to identity — the same card, same art, same
 *      title, physically taken off the table. Close plays the reverse
 *      flight into the slot of the card CURRENTLY on screen (re-resolved
 *      live). The slot itself is HELD invisible while its card is "in the
 *      player's hands" (`.con-zoom-hold`), re-targeted on every browse.
 *  textual / none — the inspector rise: scale/translate from depth + fade.
 *      No fake collapse into a nonexistent slot.
 *
 * Contracts:
 *  - transform/opacity only; the flight rides the stage WRAPPER while the
 *    browse slide rides the card CHILD — nested transforms, never a fight;
 *  - the dialog chrome (counter / arrows / actions panel) is hidden by the
 *    host's `--flight` class during open and fades in only after the card
 *    lands ("fullscreen content appears when visually justified");
 *  - idempotent + zombie-safe: one module-level ctx; a new open/close kills
 *    the previous timeline; `releaseZoomMotion` restores every held slot;
 *  - reduced motion: short fades (≤160ms), no flights;
 *  - all durations resolve through motionMs (speed presets scale in step).
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {ZoomOrigin} from '@/client/console/consoleCardZoom';

const HOLD_CLASS = 'con-zoom-hold';

type ZoomMotionCtx = {
  tween?: gsap.core.Tween,
  heldSlot?: HTMLElement,
  origin?: ZoomOrigin,
  closing: boolean,
};

const ctx: ZoomMotionCtx = {closing: false};

function killTween(): void {
  ctx.tween?.kill();
  ctx.tween = undefined;
}

function holdSlot(el: HTMLElement | null): void {
  if (ctx.heldSlot !== undefined && ctx.heldSlot !== el) {
    ctx.heldSlot.classList.remove(HOLD_CLASS);
  }
  if (el !== null) {
    el.classList.add(HOLD_CLASS);
    ctx.heldSlot = el;
  } else {
    ctx.heldSlot = undefined;
  }
}

function usableRect(el: HTMLElement | null): DOMRect | undefined {
  if (el === null || !el.isConnected) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) {
    return undefined;
  }
  // A slot scrolled fully off-screen is not a believable flight target.
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
    return undefined;
  }
  return r;
}

/** The card slot for `index`, preferring the inner `.card-container`. */
function sourceCardEl(origin: ZoomOrigin, index: number): HTMLElement | null {
  const slot = origin.resolve?.(index) ?? null;
  if (slot === null) {
    return null;
  }
  return slot.querySelector<HTMLElement>('.card-container') ?? slot;
}

function stageEl(dialog: HTMLElement): HTMLElement | null {
  return dialog.querySelector<HTMLElement>('.card-zoom-stage');
}

/**
 * OPEN choreography. Called right after the dialog's show(); waits two
 * frames for the fit engine to size the card, then plays. `onSettled`
 * releases the host's `--flight` chrome hold (also on every bail path).
 */
export function playZoomOpen(dialog: HTMLElement | undefined, index: number, origin: ZoomOrigin, onSettledRaw: () => void): void {
  killTween();
  ctx.closing = false;
  ctx.origin = origin;
  // Once-gated settle + a safety timer: a stalled rAF can never leave the
  // dialog chrome hidden behind the `--flight` hold.
  let settled = false;
  const onSettled = () => {
    if (!settled) {
      settled = true;
      onSettledRaw();
    }
  };
  setTimeout(onSettled, motionMs(380) + 700);
  const stage = dialog !== undefined ? stageEl(dialog) : null;
  if (stage === null || typeof requestAnimationFrame !== 'function') {
    onSettled();
    return;
  }
  // Hide the stage BEFORE the dialog's first paint (this runs in the same
  // tick as show()) so the full-size card can never flash pre-flight.
  gsap.set(stage, {autoAlpha: 0});
  const reduced = consoleReducedMotionActive();
  // Two rAFs: the fit engine (show() → nextTick → fitCardToViewport) has
  // sized the card by then, so the measured stage rect is final.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (ctx.closing) {
      return; // closed before it ever opened — close path owns cleanup
    }
    const finish = () => {
      ctx.tween = undefined;
      onSettled();
    };
    if (reduced) {
      ctx.tween = gsap.fromTo(stage, {autoAlpha: 0}, {autoAlpha: 1, duration: motionMs(140) / 1000, ease: 'power1.out', onComplete: finish});
      return;
    }
    const target = stage.getBoundingClientRect();
    const source = origin.kind === 'physical' ? usableRect(sourceCardEl(origin, index)) : undefined;
    if (source === undefined || target.width < 10) {
      // Textual / none / unresolvable slot: the inspector rise-from-depth.
      ctx.tween = gsap.fromTo(stage,
        {autoAlpha: 0, y: 26, scale: 0.86, transformOrigin: '50% 60%'},
        {autoAlpha: 1, y: 0, scale: 1, duration: motionMs(300) / 1000, ease: 'expo.out', onComplete: finish});
      return;
    }
    // FLIP: start the fullscreen stage transformed onto the slot's rect.
    holdSlot(sourceCardEl(origin, index));
    const scale = source.width / target.width;
    ctx.tween = gsap.fromTo(stage,
      {
        autoAlpha: 1,
        x: source.left - target.left,
        y: source.top - target.top,
        scale,
        rotation: -1.6,
        transformOrigin: 'top left',
      },
      {
        x: 0, y: 0, scale: 1, rotation: 0,
        duration: motionMs(380) / 1000,
        ease: 'expo.out',
        onComplete: finish,
      });
  }));
}

/**
 * Browse (LB/RB) — the card "in hand" changed: re-target the table hold so
 * the CURRENT card's slot is the empty one (re-applied even for the same
 * index — robust against a host re-render washing the classList).
 */
export function retargetZoomHold(index: number): void {
  const origin = ctx.origin;
  if (origin === undefined || origin.kind !== 'physical') {
    return;
  }
  holdSlot(sourceCardEl(origin, index));
}

/**
 * CLOSE choreography. Resolves when the dialog may actually close.
 * Physical + visible slot → the reverse flight into it; otherwise the
 * inspector dive. Re-entrant calls resolve immediately (single flight).
 */
export function playZoomClose(dialog: HTMLElement | undefined, index: number): Promise<void> {
  if (ctx.closing) {
    return Promise.resolve();
  }
  ctx.closing = true;
  killTween();
  const stage = dialog !== undefined ? stageEl(dialog) : null;
  const origin = ctx.origin ?? {kind: 'none' as const};
  if (stage === null) {
    return Promise.resolve();
  }
  const reduced = consoleReducedMotionActive();
  return new Promise<void>((resolve) => {
    const finish = () => {
      ctx.tween = undefined;
      resolve();
    };
    // Safety: never strand the dialog behind a stalled rAF.
    const safety = window.setTimeout(finish, motionMs(420) + 400);
    const done = () => {
      window.clearTimeout(safety);
      finish();
    };
    if (reduced) {
      ctx.tween = gsap.to(stage, {autoAlpha: 0, duration: motionMs(120) / 1000, ease: 'power1.in', onComplete: done});
      return;
    }
    const target = stage.getBoundingClientRect();
    const sourceEl = origin.kind === 'physical' ? sourceCardEl(origin, index) : null;
    const source = usableRect(sourceEl);
    if (source === undefined || target.width < 10) {
      // No believable slot (textual origin / slot scrolled away): dive.
      ctx.tween = gsap.to(stage, {autoAlpha: 0, y: 18, scale: 0.92, transformOrigin: '50% 60%', duration: motionMs(200) / 1000, ease: 'power2.in', onComplete: done});
      return;
    }
    // Make sure the LANDING slot is the held (empty) one, so the card
    // visibly returns into a gap — never onto a duplicate of itself.
    holdSlot(sourceEl);
    const scale = source.width / target.width;
    ctx.tween = gsap.to(stage, {
      x: source.left - target.left,
      y: source.top - target.top,
      scale,
      rotation: -1.2,
      transformOrigin: 'top left',
      duration: motionMs(320) / 1000,
      ease: 'power3.inOut',
      onComplete: done,
    });
  });
}

/** Final cleanup — after the dialog actually closed (any path, incl. Esc). */
export function releaseZoomMotion(): void {
  killTween();
  holdSlot(null);
  ctx.origin = undefined;
  ctx.closing = false;
}
