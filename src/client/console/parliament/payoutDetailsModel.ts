/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ПОДРОБНОСТИ ВЫПЛАТ» (the owner, 2026-10-24; rewritten P71 · ledger CY, 2026-10-30) — the step one level BELOW the
 * results card's ledger: the card says WHAT each seat got in one glance; this says WHY, seat by seat, so a player can
 * always check that their payout — and anybody else's — is exactly what the law pays.
 *
 * ══ THE SHAPE: A BREAKDOWN PER SEAT ══
 *
 * The first shape was a table per RULE («Игрок · Расчёт · Получено»): one seat's story was cut across N tables and
 * «why do I have this much?» was read across all of them, with the seat's total nowhere. Now a COLUMN PER SEAT reads
 * top-down as a derivation, the columns' blocks aligned so the seats compare across:
 *
 *   head       the seat, the crown and the votes of the winner of the vote;
 *   influence  only where the law READ influence: the number the law read and WHAT IT WAS MADE OF — the Career's level
 *              at its step and every giver beyond it («Карьера 1 · шаг ① + Колониальное представительство +1») from the
 *              SERVER's SNAPSHOT (`summary.influenceRead`), never the live sources (a card played after the sitting
 *              would rewrite the past); then what the influence MEANT for this law — the seat's recorded reading of
 *              every influence-scaled part (Colonial Affairs' «×3 = 2 + ⌊2 / 2⌋», a rate «3 × 2 = 6 · cap 5») and,
 *              for a grant of WHO, which clause took the seat in or passed it over;
 *   lines      a line per SOURCE: a colony tile (its records grouped — Pluto's k pairs read «+3 [card] · ⌫3» with the
 *              tile's ×k), the levy, a part that does not read influence (its own reading), the winner's part, the
 *              ruling party's answer — each with the records' own chips (`ConsoleSitPayoutPart`, the one renderer);
 *   ИТОГО      the seat's totals — `resultsTotalsOf`, the very function the card's ledger renders (the two surfaces
 *              cannot disagree).
 *
 * Above the columns, ONE strip of the LAW (it does not scroll): the card's own formula of every scaled part, the rule
 * of WHO of a grant, and — once — the seats a winner-only part was never owed to.
 *
 * Nothing is recomputed: every number is a field of a record or of the snapshot, read by the readers the vote panel
 * and the card already stand on (`enactedYieldsOf`, `enactedLevyOf`, `grantEligibility`). Pure: no DOM, no Vue, no
 * i18n calls (English text is the key). Spec: `tests/console/payoutDetailsModel.spec.ts`.
 */
import {Color} from '@/common/Color';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {ParliamentEnactOutcomeModel, ParliamentInfluenceReadModel, ParliamentModel, ParliamentPhaseSummaryModel, seatEnacts} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {InfluenceScaledEffect, InfluenceYield} from '@/common/parliament/influenceScaling';
import {LEVY_STEP_KEY, LevyReading} from '@/common/parliament/resolutionLevy';
import {REWARD_ADDRESS} from '@/common/parliament/rewardAddress';
import {GrantEligibility, GrantRecipients, grantEligibility, grantInfluenceLine} from '@/common/parliament/seatGrant';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {enactedLevyOf, enactedYieldsOf, yieldInfluenceEnters} from './influenceYieldModel';
import {ResultsPayoutPart, ResultsSeat, ResultsTotal, resultsPayoutPart, resultsTotalsOf} from './parliamentResultsModel';

/** Which clause of a grant's rule of WHO took the seat in — or passed it over — and the influence it was read at. */
export type PayoutDetailsGrant = {eligibility: GrantEligibility, influence?: number, line?: number};

/** THE INFLUENCE BLOCK of a seat: what the law read, what it was made of, what it meant. */
export type PayoutDetailsInfluence = {
  /** The number the law read (the snapshot's total, else the record's own `influence`). */
  total: number;
  /** What it was made of — the SERVER's snapshot; absent on a save from before it (the number alone is printed). */
  composition?: {agendaStep: number, track: number, sources: ReadonlyArray<{amount: number, source?: string}>};
  /** What it meant: the seat's recorded reading of every part whose formula reads influence. */
  meanings: ReadonlyArray<InfluenceYield>;
  /** …and the clause of WHO a grant read at that influence. */
  grant?: PayoutDetailsGrant;
};

export type PayoutDetailsLineKind = 'colony' | 'levy' | 'rule' | 'winner' | 'grant' | 'reaction' | 'other';

/** ONE SOURCE of what the seat got — a tile, the levy, a part, the winner's reward, the party's answer. */
export type PayoutDetailsLine = {
  /** Stable key — `colony:<tile>`, `levy`, `rule:<effect>`, `winner`, `grant`, `reaction:<party>`, `other:<step>`. */
  id: string;
  kind: PayoutDetailsLineKind;
  /** `colony`: the tile, how many times its bonus was paid (k), the seat's cubes on it when more than one. */
  colony?: string;
  times?: number;
  cubes?: number;
  /** `reaction`: the ruling party that answered. */
  party?: ReduxParty;
  /** `rule`: the seat's recorded reading of a part that does NOT read influence (one that does is the influence block's). */
  reading?: InfluenceYield;
  /** `levy`: what the law took first. */
  levy?: LevyReading;
  /** `grant`: the clause of WHO — printed here only when the influence block does not already say it. */
  grant?: PayoutDetailsGrant;
  /** `other`: the line's English title (the family's own, by the record's kind). */
  title?: string;
  /** The line's records — the one record renderer draws each. */
  parts: ReadonlyArray<ResultsPayoutPart>;
  /** …and their totals, where a line merges records (Pluto's k pairs → «+3 [card] · ⌫3»). */
  totals: ReadonlyArray<ResultsTotal>;
};

/** ONE SEAT's breakdown — a column, read top-down. */
export type PayoutDetailsSeat = {
  player: Color;
  /** The seat won the vote — the crown and the votes in its head. */
  winner: boolean;
  /** Only where the law READ influence (a part whose formula reads it, a grant's influence line). */
  influence?: PayoutDetailsInfluence;
  lines: ReadonlyArray<PayoutDetailsLine>;
  /** ИТОГО — the card's own totals (`resultsTotalsOf` over every record of the seat). */
  totals: ReadonlyArray<ResultsTotal>;
};

export type PayoutDetails = {
  /** THE LAW's strip: its influence-scaled parts (their formula is printed once), its rule of WHO, the not-owed line. */
  law: {
    effects: ReadonlyArray<InfluenceScaledEffect>;
    recipients?: GrantRecipients;
    /** The seats a winner-only part was never owed to — named ONCE, never a «0» per seat. */
    notOwed: ReadonlyArray<Color>;
  };
  /** Who won the vote and by how many votes (absent: no player won — a neutral winner). */
  winner?: {player: Color, votes: number, tieBreak?: 'slot-priority' | 'earlier-delegate'};
  seats: ReadonlyArray<PayoutDetailsSeat>;
};

/** The line a record belongs to — by what the record IS, never by its text. */
function lineKeyOf(outcome: ParliamentEnactOutcomeModel, resolution: IClientResolution): {key: string, kind: PayoutDetailsLineKind, effect?: InfluenceScaledEffect} {
  if (outcome.kind === 'reaction') {
    return {key: `reaction:${outcome.party ?? ''}`, kind: 'reaction'};
  }
  if (outcome.step === LEVY_STEP_KEY) {
    return {key: 'levy', kind: 'levy'};
  }
  // A colony-paid record (Colonial Affairs) groups by its TILE — the tile is the source the seat reads.
  if (outcome.colony !== undefined && outcome.kind !== 'colony') {
    return {key: `colony:${outcome.colony}`, kind: 'colony'};
  }
  const effect = outcome.effect === undefined ? undefined : resolution.scaled?.find((e) => e.id === outcome.effect);
  if (effect !== undefined) {
    return {key: `rule:${effect.id}`, kind: 'rule', effect};
  }
  const reading = REWARD_ADDRESS[outcome.kind]?.reading;
  if (reading === 'tile-grant' || reading === 'agenda-walk') {
    return {key: 'grant', kind: 'grant'};
  }
  if (outcome.part === 'winner' || reading === 'winner-reward') {
    return {key: 'winner', kind: 'winner'};
  }
  return {key: `other:${outcome.step}`, kind: 'other'};
}

/** The title an `other` line speaks — the family of its first record. */
function otherTitleOf(outcome: ParliamentEnactOutcomeModel): string {
  if (outcome.kind === 'colonyBonus' || outcome.kind === 'discard') {
    return 'Colony bonuses';
  }
  return 'Resolution effect';
}

/** The law READS influence for this seat: a part whose formula has an influence term, a colony multiplier, a grant's line. */
function readsInfluence(effect: InfluenceScaledEffect): boolean {
  return yieldInfluenceEnters(effect);
}

/**
 * THE READING. `seats` is the results card's own list of participating seats (its order is the order the columns
 * print in); `model` is the Parliament model the vote panel reads (the readers find the phase's outcomes in it).
 * A seat the law never pays (MarsBot, `enacts: false`) has a column only where it actually received something.
 */
export function payoutDetailsOf(
  resolution: IClientResolution,
  summary: ParliamentPhaseSummaryModel,
  model: ParliamentModel | undefined,
  seats: ReadonlyArray<ResultsSeat>,
): PayoutDetails {
  const winnerColor = summary.winner.player !== undefined && summary.winner.player !== 'neutral' ? summary.winner.player : undefined;
  const recipients = resolution.tileGrant?.recipients ?? resolution.agendaGrant?.recipients;
  const snapshots = new Map<Color, ParliamentInfluenceReadModel>((summary.influenceRead ?? []).map((entry) => [entry.player, entry]));

  type LineDraft = {kind: PayoutDetailsLineKind, effect?: InfluenceScaledEffect, party?: ReduxParty, title?: string, colony?: string, times?: number, cubes?: number, parts: Array<ResultsPayoutPart>, first: ParliamentEnactOutcomeModel};
  const bySeat = new Map<Color, {lines: Map<string, LineDraft>, parts: Array<ResultsPayoutPart>, influence?: number}>();
  for (const seat of seats) {
    bySeat.set(seat.player, {lines: new Map(), parts: []});
  }
  (summary.outcomes ?? []).forEach((outcome, index) => {
    // A WORLD record names no seat: it is the results card's planet line, never a payout.
    const seat = outcome.player === undefined ? undefined : bySeat.get(outcome.player);
    if (seat === undefined) {
      return;
    }
    const {key, kind, effect} = lineKeyOf(outcome, resolution);
    const part = resultsPayoutPart(outcome, index, effect?.level);
    seat.parts.push(part);
    if (outcome.influence !== undefined && seat.influence === undefined) {
      seat.influence = outcome.influence;
    }
    let line = seat.lines.get(key);
    if (line === undefined) {
      line = {kind, parts: [], first: outcome};
      if (effect !== undefined) {
        line.effect = effect;
      }
      if (kind === 'reaction' && outcome.party !== undefined) {
        line.party = outcome.party as ReduxParty;
      }
      if (kind === 'colony' && outcome.colony !== undefined) {
        line.colony = outcome.colony;
      }
      if (kind === 'other') {
        line.title = otherTitleOf(outcome);
      }
      seat.lines.set(key, line);
    }
    if (kind === 'colony') {
      line.times ??= outcome.multiplier;
      line.cubes ??= outcome.cubes;
    }
    line.parts.push(part);
  });

  const paidSeats = seats.filter((seat) => seat.enacts !== false).map((seat) => seat.player);
  const winnerOnlyEffects = (resolution.scaled ?? []).filter((effect) => effect.recipient === 'winner');
  const out: Array<PayoutDetailsSeat> = [];
  for (const seat of seats) {
    const draft = bySeat.get(seat.player);
    if (draft === undefined || (seat.enacts === false && draft.parts.length === 0)) {
      continue;
    }
    const player = seat.player;
    const isWinner = player === winnerColor;
    // What the influence MEANT: every influence-scaled part of this seat, as RECORDED.
    const yields = enactedYieldsOf(resolution, model, player).filter((y) => y.context !== 'reference');
    const meanings = yields.filter((y) => readsInfluence(y.effect) && draft.parts.length > 0 &&
      [...draft.lines.values()].some((line) => line.effect?.id === y.effect.id || (line.kind === 'colony' && line.first.effect === y.effect.id)));
    const grantRecord = draft.lines.get('grant')?.first;
    const grant = recipients !== undefined && grantRecord !== undefined ? grantOf(recipients, isWinner, grantRecord.influence) : undefined;
    const grantReadsInfluence = grant !== undefined && recipients?.kind === 'threshold';
    const snapshot = snapshots.get(player);
    const total = snapshot?.total ?? draft.influence;
    let influence: PayoutDetailsInfluence | undefined;
    if ((meanings.length > 0 || grantReadsInfluence) && total !== undefined) {
      influence = {
        total,
        meanings,
        ...(snapshot === undefined ? {} : {composition: {agendaStep: snapshot.agendaStep, track: snapshot.track, sources: snapshot.sources}}),
        ...(grantReadsInfluence && grant !== undefined ? {grant} : {}),
      };
    }
    const lines: Array<PayoutDetailsLine> = [];
    for (const [id, line] of draft.lines) {
      const built: PayoutDetailsLine = {id, kind: line.kind, parts: line.parts, totals: resultsTotalsOf(line.parts)};
      if (line.colony !== undefined) {
        built.colony = line.colony;
      }
      if (line.times !== undefined) {
        built.times = line.times;
      }
      if (line.cubes !== undefined && line.cubes > 1) {
        built.cubes = line.cubes;
      }
      if (line.party !== undefined) {
        built.party = line.party;
      }
      if (line.title !== undefined) {
        built.title = line.title;
      }
      if (line.kind === 'rule' && line.effect !== undefined && !readsInfluence(line.effect)) {
        const reading = yields.find((y) => y.effect.id === line.effect?.id);
        if (reading !== undefined) {
          built.reading = reading;
        }
      }
      if (line.kind === 'grant' && grant !== undefined && !grantReadsInfluence) {
        built.grant = grant;
      }
      lines.push(built);
    }
    // THE LEVY RIDES FIRST — the printed order («lose 10 M€, then …»), whatever order the records arrived in.
    const levyLine = lines.find((line) => line.kind === 'levy');
    const levy = levyLine === undefined ? undefined : enactedLevyOf(resolution, model, player);
    if (levyLine !== undefined && levy !== undefined) {
      levyLine.levy = levy;
    }
    lines.sort((a, b) => (a.kind === 'levy' ? -1 : 0) - (b.kind === 'levy' ? -1 : 0));
    out.push({player, winner: isWinner, ...(influence === undefined ? {} : {influence}), lines, totals: resultsTotalsOf(draft.parts)});
  }
  // A part for the winner ALONE (a contest's tile, a winner-recipient rule) was never owed to the other paid seats —
  // named ONCE in the law's strip, never a «0» per seat.
  const holdsWinnerPart = (player: Color): boolean => {
    const lines = bySeat.get(player)?.lines;
    return lines !== undefined && (lines.has('winner') || winnerOnlyEffects.some((effect) => lines.has(`rule:${effect.id}`)));
  };
  const lawHasWinnerPart = winnerOnlyEffects.length > 0 || paidSeats.some(holdsWinnerPart) || (winnerColor !== undefined && holdsWinnerPart(winnerColor));
  const notOwed = lawHasWinnerPart ? paidSeats.filter((player) => player !== winnerColor && !holdsWinnerPart(player)) : [];
  return {
    law: {
      effects: resolution.scaled ?? [],
      ...(recipients === undefined ? {} : {recipients}),
      notOwed,
    },
    ...(winnerColor === undefined ? {} : {winner: {player: winnerColor, votes: summary.winner.votes, ...(summary.winner.tieBreak === undefined ? {} : {tieBreak: summary.winner.tieBreak})}}),
    seats: out,
  };
}

function grantOf(recipients: GrantRecipients, winner: boolean, influence: number | undefined): PayoutDetailsGrant {
  const line = grantInfluenceLine(recipients);
  return {
    eligibility: grantEligibility(recipients, {winner, influence: influence ?? 0}),
    ...(influence === undefined ? {} : {influence}),
    ...(line === undefined ? {} : {line}),
  };
}

/** The step has something to explain — a quiet law (nothing paid to any seat) has no door. */
export function payoutDetailsAvailable(details: PayoutDetails | undefined): boolean {
  return details !== undefined && details.seats.some((seat) => seat.lines.length > 0);
}

/**
 * The details of the sitting ON SCREEN — the ONE construction both readers ask (the section, for the door and the
 * bar; the sitting, for the step): the summary's enacted law, the model's participating seats in its own order.
 */
export function sittingPayoutDetailsOf(model: ParliamentModel | undefined, summary: ParliamentPhaseSummaryModel | undefined): PayoutDetails | undefined {
  if (summary === undefined) {
    return undefined;
  }
  const resolution = getResolution(summary.winner.resolution);
  if (resolution === undefined) {
    return undefined;
  }
  const seats: Array<ResultsSeat> = (model?.players ?? []).filter((p) => p.participates)
    .map((p) => ({player: p.color, lobby: p.lobby, reserve: p.reserve, enacts: seatEnacts(p)}));
  return payoutDetailsOf(resolution, summary, model, seats);
}
