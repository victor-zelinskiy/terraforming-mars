/*
 * SETUP → OUTCOME — the second half of the ACTION FOCUS phrase.
 *
 * Entering an action already reads as one movement: the pressed slot's own
 * SURFACE unfolds into the configuration panel (workspaceDescend / WORKSPACE
 * DESCEND). Leaving setup for the outcome used to read as nothing at all — a
 * `v-if` swap, i.e. a blink — which is exactly what broke the illusion: the
 * player confirmed inside one surface and a different-looking screen was
 * simply there, so «покупка» felt like a modal that had arrived rather than
 * the next step of the action they had just committed.
 *
 * So the outcome speaks the SAME grammar as the entry, one level deeper:
 *
 *   RELEASE  — the configuration content (rules, decisions, CTA) goes out ON
 *              THE SPOT. Nothing travels: it is finished, not moved.
 *   UNFOLD   — the outcome zone opens from the RECT THE CONFIGURATION SURFACE
 *              OCCUPIED, so the new content grows out of the place the old one
 *              stood rather than fading in over it. The frame, the band, the
 *              rail and the hero card do not move at all — the workspace is
 *              standing still while its inner state advances.
 *   REVEAL   — the outcome's own content surfaces from inside the opened zone.
 *
 * The hero card is deliberately NOT re-animated: it is the one object carried
 * through the whole flow, and re-playing it on every phase would make the
 * player re-read what has not changed (the lesson of iteration 10→11 — carry
 * ONE semantic object, let the surface do the continuity).
 *
 * Reduced motion: every episode resolves instantly through `guardedDescend`,
 * callbacks in the same order.
 */
import {gsap} from 'gsap';
import {
  descendCascade, descendRelease, descendRectOf, descendUnfold, guardedDescend,
} from '@/client/console/surfaceMotion/workspaceDescend';
import {motionMs} from '@/client/components/motion/motionTokens';

/** The whole setup→outcome episode. Short: it is a step, not a scene. */
const PHASE_MS = 460;

/** Selectors inside the composer, resolved at play time (never cached). */
const CONFIG_SURFACE = '[data-unfold-surface]';
const OUTCOME_ZONE = '[data-outcome-zone]';
const OUTCOME_ITEM = '[data-outcome-item]';

/**
 * The rect the outcome unfolds FROM, captured while the configuration surface
 * is still standing. Armed synchronously at confirm time (before the stage
 * re-renders), because by the time the outcome mounts its predecessor is gone.
 */
let originRect: {left: number, top: number, width: number, height: number} | undefined;
let armedAt = 0;

/** How long a captured rect stays trustworthy (a stale one would open from a
 *  box that has since moved — the layout-jump the phrase exists to avoid). */
const FRESH_MS = 1500;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

/**
 * Capture the configuration surface's box. Call SYNCHRONOUSLY in the confirm
 * handler, while the surface is still on screen.
 */
export function armOutcomeOrigin(root: HTMLElement | undefined): void {
  const surface = root?.querySelector<HTMLElement>(CONFIG_SURFACE);
  armOutcomeOriginFrom(surface);
}

/**
 * The same arm for a host whose configuration surface is not the whole panel
 * (the colony focus stage keeps its identity column standing and hands only
 * its WORKING area to the outcome). Pass the element the zone will open from.
 */
export function armOutcomeOriginFrom(el: HTMLElement | null | undefined): void {
  originRect = descendRectOf(el ?? undefined);
  armedAt = now();
}

/** Forget the armed rect (cancel / unmount). */
export function resetOutcomeOrigin(): void {
  originRect = undefined;
  armedAt = 0;
}

function takeOrigin(): {left: number, top: number, width: number, height: number} | undefined {
  const rect = originRect;
  const fresh = rect !== undefined && now() - armedAt < FRESH_MS;
  originRect = undefined;
  return fresh ? rect : undefined;
}

/**
 * Play the phase. `root` is the composer's root element; `done` fires when the
 * episode settles (or immediately under reduced motion).
 */
export function playOutcomePhase(root: HTMLElement | undefined, done: () => void): void {
  const zone = root?.querySelector<HTMLElement>(OUTCOME_ZONE) ?? undefined;
  if (root === undefined || zone === undefined) {
    done();
    return;
  }
  const from = takeOrigin() ?? descendRectOf(zone);
  const items = Array.from(root.querySelectorAll<HTMLElement>(OUTCOME_ITEM));

  guardedDescend(zone, PHASE_MS, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // UNFOLD from where the configuration surface stood. `descendUnfold`
    // clips (never scales), so no text or border is distorted on the way —
    // the glowing inner edge simply travels along the opening boundary.
    if (from === undefined || !descendUnfold(tl, zone, from, motionMs(PHASE_MS) / 1000 * 0.72, 0)) {
      tl.fromTo(zone, {autoAlpha: 0}, {autoAlpha: 1, duration: motionMs(220) / 1000}, 0);
    }
    // REVEAL: the outcome's own content surfaces from inside the opened zone,
    // slightly behind the opening edge so it reads as coming OUT of it.
    if (items.length > 0) {
      descendCascade(tl, items, motionMs(PHASE_MS) / 1000 * 0.45, motionMs(150) / 1000);
    }
    return tl;
  });
}

/**
 * The REVEAL half, arriving with its content: the surface that was teleported
 * into the already-open zone surfaces from INSIDE it, rather than simply being
 * there. The zone itself is not touched — it is already open and must not move
 * a second time.
 */
export function playOutcomeContent(root: HTMLElement | undefined): void {
  const zone = root?.querySelector<HTMLElement>(OUTCOME_ZONE);
  if (zone === null || zone === undefined) {
    return;
  }
  // The re-homed surface's own root(s) — whatever the shell teleported in.
  const landed = Array.from(zone.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && !el.hasAttribute('data-outcome-item'));
  if (landed.length === 0) {
    return;
  }
  const tl = gsap.timeline();
  descendCascade(tl, landed, motionMs(300) / 1000, 0);
}

/**
 * The configuration content leaves ON THE SPOT (no travel) — played on the
 * outgoing side, immediately before the outcome mounts.
 */
export function playConfigRelease(root: HTMLElement | undefined): void {
  const items = root === undefined ?
    [] :
    Array.from(root.querySelectorAll<HTMLElement>('[data-unfold-item]'));
  if (items.length === 0) {
    return;
  }
  const tl = gsap.timeline();
  descendRelease(tl, items, motionMs(180) / 1000, 0);
}
