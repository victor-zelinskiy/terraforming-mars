/*
 * CONSOLE SURFACE MOTION — the PURE transition model (no Vue / DOM / GSAP).
 *
 * The console shell swaps ~20 modal-band surfaces (task host / composers /
 * reveal / quick wheels / sheets) through independent `v-if`s; historically
 * each side played its own con-layer fade, so a swap read as "one DOM element
 * died, another appeared" — double backdrops, blank frames between an action's
 * confirm and its reveal, an instantly-vanishing quick wheel. This module is
 * the ONE place that names what a swap IS, so the runtime (the director) can
 * choreograph it and the shell can gate input around it:
 *
 *  - `classifySurfaceTransition(from, to)` — the transition vocabulary:
 *      open / dismiss            first appearance / final exit of the band
 *      phase                     the NEXT STAGE of one operation (composer →
 *                                its reveal result): shared shade, anchored
 *                                continuity, NEVER a teardown+reopen
 *      handoff                   two independent band surfaces exchanging
 *                                the foreground (sheet → screen)
 *      wheel-open/-dismiss/-handoff  the RT/LT quick selector family —
 *                                faster, more mechanical than any modal
 *  - PHASE PAIRS are declared here (a closed table, never per-call guesses).
 *  - the AWAITING-HANDOFF contract: after a composer's semantic COMMIT the
 *    outgoing surface HOLDS the stage until the server answers (no blank
 *    frame while the round-trip runs); the answer resolves it into a phase
 *    handoff (a reveal arrived) or a plain dismiss. Pure helpers here decide
 *    resolve/expiry; the reactive store applies them.
 *  - DEPARTURE captures: the outgoing surface's panel + anchor rects are
 *    measured once (viewport px) and consumed by the incoming surface's
 *    enter to FLIP shared anchors (the source card travels, it never blinks).
 *
 * Unit-tested under the server runner (no DOM):
 * tests/client/components/console/surfaceMotionModel.spec.ts.
 */

/** The band surfaces the motion system knows by name. */
export type SurfaceMotionId =
  | 'quick'
  | 'card-actions'
  | 'action-composer'
  | 'std-projects'
  | 'ma-screen'
  | 'sheet'
  | 'task-host'
  | 'reveal';

export type SurfaceTransitionKind =
  | 'open'
  | 'dismiss'
  | 'phase'
  | 'handoff'
  | 'wheel-open'
  | 'wheel-dismiss'
  | 'wheel-handoff';

/**
 * The PHASE pairs — "the next stage of the SAME operation". The incoming
 * surface continues the outgoing one's scene: the shade never blinks, shared
 * anchors FLIP, the panel enters as a continuation (not a fresh open).
 * A closed declarative table on purpose — never inferred at a call site.
 */
const PHASE_PAIRS: ReadonlySet<string> = new Set([
  // A blue-card action's confirm stage → its reveal / deck-check result
  // (Asteroid Deflection System, Search For Life).
  'action-composer>reveal',
  // The action center itself is still mounted under the composer when the
  // result lands — the capture may resolve from either.
  'card-actions>reveal',
  // A task-host decision (payment / choice) whose answer produced a reveal.
  'task-host>reveal',
  // The reveal resolved into the next server prompt (Pluto draw → discard
  // fills the hand section; a follow-up choice fills the host).
  'reveal>task-host',
]);

export function isPhasePair(from: SurfaceMotionId, to: SurfaceMotionId): boolean {
  return PHASE_PAIRS.has(`${from}>${to}`);
}

/**
 * Classify a surface swap. `from === undefined` = nothing was on the band;
 * `to === undefined` = the band empties. The wheel family always wins: the
 * quick selector is a command layer, not a modal — its timings are shorter
 * and its handoff carries the chosen slot's origin into the next surface.
 */
export function classifySurfaceTransition(
  from: SurfaceMotionId | undefined,
  to: SurfaceMotionId | undefined,
): SurfaceTransitionKind {
  if (from === 'quick') {
    return to === undefined ? 'wheel-dismiss' : 'wheel-handoff';
  }
  if (to === 'quick') {
    return 'wheel-open';
  }
  if (from === undefined) {
    return 'open';
  }
  if (to === undefined) {
    return 'dismiss';
  }
  return isPhasePair(from, to) ? 'phase' : 'handoff';
}

// ── departure captures (the incoming FLIP's source geometry) ────────────────

/** A viewport-px rect (a plain snapshot — never a live DOMRect). */
export type CapturedRect = {left: number, top: number, width: number, height: number};

export type SurfaceDeparture = {
  from: SurfaceMotionId;
  /** ms timestamp of the capture (performance.now() domain). */
  at: number;
  /** The outgoing panel's box — the incoming enter aims FROM it. */
  panel: CapturedRect | undefined;
  /** `data-motion-anchor` id → rect (e.g. 'card:Asteroid Deflection System'). */
  anchors: ReadonlyMap<string, CapturedRect>;
};

/**
 * A departure is usable by an incoming surface only while FRESH — a capture
 * older than this is a different scene (the player did something else in
 * between) and must never fuel a stale FLIP.
 */
export const DEPARTURE_FRESH_MS = 1200;

export function departureUsable(
  dep: SurfaceDeparture | undefined,
  to: SurfaceMotionId,
  now: number,
): dep is SurfaceDeparture {
  if (dep === undefined || now - dep.at > DEPARTURE_FRESH_MS) {
    return false;
  }
  return isPhasePair(dep.from, to);
}

// ── the wheel handoff origin ────────────────────────────────────────────────

export type WheelHandoffOrigin = {x: number, y: number, at: number};

/** The chosen slot's origin drives the next surface's directional entry only
 *  within this window — after it, the entry is an ordinary open. */
export const WHEEL_ORIGIN_FRESH_MS = 700;

export function wheelOriginUsable(origin: WheelHandoffOrigin | undefined, now: number): origin is WheelHandoffOrigin {
  return origin !== undefined && now - origin.at <= WHEEL_ORIGIN_FRESH_MS;
}

// ── the awaiting-handoff contract (semantic commit → held stage) ────────────

/**
 * After the composer's final A the action is COMMITTED (the batch is on the
 * wire): the composer stays on stage — its CTA shows the in-flight state —
 * until the server's answer picks the next scene. While awaiting:
 *  - ALL pad input is absorbed (B must not "cancel" an action the server is
 *    already applying; repeated A must not double-submit);
 *  - the shade holds;
 *  - the resolve is decided by `resolveAwaiting` on the next authoritative
 *    view; a dead server degrades via `awaitingExpired` (never a stuck shell).
 */
export type AwaitingHandoff = {
  from: SurfaceMotionId;
  /** ms timestamp (performance.now() domain). */
  startedAt: number;
  /** The game-age fingerprint at submit — a poll replay of the SAME state
   *  must not resolve the handoff (only a real server step may). */
  gameAge: number;
  undoCount: number;
};

/** The awaiting stage may never outlive this (a lost response / server error
 *  degrades to an honest dismiss; the alert dialog stays reachable above). */
export const AWAITING_SAFETY_MS = 6000;

export function awaitingExpired(aw: AwaitingHandoff, now: number): boolean {
  return now - aw.startedAt > AWAITING_SAFETY_MS;
}

export type AwaitingResolution =
  /** The answer has not landed yet (same game age, no reveal) — keep holding. */
  | {kind: 'hold'}
  /** The answer produced a reveal result — continue the scene as a PHASE. */
  | {kind: 'phase'}
  /** The answer moved the game on with no follow-up surface — dismiss. */
  | {kind: 'dismiss'};

/**
 * Decide what a fresh authoritative view means for the awaiting stage.
 * `revealArrived` = the view carries a reveal result for the viewer;
 * `gameAge`/`undoCount` = the fresh view's fingerprint (a poll that carries
 * the UNCHANGED state must keep holding — the answer is still in flight).
 */
export function resolveAwaiting(
  aw: AwaitingHandoff,
  view: {gameAge: number, undoCount: number, revealArrived: boolean},
  now: number,
): AwaitingResolution {
  if (view.revealArrived) {
    return {kind: 'phase'};
  }
  if (view.gameAge !== aw.gameAge || view.undoCount !== aw.undoCount) {
    return {kind: 'dismiss'};
  }
  if (awaitingExpired(aw, now)) {
    return {kind: 'dismiss'};
  }
  return {kind: 'hold'};
}
