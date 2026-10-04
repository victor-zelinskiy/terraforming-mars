/*
 * «ШАГ ШКАЛЫ ПЛАТИТ» — the scene of a card that answers EACH STEP OF A SCALE,
 * whoever made it (Turmoil Redux TR24 Venusian Census, Aphrodite; the pure
 * half and the grammar: `scaleStepRewardModel.ts`;
 * docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md).
 *
 * THE BEATS, record by record in the ring's order:
 *  1. SCALE  — the marker glides to the division the step reached: the board's
 *     own beat, untouched (plain reactivity over a watchable board; the
 *     board-beat park's drain when it was covered). The scene WAITS for it —
 *     the board watchable, the park's value released, and the marker's own
 *     arrival signal (`scaleMarkerArrival.ts`). Never a timer.
 *  2. TOKENS — they CONDENSE on the marker's rim (the ocean coin's birth
 *     anatomy, the data token's or the M€ coin's face — TR21's tokens), one per
 *     unit of a card resource / one coin per step of a stock payment, and hand
 *     off to the shared Resource Transfer Framework, which flies them to where
 *     the owner's resource lives: the viewer's own satellite cell / rail row,
 *     another seat's chip in the status strip.
 *  3. TOUCHDOWN — the viewer's counter ticks on each token's contact (the panel
 *     hold seeded in the apply block is released unit by unit), never before.
 *  4. NEXT — only after the last touchdown: the next record, and — as a MEMBER
 *     of the park's drain (`registerBoardBeatStoryMember`) — whatever the drain
 *     still holds after the scale story (the Venus 8 % card's cover).
 *
 * HOLDS: the panel hold (the owner's own counter) is seeded in the SAME
 * synchronous block as the view apply (`gameTransport.seedRewardHolds`,
 * `App.update`) and released only by the scene — per touchdown, or all at once
 * by an honest degrade. The named hold `scale-step-reward` (reactive, `expire`
 * + `diagnose`) is NOTIFICATION-ONLY: a reaction never delays a decision the
 * player owes (decision №7). A record that cannot reach its stage within
 * `SCALE_STEP_STAGE_DUE_MS` (the player never comes back to the board) is a
 * ledger debt that degrades: the counter ticks, nothing flies. Nothing to
 * measure (no marker on screen) → `degraded` (the layer's
 * `data-scale-reward-degraded`), the holds are released at once. Reduced
 * motion: nothing flies, the counter ticks as the marker settles.
 */
import {nextTick, reactive, watch, WatchStopHandle} from 'vue';
import {gsap} from 'gsap';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ScaleStepRewardModel} from '@/common/models/ScaleStepRewardModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {scaleMarkerArrived, scaleMarkerPoses} from '@/client/components/board/scaleMarkerArrival';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {OwedStoryHandle, owePresentation} from '@/client/console/presentationLedger';
import {
  boardBeatBoardWatchable, boardBeatHoldsParam, boardBeatParkState, registerBoardBeatStoryMember,
} from '@/client/console/boardBeatPark';
import {beginPanelRewardHold, releasePanelRewardHold, runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  ResourceTransferSpec, TOUCHDOWN_TICK_GAP_MS, TransferPoint, touchdownTickAt, transferWaveDelayMs,
} from '@/client/console/resourceTransfer/resourceTransferModel';
import {OCEAN_COIN_FORM_MS, OCEAN_COIN_LEAD_MS, OCEAN_COIN_SPARKS, oceanWaveLeadMs} from '@/client/console/tilePlacement/tilePlacementModel';
import {killOceanTweens, playOceanCoinHandoff, playOceanCoinMaterialize} from '@/client/console/tilePlacement/tilePlacementDirector';
import {remoteOriginPoint} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {
  SCALE_STEP_BREATH_MS, SCALE_STEP_STAGE_DUE_MS, freshScaleStepRewards, scaleAccentOf, scaleParamKeyOf,
  scaleStepHoldSpec, scaleStepTokenOrigins, scaleStepTokenSpecs,
} from '@/client/console/scaleStepReward/scaleStepRewardModel';

export type ScaleStepPhase = 'idle' | 'waiting' | 'paying';

/** One token condensing on the marker's rim before its flight (the layer draws it). */
export type ScaleStepCoin = {id: number, at: TransferPoint, kind: 'data' | 'megacredits', amount: number};

/** One claimed record: whose it is to the viewer, and whether the viewer's counter is held for it. */
export type ScaleStepEntry = {
  record: ScaleStepRewardModel,
  own: boolean,
  /** The panel hold still owed (whole gain at seed, released unit by unit). */
  held: number,
};

export const scaleStepRewardState = reactive({
  phase: 'idle' as ScaleStepPhase,
  queue: [] as Array<ScaleStepEntry>,
  /** The record being played (a probe reads which). */
  seq: undefined as number | undefined,
  /** Tokens of the current record that have TOUCHED their destination. */
  landed: 0,
  tokens: 0,
  /** Nothing measurable: the counters ticked, nothing flew (a probe's witness — a reduced run is not a degrade). */
  degraded: false,
  /** The tokens condensing on the marker right now. */
  coins: [] as Array<ScaleStepCoin>,
  /** Bumped by the ledger's redrive — a missed reactive edge re-asks the stage. */
  nudge: 0,
  /** The head record waited past its due (the player never came back to the board). */
  due: false,
});

/** The scene is ON STAGE (tokens in the air). */
export function scaleStepRewardPaying(): boolean {
  return scaleStepRewardState.phase === 'paying';
}

/** Anything owed at all — the park's member predicate. */
export function scaleStepRewardBusy(): boolean {
  return scaleStepRewardState.queue.length > 0 || scaleStepRewardState.phase !== 'idle';
}

let epoch = 0;
let running = false;
let quietWaiters: Array<() => void> = [];
let debt: OwedStoryHandle | undefined;
/** Records this client has played (or is playing) — each is played ONCE. */
const claimed = new Set<number>();

/** Resolves when nothing is owed any more (the park's drain waits on it). */
export function scaleStepRewardsQuiet(): Promise<void> {
  if (!scaleStepRewardBusy()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => quietWaiters.push(resolve));
}

function resolveQuiet(): void {
  const waiters = quietWaiters;
  quietWaiters = [];
  for (const w of waiters) {
    w();
  }
}

registerAnimationHoldSupplier('scale-step-reward', scaleStepRewardPaying, {
  // A reaction never delays a decision the player owes: the FEED waits, the prompts do not (decision №7).
  scope: 'notification-only',
  diagnose: () => ({
    phase: scaleStepRewardState.phase, seq: scaleStepRewardState.seq, queue: scaleStepRewardState.queue.length,
    landed: scaleStepRewardState.landed, tokens: scaleStepRewardState.tokens,
  }),
  expire: () => abortScaleStepRewards(),
});

/**
 * The scene is OWED on a board the player SEES — it waits only for the marker's glide (≤ 1.3 s): the FEED waits
 * for it too, or the notification «вы получили +2 data» reads the consequence before its tokens have left the
 * marker. Never while the board is covered: the park can outlive any reasonable silence, and the feed keeps
 * flowing inside a workspace (the TR21 pending-hold precedent, narrowed to the watchable board).
 */
export function scaleStepRewardPending(): boolean {
  const head = scaleStepRewardState.queue[0];
  if (scaleStepRewardState.phase !== 'waiting' || head === undefined) {
    return false;
  }
  const key = scaleParamKeyOf(head.record.parameter);
  return boardBeatBoardWatchable() && (key === undefined || !boardBeatHoldsParam(key));
}

registerAnimationHoldSupplier('scale-step-reward-pending', scaleStepRewardPending, {
  scope: 'notification-only',
  expire: () => abortScaleStepRewards(),
});

// The park's drain tells the scale story, then what it PAID, then whatever it still holds (the Venus 8 % card).
registerBoardBeatStoryMember('scale-step-reward', {busy: scaleStepRewardBusy, quiet: scaleStepRewardsQuiet});

// ── the stage (the layer plugs in) ─────────────────────────────────────────

let stage: {coins: () => ReadonlyArray<HTMLElement>} | undefined;

export function registerScaleStepRewardStage(handle: {coins: () => ReadonlyArray<HTMLElement>}): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
}

// ── the claim (the apply block) ────────────────────────────────────────────

/**
 * SEED — in the SAME synchronous block as the view apply: every record NEW in
 * this response is claimed once, the viewer's own gain is held on its counter
 * (the displayed value stays the pre-payout one until each token lands), and
 * the scene is queued. Idempotent over echo frames (the claim is by `seq`).
 */
export function seedScaleStepRewardHolds(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  if (after === undefined) {
    return;
  }
  const viewer: Color | undefined = after.thisPlayer?.color;
  const sameSeat = before !== undefined && before.thisPlayer?.color === viewer;
  const fresh = freshScaleStepRewards(before?.game.scaleStepRewards, after.game.scaleStepRewards, sameSeat);
  let queued = false;
  for (const record of fresh) {
    if (claimed.has(record.seq) || scaleAccentOf(record.parameter) === undefined) {
      continue;
    }
    claimed.add(record.seq);
    const own = record.owner === viewer;
    const held = own && typeof document !== 'undefined' ? record.gain.amount : 0;
    if (held > 0) {
      beginPanelRewardHold([scaleStepHoldSpec(record)]);
    }
    scaleStepRewardState.queue.push({record, own, held});
    queued = true;
  }
  if (claimed.size > 64) {
    const keep = [...claimed].slice(-32);
    claimed.clear();
    keep.forEach((s) => claimed.add(s));
  }
  if (queued) {
    void run();
  }
}

// ── the stage ──────────────────────────────────────────────────────────────

function markerOf(record: ScaleStepRewardModel): HTMLElement | null {
  const accent = scaleAccentOf(record.parameter);
  return accent === undefined || typeof document === 'undefined' ? null :
    document.querySelector<HTMLElement>(`.scale-marker[data-scale-marker="${accent}"]`);
}

/** The record's stage stands: the player sees the board, the park let the value go, and the marker has ARRIVED. */
function stageReady(entry: ScaleStepEntry): boolean {
  const accent = scaleAccentOf(entry.record.parameter);
  const key = scaleParamKeyOf(entry.record.parameter);
  if (accent === undefined || key === undefined) {
    return true;
  }
  // Read the reactive sources this verdict depends on, so the watcher re-asks on each.
  void scaleMarkerPoses[accent];
  void boardBeatParkState.heldParams;
  if (!boardBeatBoardWatchable() || boardBeatHoldsParam(key)) {
    return false;
  }
  // No cursor at all (a board without this dial): nothing will ever arrive — the play degrades honestly.
  return scaleMarkerArrived(accent, entry.record.after) || markerOf(entry.record) === null;
}

/** Wait for the head record's stage — resolves `true` on the stage, `false` past its due or on an abort. */
function waitForStage(entry: ScaleStepEntry, myEpoch: number): Promise<boolean> {
  scaleStepRewardState.due = false;
  if (stageReady(entry)) {
    return Promise.resolve(true);
  }
  debt?.settle();
  debt = owePresentation({
    id: 'scale-step-reward',
    ready: () => stageReady(entry),
    redrive: () => {
      scaleStepRewardState.nudge++;
    },
    dueMs: SCALE_STEP_STAGE_DUE_MS,
    degrade: () => {
      scaleStepRewardState.due = true;
    },
    diagnose: () => ({
      seq: entry.record.seq, watchable: boardBeatBoardWatchable(),
      parked: boardBeatHoldsParam(scaleParamKeyOf(entry.record.parameter) ?? 'venusScaleLevel'),
      marker: scaleMarkerPoses[scaleAccentOf(entry.record.parameter) ?? 'venus'],
    }),
  });
  return new Promise<boolean>((resolve) => {
    // A non-immediate watcher: its callback runs only after `stop` is bound.
    const stop: WatchStopHandle = watch(
      () => {
        void scaleStepRewardState.nudge;
        if (epoch !== myEpoch) {
          return 'abort';
        }
        if (scaleStepRewardState.due) {
          return 'due';
        }
        return stageReady(entry) ? 'ready' : 'wait';
      },
      (verdict) => {
        if (verdict !== 'wait') {
          stop();
          debt?.settle();
          debt = undefined;
          resolve(verdict === 'ready');
        }
      });
  });
}

/** A wait on the GSAP clock — the clock the tokens animate on (never the wall clock between two beats). */
function gsapWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    gsap.delayedCall(ms / 1000, () => resolve());
  });
}

/** Release whatever the viewer's counter still holds for this record (a degrade, an abort). */
function releaseRemaining(entry: ScaleStepEntry): void {
  if (entry.held > 0) {
    releasePanelRewardHold({...scaleStepHoldSpec(entry.record), amount: entry.held});
    entry.held = 0;
  }
}

function degrade(entry: ScaleStepEntry): void {
  releaseRemaining(entry);
  scaleStepRewardState.degraded = true;
}

/** Play one record: born at the marker's rim, landing where its owner's resource lives, ticking on each touchdown. */
async function pay(entry: ScaleStepEntry, myEpoch: number): Promise<void> {
  const record = entry.record;
  const specs = scaleStepTokenSpecs(record);
  scaleStepRewardState.phase = 'paying';
  scaleStepRewardState.seq = record.seq;
  scaleStepRewardState.landed = 0;
  scaleStepRewardState.tokens = specs.length;
  const reduced = consoleReducedMotionActive();
  if (!reduced) {
    // The marker's settle accent is the step's own last word — the first token leaves on its breath.
    await gsapWait(motionMs(SCALE_STEP_BREATH_MS));
    if (epoch !== myEpoch) {
      return;
    }
  }
  const marker = markerOf(record);
  const box = marker?.getBoundingClientRect();
  if (marker === null || box === undefined || box.width < 2 || box.height < 2 || box.bottom < 0 || box.top > window.innerHeight) {
    if (reduced) {
      // Reduced motion flies nothing anyway — the counter ticks now, honestly, not as a degrade.
      releaseRemaining(entry);
      scaleStepRewardState.landed = specs.length;
      return;
    }
    degrade(entry);
    return;
  }
  const rect = {x: box.left, y: box.top, w: box.width, h: box.height};
  const ui = conUiScale();
  const origins = scaleStepTokenOrigins(rect, specs.length);
  const destination = entry.own ? undefined : remoteOriginPoint(record.owner, ui);
  if (!reduced) {
    // THE BIRTH: each token condenses on the marker's rim, then hands off to its flight (the framework's own chip
    // takes over on the same point — one cadence, the framework's wave stagger). Waited on the GSAP clock the
    // coins form on (a wall-clock wait drifts ahead of it on a starved renderer).
    scaleStepRewardState.coins = specs.map((spec, i) => ({
      id: i, at: origins[i], kind: spec.channel === 'card-resource' ? 'data' : 'megacredits', amount: spec.amount,
    }));
    await nextTick();
    const coins = stage?.coins() ?? [];
    if (epoch !== myEpoch) {
      return;
    }
    if (coins.length === specs.length) {
      const delays = specs.map((_, i) => Math.round(motionMs(transferWaveDelayMs(i, specs.length))));
      playOceanCoinMaterialize(coins, {
        delays, leadMs: motionMs(OCEAN_COIN_LEAD_MS), formMs: motionMs(OCEAN_COIN_FORM_MS), sparks: OCEAN_COIN_SPARKS,
      });
      await gsapWait(motionMs(oceanWaveLeadMs()));
      if (epoch !== myEpoch) {
        return;
      }
      playOceanCoinHandoff(coins, {delays, uiScale: ui});
    }
  }
  // THE TICK CADENCE: two touchdowns in one frame never read as one jump (the shared touchdown rule).
  const tickGap = motionMs(TOUCHDOWN_TICK_GAP_MS);
  let lastTick = -Infinity;
  let ticks: Promise<unknown> = Promise.resolve();
  const tickAt = (apply: () => void) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    lastTick = reduced ? now : touchdownTickAt(now, lastTick, tickGap);
    if (lastTick <= now) {
      apply();
    } else {
      // A TASK per tick (never the animation clock): GSAP's ticker runs every callback due in one frame inside ONE
      // task, and two releases in one task are one render — «4 → 6» on a starved 4K renderer (measured).
      ticks = Promise.all([ticks, new Promise<void>((resolve) => setTimeout(() => {
        apply();
        resolve();
      }, lastTick - now))]);
    }
  };
  await runResourceTransfers({
    specs,
    origins,
    source: {point: {x: rect.x + rect.w / 2, y: rect.y + rect.h / 2}},
    arrival: 'auto',
    // Born on the board: under a workspace opened mid-flight the wave recedes with it.
    fromBoard: true,
    ...(destination !== undefined ? {destination} : {}),
    onArrive: (spec: ResourceTransferSpec) => tickAt(() => {
      if (epoch !== myEpoch) {
        return;
      }
      scaleStepRewardState.landed = Math.min(scaleStepRewardState.tokens, scaleStepRewardState.landed + 1);
      if (entry.held > 0) {
        const amount = Math.min(entry.held, spec.amount);
        releasePanelRewardHold({...spec, amount});
        entry.held -= amount;
      }
    }),
  });
  await ticks;
  scaleStepRewardState.coins = [];
  // Whatever a token's honest fallback did not release (never strand a counter).
  releaseRemaining(entry);
}

async function run(): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  const myEpoch = epoch;
  scaleStepRewardState.degraded = false;
  try {
    while (epoch === myEpoch && scaleStepRewardState.queue.length > 0) {
      const entry = scaleStepRewardState.queue[0];
      scaleStepRewardState.phase = 'waiting';
      const ready = await waitForStage(entry, myEpoch);
      if (epoch !== myEpoch) {
        return;
      }
      if (!ready) {
        // Past its due: the player never came back to the board — the counter ticks, nothing flies.
        scaleStepRewardState.queue.shift();
        releaseRemaining(entry);
        continue;
      }
      await pay(entry, myEpoch);
      if (epoch !== myEpoch) {
        return;
      }
      scaleStepRewardState.queue.shift();
    }
  } finally {
    running = false;
    if (epoch === myEpoch) {
      scaleStepRewardState.phase = 'idle';
      scaleStepRewardState.seq = undefined;
      resolveQuiet();
    } else if (scaleStepRewardState.queue.length > 0) {
      // Aborted while records were claimed after the abort: they play now.
      void run();
    }
  }
}

/**
 * Abort / game switch: stop, release every hold still owed (a hold never
 * strands a counter), forget the queue. Idempotent. The claims are kept — an
 * aborted record is never replayed.
 */
export function abortScaleStepRewards(): void {
  epoch++;
  // The waiting run re-asks its watcher (the epoch is not reactive) and leaves.
  scaleStepRewardState.nudge++;
  killOceanTweens(stage?.coins() ?? []);
  scaleStepRewardState.coins = [];
  debt?.settle();
  debt = undefined;
  for (const entry of scaleStepRewardState.queue) {
    releaseRemaining(entry);
  }
  scaleStepRewardState.queue = [];
  scaleStepRewardState.phase = 'idle';
  scaleStepRewardState.seq = undefined;
  scaleStepRewardState.landed = 0;
  scaleStepRewardState.tokens = 0;
  scaleStepRewardState.due = false;
  resolveQuiet();
}

/** Full reset (a game switch, the shell's unmount, specs): abort and forget every claim. */
export function resetScaleStepRewards(): void {
  abortScaleStepRewards();
  scaleStepRewardState.degraded = false;
  claimed.clear();
}
