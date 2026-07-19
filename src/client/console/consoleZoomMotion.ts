/*
 * CONSOLE ZOOM MOTION — the open/close choreography of the fullscreen card
 * inspector (the console CardZoomModal instance). The companion of
 * cardDealDirector: GSAP owns the STAGED one-shot transitions, the modal's
 * own WAAPI slide owns the LB/RB browsing, CSS owns the chrome fades.
 *
 * ── THE OPEN IS PROXY-FIRST, THE DIALOG OPENS VANILLA (load-bearing) ──
 * The dialog's `showModal()` is called ONLY at the flight's touchdown, so
 * its very first top-layer frame is the FINAL state: stage fully visible,
 * untransformed, no animating ::backdrop. The premium lift flies a PROXY
 * (CardZoomCard hosted by ConsoleShell on `.con-zoom-flight-layer`, a
 * normal fixed layer) — the same pattern as every other console flight
 * (deal / exit / board-bonus). This is the fix for the Graphite first-open
 * bug (docs/ZOOM_BUG_HANDOFF.md): a fresh top-layer dialog whose stage was born
 * hidden and GSAP-transformed (+ an animated ::backdrop) on its first
 * frames could come up with a DEAD compositor surface on Windows —
 * DOM/styles perfect, pixels never presented, unrecoverable by any DOM
 * nudge. The mouse path (a vanilla static showModal) never hit it; the
 * console open is now compositor-equivalent to that proven shape. NEVER
 * reintroduce a transform/opacity reveal of the real stage during the
 * dialog's first frames, and never re-animate `::backdrop` on open.
 *
 * Modes (consoleCardZoom.ts → ZoomOrigin):
 *  physical — FLIP lift: the proxy starts on the source slot's rect and
 *      expands onto the measured landing rect (CardZoomModal.measureLanding
 *      — the closed dialog laid out invisibly, so the fit engine's real
 *      geometry is known before anything paints); `showModal()` fires on
 *      touchdown, the top layer covers the proxy, the shell removes it.
 *      Close plays the reverse flight (on the REAL stage — the surface is
 *      long-established by then, that path never bugged) into the slot of
 *      the card CURRENTLY on screen (re-resolved live). The slot itself is
 *      HELD invisible while its card is "in the player's hands"
 *      (`.con-zoom-hold`), re-targeted on every browse.
 *  textual / none — the inspector rise: the proxy scales/translates from
 *      depth + fades at the landing spot; same touchdown hand-off. No fake
 *      collapse into a nonexistent slot on close.
 *
 * Contracts:
 *  - transform/opacity only; the open rides the PROXY, the close rides the
 *    stage WRAPPER while the browse slide rides the card CHILD — nested
 *    transforms, never a fight;
 *  - the dialog chrome (counter / arrows / actions panel) is hidden by the
 *    host's `--flight` class during open and fades in only after the card
 *    lands ("fullscreen content appears when visually justified");
 *  - idempotent + zombie-safe: one module-level ctx; a new open/close kills
 *    the previous timeline; `releaseZoomMotion` restores every held slot;
 *  - reduced motion: no flights — the dialog opens vanilla immediately;
 *  - all durations resolve through motionMs (speed presets scale in step).
 */

import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {ZoomOrigin} from '@/client/console/consoleCardZoom';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {runHandIntake} from '@/client/console/handDock/handDeliveryDirector';

const HOLD_CLASS = 'con-zoom-hold';

type ZoomMotionCtx = {
  tween?: gsap.core.Tween | gsap.core.Timeline,
  heldSlot?: HTMLElement,
  origin?: ZoomOrigin,
  closing: boolean,
  /** The open flight's stall-safety timer (show+settle must always happen). */
  openSafety?: number,
};

const ctx: ZoomMotionCtx = {closing: false};

function killTween(): void {
  ctx.tween?.kill();
  ctx.tween = undefined;
}

function clearOpenSafety(): void {
  if (ctx.openSafety !== undefined) {
    window.clearTimeout(ctx.openSafety);
    ctx.openSafety = undefined;
  }
}

/**
 * Hold a source slot invisible while its card is "in the player's hands".
 * `el` MUST be the INNER `.card-container`/`.pcard` (`sourceCardEl`), NOT the
 * slot wrapper: the wrapper carries a Vue `:class` (e.g. the hand's
 * `--selected` toggles on the browse index), so a JS class added to it is
 * WASHED the moment Vue re-patches it on LB/RB — the card would reappear on
 * the board (two visible copies of one card). The inner card is a `:key`ed
 * `<Card>` Vue does NOT re-patch on browse, so the JS class survives.
 * The WHOLE slot (card + its focus ring / selected outline / glow) is
 * emptied by a CSS `:has(.con-zoom-hold)` rule on the wrapper instead
 * (console_card_deal.less) — that keys off this descendant class, so a
 * wrapper re-render can't break it either. Geometry is `sourceCardEl` too.
 */
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

/** The raw slot WRAPPER for `index` — the element the host marks / resolves. */
function sourceSlotEl(origin: ZoomOrigin, index: number): HTMLElement | null {
  return origin.resolve?.(index) ?? null;
}

/** The card slot for `index`, preferring the inner `.card-container`. */
function sourceCardEl(origin: ZoomOrigin, index: number): HTMLElement | null {
  const slot = sourceSlotEl(origin, index);
  if (slot === null) {
    return null;
  }
  return slot.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slot;
}

function stageEl(dialog: HTMLElement): HTMLElement | null {
  return dialog.querySelector<HTMLElement>('.card-zoom-stage');
}

/** The landing geometry (viewport px) measured by CardZoomModal.measureLanding. */
export type ZoomLandingRect = {left: number, top: number, width: number, height: number};

/**
 * Arm a new OPEN: kill any zombie flight and register the origin so the
 * close / browse-retarget machinery works even if the player closes while
 * the landing is still being measured. Called by the shell BEFORE the
 * (potentially multi-frame) `measureLanding()`.
 */
export function beginZoomOpen(origin: ZoomOrigin): void {
  killTween();
  clearOpenSafety();
  ctx.closing = false;
  ctx.origin = origin;
}

/** The armed origin's live slot rect for `index` (physical origins only). */
export function zoomOpenSourceRect(index: number): DOMRect | undefined {
  const origin = ctx.origin;
  if (origin === undefined || origin.kind !== 'physical') {
    return undefined;
  }
  return usableRect(sourceCardEl(origin, index));
}

/**
 * Abort an open whose dialog was never shown (B/X mid-flight): gates the
 * pending touchdown `show()` and kills the proxy tween. The shell then
 * unwinds its own state directly (the dialog 'close' event — the normal
 * unwinder — can never fire for a dialog that was never open).
 */
export function cancelZoomOpen(): void {
  ctx.closing = true;
  clearOpenSafety();
  killTween();
}

/**
 * OPEN flight — the PROXY choreography (see the module header: the real
 * dialog opens VANILLA at touchdown, this only flies the stand-in card).
 *
 *  - physical + usable slot: FLIP the proxy from the slot rect onto the
 *    landing rect; the slot is HELD empty from lift-off (`.con-zoom-hold`).
 *  - otherwise: the inspector rise-from-depth at the landing spot.
 *
 * `onShow` (showModal) fires at touchdown, `onDone` right after — both
 * once-gated, both guaranteed by a stall-safety timer, `onShow` suppressed
 * when a close raced the flight (`ctx.closing`).
 */
export function playZoomOpenFlight(
  proxy: HTMLElement | undefined,
  index: number,
  source: DOMRect | undefined,
  landing: ZoomLandingRect,
  cb: {onShow: () => void, onDone: () => void},
): void {
  killTween();
  clearOpenSafety();
  let finished = false;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    clearOpenSafety();
    ctx.tween = undefined;
    if (!ctx.closing) {
      cb.onShow();
    }
    // HAND-OFF IN ONE FRAME (load-bearing): showModal() promotes the dialog's
    // ALREADY-LAID-OUT card into the top layer, so it paints on the very next
    // paint. The proxy must be gone by that SAME paint — it is an identical
    // card at the identical rect, and the dialog's ::backdrop paints nothing,
    // so an overlapping proxy shows through and its halo ADDS to the dialog
    // card's: the contour glow doubles in brightness for as long as they
    // coexist — the "the glow behind the card flashes exactly on open" bug.
    // Even TWO frames of overlap read as a flash, so this is a SYNCHRONOUS
    // style write (no Vue flush, no rAF): hidden in the same task as show(),
    // hence never in the same paint. The unmount then happens later, on an
    // already-invisible element.
    if (proxy !== undefined) {
      gsap.set(proxy, {autoAlpha: 0});
    }
    cb.onDone();
  };
  // Safety: a stalled rAF / killed tween can never leave the dialog unshown.
  ctx.openSafety = window.setTimeout(finish, motionMs(420) + 600);
  if (proxy === undefined) {
    finish(); // no proxy element — vanilla show
    return;
  }
  if (source === undefined) {
    // Textual / none / unresolvable slot: the inspector rise-from-depth.
    ctx.tween = gsap.fromTo(proxy,
      {opacity: 0, x: landing.left, y: landing.top + 26 * conUiScale(), scale: 0.86, transformOrigin: '50% 60%'},
      {opacity: 1, x: landing.left, y: landing.top, scale: 1, duration: motionMs(300) / 1000, ease: 'expo.out', onComplete: finish});
    return;
  }
  // FLIP: the proxy lifts out of the slot and expands onto the landing rect.
  // Hold the inner card (CSS :has empties the whole slot — see holdSlot).
  holdSlot(sourceCardEl(ctx.origin ?? {kind: 'none'}, index));
  const scale = source.width / landing.width;
  ctx.tween = gsap.fromTo(proxy,
    {
      opacity: 1,
      x: source.left,
      y: source.top,
      scale,
      rotation: -1.6,
      transformOrigin: 'top left',
    },
    {
      x: landing.left,
      y: landing.top,
      scale: 1,
      rotation: 0,
      duration: motionMs(380) / 1000,
      ease: 'expo.out',
      onComplete: finish,
    });
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
    // Geometry from the CARD, hold on the WRAPPER (whole slot empties — no
    // leftover outline behind the returning card).
    const source = origin.kind === 'physical' ? usableRect(sourceCardEl(origin, index)) : undefined;
    if (source === undefined || target.width < 10) {
      // No believable slot (textual origin / slot scrolled away): dive.
      ctx.tween = gsap.to(stage, {autoAlpha: 0, y: 18, scale: 0.92, transformOrigin: '50% 60%', duration: motionMs(200) / 1000, ease: 'power2.in', onComplete: done});
      return;
    }
    // Make sure the LANDING slot is the held (empty) one, so the card
    // visibly returns into a gap — never onto a duplicate of itself.
    holdSlot(sourceCardEl(origin, index));
    const scale = source.width / target.width;
    // RESPONSIVE, DISSOLVE-INTO-SLOT retract (not a slow "fall + hard land"):
    //  - `power2.out` LEAVES fast on the very first frame → the B press reads
    //    as instantly effective (a slow-start ease made the press feel dropped,
    //    so the player pressed B again — "closes on the second press");
    //  - the stage DECELERATES into the slot and, in the last beat, the real
    //    slot card is revealed (`holdSlot(null)`) while the stage cross-fades
    //    over it — the card MATERIALIZES back into its slot (mirroring the deal
    //    / handoff touchdown) instead of hard-landing then popping, which read
    //    as the card "falling" onto the table.
    const flyDur = motionMs(280) / 1000;
    // Reveal the slot card ~60ms before touchdown, then cross-fade the stage
    // over it — the two overlap so the card dissolves into its slot.
    const revealAt = Math.max(0, flyDur - motionMs(60) / 1000);
    const tl = gsap.timeline({onComplete: done});
    tl.to(stage, {
      x: source.left - target.left,
      y: source.top - target.top,
      scale,
      rotation: -1,
      transformOrigin: 'top left',
      duration: flyDur,
      ease: 'power2.out',
    }, 0);
    tl.call(() => holdSlot(null), undefined, revealAt);
    tl.to(stage, {autoAlpha: 0, duration: motionMs(120) / 1000, ease: 'power1.out'}, revealAt);
    ctx.tween = tl;
  });
}

/**
 * HANDOFF choreography — «разыграть из fullscreen»: the action's surface
 * (the play-confirm composer) opens FIRST, mounting UNDER the top-layer
 * dialog; the fullscreen card then flies INTO that surface's card slot and
 * the viewer closes on landing. Resolves when the dialog may close.
 *
 * Sequencing: an rAF poll waits for the target slot to mount AND for its
 * rect to be stable across two consecutive frames (fonts/layout settle),
 * bounded by a frame budget — an unresolvable target degrades to the
 * inspector dive, never a stuck dialog. The target slot is HELD empty for
 * the flight (the table slot the card lifted from is released — the hand
 * behind both backdrops honestly shows the card again, since playing is
 * not committed until the composer confirms); on touchdown the hold lifts
 * (the modal's own card appears UNDER the stage) and the stage cross-fades
 * out — a seamless materialization, mirroring the deal handoff.
 */
export function playZoomHandoff(dialog: HTMLElement | undefined, resolveTarget: () => HTMLElement | null): Promise<void> {
  if (ctx.closing) {
    return Promise.resolve();
  }
  ctx.closing = true;
  killTween();
  const stage = dialog !== undefined ? stageEl(dialog) : null;
  if (stage === null || typeof requestAnimationFrame !== 'function') {
    return Promise.resolve();
  }
  const reduced = consoleReducedMotionActive();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        ctx.tween = undefined;
        resolve();
      }
    };
    const safety = window.setTimeout(finish, motionMs(340) + 1500);
    const done = () => {
      window.clearTimeout(safety);
      finish();
    };
    const dive = () => {
      ctx.tween = gsap.to(stage, {autoAlpha: 0, y: 18, scale: 0.92, transformOrigin: '50% 60%', duration: motionMs(200) / 1000, ease: 'power2.in', onComplete: done});
    };
    if (reduced) {
      ctx.tween = gsap.to(stage, {autoAlpha: 0, duration: motionMs(120) / 1000, ease: 'power1.in', onComplete: done});
      return;
    }
    // Wait for the composer's card slot: mounted + rect stable (2 frames).
    let tries = 0;
    let lastSig = '';
    const poll = () => {
      if (settled) {
        return;
      }
      tries++;
      const slot = resolveTarget();
      const cardEl = slot !== null ? (slot.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slot) : null;
      const rect = usableRect(cardEl);
      const sig = rect !== undefined ? `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}` : '';
      if (rect === undefined || sig !== lastSig) {
        lastSig = sig;
        if (tries < 45) {
          requestAnimationFrame(poll);
        } else {
          dive(); // the surface never produced a stable slot — honest exit
        }
        return;
      }
      const target = stage.getBoundingClientRect();
      if (target.width < 10 || cardEl === null) {
        dive();
        return;
      }
      // The card leaves the table world for the modal world: hold the
      // MODAL slot's inner card (CSS :has empties the whole slot).
      holdSlot(cardEl);
      const scale = rect.width / target.width;
      const tl = gsap.timeline({onComplete: done});
      tl.to(stage, {
        x: rect.left - target.left,
        y: rect.top - target.top,
        scale,
        rotation: 0,
        transformOrigin: 'top left',
        duration: motionMs(340) / 1000,
        ease: 'power3.inOut',
      });
      // Touchdown: reveal the modal's own card UNDER the stage, then
      // cross-fade the stage out — one continuous materialization.
      tl.call(() => holdSlot(null));
      tl.to(stage, {autoAlpha: 0, duration: motionMs(130) / 1000, ease: 'power1.out'});
      ctx.tween = tl;
    };
    requestAnimationFrame(poll);
  });
}

/**
 * DEPART-TO-HAND choreography — the SINGLE-CARD reveal take. The inspected
 * card does not dive off-screen: its flight is the HAND INTAKE cinematic
 * (handDeliveryDirector) — a proxy takes over at the stage's exact rect, the
 * stage hides and the dialog closes in that same paint (`onStaged` — the
 * caller runs `zoom.close()` there, so the top layer never covers the
 * flight), then the card arcs down into the bottom-centre hand dock,
 * flipping face → back, and LAYS onto its real pack slot — the «КАРТЫ»
 * counter ticks on the touchdown. One continuous gesture from fullscreen
 * into the hand.
 *
 * `onCommit` fires as the flight begins (the reveal state commits while the
 * card flies — the same "onLift" same-frame semantics as the exit director).
 * Resolves when the card has landed. Reduced motion / missing stage → an
 * immediate commit + staged callback (the intake's instant path).
 */
export function playZoomDepart(dialog: HTMLElement | undefined, name: CardName, onCommit: () => void, onStaged?: () => void): Promise<void> {
  if (ctx.closing) {
    return Promise.resolve();
  }
  ctx.closing = true;
  killTween();
  const stage = dialog !== undefined ? stageEl(dialog) : null;
  if (stage === null) {
    onCommit();
    onStaged?.();
    return Promise.resolve();
  }
  const rect = stage.getBoundingClientRect();
  return runHandIntake([{name, rect}], {
    commit: onCommit,
    onStaged: () => {
      // The proxy stands revealed at this exact rect — hide the stage and
      // let the caller close the dialog in the SAME paint (no double-vision,
      // no frame without the card).
      gsap.set(stage, {autoAlpha: 0});
      onStaged?.();
    },
  });
}

/**
 * SWAP choreography — the single-card reveal L3 flip (received ⇄ source) on
 * the SAME open viewer. A quick depth-out of the stage, then `swapState`
 * re-points the module card, then a re-fit + depth-in of the (re-rendered)
 * stage. No dialog recreation, no backdrop flash — a soft crossfade. `refit`
 * is the host's `fitCardToViewport` (the paired card may size differently).
 * Resolves when the swap-in settles (the caller gates re-entrant L3 on it).
 */
export function playZoomSwap(dialog: HTMLElement | undefined, swapState: () => void, refit: () => void): Promise<void> {
  const stage = dialog !== undefined ? stageEl(dialog) : null;
  if (stage === null || typeof requestAnimationFrame !== 'function') {
    swapState();
    refit();
    return Promise.resolve();
  }
  killTween();
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    // Safety: a stalled rAF can never leave the swap guard stuck.
    const safety = window.setTimeout(done, motionMs(320) + 500);
    const finish = () => {
      window.clearTimeout(safety);
      done();
    };
    if (consoleReducedMotionActive()) {
      swapState();
      // One frame for the re-render, then a short fade-in over the new card.
      requestAnimationFrame(() => {
        refit();
        ctx.tween = gsap.fromTo(stage, {autoAlpha: 0}, {autoAlpha: 1, duration: motionMs(120) / 1000, ease: 'power1.out', onComplete: finish});
      });
      return;
    }
    ctx.tween = gsap.to(stage, {
      autoAlpha: 0, scale: 0.94, y: 14,
      duration: motionMs(120) / 1000,
      ease: 'power2.in',
      onComplete: () => {
        swapState();
        // The re-point re-renders the card next flush; fit + rise it in then.
        requestAnimationFrame(() => {
          refit();
          ctx.tween = gsap.fromTo(stage,
            {autoAlpha: 0, scale: 0.94, y: 14},
            {autoAlpha: 1, scale: 1, y: 0, duration: motionMs(200) / 1000, ease: 'expo.out', onComplete: finish});
        });
      },
    });
  });
}

/** Final cleanup — after the dialog actually closed (any path, incl. Esc). */
export function releaseZoomMotion(): void {
  killTween();
  clearOpenSafety();
  holdSlot(null);
  ctx.origin = undefined;
  ctx.closing = false;
}
