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

// TEMPORARY first-open diagnostics (see DIAGNOSTIC_CLEANUP.md) — traces the
// zoom-open choreography so a broken first open can be pinpointed from the
// user's console instead of guessed.
function zlog(msg: string): void {
  // eslint-disable-next-line no-console
  console.warn(`%c[TM-DIAG zoom] ${msg}`, 'color:#38bdf8');
}

type ZoomMotionCtx = {
  tween?: gsap.core.Tween | gsap.core.Timeline,
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
  return slot.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slot;
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
  const stage = dialog !== undefined ? stageEl(dialog) : null;
  zlog(`open: dialog=${dialog !== undefined} stage=${stage !== null} origin=${origin.kind} index=${index}`);
  // SAFETY: settle the chrome AND force the stage visible. The open path hides
  // the stage (`autoAlpha: 0`) and only restores it inside the tween after two
  // rAFs — if anything derails in between (a bail, a killed tween, a zero
  // measure on a heavy first-open frame), the dialog would stay OPEN over an
  // INVISIBLE card forever (the "first fullscreen shows an empty viewer" bug).
  // The timer runs once per open; by then any real tween has already finished
  // (or will finish at autoAlpha 1 anyway), so the restore is idempotent.
  setTimeout(() => {
    if (!settled && stage !== null && !ctx.closing) {
      zlog(`open SAFETY fired: restoring stage visibility (tween=${ctx.tween !== undefined})`);
      killTween();
      gsap.set(stage, {clearProps: 'opacity,visibility,transform'});
    }
    onSettled();
  }, motionMs(380) + 700);
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
  requestAnimationFrame(() => {
    // GRAPHITE first-commit workaround: on Windows the FIRST commit of this
    // top-layer stage's texture can hit a Skia Graphite shared-image race
    // ("ProduceSkia: non-existent mailbox") — the layer then stays EMPTY for
    // the whole open (logic/DOM/measures all correct; the user's first
    // fullscreen showed nothing; the second open always worked because its
    // texture allocation is a fresh one). Force that "second allocation" here:
    // drop + recreate the stage's layer subtree while it is still INVISIBLE
    // (autoAlpha 0 until the FLIP), so the flight reveals a freshly-allocated
    // texture. One hidden reflow per open — imperceptible, perf-neutral.
    // A/B knob: `localStorage.tm_zoom_kick = '0'` disables the kick, so the
    // boot warm-up (the zoom-scale legacy-card texture) can be verified as the
    // actual fix in isolation. Default ON (belt and braces in production).
    let kickOff = false;
    try {
      kickOff = localStorage.getItem('tm_zoom_kick') === '0';
    } catch {
      // storage unavailable — keep the kick on
    }
    if (kickOff) {
      zlog('open: layer recreate kick SKIPPED (tm_zoom_kick=0)');
    } else {
      zlog('open: layer recreate kick (Graphite first-commit workaround)');
      const prevDisplay = stage.style.display;
      stage.style.display = 'none';
      void stage.offsetHeight; // force the unlayerize
      stage.style.display = prevDisplay;
      void stage.offsetHeight; // force the re-layerize before the next commit
    }
    requestAnimationFrame(() => {
    if (ctx.closing) {
      zlog('open BAIL: ctx.closing was set between show and the 2nd rAF');
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
    zlog(`open measure: target=${Math.round(target.width)}x${Math.round(target.height)} source=${source !== undefined ? Math.round(source.width) + 'x' + Math.round(source.height) : 'none'} cardInStage=${stage.querySelector(':is(.card-container, .pcard)') !== null}`);
    if (source === undefined || target.width < 10) {
      // Textual / none / unresolvable slot: the inspector rise-from-depth.
      zlog('open path: rise-from-depth fallback');
      ctx.tween = gsap.fromTo(stage,
        {autoAlpha: 0, y: 26, scale: 0.86, transformOrigin: '50% 60%'},
        {autoAlpha: 1, y: 0, scale: 1, duration: motionMs(300) / 1000, ease: 'expo.out', onComplete: finish});
      return;
    }
    // FLIP: start the fullscreen stage transformed onto the slot's rect.
    zlog('open path: FLIP from slot');
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
    });
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
      // MODAL slot (releasing the table slot underneath the backdrops).
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
 * DEPART-TO-PLAYER choreography — the SINGLE-CARD reveal take. Instead of
 * closing back to a source slot (there is no strip in single-card mode), the
 * fullscreen stage dives STRAIGHT to the player zone (bottom centre, the same
 * table geography the exit director's take uses), the dialog backdrop fading
 * under it (the host's `--closing` class) so the game is revealed as the card
 * lands "in the hand". The take reads as one continuous gesture from
 * fullscreen — never a return to an empty modal.
 *
 * `onCommit` fires as the dive BEGINS (the reveal state commits while the card
 * flies — the same "onLift" same-frame semantics as the exit director, so the
 * hand count / delta-chip tick up on the revealing screen). Resolves when the
 * flight is done; the caller then closes the dialog. Reduced motion / missing
 * stage → an immediate commit + short fade.
 */
export function playZoomDepart(dialog: HTMLElement | undefined, onCommit: () => void): Promise<void> {
  if (ctx.closing) {
    return Promise.resolve();
  }
  ctx.closing = true;
  killTween();
  const stage = dialog !== undefined ? stageEl(dialog) : null;
  if (stage === null) {
    onCommit();
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
    const safety = window.setTimeout(finish, motionMs(560) + 500);
    const done = () => {
      window.clearTimeout(safety);
      finish();
    };
    // Commit while the card is airborne (or immediately under reduced motion).
    onCommit();
    if (reduced) {
      ctx.tween = gsap.to(stage, {autoAlpha: 0, duration: motionMs(140) / 1000, ease: 'power1.in', onComplete: done});
      return;
    }
    const rect = stage.getBoundingClientRect();
    // The player zone (mirrors cardExitDirector.playerPoint): bottom centre,
    // just off-screen. Drift the dive laterally toward centre for a natural arc.
    const targetY = window.innerHeight + 80 - rect.top;
    const driftX = (window.innerWidth / 2 - (rect.left + rect.width / 2)) * 0.2;
    const tl = gsap.timeline({onComplete: done});
    // The pick-up beat: the card comes off the inspector.
    tl.to(stage, {y: -18, scale: 1.03, rotation: -2, duration: motionMs(130) / 1000, ease: 'power2.out'});
    // The dive home — shrinks toward the hand, fades on the last third.
    tl.to(stage, {x: driftX, y: targetY, scale: 0.5, rotation: -7, duration: motionMs(400) / 1000, ease: 'power2.in'}, '>-0.02');
    tl.to(stage, {autoAlpha: 0, duration: motionMs(150) / 1000, ease: 'power1.in'}, '<55%');
    ctx.tween = tl;
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
  holdSlot(null);
  ctx.origin = undefined;
  ctx.closing = false;
}
