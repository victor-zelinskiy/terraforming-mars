/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «КЛЕТКА ОТДАЁТ ВЫБРАННЫЙ РЕСУРС» — Amazonis Planitia's «a standard resource of your choice» cells (E3, E9, K3;
 * phase 1 of the board's adaptation, `docs/claude/amazonis-planitia-phase-1.md` § the standard-resource cell).
 *
 * THE GAP IT CLOSES. Every other printed stock bonus is told by the landing's ONE wave (a token per printed icon, off
 * the cell — `placementBonuses`). This one is a QUESTION: the cell asks (its source plate in the task host — the
 * server marks the `SelectResource` with the cell as `choiceContext.source`), and the answer lands in a LATER response
 * than the tile. Without this beat the rail row ticked in the frame the answer applied — a gain with no cause on
 * screen, the one thing physical causality forbids.
 *
 * THE RECORD. The server publishes the answer (`GameModel.cellResourcePayouts` — who chose, which resource, which
 * cell; a ring consumed once by `seq`). Read in the apply block (`seedCellResourceHolds` — the transport's own submit
 * and `App.update`'s poll / WS frame alike): the VIEWER's unit is checked against the two views (`verifyRailReward` —
 * a row that moved otherwise is not held and names itself) and held on the panel; ANOTHER seat's flies to that seat's
 * intake plaque (`openSeatIntake` — «что есть для своего хода, должно быть и для чужого»).
 *
 * THE BEAT. The stage is a board the player can SEE (`boardBeatBoardWatchable` — the question's own plate has left)
 * with the cell painted; then ONE token is born on the cell and lands on its row (the row ticks on the touchdown) or
 * on the seat's plaque. A ledger debt: the player never coming back to the board degrades honestly (the row ticks,
 * nothing flies). NOTIFICATION-ONLY hold (a decision never waits on a story). Reduced motion holds nothing.
 */
import {reactive, watch, WatchStopHandle} from 'vue';
import {CellResourcePayoutModel} from '@/common/models/TilePlacementRecordModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {OwedStoryHandle, owePresentation} from '@/client/console/presentationLedger';
import {boardBeatBoardWatchable} from '@/client/console/boardBeatPark';
import {verifyRailReward} from '@/client/console/resourceTransfer/railReward';
import {beginPanelRewardHold, releasePanelRewardHold, runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {acceptSeatIntake, openSeatIntake, seatIntakeEnd} from '@/client/console/statusIntake';
import {beginCeilingWait} from '@/client/console/waitGraph/ceilingWait';

/** The beat's own name — its notification-only hold, its ledger story. */
export const CELL_RESOURCE_KEY = 'cell-resource';
/** How long a beat may wait for a watchable board before the rows tick honestly. */
const STAGE_DUE_MS = 30_000;

type Entry = {record: CellResourcePayoutModel, spec: ResourceTransferSpec, own: boolean, held: boolean};

export const cellResourceState = reactive({
  phase: 'idle' as 'idle' | 'waiting' | 'flying',
  /** Bumped by a ledger redrive (the stage watcher re-asks). */
  nudge: 0,
  /** The last beat degraded (no cell on screen / a promise the views did not keep / past due). */
  degraded: false,
});

let queue: Array<Entry> = [];
let consumedSeq: number | undefined;
let running = false;
let debt: OwedStoryHandle | undefined;
/** Bumped by the ceiling's recovery — a run of an older generation lets go at its next await (never a newer run's). */
let generation = 0;
/** The entry being paid right now (shifted off the queue, its unit still held until the touchdown). */
let current: Entry | undefined;
/** The pending stage wait's own degrade (resolves it «not ready») — the ceiling's recovery calls it. */
let abortStageWait: (() => void) | undefined;

/**
 * THE FRESH RECORDS of a response (pure): the records with a `seq` above the last one consumed. The FIRST view seen
 * only sets the baseline (a reload never replays an old answer).
 */
export function freshCellResourcePayouts(
  records: ReadonlyArray<CellResourcePayoutModel> | undefined, consumed: number | undefined,
): {fresh: Array<CellResourcePayoutModel>, consumed: number | undefined} {
  const list = records ?? [];
  const top = list.reduce((max, r) => Math.max(max, r.seq), consumed ?? -1);
  if (consumed === undefined) {
    return {fresh: [], consumed: list.length === 0 ? -1 : top};
  }
  return {fresh: list.filter((r) => r.seq > consumed).sort((a, b) => a.seq - b.seq), consumed: top};
}

/** The token of a record — one stock unit of the chosen resource. */
export function cellResourceSpec(record: CellResourcePayoutModel): ResourceTransferSpec {
  return {channel: 'stock', resource: record.resource, amount: record.amount};
}

/** Test seam: forget what was consumed. */
export function resetCellResourceBeat(): void {
  queue = [];
  consumedSeq = undefined;
  cellResourceState.phase = 'idle';
  cellResourceState.degraded = false;
}

export function cellResourceBusy(): boolean {
  void cellResourceState.phase;
  return cellResourceState.phase !== 'idle';
}

registerAnimationHoldSupplier(CELL_RESOURCE_KEY, cellResourceBusy, {
  scope: 'notification-only',
  diagnose: () => ({phase: cellResourceState.phase, queued: queue.length, paying: current?.record.spaceId}),
  // THE CEILING ENDS THE WEDGE, NOT JUST THE COUNT: a flight that never reported its touchdown (or a seat plaque that
  // never opened) ends by the degrade of the beat — every held unit let go (the row ticks to the applied view), the
  // stage debt settled, the queue dropped, the beat idle; the wedged run lets go at its next await (generation).
  expire: () => {
    if (cellResourceState.phase === 'idle') {
      return;
    }
    console.warn(`[cellResourceBeat] cell resource beat (${cellResourceState.phase}): outlived its ceiling — ended`);
    endCellResourceBeat();
  },
});

/** The beat's honest degrade, run by the ceiling: nothing flies, every held row reads the truth. */
function endCellResourceBeat(): void {
  generation++;
  const abort = abortStageWait;
  abortStageWait = undefined;
  abort?.();
  debt?.settle();
  debt = undefined;
  if (current !== undefined) {
    release(current);
    current = undefined;
  }
  for (const e of queue) {
    release(e);
  }
  queue = [];
  running = false;
  cellResourceState.degraded = true;
  cellResourceState.phase = 'idle';
}

/**
 * SEED — the apply block (the transport's `seedRewardHolds`, `App.update`): the fresh records of this response; the
 * viewer's own unit held on its row when the views keep the promise.
 */
export function seedCellResourceHolds(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  if (after === undefined) {
    return;
  }
  const {fresh, consumed} = freshCellResourcePayouts(after.game.cellResourcePayouts, consumedSeq);
  consumedSeq = consumed;
  if (fresh.length === 0 || typeof document === 'undefined' || consoleReducedMotionActive()) {
    return;
  }
  const viewer: Color | undefined = after.thisPlayer?.color;
  for (const record of fresh) {
    const spec = cellResourceSpec(record);
    const own = record.color === viewer;
    let held = false;
    if (own) {
      const verdict = verifyRailReward({cause: [spec], reactions: []}, before, after);
      if (verdict.cause.length === 0) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[cell-resource] not shown as promised — ${verdict.mismatches.join('; ')}`);
        }
        cellResourceState.degraded = true;
        continue;
      }
      beginPanelRewardHold(verdict.cause);
      held = true;
    }
    queue.push({record, spec, own, held});
  }
  if (queue.length > 0) {
    cellResourceState.phase = 'waiting';
    void run();
  }
}

/** The painted centre of the cell, or undefined (not on screen). */
function cellPoint(spaceId: string): TransferPoint | undefined {
  const box = document.querySelector<HTMLElement>(`#main_board [data_space_id="${spaceId}"]`)?.getBoundingClientRect();
  if (box === undefined || box.width < 2 || box.height < 2 || box.bottom < 0 || box.top > window.innerHeight) {
    return undefined;
  }
  return {x: box.left + box.width / 2, y: box.top + box.height / 2};
}

function stageReady(e: Entry): boolean {
  return boardBeatBoardWatchable() && cellPoint(e.record.spaceId) !== undefined;
}

function waitForStage(e: Entry): Promise<boolean> {
  if (stageReady(e)) {
    return Promise.resolve(true);
  }
  let due = false;
  let aborted = false;
  debt?.settle();
  const mine = owePresentation({
    id: CELL_RESOURCE_KEY,
    ready: () => stageReady(e),
    redrive: () => {
      cellResourceState.nudge++;
    },
    dueMs: STAGE_DUE_MS,
    degrade: () => {
      due = true;
      cellResourceState.nudge++;
    },
    diagnose: () => ({space: e.record.spaceId, watchable: boardBeatBoardWatchable()}),
  });
  // The wait waits: a node of the wait graph beside its ledger story, the due ending it said (`ceilingWait.ts`).
  const wait = beginCeilingWait({id: 'cell-resource:stage', owner: 'cellResourceBeat', what: 'the stage of the cell resource', maxMs: STAGE_DUE_MS});
  debt = mine;
  const abort = () => {
    aborted = true;
    due = true;
    cellResourceState.nudge++;
  };
  abortStageWait = abort;
  return new Promise<boolean>((resolve) => {
    const stop: WatchStopHandle = watch(
      () => {
        void cellResourceState.nudge;
        if (due) {
          return 'due';
        }
        return stageReady(e) ? 'ready' : 'wait';
      },
      (verdict) => {
        if (verdict !== 'wait') {
          stop();
          mine.settle();
          if (debt === mine) {
            debt = undefined;
          }
          if (abortStageWait === abort) {
            abortStageWait = undefined;
          }
          if (verdict === 'ready') {
            wait.met();
          } else if (aborted) {
            wait.end();
          } else {
            wait.ceiling();
          }
          resolve(verdict === 'ready');
        }
      });
  });
}

function release(e: Entry): void {
  if (e.held) {
    e.held = false;
    releasePanelRewardHold(e.spec);
  }
}

async function pay(e: Entry, gen: number): Promise<void> {
  cellResourceState.phase = 'flying';
  const origin = cellPoint(e.record.spaceId);
  if (origin === undefined) {
    cellResourceState.degraded = true;
    release(e);
    return;
  }
  const seat = e.own ? undefined : e.record.color;
  if (seat !== undefined) {
    await openSeatIntake(seat, [{resource: e.spec.resource, amount: e.spec.amount}]);
    if (gen !== generation) {
      release(e);
      return;
    }
  }
  const destination = seat === undefined ? undefined : seatIntakeEnd(seat, e.spec.resource);
  await runResourceTransfers({
    specs: [e.spec],
    origins: [origin],
    source: {},
    arrival: 'auto',
    fromBoard: true,
    ...(destination !== undefined ? {destination} : {}),
    onArrive: () => {
      release(e);
      if (seat !== undefined) {
        acceptSeatIntake(seat, {resource: e.spec.resource, amount: e.spec.amount});
      }
    },
    onDegrade: () => {
      cellResourceState.degraded = true;
    },
  });
  release(e);
}

async function run(): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  const gen = generation;
  try {
    while (queue.length > 0 && gen === generation) {
      const e = queue[0];
      cellResourceState.phase = 'waiting';
      const ready = await waitForStage(e);
      if (gen !== generation) {
        return;
      }
      queue.shift();
      if (!ready) {
        cellResourceState.degraded = true;
        release(e);
        continue;
      }
      current = e;
      await pay(e, gen);
      if (current === e) {
        current = undefined;
      }
    }
  } finally {
    // A run the ceiling ended is not this generation's to close (a newer run may own the phase by now).
    if (gen === generation) {
      running = false;
      cellResourceState.phase = 'idle';
    }
  }
}
