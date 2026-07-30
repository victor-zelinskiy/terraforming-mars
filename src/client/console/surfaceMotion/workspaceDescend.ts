/*
 * WORKSPACE DESCEND — the reusable motion grammar for entering a DEEPER
 * decision layer of the SAME workspace (docs/claude/console/workspace-band.md,
 * «Workspace Descend»).
 *
 * A workspace never navigates sideways into its own depths. When the player
 * commits to an object (an action slot, a colony tile, a candidate card), the
 * transition must read as a camera step INTO the press point, with the
 * semantic objects physically carried into the deeper stage:
 *
 *   1. COMMIT PULSE — the chosen object acknowledges the press where it
 *      stands (a one-shot ring flare, CSS class `--descend` on the host);
 *   2. DEPTH RECEDE — the parent layer scales down a breath and dissolves
 *      with its transform-origin AT the press point (never an x/y slide:
 *      lateral motion is section navigation, depth is commitment);
 *   3. OBJECT CARRY — the chosen object(s) FLIP from their browse rects into
 *      their homes on the deeper stage (the card face → the hero, the action
 *      graphic → the stage's action strip);
 *   4. RETURN — B reverses the same phrase: the stage yields, the layer
 *      scales back from the SAME origin, the objects FLIP home.
 *
 * This module owns the PRIMITIVES (named one-shot origin/rect registry, the
 * zoom-compensated FLIP math, the guarded episode runner, the recede/return
 * tweens); a flow's own choreography module (consoleActionFocusMotion) owns
 * the phrase. Everything is transform/opacity only (perf-lite safe), timed
 * through `motionMs`, and safe to interrupt (`guarded` never drops `done`).
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';

// ── The one-shot registries (armed at the press, consumed by the hooks) ─────
//
// Vue's transition hooks fire detached from the press that caused them, so the
// press site ARMS what the hooks will need: a point (the press location — the
// recede origin) or a rect (an object's live box — a FLIP source). Entries
// expire quickly: a stale origin from an abandoned press must never steer a
// later, unrelated transition.

const FRESH_MS = 1000;

type ArmedPoint = {x: number, y: number, at: number};
type ArmedRect = {left: number, top: number, width: number, height: number, at: number};

const points = new Map<string, ArmedPoint>();
const rects = new Map<string, ArmedRect>();

/** Arm the PRESS POINT for a named descent (the recede's transform-origin). */
export function armDescendOrigin(key: string, point: {x: number, y: number} | undefined): void {
  if (point === undefined) {
    points.delete(key);
    return;
  }
  points.set(key, {...point, at: Date.now()});
}

/** Consume the armed press point (undefined when missing or stale). */
export function takeDescendOrigin(key: string): {x: number, y: number} | undefined {
  const armed = points.get(key);
  points.delete(key);
  return armed === undefined || Date.now() - armed.at > FRESH_MS ? undefined : armed;
}

/** Arm an OBJECT's live rect for a named carry (a FLIP source). */
export function armDescendRect(key: string, rect: {left: number, top: number, width: number, height: number} | undefined): void {
  if (rect === undefined || rect.width < 10 || rect.height < 10) {
    rects.delete(key);
    return;
  }
  const {left, top, width, height} = rect;
  rects.set(key, {left, top, width, height, at: Date.now()});
}

/** Consume an armed rect (undefined when missing or stale). */
export function takeDescendRect(key: string): {left: number, top: number, width: number, height: number} | undefined {
  const armed = rects.get(key);
  rects.delete(key);
  return armed === undefined || Date.now() - armed.at > FRESH_MS ? undefined : armed;
}

/** Flow boundary (game switch / unmount): no armed state may leak across. */
export function resetWorkspaceDescend(): void {
  points.clear();
  rects.clear();
}

// ── The guarded episode runner (the surfaceMotionDirector idiom) ────────────

const liveTweens = new WeakMap<Element, gsap.core.Timeline | gsap.core.Tween>();

export function killDescendEpisode(el: Element): void {
  liveTweens.get(el)?.kill();
  liveTweens.delete(el);
}

/**
 * Run one guarded motion episode on an element: the previous episode dies
 * first, `done` fires exactly once (completion OR the safety timer), and an
 * interrupted episode can never strand the transition.
 */
export function guardedDescend(
  el: Element,
  totalMs: number,
  done: () => void,
  body: (finish: () => void) => gsap.core.Timeline | gsap.core.Tween | undefined,
): void {
  killDescendEpisode(el);
  let finished = false;
  let safety = 0;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    window.clearTimeout(safety);
    liveTweens.delete(el);
    done();
  };
  const tween = body(finish);
  if (tween === undefined) {
    finish();
    return;
  }
  liveTweens.set(el, tween);
  safety = window.setTimeout(finish, motionMs(totalMs) + 450);
}

// ── The FLIP math (zoom-compensated) ────────────────────────────────────────

/**
 * Transform-only FLIP args from an old viewport rect into an element's CURRENT
 * box, compensated for the CSS `zoom:` context the element sits in (transform
 * px inside a zoomed subtree are rescaled by the browser).
 */
export function descendFlipFrom(el: HTMLElement, from: {left: number, top: number, width: number, height: number}):
  {x: number, y: number, scale: number} | undefined {
  const to = el.getBoundingClientRect();
  if (to.width < 10 || to.height < 10) {
    return undefined;
  }
  const scale = from.width / to.width;
  if (!isFinite(scale) || scale <= 0) {
    return undefined;
  }
  const effZoom = el.offsetWidth > 0 ? to.width / el.offsetWidth : 1;
  return {
    x: (from.left - to.left) / effZoom,
    y: (from.top - to.top) / effZoom,
    scale,
  };
}

// ── The depth recede / return tweens ────────────────────────────────────────

/** How deep the parent layer steps back (scale) during a descent. */
const RECEDE_SCALE = 0.985;

/** The layer's remembered recede origin — the RETURN must breathe back from
 *  the same point or the reverse reads as a different room. */
const recedeOrigins = new WeakMap<Element, string>();

/**
 * The parent layer RECEDES: a breath of scale-down + dissolve, with the
 * transform-origin at the press point (viewport coords → the layer's own
 * space). Add it to a timeline at `at`.
 */
export function descendRecede(
  tl: gsap.core.Timeline,
  layer: HTMLElement,
  pressPoint: {x: number, y: number} | undefined,
  durationS: number,
  at: number | string = 0,
): void {
  const rect = layer.getBoundingClientRect();
  const origin = pressPoint !== undefined && rect.width > 0 ?
    `${Math.round(pressPoint.x - rect.left)}px ${Math.round(pressPoint.y - rect.top)}px` :
    '50% 50%';
  recedeOrigins.set(layer, origin);
  tl.to(layer, {
    autoAlpha: 0,
    scale: RECEDE_SCALE,
    transformOrigin: origin,
    duration: durationS,
    ease: 'power2.in',
    overwrite: 'auto',
  }, at);
}

/**
 * The parent layer RETURNS: scale back to rest from the SAME remembered
 * origin, fading in. Clears its transform when done.
 */
export function descendReturn(
  tl: gsap.core.Timeline,
  layer: HTMLElement,
  durationS: number,
  at: number | string = 0,
): void {
  const origin = recedeOrigins.get(layer) ?? '50% 50%';
  recedeOrigins.delete(layer);
  tl.fromTo(layer,
    {autoAlpha: 0, scale: RECEDE_SCALE, transformOrigin: origin},
    {autoAlpha: 1, scale: 1, duration: durationS, ease: 'expo.out', clearProps: 'transform,opacity,visibility', overwrite: 'auto'},
    at);
}

/** Restore a layer to the RECEDED end state (an interrupted return). */
export function descendParkLayer(layer: HTMLElement): void {
  gsap.set(layer, {autoAlpha: 0, scale: RECEDE_SCALE, transformOrigin: recedeOrigins.get(layer) ?? '50% 50%'});
}

/** px scaled by the console UI scale (the shared px-space convention). */
export function descendPx(px: number): number {
  return px * conUiScale();
}
