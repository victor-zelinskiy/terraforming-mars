/*
 * THE WORLD'S PART — the CLIENT reading (Turmoil Redux, Gas Export RX12).
 *
 * `influenceYieldModel.ts` reads what the enactment pays the VIEWER,
 * `winnerRewardModel.ts` what it gives the WINNER; this module reads what it
 * does to the PLANET — the part that belongs to nobody and reaches everybody
 * (`IClientResolution.worldMoves`, the declaration `worldSteps` pays by).
 *
 * The moments are the winner reading's, for the same reason:
 *   reference   — no table at all (the menu's inspector, the stand's catalog):
 *                 the parameter and the declared steps, nothing more;
 *   conditional — the card is UP FOR THE VOTE: what the move would do to the
 *                 table AS IT STANDS («кислород 5 % → 4 %», or «кислород на
 *                 максимуме: не понижается») — never a promise about a
 *                 different table;
 *   pending     — the card is ENACTED and the phase is resolving it: the same
 *                 room, still to happen;
 *   applied     — the server RECORDED it (before / after, or the named skip):
 *                 history, never recomputed from today's table.
 *
 * THE ARITHMETIC IS NOT THIS MODULE'S: every «current → resulting» comes from
 * the shared `parameterRoom`, the one the winner's tile reads and the server's
 * own step reads. What this module adds is WHICH MOMENT the surface is in and
 * WHO was credited — which, for a law that says «no one gets the TR», is the
 * only thing the reading has to be loud about.
 *
 * Pure: no Vue, no DOM, no i18n (English keys and numbers).
 */
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {ParliamentEnactOutcomeModel} from '@/common/models/ParliamentModel';
import {
  ParameterMoveId, ParameterRoom, ParameterTable, WorldParameterMove, parameterMoveTr, parameterRoom,
} from '@/common/parliament/parameterMove';

export type WorldMoveContext = 'reference' | 'conditional' | 'pending' | 'applied';

/** ONE declared move of the planet, as the surface may state it right now. */
export type WorldMoveReading = {
  move: WorldParameterMove;
  parameter: ParameterMoveId;
  context: WorldMoveContext;
  /** conditional / pending: the room the move has on the LIVE table. */
  room?: ParameterRoom;
  /** applied: what the server recorded — the steps actually made (negative = lowered). */
  applied?: {before: number; after: number; steps: number};
  /** applied: the move did not happen — the server's own reason (an English key). */
  skipped?: string;
  /** Nobody is credited with a terraform rating for this move (the law's own clause). */
  unrewarded: boolean;
  /** The TR the move is worth to its mover — 0 for an unrewarded move and for every lowering. */
  tr: number;
};

export type WorldMoveTable = ParameterTable;

/** The WORLD records among a phase's outcomes — the ones that name no seat. */
export function worldOutcomesOf(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel> | undefined): Array<ParliamentEnactOutcomeModel> {
  return (outcomes ?? []).filter((o) => o.player === undefined && o.part === 'world');
}

/** The record of ONE declared move (matched by its parameter — a card never moves one parameter twice). */
function recordOf(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel>, parameter: ParameterMoveId): ParliamentEnactOutcomeModel | undefined {
  return outcomes.find((o) => o.parameter?.id === parameter);
}

/**
 * THE READING of a resolution's whole world part. `table` absent → `reference`
 * (nothing to measure against); `outcomes` carrying the world's records →
 * `applied` for the moves they name. Empty for a resolution that declares no
 * world part at all — a caller prints nothing rather than an empty block.
 */
export function worldMoveReadingOf(
  resolution: IClientResolution | undefined,
  table: WorldMoveTable | undefined,
  opts: {enacted?: boolean; outcomes?: ReadonlyArray<ParliamentEnactOutcomeModel>} = {},
): Array<WorldMoveReading> {
  const moves = resolution?.worldMoves ?? [];
  if (moves.length === 0) {
    return [];
  }
  const records = worldOutcomesOf(opts.outcomes);
  return moves.map((move) => {
    const head: WorldMoveReading = {
      move,
      parameter: move.parameter,
      context: 'reference',
      unrewarded: !move.terraformRating,
      tr: 0,
    };
    const record = recordOf(records, move.parameter);
    if (record !== undefined) {
      const applied: WorldMoveReading = {
        ...head,
        context: 'applied',
        unrewarded: record.unrewarded === true || !move.terraformRating,
        applied: {
          before: record.parameter?.before ?? 0,
          after: record.parameter?.after ?? 0,
          steps: record.amount ?? 0,
        },
      };
      // A skip is the record's own sentence; a move of 0 steps that named no
      // reason is still a skip, and the address's title names it.
      if (record.kind === 'skipped' || (record.amount ?? 0) === 0) {
        applied.skipped = record.reason ?? 'Skipped: the planet does not move';
      }
      return applied;
    }
    if (table === undefined) {
      return head;
    }
    const room = parameterRoom(move, table);
    return {...head, context: opts.enacted === true ? 'pending' : 'conditional', room, tr: parameterMoveTr(move, room)};
  });
}

/** Does the reading state a move that will NOT happen (the ceiling / the floor)? */
export function worldMoveBlocked(reading: WorldMoveReading): boolean {
  return reading.skipped !== undefined || (reading.room !== undefined && reading.room.atLimit);
}

/** The label key of a parameter — the ONE vocabulary every world reading prints. */
export function worldParameterLabelKey(parameter: ParameterMoveId): string {
  switch (parameter) {
  case 'oxygen': return 'Oxygen';
  case 'oceans': return 'Oceans';
  case 'venus': return 'Venus';
  case 'temperature': return 'Temperature';
  }
}

/** The unit suffix a parameter's numbers carry («5 %», «−30 °C», a bare count of oceans). */
export function worldParameterUnit(parameter: ParameterMoveId): string {
  switch (parameter) {
  case 'oxygen':
  case 'venus': return '%';
  case 'temperature': return '°C';
  case 'oceans': return '';
  }
}

/**
 * ONE reading as a SENTENCE — «кислород 5 % → 4 %» / «кислород на максимуме:
 * не понижается» / «Венера 10 % → 14 %, РТ никому». The caption names WHEN the
 * move applies; the detail is the numbers and the credit.
 *
 * The «no one is credited» clause is part of the DETAIL on purpose: it is what
 * makes this move different from every other terraforming on the table, and a
 * player who reads only the arrow would otherwise expect a rating.
 */
export function worldMoveSentenceOf(
  reading: WorldMoveReading,
  t: {text: (key: string) => string, params: (key: string, params: Array<string>) => string},
): {caption: string, detail: string} {
  const name = t.text(worldParameterLabelKey(reading.parameter));
  const unit = worldParameterUnit(reading.parameter);
  const caption = name;
  if (reading.skipped !== undefined) {
    return {caption, detail: t.text(reading.skipped)};
  }
  const range = reading.applied ?? (reading.room === undefined ? undefined : {before: reading.room.current, after: reading.room.resulting, steps: reading.room.applied});
  if (range === undefined) {
    // No table to measure against: the DECLARATION alone — «−1 шаг» / «+2 шага».
    return {caption, detail: t.params(reading.move.steps < 0 ? 'lowered ${0} step(s)' : 'raised ${0} step(s)', [String(Math.abs(reading.move.steps))])};
  }
  if (range.steps === 0) {
    return {caption, detail: t.text(reading.move.steps < 0 ? 'at its limit — no step' : 'at its maximum — no step')};
  }
  const parts = [t.params('${0}${2} → ${1}${2}', [String(range.before), String(range.after), unit])];
  if (reading.unrewarded) {
    parts.push(t.text('nobody gets the TR'));
  } else if (reading.tr > 0) {
    parts.push(t.params('TR +${0}', [String(reading.tr)]));
  }
  return {caption, detail: parts.join(', ')};
}
