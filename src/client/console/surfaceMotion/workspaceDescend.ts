/*
 * WORKSPACE DESCEND — the reusable motion grammar for entering a DEEPER
 * decision layer of the SAME workspace (docs/claude/console/workspace-band.md,
 * «Workspace Descend»).
 *
 * A workspace never navigates sideways into its own depths. When the player
 * commits to an object (an action slot, a colony tile, a candidate card), the
 * transition must read as the PRESSED SURFACE opening into its own deeper
 * state — never as a widget flying into an unrelated modal:
 *
 *   1. COMMIT PULSE — the chosen object acknowledges the press where it
 *      stands (a one-shot ring flare, CSS class `--descend` on the host);
 *   2. CONTENT RELEASE — the object's own content (its graphic, its labels)
 *      lets go IN PLACE: it dissolves where it stands, it never travels;
 *   3. SURFACE UNFOLD — the deeper stage's surface OPENS from the pressed
 *      object's rect (a clip-path expansion, so nothing is distorted and the
 *      lit edge IS the button's frame growing into the panel), while the
 *      parent layer recedes into the same press point;
 *   4. OBJECT CARRY — only genuinely SEMANTIC objects are carried across (the
 *      source card face → the stage hero). UI content is released, not flown:
 *      a carried widget reads as a transplant, a carried subject reads as
 *      continuity;
 *   5. CONTEXT REVEAL — the deeper stage's controls surface from INSIDE the
 *      opened surface (a short stagger), never sliding in from elsewhere;
 *   6. RETURN — B reverses the same phrase: the controls let go, the surface
 *      FOLDS back into the object's rect, the carried objects FLIP home, the
 *      layer breathes back from the SAME origin.
 *
 * This module owns the PRIMITIVES (named one-shot origin/rect registry, the
 * zoom-compensated FLIP + clip math, the guarded episode runner, the
 * recede/return/unfold/fold tweens); a flow's own choreography module
 * (consoleActionFocusMotion) owns the phrase. Everything is
 * transform/opacity/clip (perf-lite safe — no `filter`, no layout property),
 * timed through `motionMs`, and safe to interrupt (`guarded` never drops
 * `done`).
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

// ── SURFACE UNFOLD — the pressed object's surface opening into the stage ────
//
// The deeper stage's own panel is CLIPPED down to the pressed object's rect
// and then opened to full size. Nothing is scaled, so no radius/ring/text is
// distorted, and the panel's lit inset edge travels exactly along the opening
// boundary — the button's frame IS what becomes the panel's frame. The
// clip lives on ONE element for one short beat (no `filter`, no layout
// property: perf-lite safe).

/** Read an element's resting corner radius in its own (pre-zoom) px space. */
function radiusOf(el: HTMLElement): number {
  const raw = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return isFinite(raw) ? raw : 0;
}

/**
 * The `clip-path` inset that crops `surface` down to the viewport rect
 * `from`, expressed in the surface's OWN coordinate space (CSS `zoom:`
 * contexts compensated) and rounded like the pressed object.
 */
export function descendSurfaceInset(
  surface: HTMLElement,
  from: {left: number, top: number, width: number, height: number},
  fromRadiusPx?: number,
): string | undefined {
  const to = surface.getBoundingClientRect();
  if (to.width < 10 || to.height < 10) {
    return undefined;
  }
  const effZoom = surface.offsetWidth > 0 ? to.width / surface.offsetWidth : 1;
  const px = (v: number) => Math.max(0, Math.round(v / effZoom));
  const top = px(from.top - to.top);
  const left = px(from.left - to.left);
  const right = px(to.right - (from.left + from.width));
  const bottom = px(to.bottom - (from.top + from.height));
  const radius = Math.round(fromRadiusPx ?? radiusOf(surface));
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius}px)`;
}

/** The surface's resting clip (full box, own radius) — the unfold's end. */
function restingInset(surface: HTMLElement): string {
  return `inset(0px 0px 0px 0px round ${Math.round(radiusOf(surface))}px)`;
}

/**
 * The deeper surface UNFOLDS from the pressed object's rect. Returns false
 * when the geometry is unusable (the caller falls back to a plain reveal).
 */
export function descendUnfold(
  tl: gsap.core.Timeline,
  surface: HTMLElement,
  from: {left: number, top: number, width: number, height: number} | undefined,
  durationS: number,
  at: number | string = 0,
  fromRadiusPx?: number,
): boolean {
  const start = from === undefined ? undefined : descendSurfaceInset(surface, from, fromRadiusPx);
  if (start === undefined) {
    return false;
  }
  tl.fromTo(surface,
    {clipPath: start, webkitClipPath: start},
    {
      clipPath: restingInset(surface), webkitClipPath: restingInset(surface),
      duration: durationS, ease: 'power3.inOut',
      clearProps: 'clipPath,webkitClipPath', overwrite: 'auto',
    },
    at);
  return true;
}

/** The reverse: the surface FOLDS back into the object's rect and lets go. */
export function descendFold(
  tl: gsap.core.Timeline,
  surface: HTMLElement,
  to: {left: number, top: number, width: number, height: number} | undefined,
  durationS: number,
  at: number | string = 0,
  toRadiusPx?: number,
): boolean {
  const end = to === undefined ? undefined : descendSurfaceInset(surface, to, toRadiusPx);
  if (end === undefined) {
    return false;
  }
  // A `to` (not `fromTo`) so an INTERRUPTED unfold folds back from wherever
  // it got to — B during the opening reads as one continuous move. A surface
  // at rest carries no clip at all, so seed the resting inset first, else
  // there is nothing to interpolate from.
  const current = getComputedStyle(surface).clipPath;
  if (current === '' || current === 'none') {
    const rest = restingInset(surface);
    gsap.set(surface, {clipPath: rest, webkitClipPath: rest});
  }
  tl.to(surface,
    {clipPath: end, webkitClipPath: end, duration: durationS, ease: 'power3.in', overwrite: 'auto'},
    at);
  return true;
}

/**
 * CONTENT RELEASE — the pressed object's own content lets go WHERE IT STANDS
 * (a breath of scale-in + dissolve). The opposite of a carry: this content
 * belongs to the browse layer and has no business on the deeper stage.
 */
export function descendRelease(
  tl: gsap.core.Timeline,
  els: ReadonlyArray<HTMLElement>,
  durationS: number,
  at: number | string = 0,
): void {
  const live = els.filter((el) => el !== null && el !== undefined);
  if (live.length === 0) {
    return;
  }
  tl.to(live, {
    autoAlpha: 0, scale: 0.965, transformOrigin: '50% 50%',
    duration: durationS, ease: 'power2.in', overwrite: 'auto',
  }, at);
}

/**
 * CONTEXT REVEAL — the deeper stage's controls surface from INSIDE the opened
 * surface: a short lift + fade with a stagger, never a slide from off-panel.
 */
export function descendCascade(
  tl: gsap.core.Timeline,
  els: ReadonlyArray<HTMLElement>,
  durationS: number,
  at: number | string = 0,
  staggerS = 0.035,
): void {
  const live = els.filter((el) => el !== null && el !== undefined);
  if (live.length === 0) {
    return;
  }
  tl.fromTo(live,
    {autoAlpha: 0, y: descendPx(9)},
    {
      autoAlpha: 1, y: 0, duration: durationS, ease: 'expo.out', stagger: staggerS,
      clearProps: 'transform,opacity,visibility', overwrite: 'auto',
    },
    at);
}

/** The reverse of the cascade: the controls let go together, in place. */
export function descendCascadeOut(
  tl: gsap.core.Timeline,
  els: ReadonlyArray<HTMLElement>,
  durationS: number,
  at: number | string = 0,
): void {
  const live = els.filter((el) => el !== null && el !== undefined);
  if (live.length === 0) {
    return;
  }
  tl.to(live, {autoAlpha: 0, duration: durationS, ease: 'power1.in', overwrite: 'auto'}, at);
}

/** A live viewport rect, or undefined when the element is not laid out. */
export function descendRectOf(el: Element | null | undefined): {left: number, top: number, width: number, height: number} | undefined {
  const rect = el?.getBoundingClientRect?.();
  return rect === undefined || rect.width < 10 || rect.height < 10 ?
    undefined :
    {left: rect.left, top: rect.top, width: rect.width, height: rect.height};
}

/** The pressed object's corner radius (the unfold's starting roundness). */
export function descendRadiusOf(el: HTMLElement | null | undefined): number | undefined {
  return el === null || el === undefined ? undefined : radiusOf(el);
}

/** px scaled by the console UI scale (the shared px-space convention). */
export function descendPx(px: number): number {
  return px * conUiScale();
}
