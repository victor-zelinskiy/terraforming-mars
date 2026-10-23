/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CAREER GRANT's READING (Turmoil Redux — Reds Budget RX39: «each player
 * advances their Agenda marker 1 step»): ONE model for every surface that must
 * say, of a step of the Career a law grants the seats, «what does MY next step
 * give, and what did it give» — the vote panel's own-effect block, the
 * inspector, the sitting's results, the playground. The twin of
 * `tileGrantModel.ts` (the tile a law grants), in the same four moments:
 *
 *   reference   — off the table, or no seat: the rule alone;
 *   conditional — the card is UP FOR THE VOTE and the viewer is seated: where
 *                 their marker stands NOW, what the law's step(s) give from
 *                 there (the printed track — a TR, a card, a level), and the
 *                 winner's forecast: the winner's own step of the sitting
 *                 comes FIRST, so a win walks the marker one step further
 *                 («+2 шага: ⑤ · влияние 3, ⑥ · +1 РТ»);
 *   pending     — the phase is resolving THIS card and the viewer's record is
 *                 not in yet: the step from the marker's live position;
 *   applied     — the viewer's own record: the walk and what it paid, or the
 *                 named skip (the end of the track).
 *
 * Nothing here decides a rule: WHO is the shared grant's predicate
 * (`agendaGrantEligibility`), the steps ahead are the printed track
 * (`agendaWalkAhead` — the table the engine advances by), the record is the
 * server's own. MarsBot reads here too (decision D11): a seat that walks the
 * grant but is paid nothing by the law (`seatTakesSeatGrant` ∧ !`seatEnacts`)
 * has no hand — its card step reads as the 1 M€ it takes instead (the Automa
 * FAQ, `noHand`). Pure: no Vue, no DOM, no i18n (English keys).
 */
import {Color} from '@/common/Color';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPlayerModel, seatEnacts, seatTakesSeatGrant} from '@/common/models/ParliamentModel';
import {AgendaAdvanceStep, influenceAtAgenda, resolutionIdOf} from '@/common/parliament/ParliamentTypes';
import {AGENDA_GRANT_STEP_KEY, AgendaGrantDeclaration, agendaGrantEligibility, AgendaStepAhead, agendaWalkAhead} from '@/common/parliament/agendaGrant';
import {GrantEligibility} from '@/common/parliament/seatGrant';
import {ReadingPerson} from './influenceYieldModel';

export type AgendaGrantContext = 'reference' | 'conditional' | 'pending' | 'applied';

export type AgendaGrantReading = {
  grant: AgendaGrantDeclaration;
  context: AgendaGrantContext;
  /** WHO — the shared grant's answer (a grant to everyone: `everyone`). */
  eligibility?: GrantEligibility;
  /** The viewer's marker NOW (0 = no cube yet) — before this law's step. */
  position?: number;
  /** conditional / pending: what the law's step(s) give from `position`, in order — empty = the end of the track. */
  ahead?: ReadonlyArray<AgendaStepAhead>;
  /**
   * conditional: the WINNER's forecast — the winner's own step of the sitting first, then the law's
   * (`steps + 1` from `position`). Absent when it reads no more than `ahead` (the end of the track).
   */
  ifWin?: ReadonlyArray<AgendaStepAhead>;
  /** applied: the walk the record carries (from, to, every step with its bonus). */
  walked?: {from: number, to: number, steps: ReadonlyArray<AgendaAdvanceStep>};
  /** applied: what the walk paid, measured by the server. */
  tr?: number;
  drawn?: number;
  megacredits?: number;
  /** applied: the step did not happen — the server's reason (an English key). */
  skipped?: string;
  /** applied from a FINISHED phase: the generation whose phase it was. */
  generation?: number;
  /** The seat has no hand (MarsBot): a card step is 1 M€ instead (the Automa FAQ). */
  noHand?: boolean;
};

function seatOf(model: ParliamentModel | undefined, viewer: Color | undefined): ParliamentPlayerModel | undefined {
  if (model === undefined || viewer === undefined) {
    return undefined;
  }
  const seat = model.players.find((p) => p.color === viewer);
  return seat !== undefined && seatTakesSeatGrant(seat) ? seat : undefined;
}

/** The viewer's record of the grant's step — the walk (`agenda`) or its skip — matched by the step KEY, never by position. */
export function agendaGrantOutcomeOf(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel> | undefined, viewer: Color): ParliamentEnactOutcomeModel | undefined {
  return outcomes?.find((o) => o.player === viewer && o.step === AGENDA_GRANT_STEP_KEY && o.kind !== 'reaction');
}

function appliedReading(grant: AgendaGrantDeclaration, record: ParliamentEnactOutcomeModel, noHand: boolean, generation?: number): AgendaGrantReading {
  const base: AgendaGrantReading = {
    grant,
    context: 'applied',
    eligibility: 'everyone',
    ...(noHand ? {noHand} : {}),
    ...(generation === undefined ? {} : {generation}),
  };
  const walk = record.walk;
  if (record.kind === 'skipped' || walk === undefined || walk.steps.length === 0) {
    return {...base, ...(walk === undefined ? {} : {position: walk.from}), skipped: record.reason ?? 'Skipped: the Career step'};
  }
  return {
    ...base,
    position: walk.from,
    walked: {from: walk.from, to: walk.to, steps: walk.steps.map((step) => ({...step}))},
    ...(record.tr === undefined ? {} : {tr: record.tr}),
    ...(record.drawn === undefined ? {} : {drawn: record.drawn}),
    ...(record.megacredits === undefined ? {} : {megacredits: record.megacredits}),
  };
}

export function agendaGrantReadingOf(
  resolution: IClientResolution | undefined,
  model: ParliamentModel | undefined,
  viewer: Color | undefined,
): AgendaGrantReading | undefined {
  const grant = resolution?.agendaGrant;
  if (resolution === undefined || grant === undefined) {
    return undefined;
  }
  const seat = seatOf(model, viewer);
  if (model === undefined || seat === undefined) {
    return {grant, context: 'reference'};
  }
  const noHand = !seatEnacts(seat);
  const hand = noHand ? {noHand} : {};
  // 1. The phase is resolving THIS card right now: the record once it is in, else the step from the live position.
  const phase = model.phase;
  const phaseWinner = phase?.winner;
  if (phase !== undefined && phaseWinner !== undefined && resolutionIdOf(phaseWinner.instance) === resolution.id) {
    const record = agendaGrantOutcomeOf(phase.outcomes, seat.color);
    if (record !== undefined) {
      return appliedReading(grant, record, noHand);
    }
    return {
      grant, context: 'pending', ...hand,
      eligibility: agendaGrantEligibility(grant, {winner: phaseWinner.player === seat.color, influence: seat.influence}),
      position: seat.agenda,
      ahead: agendaWalkAhead(seat.agenda, grant.steps),
    };
  }
  // 2. The last FINISHED phase enacted it: the viewer's record, as history.
  const last = model.lastPhase;
  if (last !== undefined && last.enacted.resolution === resolution.id) {
    const record = agendaGrantOutcomeOf(last.outcomes, seat.color);
    if (record !== undefined) {
      return appliedReading(grant, record, noHand, last.generation);
    }
  }
  // 3. Up for the vote: conditional — the law's step from where the marker stands, and the win's step before it.
  if (model.slots.some((slot) => slot.resolution === resolution.id)) {
    const ahead = agendaWalkAhead(seat.agenda, grant.steps);
    const ifWin = agendaWalkAhead(seat.agenda, grant.steps + 1);
    return {
      grant, context: 'conditional', ...hand,
      eligibility: agendaGrantEligibility(grant, {winner: false, influence: seat.influence}),
      position: seat.agenda,
      ahead,
      ...(ifWin.length > ahead.length ? {ifWin} : {}),
    };
  }
  // 4. Enacted long ago, or off the table: the rule alone.
  return {grant, context: 'reference'};
}

/** The grant's head (English key): what each seat receives — the steps, for everyone. */
export function agendaGrantLabelKey(grant: AgendaGrantDeclaration): {key: string, params: ReadonlyArray<string>} {
  return grant.steps === 1 ?
    {key: 'Career step for every player', params: []} :
    {key: '${0} Career steps for every player', params: [String(grant.steps)]};
}

/**
 * The CAPTION of a reading — which question it answers, in the reading's person: the end of the track (the named
 * skip, said BEFORE the vote too), the record once it is in, nothing otherwise (the steps say it themselves).
 */
export function agendaGrantCaptionOf(reading: AgendaGrantReading, person: ReadingPerson = 'you'): {key: string, params?: ReadonlyArray<string>} | undefined {
  switch (reading.context) {
  case 'reference':
    return undefined;
  case 'conditional':
  case 'pending':
    if ((reading.ahead ?? []).length === 0) {
      return {key: person === 'they' ? 'They are already at the end of the Career' : 'You are already at the end of the Career'};
    }
    return undefined;
  case 'applied':
    if (reading.skipped !== undefined) {
      return {key: reading.skipped};
    }
    return {key: person === 'they' ? 'Their marker walked' : 'Your marker walked'};
  }
}

/** The win's forecast suffix (English key with the step count): «if you win: +2 steps». */
export function agendaGrantWinKey(reading: AgendaGrantReading, person: ReadingPerson = 'you'): {key: string, params: ReadonlyArray<string>} | undefined {
  const ifWin = reading.ifWin;
  if (ifWin === undefined || ifWin.length === 0) {
    return undefined;
  }
  return {key: person === 'they' ? 'If they win: +${0} Career steps' : 'If you win: +${0} Career steps', params: [String(ifWin.length)]};
}

/** What ONE step pays, as a reading unit: a TR, a card (1 M€ for a seat with no hand), or the level it sets. */
export type AgendaStepGift =
  | {kind: 'tr'}
  | {kind: 'card'}
  | {kind: 'megacredits'}
  | {kind: 'influence', level: number};

export function agendaStepGiftOf(step: AgendaStepAhead | AgendaAdvanceStep, noHand: boolean): AgendaStepGift {
  const bonus = 'step' in step ? (step.step.kind === 'influence' ? undefined : step.step.kind) : step.bonus;
  if (bonus === 'tr') {
    return {kind: 'tr'};
  }
  if (bonus === 'card') {
    return noHand ? {kind: 'megacredits'} : {kind: 'card'};
  }
  return {kind: 'influence', level: influenceAtAgenda(step.to)};
}
