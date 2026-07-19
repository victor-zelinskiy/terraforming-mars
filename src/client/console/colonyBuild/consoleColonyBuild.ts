/*
 * CONSOLE COLONY BUILD — the animation TRANSACTION behind the premium
 * "my cube drops into the colony slot and the one-time build bonus is lifted
 * out of the cell" hero scene (console-native only).
 *
 * The gate follows the established tile-placement / trade-fleet contract:
 *
 *   the colonies-screen Build confirm ARMS the transaction (armColonyBuild —
 *   console-only, BEFORE the POST; nothing visual yet). WaitingFor DETECTS it
 *   once per response (detectColonyBuild — consumes the arm and VERIFIES the
 *   server actually put the viewer's cube in the armed colony's next slot: a
 *   refused build unwinds with zero trace), CAPTURES the build slot's + its
 *   benefit glyph's live geometry while the glyph is still rendered (it is
 *   removed once the slot is occupied), HOLDS the commit through the drop
 *   (await runColonyBuild — the cube proxy descends while the glyph is
 *   displaced upward and hovers), SEEDS the panel reward hold for a resource
 *   build bonus, then COMMITS (the real filled-cell cube paints under the
 *   proxy), and finally endColonyBuild() plays the post-commit REWARD BEAT:
 *   the hovering glyph hands off to physical resource chips (the shared
 *   Resource Transfer Framework) that pay out — each touchdown releases its
 *   metric, firing that delta chip at the contact. A CARD build bonus (Pluto)
 *   instead lifts a card cover off the same cell (board-card-bonus). A
 *   chip-less build (TR / VP / a deferred pick / a board follow-up) just
 *   drops the cube. abortColonyBuild() is wired into every error path + a
 *   safety timer.
 *
 * Ownership map:
 *   - phases / timings / spec extraction / build proof → colonyBuildModel (pure);
 *   - GSAP work on the stage                          → colonyBuildDirector;
 *   - the fixed proxy stage                           → ConsoleColonyBuildLayer.vue.
 *
 * DESKTOP SAFETY: `armColonyBuild` is only ever called by the console shell,
 * so on desktop `colonyBuildState.active` is false and `detectColonyBuild`
 * returns undefined → the WaitingFor hold never engages.
 */

import {reactive, nextTick} from 'vue';
import {Color} from '@/common/Color';
import {ColonyName} from '@/common/colonies/ColonyName';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {
  ColonyBuildPhase, BuildRect,
  buildRewardSpecs, buildBonusIsCard, verifyColonyBuild,
  CUBE_DROP_MS, CUBE_SETTLE_MS, GLYPH_PRELIFT_START_T, GLYPH_RISE_MS, GLYPH_HOVER_PX,
  HANDOFF_BREATH_MS, REDUCED_MS, ARM_SAFETY_MS,
} from '@/client/console/colonyBuild/colonyBuildModel';
import {
  ColonyBuildStageEls, placeCubeProxy, playCubeDrop, playGlyphPreLift, playGlyphHandoff,
  disposeCubeProxy, killColonyBuildTweens,
} from '@/client/console/colonyBuild/colonyBuildDirector';
import {
  runResourceTransfers, abortResourceTransfers,
  beginPanelRewardHold, releasePanelRewardHold, clearPanelRewardHold,
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
  /** The slot the cube lands in (its build bonus is the one being taken). */
  slotIndex: 0,
  /** The builder's cube colour. */
  color: '' as Color | '',
  reducedMotion: false,
  /** The build bonus is a CARD (Pluto) — the cover lifts via board-card-bonus,
   *  so this scene skips the glyph proxy (the card cover owns the cell). */
  isCard: false,
  /** A resource build bonus with an on-panel chip → render + pre-lift the glyph
   *  proxy (false for card / cube-only builds). */
  hasGlyph: false,
  /** The captured build-slot cell rect (the cube proxy fills it). */
  slotRect: undefined as BuildRect | undefined,
  /** The captured benefit-glyph rect (the glyph proxy's resting pose). */
  glyphRect: undefined as BuildRect | undefined,
});

/** One-shot claim per response (mirrors the sibling transactions). */
let claimed = false;
let armSafety: number | undefined;
let sceneSafety: number | undefined;
/** Resolves the WaitingFor commit gate (abort must always free it). */
let runResolve: (() => void) | undefined;
/** The resource specs the reward beat carries (captured at detect). */
let pendingSpecs: ReadonlyArray<ResourceTransferSpec> = [];
/** The hold was seeded for THIS transaction (the commit path's one-shot). */
let rewardHoldSeeded = false;
/** The REAL benefit glyph we blanked under the proxy — restored on finish/abort. */
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

/** TRUE while the scene owns the foreground (pad inert, surfaces held).
 *  `armed` deliberately does NOT hold — nothing visual happened yet. */
export function colonyBuildHolding(): boolean {
  const p = colonyBuildState.phase;
  return colonyBuildState.active && p !== 'idle' && p !== 'armed' && p !== 'failed';
}

// The drop + the post-commit reward beat hold the presentation; releases the
// instant the phase drops on end/abort (the scene's completion signal).
registerAnimationHoldSupplier('colony-build', colonyBuildHolding);

// ── the lifecycle ───────────────────────────────────────────────────────────

/**
 * ARM (the colonies-screen Build confirm, BEFORE the POST). Nothing visual
 * happens until the server proves the cube landed. Sets `active` synchronously
 * — the input gate closes at once.
 */
export function armColonyBuild(colonyName: string, slotIndex: number, color: Color): void {
  clearTimers();
  claimed = false;
  pendingSpecs = [];
  rewardHoldSeeded = false;
  restoreHeldGlyph();
  colonyBuildState.active = true;
  colonyBuildState.phase = 'armed';
  colonyBuildState.nonce++;
  colonyBuildState.colonyName = colonyName;
  colonyBuildState.slotIndex = slotIndex;
  colonyBuildState.color = color;
  colonyBuildState.isCard = false;
  colonyBuildState.hasGlyph = false;
  colonyBuildState.slotRect = undefined;
  colonyBuildState.glyphRect = undefined;
  colonyBuildState.reducedMotion = consoleReducedMotionActive();
  armSafety = window.setTimeout(() => abortColonyBuild(), ARM_SAFETY_MS);
}

/**
 * DETECT (WaitingFor commit path) — consume the arm exactly once per response.
 * VERIFIES the server actually put the viewer's cube in the armed colony's
 * next slot, then CAPTURES the slot + benefit-glyph geometry while the glyph
 * is still on screen (it vanishes once the slot is occupied). Undefined on
 * desktop / a refused build → the scene unwinds with zero trace.
 */
export function detectColonyBuild(
  prevView: ViewModel,
  newView: ViewModel,
): {colonyName: string} | undefined {
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
  colonyBuildState.isCard = buildBonusIsCard(metadata);
  colonyBuildState.hasGlyph = pendingSpecs.length > 0;
  // Capture the live geometry NOW — the slot still shows the glyph (the commit
  // that replaces it with the cube is gated behind runColonyBuild).
  const rects = measureBuildSlot(colonyBuildState.colonyName, proof.slotIndex);
  colonyBuildState.slotRect = rects?.slot;
  colonyBuildState.glyphRect = rects?.glyph;
  return {colonyName: colonyBuildState.colonyName};
}

/**
 * RUN (WaitingFor await) — the PRE-COMMIT half: the cube proxy descends into
 * the live slot; the benefit glyph is displaced upward (a resource bonus) and
 * hovers, OR a card cover lifts off the cell (board-card-bonus). Resolves once
 * the cube is seated; the caller commits right after, then calls
 * endColonyBuild() on nextTick. NEVER rejects — every failure degrades and the
 * gate can never hang.
 */
export function runColonyBuild(): Promise<void> {
  return new Promise<void>((resolve) => {
    runResolve = resolve;
    sceneSafety = window.setTimeout(() => {
      freeRunGate(); // rAF stall — force the gate open, degrade gracefully
    }, motionMs(CUBE_DROP_MS + CUBE_SETTLE_MS) + 3000);
    void executeDrop().finally(() => freeRunGate());
  });
}

async function executeDrop(): Promise<void> {
  if (!colonyBuildState.active) {
    return;
  }
  colonyBuildState.phase = 'dropping';
  // A CARD build bonus: lift the card cover off the SAME cell (the glyph is a
  // card icon). Armed synchronously here — while the commit is gated the glyph
  // is still on screen, so the board-card-bonus scene captures its rect. The
  // deferred colony reveal is claimed post-commit; the scene is non-gating.
  if (colonyBuildState.isCard) {
    armBoardCardBonus({kind: 'colony-cell', colonyName: colonyBuildState.colonyName, slotIndex: colonyBuildState.slotIndex});
  }
  const slot = colonyBuildState.slotRect;
  if (colonyBuildState.reducedMotion || slot === undefined || typeof document === 'undefined') {
    // Reduced / unmeasurable: the cube appears in place with a short beat —
    // same commit semantics, no proxies. A resource bonus still releases at
    // once in endColonyBuild (its chips fire, marginally late).
    colonyBuildState.phase = 'landed';
    await wait(colonyBuildState.reducedMotion ? REDUCED_MS : 60);
    return;
  }
  await nextTick(); // the layer mounts the proxies
  if (!colonyBuildState.active) {
    return;
  }
  const els = stage?.els();
  const ui = conUiScale();
  if (els === undefined || !placeCubeProxy(els, {slot})) {
    colonyBuildState.phase = 'landed';
    await wait(60);
    return;
  }
  const dropMs = motionMs(CUBE_DROP_MS);
  if (colonyBuildState.hasGlyph && els.glyph !== undefined && colonyBuildState.glyphRect !== undefined) {
    // The glyph is DISPLACED upward as the cube falls — the "bonus is lifted
    // out, the cube takes its place" beat. The proxy stands over the real
    // glyph (blanked this same turn — no double vision); the rise finishes ≈
    // as the cube seats and hovers through the commit.
    holdRealGlyph();
    playGlyphPreLift(els, {
      delayMs: Math.round(dropMs * GLYPH_PRELIFT_START_T),
      riseMs: motionMs(GLYPH_RISE_MS),
      hoverPx: Math.round(GLYPH_HOVER_PX * ui),
    });
  }
  await playCubeDrop(els, {
    slot,
    uiScale: ui,
    dropMs,
    settleMs: motionMs(CUBE_SETTLE_MS),
  });
  if (!colonyBuildState.active) {
    return; // aborted mid-drop — abort already cleaned up
  }
  colonyBuildState.phase = 'landed';
}

/**
 * Seed the PANEL REWARD HOLD for the build's resource bonus — the caller MUST
 * call this in the SAME SYNCHRONOUS BLOCK as `updatePlayerView` (never from
 * inside the flight promise chain: the panel shows `committed − held`, so an
 * early seed lets Vue flush a phantom −N chip). Idempotent; a no-op for a
 * card / cube-only build / reduced motion.
 */
export function seedColonyBuildRewardHold(): void {
  if (!colonyBuildState.active || rewardHoldSeeded || pendingSpecs.length === 0) {
    return;
  }
  if (colonyBuildState.reducedMotion) {
    pendingSpecs = [];
    return;
  }
  rewardHoldSeeded = true;
  beginPanelRewardHold(pendingSpecs);
}

/**
 * END (next tick, after the view committed) — dispose the cube proxy onto the
 * now-painted real filled-cell cube, then (for a resource bonus) the REWARD
 * BEAT: the hovering glyph hands off to physical resource chips that fly onto
 * the panel — each touchdown releases its metric (delta chip at the contact).
 * A card / cube-only build finishes right after the crossfade. A build with a
 * pending SPACE follow-up disposes instantly (the colonies section is about
 * to unmount — no crossfade at a stale rect).
 */
export async function endColonyBuild(newView: PlayerViewModel): Promise<void> {
  if (!colonyBuildState.active) {
    return;
  }
  const boardFollowUp = newView.waitingFor?.type === 'space';
  const specs = pendingSpecs;
  pendingSpecs = [];
  const els = stage?.els();
  const ui = conUiScale();
  // Hand the cube proxy off onto the real cube (identical geometry). Instant
  // when the section is about to unmount (a board follow-up) or reduced.
  if (els !== undefined) {
    await disposeCubeProxy(els, boardFollowUp || colonyBuildState.reducedMotion ? 0 : motionMs(120));
  }
  if (!colonyBuildState.active) {
    return;
  }
  if (specs.length === 0 || colonyBuildState.reducedMotion || boardFollowUp) {
    // Card / cube-only build, reduced, or a board follow-up: no chip wave. A
    // card cover (if any) continues under board-card-bonus's own lifecycle.
    finish();
    return;
  }
  colonyBuildState.phase = 'rewarding';
  const hoverPx = Math.round(GLYPH_HOVER_PX * ui);
  const glyphRect = colonyBuildState.glyphRect;
  const origin: TransferPoint | undefined = glyphRect !== undefined ?
    {x: glyphRect.x + glyphRect.w / 2, y: glyphRect.y + glyphRect.h / 2 - hoverPx} : undefined;
  const slotRect = colonyBuildState.slotRect;
  const source: TransferPoint | undefined = slotRect !== undefined ?
    {x: slotRect.x + slotRect.w / 2, y: slotRect.y + slotRect.h / 2} : undefined;
  // One calm breath: the player reads the bonus hovering over the placed cube,
  // then the wave goes.
  await wait(motionMs(HANDOFF_BREATH_MS));
  if (!colonyBuildState.active) {
    return;
  }
  if (els !== undefined && colonyBuildState.hasGlyph) {
    playGlyphHandoff(els);
  }
  await runResourceTransfers({
    specs,
    origins: origin !== undefined ? specs.map(() => origin) : undefined,
    source: {point: source},
    arrival: 'auto',
    onArrive: (spec) => releasePanelRewardHold(spec),
  });
  clearPanelRewardHold();
  finish();
}

/**
 * ABORT — refused build, network failure, safety timer, unmount. Drops the
 * stage, the pending specs and any seeded hold; recalls a card cover; frees
 * the commit gate; flags `failed` for one flush.
 */
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
  clearPanelRewardHold();
  restoreHeldGlyph();
  if (colonyBuildState.isCard) {
    abortBoardCardBonus('return'); // the card never came — recall the cover
  }
  pendingSpecs = [];
  rewardHoldSeeded = false;
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
  clearPanelRewardHold(); // safety — the reward beat leaves it empty
  restoreHeldGlyph();
  pendingSpecs = [];
  rewardHoldSeeded = false;
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
  clearPanelRewardHold();
  restoreHeldGlyph();
  pendingSpecs = [];
  rewardHoldSeeded = false;
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
  colonyBuildState.isCard = false;
  colonyBuildState.hasGlyph = false;
  colonyBuildState.slotRect = undefined;
  colonyBuildState.glyphRect = undefined;
}

function escapeName(name: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(name) : name.replace(/"/g, '\\"');
}

function rectOf(el: HTMLElement | null): BuildRect | undefined {
  if (el === null) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  return r.width > 3 && r.height > 3 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

/** The live rects of the build slot + its benefit glyph (post fit/zoom). */
function measureBuildSlot(colonyName: string, slotIndex: number): {slot: BuildRect | undefined, glyph: BuildRect | undefined} | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const slotSel = `[data-colony-build-slot="${escapeName(colonyName + '#' + slotIndex)}"]`;
  const slotEl = document.querySelector<HTMLElement>(slotSel);
  if (slotEl === null) {
    return undefined;
  }
  const glyphEl = slotEl.querySelector<HTMLElement>('.benefit-glyph');
  return {slot: rectOf(slotEl), glyph: rectOf(glyphEl) ?? rectOf(slotEl)};
}

/** Blank the REAL benefit glyph the same synchronous turn the proxy stands
 *  over it (the `con-deal-hold` swap discipline) — no double vision. */
function holdRealGlyph(): void {
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
