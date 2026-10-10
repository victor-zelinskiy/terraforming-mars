/*
 * «ШАГ ШКАЛЫ ПЛАТИТ РЕЙТИНГ» — the TERRAFORM RATING a global-parameter step
 * the viewer made pays, told on the board the step moved (Turmoil Redux TR41
 * Plasma Fans — the first card ACTION of the fork whose reward is a scale
 * step through a workspace; the same beat serves a card PLAY's scale step and
 * a standard project's).
 *
 * THE GAP IT CLOSES. A scale step's rating is the SCALE's own (`Game.
 * increaseVenusScaleLevel` → `increaseTerraformRating(steps, {global: true})`),
 * never a chip of the card's branch — so neither rail half (`directTrSpecs`
 * refuses a TR beside a scale gain: «the TR is the scale's») held it, and the
 * rating cell TICKED IN THE FRAME THE VIEW APPLIED: under the open workspace,
 * with nothing on screen to explain it (measured on TR41: the cell read 21 at
 * 165 ms, the workspace still standing, the marker still on 6 %). The ruling
 * Greens' «2 M€ per TR step» then rode the action rail's reactions and ticked
 * on the touchdown of the PRICE — the answer to a cause that had not been
 * shown (PL-002).
 *
 * THE BEATS, in the park's causal order (`boardBeatPark.ts`): the workspace
 * leaves → settle → the held value releases and the marker GLIDES → (this
 * member) the marker's settle breath, then ONE RATING TOKEN PER STEP is born
 * on the marker's rim and flies to the rail's rating cell — the cell ticks on
 * each touchdown; a Venus 16 % track bonus is its own token, born on the 16 %
 * chip it came from → the table's answer (the Greens' M€) ticks one beat
 * after the last touchdown, never before → the step's other payees (TR24's
 * tokens — `scaleStepRewardBeat.ts` waits for this member) → the cover.
 *
 * HOLDS — the census scene's own shape (`scaleStepRewardBeat.ts`), deliberately
 * NOT a `railReward` entry: that module's registry raises a BLOCKING hold for
 * as long as an entry stands, and this beat stands for as long as the board
 * is COVERED — a workspace whose conclusion waits on blocking holds (the
 * colony trade's) would wait for a beat that waits for the workspace. So the
 * PROMISE is checked by the rail module's pure half (`verifyRailReward` — the
 * viewer's rating rose by exactly the steps the scales made (+ the 16 %
 * bonus), in the action phase, the same seat; the answer is the M€ delta only
 * when it is exactly 2 M€ per rating; a row that moved otherwise is not held
 * and names itself), the counters are held on the PANEL (`beginPanelRewardHold`
 * — the rail paints `committed − held`), the named hold `scale-step-rating`
 * is NOTIFICATION-ONLY, and the stage is a ledger debt that degrades (the
 * player never came back to the board → the cell ticks, nothing flies). A
 * rating another owner already holds (the tile placement's, a direct TR's) is
 * never held twice (`heldStock`). Reduced motion holds nothing.
 */
import {reactive, watch, WatchStopHandle} from 'vue';
import {gsap} from 'gsap';
import {Phase} from '@/common/Phase';
import {GameModel} from '@/common/models/GameModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {ScaleMarkerAccent, scaleMarkerArrived, scaleMarkerPoses} from '@/client/components/board/scaleMarkerArrival';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {OwedStoryHandle, owePresentation} from '@/client/console/presentationLedger';
import {HeldGlobalParams} from '@/client/console/planetFocus';
import {
  boardBeatBoardWatchable, boardBeatHoldsParam, boardBeatParkState, registerBoardBeatStoryMember,
} from '@/client/console/boardBeatPark';
import {verifyRailReward} from '@/client/console/resourceTransfer/railReward';
import {
  beginPanelRewardHold, heldStock, releasePanelRewardHold, runResourceTransfers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  RATING_RAIL_KEY, ResourceTransferSpec, TOUCHDOWN_TICK_GAP_MS, TransferPoint,
} from '@/client/console/resourceTransfer/resourceTransferModel';
import {SCALE_STEP_BREATH_MS, SCALE_STEP_STAGE_DUE_MS, scaleStepTokenOrigins} from '@/client/console/scaleStepReward/scaleStepRewardModel';

/** The beat's own name — its notification-only hold, its ledger story, its park membership. */
export const SCALE_STEP_RATING_KEY = 'scale-step-rating';
/** The Venus level whose crossing pays the track's one-time TR (`constants.VENUS_LEVEL_FOR_TR_BONUS`). */
const VENUS_TR_BONUS_LEVEL = 16;
/** The 16 % chip's own key on the board (`scaleBonusZones.ts` — the token of the track bonus is born on it). */
const VENUS_TR_BONUS_CHIP = 'v-tr-16';
/** The ruling Greens' answer per rating step (`PartyEffects.GREENS_MEGACREDITS_PER_TR`) — the only answer this beat recognizes. */
const GREENS_MEGACREDITS_PER_TR = 2;

/** The scales this beat tells: a rail-less ocean is the tile's own beat. */
export type ScaleStepRatingAccent = Exclude<ScaleMarkerAccent, 'oceans'>;

/** One scale the response moved, with the steps it made and where it rests now. */
export type ScaleStepMove = {
  accent: ScaleStepRatingAccent;
  key: keyof HeldGlobalParams;
  steps: number;
  after: number;
};

/** What the response PAID the viewer for the steps it made — the beat's promise, read off the diff (pure). */
export type ScaleStepRatingPlan = {
  moves: ReadonlyArray<ScaleStepMove>;
  /** The rating steps paid: the scales' steps, plus the Venus 16 % track bonus when it was crossed. */
  rating: number;
  /** The Venus 16 % crossing paid one of them. */
  venusBonus: boolean;
  /** The ruling Greens' answer (2 M€ per rating step) — only when the M€ moved by exactly that. */
  reaction?: number;
};

const SCALES: ReadonlyArray<{accent: ScaleStepRatingAccent, key: keyof HeldGlobalParams, field: keyof GameModel, unit: number}> = [
  {accent: 'temperature', key: 'temperature', field: 'temperature', unit: 2},
  {accent: 'oxygen', key: 'oxygenLevel', field: 'oxygenLevel', unit: 1},
  {accent: 'venus', key: 'venusScaleLevel', field: 'venusScaleLevel', unit: 2},
];

/**
 * THE PROMISE OFF THE DIFF (pure): the viewer's own rating rose, in the action
 * phase, by exactly the steps the temperature / oxygen / Venus scales made in
 * the same response (+ the Venus 16 % bonus) — else nothing (an ocean's TR is
 * the tile's; a direct TR beside a scale step is nobody's to fly; a rival's
 * step never moves the viewer's rating; the World Government pays no rating).
 */
export function scaleStepRatingPlan(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): ScaleStepRatingPlan | undefined {
  if (before === undefined || after === undefined || before.id !== after.id || after.game.phase !== Phase.ACTION) {
    return undefined;
  }
  const was = before.thisPlayer;
  const now = after.thisPlayer;
  if (was === undefined || now === undefined) {
    return undefined;
  }
  const rating = now.terraformRating - was.terraformRating;
  if (rating <= 0) {
    return undefined;
  }
  const moves: Array<ScaleStepMove> = [];
  for (const scale of SCALES) {
    const a = before.game[scale.field];
    const b = after.game[scale.field];
    if (typeof a !== 'number' || typeof b !== 'number' || b <= a) {
      continue;
    }
    moves.push({accent: scale.accent, key: scale.key, steps: (b - a) / scale.unit, after: b});
  }
  const steps = moves.reduce((sum, move) => sum + move.steps, 0);
  if (steps <= 0 || moves.some((move) => !Number.isInteger(move.steps))) {
    return undefined;
  }
  const venusBefore = before.game.venusScaleLevel;
  const venusAfter = after.game.venusScaleLevel;
  const venusBonus = typeof venusBefore === 'number' && typeof venusAfter === 'number' &&
    venusBefore < VENUS_TR_BONUS_LEVEL && venusAfter >= VENUS_TR_BONUS_LEVEL;
  if (rating !== steps + (venusBonus ? 1 : 0)) {
    return undefined;
  }
  const megacredits = now.megacredits - was.megacredits;
  return {
    moves,
    rating,
    venusBonus,
    ...(megacredits === GREENS_MEGACREDITS_PER_TR * rating ? {reaction: megacredits} : {}),
  };
}

/** Where each token is BORN: on the marker of the scale that paid it — the 16 % bonus on its own chip. */
type TokenOrigin = {accent: ScaleStepRatingAccent, bonus: boolean};

export type ScaleStepRatingPhase = 'idle' | 'waiting' | 'flying';

export const scaleStepRatingState = reactive({
  phase: 'idle' as ScaleStepRatingPhase,
  /** The tokens of the beat in flight / still owed (0 when idle). */
  tokens: 0,
  /** Past its due — the player never came back to the board: the cell ticked, nothing flew. */
  due: false,
  /** The last beat degraded: no marker to be born on, or a promise the views did not keep. */
  degraded: false,
  /** Bumped by a redrive (the stage watcher re-asks). */
  nudge: 0,
});

type Entry = {
  plan: ScaleStepRatingPlan;
  origins: Array<TokenOrigin>;
  /** The rating tokens still held on the panel (one spec per token, released on its touchdown). */
  cause: Array<ResourceTransferSpec>;
  /** The table's answer still held (released one beat after the last touchdown). */
  reactions: Array<ResourceTransferSpec>;
};

let entry: Entry | undefined;
let epoch = 0;
let running = false;
let debt: OwedStoryHandle | undefined;
let quietResolve: (() => void) | undefined;
let quietPromise: Promise<void> = Promise.resolve();

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

/** The beat is OWED or PLAYING — the step's other payees and the park's cover wait for it. */
export function scaleStepRatingBusy(): boolean {
  void scaleStepRatingState.phase;
  return scaleStepRatingState.phase !== 'idle';
}

/** Resolves once the beat is quiet (at once when idle). */
export function scaleStepRatingQuiet(): Promise<void> {
  return scaleStepRatingState.phase === 'idle' ? Promise.resolve() : quietPromise;
}

// A MEMBER of the park's drain: the cover lifts only once the rating has landed.
registerBoardBeatStoryMember(SCALE_STEP_RATING_KEY, {busy: scaleStepRatingBusy, quiet: scaleStepRatingQuiet});

// NOTIFICATION-ONLY (a reaction never delays a decision the player owes, and a blocking hold here would wait on the
// very workspace that waits on it): the feed waits for the rating's story, nothing else does.
registerAnimationHoldSupplier(SCALE_STEP_RATING_KEY, scaleStepRatingBusy, {
  scope: 'notification-only',
  diagnose: () => ({phase: scaleStepRatingState.phase, tokens: scaleStepRatingState.tokens, due: scaleStepRatingState.due}),
});

/** The tokens' birth order: the steps of each scale, in the scales' order, then the Venus 16 % bonus. */
function originsOf(plan: ScaleStepRatingPlan): Array<TokenOrigin> {
  const out: Array<TokenOrigin> = [];
  for (const move of plan.moves) {
    for (let i = 0; i < move.steps; i++) {
      out.push({accent: move.accent, bonus: false});
    }
  }
  if (plan.venusBonus) {
    out.push({accent: 'venus', bonus: true});
  }
  return out;
}

/** Release whatever the panel still holds for the entry — idempotent. */
function releaseHeld(e: Entry): void {
  for (const spec of e.cause.splice(0)) {
    releasePanelRewardHold(spec);
  }
  for (const spec of e.reactions.splice(0)) {
    releasePanelRewardHold(spec);
  }
}

/**
 * SEED — the transport's apply block (the SAME synchronous block as the view
 * apply), AFTER every owner that may hold the rating for a cause of its own:
 * a rating already held is never held twice.
 */
export function seedScaleStepRatingHold(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  const plan = scaleStepRatingPlan(before, after);
  if (plan === undefined || typeof document === 'undefined' || consoleReducedMotionActive() || heldStock(RATING_RAIL_KEY) > 0) {
    return;
  }
  const origins = originsOf(plan);
  const cause: Array<ResourceTransferSpec> = origins.map(() => ({channel: 'stock', resource: RATING_RAIL_KEY, amount: 1}));
  const reactions: Array<ResourceTransferSpec> = plan.reaction === undefined ? [] :
    [{channel: 'stock', resource: 'megacredits', amount: plan.reaction}];
  const verdict = verifyRailReward({cause, reactions}, before, after);
  if (verdict.mismatches.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(`[scale-step-rating] not shown as promised — ${verdict.mismatches.join('; ')}`);
  }
  if (verdict.cause.length === 0) {
    scaleStepRatingState.degraded = true;
    return;
  }
  beginPanelRewardHold([...verdict.cause, ...verdict.reactions]);
  // A beat still owed for an earlier response plays this one's tokens too.
  const previous = entry;
  entry = {
    plan,
    origins: [...(previous?.origins ?? []), ...origins],
    cause: [...(previous?.cause ?? []), ...verdict.cause],
    reactions: [...(previous?.reactions ?? []), ...verdict.reactions],
  };
  scaleStepRatingState.tokens = entry.cause.length;
  scaleStepRatingState.due = false;
  scaleStepRatingState.degraded = false;
  openQuiet();
  scaleStepRatingState.phase = 'waiting';
  void run();
}

function markerOf(accent: ScaleStepRatingAccent): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`.scale-marker[data-scale-marker="${accent}"]`);
}

/** The stage stands: the player sees the board, the park let every moved value go, and every marker has ARRIVED. */
function stageReady(e: Entry): boolean {
  void boardBeatParkState.heldParams;
  if (!boardBeatBoardWatchable()) {
    return false;
  }
  for (const move of e.plan.moves) {
    void scaleMarkerPoses[move.accent];
    if (boardBeatHoldsParam(move.key)) {
      return false;
    }
    // No cursor at all (a board without this dial): nothing will ever arrive — the beat degrades honestly.
    if (!scaleMarkerArrived(move.accent, move.after) && markerOf(move.accent) !== null) {
      return false;
    }
  }
  return true;
}

/** Wait for the stage — resolves `true` on the stage, `false` past its due or on an abort. */
function waitForStage(e: Entry, myEpoch: number): Promise<boolean> {
  if (stageReady(e)) {
    return Promise.resolve(true);
  }
  debt?.settle();
  debt = owePresentation({
    id: SCALE_STEP_RATING_KEY,
    ready: () => stageReady(e),
    redrive: () => {
      scaleStepRatingState.nudge++;
    },
    dueMs: SCALE_STEP_STAGE_DUE_MS,
    degrade: () => {
      scaleStepRatingState.due = true;
    },
    diagnose: () => ({
      rating: e.plan.rating, watchable: boardBeatBoardWatchable(),
      moves: e.plan.moves.map((m) => `${m.accent}:${m.steps}→${m.after} parked=${boardBeatHoldsParam(m.key)} marker=${JSON.stringify(scaleMarkerPoses[m.accent])}`),
    }),
  });
  return new Promise<boolean>((resolve) => {
    const stop: WatchStopHandle = watch(
      () => {
        void scaleStepRatingState.nudge;
        if (epoch !== myEpoch) {
          return 'abort';
        }
        if (scaleStepRatingState.due) {
          return 'due';
        }
        return stageReady(e) ? 'ready' : 'wait';
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

/** A wait on the GSAP clock — the clock the tokens animate on. */
function gsapWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    gsap.delayedCall(ms / 1000, () => resolve());
  });
}

/** The birth point of each token: the marker's rim (fanned per marker), the 16 % chip's centre for the bonus. */
function birthPoints(origins: ReadonlyArray<TokenOrigin>): Array<TransferPoint | undefined> {
  const out: Array<TransferPoint | undefined> = origins.map(() => undefined);
  const perMarker = new Map<ScaleStepRatingAccent, Array<number>>();
  origins.forEach((origin, i) => {
    if (origin.bonus) {
      const chip = typeof document === 'undefined' ? null :
        document.querySelector<HTMLElement>(`.bonus-zone[data-arc-marker="${VENUS_TR_BONUS_CHIP}"]`);
      const box = chip?.getBoundingClientRect();
      if (box !== undefined && box.width > 1) {
        out[i] = {x: box.left + box.width / 2, y: box.top + box.height / 2};
        return;
      }
    }
    perMarker.set(origin.accent, [...(perMarker.get(origin.accent) ?? []), i]);
  });
  for (const [accent, indices] of perMarker) {
    const box = markerOf(accent)?.getBoundingClientRect();
    if (box === undefined || box.width < 2 || box.height < 2 || box.bottom < 0 || box.top > window.innerHeight) {
      continue;
    }
    const points = scaleStepTokenOrigins({x: box.left, y: box.top, w: box.width, h: box.height}, indices.length);
    indices.forEach((index, n) => {
      out[index] = points[n];
    });
  }
  return out;
}

/** Fly the entry's tokens off their birth points; each touchdown releases one rating; the answer a beat after the last. */
async function pay(e: Entry, myEpoch: number): Promise<void> {
  scaleStepRatingState.phase = 'flying';
  const points = birthPoints(e.origins);
  const specs = [...e.cause];
  if (points.some((p) => p === undefined)) {
    // Nothing to be born on (no marker on screen) — the counters tick now, honestly.
    scaleStepRatingState.degraded = true;
    releaseHeld(e);
    return;
  }
  await runResourceTransfers({
    specs,
    origins: points,
    source: {},
    arrival: 'auto',
    // Born on the board: under a workspace opened mid-flight the wave recedes with it.
    fromBoard: true,
    onArrive: (spec) => {
      const index = e.cause.indexOf(spec);
      if (index >= 0) {
        e.cause.splice(index, 1);
        releasePanelRewardHold(spec);
      }
    },
    onDegrade: () => {
      scaleStepRatingState.degraded = true;
    },
  });
  if (epoch !== myEpoch) {
    return;
  }
  // Whatever a token's honest fallback did not release (never strand a counter).
  for (const spec of e.cause.splice(0)) {
    releasePanelRewardHold(spec);
  }
  // THE ANSWER — one beat after the last touchdown, on the animation clock.
  const answers = e.reactions.splice(0);
  if (answers.length > 0) {
    await gsapWait(motionMs(TOUCHDOWN_TICK_GAP_MS));
    for (const spec of answers) {
      releasePanelRewardHold(spec);
    }
  }
}

async function run(): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  const myEpoch = ++epoch;
  try {
    while (epoch === myEpoch && entry !== undefined) {
      const e = entry;
      scaleStepRatingState.phase = 'waiting';
      const ready = await waitForStage(e, myEpoch);
      if (epoch !== myEpoch) {
        return;
      }
      if (!ready) {
        // Past its due: the player never came back to the board — the cell ticks, nothing flies.
        entry = undefined;
        releaseHeld(e);
        continue;
      }
      // The marker's settle accent is the step's own last word — the token leaves on its breath.
      await gsapWait(motionMs(SCALE_STEP_BREATH_MS));
      if (epoch !== myEpoch || entry !== e) {
        continue;
      }
      entry = undefined;
      await pay(e, myEpoch);
    }
  } finally {
    running = false;
    if (epoch === myEpoch) {
      scaleStepRatingState.phase = 'idle';
      scaleStepRatingState.tokens = 0;
      resolveQuiet();
    } else if (entry !== undefined) {
      void run();
    }
  }
}

/** Abort / game switch: stop, release whatever the panel still holds for this beat (a hold never strands a counter). Idempotent. */
export function resetScaleStepRating(): void {
  epoch++;
  const e = entry;
  entry = undefined;
  debt?.settle();
  debt = undefined;
  if (e !== undefined) {
    releaseHeld(e);
  }
  scaleStepRatingState.phase = 'idle';
  scaleStepRatingState.tokens = 0;
  scaleStepRatingState.due = false;
  scaleStepRatingState.degraded = false;
  resolveQuiet();
}
