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

export type PackPose = 'rest' | 'compact' | 'raised';

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

/** Pack-level pose knobs (ported from the old `--hd-*` CSS vars). The
 *  handheld profile keeps its tighter base spread; `raised` opens the fan
 *  (tilts on) and lifts the pack — the «на готове» pose the flight departs
 *  from and returns into. */
const POSE_KNOBS: Record<PackPose, {spread: number, lift: number, fan: number, scale: number, sink: number}> = {
  rest: {spread: 1, lift: 0, fan: 0, scale: 1, sink: 0},
  compact: {spread: 1, lift: 0, fan: 0, scale: 0.7, sink: 0.12},
  raised: {spread: 1.12, lift: 0.45, fan: 1, scale: 1, sink: 0},
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

/** Read the profile-tuned constants (mirrors the old CSS profile blocks). */
export function packProfileTuning(profile: string): {cardW: number, cardH: number, baseSpread: number, compactScale: number, compactSink: number} {
  if (profile === 'handheld') {
    return {cardW: 2.6, cardH: 3.65, baseSpread: 0.84, compactScale: 0.78, compactSink: 0.08};
  }
  return {cardW: HAND_DOCK_CARD_W_REM, cardH: HAND_DOCK_CARD_H_REM, baseSpread: 1, compactScale: 0.7, compactSink: 0.12};
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
  const packScale = pose === 'compact' ? a.compactScale : k.scale;
  const sink = (pose === 'compact' ? a.compactSink : k.sink) * a.remPx;
  const w = a.cardW * a.remPx;
  const h = a.cardH * a.remPx;
  // Pre-scale placement (pack coordinates): centre-x from dx·spread, the
  // card's BOTTOM on the tray axis, shifted by arc dy and the raised lift.
  const cx0 = a.ax + slot.dx * spread * a.remPx;
  const by0 = a.ay + (slot.dy - k.lift) * a.remPx;
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
};

let oracle: HandBodiesOracle | undefined;

export function setHandBodiesOracle(o: HandBodiesOracle | undefined): void {
  oracle = o;
}

export function handBodiesOracle(): HandBodiesOracle | undefined {
  return oracle;
}
