/*
 * @console-shared LIVE — console native stands on this file.
 *
 * Card3DInner — THE PHYSICAL CARD BODY of this fork.
 *
 * A flying card is ONE object with two sides and a thickness, never two
 * pictures that trade places. This module owns that object; the caller owns
 * where it goes. The split is the whole point:
 *
 *   CardMotionOuter (the caller's flyer element)
 *     · x / y / scale / trajectory / shadow / opacity
 *     · owns `perspective` — a rotation only reads as DEPTH when the PARENT
 *       projects it. `.con-startdock-proxy` shipped without one, which is
 *       exactly why the start-flow turn looked like an image swap: an
 *       orthographic rotateY has no foreshortening, so the face simply
 *       narrows to a line and the back widens out of it.
 *   Card3DInner (this)
 *     · rotationY (the turn) / a small rotationX (the pitch) / z (the push)
 *     · `transform-style: preserve-3d`, faces culled by `backface-visibility`
 *     · nothing else, ever — no position, no layout, no opacity (see below).
 *
 * ⚠️ NEVER animate `opacity` on the inner. Any value below 1 is a grouping
 * property: it forces the element back to `transform-style: flat`, backface
 * culling stops, and a 180° turn renders a MIRROR of the face instead of the
 * back. Fade the OUTER (it is flat by construction) or dim the `__back` leaf.
 *
 * ⚠️ NEVER overshoot on `rotationY`. An angular overshoot past 0°/180° flashes
 * the mirrored backface — the one artefact a card turn can never show. Settle
 * overshoot rides SCALE, on the outer.
 *
 * REUSE. This is the FORMALIZATION of the chassis the fork already had
 * (`.con-deal-proxy__flip / __face / __back`, `addPremiumTurn`), not a second
 * look-alike: the faces keep those exact class names, so every shared rule
 * that rides them — the `--revealing` glint sweep, the hand-reveal
 * `__face--dim` recipes, `.con-deal-proxy__face > *` margin resets — keeps
 * working on a Card3DInner unchanged. What is NEW is (1) the guaranteed
 * perspective owner, (2) a real EDGE plane so the card has thickness at
 * 90° instead of vanishing into a mathematical line, and (3) one turn
 * function that works in BOTH directions (open AND close), which
 * `addPremiumTurn` (180 → 0 only) could not express.
 */

import {gsap} from 'gsap';

/** The one motion element the caller moves (position / scale / shadow). */
export const CARD3D_OUTER_CLASS = 'con-card3d-outer';
/** The 3D body itself (preserve-3d; only ever rotated / pushed). */
export const CARD3D_CLASS = 'con-card3d';

/** rotationY of a card lying face-up / face-down (the fork-wide convention). */
export const FACE_UP_DEG = 0;
export const FACE_DOWN_DEG = 180;

/**
 * The parts of one physical card. `outer` is the caller's own flyer element
 * (this module only guarantees it carries the perspective class); everything
 * below it belongs to the card body.
 */
export type Card3DInner = {
  /** CardMotionOuter — position / scale / shadow; owns `perspective`. */
  outer: HTMLElement,
  /** The 3D body — rotationY / rotationX / z ONLY. */
  inner: HTMLElement,
  /** The premium face (hosts a real card node or a clone). */
  face: HTMLElement,
  /** The card back (always mounted — never conditionally swapped in). */
  back: HTMLElement,
  /** The lit paper edge; `undefined` when the caller opted out. */
  edge: HTMLElement | undefined,
};

export type Card3DBuildOptions = {
  /** Which side lies up at birth. Both faces mount either way. */
  faceUp: boolean,
  /** Markup of the back's own art (the fork's `.con-card-back` family). */
  backHtml?: string,
  /** Mount the edge plane (default true; reduced motion still keeps it —
   *  it is geometry, not motion). */
  edge?: boolean,
  /** Extra classes for the outer (the host's own proxy class). */
  outerClass?: string,
};

const DEFAULT_BACK_HTML = '<div class="con-card-back con-card-back--flyer"></div>';

/**
 * Build one physical card into `outer`. The outer keeps whatever the host
 * already put on it (position, z-index, its own proxy class) and GAINS the
 * perspective class — so an existing flyer can be upgraded in place without
 * restructuring the host's layer.
 */
export function buildCard3DInner(outer: HTMLElement, o: Card3DBuildOptions): Card3DInner {
  outer.classList.add(CARD3D_OUTER_CLASS);
  if (o.outerClass !== undefined && o.outerClass !== '') {
    outer.classList.add(...o.outerClass.split(/\s+/).filter((c) => c !== ''));
  }
  const wantEdge = o.edge !== false;
  outer.innerHTML =
    `<div class="${CARD3D_CLASS} con-deal-proxy__flip">` +
      `<div class="con-card3d__face con-deal-proxy__face"></div>` +
      `<div class="con-card3d__back con-deal-proxy__back">${o.backHtml ?? DEFAULT_BACK_HTML}</div>` +
      (wantEdge ? `<div class="con-card3d__edge" aria-hidden="true"></div>` : '') +
    `</div>`;
  const card = readCard3DInner(outer);
  if (card === undefined) {
    // Cannot happen (we just wrote the markup) — but the flight must never
    // wedge on a DOM surprise, so hand back a degenerate body that behaves.
    return {outer, inner: outer, face: outer, back: outer, edge: undefined};
  }
  setCard3DFace(card, o.faceUp);
  return card;
}

/**
 * Read an EXISTING chassis (a Vue-rendered flyer layer, or one of the older
 * `.con-deal-proxy__flip` proxies) as a Card3DInner. Returns `undefined` when
 * the subtree is not a card body.
 */
export function readCard3DInner(outer: HTMLElement | null | undefined): Card3DInner | undefined {
  if (outer === null || outer === undefined || typeof outer.querySelector !== 'function') {
    return undefined;
  }
  const inner = outer.querySelector<HTMLElement>(`.${CARD3D_CLASS}, .con-deal-proxy__flip`);
  const face = outer.querySelector<HTMLElement>('.con-card3d__face, .con-deal-proxy__face');
  const back = outer.querySelector<HTMLElement>('.con-card3d__back, .con-deal-proxy__back');
  if (inner === null || face === null || back === null) {
    return undefined;
  }
  return {
    outer,
    inner,
    face,
    back,
    edge: outer.querySelector<HTMLElement>('.con-card3d__edge') ?? undefined,
  };
}

/** Set the physical side without animating (birth / abort / reduced motion). */
export function setCard3DFace(card: Card3DInner, faceUp: boolean): void {
  gsap.set(card.inner, {rotationY: faceUp ? FACE_UP_DEG : FACE_DOWN_DEG, rotationX: 0, z: 0});
}

/** The side the card is physically showing right now (degrees). */
export function card3DFlipDeg(card: Card3DInner): number {
  return Number(gsap.getProperty(card.inner, 'rotationY')) || 0;
}

/** Is this card currently face-up (within a quarter turn)? */
export function card3DIsFaceUp(card: Card3DInner): boolean {
  const d = ((card3DFlipDeg(card) % 360) + 360) % 360;
  return d < 90 || d > 270;
}

/**
 * The slice of a GSAP timeline the turn needs. Structural on purpose (the
 * same contract `premiumTurn` established): the turn is LAYERED onto the
 * caller's flight timeline — that is what makes «fly» and «turn» one gesture
 * instead of two chained beats.
 */
export type Card3DTimeline = {
  to(target: object, vars: object, position?: number | string): unknown,
  set?(target: object, vars: object, position?: number | string): unknown,
  call(callback: () => void, params: undefined, position: number | string): unknown,
};

export type Card3DTurnOptions = {
  card: Card3DInner,
  /** Timeline position the turn starts at (seconds). */
  at: number,
  /** Full duration of the turn (seconds). */
  dur: number,
  /** Target rotationY — `FACE_UP_DEG` (open) or `FACE_DOWN_DEG` (close). */
  to: number,
  /** Where the turn starts (default: the card's live rotation). */
  from?: number,
  /**
   * The forward tumble peak (deg). A card lifted by a hand pitches slightly
   * away as it turns; 0 makes it a flat token spin. Restrained by contract.
   */
  pitch?: number,
  /** Depth push toward the viewer at the edge-on moment (px @ scale 1). */
  push?: number,
  /** Reduced motion — the turn still HAPPENS (face continuity is physical,
   *  not decoration), it just loses its flourish. */
  reduced?: boolean,
  /** One-shot sweep class added to the OUTER as the face crosses into view. */
  glintClass?: string,
  /** Fired at the ~90° crossing — the first frame the new side is readable. */
  onSideCrossed?: () => void,
};

/** The default physical flourish of a turn (deg / px @ scale 1). */
export const CARD3D_PITCH = 11;
export const CARD3D_PUSH = 34;

/**
 * THE TURN. One physical gesture in three channels on ONE clock:
 *  · rotationY — the turn itself, decelerating into rest (paper has inertia
 *    and the last few degrees are the ones the eye reads as «it landed»);
 *  · rotationX — a forward tumble peaking exactly at the edge-on moment, so
 *    the card is seen from slightly above as it passes through its own plane;
 *  · z — a push toward the viewer through the same peak, then a sink to rest,
 *    which (with the outer's perspective) makes the middle of the turn the
 *    physically CLOSEST moment instead of the flattest one.
 *
 * The edge plane needs no channel of its own: it is real geometry, so it
 * simply becomes visible as the faces turn away.
 */
export function addCard3DTurn(tl: Card3DTimeline, o: Card3DTurnOptions): void {
  const {card, at, dur, to} = o;
  const from = o.from ?? card3DFlipDeg(card);
  if (from === to) {
    return;
  }
  const half = dur * 0.5;
  const reduced = o.reduced === true;
  // Y — the turn. `power2.out` in reduced motion (shorter, still eased): an
  // instant set would be a face SWAP, which is the artefact this replaces.
  tl.to(card.inner, {rotationY: to, duration: dur, ease: reduced ? 'power2.out' : 'power3.out'}, at);
  // THE EDGE breathes in around the crossing and is gone by the landing: the
  // card has a lit paper side exactly while it is turning through its own
  // plane, and no hairline down its middle at rest.
  if (card.edge !== undefined) {
    tl.to(card.edge, {opacity: 1, duration: dur * 0.22, ease: 'power1.out'}, at + dur * 0.14);
    tl.to(card.edge, {opacity: 0, duration: dur * 0.22, ease: 'power1.in'}, at + dur * 0.66);
  }
  if (reduced) {
    tl.call(() => announce(card, o), undefined, at + dur * 0.5);
    return;
  }
  const pitch = o.pitch ?? CARD3D_PITCH;
  const push = o.push ?? CARD3D_PUSH;
  if (pitch !== 0) {
    tl.to(card.inner, {rotationX: -pitch, duration: half, ease: 'sine.inOut'}, at);
    tl.to(card.inner, {rotationX: 0, duration: half, ease: 'sine.inOut'}, at + half);
  }
  if (push !== 0) {
    tl.to(card.inner, {z: push, duration: half, ease: 'power2.out'}, at);
    tl.to(card.inner, {z: 0, duration: half, ease: 'power2.inOut'}, at + half);
  }
  // The crossing sits slightly before the geometric half: `power3.out` front-
  // loads the rotation, so 90° is passed at ~0.46 of the clock.
  tl.call(() => announce(card, o), undefined, at + dur * 0.46);
}

function announce(card: Card3DInner, o: Card3DTurnOptions): void {
  if (o.glintClass !== undefined && o.glintClass !== '' && o.to === FACE_UP_DEG) {
    card.outer.classList.add(o.glintClass);
  }
  o.onSideCrossed?.();
}

/**
 * The physical shadow of a card being handled, as ONE tween channel on the
 * OUTER (never on the inner — a shadow is not part of the 3D body):
 *  · `rest`    — lying on the table;
 *  · `lifted`  — held above it (wide + soft);
 *  · `contact` — the last stretch of the lowering (tight + dark).
 * Keeping the three named here is what lets a landing hand its shadow to the
 * destination without a visible step.
 */
export const CARD3D_SHADOW = {
  rest: '0 2px 6px rgba(0,0,0,0.42)',
  lifted: '0 16px 34px rgba(0,0,0,0.52)',
  contact: '0 3px 9px rgba(0,0,0,0.46)',
} as const;
