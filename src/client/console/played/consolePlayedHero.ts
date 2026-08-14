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
 *
 * TWO SCENERIES, one transaction (`host`, decided at arm):
 *   - 'overlay'   — the standalone table opens over the board (a play with
 *     no workspace behind it: the playFromHand band, the start scene, or a
 *     manually-open table);
 *   - 'workspace' — the CARD PLAY WORKSPACE final stage: the hand workspace
 *     never closes, its right zone becomes the EMBEDDED «Разыграно»
 *     (ConsolePlayedLandingStage inside the composer), the card is laid onto
 *     its real pile INSIDE the same frame, and the workspace folds to the
 *     board only after the result beat. The external overlay never opens.
 */

import {reactive, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
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
import {
  abortPlayedCardReturns, capturePlayedCardReturnSource, hasPendingPlayedReturns, runPlayedCardReturns,
} from '@/client/console/played/playedCardReturn';
import {splitPlayRewards, cardTargetGroups} from '@/client/console/played/receivingStageModel';

/** The result beat is SHORT when the server already queued the next decision
 *  — the demonstration yields to the game (spec §13). */
const HERO_RESULT_PAUSE_FOLLOWUP_MS = 220;
/** The RESOLVED-TABLEAU beat of the workspace stage: everything has arrived,
 *  the table stands still, the eye reads the finished state — short. */
const HERO_RESOLVED_BEAT_MS = 260;
/** How long we wait for the table overlay to mount + register its measurer. */
const TARGET_WAIT_BUDGET_MS = 1600;

export type PlayedHeroProxy = {
  card: CardName,
  isEvent: boolean,
  rect: HeroRect,
};

/**
 * WHERE the scene presents its tableau:
 *  - 'overlay'   — the classic path: the system opens the standalone
 *    «Разыграно» table over the board (or lands into a manually-open one);
 *  - 'workspace' — the CARD PLAY WORKSPACE path: the hand workspace stays
 *    open, its right context becomes the EMBEDDED «Разыграно» stage, and the
 *    card is laid onto its pile INSIDE the same frame. No external overlay
 *    ever opens; the workspace folds only after the whole episode settles.
 */
export type PlayedHeroHost = 'overlay' | 'workspace';

export const playedHeroState = reactive({
  /** TRUE from arm until finish/abort — the transaction lock. */
  active: false,
  phase: 'idle' as PlayedHeroPhase,
  nonce: 0,
  card: undefined as CardName | undefined,
  isEvent: false,
  /** The scenery of this transaction (decided at arm — see PlayedHeroHost). */
  host: 'overlay' as PlayedHeroHost,
  /** The overlay's reserved slot turns visible ONLY here (post-landing). */
  revealed: false,
  /** The SYSTEM-opened table overlay is mounted (play-animation mode).
   *  NEVER true for the 'workspace' host — that is the whole point of it. */
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

/**
 * THE EFFECT DELIVERY HOOKS — the workspace RECEIVING STAGE plugs its
 * physical target choreography in here. For every card the play sends a
 * resource to, the transaction asks the scene to EMERGE the target (the card
 * comes forward out of its strip / its compact mini family — resolved
 * instantly when the card is already open), flies the chips between the two
 * physical anchors, then asks the scene to SETTLE it back. Absent hooks (the
 * overlay host, a degraded scene) fall back to the classic single wave.
 */
export type ReceivingEffectHooks = {
  emergeTarget: (card: CardName) => Promise<void>,
  settleTarget: (card: CardName) => Promise<void>,
};
let effectHooks: ReceivingEffectHooks | undefined;

export function provideReceivingEffectHooks(hooks: ReceivingEffectHooks): () => void {
  effectHooks = hooks;
  return () => {
    if (effectHooks === hooks) {
      effectHooks = undefined;
    }
  };
}

/**
 * The card-resource TARGETS of the armed play, excluding the played card
 * itself — the receiving stage prepares their emergence anchors (and any
 * foreign owner's mini) at prewarm, so a delivery never mounts UI mid-beat.
 */
export function playedHeroCardTargets(): ReadonlyArray<CardName> {
  if (!playedHeroState.active) {
    return [];
  }
  const {cardSpecs} = splitPlayRewards(pendingRewards);
  const out: Array<CardName> = [];
  for (const spec of cardSpecs) {
    if (spec.targetCard !== undefined && spec.targetCard !== playedHeroState.card && !out.includes(spec.targetCard)) {
      out.push(spec.targetCard);
    }
  }
  return out;
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

/**
 * The WORKSPACE LANDING STAGE is presenting: the play composer's right zone
 * shows the embedded «Разыграно» tableau and the card is (about to be /
 * being / just) laid onto its pile. Exactly the holding window, gated on the
 * 'workspace' host — the composer renders its landing layer off this.
 */
export function playedHeroLandingUp(): boolean {
  return playedHeroState.host === 'workspace' && playedHeroHolding();
}

/**
 * The PREWARM window of the workspace landing: the submit is in flight
 * ('armed'), nothing visual has happened, but the embedded tableau should
 * already be MOUNTED (hidden) so the commit's unfold reveals settled
 * geometry — layout done, peek faces painted, arts decoding. After A nothing
 * heavy may happen for the first time.
 */
export function playedHeroLandingPrewarm(): boolean {
  return playedHeroState.host === 'workspace' && playedHeroState.active &&
    playedHeroState.phase === 'armed';
}

/**
 * The incoming card the tableau reserves a slot for — undefined outside the
 * visual window (armed/idle/failed). Shared by BOTH hosts (the shell's
 * standalone overlay and the workspace landing stage) so the two can never
 * disagree about when the reserved slot exists.
 */
export function playedHeroIncomingCard(): {name: CardName} | undefined {
  if (!playedHeroState.active || playedHeroState.card === undefined) {
    return undefined;
  }
  const p = playedHeroState.phase;
  if (p === 'armed' || p === 'idle' || p === 'failed') {
    return undefined;
  }
  return {name: playedHeroState.card};
}

// The whole scene — incl. the POST-COMMIT reveal / reward beat — holds the
// presentation: notifications queue, mandatory surfaces wait. Releases the
// instant `finish`/`abort` drops the phase (the GSAP completion signal).
registerAnimationHoldSupplier('played-hero', playedHeroHolding);

// ── the lifecycle ───────────────────────────────────────────────────────────

/**
 * Arm BEFORE the submit (the confirm handler of the composer OR a start-scene
 * press). Nothing visual happens until the server proves the play landed in
 * the tableau. `sourceSelector` overrides WHERE the card physically lifts
 * from (default: the play composer's card slot).
 */
export function armPlayedHero(card: CardName, isEvent: boolean, opts: {manualTableOpen: boolean, sourceSelector?: string, targetSelector?: string, rewards?: ReadonlyArray<ResourceTransferSpec>, host?: PlayedHeroHost}): void {
  clearTimers();
  claimed = false;
  followUpPending = false;
  pendingRewards = opts.rewards ?? [];
  rewardHoldSeeded = false;
  sourceSelector = opts.sourceSelector ?? COMPOSER_SOURCE_SELECTOR;
  targetSelectorOverride = opts.targetSelector;
  playedHeroState.active = true;
  playedHeroState.phase = 'armed';
  playedHeroState.nonce++;
  playedHeroState.card = card;
  playedHeroState.isEvent = isEvent;
  playedHeroState.host = opts.host ?? 'overlay';
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
    void executeFlight().finally(() => {
      // PRE-COMMIT, table on screen: measure where the cards this play sends
      // back to hand are lying. The commit removes them from the tableau one
      // frame later — a player whose last events these were loses the pile
      // element entirely, and with it any chance of an honest departure.
      capturePlayedCardReturnSource();
      freeRunGate();
    });
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
  /**
   * THIS EPISODE, and nothing else.
   *
   * `active` alone is not a lifetime: `abortPlayedHero()` lowers it, but the
   * NEXT `armPlayedHero()` raises it again — so a continuation still suspended
   * on one of the awaits below wakes up inside a DIFFERENT play and happily
   * drives it (publishing `lifting`, blanking a source that is not its own).
   * The abort resolves the commit gate immediately, which is exactly why this
   * function routinely outlives the transaction that started it.
   *
   * `nonce` is bumped by every arm, so comparing it makes every await point
   * safe BY CONSTRUCTION rather than by remembering to add a check — which is
   * how the source-rect poll below came to be the one that was forgotten.
   */
  const episode = playedHeroState.nonce;
  const mine = () => playedHeroState.active && playedHeroState.nonce === episode;
  playedHeroState.phase = 'preparing';
  // The table opens NOW (play-animation mode) so its +1 layout settles while
  // the card lifts; a manually-open table just gains the reserved slot. The
  // WORKSPACE host never opens the standalone overlay — its tableau is the
  // EMBEDDED stage the play composer reveals off this same phase, and the
  // landing target registers from there.
  if (playedHeroState.autoClose && playedHeroState.host === 'overlay') {
    playedHeroState.tableOpen = true;
  }
  const reduced = consoleReducedMotionActive();
  let sourceRect = captureSourceRect();
  // The source can be TRANSIENTLY unmeasurable: a fullscreen viewer's
  // close-flight still holds the slot empty (`con-zoom-hold`), a layout is a
  // frame from settling. A single-shot miss here used to degrade the whole
  // play to the no-flight fallback — the card TELEPORTED onto the tableau.
  // Poll briefly (≈430ms — covers the zoom return) before giving up; the
  // proxy then lifts from the settled slot, exactly where the card stands.
  if (sourceRect === undefined) {
    for (let i = 0; i < 26 && sourceRect === undefined && mine(); i++) {
      await frame();
      sourceRect = captureSourceRect();
    }
  }
  // ⚠️ THE POLL IS AN AWAIT POINT, so it needs the guard the scene's other await
  // points have (see the one before the flight below). An abort — an error path,
  // the 12 s safety, a play the server refused — can land INSIDE this loop, and
  // everything below then ran anyway: it published `phase = 'lifting'` ON TOP of
  // the abort's `failed`/`idle`, and the shell watches that phase to tear
  // `pendingPlayCard` down. So an aborted play went on driving the transaction it
  // had just cancelled.
  if (!mine()) {
    return; // aborted mid-scene — abort already cleaned up
  }

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

  if (!mine()) {
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
    // physical resource chips and land where they belong. Each touchdown
    // releases its metric from the panel reward hold, firing that delta chip
    // at the contact — the card is the visible source of the reward until
    // the last transfer completes.
    const rewards = pendingRewards;
    pendingRewards = [];
    await wait(motionMs(TRANSFER_READ_MS));
    if (!playedHeroState.active) {
      return;
    }
    const source = {selectors: heroRewardSourceSelectors(playedHeroState.card ?? '')};
    const release = (spec: ResourceTransferSpec) => releasePanelRewardHold(spec);
    const hooks = effectHooks;
    if (playedHeroState.host === 'workspace' && hooks !== undefined) {
      // THE EFFECT RESOLUTION SEQUENCE (the receiving stage): card targets
      // first — each target physically EMERGES from its strip / its compact
      // mini family, the chips fly between the two card anchors, the target
      // SETTLES back with its gain; the rail wave then closes the beat. The
      // newly played card needs no emergence — it IS the front.
      const {railSpecs, cardSpecs} = splitPlayRewards(rewards);
      for (const group of cardTargetGroups(cardSpecs, playedHeroState.card as CardName)) {
        if (!playedHeroState.active) {
          return;
        }
        if (!group.self) {
          await hooks.emergeTarget(group.target);
        }
        await runResourceTransfers({specs: group.specs, source, arrival: 'auto', onArrive: release});
        if (!playedHeroState.active) {
          return;
        }
        if (!group.self) {
          await hooks.settleTarget(group.target);
        }
      }
      if (railSpecs.length > 0 && playedHeroState.active) {
        await runResourceTransfers({specs: railSpecs, source, arrival: 'auto', onArrive: release});
      }
    } else {
      await runResourceTransfers({specs: rewards, source, arrival: 'auto', onArrive: release});
    }
    // Belt-and-braces: any hold a degraded transfer left behind snaps to the
    // committed truth now (its chip fires marginally late, never lost).
    clearPanelRewardHold();
    if (!playedHeroState.active) {
      return;
    }
    await skippablePause(motionMs(TRANSFER_RESIDUAL_PAUSE_MS));
  } else {
    // The RESOLVED-TABLEAU beat: the workspace stage reads shorter than the
    // standalone overlay's result pause — the player is already inside the
    // scene, the state is on screen, a long hold would be a stall.
    const idlePause = playedHeroState.host === 'workspace' ? HERO_RESOLVED_BEAT_MS : HERO_RESULT_PAUSE_MS;
    const pauseMs = consoleReducedMotionActive() ? HERO_REDUCED_PAUSE_MS :
      (followUpPending ? HERO_RESULT_PAUSE_FOLLOWUP_MS : idlePause);
    await skippablePause(motionMs(pauseMs));
  }
  if (!playedHeroState.active) {
    return;
  }
  if (hasPendingPlayedReturns()) {
    // THE RETURN BEAT — the play's closing movement (Astra Mechanica): the
    // cards it sent back to hand rise out of the pile they were lying in,
    // turn face to the camera, and the standard intake carries them into the
    // dock. It runs INSIDE the still-open table (one continuous scene) and
    // the transaction finishes only after they have landed.
    playedHeroState.phase = 'returning';
    await runPlayedCardReturns();
    if (!playedHeroState.active) {
      return;
    }
  }
  playedHeroState.phase = 'closing';
  if (playedHeroState.autoClose && playedHeroState.tableOpen) {
    playedHeroState.tableOpen = false;
    await wait(motionMs(HERO_CLOSE_MS));
  } else if (playedHeroState.host === 'workspace') {
    // The WORKSPACE folds on this phase (the shell watcher tears the whole
    // hand workspace down to the board) — hold the transaction through its
    // dissolve so follow-up surfaces arrive onto a settled board, mirroring
    // the overlay's own close beat.
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
  // The return beat unwinds with the scene too — and its dock withhold is
  // released, so cards the server DID move into the hand can never be lost
  // behind a failed animation.
  abortPlayedCardReturns();
  clearPanelRewardHold();
  pendingRewards = [];
  rewardHoldSeeded = false;
  targetSelectorOverride = undefined;
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
      playedHeroState.host = 'overlay';
    }
  });
}

function finish(): void {
  clearTimers();
  restoreSource();
  // Safety — a beat that never ran (a path that skipped the return) must not
  // leave its dock withhold behind; a completed one already cleared itself.
  abortPlayedCardReturns();
  clearPanelRewardHold(); // safety — the reward beat leaves it empty
  pendingRewards = [];
  rewardHoldSeeded = false;
  targetSelectorOverride = undefined;
  playedHeroState.active = false;
  playedHeroState.phase = 'idle';
  playedHeroState.card = undefined;
  playedHeroState.isEvent = false;
  playedHeroState.host = 'overlay';
  playedHeroState.revealed = false;
  playedHeroState.tableOpen = false;
  playedHeroState.proxy = undefined;
}

// ── internals ───────────────────────────────────────────────────────────────

const COMPOSER_SOURCE_SELECTOR = '.con-composer--play [data-zoom-handoff="play-card"] :is(.card-container, .pcard)';
/** WHERE the current transaction's card lifts from (set at arm). */
let sourceSelector: string = COMPOSER_SOURCE_SELECTOR;
/** An arm-scoped LANDING override (undefined → the registered tableau
 *  anchor). The start scene points a draw-effect play at its source column. */
let targetSelectorOverride: string | undefined;
/** The shared "slot is empty" cascade rule (cardExitDirector.HOLD_CLASS). */
const HOLD_CLASS = 'con-deal-hold';

function captureSourceRect(): HeroRect | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  // The first MEASURABLE match wins — never just the first match: a parked
  // (display:none) layer can legitimately hold the same card identity (the
  // Game Start Workspace parks its summary under the deployment), and its
  // zero-rect element shadowing the live slot silently degraded the whole
  // play to the no-flight fallback — the card TELEPORTED onto the tableau.
  const els = document.querySelectorAll<HTMLElement>(sourceSelector);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width >= 10 && r.height >= 10) {
      heldSourceEl = el;
      return {x: r.left, y: r.top, w: r.width, h: r.height};
    }
  }
  return undefined;
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

/** WHERE a play's reward chips are born, in resolution order: the receiving
 *  stage's front card / events pile (the workspace scene), else the landed
 *  card on the «Разыграно» table (the overlay scene). */
function heroRewardSourceSelectors(card: string): Array<string> {
  const esc = escapeName(card);
  return [
    // The start scene's EFFECT-SOURCE column — a draw-effect play lands (and
    // resolves its rewards) THERE, while its tableau face is still away.
    '[data-embed-source-slot]',
    // The receiving stage (the hand workspace's landing).
    '.con-recv [data-recv-front] .con-recv__face',
    '.con-recv [data-recv-front]',
    '.con-recv .con-recv__backpile',
    // The GAME START workspace's bottom «Разыграно» zone — a start play
    // docks directly into its family pile there.
    `.con-start__played [data-played-key="${esc}"] .con-played__face`,
    `.con-start__played [data-played-key="${esc}"]`,
    `.con-played [data-played-key="${esc}"] .con-played__face`,
    `.con-played [data-played-key="${esc}"]`,
    // An EVENT lands face-down on the events backstack — its rewards
    // emerge from the pile (the card's honest on-table location).
    '.con-played .con-played__family--event .con-played__backstack',
  ];
}

async function awaitTargetRect(): Promise<HeroRect | undefined> {
  const deadline = Date.now() + TARGET_WAIT_BUDGET_MS;
  // An ARM-SCOPED target override (the start scene's effect-source column):
  // this transaction's card deliberately lands at an INTERMEDIATE position —
  // the source seat of the effect it is about to run — instead of the
  // registered tableau anchor. Poll until it is measurable (it mounts in the
  // same press that armed us), first measurable match wins.
  const override = targetSelectorOverride;
  if (override !== undefined) {
    while (playedHeroState.active && Date.now() < deadline) {
      for (const el of document.querySelectorAll<HTMLElement>(override)) {
        const r = el.getBoundingClientRect();
        if (r.width >= 10 && r.height >= 10) {
          return {x: r.left, y: r.top, w: r.width, h: r.height};
        }
      }
      await frame();
    }
    return undefined;
  }
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
