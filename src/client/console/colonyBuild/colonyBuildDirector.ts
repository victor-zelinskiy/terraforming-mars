/*
 * colonyBuildDirector — the GSAP hands of the console colony-build hero scene.
 * Owns ONLY the DOM/tween work on the fixed stage (ConsoleColonyBuildLayer):
 * the cube's fly-in to the WAITING hover above the slot, the gravity drop into
 * the slot centre once the bonus has left, the physical contact beat, and the
 * instant, seamless handoff onto the real committed cube. No game state, no Vue.
 *
 * THE CUBE IS ONE PHYSICAL OBJECT — the SAME premium 3D `PlayerCube` token the
 * main board uses. It is mounted at its FINAL size and never re-scaled in
 * flight; the whole choreography follows the component's own animation
 * contract (see player_cube.less): motion runs on the FLAT `__scene` layer —
 * NEVER a transform/filter on the 3D `__cube` itself — while the `__shadow`
 * stays on the ground (tightening as the cube closes in, spreading at impact)
 * and the `__glow` ignites on contact. The landing adds a base-anchored
 * micro-squash that recovers to EXACTLY scale 1 plus a one-shot impact ring,
 * so the settled proxy is byte-identical to the static in-cell cube and
 * removing it at the handoff is invisible.
 *
 * Physics discipline: transform/opacity only; the layer owns absolute
 * positioning + the cube's material (the real PlayerCube renders itself);
 * every entry point resolves (guarded budgets) and `killColonyBuildTweens`
 * reverts everything.
 */

import {gsap} from 'gsap';
import {BuildRect, CUBE_WAIT_LIFT_FACTOR, CUBE_APPROACH_EXTRA_FACTOR} from '@/client/console/colonyBuild/colonyBuildModel';

export type ColonyBuildStageEls = {
  /** The positioned wrapper at the slot rect (the dispose target). */
  root: HTMLElement,
  /** The cube's flat flight layer (`.player-cube__scene`) — all motion here. */
  scene: HTMLElement,
  /** The ground contact shadow (`.player-cube__shadow`) — stays at the slot. */
  shadow: HTMLElement,
  /** The token bloom (`.player-cube__glow`) — ignites on contact. */
  glow: HTMLElement,
  /** The one-shot impact ring at the cube's base (layer-owned element). */
  ring: HTMLElement,
};

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

/** The waiting height (px) above the slot the cube hovers at while the bonus leaves. */
export function waitLiftPx(slot: BuildRect): number {
  return Math.max(20, slot.h * CUBE_WAIT_LIFT_FACTOR);
}

/**
 * Pose the stage BEFORE the first frame: the cube (scene layer) lifted high
 * above its slot — higher still than the waiting pose, so it FLIES IN to
 * waiting — and invisible until the approach starts; the ground shadow faint
 * and small at the landing spot; glow dark; ring dormant. The cube itself is
 * already mounted at FINAL size — only transforms from here on.
 *
 * NOTE the shadow/glow sets re-express the components' own CSS resting
 * transforms (translateX(-50%) / translateY(-20%)) as GSAP xPercent/yPercent
 * so later tweens COMPOSE with them instead of overwriting.
 */
export function placeCubeProxy(els: ColonyBuildStageEls, opts: {slot: BuildRect}): boolean {
  if (opts.slot.w < 4 || opts.slot.h < 4) {
    return false;
  }
  const lift = waitLiftPx(opts.slot);
  gsap.set(els.scene, {
    y: -(lift + opts.slot.h * CUBE_APPROACH_EXTRA_FACTOR),
    scaleX: 1,
    scaleY: 1,
    autoAlpha: 0,
    transformOrigin: '50% 88%', // base-anchored — the contact squash presses INTO the slot
  });
  gsap.set(els.shadow, {xPercent: -50, opacity: 0, scale: 0.55, transformOrigin: '50% 50%'});
  gsap.set(els.glow, {yPercent: -20, opacity: 0});
  gsap.set(els.ring, {xPercent: -50, yPercent: -50, opacity: 0, scale: 0.5, transformOrigin: '50% 50%'});
  // Everything is posed airborne/dark — only now may the stage itself show
  // (its CSS mounts it invisible so nothing can flash seated-in-slot).
  gsap.set(els.root, {autoAlpha: 1});
  return true;
}

/**
 * The FLY-IN: the cube materializes already moving and glides down to the
 * WAITING hover just above the slot (never a pop-in), its drop shadow
 * gathering faintly on the ground beneath. At the hover it keeps a gentle
 * live float (killed by the descent) instead of freezing dead. Resolves at
 * the waiting pose; the float continues past resolution by design.
 */
export function playCubeApproach(els: ColonyBuildStageEls, opts: {slot: BuildRect, ms: number}): Promise<void> {
  const lift = waitLiftPx(opts.slot);
  const bobAmp = Math.max(1.5, opts.slot.h * 0.05);
  return guarded((done) => {
    const tl = gsap.timeline({
      onComplete: () => {
        // Hover float — the cube is HELD above the slot, not parked. Infinite;
        // playCubeDescent kills it and tweens from the live position.
        gsap.to(els.scene, {y: -lift + bobAmp, duration: 1.05, ease: 'sine.inOut', yoyo: true, repeat: -1});
        done();
      },
    });
    tl.to(els.scene, {autoAlpha: 1, duration: Math.min(0.14, opts.ms / 2000), ease: 'power1.out'}, 0);
    tl.to(els.scene, {y: -lift, duration: opts.ms / 1000, ease: 'power2.out'}, 0);
    // The ground acknowledges the hovering cube: a faint, soft pre-shadow.
    tl.to(els.shadow, {opacity: 0.3, scale: 0.75, duration: opts.ms / 1000, ease: 'power2.out'}, 0);
  }, opts.ms + 300);
}

/**
 * The DROP + CONTACT: the bonus has left the slot, so the cube commits — a
 * small pick-up anticipation, then a gravity-accelerated fall to the slot
 * centre. Touchdown is a physical beat: a base-anchored micro-squash that
 * recovers to EXACTLY 1, the shadow snapping tight through the fall and
 * spreading under the impact, the token glow igniting, and a one-shot impact
 * ring washing out at the base. Resolves only at FULL visual rest (scale 1,
 * shadow/glow at the static cube's CSS resting values) so the commit handoff
 * always lands on a motionless, pixel-identical cube.
 */
export function playCubeDescent(els: ColonyBuildStageEls, opts: {dropMs: number, settleMs: number}): Promise<void> {
  const drop = opts.dropMs / 1000;
  const settle = opts.settleMs / 1000;
  return guarded((done) => {
    gsap.killTweensOf(els.scene); // stop the hover float; tween from the live pose
    const tl = gsap.timeline({onComplete: done});
    // Anticipation — the slight lift of a hand about to place the piece.
    tl.to(els.scene, {y: '-=' + Math.max(3, els.root.clientHeight * 0.1), duration: drop * 0.24, ease: 'sine.out'}, 0);
    // Gravity — accelerate all the way into contact (no early deceleration).
    tl.to(els.scene, {y: 0, duration: drop * 0.76, ease: 'power3.in'}, '>');
    // The ground braces: the shadow tightens + darkens as the cube closes in.
    tl.to(els.shadow, {opacity: 0.85, scale: 0.95, duration: drop * 0.76, ease: 'power3.in'}, drop * 0.24);
    // ── CONTACT (t = drop) ─────────────────────────────────────────────
    // Micro-squash pressed into the base, then a soft recover to exactly 1.
    tl.to(els.scene, {scaleX: 1.055, scaleY: 0.9, duration: settle * 0.22, ease: 'power2.out'}, drop);
    tl.to(els.scene, {scaleX: 0.99, scaleY: 1.012, duration: settle * 0.34, ease: 'sine.inOut'}, '>');
    tl.to(els.scene, {scaleX: 1, scaleY: 1, duration: settle * 0.3, ease: 'sine.out'}, '>');
    // The shadow takes the weight: spreads under the impact, then seats.
    tl.to(els.shadow, {opacity: 1, scale: 1.16, duration: settle * 0.2, ease: 'power2.out'}, drop);
    tl.to(els.shadow, {scale: 1, duration: settle * 0.5, ease: 'sine.out'}, '>');
    // The token lights up on contact — a brief over-bloom easing to the
    // static cube's CSS resting glow (opacity 0.28).
    tl.to(els.glow, {opacity: 0.5, duration: settle * 0.2, ease: 'power1.out'}, drop);
    tl.to(els.glow, {opacity: 0.28, duration: settle * 0.55, ease: 'sine.out'}, '>');
    // One-shot impact ring washing outward from the base.
    tl.fromTo(els.ring,
      {opacity: 0.42, scale: 0.5},
      {opacity: 0, scale: 1.5, duration: Math.min(0.34, settle * 0.8), ease: 'power2.out'}, drop);
  }, opts.dropMs + opts.settleMs + 300);
}

/**
 * The seamless handoff: the real in-cell PlayerCube is already painted
 * underneath with IDENTICAL geometry + material, so the whole proxy stage is
 * removed in ONE frame (no opacity ramp / crossfade blur that would read as a
 * change). Instant by design. Kills any straggler tween first (the hover float
 * is infinite on a degraded path where the descent never ran) so nothing keeps
 * ticking on the soon-unmounted stage.
 */
export function disposeCubeProxy(els: ColonyBuildStageEls): void {
  killColonyBuildTweens(els);
  gsap.set(els.root, {autoAlpha: 0});
}

/** Abort/unmount: kill every tween on the stage (idempotent). */
export function killColonyBuildTweens(els: ColonyBuildStageEls): void {
  gsap.killTweensOf([els.root, els.scene, els.shadow, els.glow, els.ring]);
}
