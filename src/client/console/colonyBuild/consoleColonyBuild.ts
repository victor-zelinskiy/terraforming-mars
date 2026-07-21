/*
 * CONSOLE COLONY BUILD — the animation TRANSACTION behind the premium
 * "the build bonus frees the slot, then my cube takes it" hero scene
 * (console-native only).
 *
 * The gate follows the established client-armed contract (tile-placement /
 * trade-fleet / patent-sale):
 *
 *   the colonies-screen Build confirm ARMS the transaction (armColonyBuild —
 *   console-only, BEFORE the POST). WaitingFor DETECTS it once per response
 *   (detectColonyBuild — VERIFIES the viewer's cube landed in the armed
 *   colony's next slot + CAPTURES the slot geometry while the glyph is still
 *   rendered), HOLDS the commit through the sequence (await runColonyBuild):
 *   the cube flies to a WAITING pose above the slot, the build bonus LEAVES
 *   the slot (a resource flies to the panel / a card lifts into the reveal
 *   space / an abstract glyph is vacated), and only once it has CLEARED the
 *   slot does the cube DESCEND into the exact centre. For a resource bonus the
 *   commit is held until the chip lands on the panel (patent-sale style), so
 *   the resource is credited exactly as the bonus arrives. Then it COMMITS
 *   (the real filled-cell cube paints pixel-identical UNDER the settled proxy),
 *   and endColonyBuild() performs the seamless one-frame handoff (+ absorbs the
 *   resting resource chip). abortColonyBuild() is wired into every error path +
 *   a safety timer.
 *
 * The cube is ONE physical object — the SAME premium 3D `PlayerCube` token the
 * main board uses, mounted at its FINAL size and never re-scaled in flight.
 * The landing is a physical contact beat (base-anchored micro-squash that
 * recovers to exactly 1, shadow spread, glow ignition, impact ring), and the
 * gate resolves only at FULL visual rest, so the proxy is pixel-identical to
 * the static in-cell cube at handoff. The cube and the bonus never occupy the
 * same area (the bonus clears the slot before the cube descends).
 *
 * Ownership map: phases/timings/spec-extraction/proof → colonyBuildModel (pure);
 * GSAP → colonyBuildDirector; the fixed stage → ConsoleColonyBuildLayer.vue.
 *
 * DESKTOP SAFETY: `armColonyBuild` is only ever called by the console shell.
 */

import {reactive, nextTick} from 'vue';
import {Color} from '@/common/Color';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {
  ColonyBuildPhase, BuildRect, BonusExitMode,
  buildRewardSpecs, buildBonusMode, verifyColonyBuild,
  CUBE_APPROACH_MS, BONUS_CLEAR_MS, CUBE_DESCENT_MS, CUBE_SETTLE_MS, REDUCED_MS, ARM_SAFETY_MS,
} from '@/client/console/colonyBuild/colonyBuildModel';
import {
  ColonyBuildStageEls, placeCubeProxy, playCubeApproach, playCubeDescent,
  disposeCubeProxy, killColonyBuildTweens,
} from '@/client/console/colonyBuild/colonyBuildDirector';
import {
  runResourceTransfers, abortResourceTransfers, settleResourceTransfers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {armBoardCardBonus, abortBoardCardBonus} from '@/client/console/boardCardBonus/consoleBoardCardBonus';

export const colonyBuildState = reactive({
  /** TRUE from arm until finish/abort — the transaction lock. */
  active: false,
  phase: 'idle' as ColonyBuildPhase,
  nonce: 0,
  /** The colony being built (its slot is the landing anchor). */
  colonyName: '' as string,
  /** The slot the cube lands in (its build bonus is the one leaving). */
  slotIndex: 0,
  /** The builder's cube colour. */
  color: '' as Color | '',
  reducedMotion: false,
  /** How the slot's bonus leaves (resource chip / card cover / vacate). */
  mode: 'none' as BonusExitMode,
  /** The captured build-slot cell rect (the cube proxy IS this rect). */
  slotRect: undefined as BuildRect | undefined,
});

/** One-shot claim per response (mirrors the sibling transactions). */
let claimed = false;
let armSafety: number | undefined;
let sceneSafety: number | undefined;
/** Resolves the WaitingFor commit gate (abort must always free it). */
let runResolve: (() => void) | undefined;
/** The resource specs the leaving bonus carries (captured at detect). */
let pendingSpecs: ReadonlyArray<ResourceTransferSpec> = [];
/** The resource chip's flight (resolves when it RESTS on the panel — 'hold'). */
let bonusFlight: Promise<void> | undefined;
/** The REAL benefit glyph we blanked as the bonus left — restored on finish/abort. */
let heldGlyphEl: HTMLElement | undefined;

// ── stage registry (the layer plugs in) ─────────────────────────────────────

type ColonyBuildStageHandle = {els: () => ColonyBuildStageEls | undefined};
let stage: ColonyBuildStageHandle | undefined;

export function registerColonyBuildStage(handle: ColonyBuildStageHandle | undefined): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
}

// ── predicates ──────────────────────────────────────────────────────────────

export function isColonyBuildActive(): boolean {
  return colonyBuildState.active;
}

/** TRUE while the scene owns the foreground (pad inert, surfaces held). */
export function colonyBuildHolding(): boolean {
  const p = colonyBuildState.phase;
  return colonyBuildState.active && p !== 'idle' && p !== 'armed' && p !== 'failed';
}

registerAnimationHoldSupplier('colony-build', colonyBuildHolding);

// ── the lifecycle ───────────────────────────────────────────────────────────

/** ARM (the colonies-screen Build confirm, BEFORE the POST). Sync `active`. */
export function armColonyBuild(colonyName: string, slotIndex: number, color: Color): void {
  clearTimers();
  claimed = false;
  pendingSpecs = [];
  bonusFlight = undefined;
  restoreHeldGlyph();
  colonyBuildState.active = true;
  colonyBuildState.phase = 'armed';
  colonyBuildState.nonce++;
  colonyBuildState.colonyName = colonyName;
  colonyBuildState.slotIndex = slotIndex;
  colonyBuildState.color = color;
  colonyBuildState.mode = 'none';
  colonyBuildState.slotRect = undefined;
  colonyBuildState.reducedMotion = consoleReducedMotionActive();
  armSafety = window.setTimeout(() => abortColonyBuild(), ARM_SAFETY_MS);
}

/**
 * DETECT (WaitingFor commit path) — consume the arm exactly once. VERIFIES the
 * build + CAPTURES the slot geometry while the glyph is still on screen (it
 * vanishes once the slot is occupied). Undefined on desktop / a refused build.
 */
export function detectColonyBuild(prevView: ViewModel, newView: ViewModel): {colonyName: string} | undefined {
  if (!colonyBuildState.active || claimed) {
    return undefined;
  }
  claimed = true;
  if (armSafety !== undefined) {
    window.clearTimeout(armSafety);
    armSafety = undefined;
  }
  const color = newView.thisPlayer?.color;
  const proof = color === undefined ? undefined : verifyColonyBuild(
    prevView.game?.colonies ?? [], newView.game?.colonies ?? [], colonyBuildState.colonyName, color);
  if (proof === undefined) {
    abortColonyBuild();
    return undefined;
  }
  colonyBuildState.slotIndex = proof.slotIndex;
  const metadata = getColony(colonyBuildState.colonyName as ColonyName);
  pendingSpecs = buildRewardSpecs(metadata, proof.slotIndex);
  colonyBuildState.mode = buildBonusMode(metadata, proof.slotIndex);
  colonyBuildState.slotRect = measureBuildSlot(colonyBuildState.colonyName, proof.slotIndex);
  return {colonyName: colonyBuildState.colonyName};
}

/**
 * RUN (WaitingFor await) — the full sequence, holding the commit throughout:
 * the cube flies to the waiting pose, the bonus LEAVES the slot, and (once it
 * has cleared) the cube DESCENDS into the centre. For a resource bonus the
 * gate additionally holds until the chip RESTS on the panel. Resolves once the
 * cube is seated (+ the bonus has landed); the caller commits right after.
 * NEVER rejects — every failure degrades and the gate can never hang.
 */
export function runColonyBuild(): Promise<void> {
  return new Promise<void>((resolve) => {
    runResolve = resolve;
    sceneSafety = window.setTimeout(() => {
      freeRunGate(); // rAF stall — force the gate open, degrade gracefully
    }, motionMs(CUBE_APPROACH_MS + BONUS_CLEAR_MS + CUBE_DESCENT_MS + CUBE_SETTLE_MS) + 4000);
    void executeBuild().finally(() => freeRunGate());
  });
}

async function executeBuild(): Promise<void> {
  if (!colonyBuildState.active) {
    return;
  }
  const slot = colonyBuildState.slotRect;
  if (colonyBuildState.reducedMotion || slot === undefined || typeof document === 'undefined') {
    // Reduced / unmeasurable: no cube animation, but the bonus still leaves +
    // credits (the chip self-degrades to an instant release under reduced).
    startBonusExit();
    colonyBuildState.phase = 'landed';
    await wait(colonyBuildState.reducedMotion ? REDUCED_MS : 60);
    await settleBonusFlight();
    return;
  }
  await nextTick(); // the layer mounts the cube proxy
  if (!colonyBuildState.active) {
    return;
  }
  const els = stage?.els();
  if (els === undefined || !placeCubeProxy(els, {slot})) {
    startBonusExit();
    colonyBuildState.phase = 'landed';
    await wait(60);
    await settleBonusFlight();
    return;
  }
  // 1) The cube flies in to the WAITING pose above the slot (final size).
  colonyBuildState.phase = 'waiting';
  await playCubeApproach(els, {slot, ms: motionMs(CUBE_APPROACH_MS)});
  if (!colonyBuildState.active) {
    return;
  }
  // 2) The cube is waiting — NOW the bonus lifts out and leaves the slot.
  startBonusExit();
  // 3) Wait for the bonus to CLEAR the slot bounds before the cube may descend
  //    (their flights may overlap, but never in the same area).
  await wait(motionMs(BONUS_CLEAR_MS));
  if (!colonyBuildState.active) {
    return;
  }
  // 4) The cube drops into the vacated slot centre — gravity fall + the
  //    physical contact beat — and comes to FULL rest before the gate opens.
  colonyBuildState.phase = 'descending';
  await playCubeDescent(els, {dropMs: motionMs(CUBE_DESCENT_MS), settleMs: motionMs(CUBE_SETTLE_MS)});
  if (!colonyBuildState.active) {
    return;
  }
  // 5) Land the commit on a bonus that has already reached the panel (resource).
  await settleBonusFlight();
  colonyBuildState.phase = 'landed';
}

/**
 * Start the bonus LEAVING the slot (called once the cube is waiting):
 *  - resource → blank the real glyph as the chip is born + fly it to the panel
 *    ('hold' — it rests there; the gated commit credits it, settle absorbs it);
 *  - card → lift the card cover off the slot glyph (board-card-bonus);
 *  - none → simply vacate the abstract glyph as the cube takes the cell.
 */
function startBonusExit(): void {
  const mode = colonyBuildState.mode;
  const slot = colonyBuildState.slotRect;
  if (mode === 'card') {
    armBoardCardBonus({kind: 'colony-cell', colonyName: colonyBuildState.colonyName, slotIndex: colonyBuildState.slotIndex});
    return;
  }
  blankSlotGlyph(); // 1:1 takeover / vacate — the glyph is gone before the cube arrives
  if (mode === 'resource' && slot !== undefined && pendingSpecs.length > 0) {
    const from: TransferPoint = {x: slot.x + slot.w / 2, y: slot.y + slot.h / 2};
    bonusFlight = runResourceTransfers({
      specs: pendingSpecs,
      source: {point: from},
      arrival: 'hold',
    });
  }
}

/** Wait for the resource chip to land on the panel (resolves at once otherwise). */
async function settleBonusFlight(): Promise<void> {
  const flight = bonusFlight;
  if (flight !== undefined) {
    await flight;
  }
}

/** NO-OP: the resource chip credits via the gated commit ('hold' arrival), so
 *  there is no panel-reward-hold to seed. Kept for the WaitingFor wiring. */
export function seedColonyBuildRewardHold(): void {
  // Intentionally empty — see the doc comment.
}

/**
 * END (next tick, after the view committed) — the real filled-cell cube just
 * painted pixel-identical UNDER the settled proxy, so remove the proxy in one
 * frame (seamless) and, for a resource bonus, absorb the resting chip into the
 * panel row (its delta chip fired on the commit). A card cover continues under
 * board-card-bonus's own lifecycle.
 */
export async function endColonyBuild(): Promise<void> {
  if (!colonyBuildState.active) {
    return;
  }
  const els = stage?.els();
  if (els !== undefined) {
    disposeCubeProxy(els);
  }
  if (colonyBuildState.mode === 'resource') {
    await settleResourceTransfers();
  }
  finish();
}

/** ABORT — refused build, network failure, safety timer, unmount. */
export function abortColonyBuild(): void {
  if (!colonyBuildState.active && runResolve === undefined) {
    return;
  }
  clearTimers();
  const els = stage?.els();
  if (els !== undefined) {
    killColonyBuildTweens(els);
  }
  abortResourceTransfers();
  restoreHeldGlyph();
  if (colonyBuildState.mode === 'card') {
    abortBoardCardBonus('return'); // the card never came — recall the cover
  }
  pendingSpecs = [];
  bonusFlight = undefined;
  colonyBuildState.active = false;
  colonyBuildState.phase = 'failed';
  freeRunGate();
  void nextTick(() => {
    if (colonyBuildState.phase === 'failed') {
      resetTransient();
    }
  });
}

function finish(): void {
  clearTimers();
  restoreHeldGlyph();
  pendingSpecs = [];
  bonusFlight = undefined;
  colonyBuildState.active = false;
  colonyBuildState.phase = 'done';
  void nextTick(() => {
    if (colonyBuildState.phase === 'done') {
      resetTransient();
    }
  });
}

/** Full reset (tests / game-switch boundary). */
export function resetColonyBuild(): void {
  clearTimers();
  const els = stage?.els();
  if (els !== undefined) {
    killColonyBuildTweens(els);
  }
  abortResourceTransfers();
  restoreHeldGlyph();
  pendingSpecs = [];
  bonusFlight = undefined;
  claimed = false;
  runResolve = undefined;
  colonyBuildState.active = false;
  resetTransient();
}

// ── internals ───────────────────────────────────────────────────────────────

function resetTransient(): void {
  colonyBuildState.phase = 'idle';
  colonyBuildState.colonyName = '';
  colonyBuildState.slotIndex = 0;
  colonyBuildState.color = '';
  colonyBuildState.mode = 'none';
  colonyBuildState.slotRect = undefined;
}

function escapeName(name: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(name) : name.replace(/"/g, '\\"');
}

/** The live rect of the build slot (post fit/zoom). */
function measureBuildSlot(colonyName: string, slotIndex: number): BuildRect | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const el = document.querySelector<HTMLElement>(
    `[data-colony-build-slot="${escapeName(colonyName + '#' + slotIndex)}"]`);
  if (el === null) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  return r.width > 3 && r.height > 3 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

/** Blank the REAL benefit glyph as the bonus leaves (the `con-deal-hold` swap
 *  discipline) — the slot is empty before the cube descends into it. */
function blankSlotGlyph(): void {
  if (typeof document === 'undefined') {
    return;
  }
  const slotSel = `[data-colony-build-slot="${escapeName(colonyBuildState.colonyName + '#' + colonyBuildState.slotIndex)}"]`;
  const el = document.querySelector<HTMLElement>(`${slotSel} .benefit-glyph`);
  if (el !== null) {
    heldGlyphEl = el;
    el.classList.add('con-deal-hold');
  }
}

function restoreHeldGlyph(): void {
  heldGlyphEl?.classList.remove('con-deal-hold');
  heldGlyphEl = undefined;
}

function freeRunGate(): void {
  if (sceneSafety !== undefined) {
    window.clearTimeout(sceneSafety);
    sceneSafety = undefined;
  }
  const r = runResolve;
  runResolve = undefined;
  r?.();
}

function clearTimers(): void {
  if (armSafety !== undefined) {
    window.clearTimeout(armSafety);
    armSafety = undefined;
  }
  if (sceneSafety !== undefined) {
    window.clearTimeout(sceneSafety);
    sceneSafety = undefined;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
