/*
 * CONSOLE PLAYED-CARD HERO — the animation TRANSACTION behind the signature
 * "the card physically lands on my tableau" scene (console-native only).
 *
 * The gate follows the established trade-fleet / hydro-marker contract, byte
 * for byte in spirit:
 *
 *   ConsoleShell ARMS the transaction at submit time (armPlayedHero — BEFORE
 *   the batch POST; nothing visual happens yet), WaitingFor DETECTS it once
 *   per response (detectPlayedHero — consumes the arm, and VERIFIES the
 *   server actually put the card into the tableau: no server success → no
 *   scene, ever), HOLDS the commit through the pre-commit half of the scene
 *   (await runPlayedHero — lift → overlay swap → hero arc → landing), then
 *   COMMITS the authoritative view (delta-chips fire HERE, strictly after
 *   touchdown — the chip gate IS the commit hold, the project idiom), and
 *   finally endPlayedHero() plays the post-commit half (frame-perfect proxy →
 *   real-slot swap, the result beat, the auto-close). abortPlayedHero() is
 *   wired into every error path and a safety timer — the gate can never hang
 *   and a failed play never leaves a ghost card or a stuck lock.
 *
 * Ownership map:
 *   - phases / geometry / speed profile → playedHeroModel (pure, tested);
 *   - GSAP work on the proxy            → playedHeroDirector;
 *   - the fixed proxy stage             → ConsolePlayedHeroLayer.vue;
 *   - the reserved slot + reveal        → ConsolePlayedOverlay (hero props);
 *   - composer close / table open      → ConsoleShell watchers on `phase`.
 */

import {reactive, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {taskFor} from '@/client/console/consoleTaskRouter';
import {
  HeroRect, PlayedHeroPhase, planHeroPath,
  HERO_LIFT_MS, HERO_FLIGHT_MS, HERO_LAND_MS, HERO_CLOSE_MS,
  HERO_RESULT_PAUSE_MS, HERO_REDUCED_MS, HERO_REDUCED_PAUSE_MS, HERO_SAFETY_TIMEOUT_MS,
} from '@/client/console/played/playedHeroModel';
import {
  placeHeroProxy, playHeroLift, playHeroFlight, playHeroReducedHop, disposeHeroProxy, killHeroTweens, HeroStageEls,
} from '@/client/console/played/playedHeroDirector';
import {
  runResourceTransfers, abortResourceTransfers, beginPanelRewardHold, releasePanelRewardHold, clearPanelRewardHold,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  ResourceTransferSpec, TRANSFER_READ_MS, TRANSFER_RESIDUAL_PAUSE_MS,
} from '@/client/console/resourceTransfer/resourceTransferModel';

/** The result beat is SHORT when the server already queued the next decision
 *  — the demonstration yields to the game (spec §13). */
const HERO_RESULT_PAUSE_FOLLOWUP_MS = 220;
/** How long we wait for the table overlay to mount + register its measurer. */
const TARGET_WAIT_BUDGET_MS = 1600;

export type PlayedHeroProxy = {
  card: CardName,
  isEvent: boolean,
  rect: HeroRect,
};

export const playedHeroState = reactive({
  /** TRUE from arm until finish/abort — the transaction lock. */
  active: false,
  phase: 'idle' as PlayedHeroPhase,
  nonce: 0,
  card: undefined as CardName | undefined,
  isEvent: false,
  /** The overlay's reserved slot turns visible ONLY here (post-landing). */
  revealed: false,
  /** The SYSTEM-opened table overlay is mounted (play-animation mode). */
  tableOpen: false,
  /** FALSE ⇔ the player had «Разыграно» open manually — never auto-close it. */
  autoClose: true,
  /** The flying proxy geometry (undefined → no-flight fallback path). */
  proxy: undefined as PlayedHeroProxy | undefined,
});

/** One-shot claim per response (mirrors tradeFleet's `claimed`). */
let claimed = false;
let armSafety: number | undefined;
let sceneSafety: number | undefined;
/** Resolves the WaitingFor commit gate (abort must always free it). */
let runResolve: (() => void) | undefined;
/** Resolves the skippable result beat. */
let pauseResolve: (() => void) | undefined;
/** The server queued a follow-up decision → the result beat shortens. */
let followUpPending = false;
/** The composer card we visually blanked under the proxy (restored on abort). */
let heldSourceEl: HTMLElement | undefined;
/**
 * The play's IMMEDIATE resource gains (composer-extracted from the server
 * preview) — the REWARD BEAT of the scene: once the card has landed and been
 * read, these emerge from it as physical chips and land on the exact left-
 * panel zones; each touchdown releases its metric from the panel reward hold
 * (seeded just before the commit), firing that delta chip at the contact.
 */
let pendingRewards: ReadonlyArray<ResourceTransferSpec> = [];
/** The hold was seeded for THIS transaction (the commit path's one-shot). */
let rewardHoldSeeded = false;

// ── stage / target registries (layer + overlay plug in) ────────────────────

type HeroStageHandle = {els: () => HeroStageEls | undefined};
let stage: HeroStageHandle | undefined;

export function registerPlayedHeroStage(handle: HeroStageHandle): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
}

type HeroTargetMeasure = () => Promise<HeroRect | undefined>;
let targetMeasure: HeroTargetMeasure | undefined;

/** The «Разыграно» overlay registers its reserved-slot measurer here. */
export function providePlayedHeroTarget(fn: HeroTargetMeasure): () => void {
  targetMeasure = fn;
  return () => {
    if (targetMeasure === fn) {
      targetMeasure = undefined;
    }
  };
}

// ── predicates ──────────────────────────────────────────────────────────────

export function isPlayedHeroActive(): boolean {
  return playedHeroState.active;
}

/** TRUE while the scene owns the foreground (surfaces / prompts stay held).
 *  `armed` deliberately does NOT hold — nothing visual happened yet. */
export function playedHeroHolding(): boolean {
  const p = playedHeroState.phase;
  return playedHeroState.active && p !== 'idle' && p !== 'armed' && p !== 'failed';
}

// ── the lifecycle ───────────────────────────────────────────────────────────

/**
 * Arm BEFORE the submit (the confirm handler of the composer OR a start-scene
 * press). Nothing visual happens until the server proves the play landed in
 * the tableau. `sourceSelector` overrides WHERE the card physically lifts
 * from (default: the play composer's card slot).
 */
export function armPlayedHero(card: CardName, isEvent: boolean, opts: {manualTableOpen: boolean, sourceSelector?: string, rewards?: ReadonlyArray<ResourceTransferSpec>}): void {
  clearTimers();
  claimed = false;
  followUpPending = false;
  pendingRewards = opts.rewards ?? [];
  rewardHoldSeeded = false;
  sourceSelector = opts.sourceSelector ?? COMPOSER_SOURCE_SELECTOR;
  playedHeroState.active = true;
  playedHeroState.phase = 'armed';
  playedHeroState.nonce++;
  playedHeroState.card = card;
  playedHeroState.isEvent = isEvent;
  playedHeroState.revealed = false;
  playedHeroState.tableOpen = false;
  playedHeroState.autoClose = !opts.manualTableOpen;
  playedHeroState.proxy = undefined;
  // A response that never detects (error path missed, network limbo) can
  // never wedge the game — the arm self-aborts.
  armSafety = window.setTimeout(() => abortPlayedHero(), HERO_SAFETY_TIMEOUT_MS);
}

/**
 * Consume the arm exactly once per response (WaitingFor). Returns undefined
 * — and fully aborts — unless the SERVER put the armed card into the
 * viewer's tableau (the authoritative success proof).
 */
export function detectPlayedHero(view: PlayerViewModel): {card: CardName} | undefined {
  if (!playedHeroState.active || claimed || playedHeroState.card === undefined) {
    return undefined;
  }
  claimed = true;
  if (armSafety !== undefined) {
    window.clearTimeout(armSafety);
    armSafety = undefined;
  }
  const card = playedHeroState.card;
  const landed = view.thisPlayer?.tableau?.some((c) => c.name === card) === true;
  if (!landed) {
    abortPlayedHero();
    return undefined;
  }
  const task = taskFor(view);
  followUpPending = task !== undefined && task.kind !== 'actionMenu';
  return {card};
}

/**
 * The PRE-COMMIT half of the scene: lift off the composer, swap the scene
 * around the card (composer closes / table opens with the +1 layout), the
 * hero arc, the landing. Resolves at touchdown — the caller then commits the
 * view (delta-chips fire) and calls endPlayedHero() on nextTick.
 * NEVER rejects; every failure degrades to the no-flight fallback and the
 * promise still resolves (the commit gate can never hang).
 */
export function runPlayedHero(view: PlayerViewModel): Promise<void> {
  void view;
  return new Promise<void>((resolve) => {
    runResolve = resolve;
    sceneSafety = window.setTimeout(() => {
      // rAF stall / lost element — force the gate open, degrade gracefully.
      freeRunGate();
    }, motionMs(HERO_LIFT_MS + HERO_FLIGHT_MS + HERO_LAND_MS) + 3000);
    void executeFlight().finally(() => freeRunGate());
  });
}

/**
 * Seed the PANEL REWARD HOLD — the caller MUST call this in the SAME
 * SYNCHRONOUS BLOCK as `updatePlayerView` (WaitingFor's commit path), never
 * from inside the flight's promise chain.
 *
 * Why the same block: the panel renders `committed − held`. Seeding one
 * micro-task earlier lets Vue flush a frame where the value is still the
 * PRE-commit number while the hold is already subtracted — i.e. the panel
 * dips by exactly the reward (0 → −1 production) and AnimatedMetricValue
 * honestly fires a phantom −N chip, then the commit brings it back to 0 and
 * the touchdown fires +N. Seeding and committing in one block means Vue sees
 * ONE transition (pre-reward → pre-reward: no chip at all), and the only
 * real transition is the release at the chip's touchdown → +N.
 *
 * Idempotent + a no-op when the card grants nothing immediately, under
 * reduced motion, or after an abort (the chips then simply fire with the
 * commit — the honest default).
 */
export function seedPlayedHeroRewardHold(): void {
  if (!playedHeroState.active || rewardHoldSeeded || pendingRewards.length === 0) {
    return;
  }
  if (consoleReducedMotionActive()) {
    pendingRewards = [];
    return;
  }
  rewardHoldSeeded = true;
  beginPanelRewardHold(pendingRewards);
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

async function executeFlight(): Promise<void> {
  const card = playedHeroState.card;
  if (!playedHeroState.active || card === undefined) {
    return;
  }
  playedHeroState.phase = 'preparing';
  // The table opens NOW (play-animation mode) so its +1 layout settles while
  // the card lifts; a manually-open table just gains the reserved slot.
  if (playedHeroState.autoClose) {
    playedHeroState.tableOpen = true;
  }
  const reduced = consoleReducedMotionActive();
  const sourceRect = captureSourceRect();

  if (sourceRect !== undefined) {
    playedHeroState.proxy = {card, isEvent: playedHeroState.isEvent, rect: sourceRect};
    await nextTick();
  }
  const els = playedHeroState.proxy !== undefined ? stage?.els() : undefined;
  if (els !== undefined && playedHeroState.proxy !== undefined) {
    // Position the proxy pixel-perfect over the source, THEN blank the
    // source under it — same synchronous turn, no double vision, no flash.
    if (placeHeroProxy(els, playedHeroState.proxy.rect)) {
      holdSource();
    } else {
      playedHeroState.proxy = undefined;
    }
  } else {
    playedHeroState.proxy = undefined;
  }

  // The composer closes UNDER the (already independent) card; the shell
  // watcher on this phase tears pendingPlayCard down.
  playedHeroState.phase = 'lifting';

  // Lift and target preparation run in PARALLEL — the scene forms around
  // the moving card, never as sequential steps. Reduced motion skips the
  // lift beat (its hop below is the whole controlled transition). With no
  // proxy there is no flight — never stall waiting for a target it can't use.
  const hasProxy = playedHeroState.proxy !== undefined && els !== undefined;
  const targetPromise = hasProxy ? awaitTargetRect() : Promise.resolve(undefined);
  if (hasProxy && els !== undefined && !reduced) {
    await playHeroLift(els, motionMs(HERO_LIFT_MS));
  }
  const target = await targetPromise;

  if (!playedHeroState.active) {
    return; // aborted mid-scene — abort already cleaned up
  }
  if (playedHeroState.proxy === undefined || els === undefined) {
    // No-flight fallback (lost source element): the table is open, the
    // landing semantics stay — a short controlled beat, then commit.
    playedHeroState.phase = 'landing';
    await wait(reduced ? HERO_REDUCED_MS : 60);
    return;
  }
  if (target === undefined) {
    // Target never became measurable — dissolve the proxy in place and let
    // the reveal happen without a flight (never an approximate landing).
    playedHeroState.phase = 'landing';
    await disposeHeroProxy(els, motionMs(140));
    playedHeroState.proxy = undefined;
    return;
  }

  playedHeroState.phase = 'flying';
  const liveSource = currentProxyRect(els) ?? playedHeroState.proxy.rect;
  const plan = planHeroPath({
    source: liveSource,
    target,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    safeTop: 54 * conUiScale(),
  });
  if (reduced) {
    await playHeroReducedHop(els, target, HERO_REDUCED_MS);
  } else {
    await playHeroFlight(els, plan, {
      isEvent: playedHeroState.isEvent,
      durationMs: motionMs(HERO_FLIGHT_MS + HERO_LAND_MS),
      uiScale: conUiScale(),
    });
  }
  playedHeroState.phase = 'landing';
}

/**
 * The POST-COMMIT half (called on nextTick after updatePlayerView): the
 * reserved slot turns real under the proxy (identical pixels), the proxy
 * dissolves, the result beat plays (delta-chips are already ticking on the
 * committed panel), then the system-opened table closes itself.
 */
export async function endPlayedHero(): Promise<void> {
  if (!playedHeroState.active) {
    return;
  }
  playedHeroState.phase = 'committing';
  playedHeroState.revealed = true;
  await nextTick(); // the real card paints UNDER the proxy — same geometry
  const els = stage?.els();
  if (els !== undefined && playedHeroState.proxy !== undefined) {
    await disposeHeroProxy(els, motionMs(90));
  }
  playedHeroState.proxy = undefined;
  if (!playedHeroState.active) {
    return;
  }
  playedHeroState.phase = 'showing-result';
  if (pendingRewards.length > 0 && !consoleReducedMotionActive()) {
    // THE REWARD BEAT — the final chord of the play: the landed card is read
    // for a quiet moment, then its immediate gains emerge from it as
    // physical resource chips and land on the exact left-panel zones. Each
    // touchdown releases its metric from the panel reward hold, firing that
    // delta chip at the contact — the card is the visible source of the
    // reward until the last transfer completes.
    const rewards = pendingRewards;
    pendingRewards = [];
    await wait(motionMs(TRANSFER_READ_MS));
    if (!playedHeroState.active) {
      return;
    }
    const esc = escapeName(playedHeroState.card ?? '');
    await runResourceTransfers({
      specs: rewards,
      source: {selectors: [
        `.con-played [data-played-key="${esc}"] .con-played__face`,
        `.con-played [data-played-key="${esc}"]`,
        // An EVENT lands face-down on the events backstack — its rewards
        // emerge from the pile (the card's honest on-table location).
        '.con-played .con-played__family--event .con-played__backstack',
      ]},
      arrival: 'auto',
      onArrive: (spec) => releasePanelRewardHold(spec),
    });
    // Belt-and-braces: any hold a degraded transfer left behind snaps to the
    // committed truth now (its chip fires marginally late, never lost).
    clearPanelRewardHold();
    if (!playedHeroState.active) {
      return;
    }
    await skippablePause(motionMs(TRANSFER_RESIDUAL_PAUSE_MS));
  } else {
    const pauseMs = consoleReducedMotionActive() ? HERO_REDUCED_PAUSE_MS :
      (followUpPending ? HERO_RESULT_PAUSE_FOLLOWUP_MS : HERO_RESULT_PAUSE_MS);
    await skippablePause(motionMs(pauseMs));
  }
  if (!playedHeroState.active) {
    return;
  }
  playedHeroState.phase = 'closing';
  if (playedHeroState.autoClose && playedHeroState.tableOpen) {
    playedHeroState.tableOpen = false;
    await wait(motionMs(HERO_CLOSE_MS));
  }
  finish();
}

/** A / B during the result beat: accelerate the close — never a cancel. */
export function skipPlayedHeroResult(): void {
  pauseResolve?.();
}

/**
 * Abort — server error, network failure, safety timer, unmount. Restores
 * the blanked composer card, drops the proxy, frees the commit gate, and
 * flags `failed` for one flush (the shell re-arms the composer CTA on it).
 */
export function abortPlayedHero(): void {
  if (!playedHeroState.active && runResolve === undefined) {
    return;
  }
  clearTimers();
  const els = stage?.els();
  if (els !== undefined) {
    killHeroTweens(els);
  }
  restoreSource();
  // The reward beat unwinds with the scene: mid-flight chips unmount with
  // zero trace and the panel snaps to the committed truth (any released
  // hold fires its chips in one honest transition — never a stale hold).
  abortResourceTransfers();
  clearPanelRewardHold();
  pendingRewards = [];
  rewardHoldSeeded = false;
  playedHeroState.proxy = undefined;
  playedHeroState.revealed = false;
  playedHeroState.tableOpen = false;
  playedHeroState.active = false;
  playedHeroState.phase = 'failed';
  pauseResolve?.();
  freeRunGate();
  // One flush later the transaction is fully idle (watchers saw 'failed').
  void nextTick(() => {
    if (playedHeroState.phase === 'failed') {
      playedHeroState.phase = 'idle';
      playedHeroState.card = undefined;
    }
  });
}

function finish(): void {
  clearTimers();
  restoreSource();
  clearPanelRewardHold(); // safety — the reward beat leaves it empty
  pendingRewards = [];
  rewardHoldSeeded = false;
  playedHeroState.active = false;
  playedHeroState.phase = 'idle';
  playedHeroState.card = undefined;
  playedHeroState.isEvent = false;
  playedHeroState.revealed = false;
  playedHeroState.tableOpen = false;
  playedHeroState.proxy = undefined;
}

// ── internals ───────────────────────────────────────────────────────────────

const COMPOSER_SOURCE_SELECTOR = '.con-composer--play [data-zoom-handoff="play-card"] :is(.card-container, .pcard)';
/** WHERE the current transaction's card lifts from (set at arm). */
let sourceSelector: string = COMPOSER_SOURCE_SELECTOR;
/** The shared "slot is empty" cascade rule (cardExitDirector.HOLD_CLASS). */
const HOLD_CLASS = 'con-deal-hold';

function captureSourceRect(): HeroRect | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const el = document.querySelector<HTMLElement>(sourceSelector);
  if (el === null) {
    return undefined;
  }
  const r = el.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) {
    return undefined;
  }
  heldSourceEl = el;
  return {x: r.left, y: r.top, w: r.width, h: r.height};
}

function holdSource(): void {
  heldSourceEl?.classList.add(HOLD_CLASS);
}

function restoreSource(): void {
  heldSourceEl?.classList.remove(HOLD_CLASS);
  heldSourceEl = undefined;
}

function currentProxyRect(els: HeroStageEls): HeroRect | undefined {
  const r = els.proxy.getBoundingClientRect();
  return r.width > 2 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

function escapeName(name: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(name) : name.replace(/"/g, '\\"');
}

async function awaitTargetRect(): Promise<HeroRect | undefined> {
  const deadline = Date.now() + TARGET_WAIT_BUDGET_MS;
  while (playedHeroState.active && targetMeasure === undefined && Date.now() < deadline) {
    await frame();
  }
  const measure = targetMeasure;
  if (!playedHeroState.active || measure === undefined) {
    return undefined;
  }
  try {
    return await measure();
  } catch {
    return undefined;
  }
}

function frame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 16);
    }
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function skippablePause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      if (pauseResolve === done) {
        pauseResolve = undefined;
      }
      resolve();
    };
    const timer = window.setTimeout(done, ms);
    pauseResolve = done;
  });
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
