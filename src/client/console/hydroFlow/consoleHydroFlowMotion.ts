/*
 * THE HYDRO SCENE MOTION — the workspace-descend phrase for the hydro scene's
 * layer swaps, and the VP ceremony of the finish positions (10 / 11).
 *
 * The scene under the track is ONE zone whose layers (preview → picker →
 * commit → result) advance IN PLACE: the outgoing layer RELEASES on the spot,
 * the incoming one UNFOLDS from the rect the pressed object occupied (or from
 * the zone itself when nothing was pressed — a server-driven advance), and its
 * content CASCADES from inside. A `v-if` swap is a blink and is banned — this
 * module is what the section's `<transition :css="false">` hooks call.
 *
 * The CEREMONY is the milestone/award language re-anchored to the track: the
 * VP value physically rises OUT of the landed stop, the shared
 * `playCeremonyBurst` fires over the scene seat, and the dwell is long enough
 * to read. The track itself is never dimmed — it is the source of the moment.
 *
 * Reduced motion: every episode resolves instantly (guardedDescend), callbacks
 * in the same order.
 */
import {gsap} from 'gsap';
import {
  armDescendRect, descendCascade, descendRectOf, descendRelease, descendUnfold, guardedDescend,
  killDescendEpisode, takeDescendRect,
} from '@/client/console/surfaceMotion/workspaceDescend';
import {motionMs} from '@/client/components/motion/motionTokens';
import {playCeremonyBurst} from '@/client/console/ceremony/ceremonyFx';
import type {CeremonyBurstHandle} from '@/client/console/ceremony/ceremonyFx';

/** The scene-layer swap episode — a step, not a scene. */
const LAYER_MS = 430;

/** The one-shot origin key of the next layer's unfold (armed at the press). */
const SCENE_RECT_KEY = 'hydro-scene';

/** Arm the rect the NEXT scene layer unfolds from — call SYNCHRONOUSLY in the
 *  press handler (the pressed CTA / summary chip / stop), before the layer
 *  swap re-renders the zone. */
export function armHydroSceneOrigin(el: HTMLElement | null | undefined): void {
  armDescendRect(SCENE_RECT_KEY, descendRectOf(el ?? undefined));
}

/**
 * A scene layer ENTERS: unfold from the armed press rect (or materialize in
 * place when nothing was pressed — a server-driven swap), then cascade the
 * layer's own `[data-unfold-item]` groups from inside.
 */
export function hydroSceneEnterHook(el: Element, done: () => void): void {
  const layer = el as HTMLElement;
  const from = takeDescendRect(SCENE_RECT_KEY);
  const items = Array.from(layer.querySelectorAll<HTMLElement>('[data-unfold-item]'));
  guardedDescend(layer, LAYER_MS, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    if (from === undefined || !descendUnfold(tl, layer, from, motionMs(LAYER_MS) / 1000 * 0.72, 0)) {
      tl.fromTo(layer, {autoAlpha: 0}, {autoAlpha: 1, duration: motionMs(200) / 1000, clearProps: 'opacity,visibility'}, 0);
    }
    if (items.length > 0) {
      descendCascade(tl, items, motionMs(LAYER_MS) / 1000 * 0.45, motionMs(140) / 1000);
    }
    return tl;
  });
}

/** A scene layer LEAVES: its content lets go ON THE SPOT — finished, not moved. */
export function hydroSceneLeaveHook(el: Element, done: () => void): void {
  const layer = el as HTMLElement;
  guardedDescend(layer, 220, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    const items = Array.from(layer.querySelectorAll<HTMLElement>('[data-unfold-item]'));
    if (items.length > 0) {
      descendRelease(tl, items, motionMs(160) / 1000, 0);
    }
    tl.to(layer, {autoAlpha: 0, duration: motionMs(180) / 1000, ease: 'power1.out'}, 0);
    return tl;
  });
}

/** Both cancelled hooks — a killed episode must leave no inline residue. */
export function hydroSceneCancelledHook(el: Element): void {
  killDescendEpisode(el as HTMLElement);
  gsap.set(el, {clearProps: 'all'});
}

// ── THE BRIDGE HANDOFF (a nested FULL-SCENE step: the repeat browser) ───────

/** How long the workspace takes to hand the screen over / take it back. */
const BRIDGE_OUT_MS = 210;
const BRIDGE_IN_MS = 330;
/** The pose the workspace rests in while the nested scene owns the screen. */
const BRIDGE_REST_ALPHA = 0.12;
const BRIDGE_REST_SCALE = 0.985;

function bridgeParts(root: HTMLElement | undefined): {
  layers: Array<HTMLElement>, items: Array<HTMLElement>,
} {
  const layers: Array<HTMLElement> = [];
  const rail = root?.querySelector<HTMLElement>('.con-hydro__rail');
  const scene = root?.querySelector<HTMLElement>('.con-hydro__scene');
  if (rail !== null && rail !== undefined) {
    layers.push(rail);
  }
  if (scene !== null && scene !== undefined) {
    layers.push(scene);
  }
  return {
    layers,
    items: Array.from(root?.querySelectorAll<HTMLElement>('.con-hydro__scene [data-unfold-item]') ?? []),
  };
}

/**
 * HAND THE SCREEN OVER. A nested full-scene step (position 7's repeat
 * browser) needs the whole band, so the workspace RELEASES rather than
 * staying lit underneath: its scene content lets go in place and the track
 * settles back a breath. `done` fires on the settle — the caller opens the
 * nested surface THERE, so the player sees one surface leave and the next
 * arrive, never two workspaces stacked.
 *
 * The rest pose is deliberately LEFT ON the elements: the host hides them
 * (`v-show`) a frame later, and the return animates out of exactly this
 * state — which is what makes the round trip seamless instead of a pop.
 */
export function playHydroBridgeRelease(root: HTMLElement | undefined, done: () => void): void {
  const {layers, items} = bridgeParts(root);
  if (root === undefined || layers.length === 0) {
    done();
    return;
  }
  guardedDescend(root, BRIDGE_OUT_MS, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    if (items.length > 0) {
      descendRelease(tl, items, motionMs(150) / 1000, 0);
    }
    tl.to(layers, {
      opacity: BRIDGE_REST_ALPHA,
      scale: BRIDGE_REST_SCALE,
      transformOrigin: '50% 40%',
      duration: motionMs(BRIDGE_OUT_MS) / 1000,
      ease: 'power2.in',
      overwrite: 'auto',
    }, 0);
    return tl;
  });
}

/**
 * TAKE THE SCREEN BACK. The reverse phrase out of the SAME rest pose the
 * release left behind: the track breathes back in and the scene's groups
 * cascade from inside it. Call it once the host has made the surface
 * visible again (a tween on a `display: none` element would finish unseen
 * and land as a pop).
 */
export function playHydroBridgeReturn(root: HTMLElement | undefined, reduced: boolean): void {
  const {layers, items} = bridgeParts(root);
  if (root === undefined || layers.length === 0) {
    return;
  }
  killDescendEpisode(root);
  if (reduced) {
    gsap.set([...layers, ...items], {clearProps: 'all'});
    return;
  }
  const tl = gsap.timeline();
  tl.to(layers, {
    opacity: 1,
    scale: 1,
    duration: motionMs(BRIDGE_IN_MS) / 1000,
    ease: 'expo.out',
    overwrite: 'auto',
    clearProps: 'transform,opacity',
    onInterrupt: () => gsap.set(layers, {clearProps: 'transform,opacity'}),
  }, 0);
  if (items.length > 0) {
    descendCascade(tl, items, motionMs(260) / 1000, motionMs(90) / 1000);
  }
}

// ── THE VP CEREMONY (positions 10 / 11) ─────────────────────────────────────

export type HydroCeremonyArgs = {
  /** The commit scene layer (the dressing lines live inside it). */
  sceneEl: HTMLElement;
  /** The landed VP stop on the track — the PHYSICAL SOURCE of the value. */
  stopEl: HTMLElement | undefined;
  /** The scene's ceremony seat — where the value settles and the burst fires. */
  seatEl: HTMLElement;
  /** The big «2 ПО» / «5 ПО» value element (inside the seat). */
  valueEl: HTMLElement | undefined;
  /** The dressing lines (stage name / caption), cascaded after the value. */
  dressEls: ReadonlyArray<HTMLElement>;
  reduced: boolean;
  /** The culmination — the burst frame; the caller ticks its VP accent here. */
  onCulmination: () => void;
  onDone: () => void;
};

export type HydroCeremonyHandle = {kill: () => void};

/** The read dwell AFTER the culmination — long enough for the value + lines. */
const CEREMONY_DWELL_MS = 2100;
const CEREMONY_REDUCED_DWELL_MS = 1000;

/**
 * The finish ceremony: the value rises OUT of the landed stop (a
 * zoom-compensated FLIP — one physical object, never a copy fading in), locks
 * into the seat, the shared burst fires, the dressing lines rise, and the
 * dwell holds the frame readable. `onDone` always fires exactly once — kill,
 * reduced motion and the happy path all converge on it.
 */
export function runHydroCeremony(args: HydroCeremonyArgs): HydroCeremonyHandle {
  let burst: CeremonyBurstHandle | undefined;
  let doneFired = false;
  let dwellTimer: ReturnType<typeof setTimeout> | undefined;
  const finish = (): void => {
    if (doneFired) {
      return;
    }
    doneFired = true;
    args.onDone();
  };

  if (args.reduced) {
    args.onCulmination();
    burst = playCeremonyBurst({host: args.seatEl, accent: 'gold', reduced: true});
    dwellTimer = setTimeout(finish, motionMs(CEREMONY_REDUCED_DWELL_MS));
    return {kill: () => {
      if (dwellTimer !== undefined) {
        clearTimeout(dwellTimer);
      }
      burst?.stop();
      finish();
    }};
  }

  const tl = gsap.timeline();
  // The VALUE — born at the stop, settles in the seat. FLIP via the measured
  // delta so the number is ONE object travelling, not two crossfading.
  const value = args.valueEl;
  if (value !== undefined) {
    const stopRect = args.stopEl?.getBoundingClientRect();
    const valueRect = value.getBoundingClientRect();
    if (stopRect !== undefined && valueRect.width > 0) {
      const dx = (stopRect.left + stopRect.width / 2) - (valueRect.left + valueRect.width / 2);
      const dy = (stopRect.top + stopRect.height / 2) - (valueRect.top + valueRect.height / 2);
      tl.fromTo(value,
        {x: dx, y: dy, scale: 0.34, autoAlpha: 0},
        {x: 0, y: 0, scale: 1, autoAlpha: 1, duration: motionMs(640) / 1000, ease: 'power3.out',
          onInterrupt: () => gsap.set(value, {clearProps: 'all'})},
        0.08);
    } else {
      tl.fromTo(value, {autoAlpha: 0, scale: 0.7}, {
        autoAlpha: 1, scale: 1, duration: motionMs(420) / 1000, ease: 'power2.out',
        onInterrupt: () => gsap.set(value, {clearProps: 'all'}),
      }, 0.08);
    }
  }
  // The dressing lines rise once the value is essentially seated.
  if (args.dressEls.length > 0) {
    descendCascade(tl, [...args.dressEls], motionMs(360) / 1000, motionMs(430) / 1000);
  }
  // CULMINATION: the burst + the caller's VP accent, at the value's lock-in.
  tl.call(() => {
    args.onCulmination();
    burst = playCeremonyBurst({host: args.seatEl, accent: 'gold', reduced: false});
  }, undefined, motionMs(560) / 1000);
  tl.call(finish, undefined, (motionMs(560) + motionMs(CEREMONY_DWELL_MS)) / 1000);

  return {kill: () => {
    tl.kill();
    burst?.stop();
    if (value !== undefined) {
      gsap.set(value, {clearProps: 'all'});
    }
    for (const el of args.dressEls) {
      gsap.set(el, {clearProps: 'all'});
    }
    finish();
  }};
}
