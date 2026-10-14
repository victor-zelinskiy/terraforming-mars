/*
 * «ОБРАТНЫЙ ХОД» — the director of a PARAMETER SWING's scene (Turmoil Redux
 * TR47 Ecological Experiment; the pure half: `scaleSwingModel.ts`; contract:
 * docs/TURMOIL_REDUX_ECOLOGICAL_EXPERIMENT.md §5).
 *
 * The owner's accent of 2026-10-14: «шкалы должны подняться у всех игроков, а
 * затем те, что не на максимуме, уменьшиться обратно (полученный бонус шкал
 * остаётся) — честно и на глазах у всех». So the scene is ONE story told on the
 * board, in the card's printed order, on the mover's screen and on every
 * other seat's alike (all of them read the SAME server record):
 *
 *   SEED   — the transport's apply block (the SAME synchronous block as the
 *            view apply, own submit and poll alike): a fresh record (consumed
 *            once by `seq`) is planned against the two views; the board and
 *            the status strip are told to keep PRESENTING the scene's start
 *            (`setBoardSwingDisplay` — the park's display merge, under the
 *            park's own held values); the rating the scene itself flies (a
 *            raise that arrived together with its fall — the diff reads zero)
 *            is held on the panel, checked against the views first;
 *   STAGE  — the board the player can see (`boardBeatBoardWatchable`), the
 *            park done with these scales (a raise it held is ITS story), no
 *            board scene still playing (the removed ocean's departure first);
 *   UP     — each raise the scene owns: the value goes to the peak, the marker
 *            glides, and once it has ARRIVED the rating tokens are born on its
 *            rim and fly to the rating cell (the cell ticks per touchdown);
 *   DOWN   — after every raise's story (the scale beat's own tokens included):
 *            the fall in the record's order — the ocean count, then the
 *            temperature, then the oxygen — each leg one beat: its tag «−1 ·
 *            РТ остаётся» at its marker, the value steps down, the marker
 *            glides back, the HUD flips down; a parameter LEFT at its maximum
 *            is named «МАКС» in place and does not move;
 *   READ   — the tags stand for one read, then the display lets go (the live
 *            values are what it presented by then — nothing moves).
 *
 * HOLDS: while the scene PLAYS it is a blocking hold and a board-scene member
 * (the next prompt, a notification, another board story wait for it); while it
 * merely WAITS for its stage it is notification-only (a decision the player
 * owes is never delayed by a beat that waits for the board). Every wait is
 * bounded: the stage is a presentation-ledger debt that degrades honestly (the
 * display lets go, the held rating ticks, nothing flies), and every leg's
 * arrival has its own ceiling. Reduced motion seeds nothing — the values snap.
 */
import {reactive, watch, WatchStopHandle} from 'vue';
import {gsap} from 'gsap';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {scaleMarkerPoses, scaleMarkerRestsOn} from '@/client/components/board/scaleMarkerArrival';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {OwedStoryHandle, owePresentation} from '@/client/console/presentationLedger';
import {captureGlobalParams, HeldGlobalParams} from '@/client/console/planetFocus';
import {
  boardBeatBoardWatchable, boardBeatHoldsParam, boardBeatParkState, setBoardSwingDisplay,
} from '@/client/console/boardBeatPark';
import {registerBoardSceneMember} from '@/client/console/boardSceneMembers';
import {boardSceneSettling} from '@/client/console/rewardPayoutQuiet';
import {scaleStepRatingBusy} from '@/client/console/scaleStepReward/scaleStepRatingBeat';
import {scaleStepTokenOrigins} from '@/client/console/scaleStepReward/scaleStepRewardModel';
import {verifyRailReward} from '@/client/console/resourceTransfer/railReward';
import {
  beginPanelRewardHold, heldStock, releasePanelRewardHold, runResourceTransfers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {RATING_RAIL_KEY, ResourceTransferSpec, TransferPoint, railRowKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  SWING_ARRIVAL_MAX_MS, SWING_HUD_FLIP_MS, SWING_LEG_GAP_MS, SWING_LIMIT_READ_MS, SWING_READ_MS, SWING_STAGE_DUE_MS,
  SwingLeg, SwingPlan, SwingTagKind, freshParameterSwings, swingPlanOf, swingPlanPlays, swingTagOf,
} from '@/client/console/scaleSwing/scaleSwingModel';

/** The scene's own name — its holds, its ledger story. */
export const SCALE_SWING_KEY = 'scale-swing';

export type ScaleSwingPhase = 'idle' | 'waiting' | 'playing';

/** A tag standing at a marker (or at the HUD readout of a rail-less scale): the fall's «−1 · РТ остаётся», a limit's «МАКС». */
export type ScaleSwingTag = {
  id: number;
  accent: SwingLeg['accent'];
  kind: SwingTagKind;
  amount: number;
  /** The scale's own unit (°C · % · none for the ocean count). */
  unit: string;
  x: number;
  y: number;
  /** Where it stands: beside the board's marker, or under the status strip's readout. */
  anchor: 'marker' | 'hud';
};

export const scaleSwingState = reactive({
  phase: 'idle' as ScaleSwingPhase,
  /** The record the scene is telling (0 when idle). */
  seq: 0,
  /** The leg on stage (`up:temperature` · `down:oceans` · `max:oxygen`), '' between legs. */
  leg: '',
  /** Every leg the scene has played for the current record, in order — the probes' witness of the ORDER. */
  played: [] as Array<string>,
  tags: [] as Array<ScaleSwingTag>,
  /** The rating tokens the current record flies (0 when none). */
  tokens: 0,
  /** Past the stage's due — the player never came back to the board: the display let go, nothing flew. */
  due: false,
  /** The last record degraded somewhere (no stage, a promise the views did not keep, no marker to be born on). */
  degraded: false,
  /** Bumped by a redrive (the stage watcher re-asks). */
  nudge: 0,
});

type Entry = {
  plan: SwingPlan;
  /** The rating tokens still held on the panel (one spec per token, released on its touchdown). */
  rating: Array<ResourceTransferSpec>;
  /** The claim map the board presents until the scene's raises have played (the threshold capture plays on the glide). */
  claims?: Record<string, Color>;
};

const queue: Array<Entry> = [];
const claimed = new Set<number>();
/** What the board presents for the queued records (first write wins per key — the scene glides from what was seen). */
let display: Partial<HeldGlobalParams> = {};
let displayClaims: Record<string, Color> | undefined;
let epoch = 0;
let running = false;
let tagSeq = 0;
let debt: OwedStoryHandle | undefined;
let quietResolve: (() => void) | undefined;
let quietPromise: Promise<void> = Promise.resolve();

function publishDisplay(): void {
  setBoardSwingDisplay(Object.keys(display).length > 0 ? display : undefined, displayClaims);
}

function openQuiet(): void {
  if (quietResolve === undefined) {
    quietPromise = new Promise<void>((resolve) => {
      quietResolve = resolve;
    });
  }
}

function resolveQuiet(): void {
  const r = quietResolve;
  quietResolve = undefined;
  r?.();
}

/** The scene is ON STAGE (a blocking hold, a board-scene member). */
export function scaleSwingPlaying(): boolean {
  return scaleSwingState.phase === 'playing';
}

/** The scene is owed or playing. */
export function scaleSwingBusy(): boolean {
  return scaleSwingState.phase !== 'idle';
}

/** Resolves once the scene is quiet (at once when idle). */
export function scaleSwingQuiet(): Promise<void> {
  return scaleSwingState.phase === 'idle' ? Promise.resolve() : quietPromise;
}

registerAnimationHoldSupplier(SCALE_SWING_KEY, scaleSwingPlaying, {
  diagnose: () => ({seq: scaleSwingState.seq, leg: scaleSwingState.leg, played: scaleSwingState.played.join(',')}),
});
// Waiting for the board is NOTIFICATION-ONLY: a workspace whose conclusion waits on blocking holds must never wait
// for a scene that waits for the workspace to leave.
registerAnimationHoldSupplier(`${SCALE_SWING_KEY}-owed`, () => scaleSwingState.phase === 'waiting', {
  scope: 'notification-only',
  diagnose: () => ({seq: scaleSwingState.seq, watchable: boardBeatBoardWatchable(), settling: boardSceneSettling()}),
});
registerBoardSceneMember(scaleSwingPlaying);

/**
 * SEED — the transport's apply block (own submit and poll alike), BEFORE the scale-step rating beat's seed: a
 * rating this scene holds is never held twice. Idempotent over echo frames (a record is claimed once).
 */
export function seedParameterSwings(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  if (after === undefined || before === undefined) {
    return;
  }
  const viewer = after.thisPlayer?.color;
  const sameSeat = before.id === after.id && before.thisPlayer?.color === viewer;
  const fresh = freshParameterSwings(before.game.parameterSwings, after.game.parameterSwings, sameSeat);
  let queued = false;
  for (const record of fresh) {
    if (claimed.has(record.seq)) {
      continue;
    }
    claimed.add(record.seq);
    const plan = swingPlanOf(record, captureGlobalParams(before.game), after.game, viewer);
    if (!swingPlanPlays(plan) || typeof document === 'undefined' || consoleReducedMotionActive()) {
      continue;
    }
    const entry: Entry = {plan, rating: []};
    if (plan.rating > 0) {
      // The raise's rating the scene flies itself (the fall arrived with it, so no diff reads it) — checked against
      // the views with what other owners already hold on that row as the known move.
      const cause: Array<ResourceTransferSpec> = Array.from({length: plan.rating}, () => ({channel: 'stock', resource: RATING_RAIL_KEY, amount: 1}));
      const already = heldStock(RATING_RAIL_KEY);
      const verdict = verifyRailReward({cause, reactions: [], ...(already > 0 ? {known: {[railRowKey(cause[0])]: already}} : {})}, before, after);
      if (verdict.cause.length > 0) {
        beginPanelRewardHold(verdict.cause);
        entry.rating = [...verdict.cause];
      } else {
        scaleSwingState.degraded = true;
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[scale-swing] the raise's rating is not flown — ${verdict.mismatches.join('; ')}`);
        }
      }
    }
    if (plan.legs.some((leg) => leg.kind === 'up') && displayClaims === undefined) {
      entry.claims = {...(before.game.scaleBonusClaims ?? {})};
      displayClaims = entry.claims;
    }
    for (const [key, value] of Object.entries(plan.start) as Array<[keyof HeldGlobalParams, number]>) {
      if (display[key] === undefined) {
        display = {...display, [key]: value};
      }
    }
    queue.push(entry);
    queued = true;
  }
  if (claimed.size > 64) {
    const keep = [...claimed].slice(-32);
    claimed.clear();
    keep.forEach((seq) => claimed.add(seq));
  }
  if (queued) {
    publishDisplay();
    openQuiet();
    if (scaleSwingState.phase === 'idle') {
      scaleSwingState.phase = 'waiting';
    }
    void run();
  }
}

/** The stage stands: the board in view, the park done with these scales, no board scene still telling its part. */
function stageReady(e: Entry): boolean {
  void scaleSwingState.nudge;
  void boardBeatParkState.heldParams;
  if (!boardBeatBoardWatchable() || boardBeatParkState.draining || boardSceneSettling()) {
    return false;
  }
  return !e.plan.legs.some((leg) => boardBeatHoldsParam(leg.key));
}

/** A bounded wait on a reactive predicate — `true` when it held, `false` at the ceiling or an abort. */
function waitUntil(predicate: () => boolean, maxMs: number, myEpoch: number): Promise<boolean> {
  if (predicate()) {
    return Promise.resolve(true);
  }
  return new Promise<boolean>((resolve) => {
    let done = false;
    // Both handles are read only from callbacks that fire after this block (a non-immediate watch, a delayed call).
    const finish = (ok: boolean) => {
      if (!done) {
        done = true;
        stop();
        timer.kill();
        resolve(ok);
      }
    };
    const timer = gsap.delayedCall(Math.max(0.05, maxMs / 1000), () => finish(false));
    const stop: WatchStopHandle = watch(() => (epoch !== myEpoch ? 'abort' : predicate() ? 'yes' : 'no'), (v) => {
      if (v !== 'no') {
        finish(v === 'yes');
      }
    });
  });
}

/** A wait on the GSAP clock — the clock the markers and the tokens animate on. */
function beat(ms: number): Promise<void> {
  return new Promise((resolve) => {
    gsap.delayedCall(Math.max(0, ms) / 1000, () => resolve());
  });
}

function waitForStage(e: Entry, myEpoch: number): Promise<boolean> {
  if (stageReady(e)) {
    return Promise.resolve(true);
  }
  debt?.settle();
  debt = owePresentation({
    id: SCALE_SWING_KEY,
    ready: () => stageReady(e),
    redrive: () => {
      scaleSwingState.nudge++;
    },
    dueMs: SWING_STAGE_DUE_MS,
    degrade: () => {
      scaleSwingState.due = true;
    },
    diagnose: () => ({
      seq: e.plan.seq, watchable: boardBeatBoardWatchable(), draining: boardBeatParkState.draining, settling: boardSceneSettling(),
      held: e.plan.legs.filter((leg) => boardBeatHoldsParam(leg.key)).map((leg) => leg.key),
    }),
  });
  return new Promise<boolean>((resolve) => {
    const stop: WatchStopHandle = watch(
      () => (epoch !== myEpoch ? 'abort' : scaleSwingState.due ? 'due' : stageReady(e) ? 'ready' : 'wait'),
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

function markerOf(accent: SwingLeg['accent']): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`.scale-marker[data-scale-marker="${accent}"]`);
}

/** The status strip's readout of a parameter (the rail-less ocean count's only on-screen home). */
function hudCellOf(accent: SwingLeg['accent']): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const icon = accent === 'oceans' ? 'ocean' : accent;
  return document.querySelector<HTMLElement>(`.con-status__param .wgt-icon--${icon}`)?.closest<HTMLElement>('.con-status__param') ?? null;
}

function visibleBox(el: HTMLElement | null): DOMRect | undefined {
  const box = el?.getBoundingClientRect();
  return box !== undefined && box.width > 1 && box.height > 1 && box.bottom > 0 && box.top < window.innerHeight ? box : undefined;
}

/** Stand a tag where the leg is seen: beside its marker, else under its HUD readout. */
function showTag(leg: SwingLeg): void {
  const tag = swingTagOf(leg);
  if (tag === undefined) {
    return;
  }
  const marker = leg.accent === 'oceans' ? undefined : visibleBox(markerOf(leg.accent));
  const hud = marker === undefined ? visibleBox(hudCellOf(leg.accent)) : undefined;
  const box = marker ?? hud;
  if (box === undefined) {
    scaleSwingState.degraded = true;
    return;
  }
  scaleSwingState.tags = [...scaleSwingState.tags, {
    id: ++tagSeq,
    accent: leg.accent,
    kind: tag.kind,
    amount: tag.amount,
    unit: tag.unit,
    // Beside the marker (its right rim, its centre line); under the readout (its centre, its foot).
    x: marker !== undefined ? box.right + box.width * 0.15 : box.left + box.width / 2,
    y: marker !== undefined ? box.top + box.height / 2 : box.bottom + 4,
    anchor: marker !== undefined ? 'marker' : 'hud',
  }];
}

/** Move the presented value of one parameter (the board and the HUD read it — the marker glides, the HUD flips). */
function present(key: keyof HeldGlobalParams, value: number): void {
  display = {...display, [key]: value};
  publishDisplay();
}

/** The leg's own arrival: the marker resting on the value, or — a rail-less scale — the HUD's flip. */
async function arrival(leg: SwingLeg, value: number, myEpoch: number): Promise<void> {
  if (leg.accent === 'oceans' || markerOf(leg.accent) === null) {
    await beat(motionMs(SWING_HUD_FLIP_MS));
    return;
  }
  const accent = leg.accent;
  const arrived = await waitUntil(() => {
    void scaleMarkerPoses[accent];
    return scaleMarkerRestsOn(accent, value);
  }, motionMs(SWING_ARRIVAL_MAX_MS), myEpoch);
  if (!arrived && epoch === myEpoch) {
    scaleSwingState.degraded = true;
  }
}

/** The raise's rating, one token per step, born on the marker's rim once it has arrived — the cell ticks per touchdown. */
async function flyRating(e: Entry, leg: SwingLeg & {kind: 'up'}): Promise<void> {
  const specs = e.rating.splice(0, Math.min(leg.tr, e.rating.length));
  if (specs.length === 0) {
    return;
  }
  const box = visibleBox(leg.accent === 'oceans' ? hudCellOf(leg.accent) : markerOf(leg.accent));
  if (box === undefined) {
    scaleSwingState.degraded = true;
    specs.forEach((spec) => releasePanelRewardHold(spec));
    return;
  }
  const origins: Array<TransferPoint> = scaleStepTokenOrigins({x: box.left, y: box.top, w: box.width, h: box.height}, specs.length);
  const owed = new Set(specs);
  await runResourceTransfers({
    specs,
    origins,
    source: {},
    arrival: 'auto',
    fromBoard: true,
    onArrive: (spec) => {
      if (owed.delete(spec)) {
        releasePanelRewardHold(spec);
      }
    },
    onDegrade: () => {
      scaleSwingState.degraded = true;
    },
  });
  // Whatever a token's honest fallback did not release — never strand a counter.
  owed.forEach((spec) => releasePanelRewardHold(spec));
}

async function play(e: Entry, myEpoch: number): Promise<void> {
  scaleSwingState.played = [];
  scaleSwingState.tokens = e.rating.length;
  const ups = e.plan.legs.filter((leg): leg is SwingLeg & {kind: 'up'} => leg.kind === 'up');
  const falls = e.plan.legs.filter((leg) => leg.kind !== 'up');
  // UP — every raise the scene owns, the rating born on its marker once it has arrived.
  for (const leg of ups) {
    scaleSwingState.leg = `up:${leg.parameter}`;
    present(leg.key, leg.to);
    await arrival(leg, leg.to, myEpoch);
    if (epoch !== myEpoch) {
      return;
    }
    scaleSwingState.played = [...scaleSwingState.played, `up:${leg.parameter}`];
    if (leg.tr > 0) {
      await flyRating(e, leg);
      if (epoch !== myEpoch) {
        return;
      }
    }
    scaleSwingState.leg = '';
    await beat(motionMs(SWING_LEG_GAP_MS));
  }
  if (e.claims !== undefined && displayClaims === e.claims) {
    displayClaims = undefined;
    publishDisplay();
  }
  // The raise's story told by the ordinary scale beat (an earlier response's tokens, born at the peak) lands first.
  await waitUntil(() => !scaleStepRatingBusy(), motionMs(SWING_ARRIVAL_MAX_MS * 3), myEpoch);
  if (epoch !== myEpoch) {
    return;
  }
  // DOWN — the fall in the record's order: the ocean count, the temperature, the oxygen; a limit named in place.
  for (const leg of falls) {
    scaleSwingState.leg = `${leg.kind}:${leg.parameter}`;
    showTag(leg);
    if (leg.kind === 'down') {
      present(leg.key, leg.to);
      await arrival(leg, leg.to, myEpoch);
    } else {
      await beat(motionMs(SWING_LIMIT_READ_MS));
    }
    if (epoch !== myEpoch) {
      return;
    }
    scaleSwingState.played = [...scaleSwingState.played, `${leg.kind}:${leg.parameter}`];
    scaleSwingState.leg = '';
    await beat(motionMs(SWING_LEG_GAP_MS));
  }
  // READ — the tags stand for one read; then the display lets go (it presents the live values by now).
  await beat(motionMs(SWING_READ_MS));
}

/** Let go of an entry: its display keys (no other queued record still presents them), whatever rating it still holds. */
function release(e: Entry): void {
  e.rating.splice(0).forEach((spec) => releasePanelRewardHold(spec));
  if (displayClaims === e.claims) {
    displayClaims = undefined;
  }
  const stillPresented = new Set(queue.filter((other) => other !== e).flatMap((other) => Object.keys(other.plan.start)));
  const next: Partial<HeldGlobalParams> = {};
  for (const [key, value] of Object.entries(display) as Array<[keyof HeldGlobalParams, number]>) {
    if (stillPresented.has(key)) {
      next[key] = value;
    }
  }
  display = next;
  publishDisplay();
}

async function run(): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  const myEpoch = ++epoch;
  try {
    while (epoch === myEpoch && queue.length > 0) {
      const e = queue[0];
      scaleSwingState.phase = 'waiting';
      scaleSwingState.seq = e.plan.seq;
      scaleSwingState.due = false;
      const ready = await waitForStage(e, myEpoch);
      if (epoch !== myEpoch) {
        return;
      }
      if (ready) {
        scaleSwingState.phase = 'playing';
        await play(e, myEpoch);
        if (epoch !== myEpoch) {
          return;
        }
      } else {
        // Past its due: the player never came back to the board — the display lets go, the rating ticks.
        scaleSwingState.degraded = true;
      }
      queue.shift();
      release(e);
      scaleSwingState.tags = [];
      scaleSwingState.leg = '';
    }
  } finally {
    // An aborted run never touches the flag: the reset already cleared it, and a run seeded since owns it now.
    if (epoch === myEpoch) {
      running = false;
      scaleSwingState.phase = 'idle';
      scaleSwingState.seq = 0;
      scaleSwingState.tokens = 0;
      resolveQuiet();
    }
  }
}

/** Abort / game switch / shell teardown: stop, let go of every display key, release every held rating. Idempotent. */
export function resetScaleSwing(): void {
  epoch++;
  running = false;
  debt?.settle();
  debt = undefined;
  for (const e of queue.splice(0)) {
    e.rating.splice(0).forEach((spec) => releasePanelRewardHold(spec));
  }
  display = {};
  displayClaims = undefined;
  setBoardSwingDisplay(undefined);
  claimed.clear();
  scaleSwingState.phase = 'idle';
  scaleSwingState.seq = 0;
  scaleSwingState.leg = '';
  scaleSwingState.played = [];
  scaleSwingState.tags = [];
  scaleSwingState.tokens = 0;
  scaleSwingState.due = false;
  scaleSwingState.degraded = false;
  resolveQuiet();
}
