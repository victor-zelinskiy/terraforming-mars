/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE ASSEMBLY SCENE — the PURE plan of «one press drew from several places,
 * and the player takes it all at once» («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР», Ф3 of
 * the card-intake law, 2026-10-26; contract `docs/claude/console/
 * card-intake-one-batch.md`). No DOM, no GSAP — unit-tested under the server
 * runner like `consoleCardArrival` / `deckDrawModel`.
 *
 * ── WHAT THE PLAYER SEES ───────────────────────────────────────────────────
 * A merged batch is ONE row of slots, filled RUN BY RUN in the server's order
 * (the order of the rules — never re-sorted): the played card's own cards
 * come off the deck; the CELL its tile landed on lets its card go; then the
 * card that answered the play (the Olympus Conference, the Mars University)
 * SURFACES beside the row — a real face, the one the player knows — and
 * deals its card from its own printed draw icon; it recedes once its card
 * has landed, and the next cause takes its turn. The row assembles into one
 * frame, one head naming every cause with its share, one take.
 *
 * ── THE ORIGINS (R7: a run starts from ITS OWN place) ──────────────────────
 *  deck        the HUD project deck — the batch's own draw when the card that
 *              drew is already STANDING on the stage (the hero of the play /
 *              the action), and every cause the fork has no better place for
 *              (a colony's bonus off a ledger that is not on screen, a scale,
 *              an Agenda step, a party, a law, an unattributed run).
 *  card        the TRIGGER CARD surfaces beside the row and deals from its
 *              printed draw icon — a card's run whose card is NOT the one on
 *              stage (a table hook answering the press).
 *  board-cell  the cell's printed card bonus — a tile run while the board is
 *              VISIBLE (the standalone scene after a landing). Covered board →
 *              `deck`, honestly (the L3 peek of the source cell is the next
 *              iteration; a run never waits in a park of its own, R7).
 *
 * ── THE CADENCE ────────────────────────────────────────────────────────────
 * Runs are SEQUENTIAL with a small overlap: the next run's first card leaves
 * shortly before the previous run's last card touches down, so the row keeps
 * filling without a dead beat and without two causes dealing at once (the
 * eye must attribute every card). A trigger surfaces `surfaceMs` + `holdMs`
 * BEFORE its run deals, and recedes `recedeMs` after its last landing.
 * Everything is BASE milliseconds — the director resolves through motionMs().
 */
import {CardName} from '@/common/cards/CardName';
import {CardDrawRevealSource, CardIntakeSegment} from '@/common/models/CardDrawRevealModel';
import {CardArrivalTimings, planCardArrival} from '@/client/console/consoleCardArrival';

export type IntakeOrigin =
  | {kind: 'deck'}
  | {kind: 'card', card: CardName}
  | {kind: 'board-cell', spaceId: string};

export type IntakeRun = {
  /** The run's ordinal in the batch (the segment's index). */
  index: number;
  /** The segment's source, as the server named it. */
  source: CardDrawRevealSource | undefined;
  origin: IntakeOrigin;
  /** Why a cause that HAS a place of its own starts from the deck instead. */
  degraded?: 'on-stage' | 'board-covered' | 'no-place';
  /** The first card of the run in the batch's `cards`, and how many. */
  first: number;
  count: number;
  /** When the run's TRIGGER surfaces (a `card` origin only) — base ms from the scene's start. */
  surfaceAtMs?: number;
  /** When the run's first card leaves its origin. */
  dealAtMs: number;
  /** When the run's last card has touched down and settled. */
  settledAtMs: number;
  /** When the trigger recedes (a `card` origin only). */
  recedeAtMs?: number;
};

export type IntakeAssemblyPlan = {
  runs: ReadonlyArray<IntakeRun>;
  /** The last run has settled (and its trigger has receded). */
  totalMs: number;
};

export type IntakeAssemblyTimings = {
  /** The trigger card surfaces beside the row. */
  surfaceMs: number;
  /** …and stands a beat before its icon deals (the eye reads WHICH card). */
  holdMs: number;
  /** The trigger recedes after its last card landed. */
  recedeMs: number;
  /** The next run's first card leaves this long BEFORE the previous run's last landing. */
  overlapMs: number;
};

export function intakeAssemblyTimings(): IntakeAssemblyTimings {
  return {surfaceMs: 260, holdMs: 150, recedeMs: 220, overlapMs: 140};
}

/** Reduced motion: crossfades, short — never a pop (JS durations ≤ 160 ms). */
export function reducedIntakeAssemblyTimings(): IntakeAssemblyTimings {
  return {surfaceMs: 140, holdMs: 60, recedeMs: 120, overlapMs: 60};
}

export type IntakeAssemblyInput = {
  segments: ReadonlyArray<CardIntakeSegment>;
  /**
   * The card already STANDING on the stage the batch presents in (the hero of a play, the action composer's
   * source card) — its own run comes off the deck; a surfaced copy would be two of the same card.
   */
  stageCard?: CardName | string;
  /** Is the board (and the cell a tile segment names) on screen and measurable right now? */
  boardVisible: boolean;
};

/** Is this batch the assembly scene's — more than one cause to show? (A one-cause batch keeps its family's scene.) */
export function intakeAssemblyOwnsBatch(batch: {segments?: ReadonlyArray<{count: number}>} | undefined): boolean {
  return batch !== undefined && batch.segments !== undefined && batch.segments.length > 1;
}

/**
 * THE SEARCH RUN of a merged batch (R4 — «a search is a segment, not a batch of its own»): exactly ONE segment carries
 * a tape with discards (a conditional search that threw cards away) and every other run is plain. The deck layer then
 * plays that run as the SEARCH THEATRE on its own tape — every card judged in turn, the rejects onto the pile, the
 * finds held and assembled into the run's own slots — while the runs before and after it come from their own places
 * through the assembly. `first` / `count` index the batch's cards, `steps` the tape (finds + rejects). Undefined for a
 * one-cause batch (its family's own scene), a merged batch with no discards (plain runs), or two searches in one
 * press (the batch-level tape stays the honest fallback).
 */
export function intakeSearchRun(batch: {segments?: ReadonlyArray<CardIntakeSegment>} | undefined): {index: number, first: number, count: number, steps: number} | undefined {
  if (!intakeAssemblyOwnsBatch(batch) || batch?.segments === undefined) {
    return undefined;
  }
  const searches = batch.segments
    .map((segment, index) => ({segment, index}))
    .filter(({segment}) => segment.sequence !== undefined && segment.sequence.some((step) => !step.matched));
  if (searches.length !== 1) {
    return undefined;
  }
  const {segment, index} = searches[0];
  let first = 0;
  for (let i = 0; i < index; i++) {
    first += Math.max(0, Math.floor(batch.segments[i].count));
  }
  return {index, first, count: segment.count, steps: segment.sequence?.length ?? 0};
}

/** WHERE a segment's run starts (R7 + the degrade table in the header). */
export function intakeOriginOf(segment: CardIntakeSegment, input: Pick<IntakeAssemblyInput, 'stageCard' | 'boardVisible'>): {origin: IntakeOrigin, degraded?: IntakeRun['degraded']} {
  const source = segment.source;
  if (source?.type === 'card') {
    if (input.stageCard !== undefined && input.stageCard !== '' && source.cardName === input.stageCard) {
      return {origin: {kind: 'deck'}, degraded: 'on-stage'};
    }
    return {origin: {kind: 'card', card: source.cardName}};
  }
  if (source?.type === 'tile' && source.spaceId !== undefined) {
    return input.boardVisible ?
      {origin: {kind: 'board-cell', spaceId: source.spaceId}} :
      {origin: {kind: 'deck'}, degraded: 'board-covered'};
  }
  return source === undefined ? {origin: {kind: 'deck'}} : {origin: {kind: 'deck'}, degraded: 'no-place'};
}

/** The whole choreography of one merged batch. */
export function planIntakeAssembly(input: IntakeAssemblyInput, arrival: CardArrivalTimings, t: IntakeAssemblyTimings): IntakeAssemblyPlan {
  const runs: Array<IntakeRun> = [];
  let first = 0;
  let cursorMs = 0;
  let prevSettledMs = 0;
  input.segments.forEach((segment, index) => {
    const count = Math.max(0, Math.floor(segment.count));
    if (count === 0) {
      return;
    }
    const {origin, degraded} = intakeOriginOf(segment, input);
    const flight = planCardArrival(count, arrival, 'in-flight-reveal');
    const run: IntakeRun = {index, source: segment.source, origin, first, count, dealAtMs: 0, settledAtMs: 0};
    if (degraded !== undefined) {
      run.degraded = degraded;
    }
    // The run starts where the previous one is about to finish (the overlap keeps the row filling), never before
    // the scene's start.
    const startMs = runs.length === 0 ? 0 : Math.max(cursorMs, prevSettledMs - t.overlapMs);
    if (origin.kind === 'card') {
      run.surfaceAtMs = startMs;
      run.dealAtMs = startMs + t.surfaceMs + t.holdMs;
    } else {
      run.dealAtMs = startMs;
    }
    run.settledAtMs = run.dealAtMs + flight.totalMs;
    if (origin.kind === 'card') {
      run.recedeAtMs = run.settledAtMs;
    }
    runs.push(run);
    first += count;
    cursorMs = run.dealAtMs;
    prevSettledMs = run.settledAtMs;
  });
  const totalMs = runs.reduce((max, run) => Math.max(max, run.recedeAtMs !== undefined ? run.recedeAtMs + t.recedeMs : run.settledAtMs), 0);
  return {runs, totalMs};
}

export type RectLike = {left: number, top: number, width: number, height: number};

/** The union box of the row's slots. */
export function rowRectOf(slots: ReadonlyArray<RectLike>): RectLike | undefined {
  if (slots.length === 0) {
    return undefined;
  }
  const left = Math.min(...slots.map((r) => r.left));
  const top = Math.min(...slots.map((r) => r.top));
  const right = Math.max(...slots.map((r) => r.left + r.width));
  const bottom = Math.max(...slots.map((r) => r.top + r.height));
  return {left, top, width: right - left, height: bottom - top};
}

/**
 * WHERE THE TRIGGER CARD SURFACES — a seat beside the row, inside the stage, never over a slot: to the LEFT of the
 * row when there is room, else to the RIGHT, else ABOVE it (centred), else the stage's top-left corner at a
 * reduced size. The seat is a card-shaped box of the row's height (slightly smaller — the trigger is a cause, the
 * row is the subject). Pure, so the degradation order is a tested fact.
 */
export function triggerSeatRect(stage: RectLike, row: RectLike, aspect = 460 / 320): RectLike {
  const pad = Math.max(8, stage.width * 0.012);
  const gap = Math.max(10, row.height * 0.08);
  let height = row.height * 0.92;
  let width = height / aspect;
  const top = row.top + (row.height - height) / 2;
  const leftSeat = row.left - gap - width;
  if (leftSeat >= stage.left + pad) {
    return {left: leftSeat, top, width, height};
  }
  const rightSeat = row.left + row.width + gap;
  if (rightSeat + width <= stage.left + stage.width - pad) {
    return {left: rightSeat, top, width, height};
  }
  const aboveTop = row.top - gap - height;
  if (aboveTop >= stage.top + pad) {
    return {left: row.left + row.width / 2 - width / 2, top: aboveTop, width, height};
  }
  height = Math.min(height, stage.height * 0.3);
  width = height / aspect;
  return {left: stage.left + pad, top: stage.top + pad, width, height};
}
