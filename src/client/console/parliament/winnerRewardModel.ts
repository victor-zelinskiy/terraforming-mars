/*
 * THE WINNER'S PART — the CLIENT reading (Turmoil Redux).
 *
 * `influenceYieldModel.ts` turns everyone's influence-scaled part into the
 * viewer's number; this module turns the WINNER's tile (`IClientResolution
 * .winnerReward` — the declaration the winner's step places) into what a
 * surface may honestly say about it, for the moment the surface stands in:
 *
 *   reference   — no table at all (the menu's inspector, the playground's
 *                 catalog): the tile and its one parameter step, nothing more;
 *   conditional — the card is UP FOR THE VOTE: «if you win» — the tile and
 *                 what its own placement would do to the table AS IT STANDS
 *                 (oxygen 7 → 8 %, or «at its maximum — no step»; the TR it
 *                 is worth) — never a recipient, never a promise;
 *   pending     — the card is ENACTED and the phase is resolving it: the
 *                 recipient is FIXED (the winner of record), the tile is
 *                 still to come;
 *   applied     — the server RECORDED what happened (the parameter before and
 *                 after, or the named skip) — from a finished phase with that
 *                 phase's generation: history, never recomputed from today's
 *                 table.
 * A NEUTRAL winner is a final reading of its own (`recipient: 'neutral'`):
 * nobody places anything, and the surface says so rather than going blank.
 *
 * The CELL is never named before it is chosen: its bonuses, its adjacency
 * and the reactions it sets off are the placement dossier's. Pure: no Vue, no
 * DOM, no i18n — English keys and numbers; `ConsoleWinnerReward.vue` renders.
 */
import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {ParliamentEnactOutcomeModel, ParliamentModel} from '@/common/models/ParliamentModel';
import {resolutionIdOf} from '@/common/parliament/ParliamentTypes';
import {
  WinnerParameterRoom, winnerParameterRoom, WinnerRewardDeclaration, WinnerRewardParameter, winnerRewardParameter, WinnerRewardTable,
  WinnerRewardTr, winnerRewardTr,
} from '@/common/parliament/winnerReward';

export type WinnerRewardContext = 'reference' | 'conditional' | 'pending' | 'applied';

export type WinnerRewardReading = {
  reward: WinnerRewardDeclaration;
  context: WinnerRewardContext;
  parameter: WinnerRewardParameter;
  /** conditional / pending: the parameter's room on the LIVE table. */
  room?: WinnerParameterRoom;
  /** The TR the tile is worth — live (conditional / pending) or as it landed (applied). */
  tr?: WinnerRewardTr;
  /** pending / applied: who places it — a seat's colour, or 'neutral' (nobody does). */
  recipient?: Color | 'neutral';
  /** applied: the tile landed — the parameter as the server read it before and after. */
  placed?: {space?: SpaceId; before: number; after: number};
  /** applied: the part did not happen — the server's reason (English key). */
  skipped?: string;
  /** applied from a FINISHED phase: the generation whose phase it was. */
  generation?: number;
};

/** The table the reading needs, straight off the game model. */
export function winnerRewardTableOf(game: {oxygenLevel: number, temperature: number, oceans: number} | undefined): WinnerRewardTable | undefined {
  return game === undefined ? undefined : {oxygenLevel: game.oxygenLevel, temperature: game.temperature, oceans: game.oceans};
}

/**
 * The winner's record among a phase's outcomes: the step the driver stamped
 * `part: 'winner'` — or, on a save from before that stamp, the winner tile's
 * own kind (a skip without the stamp cannot be attributed and is not guessed).
 */
export function winnerOutcomeOf(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel> | undefined): ParliamentEnactOutcomeModel | undefined {
  return outcomes?.find((o) => o.part === 'winner') ??
    outcomes?.find((o) => o.part === undefined && (o.kind === 'ocean' || o.kind === 'greenery'));
}

function appliedReading(
  reward: WinnerRewardDeclaration,
  recipient: Color | 'neutral',
  outcome: ParliamentEnactOutcomeModel | undefined,
  generation?: number,
): WinnerRewardReading | undefined {
  const parameter = winnerRewardParameter(reward);
  const base: WinnerRewardReading = {reward, context: 'applied', parameter, recipient, ...(generation === undefined ? {} : {generation})};
  if (recipient === 'neutral') {
    return base;
  }
  if (outcome === undefined) {
    return undefined;
  }
  if (outcome.kind === 'skipped') {
    return {...base, skipped: outcome.reason ?? 'Skipped'};
  }
  const recorded = outcome.parameter;
  if (recorded === undefined) {
    // An older record: the tile landed, its parameter reading was not kept.
    return {...base, placed: {space: outcome.space, before: 0, after: 0}};
  }
  const rose = recorded.after > recorded.before;
  return {
    ...base,
    placed: {space: outcome.space, before: recorded.before, after: recorded.after},
    // The TR the tile brought, by the same rule the live reading uses — the
    // tile's own and the step it ACTUALLY made (the 8 % step is the journal's).
    tr: winnerRewardTr(reward, {rises: rose, tileAvailable: true, temperatureBonus: false}),
  };
}

/**
 * The reading of `resolution`'s winner part for the table `model` describes
 * (and its global parameters, `table`). Undefined for a resolution with no
 * declared winner tile — a surface then draws nothing for it.
 */
export function winnerRewardReadingOf(
  resolution: IClientResolution | undefined,
  model: ParliamentModel | undefined,
  table: WinnerRewardTable | undefined,
): WinnerRewardReading | undefined {
  const reward = resolution?.winnerReward;
  if (resolution === undefined || reward === undefined) {
    return undefined;
  }
  const parameter = winnerRewardParameter(reward);
  if (model === undefined || table === undefined) {
    return {reward, context: 'reference', parameter};
  }
  const live = (): Pick<WinnerRewardReading, 'room' | 'tr'> => {
    const room = winnerParameterRoom(reward, table);
    return {room, tr: winnerRewardTr(reward, room)};
  };
  // 1. The phase is resolving THIS card right now: the recipient is fixed.
  const phase = model.phase;
  const phaseWinner = phase?.winner;
  if (phase !== undefined && phaseWinner !== undefined && resolutionIdOf(phaseWinner.instance) === resolution.id) {
    const recipient = phaseWinner.player ?? 'neutral';
    const applied = appliedReading(reward, recipient, winnerOutcomeOf(phase.outcomes));
    return applied ?? {reward, context: 'pending', parameter, recipient, ...live()};
  }
  // 2. The last FINISHED phase enacted it: its record, as history.
  const last = model.lastPhase;
  if (last !== undefined && last.enacted.resolution === resolution.id) {
    const applied = appliedReading(reward, last.winner.player ?? 'neutral', winnerOutcomeOf(last.outcomes), last.generation);
    if (applied !== undefined) {
      return applied;
    }
  }
  // 3. Up for the vote: conditional — what the tile would do to the table now.
  if (model.slots.some((slot) => slot.resolution === resolution.id)) {
    return {reward, context: 'conditional', parameter, ...live()};
  }
  // 4. Enacted long ago, or off the table: the rule alone.
  return {reward, context: 'reference', parameter};
}

/**
 * The ONE qualification sentence the inspector adds under the winner's block —
 * the detailed reading of the face's tile symbol (English key), or none where
 * the tile follows the base rules untouched.
 */
export function winnerRewardRuleKey(reward: WinnerRewardDeclaration): string | undefined {
  return reward.tile === 'greenery' ?
    'The greenery pays 1 TR for the tile itself and 1 TR for the oxygen step; with oxygen at its maximum, only the tile\'s TR.' :
    undefined;
}

/**
 * The winner's part for the viewer IN WORDS — the inspector's «for you» row,
 * built from the very reading the chip draws (so the two can never disagree):
 * the moment (caption), then what the tile's own placement does to its
 * parameter and the TR it is worth, broken down. Display strings (already
 * translated by the injected functions); undefined off the table.
 */
export function winnerRewardSentenceOf(
  reading: WinnerRewardReading,
  viewer: Color | undefined,
  nameOf: (color: Color) => string,
  t: {text: (key: string) => string, params: (key: string, params: Array<string>) => string},
): {caption: string, detail: string} | undefined {
  const caption = winnerRewardCaptionOf(reading, viewer, nameOf);
  if (caption === undefined) {
    return undefined;
  }
  const captionText = caption.params === undefined ? t.text(caption.key) : t.params(caption.key, [...caption.params]);
  const lead = reading.generation === undefined ? captionText : `${t.params('Generation ${0}', [String(reading.generation)])} · ${captionText}`;
  if (reading.skipped !== undefined || reading.recipient === 'neutral') {
    return {caption: lead, detail: ''};
  }
  const range = reading.placed !== undefined && (reading.placed.before !== 0 || reading.placed.after !== 0) ?
    {from: reading.placed.before, to: reading.placed.after} :
    reading.room === undefined ? undefined : {from: reading.room.current, to: reading.room.resulting};
  const parts: Array<string> = [];
  if (reading.room !== undefined && !reading.room.tileAvailable) {
    parts.push(t.text('No ocean tile is left'));
  } else if (range !== undefined) {
    if (range.to > range.from) {
      parts.push(reading.parameter === 'oxygen' ?
        t.params('oxygen ${0} → ${1} %', [String(range.from), String(range.to)]) :
        t.params('oceans ${0} → ${1}', [String(range.from), String(range.to)]));
    } else if (reading.parameter === 'oxygen') {
      parts.push(t.text('oxygen at its maximum — no step'));
    }
  }
  const tr = reading.tr;
  if (tr !== undefined && tr.tile + tr.parameter + tr.temperature > 0) {
    const terms: Array<string> = [];
    if (tr.tile > 0) {
      terms.push(`${t.text('for the tile')} +${tr.tile}`);
    }
    if (tr.parameter > 0) {
      terms.push(`${t.text(reading.parameter === 'oxygen' ? 'for oxygen' : 'for oceans')} +${tr.parameter}`);
    }
    if (tr.temperature > 0) {
      terms.push(`${t.text('for temperature')} +${tr.temperature}`);
    }
    const total = t.params('TR +${0}', [String(tr.tile + tr.parameter + tr.temperature)]);
    parts.push(terms.length > 1 || tr.tile > 0 ? `${total} (${terms.join(', ')})` : total);
  }
  return {caption: lead, detail: parts.join('; ')};
}

/** The tile's own name (English key). */
export function winnerTileLabelKey(reward: WinnerRewardDeclaration): string {
  return reward.tile === 'greenery' ? 'Greenery' : 'Ocean';
}

/** The parameter's own name (English key). */
export function winnerParameterLabelKey(parameter: WinnerRewardParameter): string {
  return parameter === 'oxygen' ? 'Oxygen' : 'Oceans';
}

/**
 * The CAPTION of a reading — WHICH question it answers, as an English key
 * with its params: «if you win», «you place it», «placed by X», «neutral
 * winner», a skip's reason. `nameOf` resolves a seat's display name.
 */
export function winnerRewardCaptionOf(
  reading: WinnerRewardReading,
  viewer: Color | undefined,
  nameOf: (color: Color) => string,
): {key: string, params?: ReadonlyArray<string>} | undefined {
  switch (reading.context) {
  case 'reference':
    return undefined;
  case 'conditional':
    return {key: 'If you win'};
  case 'pending':
    if (reading.recipient === 'neutral' || reading.recipient === undefined) {
      return {key: 'Neutral winner — nobody places it'};
    }
    return reading.recipient === viewer ? {key: 'You place it'} : {key: 'Placed by ${0}', params: [nameOf(reading.recipient)]};
  case 'applied':
    if (reading.recipient === 'neutral' || reading.recipient === undefined) {
      return {key: 'Neutral winner — nobody places it'};
    }
    if (reading.skipped !== undefined) {
      return {key: reading.skipped};
    }
    return reading.recipient === viewer ? {key: 'You placed it'} : {key: 'Placed · ${0}', params: [nameOf(reading.recipient)]};
  }
}
