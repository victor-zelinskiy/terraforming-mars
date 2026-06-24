import {reactive} from 'vue';
import {Color} from '@/common/Color';

/**
 * turnHandoffState — the TurnHandoff presentation layer.
 *
 * The start of a turn is NOT a notification — it is a change of interface
 * STATE. When the active turn owner changes (ACTION phase), the new owner's
 * player card "ignites" like a sci-fi command terminal: a short burst (cube
 * ignition + command brackets + a transient "▶ ВАШ ХОД" status), then the
 * card settles back into the calm normal "● ДЕЙСТВИЕ X/Y" state. There is NO
 * timed "your turn lasts N seconds" nagging — this game has no turn clock.
 * Instead an INACTIVITY escalation runs ONLY for the local player and ONLY
 * when the player gives ZERO input after the handoff.
 *
 * WHY module scope (mirrors `journalState` / `notificationState`): the driver
 * (`TurnHandoffLayer`) is mounted at App level so it survives the
 * `:key="playerkey"` remount, but the BURST presentation is read by
 * `LeftPlayerCard` which lives inside the remounted `PlayerHome`. Module-level
 * reactive state is the only thing that bridges the two AND survives the
 * remount. The Vue surfaces only READ this store + call the controller
 * functions below.
 *
 * Notification policy: the `your-turn` toast is suppressed by NotificationLayer
 * when the player card can present the handoff (desktop). The two layers are
 * INDEPENDENT — turn lifecycle lives here (player-card layer), ordinary game
 * events stay in the notification layer.
 */

// ── Tunables ────────────────────────────────────────────────────────────────
/** Burst phase length (spec: 1200–1800ms). */
export const BURST_MS = 1500;
/** Burst length under reduced-motion — a brief status swap, no theatrics. */
export const BURST_MS_REDUCED = 650;
/** Handoff beam length (spec: 500–700ms). */
export const BEAM_MS = 620;
/** Micro-pulse fires if there was NO input by this point (spec: 8–12s). */
export const IDLE_PULSE_MS = 10_000;
/** Anchored hint fires if there was STILL no input by this point (spec: 30–45s). */
export const IDLE_HINT_MS = 36_000;
/** How long the one-shot micro-pulse stays visible. */
const IDLE_PULSE_VISIBLE_MS = 1300;
/** Pointer travel (px) below which a move is cursor settle, not real input. */
const INPUT_MOVE_THRESHOLD = 6;

export type HandoffBeam = {from: Color; to: Color; id: number};

type TurnHandoffStore = {
  /** The viewer's own colour (the local player). Undefined for spectators. */
  localColor: Color | undefined;
  /** The current ACTION-phase turn owner (the active player). */
  currentOwner: Color | undefined;
  /** The previous turn owner — kept for the optional handoff beam. */
  previousOwner: Color | undefined;
  /** Whether the first observation has been seeded (no burst on load/reconnect). */
  seeded: boolean;

  // ── Burst (transient command activation) ──
  /** The card currently playing the ignition burst, or undefined. */
  burstColor: Color | undefined;
  /** True when the bursting card is the LOCAL player (stronger "▶ ВАШ ХОД"). */
  burstIsLocal: boolean;

  // ── Idle escalation (local player only) ──
  /** A card briefly playing the idle micro-pulse, or undefined. */
  idlePulseColor: Color | undefined;
  /** Whether the anchored "Ваш ход — выберите действие" hint is showing. */
  idleHintActive: boolean;

  // ── Handoff beam (optional) ──
  beam: HandoffBeam | undefined;
};

export const turnHandoffState = reactive<TurnHandoffStore>({
  localColor: undefined,
  currentOwner: undefined,
  previousOwner: undefined,
  seeded: false,
  burstColor: undefined,
  burstIsLocal: false,
  idlePulseColor: undefined,
  idleHintActive: false,
  beam: undefined,
});

// ── Non-reactive controller internals ───────────────────────────────────────
let burstTimer: number | undefined;
let beamTimer: number | undefined;
let idlePulseTimer: number | undefined;
let idlePulseHideTimer: number | undefined;
let idleHintTimer: number | undefined;
let beamSeq = 0;
let pointerOrigin: {x: number; y: number} | undefined;
let listenersInstalled = false;
let cardCtaPulseTimer: number | undefined;

function clearTimer(id: number | undefined): undefined {
  if (id !== undefined) {
    window.clearTimeout(id);
  }
  return undefined;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── Pure decision core (unit-tested) ────────────────────────────────────────

export type TurnTransition =
  | {kind: 'seed'}
  | {kind: 'none'}
  | {kind: 'handoff'; owner: Color | undefined; previous: Color | undefined};

/**
 * Decide what a turn-owner observation means. PURE — no timers, no DOM, no
 * reactive writes — so the state machine is unit-testable.
 *
 *  - first observation → `seed` (never bursts on load / reconnect);
 *  - owner unchanged → `none` (a continuation of the same turn, or the lone
 *    non-passed player repeating turns — control was never handed off);
 *  - owner changed → `handoff` (a real hand-off; carries previous→owner so the
 *    caller can fire the burst on `owner` and a beam from `previous`).
 */
export function decideTurnTransition(
  prevOwner: Color | undefined,
  nextOwner: Color | undefined,
  seeded: boolean,
): TurnTransition {
  if (!seeded) {
    return {kind: 'seed'};
  }
  if (prevOwner === nextOwner) {
    return {kind: 'none'};
  }
  return {kind: 'handoff', owner: nextOwner, previous: prevOwner};
}

// ── Controller ──────────────────────────────────────────────────────────────

/**
 * Feed one game-state observation to the controller. Called by
 * `TurnHandoffLayer` on every `playerView` change.
 *
 * `owner` is the ACTION-phase active player's colour (undefined outside ACTION
 * / at game end). `localColor` is the viewer's own colour.
 */
export function noteTurnState(input: {
  localColor: Color | undefined;
  owner: Color | undefined;
  reducedMotion?: boolean;
}): void {
  turnHandoffState.localColor = input.localColor;
  const reduced = input.reducedMotion ?? prefersReducedMotion();
  const transition = decideTurnTransition(turnHandoffState.currentOwner, input.owner, turnHandoffState.seeded);

  switch (transition.kind) {
  case 'seed':
    // First observation — adopt the owner silently (a reload during your own
    // turn is a CONTINUATION, not a fresh hand-off; the calm status chip
    // already says it's your turn).
    turnHandoffState.seeded = true;
    turnHandoffState.previousOwner = undefined;
    turnHandoffState.currentOwner = input.owner;
    return;
  case 'none':
    // Same owner — nothing to announce. Idle escalation (if armed) keeps
    // running; the player gives input through their actions which cancels it.
    return;
  case 'handoff':
  default:
    turnHandoffState.previousOwner = transition.previous;
    turnHandoffState.currentOwner = transition.owner;
    // A new turn begins → drop everything from the previous turn so a stale
    // burst / idle hint / beam can never linger (edge case: fast turn changes).
    cancelBurst();
    cancelIdle();
    cancelBeam();
    if (transition.owner !== undefined) {
      fireBurst(transition.owner, transition.owner === input.localColor, reduced);
    }
    // Optional handoff beam between the two cards — never under reduced-motion.
    if (!reduced && transition.previous !== undefined && transition.owner !== undefined) {
      fireBeam(transition.previous, transition.owner);
    }
    // Inactivity escalation runs ONLY for the local player's own fresh turn.
    if (transition.owner !== undefined && transition.owner === input.localColor) {
      armIdle();
      fireCtaPulse();
    }
    return;
  }
}

function fireBurst(color: Color, isLocal: boolean, reduced: boolean): void {
  turnHandoffState.burstColor = color;
  turnHandoffState.burstIsLocal = isLocal;
  burstTimer = clearTimer(burstTimer);
  burstTimer = window.setTimeout(() => {
    turnHandoffState.burstColor = undefined;
    turnHandoffState.burstIsLocal = false;
    burstTimer = undefined;
  }, reduced ? BURST_MS_REDUCED : BURST_MS);
}

function cancelBurst(): void {
  burstTimer = clearTimer(burstTimer);
  turnHandoffState.burstColor = undefined;
  turnHandoffState.burstIsLocal = false;
}

function fireBeam(from: Color, to: Color): void {
  beamSeq++;
  turnHandoffState.beam = {from, to, id: beamSeq};
  beamTimer = clearTimer(beamTimer);
  beamTimer = window.setTimeout(() => {
    turnHandoffState.beam = undefined;
    beamTimer = undefined;
  }, BEAM_MS);
}

function cancelBeam(): void {
  beamTimer = clearTimer(beamTimer);
  turnHandoffState.beam = undefined;
}

/**
 * Arm the inactivity escalation for the local player's fresh turn. Absolute
 * schedule FROM the hand-off — the first real input cancels the whole chain
 * for the rest of the turn (spec: a reminder only fires when the player gives
 * NO input at all). Re-arming on a new turn clears the previous schedule.
 */
function armIdle(): void {
  cancelIdle();
  pointerOrigin = undefined;
  idlePulseTimer = window.setTimeout(() => {
    turnHandoffState.idlePulseColor = turnHandoffState.localColor;
    idlePulseHideTimer = clearTimer(idlePulseHideTimer);
    idlePulseHideTimer = window.setTimeout(() => {
      turnHandoffState.idlePulseColor = undefined;
      idlePulseHideTimer = undefined;
    }, IDLE_PULSE_VISIBLE_MS);
    idlePulseTimer = undefined;
  }, IDLE_PULSE_MS);
  idleHintTimer = window.setTimeout(() => {
    turnHandoffState.idleHintActive = true;
    idleHintTimer = undefined;
  }, IDLE_HINT_MS);
}

function cancelIdle(): void {
  idlePulseTimer = clearTimer(idlePulseTimer);
  idlePulseHideTimer = clearTimer(idlePulseHideTimer);
  idleHintTimer = clearTimer(idleHintTimer);
  turnHandoffState.idlePulseColor = undefined;
  turnHandoffState.idleHintActive = false;
}

/**
 * Record meaningful local-player input. Cancels the idle escalation for the
 * rest of the turn (no re-arm) and hides any showing hint. Called by the
 * window input listeners.
 */
export function registerTurnInput(): void {
  // Only relevant while it is the local player's own turn.
  if (turnHandoffState.currentOwner === undefined ||
      turnHandoffState.currentOwner !== turnHandoffState.localColor) {
    return;
  }
  cancelIdle();
}

// ── Optional CTA pulse (a single soft highlight of the action bar) ───────────

/**
 * One-shot, very subtle highlight of the bottom action/navigation bar at the
 * start of the local player's turn — a calm "your controls are here" cue. A
 * body class drives a single CSS pulse; removed after it plays. Never under
 * reduced-motion.
 */
function fireCtaPulse(): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) {
    return;
  }
  cardCtaPulseTimer = clearTimer(cardCtaPulseTimer);
  document.body.classList.add('turn-cta-flash');
  cardCtaPulseTimer = window.setTimeout(() => {
    document.body.classList.remove('turn-cta-flash');
    cardCtaPulseTimer = undefined;
  }, 1200);
}

// ── Window input tracking (install once, App-level) ──────────────────────────

function onPointerMove(e: PointerEvent): void {
  if (pointerOrigin === undefined) {
    pointerOrigin = {x: e.clientX, y: e.clientY};
    return; // first sample — wait for real travel, not a 1-px settle
  }
  const dx = e.clientX - pointerOrigin.x;
  const dy = e.clientY - pointerOrigin.y;
  if (Math.hypot(dx, dy) < INPUT_MOVE_THRESHOLD) {
    return;
  }
  registerTurnInput();
}

function onDiscreteInput(): void {
  registerTurnInput();
}

export function installTurnInputTracking(): void {
  if (listenersInstalled || typeof window === 'undefined') {
    return;
  }
  listenersInstalled = true;
  window.addEventListener('pointermove', onPointerMove, {passive: true});
  window.addEventListener('pointerdown', onDiscreteInput, {passive: true});
  window.addEventListener('keydown', onDiscreteInput);
  window.addEventListener('wheel', onDiscreteInput, {passive: true});
  window.addEventListener('touchstart', onDiscreteInput, {passive: true});
}

export function uninstallTurnInputTracking(): void {
  if (!listenersInstalled || typeof window === 'undefined') {
    return;
  }
  listenersInstalled = false;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerdown', onDiscreteInput);
  window.removeEventListener('keydown', onDiscreteInput);
  window.removeEventListener('wheel', onDiscreteInput);
  window.removeEventListener('touchstart', onDiscreteInput);
}

/** Full reset — called on game end / a different game / layer teardown. */
export function resetTurnHandoff(): void {
  cancelBurst();
  cancelIdle();
  cancelBeam();
  cardCtaPulseTimer = clearTimer(cardCtaPulseTimer);
  if (typeof document !== 'undefined') {
    document.body.classList.remove('turn-cta-flash');
  }
  turnHandoffState.localColor = undefined;
  turnHandoffState.currentOwner = undefined;
  turnHandoffState.previousOwner = undefined;
  turnHandoffState.seeded = false;
  turnHandoffState.burstColor = undefined;
  turnHandoffState.burstIsLocal = false;
  turnHandoffState.idlePulseColor = undefined;
  turnHandoffState.idleHintActive = false;
  turnHandoffState.beam = undefined;
  pointerOrigin = undefined;
}

/**
 * Whether the left player panel can present the turn hand-off on-card right
 * now (desktop, panel on-screen, tab visible). When false, the start-of-turn
 * should fall back to the toast (panel hidden, narrow/reduced layout, or the
 * tab is inactive). Shared by NotificationLayer (toast suppression) so the two
 * layers agree on a single signal.
 */
export function isPlayerPanelVisible(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  if (document.hidden) {
    return false; // tab inactive → the burst would be unseen; fall back to toast
  }
  const el = document.querySelector('.left-panel-cards');
  if (!(el instanceof HTMLElement)) {
    // The panel isn't in the DOM yet — almost always the async <player-home>
    // chunk still resolving on first load (the panel is core UI, always
    // rendered on a normal layout). On a desktop-width viewport assume the
    // panel WILL appear and own the hand-off (suppress, no transient toast
    // flash); on a narrow/reduced viewport fall back to the toast.
    return typeof window !== 'undefined' && window.innerWidth >= 760;
  }
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) {
    return false; // collapsed / display:none
  }
  // Off-screen (narrow / reduced layout where the panel isn't on the canvas).
  if (r.right <= 0 || r.left >= window.innerWidth || r.bottom <= 0 || r.top >= window.innerHeight) {
    return false;
  }
  return true;
}
