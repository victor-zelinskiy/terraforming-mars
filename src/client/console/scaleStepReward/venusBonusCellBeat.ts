/*
 * «БОНУС ВЕНЕРЫ ПРИХОДИТ С ЯЧЕЙКИ» — the resource the player chose for the alternative Venus board's bonus is born on
 * the BONUS CELL of the scale it was earned on (`v18 … v28`, the 30 % `v30-final` cube) and flies to its rail row (a
 * wild resource on a card — to that card), the row ticking on the touchdown (P89 · ledger EE, PL-1436 — the owner,
 * 2026-11-02: «выбранный ресурс бонуса … вылетает из ячейки на маркере»).
 *
 * THE GAP IT CLOSES. The bonus is a QUESTION (the player picks the resource), so its answer is a separate response —
 * and the rows it paid ticked in the frame that response applied: under the hosting workspace, before the step that
 * earned it had even been told on the board (the park held the marker on 16 % while «+1 steel» was already in the
 * rail). A gain with no cause on screen is the one thing the console's physical causality forbids.
 *
 * THE BEATS, in the park's causal order: the bonus is answered (inside its host — the question inside, the story
 * after) → the host leaves → the park drains: the marker GLIDES to the cell → the step's RATING tokens fly
 * (`scaleStepRatingBeat` — this beat waits for it) → the marker's breath → ONE TOKEN PER RESOURCE is born on the cell
 * the step reached (several steps: the cells in turn) and lands on its row; the rows tick on the touchdowns. A
 * standalone band (no host — a reload) is answered over a board that already told the step: the stage stands at once.
 *
 * HOLDS — the rating beat's shape, for the same reason: the PROMISE is ARMED at the answer (the surface knows exactly
 * what it sent — `armVenusBonusCell`) and CHECKED against the two views in the transport's apply block
 * (`verifyRailReward` — a row that moved otherwise is not held and names itself); the rows are held on the PANEL
 * (`beginPanelRewardHold`), the named hold is NOTIFICATION-ONLY (a decision never waits on a story — the liveness
 * law), the beat is a member of the park's story (the cover waits for it) and a ledger debt that degrades (the player
 * never came back to the board → the rows tick, nothing flies). Reduced motion holds nothing.
 */
import {reactive, watch, WatchStopHandle} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {MAX_VENUS_SCALE} from '@/common/constants';
import {BoardName} from '@/common/boards/BoardName';
import {getGlobalParameterMaximums} from '@/common/boards/GlobalParameterMaximums';
import {altVenusResourceCells} from '@/common/venus/altVenusBonus';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {scaleMarkerArrived, scaleMarkerPoses} from '@/client/components/board/scaleMarkerArrival';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {OwedStoryHandle, owePresentation} from '@/client/console/presentationLedger';
import {boardBeatBoardWatchable, boardBeatHoldsParam, boardBeatParkState, registerBoardBeatStoryMember} from '@/client/console/boardBeatPark';
import {verifyRailReward} from '@/client/console/resourceTransfer/railReward';
import {beginPanelRewardHold, releasePanelRewardHold, runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {SCALE_STEP_BREATH_MS, SCALE_STEP_STAGE_DUE_MS} from '@/client/console/scaleStepReward/scaleStepRewardModel';
import {scaleStepRatingBusy, scaleStepRatingQuiet} from '@/client/console/scaleStepReward/scaleStepRatingBeat';

/** The beat's own name — its notification-only hold, its ledger story, its park membership. */
export const VENUS_BONUS_CELL_KEY = 'venus-bonus-cell';

/** What the bonus surface SENT — the promise the views are checked against. */
export type VenusBonusCellArm = {
  /** Standard resources per row (the lanes' picks, the wild taken as a standard one folded in). */
  units: Partial<Record<string, number>>,
  /** The wild resource put on a card — the card and its resource (the `cardResourceIcon` form). */
  card?: {name: CardName, resource: string},
  /** The raise that earned the bonus (`VenusBonusPromptMeta.step`) — which cells the tokens are born on. */
  step?: {from: number, to: number},
  /**
   * PRE-SELECTED in a composer (P89 · ledger EL): the answer rides the commit's batch, so no bonus prompt ever
   * stands — the response that APPLIES it is the one in which Venus reached `step.to` (and no bonus is asked).
   */
  preselected?: true,
};

/** A pre-selected promise the commit never redeemed (a refused batch, a cancelled play) does not outlive its press. */
const PRESELECT_ARM_MAX_MS = 60_000;

/**
 * THE CELLS a raise reached, in the scale's order — the board's own chip keys (`Board.bonusZoneProps`:
 * `<scale>-<step>` → `venus-18 … venus-30` (`venus-24 … venus-33` on Amazonis Planitia), the finish's gold cube included; `data-arc-marker` on the chip). Pure. Empty
 * when the raise reached no resource cell (no step known — an older save).
 */
export function venusBonusCells(step: {from: number, to: number} | undefined, maxVenus: number = MAX_VENUS_SCALE): Array<string> {
  if (step === undefined) {
    return [];
  }
  // The MAP's seven cells (`altVenusResourceCells` — 18 … 30 classic, 24 … 33 on Amazonis Planitia's longer track).
  return altVenusResourceCells(maxVenus).filter((level) => level > step.from && level <= step.to).map((level) => `venus-${level}`);
}

/** The Venus maximum of the board a view plays on (the cells of its alternative board). */
function maxVenusOf(view: PlayerViewModel | undefined): number {
  return getGlobalParameterMaximums(view?.game.gameOptions?.boardName ?? BoardName.THARSIS).venus;
}

/**
 * THE SPECS of an arm, in birth order — one token per unit (the standard rows in the rail's order, the card last) — and
 * the cell each is born on (the cells in turn; more tokens than cells ride the last one). Pure.
 */
export function venusBonusCellPlan(arm: VenusBonusCellArm, maxVenus: number = MAX_VENUS_SCALE): Array<{spec: ResourceTransferSpec, cell: string | undefined}> {
  const cells = venusBonusCells(arm.step, maxVenus);
  const order = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];
  const specs: Array<ResourceTransferSpec> = [];
  for (const unit of order) {
    for (let i = 0; i < (arm.units[unit] ?? 0); i++) {
      specs.push({channel: 'stock', resource: unit, amount: 1});
    }
  }
  if (arm.card !== undefined) {
    specs.push({channel: 'card-resource', resource: arm.card.resource, amount: 1, targetCard: arm.card.name});
  }
  return specs.map((spec, i) => ({spec, cell: cells.length === 0 ? undefined : cells[Math.min(i, cells.length - 1)]}));
}

export const venusBonusCellState = reactive({
  phase: 'idle' as 'idle' | 'waiting' | 'flying',
  /** Past its due — the rows ticked, nothing flew. */
  due: false,
  /** The last beat degraded: no cell on screen, or a promise the views did not keep. */
  degraded: false,
  nudge: 0,
});

type Entry = {plan: Array<{spec: ResourceTransferSpec, cell: string | undefined}>, held: Array<ResourceTransferSpec>, to: number};

let armed: VenusBonusCellArm | undefined;
let armedAt = 0;
let entry: Entry | undefined;
let epoch = 0;
let running = false;
let debt: OwedStoryHandle | undefined;
let quietResolve: (() => void) | undefined;
let quietPromise: Promise<void> = Promise.resolve();

/** ARM — the bonus surface, at the answer it sends (never on the server's clock). */
export function armVenusBonusCell(arm: VenusBonusCellArm): void {
  armed = arm;
  armedAt = Date.now();
}

/**
 * IS THIS RESPONSE THE ONE THAT APPLIED THE ARMED ANSWER? The live surface's answer: a bonus was asked before and is
 * not after. A PRE-SELECTED answer (the composer's batch — no bonus prompt ever stands): Venus reached the raise's
 * cell in this very response and nothing asks the bonus after it (a refused batch asks it live — the surface re-arms).
 */
export function venusBonusAnswerApplied(arm: VenusBonusCellArm, before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): boolean {
  if (after?.waitingFor?.venusBonusPrompt !== undefined) {
    return false;
  }
  if (before?.waitingFor?.venusBonusPrompt !== undefined) {
    return true;
  }
  if (arm.preselected !== true || arm.step === undefined) {
    return false;
  }
  const was = before?.game.venusScaleLevel;
  const now = after?.game.venusScaleLevel;
  return was !== undefined && now !== undefined && was < arm.step.to && now >= arm.step.to;
}

export function venusBonusCellBusy(): boolean {
  void venusBonusCellState.phase;
  return venusBonusCellState.phase !== 'idle';
}

export function venusBonusCellQuiet(): Promise<void> {
  return venusBonusCellState.phase === 'idle' ? Promise.resolve() : quietPromise;
}

registerBoardBeatStoryMember(VENUS_BONUS_CELL_KEY, {busy: venusBonusCellBusy, quiet: venusBonusCellQuiet});
registerAnimationHoldSupplier(VENUS_BONUS_CELL_KEY, venusBonusCellBusy, {
  scope: 'notification-only',
  diagnose: () => ({phase: venusBonusCellState.phase, due: venusBonusCellState.due}),
});

/**
 * SEED — the transport's apply block, beside the rating beat: the response that ANSWERED the bonus (the view before
 * asked it, the view after no longer does) and an arm the surface set. The rows are checked against the views and held.
 */
export function seedVenusBonusCellHold(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  const arm = armed;
  if (arm?.preselected === true && Date.now() - armedAt > PRESELECT_ARM_MAX_MS) {
    armed = undefined;
    return;
  }
  if (arm === undefined || !venusBonusAnswerApplied(arm, before, after)) {
    return;
  }
  armed = undefined;
  if (typeof document === 'undefined' || consoleReducedMotionActive()) {
    return;
  }
  const plan = venusBonusCellPlan(arm, maxVenusOf(after));
  if (plan.length === 0) {
    return;
  }
  const verdict = verifyRailReward({cause: plan.map((p) => p.spec), reactions: []}, before, after);
  if (verdict.mismatches.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(`[venus-bonus-cell] not shown as promised — ${verdict.mismatches.join('; ')}`);
  }
  const held = verdict.cause;
  if (held.length === 0) {
    venusBonusCellState.degraded = true;
    return;
  }
  beginPanelRewardHold(held);
  entry = {plan: plan.filter((p) => held.includes(p.spec)), held: [...held], to: arm.step?.to ?? MAX_VENUS_SCALE};
  venusBonusCellState.due = false;
  venusBonusCellState.degraded = false;
  if (quietResolve === undefined) {
    quietPromise = new Promise<void>((resolve) => {
      quietResolve = resolve;
    });
  }
  venusBonusCellState.phase = 'waiting';
  void run();
}

function releaseHeld(e: Entry): void {
  for (const spec of e.held.splice(0)) {
    releasePanelRewardHold(spec);
  }
}

/** The stage: the board in plain view, the park done with Venus, the marker RESTING on the cell, the rating told. */
function stageReady(e: Entry): boolean {
  void boardBeatParkState.heldParams;
  void scaleMarkerPoses.venus;
  if (!boardBeatBoardWatchable() || boardBeatHoldsParam('venusScaleLevel') || scaleStepRatingBusy()) {
    return false;
  }
  const marker = document.querySelector('.scale-marker[data-scale-marker="venus"]');
  return marker === null || scaleMarkerArrived('venus', e.to);
}

function waitForStage(e: Entry, myEpoch: number): Promise<boolean> {
  if (stageReady(e)) {
    return Promise.resolve(true);
  }
  debt?.settle();
  debt = owePresentation({
    id: VENUS_BONUS_CELL_KEY,
    ready: () => stageReady(e),
    redrive: () => {
      venusBonusCellState.nudge++;
    },
    dueMs: SCALE_STEP_STAGE_DUE_MS,
    degrade: () => {
      venusBonusCellState.due = true;
    },
    diagnose: () => ({to: e.to, watchable: boardBeatBoardWatchable(), parked: boardBeatHoldsParam('venusScaleLevel'), rating: scaleStepRatingBusy()}),
  });
  return new Promise<boolean>((resolve) => {
    const stop: WatchStopHandle = watch(
      () => {
        void venusBonusCellState.nudge;
        if (epoch !== myEpoch) {
          return 'abort';
        }
        if (venusBonusCellState.due) {
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

function gsapWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    gsap.delayedCall(ms / 1000, () => resolve());
  });
}

/** The centre of a bonus cell as painted, or undefined (no cell on screen). */
function cellPoint(key: string | undefined): TransferPoint | undefined {
  if (key === undefined) {
    return undefined;
  }
  const box = document.querySelector<HTMLElement>(`.bonus-zone[data-arc-marker="${key}"]`)?.getBoundingClientRect();
  if (box === undefined || box.width < 2 || box.height < 2 || box.bottom < 0 || box.top > window.innerHeight) {
    return undefined;
  }
  return {x: box.left + box.width / 2, y: box.top + box.height / 2};
}

async function pay(e: Entry, myEpoch: number): Promise<void> {
  venusBonusCellState.phase = 'flying';
  const points = e.plan.map((p) => cellPoint(p.cell));
  if (points.some((p) => p === undefined)) {
    // No cell to be born on (a board without the alternative cells on screen) — the rows tick now, honestly.
    venusBonusCellState.degraded = true;
    releaseHeld(e);
    return;
  }
  await runResourceTransfers({
    specs: e.plan.map((p) => p.spec),
    origins: points,
    source: {},
    arrival: 'auto',
    fromBoard: true,
    onArrive: (spec) => {
      const index = e.held.indexOf(spec);
      if (index >= 0) {
        e.held.splice(index, 1);
        releasePanelRewardHold(spec);
      }
    },
    onDegrade: () => {
      venusBonusCellState.degraded = true;
    },
  });
  if (epoch === myEpoch) {
    releaseHeld(e);
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
      venusBonusCellState.phase = 'waiting';
      // The step's rating tells first (its tokens off the marker), the chosen resource after it.
      await scaleStepRatingQuiet();
      const ready = await waitForStage(e, myEpoch);
      if (epoch !== myEpoch) {
        return;
      }
      entry = undefined;
      if (!ready) {
        releaseHeld(e);
        continue;
      }
      await gsapWait(motionMs(SCALE_STEP_BREATH_MS));
      if (epoch !== myEpoch) {
        releaseHeld(e);
        return;
      }
      await pay(e, myEpoch);
    }
  } finally {
    running = false;
    if (epoch === myEpoch) {
      venusBonusCellState.phase = 'idle';
      const r = quietResolve;
      quietResolve = undefined;
      r?.();
    }
  }
}

/** Abort / game switch: stop and release whatever the panel still holds (a hold never strands a counter). Idempotent. */
export function resetVenusBonusCell(): void {
  epoch++;
  armed = undefined;
  const e = entry;
  entry = undefined;
  if (e !== undefined) {
    releaseHeld(e);
  }
  debt?.settle();
  debt = undefined;
  venusBonusCellState.phase = 'idle';
  venusBonusCellState.due = false;
  const r = quietResolve;
  quietResolve = undefined;
  r?.();
}
