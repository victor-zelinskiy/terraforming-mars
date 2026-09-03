/*
 * @console-shared LIVE — console native stands on this file.
 *
 * CLONE-PROXY CARD FLIGHTS — fly pixel-true CLONES of real card nodes
 * rect→rect. Extracted from the draft workspace's LT spread/collect (its
 * `flyClones`) so every surface that moves a card between two of ITS OWN
 * mounted seats speaks the same physical language instead of re-rolling the
 * zoom/coordinate math (the campaign carryover picker is the second client).
 *
 * The physics contract this implements (`.claude/rules/console-ui.md`
 * § A FLYING CARD):
 *  · the flight layer is mounted by the BODY, never inside the surface —
 *    `position: fixed` resolves against ANY ancestor that establishes a
 *    containing block (a transform, an entrance animation, a `zoom`);
 *  · the clone reproduces the RENDERED size via its own `zoom` = rect /
 *    natural width, is PLACED with left/top in its own zoomed space and only
 *    ever moves by a DELTA — a translate-for-placement multiplies any zoom
 *    rounding into the «cards fly in from the top-left» bug;
 *  · touchdown = the real slot materializes UNDER the clone, the clone leaves
 *    on the NEXT frame — never a crossfade of identical twins;
 *  · every card lands on its own cadence (the stagger sits at the
 *    landing-cadence floor), and the batch owns and disposes ITS clones.
 */
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';

/** Rects for every name, or undefined when ANY is unmeasurable — a
 *  half-measured convoy teleports half its cards, so it never flies. */
export function measureCardRects(
  names: ReadonlyArray<CardName>,
  elOf: (n: CardName) => HTMLElement | null,
): Map<CardName, DOMRect> | undefined {
  const out = new Map<CardName, DOMRect>();
  for (const name of names) {
    const el = elOf(name);
    const r = el?.getBoundingClientRect();
    if (r === undefined || r.width < 8 || r.height < 8) {
      return undefined;
    }
    out.set(name, r);
  }
  return out;
}

export type CloneFlightOptions = {
  names: ReadonlyArray<CardName>;
  /** The REAL card node to clone for this name (its printed face at its
   *  rendered size — the parity contract's «same picture» half). */
  sourceEl: (name: CardName) => HTMLElement | null;
  from: Map<CardName, DOMRect>;
  to: Map<CardName, DOMRect>;
  /** The flight layer's class (per-surface, for styling/diagnostics). */
  layerClass: string;
  /** Per-card touchdown — reveal the REAL destination slot here. */
  onLand: (name: CardName) => void;
  /** The whole convoy has landed and every clone left. */
  onDone: () => void;
  /** Base per-card travel (default 460 ms through the motion scale). */
  travelMs?: number;
  /** Launch stagger (default 96 ms — the landing-cadence floor). */
  staggerMs?: number;
};

export type CloneFlightHandle = {
  /** Tear the layer down (unmount safety) — interrupt callbacks still run. */
  dispose(): void;
};

export function flyCardClones(opts: CloneFlightOptions): CloneFlightHandle {
  const layer = document.createElement('div');
  layer.className = opts.layerClass;
  layer.style.cssText = 'position:fixed;inset:0;z-index:11640;pointer-events:none;overflow:clip;';
  document.body.appendChild(layer);
  let landed = 0;
  const total = opts.names.length;
  const finishOne = (name: CardName) => {
    opts.onLand(name);
    landed++;
    if (landed >= total) {
      // Handoff: reveal happened per-card; the layer leaves next frame.
      requestAnimationFrame(() => opts.onDone());
    }
  };
  opts.names.forEach((name, i) => {
    const src = opts.sourceEl(name);
    const f = opts.from.get(name);
    const t = opts.to.get(name);
    if (src === null || f === undefined || t === undefined) {
      finishOne(name);
      return;
    }
    const clone = src.cloneNode(true) as HTMLElement;
    // The source sits under an ancestor `zoom`; the clone reproduces the
    // RENDERED size via its own zoom = rect / natural (see the header for
    // why placement is left/top in the clone's OWN zoomed space and the
    // movement a DELTA — never a translate-for-placement).
    const natural = src.offsetWidth || 1;
    const z = f.width / natural;
    clone.style.cssText = `position:fixed;left:${(f.left / z).toFixed(2)}px;top:${(f.top / z).toFixed(2)}px;` +
      `margin:0;zoom:${z.toFixed(4)};transform-origin:top left;will-change:transform;`;
    // De-identify: a clone must never be found by slot/zoom resolvers.
    clone.removeAttribute('data-zoom-slot');
    for (const el of Array.from(clone.querySelectorAll(
      '[data-zoom-slot], [data-tray-slot], [data-inspect-slot], [data-hand-dock-card], [data-carry-card], [data-carry-slot]'))) {
      el.removeAttribute('data-zoom-slot');
      el.removeAttribute('data-tray-slot');
      el.removeAttribute('data-inspect-slot');
      el.removeAttribute('data-hand-dock-card');
      el.removeAttribute('data-carry-card');
      el.removeAttribute('data-carry-slot');
    }
    layer.appendChild(clone);
    const scale = t.width / f.width;
    gsap.set(clone, {x: 0, y: 0, scale: 1});
    const dur = consoleMotionMs(opts.travelMs ?? 460) / 1000;
    const at = i * (consoleMotionMs(opts.staggerMs ?? 96) / 1000);
    const tl = gsap.timeline({delay: at});
    tl.to(clone, {x: (t.left - f.left) / z, duration: dur, ease: 'power2.inOut'}, 0);
    tl.to(clone, {y: (t.top - f.top) / z, duration: dur, ease: 'power3.out'}, 0);
    tl.to(clone, {scale, duration: dur, ease: 'power2.inOut'}, 0);
    // Touchdown: the real slot materializes UNDER the clone; the clone
    // leaves on the next frame (never a crossfade of identical twins).
    const settle = () => {
      finishOne(name);
      requestAnimationFrame(() => clone.remove());
    };
    tl.eventCallback('onComplete', settle);
    tl.eventCallback('onInterrupt', settle);
  });
  if (total === 0) {
    opts.onDone();
  }
  return {
    dispose: () => layer.remove(),
  };
}
