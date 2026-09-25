/*
 * THE TILE GRANT's READING (Turmoil Redux — Skyscrapers, RX20): ONE model for
 * every surface that must say, of a tile granted BY THRESHOLD, «do I get it,
 * where does it go, and what happened» — the vote surface's own-effect block,
 * the fullscreen inspector's footer and its «for you» row, the sitting's band,
 * the playground. The twin of `winnerRewardModel.ts` (the winner's part), in
 * the same four moments:
 *
 *   reference   — off the table, or no seat: the rule alone;
 *   conditional — the card is UP FOR THE VOTE and the viewer is seated: their
 *                 eligibility by their influence NOW («at influence 2 it is
 *                 yours, win or not» / «only if you win»), and the DESTINATIONS
 *                 the server counts for them (their cities on Mars — a zero is
 *                 the honest «nothing lands»);
 *   pending     — the phase is resolving THIS card and the viewer's record is
 *                 not in yet: the eligibility is FIXED (the recorded winner,
 *                 the influence after the Agenda step);
 *   applied     — the viewer's own record: the cell and the stack it became,
 *                 or the named skip — as the phase runs, or from a finished
 *                 phase with that phase's generation.
 *
 * Nothing here decides a rule: eligibility is `tileGrantEligibility` (the
 * common predicate the step pays by), the destinations are the SERVER's count
 * (`marsCities`, by `tileGrantCountId`), the record is the server's own. The
 * cell's own worth (its greeneries, the stack's VP) is the placement dossier's
 * reading, never promised here.
 */
import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {resolutionIdOf} from '@/common/parliament/ParliamentTypes';
import {TileGrantDeclaration, TileGrantEligibility, tileGrantCountId, tileGrantEligibility, tileGrantStepKey} from '@/common/parliament/tileGrant';

export type TileGrantContext = 'reference' | 'conditional' | 'pending' | 'applied';

export type TileGrantReading = {
  grant: TileGrantDeclaration;
  context: TileGrantContext;
  /**
   * The viewer's eligibility BY THE RULE — conditional: as a non-winner at their influence now (the win
   * itself is unconditional); pending / applied: as the phase fixed it (the recorded winner, the influence
   * after the Agenda step).
   */
  eligibility?: TileGrantEligibility;
  /** The influence the eligibility was read at. */
  influence?: number;
  /**
   * The viewer's DESTINATIONS — their cities on Mars, the server's own count (a cell once, whatever its
   * stack). Absent when the model carries no count (an older save); 0 is «nothing to build on».
   */
  cities?: number;
  /** applied: the tier landed — the cell and the stack it became (as the server recorded them). */
  placed?: {space?: SpaceId, stackHeight?: number};
  /** applied: the part did not happen — the server's reason (an English key). */
  skipped?: string;
  /** applied from a FINISHED phase: the generation whose phase it was. */
  generation?: number;
};

function seatOf(model: ParliamentModel | undefined, viewer: Color | undefined): ParliamentPlayerModel | undefined {
  if (model === undefined || viewer === undefined) {
    return undefined;
  }
  const seat = model.players.find((p) => p.color === viewer);
  return seat !== undefined && seat.participates ? seat : undefined;
}

/**
 * The viewer's record of the grant's step — the tile (`city`) or the step's
 * own skip. Matched by the STEP KEY the declaration derives (`tileGrantStepKey`),
 * never by position: the ruling party's reaction shares the seat and the
 * step, and a scaled part's skip would share the seat.
 */
export function tileGrantOutcomeOf(
  grant: TileGrantDeclaration,
  outcomes: ReadonlyArray<ParliamentEnactOutcomeModel> | undefined,
  viewer: Color,
): ParliamentEnactOutcomeModel | undefined {
  const step = tileGrantStepKey(grant);
  return outcomes?.find((o) => o.player === viewer && o.step === step && o.kind !== 'reaction');
}

function appliedReading(
  head: {grant: TileGrantDeclaration, cities?: number},
  record: ParliamentEnactOutcomeModel,
  winner: Color | 'neutral' | undefined,
  seatInfluence: number,
  generation?: number,
): TileGrantReading {
  const influence = record.influence ?? seatInfluence;
  const base: TileGrantReading = {
    ...head,
    context: 'applied',
    eligibility: tileGrantEligibility(head.grant, {winner: winner !== undefined && winner !== 'neutral' && winner === record.player, influence}),
    influence,
    ...(generation === undefined ? {} : {generation}),
  };
  if (record.kind === 'skipped') {
    return {...base, skipped: record.reason ?? 'Skipped: the city tile'};
  }
  return {
    ...base,
    placed: {...(record.space === undefined ? {} : {space: record.space}), ...(record.stackHeight === undefined ? {} : {stackHeight: record.stackHeight})},
  };
}

export function tileGrantReadingOf(
  resolution: IClientResolution | undefined,
  model: ParliamentModel | undefined,
  viewer: Color | undefined,
): TileGrantReading | undefined {
  const grant = resolution?.tileGrant;
  if (resolution === undefined || grant === undefined) {
    return undefined;
  }
  const seat = seatOf(model, viewer);
  if (model === undefined || seat === undefined) {
    return {grant, context: 'reference'};
  }
  const count = seat.counts?.find((c) => c.id === tileGrantCountId(grant));
  const head = {grant, ...(count === undefined ? {} : {cities: count.count})};
  // 1. The phase is resolving THIS card right now: the winner is fixed, the influence is the phase's.
  const phase = model.phase;
  const phaseWinner = phase?.winner;
  if (phase !== undefined && phaseWinner !== undefined && resolutionIdOf(phaseWinner.instance) === resolution.id) {
    const record = tileGrantOutcomeOf(grant, phase.outcomes, seat.color);
    if (record !== undefined) {
      return appliedReading(head, record, phaseWinner.player, seat.influence);
    }
    return {
      ...head,
      context: 'pending',
      eligibility: tileGrantEligibility(grant, {winner: phaseWinner.player === seat.color, influence: seat.influence}),
      influence: seat.influence,
    };
  }
  // 2. The last FINISHED phase enacted it: the viewer's record, as history.
  const last = model.lastPhase;
  if (last !== undefined && last.enacted.resolution === resolution.id) {
    const record = tileGrantOutcomeOf(grant, last.outcomes, seat.color);
    if (record !== undefined) {
      return appliedReading(head, record, last.winner.player, seat.influence, last.generation);
    }
  }
  // 3. Up for the vote: conditional — the viewer's standing as a NON-winner (the win itself is unconditional).
  if (model.slots.some((slot) => slot.resolution === resolution.id)) {
    return {
      ...head,
      context: 'conditional',
      eligibility: tileGrantEligibility(grant, {winner: false, influence: seat.influence}),
      influence: seat.influence,
    };
  }
  // 4. Enacted long ago, or off the table: the rule alone.
  return {grant, context: 'reference'};
}

/**
 * The ONE qualification sentence the inspector adds under the effect — the
 * detailed reading of the face's «STACK» row (an English key): what a tier
 * IS for the score, and that a seat with no city gains nothing.
 */
export const TILE_GRANT_RULE_KEY = 'Each city in the stack scores its adjacent greeneries separately. The cell pays no placement bonus again. A player with no city on Mars gains nothing.';

/** The grant's own name (English key): the tile granted. */
export function tileGrantLabelKey(grant: TileGrantDeclaration): string {
  switch (grant.tile) {
  case 'city': return 'City tile';
  }
}

/** WHERE it lands (English key): the destination the declaration names. */
export function tileGrantWhereKey(grant: TileGrantDeclaration): string {
  switch (grant.placement) {
  case 'own-city': return 'on top of your own city on Mars';
  }
}

/** WHO receives it (English key with its param — the influence line): the head's label. */
export function tileGrantRecipientsKey(grant: TileGrantDeclaration): {key: string, params: ReadonlyArray<string>} {
  return {key: 'For the winner of the vote and everyone at influence ${0} or more', params: [String(grant.recipients.influenceAtLeast)]};
}

/**
 * The CAPTION of a reading — WHICH question it answers, as an English key with
 * its params: the viewer's standing at the vote, the fixed answer while the
 * phase resolves, the record once it is in. Undefined off the table.
 */
export function tileGrantCaptionOf(reading: TileGrantReading): {key: string, params?: ReadonlyArray<string>} | undefined {
  const line = String(reading.grant.recipients.influenceAtLeast);
  const influence = String(reading.influence ?? 0);
  switch (reading.context) {
  case 'reference':
    return undefined;
  case 'conditional':
    return reading.eligibility === 'influence' ?
      {key: 'Yours at influence ${0} — win or not', params: [influence]} :
      {key: 'Only if you win — influence ${0} is below ${1}', params: [influence, line]};
  case 'pending':
    switch (reading.eligibility) {
    case 'winner': return {key: 'You place it — the winner of the vote'};
    case 'influence': return {key: 'You place it — influence ${0}', params: [influence]};
    default: return {key: 'Not yours — influence ${0} is below ${1} and you did not win', params: [influence, line]};
    }
  case 'applied':
    if (reading.skipped !== undefined) {
      return {key: reading.skipped};
    }
    return reading.eligibility === 'winner' ?
      {key: 'You placed it — the winner of the vote'} :
      {key: 'You placed it — influence ${0}', params: [influence]};
  }
}

/**
 * THE DETAIL beside the caption — the destinations while the tile is still to
 * come («your cities on Mars: 2», or the honest «no city on Mars to build on»),
 * the stack once it landed («a stack of 2»). English key + params; undefined
 * when there is nothing to add.
 */
export function tileGrantDetailOf(reading: TileGrantReading): {key: string, params?: ReadonlyArray<string>} | undefined {
  if (reading.context === 'applied') {
    const stack = reading.placed?.stackHeight;
    return reading.skipped !== undefined || stack === undefined ? undefined : {key: 'a stack of ${0}', params: [String(stack)]};
  }
  if (reading.context === 'reference' || reading.cities === undefined) {
    return undefined;
  }
  return reading.cities === 0 ? {key: 'No city on Mars to build on'} : {key: 'your cities on Mars: ${0}', params: [String(reading.cities)]};
}

/**
 * The reading IN WORDS, for the inspector's «for you» row — built from the
 * very reading the chip draws, so the two can never disagree. Display strings
 * (translated by the injected functions); undefined off the table.
 */
export function tileGrantSentenceOf(
  reading: TileGrantReading,
  t: {text: (key: string) => string, params: (key: string, params: Array<string>) => string},
): {caption: string, detail: string} | undefined {
  const caption = tileGrantCaptionOf(reading);
  if (caption === undefined) {
    return undefined;
  }
  const say = (part: {key: string, params?: ReadonlyArray<string>}) => part.params === undefined ? t.text(part.key) : t.params(part.key, [...part.params]);
  const lead = reading.generation === undefined ? say(caption) : `${t.params('Generation ${0}', [String(reading.generation)])} · ${say(caption)}`;
  const detail = tileGrantDetailOf(reading);
  return {caption: lead, detail: detail === undefined ? '' : say(detail)};
}
