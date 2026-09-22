/*
 * THE VOTE MODE'S MOTION — the Parliament's browse ⇄ vote choreography,
 * spoken in the WORKSPACE DESCEND grammar (surfaceMotion/workspaceDescend.ts)
 * exactly as the Action Browser's browse ⇄ focus phrase and the colony
 * workspace's browse ⇄ focus phrase.
 *
 * THE THREE RESOLUTION CARDS ARE THE CONTINUITY. They are not copied into the
 * vote mode: the overview's slot elements are TELEPORTED into the vote row
 * (one DOM instance each — a second copy can never exist), and this module
 * animates that layout change as a FLIP of every carried object from the rect
 * it had a frame ago:
 *
 *  · COMMIT — the pressed voting block answers where it stands;
 *  · RECEDE — the rest of the overview (government · parties · Agenda · the
 *    voting head) steps back INTO the press point; the voting plate's own
 *    chrome dissolves in place (the info surface takes its rect over). The
 *    HEAD LINE — the crumb and the delegates zone — is outside the field
 *    and does not move: the delegates' places keep their coordinates in
 *    both modes, so the eye never has to find them again;
 *  · CARRY — each card face FLIPs from its overview rect into its vote rect,
 *    each delegate cube from its old ribbon place into its new one, each
 *    label and tally with them (the same elements — the eye never loses an
 *    object);
 *  · SURFACE — the info surface rises into its FINAL geometry under the
 *    settling cards with its structure already inside it, then its fine
 *    print (objects, then words — the colony workspace's two waves). It is
 *    never an empty container stretching open: the cards are the event;
 *  · B reverses the same phrase: the surface sinks with its content, the
 *    cards and cubes FLIP HOME from wherever they are, and the overview
 *    breathes back from the same press point. Since the cards are the very same elements, the animated end
 *    state IS the static state — no swap, no twin frame, no skip.
 *
 * Entered FROM THE FULLSCREEN VIEWER the phrase is the same, minus the FLIP
 * of the SELECTED card: that one is arriving on its own flight out of the
 * viewer (the zoom handoff holds its slot empty until touchdown).
 *
 * Transform / opacity / clip only (perf-lite safe), guarded episodes (`done()`
 * can never be dropped), durations through `motionMs`, FLIP deltas compensated
 * for CSS-`zoom` contexts, reduced motion = short functional fades with
 * unchanged semantics.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {
  guardedDescend,
  killDescendEpisode,
  descendFlipFrom,
  descendRecede,
  descendReturn,
  descendParkLayer,
  descendCascade,
  descendRadiusOf,
  descendRectOf,
  descendPx,
} from '@/client/console/surfaceMotion/workspaceDescend';

export type Rect = {left: number, top: number, width: number, height: number};

// ── timings (1080-logical ms; motionMs folds the speed preset) ──────────────

/** The overview receding into the press point. */
const BODY_OUT_MS = 200;
/** …and breathing back on B. */
const BODY_IN_MS = 220;
/**
 * The info surface SURFACES in its final geometry, its content already inside
 * it — a soft rise under the settling cards. Never an empty container
 * stretching open: the cards are the event, the surface is what they land
 * over.
 */
const SURFACE_IN_MS = 260;
const SURFACE_OUT_MS = 170;
/** Wave 1 — the surface's structure, a beat behind the surface itself. */
const REVEAL_MS = 220;
const REVEAL_STAGGER_S = 0.035;
/** Wave 2 — the fine print, later and softer. */
const LATE_MS = 240;
const LATE_STAGGER_S = 0.02;
const LATE_SPREAD_S = 0.18;
/** The card FLIP (overview ⇄ vote row) — the carried subjects. */
const CARD_FLIP_MS = 380;
const CARD_FLIP_BACK_MS = 320;
/** The cubes travel with their card; slightly lighter. */
const CUBE_FLIP_MS = 340;
const CUBE_FLIP_BACK_MS = 280;
/** When each beat starts (base ms from the press). */
const CARRY_AT_MS = 40;
const SURFACE_AT_MS = 180;
const REVEAL_AT_MS = 240;
const LATE_AT_MS = 360;
/** On B: the overview breathes back once the surface has let go and the cards are on their way home. */
const BODY_IN_AT_MS = 130;
/** On B: the cards leave the row a beat after the surface starts sinking (the surface yields FIRST). */
const CARRY_BACK_AT_MS = 40;
/** The RE-FIT — the cards settle a size smaller (or larger) while the band takes its bill height. */
const REFIT_MS = 300;
/** The pressed block's own answer, before anything moves. */
const COMMIT_MS = 120;
/** The delegate's glide: the fraction of the path past which the cube has visibly LEFT its source … */
const DEPARTED_AT = 0.1;
/** … and the fraction at which it has visibly ARRIVED (the eased tail past it is snapped). */
const TOUCHDOWN_AT = 0.985;

// ── the measured snapshot ───────────────────────────────────────────────────

/** Every carried object's rect, keyed by identity — measured in ONE layout, before it changes. */
export type VoteRectSnapshot = {
  /** The voting block's plate (the unfold / fold rect). */
  plate: Rect | undefined;
  plateRadius: number | undefined;
  /** The press point (the recede origin). */
  press: {x: number, y: number} | undefined;
  faces: Map<string, Rect>;
  labels: Map<string, Rect>;
  tallies: Map<string, Rect>;
  /** `<instance>#<seq>` → rect. */
  cubes: Map<string, Rect>;
  /** The vote layer's info SURFACE (the band) — its top edge travels with a re-fit. */
  surface: Rect | undefined;
};

function rectOf(el: Element | null | undefined): Rect | undefined {
  return descendRectOf(el);
}

function slotsOf(root: HTMLElement): Array<HTMLElement> {
  return Array.from(root.querySelectorAll<HTMLElement>('.con-parl__slot[data-instance]'));
}

function instanceOf(slot: HTMLElement): string {
  return slot.getAttribute('data-instance') ?? '';
}

/**
 * Measure every carried object where it stands RIGHT NOW. Called by the
 * section immediately before the teleport that changes the layout (both
 * directions), so the deltas the FLIPs animate from are exact.
 */
export function measureVoteRects(root: HTMLElement, opts: {press?: {x: number, y: number}, viewer?: string, mode: 'browse' | 'vote'}): VoteRectSnapshot {
  const plate = root.querySelector<HTMLElement>('.con-parl__voting');
  const snap: VoteRectSnapshot = {
    plate: rectOf(plate),
    plateRadius: descendRadiusOf(plate),
    press: opts.press,
    faces: new Map(),
    labels: new Map(),
    tallies: new Map(),
    cubes: new Map(),
    surface: rectOf(root.querySelector('[data-parl-vote-surface]')),
  };
  for (const slot of slotsOf(root)) {
    const id = instanceOf(slot);
    const face = slot.querySelector<HTMLElement>('.con-parl__card .pcard') ?? slot.querySelector<HTMLElement>('.con-parl__card');
    const faceRect = rectOf(face);
    if (faceRect !== undefined) {
      snap.faces.set(id, faceRect);
    }
    const label = rectOf(slot.querySelector('.con-parl__slot-label'));
    if (label !== undefined) {
      snap.labels.set(id, label);
    }
    const tally = rectOf(slot.querySelector('.con-parl__tally'));
    if (tally !== undefined) {
      snap.tallies.set(id, tally);
    }
    for (const cube of Array.from(slot.querySelectorAll<HTMLElement>('.con-parl__ribbon [data-seq]'))) {
      const r = rectOf(cube);
      if (r !== undefined) {
        snap.cubes.set(`${id}#${cube.getAttribute('data-seq')}`, r);
      }
    }
  }
  return snap;
}

// ── element resolution ──────────────────────────────────────────────────────

/** The overview's parts that RECEDE (everything but the voting plate and the carried slots — the head line is outside the field and never recedes). */
function recedersOf(root: HTMLElement): Array<HTMLElement> {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-parl-recede]'));
}

function plateOf(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('.con-parl__voting');
}

function layerOf(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('.con-parl__vote');
}

function surfaceOf(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-parl-vote-surface]');
}

/** WAVE 1 — the surface's structural groups. */
function revealItemsOf(root: HTMLElement): Array<HTMLElement> {
  return Array.from(root.querySelectorAll<HTMLElement>('.con-parl__vote [data-parl-vote-item]'));
}

/** WAVE 2 — the fine print. */
function lateItemsOf(root: HTMLElement): Array<HTMLElement> {
  return Array.from(root.querySelectorAll<HTMLElement>('.con-parl__vote [data-parl-vote-late]'));
}

function hiddenByHost(el: Element): boolean {
  return el instanceof HTMLElement && el.offsetParent === null && getComputedStyle(el).position !== 'fixed';
}

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

/** A FLIP of `target` from `from` (its rect a layout ago) into its CURRENT box. */
function carry(tl: gsap.core.Timeline, target: HTMLElement | null, from: Rect | undefined, atS: number, durMs: number, ease: string): void {
  if (target === null) {
    return;
  }
  const delta = from !== undefined ? descendFlipFrom(target, from) : undefined;
  if (delta !== undefined) {
    // Pinned to the departure rect on the FIRST frame (a `set` before the
    // tween's own first tick), so the object is never painted at its new
    // place before it starts moving.
    gsap.set(target, {x: delta.x, y: delta.y, scale: delta.scale, transformOrigin: 'top left'});
    tl.to(target, {x: 0, y: 0, scale: 1, duration: s(durMs), ease, clearProps: 'transform', overwrite: 'auto'}, atS);
  } else {
    tl.fromTo(target,
      {autoAlpha: 0, scale: 0.96, transformOrigin: '50% 50%'},
      {autoAlpha: 1, scale: 1, duration: s(REVEAL_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility', overwrite: 'auto'}, atS);
  }
}

// ── the enter phrase (browse → vote) ────────────────────────────────────────

export type VoteEnterArgs = {
  root: HTMLElement;
  /** Everything's rect in the OVERVIEW layout, measured before the teleport. */
  before: VoteRectSnapshot;
  /** The slot the vote mode opens on. */
  selected: string;
  /** The selected card arrives out of the fullscreen viewer on its own flight: no FLIP for it. */
  fromViewer: boolean;
  /** The vote mode is being REBUILT (a reload around a bill): no motion, just the pose. */
  instant: boolean;
  done: () => void;
};

/**
 * Play the entrance. Called AFTER the teleport + the new fit have laid the
 * vote row out (the section awaits a tick first), in the same task — before
 * the browser paints — so every FLIP's first frame is the departure rect.
 */
export function playParliamentVoteEnter(args: VoteEnterArgs): void {
  const {root, before, done} = args;
  const layer = layerOf(root);
  if (layer === null || typeof window === 'undefined' || hiddenByHost(root)) {
    killDescendEpisode(root);
    for (const el of recedersOf(root)) {
      descendParkLayer(el);
    }
    done();
    return;
  }
  const receders = recedersOf(root);
  const plate = plateOf(root);
  const surface = surfaceOf(root);
  const items = revealItemsOf(root);
  const late = lateItemsOf(root);

  if (args.instant || consoleReducedMotionActive()) {
    guardedDescend(root, 160, done, (finish) => {
      for (const el of receders) {
        descendParkLayer(el);
      }
      gsap.set([...items, ...late], {clearProps: 'transform,opacity,visibility'});
      return gsap.fromTo(layer, {autoAlpha: args.instant ? 1 : 0}, {autoAlpha: 1, duration: args.instant ? 0.01 : 0.1, ease: 'power1.out', clearProps: 'opacity,visibility', onComplete: finish});
    });
    return;
  }

  // Nothing secondary is painted before its beat (the hooks run before the
  // first paint of the new layout): the surface and its words wait for the
  // cards to be under way.
  if (surface !== null) {
    gsap.set(surface, {autoAlpha: 0, y: descendPx(14)});
  }
  if (items.length > 0) {
    gsap.set(items, {autoAlpha: 0});
  }
  if (late.length > 0) {
    gsap.set(late, {autoAlpha: 0});
  }
  const lateStagger = Math.min(LATE_STAGGER_S, LATE_SPREAD_S / Math.max(1, late.length));
  const totalMs = Math.max(LATE_AT_MS + LATE_MS + Math.round(late.length * lateStagger * 1000), CARRY_AT_MS + CARD_FLIP_MS) + 120;

  guardedDescend(root, totalMs, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    if (args.fromViewer) {
      // Entered FROM THE VIEWER the overview was never on screen (the viewer's
      // veil covered it): it is PARKED before the first paint, so the veil
      // lifts onto the vote scene and the card flies into it — never onto a
      // flash of the overview receding.
      for (const el of receders) {
        descendParkLayer(el);
      }
    } else {
      // 0. COMMIT — the pressed plate answers; its chrome lets go in place (the
      //    class the section sets fades its background — CSS, one shot).
      if (plate !== null) {
        tl.fromTo(plate, {scale: 1, transformOrigin: '50% 50%'}, {scale: 1.006, duration: s(COMMIT_MS), ease: 'power2.out', clearProps: 'transform'}, 0);
      }
      // 1. RECEDE — the rest of the overview steps back into the press point.
      for (const el of receders) {
        descendRecede(tl, el, before.press, s(BODY_OUT_MS), s(30));
      }
    }
    // 2. CARRY — every card, cube, label and tally FLIPs from its overview
    //    rect into its vote rect. The pressed (selected) card is the heaviest
    //    object and settles last; its neighbours are a touch quicker.
    for (const slot of slotsOf(root)) {
      const id = instanceOf(slot);
      const isSelected = id === args.selected;
      const face = slot.querySelector<HTMLElement>('.con-parl__card .pcard') ?? slot.querySelector<HTMLElement>('.con-parl__card');
      if (!(isSelected && args.fromViewer)) {
        carry(tl, face, before.faces.get(id), s(CARRY_AT_MS), isSelected ? CARD_FLIP_MS : CARD_FLIP_MS - 40, 'power3.inOut');
      }
      carry(tl, slot.querySelector<HTMLElement>('.con-parl__slot-label'), before.labels.get(id), s(CARRY_AT_MS), CARD_FLIP_MS - 60, 'power2.inOut');
      carry(tl, slot.querySelector<HTMLElement>('.con-parl__tally'), before.tallies.get(id), s(CARRY_AT_MS), CARD_FLIP_MS - 60, 'power2.inOut');
      for (const cube of Array.from(slot.querySelectorAll<HTMLElement>('.con-parl__ribbon [data-seq]'))) {
        carry(tl, cube, before.cubes.get(`${id}#${cube.getAttribute('data-seq')}`), s(CARRY_AT_MS + 20), CUBE_FLIP_MS, 'power2.inOut');
      }
    }
    // 3. THE INFO SURFACE surfaces in its final geometry under the settling
    //    cards — a soft rise with its structure already in it; the fine print
    //    arrives a beat later. Nothing stretches open empty.
    if (surface !== null) {
      tl.to(surface, {autoAlpha: 1, y: 0, duration: s(SURFACE_IN_MS), ease: 'expo.out', clearProps: 'transform,opacity,visibility'}, s(SURFACE_AT_MS));
    }
    // 4. REVEAL — the surface's structure, then its fine print.
    descendCascade(tl, items, s(REVEAL_MS), s(REVEAL_AT_MS), REVEAL_STAGGER_S);
    descendCascade(tl, late, s(LATE_MS), s(LATE_AT_MS), lateStagger);
    return tl;
  });
}

// ── the re-fit phrase (the mode's geometry changes under a standing scene) ──

export type VoteRefitArgs = {
  root: HTMLElement;
  /** Everything's rect in the mode's PREVIOUS geometry, measured before the layout change. */
  before: VoteRectSnapshot;
};

/**
 * THE RE-FIT: the vote column takes the shared payment panel's width and the
 * band its height (the bill), so the card row above re-fits a size smaller —
 * every carried object FLIPs from its rect a layout ago, and the band UNFOLDS
 * upward from where its top edge stood (a clip, never a translate: nothing
 * leaves the layer). An object that did not move is left alone. The geometry
 * the answer produced is the geometry that animates; nothing jumps under the
 * bill, and the paid delegate's flight later measures the settled scene.
 */
export function playParliamentVoteRefit(args: VoteRefitArgs): void {
  const {root, before} = args;
  if (typeof window === 'undefined' || hiddenByHost(root) || consoleReducedMotionActive()) {
    return;
  }
  const tl = gsap.timeline();
  for (const slot of slotsOf(root)) {
    const id = instanceOf(slot);
    const face = slot.querySelector<HTMLElement>('.con-parl__card .pcard') ?? slot.querySelector<HTMLElement>('.con-parl__card');
    shift(tl, face, before.faces.get(id), REFIT_MS, 'power3.inOut');
    shift(tl, slot.querySelector<HTMLElement>('.con-parl__slot-label'), before.labels.get(id), REFIT_MS - 40, 'power2.inOut');
    shift(tl, slot.querySelector<HTMLElement>('.con-parl__tally'), before.tallies.get(id), REFIT_MS - 40, 'power2.inOut');
    for (const cube of Array.from(slot.querySelectorAll<HTMLElement>('.con-parl__ribbon [data-seq]'))) {
      shift(tl, cube, before.cubes.get(`${id}#${cube.getAttribute('data-seq')}`), REFIT_MS, 'power2.inOut');
    }
  }
  const surface = surfaceOf(root);
  const after = rectOf(surface);
  if (surface !== null && before.surface !== undefined && after !== undefined) {
    const dy = before.surface.top - after.top;
    if (Math.abs(dy) > 0.5) {
      gsap.set(surface, {clipPath: `inset(${Math.max(0, dy)}px 0 0 0)`});
      tl.to(surface, {clipPath: 'inset(0px 0 0 0)', duration: s(REFIT_MS), ease: 'power3.inOut', clearProps: 'clipPath,webkitClipPath', overwrite: 'auto'}, 0);
    }
  }
}

/** A FLIP of `target` from `from` into its current box — only when it actually moved. */
function shift(tl: gsap.core.Timeline, target: HTMLElement | null, from: Rect | undefined, durMs: number, ease: string): void {
  if (target === null || from === undefined) {
    return;
  }
  const delta = descendFlipFrom(target, from);
  if (delta === undefined || (Math.abs(delta.x) < 0.5 && Math.abs(delta.y) < 0.5 && Math.abs(delta.scale - 1) < 0.002)) {
    return;
  }
  gsap.set(target, {x: delta.x, y: delta.y, scale: delta.scale, transformOrigin: 'top left'});
  tl.to(target, {x: 0, y: 0, scale: 1, duration: s(durMs), ease, clearProps: 'transform', overwrite: 'auto'}, 0);
}

// ── the leave phrase (vote → browse: a CANCEL) ──────────────────────────────

export type VoteLeaveArgs = {
  root: HTMLElement;
  /** The viewer's colour (kept for the callers' symmetry — nothing of the zone travels any more). */
  viewer: string | undefined;
  /** Snapshot of the VOTE layout, measured before the teleport home. */
  before: VoteRectSnapshot;
  done: () => void;
};

/**
 * Play the return. Called AFTER the teleport home (the cards are in their
 * overview cells at rest) in the same task, before the paint: every card
 * is pinned back to its vote rect on the first frame and travels home.
 */
export function playParliamentVoteLeave(args: VoteLeaveArgs): void {
  const {root, before, done} = args;
  const layer = layerOf(root);
  if (layer === null || typeof window === 'undefined' || hiddenByHost(root)) {
    killDescendEpisode(root);
    restoreParliamentBody(root);
    done();
    return;
  }
  const receders = recedersOf(root);
  const surface = surfaceOf(root);

  if (consoleReducedMotionActive()) {
    guardedDescend(root, 160, done, (finish) => {
      for (const el of receders) {
        gsap.set(el, {autoAlpha: 1, clearProps: 'transform,opacity,visibility'});
      }
      return gsap.to(layer, {autoAlpha: 0, duration: 0.1, ease: 'power1.in', clearProps: 'opacity,visibility', onComplete: finish});
    });
    return;
  }

  // The cards are ALREADY home in the DOM: pin each carried object to the
  // rect it had in the vote row, so the first painted frame is where the
  // player last saw it.
  const flips: Array<{el: HTMLElement, durMs: number, ease: string, at: number}> = [];
  for (const slot of slotsOf(root)) {
    const id = instanceOf(slot);
    const pin = (el: HTMLElement | null, from: Rect | undefined, durMs: number, ease: string, at: number) => {
      if (el === null) {
        return;
      }
      const delta = from !== undefined ? descendFlipFrom(el, from) : undefined;
      if (delta === undefined) {
        return;
      }
      gsap.set(el, {x: delta.x, y: delta.y, scale: delta.scale, transformOrigin: 'top left'});
      flips.push({el, durMs, ease, at});
    };
    pin(slot.querySelector<HTMLElement>('.con-parl__card .pcard') ?? slot.querySelector<HTMLElement>('.con-parl__card'), before.faces.get(id), CARD_FLIP_BACK_MS, 'power3.inOut', CARRY_BACK_AT_MS);
    pin(slot.querySelector<HTMLElement>('.con-parl__slot-label'), before.labels.get(id), CARD_FLIP_BACK_MS - 40, 'power2.inOut', CARRY_BACK_AT_MS);
    pin(slot.querySelector<HTMLElement>('.con-parl__tally'), before.tallies.get(id), CARD_FLIP_BACK_MS - 40, 'power2.inOut', CARRY_BACK_AT_MS);
    for (const cube of Array.from(slot.querySelectorAll<HTMLElement>('.con-parl__ribbon [data-seq]'))) {
      pin(cube, before.cubes.get(`${id}#${cube.getAttribute('data-seq')}`), CUBE_FLIP_BACK_MS, 'power2.inOut', CARRY_BACK_AT_MS + 10);
    }
  }

  guardedDescend(root, CARRY_BACK_AT_MS + CARD_FLIP_BACK_MS + 240, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    // 1. The info surface YIELDS first — it lets go WITH its content, a short
    //    sink under the cards (the reverse of its arrival).
    if (surface !== null) {
      tl.to(surface, {autoAlpha: 0, y: descendPx(10), duration: s(SURFACE_OUT_MS), ease: 'power2.in', overwrite: 'auto'}, 0);
    }
    // 2. The cards, cubes, labels and tallies travel HOME — they are in the
    //    air while the overview comes back under them, and when they land
    //    they are simply at rest in it.
    for (const flip of flips) {
      tl.to(flip.el, {x: 0, y: 0, scale: 1, duration: s(flip.durMs), ease: flip.ease, clearProps: 'transform', overwrite: 'auto'}, s(flip.at));
    }
    // 4. The overview BREATHES BACK from the same press point — a beat after
    //    the surface has let go, so the return reads surface → cards → scene.
    for (const el of receders) {
      descendReturn(tl, el, s(BODY_IN_MS), s(BODY_IN_AT_MS));
    }
    // 5. The layer itself lets go (its plate fades under the returning cards).
    tl.to(layer, {autoAlpha: 0, duration: s(140), ease: 'power1.in', clearProps: 'opacity,visibility'}, s(CARRY_BACK_AT_MS + CARD_FLIP_BACK_MS - 80));
    return tl;
  });
}

/** Kill any running phrase and re-pose every carried object at rest (an interrupted pair, an unmount). */
export function killParliamentVoteMotion(root: HTMLElement | null | undefined): void {
  if (root === null || root === undefined) {
    return;
  }
  killDescendEpisode(root);
  const carried = root.querySelectorAll<HTMLElement>(
    '.con-parl__slot .pcard, .con-parl__card, .con-parl__slot-label, .con-parl__tally, .con-parl__ribbon [data-seq], [data-parl-vote-item], [data-parl-vote-late], [data-parl-vote-surface], .con-parl__vote, .con-parl__voting');
  gsap.set(carried, {clearProps: 'transform,opacity,visibility,clipPath,webkitClipPath'});
}

/** The overview's receders come back to rest (the workspace is leaving with the vote landed — nothing to fold). */
export function restoreParliamentBody(root: Element | null | undefined): void {
  if (root === null || root === undefined) {
    return;
  }
  const receders = Array.from(root.querySelectorAll<HTMLElement>('[data-parl-recede]'));
  if (receders.length > 0) {
    gsap.set(receders, {clearProps: 'transform,opacity,visibility'});
  }
}

/** Park the overview's receders (the vote mode is standing without an entrance to play — a rebuild). */
export function parkParliamentBody(root: Element | null | undefined): void {
  if (root === null || root === undefined) {
    return;
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-parl-recede]'))) {
    descendParkLayer(el);
  }
}

// ── the delegate's flight (a cube from its place on the zone onto the card) ──

export type CubeFlightHandle = {
  /** Abort: the proxy vanishes, the callbacks never fire. */
  kill: () => void;
  tween: gsap.core.Timeline;
};

export type CubeFlightArgs = {
  /** The proxy element (a PlayerCube host, body-level fixed). */
  proxy: HTMLElement;
  /** The SOURCE cube's rect — the proxy is born exactly over it. */
  from: Rect;
  /** The DESTINATION place's rect — the proxy lands exactly on it. */
  to: Rect;
  /** Called on the frame the proxy is standing over the source (the real source cube may vanish now). */
  onLifted?: () => void;
  /** Called once the proxy has visibly LEFT its source (the source's own words — a note, a count — may change now). */
  onDeparted?: () => void;
  /** Called at touchdown (the real cube materializes under the proxy; the proxy is removed a frame later by the caller). */
  onLanded: () => void;
  durationMs?: number;
  /** A small arc off the surface (0 = a straight glide). */
  arcPx?: number;
  /**
   * Seconds on the flight's own timeline before the travel starts (default a
   * hair past 0). A caller layers a gesture into that lead — a card turning
   * over in place before it is carried off — on the SAME timeline, so «turn»
   * and «carry» stay one object on one clock.
   */
  leadInS?: number;
};

/**
 * ONE delegate cube travels from a real place to a real place. The proxy
 * matches the source's box on its first frame (same size, same material —
 * the caller renders the same PlayerCube at the source's logical size),
 * glides with a slight lift, and settles onto the destination's box —
 * scaling only by the ratio of the two rects, which is 1 wherever the
 * source and destination cubes are drawn at one size.
 */
export function runDelegateCubeFlight(args: CubeFlightArgs): CubeFlightHandle {
  return runProxyFlight(args);
}

/**
 * ONE resolution dealt from the deck: the proxy is the slot's face-sized
 * card back, born SCALED DOWN onto the pile's top card and grown into its
 * slot along a higher arc than a cube's — the same flight, a taller object.
 */
export function runCardDealFlight(args: CubeFlightArgs): CubeFlightHandle {
  return runProxyFlight({...args, arcPx: args.arcPx ?? descendPx(44)});
}

/**
 * THE PROXY FLIGHT shared by the cubes and the dealt cards. The proxy keeps
 * its own box (width AND height — a card is not square) and is centred on
 * the source's centre at the source's scale, then on the destination's at
 * the destination's; the scale follows the WIDTH ratio (the source and the
 * destination share the object's aspect).
 */
function runProxyFlight(args: CubeFlightArgs): CubeFlightHandle {
  const {proxy, from, to} = args;
  const reduced = consoleReducedMotionActive();
  const size = proxy.offsetWidth || from.width;
  const tall = proxy.offsetHeight || from.height;
  const startScale = from.width / size;
  const endScale = to.width / size;
  const start = {x: from.left + from.width / 2 - size / 2, y: from.top + from.height / 2 - tall / 2};
  const end = {x: to.left + to.width / 2 - size / 2, y: to.top + to.height / 2 - tall / 2};
  gsap.set(proxy, {x: start.x, y: start.y, scale: startScale, transformOrigin: '50% 50%', autoAlpha: 1});
  const dur = s(args.durationMs ?? 520);
  const arc = reduced ? 0 : (args.arcPx ?? descendPx(14));
  let landed = false;
  let departed = false;
  // TOUCHDOWN is called on the frame the cube reaches its place — the eased
  // tail of the glide (its last 1.5 %, a couple of pixels) is snapped, so the
  // counters tick when the cube visibly stops, never a beat after.
  const land = () => {
    if (landed) {
      return;
    }
    landed = true;
    gsap.set(proxy, {x: end.x, y: end.y, scale: endScale});
    args.onLanded();
  };
  const prog = {p: 0};
  const tl = gsap.timeline();
  tl.call(() => args.onLifted?.(), undefined, 0.001);
  const leadIn = Math.max(0.02, args.leadInS ?? 0.02);
  tl.to(prog, {
    p: 1,
    duration: reduced ? dur * 0.5 : dur,
    ease: reduced ? 'power1.inOut' : 'power2.inOut',
    onUpdate: () => {
      const p = prog.p;
      if (!departed && p >= DEPARTED_AT) {
        departed = true;
        args.onDeparted?.();
      }
      if (landed) {
        return;
      }
      if (p >= TOUCHDOWN_AT) {
        land();
        return;
      }
      const x = start.x + (end.x - start.x) * p;
      const y = start.y + (end.y - start.y) * p - Math.sin(p * Math.PI) * arc;
      const scale = startScale + (endScale - startScale) * p + (reduced ? 0 : Math.sin(p * Math.PI) * 0.12);
      gsap.set(proxy, {x, y, scale});
    },
    onComplete: () => {
      if (!departed) {
        departed = true;
        args.onDeparted?.();
      }
      land();
    },
  }, leadIn);
  return {
    tween: tl,
    kill: () => {
      tl.kill();
      gsap.set(proxy, {autoAlpha: 0});
      if (!landed) {
        landed = true;
      }
    },
  };
}
