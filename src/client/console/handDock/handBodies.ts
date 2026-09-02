/**
 * HAND BODIES — the ONE OWNER of the hand's physical cards.
 *
 * The rework's core contract: every card in the player's hand is ONE
 * persistent DOM element in ONE fixed layer (`ConsoleHandRevealLayer`, the
 * historical class name kept for its z/clip/spec contracts), alive from the
 * moment the card joins the hand to the moment it leaves — through the
 * docked pack, the open/close flights, the album and the page packets. The
 * dock renders only CHASSIS (plate, counter, wings, pager); the album's
 * interactive slots take over only at the very end of an open (the one
 * remaining, pixel-true handoff). «Карта исчезла/появилась при свапе» is
 * therefore INEXPRESSIBLE: there is no swap — the same element continues.
 *
 * Modes per body (module-reactive, the layer and the director share it):
 *  - docked  — in the pack; the LAYER positions it from the ANALYTIC pose
 *              (below) and tweens pose changes (rest/compact/raised ride);
 *  - flying  — a reveal episode owns the element (its timeline writes the
 *              transform; the layer must not touch it);
 *  - shelf   — the album's interactive slot presents the card; the body is
 *              hidden under it (released back at the close's first frame);
 *  - packet  — parked beyond the stage window at its page-packet anchor
 *              (positioned by the episode; static; invisible by the layer's
 *              stage clip, NEVER by opacity).
 *
 * The DOCKED POSE IS ANALYTIC: dock geometry = `handDockPlan` (per-card
 * dx/dy/tilt in rem) + the pack-level pose knobs ported from the old CSS
 * vars (spread/lift/fan/scale/sink for rest·compact·raised). A close
 * flight's landing target is therefore a pure function — no DOM reads, no
 * measure races, no magnets: if the pose changes mid-flight the layer's
 * own reconcile tween smooths the last few px after arrival.
 */

import {reactive} from 'vue';
import {handDockPlan, HAND_DOCK_CARD_W_REM, HAND_DOCK_CARD_H_REM} from '@/client/console/consoleHandDock';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';

export type HandBodyMode = 'docked' | 'flying' | 'shelf' | 'packet';

export type PackPose = 'rest' | 'compact' | 'raised' | 'away';

/** One body's pose in viewport px for a top-left-origin natural-width box:
 *  translate(x,y) rotate(rotation) scale(scale) — the flight chassis' own
 *  coordinate grammar (`transformOrigin: top left`). */
export type BodyPose = {x: number, y: number, scale: number, rotation: number};

type BodiesState = {
  /** Names currently owned by a flight episode (adds `data-reveal-card`). */
  flying: Array<string>,
  /** Names whose FACE must be mounted (page cards of an episode / shelf
   *  returns). Faces stay mounted once needed — remounting mid-flight is a
   *  paint hiccup, an idle mounted face costs nothing. */
  faces: Array<string>,
  /** Per-name mode; missing = docked. */
  modes: Record<string, HandBodyMode>,
};

export const handBodiesState = reactive<BodiesState>({
  flying: [],
  faces: [],
  modes: {},
});

/* ── element registry (the layer registers, the director seizes) ────── */

const els = new Map<string, HTMLElement>();

export function registerHandBody(name: string, el: HTMLElement | null): void {
  if (el === null) {
    els.delete(name);
  } else {
    els.set(name, el);
  }
}

export function handBodyEl(name: string): HTMLElement | undefined {
  return els.get(name);
}

export function handBodyMode(name: string): HandBodyMode {
  return handBodiesState.modes[name] ?? 'docked';
}

export function setHandBodyMode(name: string, mode: HandBodyMode): void {
  if (mode === 'docked') {
    delete handBodiesState.modes[name];
  } else {
    handBodiesState.modes[name] = mode;
  }
}

export function setHandBodiesFlying(names: ReadonlyArray<string>): void {
  handBodiesState.flying = [...names];
}

export function ensureHandBodyFaces(names: ReadonlyArray<string>): void {
  const have = new Set(handBodiesState.faces);
  let changed = false;
  for (const n of names) {
    if (!have.has(n)) {
      have.add(n);
      changed = true;
    }
  }
  if (changed) {
    handBodiesState.faces = [...have];
  }
}

/** Full reset (game switch / reset epoch): every body returns to the pack. */
export function resetHandBodies(): void {
  handBodiesState.flying = [];
  handBodiesState.modes = {};
  // faces stay — a mounted face is a warm cache, not state.
}

/* ── the analytic docked pose ───────────────────────────────────────── */

/** Pack-level pose knobs — the ONE source of the three poses' geometry (the
 *  chassis CSS carries no pose transform any more). The handheld profile
 *  keeps its tighter base spread; `raised` opens the fan (tilts on) and
 *  lifts the pack — the «на готове» pose the flight departs from and
 *  returns into.
 *
 *  COMPACT is a TUCK, not a shrink: the dominant carrier is the SINK (the
 *  pack settles into the tray behind the plate until only a tidy crown of
 *  card tops shows), scale drops only a little (perspective — «further
 *  away»), and the fan's arc FLATTENS so the crown reads as cards seated in
 *  a holder, not as a fan cut off by the plate. The old 0.7 shrink changed
 *  the gold-edge rhythm by 30% in one move — the single loudest part of the
 *  «интерфейс перестроился» read. */
const POSE_KNOBS: Record<PackPose, {spread: number, lift: number, fan: number, scale: number, sink: number, flat: number}> = {
  rest: {spread: 1, lift: 0, fan: 0, scale: 1, sink: 0, flat: 0},
  compact: {spread: 1, lift: 0, fan: 0, scale: 0.9, sink: 0.96, flat: 1},
  raised: {spread: 1.12, lift: 0.45, fan: 1, scale: 1, sink: 0, flat: 0},
  /* AWAY — the tuck taken all the way: the pack settles PAST the crown line
   * until nothing of it shows (the hand is put away INTO the tray). Exists
   * for the dock's INSPECTION context (the Information Workspace standing
   * another seat's closed fan in this very tray — two crowns in one holder
   * would be two hands claiming one physical object). The sink is profile-
   * derived in `dockedBodyPose` (compactSink + the card's own height), so
   * the crown that peeked ~0.7rem in compact is fully behind the plate on
   * every profile; this row carries the shared shape only. */
  away: {spread: 1, lift: 0, fan: 0, scale: 0.9, sink: 0.96, flat: 1},
};

export type PackAnchor = {
  /** The pack's bottom-centre in viewport px (the tray axis — measured off
   *  the dock chassis' `.con-handdock__pack` anchor box). */
  ax: number,
  ay: number,
  /** 1rem in px (read from the live cascade — the TV profile scales it). */
  remPx: number,
  /** Profile-tuned card box + knobs (handheld compacts differently). */
  cardW: number,
  cardH: number,
  baseSpread: number,
  compactScale: number,
  compactSink: number,
};

/** Read the profile-tuned constants (mirrors the old CSS profile blocks).
 *  Compact numbers per profile: the SINK is tuned so the crown of card tops
 *  peeking over the plate stays a calm, readable strip (~0.7rem base) — the
 *  handheld plate is much shorter, so its pack tucks less deep. */
export function packProfileTuning(profile: string): {cardW: number, cardH: number, baseSpread: number, compactScale: number, compactSink: number} {
  if (profile === 'handheld') {
    return {cardW: 2.6, cardH: 3.65, baseSpread: 0.84, compactScale: 0.9, compactSink: 0.7};
  }
  return {cardW: HAND_DOCK_CARD_W_REM, cardH: HAND_DOCK_CARD_H_REM, baseSpread: 1, compactScale: 0.9, compactSink: 0.96};
}

/**
 * The docked pose of card `i` of `n`, in the flight chassis' grammar.
 * Composition mirrors the old CSS exactly: per-card translate(dx·spread,
 * dy − lift) rotate(tilt·fan) inside a pack scaled about its bottom-centre
 * (compact «tucks into the tray»), plus the compact sink.
 */
export function dockedBodyPose(i: number, n: number, pose: PackPose, a: PackAnchor): BodyPose {
  const plan = handDockPlan(n);
  const slot = plan.slots[Math.max(0, Math.min(n - 1, i))] ?? {dx: 0, dy: 0, tilt: 0, deep: false};
  const k = POSE_KNOBS[pose];
  const spread = k.spread === 1 ? a.baseSpread : k.spread;
  // compact + away share the tucked geometry; away additionally sinks the
  // whole card height, so the compact crown disappears behind the plate.
  const tucked = pose === 'compact' || pose === 'away';
  const packScale = tucked ? a.compactScale : k.scale;
  const sink = (pose === 'away' ? a.compactSink + a.cardH :
    tucked ? a.compactSink : k.sink) * a.remPx;
  const w = a.cardW * a.remPx;
  const h = a.cardH * a.remPx;
  // Pre-scale placement (pack coordinates): centre-x from dx·spread, the
  // card's BOTTOM on the tray axis, shifted by arc dy and the raised lift.
  // `flat` irons the arc out (compact): the crown of tops over the plate
  // reads as one level line — cards seated in a holder, not a clipped fan.
  const cx0 = a.ax + slot.dx * spread * a.remPx;
  const by0 = a.ay + (slot.dy * (1 - k.flat) - k.lift) * a.remPx;
  const cy0 = by0 - h / 2;
  // The pack scales about its bottom-centre (ax, ay), then sinks.
  const cx = a.ax + (cx0 - a.ax) * packScale;
  const cy = a.ay + (cy0 - a.ay) * packScale + sink;
  const scale = (w * packScale) / CARD_NATURAL_W;
  const rotation = slot.tilt * k.fan;
  // Top-left for a top-left-origin rotated box concentric with (cx, cy).
  const bw = CARD_NATURAL_W * scale;
  const bh = (CARD_NATURAL_W * (h / w)) * scale;
  const t = rotation * Math.PI / 180;
  const cosT = Math.cos(t);
  const sinT = Math.sin(t);
  return {
    x: cx - (cosT * bw / 2 - sinT * bh / 2),
    y: cy - (sinT * bw / 2 + cosT * bh / 2),
    scale,
    rotation,
  };
}

/** The natural box height the layer sizes a body to (constant card aspect). */
export function bodyNaturalH(a: PackAnchor): number {
  return CARD_NATURAL_W * (a.cardH / a.cardW);
}

/* ── the pose-transition CHOREOGRAPHY (pure — the layer executes it) ── */

/**
 * One pose transition's motion character. All cards ride ONE duration and
 * ONE ease (the pack is one physical object changing posture — per-card
 * physics would read as the fan falling apart); `staggerMaxMs` is the only
 * per-card differentiation: a small CENTRE-OUT extra delay that lets the
 * raised fan «open» instead of translating as a rigid plate.
 */
export type PoseRide = {
  durationMs: number,
  ease: string,
  delayMs: number,
  staggerMaxMs: number,
};

/**
 * The transition table — SEMANTIC priorities, not one shared tween:
 *
 *  - «→ compact» is the LOWEST-attention move in the console: a surface took
 *    the screen and the hand quietly settles into the tray behind it. Long,
 *    sine-in-out (velocity peaks mid-way at a sub-perceptual ~1px/frame),
 *    never a stagger — the player busy with the new surface should not
 *    consciously notice it happened. The old shared 340ms power2.out put
 *    its ~560px/s velocity burst on the FIRST frame, which is exactly what
 *    yanked the eye to the bottom of the screen.
 *
 *  - «→ raised» answers the RT wheel. The wheel itself is mechanical and
 *    immediate (120ms) and must stay the primary object; the hand is its
 *    echo — it starts a beat later (past the wheel's own entry), rises on a
 *    soft in-out, and opens centre-out. Functional state is instant either
 *    way; only the posture is deferred.
 *
 *  - «→ rest» is a calm return, slightly quicker out of compact (the hand
 *    is becoming relevant again) than out of raised (the wheel is gone in
 *    95ms; the hand settling after it is a quiet tail, not a follow-focus).
 */
export function poseRideSpec(from: PackPose, to: PackPose): PoseRide {
  // «→ away» is the quietest move of all — the hand is put away so another
  // seat's fan can take the tray (the dock's inspection context). Same
  // sine-in-out settle as «→ compact», a touch longer (the travel is the
  // whole card height); rideDurationForRemainder keeps the short
  // compact→away leg from crawling.
  if (to === 'away') {
    return {durationMs: 620, ease: 'sine.inOut', delayMs: 0, staggerMaxMs: 0};
  }
  if (to === 'compact') {
    return {durationMs: from === 'raised' ? 560 : 640, ease: 'sine.inOut', delayMs: 0, staggerMaxMs: 0};
  }
  if (to === 'raised') {
    return {durationMs: 420, ease: 'power1.inOut', delayMs: from === 'compact' ? 40 : 60, staggerMaxMs: 40};
  }
  // «→ rest»: coming home out of any tuck (compact or the full away) is the
  // slightly quicker «the hand is relevant again» return.
  return {durationMs: from === 'compact' || from === 'away' ? 480 : 420, ease: 'sine.inOut', delayMs: 0, staggerMaxMs: 0};
}

/**
 * Scale a ride's duration to the travel actually REMAINING (interrupted /
 * reversed transitions restart from the current visual position — see the
 * layer's applyDockedPoses): a reversal caught at 10% of the way must not
 * spend the full budget crawling 2px, and equally must not snap. The sqrt
 * keeps short remainders a little slower than proportional (gentler catch),
 * the floor guarantees a soft landing even for a hair's travel.
 */
export function rideDurationForRemainder(base: number, remainingPx: number, fullPx: number): number {
  if (!(fullPx > 0) || !(remainingPx >= 0)) {
    return base;
  }
  const frac = Math.min(1, remainingPx / fullPx);
  return Math.round(base * Math.max(0.4, Math.sqrt(frac)));
}

/* ── the layer's pose ORACLE (the director's analytic target source) ── */

export type HandBodiesOracle = {
  /** The card's CURRENT docked pose (live pack pose + live geometry). */
  poseFor: (name: string) => BodyPose | undefined,
  /**
   * The docked pose of ONE COPY of `name`, claimed from the hand's END
   * (`seqFromEnd` 0 = the newest copy). The intake director targets this:
   * incoming copies are the hand's newest, so end-claiming never aims a
   * flight at a copy the player already held. Pure — defined the moment
   * the card is IN the hand model, seated or not.
   */
  poseForCopy: (name: string, seqFromEnd: number) => BodyPose | undefined,
  /** Re-seat every docked body on its exact pose (episode-end heal). */
  reconcile: () => void,
  /** Seat bodies that have never been posed (fresh mounts). */
  seatNew: () => void,
  /**
   * THE RETURN THAT NEVER FLIES (handRevealDirector.settleHandHome): these
   * bodies come home from a place the player could NOT see — the album parked
   * behind a play stage — so there is no flight to play. Each is seated on its
   * dock pose in ONE write (zero travel) and the pack rises out of the tray.
   * `reconcile` is the wrong verb there: it TWEENS, and an album→dock delta is
   * hundreds of px, i.e. cards materializing over the board and darting home.
   */
  resettle: (names: ReadonlyArray<string>) => void,
  /** Every body the layer currently owns, in hand order (the director keeps
   *  no card list of its own — modes are its state, names are the layer's). */
  names: () => ReadonlyArray<string>,
};

let oracle: HandBodiesOracle | undefined;

export function setHandBodiesOracle(o: HandBodiesOracle | undefined): void {
  oracle = o;
}

export function handBodiesOracle(): HandBodiesOracle | undefined {
  return oracle;
}
