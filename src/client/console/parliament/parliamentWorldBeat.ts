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
 *
 * THE COLONY TABLE'S OWN MOVE (Unity Budget, RX29 — «advance each colony
 * track 2 steps») is the SAME beat played where the colony tracks are: on
 * the COLONIES SCREEN. The sitting does not step aside for it — it HOSTS the
 * screen as its own SHOW step (the very frame Colony Contest hosts for the
 * winner's build, pushed by the RECORD instead of by a question):
 *
 *   OWE   — the response carried a colony-track record (no seat, every viewer);
 *   HOLD  — every tile's presented marker is held where it STOOD (the model
 *           already carries the after position — `holdColonyTracks`);
 *   HOST  — the colonies frame is pushed onto the Parliament (`nested-step`
 *           holds the workspace; the crumb reads «… › КОЛОНИИ»; the section's
 *           field opens for it exactly as for the winner's build);
 *   WAVE  — the trade module's ONE marker mechanism runs for every tile in
 *           turn (`requestColonyTrackWave`): the scene breathes, the markers
 *           step twice, countably, one tile after another; a track at its end
 *           charges and settles back, named on the line;
 *   LEAVE — the frame pops by itself (no question was asked, so no answer
 *           takes it down — `closeColoniesShowStep`), the section reads the
 *           frame's departure and walks on from the reward page;
 *   RECEIPT — the reward page owes one read of the colonies line.
 *
 * Bounded and named like the planet's story: the wave has its own net, and a
 * screen that could not stand (no Parliament frame, a table with no tile)
 * releases every hold and reads the line instead. Never replayed.
 */
import {reactive} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel, ParliamentPhaseModel} from '@/common/models/ParliamentModel';
import {boardBeatStoryPending, drainBoardBeatsIfDue} from '@/client/console/boardBeatPark';
import {
  leaveWorkspace, pushWorkspaceFrame, resumeStackFromBoard, setWorkspaceFramePhase, stackYieldedToBoard, workspaceFrameHost, workspaceFrameIndex,
  workspaceStackState, yieldStackToBoard,
} from '@/client/console/consoleWorkspaceStack';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {probeTick} from '@/client/console/probeTick';
import {isColonyTrackRecord} from './colonyTrackModel';
import {consoleParliamentUi} from './consoleParliamentFlow';
import {holdColonyTracks, releaseColonyTracks, requestColonyTrackWave} from '@/client/console/colonyTrade/consoleColonyTrade';

/** The wait for the board's own story, capped — the frame comes back either way. */
export const WORLD_STORY_MAX_MS = 9000;

export const parliamentWorldBeatState = reactive({
  /** The sitting the owed records belong to (`generation:seq`). */
  sitting: '',
  /** The world records this sitting has not yet shown on the board. */
  owed: [] as Array<ParliamentEnactOutcomeModel>,
  /** The frame is away at the board for the world's move. */
  away: false,
  /** The colonies screen is HOSTED for the colony table's move (the wave is on stage). */
  hosting: false,
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

/** The structural identity of a planet / colony-table record — the seat (none for the world) and the step. */
function planetKey(outcome: ParliamentEnactOutcomeModel): string {
  return `${outcome.player ?? 'world'}:${outcome.step}`;
}

/** A record this beat OWES a story for: the planet's move, or the colony table's (Unity Budget). */
function isWorldStoryRecord(outcome: ParliamentEnactOutcomeModel): boolean {
  return isPlanetRecord(outcome) || isColonyTrackRecord(outcome);
}

/**
 * DETECT (pure): the PLANET and COLONY-TABLE records this response added to
 * the live phase — present in `after`, absent from `before` (same
 * generation). A world record names no seat and the winner's step names the
 * winner, and EVERY viewer detects both (the planet moved for all of them). A
 * first view (no `before`) or a new generation adds nothing: a reload replays
 * nothing.
 */
export function detectNewWorldMoves(before: PlayerViewModel | undefined, after: PlayerViewModel): Array<ParliamentEnactOutcomeModel> {
  const phase = phaseOf(after);
  const was = phaseOf(before);
  if (phase === undefined || was === undefined || was.generation !== phase.generation) {
    return [];
  }
  const known = new Set((was.outcomes ?? []).filter(isWorldStoryRecord).map(planetKey));
  return (phase.outcomes ?? []).filter((o) => isWorldStoryRecord(o) && !known.has(planetKey(o)));
}

/** A new sitting drops whatever the old one still owed. */
export function enterWorldBeatSitting(key: string): void {
  if (parliamentWorldBeatState.sitting === key) {
    return;
  }
  parliamentWorldBeatState.sitting = key;
  parliamentWorldBeatState.owed = [];
  parliamentWorldBeatState.away = false;
  parliamentWorldBeatState.hosting = false;
  parliamentWorldBeatState.receipt = undefined;
  parliamentWorldBeatState.receiptShowing = false;
}

/**
 * SEED — called from the reward ledger's own seeder, in the SAME synchronous
 * block as the view apply. Reduced motion owes the PLANET nothing: the scales
 * have already snapped and the results' planet line is the whole reading. The
 * COLONY TABLE is still owed its show — the wave plays its short form there
 * (the markers arrive in order, without impulses): a table that changed on a
 * screen the player never saw would be a silent move.
 */
export function seedWorldMoveBeat(before: PlayerViewModel | undefined, after: PlayerViewModel): void {
  const fresh = detectNewWorldMoves(before, after);
  const owed = consoleReducedMotionActive() ? fresh.filter(isColonyTrackRecord) : fresh;
  if (owed.length === 0) {
    return;
  }
  parliamentWorldBeatState.owed.push(...owed);
}

/** Does this sitting still owe the board a world move — or the colonies screen the table's? */
export function worldMoveOwed(sitting: string): boolean {
  return parliamentWorldBeatState.sitting === sitting && parliamentWorldBeatState.owed.length > 0;
}

/** Does this sitting still owe the COLONIES SCREEN the table's move (Unity Budget)? */
export function trackMoveOwed(sitting: string): boolean {
  return parliamentWorldBeatState.sitting === sitting && parliamentWorldBeatState.owed.some(isColonyTrackRecord);
}

/** Take the owed records `of` one family out of the list (the other family stays owed). */
function takeOwed(of: (outcome: ParliamentEnactOutcomeModel) => boolean): Array<ParliamentEnactOutcomeModel> {
  const taken = parliamentWorldBeatState.owed.filter(of);
  parliamentWorldBeatState.owed = parliamentWorldBeatState.owed.filter((o) => !of(o));
  return taken;
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
  const moves = takeOwed(isPlanetRecord);
  if (moves.length === 0) {
    return false;
  }
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

/**
 * THE SHOW STEP'S DOOR: the colonies frame pushed onto the Parliament by the
 * RECORD (no question asked), exactly as `openColoniesForPrompt` pushes it for
 * the winner's build — the host's phase is past its commit, the frame carries
 * no subject (the sitting's is the crumb's), its stage names the step, and it
 * serves nothing. The stack's registry (`frameSteps.colonies: 'embed'`) puts
 * it INTO the sitting's stage zone; the section's field opens for it through
 * `stepFrameNested` (the `hosting` term of `sittingFieldOf`).
 */
function openColoniesShowStep(): boolean {
  const depth = workspaceFrameIndex('parliament');
  if (depth === -1 || depth !== workspaceStackState.frames.length - 1) {
    return false;
  }
  setWorkspaceFramePhase('parliament', 'committed');
  pushWorkspaceFrame({
    kind: 'colonies', subject: '', stage: 'Colonies', phase: 'committed', serves: [],
    // A visit the LAW made: it leaves by the beat's own hand, never by a prompt's demand being met.
    anchor: {type: 'always'},
  });
  return true;
}

/** …and its own way out: the frame the show pushed pops, if it still stands on the Parliament. */
function closeColoniesShowStep(): void {
  const depth = workspaceFrameIndex('colonies');
  if (depth === -1 || depth !== workspaceStackState.frames.length - 1 || workspaceFrameHost('colonies') !== 'parliament') {
    return;
  }
  leaveWorkspace();
  consoleParliamentUi.stepFrameLeftAt = Date.now();
}

/**
 * RUN — the reward stage HOSTS the colonies screen, the wave rolls over every
 * track, the frame leaves by itself and the reward page owes one read of the
 * colonies line. Resolves once the frame is down (the section reads the
 * departure through `stepFrameNested` and re-queues its walk).
 *
 * Returns `false` when there was nothing to do. A show that cannot stand (the
 * Parliament is not the top frame, the record names no tile) is marked shown
 * all the same: every hold is released and the line still states the move —
 * a beat that cannot play is never a beat that repeats.
 */
export async function runTrackMoveBeat(sitting: string): Promise<boolean> {
  if (!trackMoveOwed(sitting)) {
    return false;
  }
  const moves = takeOwed(isColonyTrackRecord);
  const tiles = moves.flatMap((o) => o.tracks ?? []);
  const read = () => {
    parliamentWorldBeatState.receiptShowing = true;
  };
  if (tiles.length === 0) {
    // A table with no tile in play: nothing to show — the line names the skip.
    read();
    return true;
  }
  // HOLD every tile where it STOOD; the model already carries the after position.
  holdColonyTracks(tiles.map((tile) => ({colony: tile.colony, position: tile.before})));
  if (!openColoniesShowStep()) {
    releaseColonyTracks();
    read();
    return true;
  }
  parliamentWorldBeatState.hosting = true;
  try {
    await requestColonyTrackWave(tiles.map((tile) => ({colony: tile.colony, before: tile.before, after: tile.after})));
  } finally {
    releaseColonyTracks();
    parliamentWorldBeatState.hosting = false;
    read();
    closeColoniesShowStep();
  }
  return true;
}

export function resetParliamentWorldBeat(): void {
  parliamentWorldBeatState.sitting = '';
  parliamentWorldBeatState.owed = [];
  parliamentWorldBeatState.away = false;
  parliamentWorldBeatState.hosting = false;
  parliamentWorldBeatState.receipt = undefined;
  parliamentWorldBeatState.receiptShowing = false;
}
