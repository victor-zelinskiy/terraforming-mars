/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WORLD BEAT (Turmoil Redux — Gas Export, RX12): an enactment that moves
 * the PLANET plays where the planet is.
 *
 * Every other record of a sitting lands on a seat's rail, in the sitting's own
 * zone, and the reward beat flies it there. A WORLD record lands nowhere the
 * sitting can show: oxygen went down and Venus went up, on the board that the
 * sitting is standing in front of. So the sitting DOES WHAT THE WINNER'S TILE
 * ALREADY DOES — it steps aside («К полю»), lets the board tell its own story,
 * and comes back to read the receipt:
 *
 *   OWE   — the response carried a new world record (detected structurally, in
 *           the apply block, for EVERY viewer — a world record names no seat);
 *   YIELD — the reward stage hands the screen to the board
 *           (`yieldStackToBoard` — the same door the winner's placement uses);
 *   STORY — the BOARD-BEAT PARK drains: the values it held while the sitting
 *           covered the board release, the markers glide, the HUD's own delta
 *           chips tick. Nothing here animates a scale — the park is the one
 *           presenter of that law, and a lowering therefore arrives in the
 *           ordinary LOSS tone of a negative delta, with no celebration and no
 *           threshold flash of its own;
 *   RETURN — the stack comes back at the same depth and the reward page reads
 *           the planet line for one beat before the walk goes on.
 *
 * BOUNDED AND NAMED, like every hold in this console: the wait for the story
 * is capped (`WORLD_STORY_MAX_MS`) and the return happens anyway — a sitting
 * that never came back would be a far worse lie than a missed glide. The beat
 * NEVER replays: a sitting's world records are owed once, and a reload (no
 * `before` view) owes nothing at all.
 *
 * THE WINNER'S OWN STEP OF A PARAMETER (Mohole Contest, RX23) is the SAME
 * beat in another tone: its record names a seat and is REWARDED, so the
 * park's story carries the marker's glide AND the winner's TR chip (the HUD's
 * own delta chip — the standard presentation of a rating that moved), and
 * every viewer plays it (the planet moved for all of them). Two things differ
 * from a world move, both structural: the record is the WINNER's (the band
 * reads it through the winner block, the results in the winner's row — never
 * the planet line), and the step may set off a placement of the winner's OWN
 * (the ocean of 0 °C): while THAT stands the frame does not come back — the
 * board still has the seat's business, and the placement's own end resumes
 * the stack.
 */
import {reactive} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel, ParliamentPhaseModel} from '@/common/models/ParliamentModel';
import {boardBeatStoryPending, drainBoardBeatsIfDue} from '@/client/console/boardBeatPark';
import {resumeStackFromBoard, stackYieldedToBoard, yieldStackToBoard} from '@/client/console/consoleWorkspaceStack';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {probeTick} from '@/client/console/probeTick';

/** The wait for the board's own story, capped — the frame comes back either way. */
export const WORLD_STORY_MAX_MS = 9000;

export const parliamentWorldBeatState = reactive({
  /** The sitting the owed records belong to (`generation:seq`). */
  sitting: '',
  /** The world records this sitting has not yet shown on the board. */
  owed: [] as Array<ParliamentEnactOutcomeModel>,
  /** The frame is away at the board for the world's move. */
  away: false,
  /** …and it is back, owing ONE read of the planet line on the reward page. */
  receipt: undefined as {sitting: string, moves: Array<ParliamentEnactOutcomeModel>} | undefined,
  /** The reward stage is SHOWING that read (cleared with the beat). */
  receiptShowing: false,
});

function phaseOf(view: PlayerViewModel | undefined): ParliamentPhaseModel | undefined {
  return view?.game.parliament?.phase;
}

/**
 * A PLANET RECORD — a move of a global parameter the sitting shows on the
 * board: the world's own (no seat, `part: 'world'`) or the WINNER's step of a
 * parameter (a seat, `part: 'winner'`, `kind: 'globalParameter'` — Mohole
 * Contest). A tile's record (`ocean` / `greenery`) is not one: its board trip
 * is the placement's.
 */
export function isPlanetRecord(outcome: ParliamentEnactOutcomeModel): boolean {
  return outcome.kind === 'globalParameter' && (outcome.player === undefined ? outcome.part === 'world' : outcome.part === 'winner');
}

/** The structural identity of a planet record — the seat (none for the world) and the step. */
function planetKey(outcome: ParliamentEnactOutcomeModel): string {
  return `${outcome.player ?? 'world'}:${outcome.step}`;
}

/**
 * DETECT (pure): the PLANET records this response added to the live phase —
 * present in `after`, absent from `before` (same generation). A world record
 * names no seat and the winner's step names the winner, and EVERY viewer
 * detects both (the planet moved for all of them). A first view (no `before`)
 * or a new generation adds nothing: a reload replays nothing.
 */
export function detectNewWorldMoves(before: PlayerViewModel | undefined, after: PlayerViewModel): Array<ParliamentEnactOutcomeModel> {
  const phase = phaseOf(after);
  const was = phaseOf(before);
  if (phase === undefined || was === undefined || was.generation !== phase.generation) {
    return [];
  }
  const known = new Set((was.outcomes ?? []).filter(isPlanetRecord).map(planetKey));
  return (phase.outcomes ?? []).filter((o) => isPlanetRecord(o) && !known.has(planetKey(o)));
}

/** A new sitting drops whatever the old one still owed. */
export function enterWorldBeatSitting(key: string): void {
  if (parliamentWorldBeatState.sitting === key) {
    return;
  }
  parliamentWorldBeatState.sitting = key;
  parliamentWorldBeatState.owed = [];
  parliamentWorldBeatState.away = false;
  parliamentWorldBeatState.receipt = undefined;
  parliamentWorldBeatState.receiptShowing = false;
}

/**
 * SEED — called from the reward ledger's own seeder, in the SAME synchronous
 * block as the view apply. Reduced motion owes nothing: the scales have
 * already snapped and the results' planet line is the whole reading.
 */
export function seedWorldMoveBeat(before: PlayerViewModel | undefined, after: PlayerViewModel): void {
  const fresh = detectNewWorldMoves(before, after);
  if (fresh.length === 0 || consoleReducedMotionActive()) {
    return;
  }
  parliamentWorldBeatState.owed.push(...fresh);
}

/** Does this sitting still owe the board a world move? */
export function worldMoveOwed(sitting: string): boolean {
  return parliamentWorldBeatState.sitting === sitting && parliamentWorldBeatState.owed.length > 0;
}

/** The reward page owes ONE read of the planet line (the frame is back from the board). */
export function worldReceiptOwed(sitting: string): boolean {
  return parliamentWorldBeatState.receipt?.sitting === sitting;
}

/** The section takes the receipt for THIS sitting (once). */
export function takeWorldReceipt(sitting: string): Array<ParliamentEnactOutcomeModel> | undefined {
  const receipt = parliamentWorldBeatState.receipt;
  if (receipt === undefined || receipt.sitting !== sitting) {
    return undefined;
  }
  parliamentWorldBeatState.receipt = undefined;
  return receipt.moves;
}

function waitForStoryQuiet(): Promise<void> {
  return new Promise<void>((resolve) => {
    const started = Date.now();
    const tick = (): void => {
      // The drain is re-asked on every tick: the shell drives it on the
      // watchable rising edge, and this loop is the guard for the edge that
      // was already true when the frame stepped aside.
      drainBoardBeatsIfDue();
      if (!boardBeatStoryPending() || Date.now() - started > WORLD_STORY_MAX_MS) {
        resolve();
        return;
      }
      probeTick(tick);
    };
    probeTick(tick);
  });
}

/**
 * RUN — the reward stage hands the screen to the board, the park tells the
 * planet's story, and the frame comes back owing one read. Resolves once the
 * sitting is back (so the caller's walk can stop there and be re-queued by the
 * section's own mount).
 *
 * Returns `false` when there was nothing to do, or when the stack refused to
 * yield (no root, a root that does not step aside): the records are then
 * marked shown all the same — the scales have moved and the results' planet
 * line still states it. A beat that cannot play is never a beat that repeats.
 */
export async function runWorldMoveBeat(sitting: string, opts: {
  /**
   * THE BOARD STILL HAS THIS SEAT'S BUSINESS once the story is quiet — the
   * placement the winner's step set off (the ocean of 0 °C, Mohole Contest):
   * the frame then stays aside, and the placement's own end brings it back
   * (`resumeYieldedStackOverQuietBoard`), the receipt read then. Asked at the
   * end of the story, never at its start.
   */
  boardBusy?: () => boolean;
} = {}): Promise<boolean> {
  if (!worldMoveOwed(sitting)) {
    return false;
  }
  const moves = parliamentWorldBeatState.owed.splice(0);
  if (!yieldStackToBoard()) {
    return false;
  }
  parliamentWorldBeatState.away = true;
  try {
    await waitForStoryQuiet();
  } finally {
    parliamentWorldBeatState.away = false;
    if (stackYieldedToBoard() && opts.boardBusy?.() !== true) {
      resumeStackFromBoard();
    }
    parliamentWorldBeatState.receipt = {sitting, moves};
  }
  return true;
}

export function resetParliamentWorldBeat(): void {
  parliamentWorldBeatState.sitting = '';
  parliamentWorldBeatState.owed = [];
  parliamentWorldBeatState.away = false;
  parliamentWorldBeatState.receipt = undefined;
  parliamentWorldBeatState.receiptShowing = false;
}
