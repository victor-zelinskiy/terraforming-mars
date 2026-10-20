/*
 * THE TILE GRANT's READING (Turmoil Redux — Skyscrapers RX20, Mars First
 * Budget RX38): ONE model for every surface that must say, of a tile a law
 * grants the seats — BY THRESHOLD (Skyscrapers' tier) or TO EVERYONE (Mars
 * First Budget's city), «do I get it, where does it go, and what happened» —
 * the vote surface's own-effect block,
 * the fullscreen inspector's footer and its «for you» row, the sitting's band,
 * the playground. The twin of `winnerRewardModel.ts` (the winner's part), in
 * the same four moments:
 *
 *   reference   — off the table, or no seat: the rule alone;
 *   conditional — the card is UP FOR THE VOTE and the viewer is seated: their
 *                 eligibility by their influence NOW («at influence 2 it is
 *                 yours, win or not» / «only if you win» / «you place one»),
 *                 and the DESTINATIONS the server counts for them (their
 *                 cities on Mars — a zero is the honest «nothing lands»; a
 *                 grant by the ordinary rules counts nothing);
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
 * cell's own worth (its greeneries, the stack's VP, its printed bonus) is the
 * placement dossier's reading, never promised here. Every text below is
 * chosen by the declaration's TWO questions (`recipients.kind`, `placement`)
 * through exhaustive switches — a grant to everyone never prints a line or a
 * stack, a tier never prints «any legal cell».
 *
 * MarsBot reads here too (decision D11): a seat that TAKES the tile
 * (`seatTakesTileGrant`) has a reading even when the law pays it nothing.
 */
import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPlayerModel, seatEnacts, seatTakesTileGrant} from '@/common/models/ParliamentModel';
import {ReduxParty, resolutionIdOf} from '@/common/parliament/ParliamentTypes';
import {Resource} from '@/common/Resource';
import {getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {TileGrantDeclaration, TileGrantEligibility, tileGrantCountId, tileGrantEligibility, tileGrantInfluenceLine, tileGrantStepKey} from '@/common/parliament/tileGrant';
import {ReadingPerson} from './influenceYieldModel';

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
  /**
   * THE RULING PARTY'S ANSWER to the tile (decision Р3): the law takes the ENACTED slot before its steps run,
   * so ITS party rules when the tile lands, and that party's DECLARED answer to a tile on Mars
   * (`PartyTileAnswer` — Mars First: +1 steel, a city +1 card) is the seat's too. A fact of the law of access,
   * never a promise about a cell. Absent for a seat the party never answers (MarsBot — it holds no party
   * effect), a seat the grant passes over or skipped, and a party with no answer to tiles.
   */
  answer?: TileGrantAnswer;
};

/** The ruling party's answer to the granted tile — the party (its emblem and name) and what it pays. */
export type TileGrantAnswer = {
  party: ReduxParty;
  /** The stock paid for the tile on Mars. */
  perTile: {resource: Resource, amount: number};
  /** The cards drawn on top for a city (0 when the tile is no city). */
  cards: number;
};

/** The answer the resolution's own party makes to the granted tile, for a seat that holds party effects. */
function answerFor(resolution: IClientResolution, grant: TileGrantDeclaration, seat: ParliamentPlayerModel, reading: TileGrantReading): TileGrantAnswer | undefined {
  if (!seatEnacts(seat) || reading.context === 'reference' || reading.eligibility === 'none' || reading.skipped !== undefined) {
    return undefined;
  }
  const declared = getPartyEffect(resolution.party)?.tileAnswer;
  if (declared === undefined) {
    return undefined;
  }
  return {party: resolution.party, perTile: {...declared.perTile}, cards: grant.tile === 'city' ? declared.cityCards : 0};
}

function withAnswer(resolution: IClientResolution, seat: ParliamentPlayerModel, reading: TileGrantReading): TileGrantReading {
  const answer = answerFor(resolution, reading.grant, seat, reading);
  return answer === undefined ? reading : {...reading, answer};
}

function seatOf(model: ParliamentModel | undefined, viewer: Color | undefined): ParliamentPlayerModel | undefined {
  if (model === undefined || viewer === undefined) {
    return undefined;
  }
  const seat = model.players.find((p) => p.color === viewer);
  return seat !== undefined && seatTakesTileGrant(seat) ? seat : undefined;
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
  const countId = tileGrantCountId(grant);
  const count = countId === undefined ? undefined : seat.counts?.find((c) => c.id === countId);
  const head = {grant, ...(count === undefined ? {} : {cities: count.count})};
  // 1. The phase is resolving THIS card right now: the winner is fixed, the influence is the phase's.
  const phase = model.phase;
  const phaseWinner = phase?.winner;
  if (phase !== undefined && phaseWinner !== undefined && resolutionIdOf(phaseWinner.instance) === resolution.id) {
    const record = tileGrantOutcomeOf(grant, phase.outcomes, seat.color);
    if (record !== undefined) {
      return withAnswer(resolution, seat, appliedReading(head, record, phaseWinner.player, seat.influence));
    }
    return withAnswer(resolution, seat, {
      ...head,
      context: 'pending',
      eligibility: tileGrantEligibility(grant, {winner: phaseWinner.player === seat.color, influence: seat.influence}),
      influence: seat.influence,
    });
  }
  // 2. The last FINISHED phase enacted it: the viewer's record, as history.
  const last = model.lastPhase;
  if (last !== undefined && last.enacted.resolution === resolution.id) {
    const record = tileGrantOutcomeOf(grant, last.outcomes, seat.color);
    if (record !== undefined) {
      return withAnswer(resolution, seat, appliedReading(head, record, last.winner.player, seat.influence, last.generation));
    }
  }
  // 3. Up for the vote: conditional — the viewer's standing as a NON-winner (the win itself is unconditional).
  if (model.slots.some((slot) => slot.resolution === resolution.id)) {
    return withAnswer(resolution, seat, {
      ...head,
      context: 'conditional',
      eligibility: tileGrantEligibility(grant, {winner: false, influence: seat.influence}),
      influence: seat.influence,
    });
  }
  // 4. Enacted long ago, or off the table: the rule alone.
  return {grant, context: 'reference'};
}

/**
 * The ONE qualification sentence the inspector adds under the effect (an
 * English key), by WHERE the tile lands: a tier — what it IS for the score,
 * and that a seat with no city gains nothing; a city by the ordinary rules —
 * that the rules are the usual ones and the cell pays its bonus.
 */
export const TILE_GRANT_RULE_KEY = 'Each city in the stack scores its adjacent greeneries separately. The cell pays no placement bonus again. A player with no city on Mars gains nothing.';
export const TILE_GRANT_ANY_LEGAL_RULE_KEY = 'A city tile placed by the usual rules; the cell pays its placement bonus.';

export function tileGrantRuleKey(grant: TileGrantDeclaration): string {
  switch (grant.placement) {
  case 'own-city': return TILE_GRANT_RULE_KEY;
  case 'any-legal': return TILE_GRANT_ANY_LEGAL_RULE_KEY;
  }
}

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
  case 'any-legal': return 'on any legal space on Mars';
  }
}

/** WHO receives it (English key with its param — the influence line): the head's label. */
export function tileGrantRecipientsKey(grant: TileGrantDeclaration): {key: string, params: ReadonlyArray<string>} {
  const recipients = grant.recipients;
  switch (recipients.kind) {
  case 'threshold': return {key: 'For the winner of the vote and everyone at influence ${0} or more', params: [String(recipients.influenceAtLeast)]};
  case 'everyone': return {key: 'Every player, clockwise from the first player', params: []};
  }
}

/**
 * The CAPTION of a reading — WHICH question it answers, as an English key with
 * its params: the viewer's standing at the vote, the fixed answer while the
 * phase resolves, the record once it is in. Undefined off the table.
 */
export function tileGrantCaptionOf(reading: TileGrantReading, person: ReadingPerson = 'you'): {key: string, params?: ReadonlyArray<string>} | undefined {
  if (reading.grant.recipients.kind === 'everyone') {
    return everyoneCaptionOf(reading, person);
  }
  const line = String(tileGrantInfluenceLine(reading.grant) ?? 0);
  const influence = String(reading.influence ?? 0);
  switch (reading.context) {
  case 'reference':
    return undefined;
  case 'conditional':
    // The VOTE's two standings, in the person of the seat the block is about — the subject itself is
    // named once, by the kicker above, so neither line repeats it.
    if (person === 'they') {
      return reading.eligibility === 'influence' ?
        {key: 'Theirs at influence ${0} — win or not', params: [influence]} :
        {key: 'Only if they win — influence ${0} is below ${1}', params: [influence, line]};
    }
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
 * A GRANT TO EVERYONE has no line and no star: the seat simply places one —
 * the vote changes nothing about it, so the caption says only that (and,
 * once in, that it was placed or why not). The tile's NAME stands beside the
 * caption on every host, so the caption never repeats it.
 */
function everyoneCaptionOf(reading: TileGrantReading, person: ReadingPerson): {key: string, params?: ReadonlyArray<string>} | undefined {
  switch (reading.context) {
  case 'reference':
    return undefined;
  case 'conditional':
  case 'pending':
    return {key: 'Every player places one'};
  case 'applied':
    if (reading.skipped !== undefined) {
      return {key: reading.skipped};
    }
    return person === 'they' ? {key: 'Placed'} : {key: 'You placed it'};
  }
}

/**
 * THE DETAIL beside the caption — the destinations while the tile is still to
 * come («your cities on Mars: 2», or the honest «no city on Mars to build on»),
 * the stack once it landed («a stack of 2»). English key + params; undefined
 * when there is nothing to add.
 */
export function tileGrantDetailOf(reading: TileGrantReading, person: ReadingPerson = 'you'): {key: string, params?: ReadonlyArray<string>} | undefined {
  if (reading.context === 'applied') {
    // A tier names the stack it became; a new city has no stack to name — its cell is the board's to show.
    const stack = reading.placed?.stackHeight;
    return reading.grant.placement !== 'own-city' || reading.skipped !== undefined || stack === undefined ? undefined : {key: 'a stack of ${0}', params: [String(stack)]};
  }
  if (reading.context === 'reference' || reading.cities === undefined) {
    return undefined;
  }
  // «Городов на Марсе нет» is already impersonal — only the count names an owner.
  if (reading.cities === 0) {
    return {key: 'No city on Mars to build on'};
  }
  return person === 'they' ?
    {key: 'cities on Mars: ${0}', params: [String(reading.cities)]} :
    {key: 'your cities on Mars: ${0}', params: [String(reading.cities)]};
}

/**
 * The reading IN WORDS, for the inspector's «for you» row — built from the
 * very reading the chip draws, so the two can never disagree. Display strings
 * (translated by the injected functions); undefined off the table.
 */
export function tileGrantSentenceOf(
  reading: TileGrantReading,
  t: {text: (key: string) => string, params: (key: string, params: Array<string>) => string},
  person: ReadingPerson = 'you',
): {caption: string, detail: string} | undefined {
  const caption = tileGrantCaptionOf(reading, person);
  if (caption === undefined) {
    return undefined;
  }
  const say = (part: {key: string, params?: ReadonlyArray<string>}) => part.params === undefined ? t.text(part.key) : t.params(part.key, [...part.params]);
  const lead = reading.generation === undefined ? say(caption) : `${t.params('Generation ${0}', [String(reading.generation)])} · ${say(caption)}`;
  const detail = tileGrantDetailOf(reading, person);
  return {caption: lead, detail: detail === undefined ? '' : say(detail)};
}
