/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ПОДРОБНОСТИ ВЫПЛАТ» (the owner, 2026-10-24) — the step one level BELOW the results card's «ВЫПЛАТЫ»: the
 * card says WHAT each seat got in one glance; this says WHY, for every seat, so a player can always check that
 * their payout — and anybody else's — is exactly what the law pays.
 *
 * ══ THE SHAPE: A TABLE PER RULE ══
 *
 * A resolution pays by one or several RULES, and the rules differ a lot: a rate per influence plus a counted
 * term under a cap (the budgets), a levy taken first, a tile for the winner of the vote, a tile for every seat
 * over an influence line, the colony bonuses, the Career's steps, the ruling party's answer. So the step is a
 * stack of SECTIONS — one per rule, in the order the server paid them — and each section is a table whose rows
 * are the seats it concerns:
 *
 *   rule      a scaled effect (`IClientResolution.scaled`): the header is the card's own formula, each row the
 *             seat's RECORDED reading (influence · count · the sum before the cap · the amount — `enactedYieldsOf`
 *             with that seat's colour) and what landed;
 *   levy      what the law took first (`enactedLevyOf`) — paid, owed, short;
 *   winner    a part for the winner of the vote alone (a contest's tile, a winner-recipient rule): the winner's row,
 *             their votes, and ONE line that the other seats were never owed it — never a «0» per seat;
 *   grant     a deed for the seats by a rule of WHO (`grantEligibility` — the winner, the influence line, everyone):
 *             the row says which clause took the seat in, or passed it over;
 *   reaction  the ruling party's answer to the enactment, per party;
 *   other     anything else a seat received, read by its parts (the colony ledger's rows group by tile there).
 *
 * Nothing is recomputed: every number is the server's record (`summary.outcomes` is every seat's), read by the
 * readers the vote panel and the results card already stand on. A skip names itself with the server's reason.
 * Pure: no DOM, no Vue, no i18n calls (English text is the key). Spec: `tests/console/payoutDetailsModel.spec.ts`.
 */
import {Color} from '@/common/Color';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPhaseSummaryModel, seatEnacts} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {InfluenceScaledEffect, InfluenceYield} from '@/common/parliament/influenceScaling';
import {LEVY_STEP_KEY, LevyReading} from '@/common/parliament/resolutionLevy';
import {REWARD_ADDRESS} from '@/common/parliament/rewardAddress';
import {GrantEligibility, GrantRecipients, grantEligibility, grantInfluenceLine} from '@/common/parliament/seatGrant';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {enactedLevyOf, enactedYieldsOf} from './influenceYieldModel';
import {ResultsPayoutPart, ResultsSeat, resultsPayoutPart} from './parliamentResultsModel';

export type PayoutDetailsSectionKind = 'rule' | 'levy' | 'winner' | 'grant' | 'reaction' | 'other';

/** ONE seat's line of a section: why (the reading of its rule) and what landed (the results card's own parts). */
export type PayoutDetailsRow = {
  player: Color;
  /** The seat won the vote — the crown beside its name, in every section. */
  winner: boolean;
  /** `rule`: the seat's RECORDED reading of the effect — the «why» the table prints. */
  reading?: InfluenceYield;
  /** `levy`: what the law took from the seat first. */
  levy?: LevyReading;
  /** `grant`: which clause of the rule of WHO took the seat in (or passed it over) — and the influence it read. */
  grant?: {eligibility: GrantEligibility, influence?: number, line?: number};
  /** What reached the seat by this section — the results card's own parts (a skip with its reason among them). */
  parts: ReadonlyArray<ResultsPayoutPart>;
};

export type PayoutDetailsSection = {
  /** Stable key — the effect's id, `levy`, `winner`, `grant`, `reaction:<party>`, `other:<step>`. */
  id: string;
  kind: PayoutDetailsSectionKind;
  /** `rule`: the scaled effect — the header prints the card's own formula of it. */
  effect?: InfluenceScaledEffect;
  /** `reaction`: the ruling party that answered. */
  party?: ReduxParty;
  /** `grant`: the rule of WHO — the header names the line. */
  recipients?: GrantRecipients;
  /** `other`: the section's English title key (the family's own, by the record's kind). */
  title?: string;
  /** The section concerns the winner of the vote ALONE — the header wears the crown, the rest are named once. */
  winnerOnly: boolean;
  rows: ReadonlyArray<PayoutDetailsRow>;
  /** `winnerOnly`: the other paid seats — never owed this part (one line, never a «0» per seat). */
  notOwed: ReadonlyArray<Color>;
};

export type PayoutDetails = {
  /** Who won the vote and by how many votes — the winner sections' head (`neutral` / absent: no player won). */
  winner?: {player: Color, votes: number, tieBreak?: 'slot-priority' | 'earlier-delegate'};
  sections: ReadonlyArray<PayoutDetailsSection>;
};

/** The section a record belongs to — by what the record IS, never by its text. */
function sectionKeyOf(outcome: ParliamentEnactOutcomeModel, resolution: IClientResolution): {key: string, kind: PayoutDetailsSectionKind, effect?: InfluenceScaledEffect} {
  if (outcome.kind === 'reaction') {
    return {key: `reaction:${outcome.party ?? ''}`, kind: 'reaction'};
  }
  if (outcome.step === LEVY_STEP_KEY) {
    return {key: 'levy', kind: 'levy'};
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

/** The title an `other` section speaks — the family of its first record (the colony ledger, a card payout, …). */
function otherTitleOf(outcome: ParliamentEnactOutcomeModel): string {
  if (outcome.colony !== undefined || outcome.kind === 'colonyBonus' || outcome.kind === 'discard') {
    return 'Colony bonuses';
  }
  return 'Resolution effect';
}

/**
 * THE READING. `seats` is the results card's own list of participating seats (its order is the order the rows
 * print in); `model` is the Parliament model the vote panel reads (the readers find the phase's outcomes in it).
 * A seat the law never pays (MarsBot, `enacts: false`) has a row only where it actually received something.
 */
export function payoutDetailsOf(
  resolution: IClientResolution,
  summary: ParliamentPhaseSummaryModel,
  model: ParliamentModel | undefined,
  seats: ReadonlyArray<ResultsSeat>,
): PayoutDetails {
  const winnerColor = summary.winner.player !== undefined && summary.winner.player !== 'neutral' ? summary.winner.player : undefined;
  const order = new Map<Color, number>(seats.map((seat, index) => [seat.player, index]));
  const paidSeats = seats.filter((seat) => seat.enacts !== false).map((seat) => seat.player);
  type Draft = {kind: PayoutDetailsSectionKind, effect?: InfluenceScaledEffect, party?: ReduxParty, title?: string, parts: Map<Color, Array<ResultsPayoutPart>>, records: Map<Color, ParliamentEnactOutcomeModel>};
  const drafts = new Map<string, Draft>();
  (summary.outcomes ?? []).forEach((outcome, index) => {
    // A WORLD record names no seat: it is the results card's planet line, never a payout.
    if (outcome.player === undefined || !order.has(outcome.player)) {
      return;
    }
    const {key, kind, effect} = sectionKeyOf(outcome, resolution);
    let draft = drafts.get(key);
    if (draft === undefined) {
      draft = {kind, parts: new Map(), records: new Map()};
      if (effect !== undefined) {
        draft.effect = effect;
      }
      if (kind === 'reaction' && outcome.party !== undefined) {
        draft.party = outcome.party as ReduxParty;
      }
      if (kind === 'other') {
        draft.title = otherTitleOf(outcome);
      }
      drafts.set(key, draft);
    }
    const parts = draft.parts.get(outcome.player) ?? [];
    parts.push(resultsPayoutPart(outcome, index, effect?.level));
    draft.parts.set(outcome.player, parts);
    if (!draft.records.has(outcome.player)) {
      draft.records.set(outcome.player, outcome);
    }
  });

  const recipients = resolution.tileGrant?.recipients ?? resolution.agendaGrant?.recipients;
  const byOrder = (a: Color, b: Color) => (order.get(a) ?? 0) - (order.get(b) ?? 0);
  const sections: Array<PayoutDetailsSection> = [];
  for (const [id, draft] of drafts) {
    const winnerOnly = draft.kind === 'winner' || draft.effect?.recipient === 'winner';
    const players = [...draft.parts.keys()].sort(byOrder);
    const rows = players.map((player): PayoutDetailsRow => {
      const row: PayoutDetailsRow = {player, winner: player === winnerColor, parts: draft.parts.get(player) ?? []};
      if (draft.kind === 'rule' && draft.effect !== undefined) {
        const effectId = draft.effect.id;
        const reading = enactedYieldsOf(resolution, model, player).find((y) => y.effect.id === effectId);
        if (reading !== undefined && reading.context !== 'reference') {
          row.reading = reading;
        }
      }
      if (draft.kind === 'levy') {
        const levy = enactedLevyOf(resolution, model, player);
        if (levy !== undefined) {
          row.levy = levy;
        }
      }
      if (draft.kind === 'grant' && recipients !== undefined) {
        const influence = draft.records.get(player)?.influence;
        const line = grantInfluenceLine(recipients);
        row.grant = {
          eligibility: grantEligibility(recipients, {winner: player === winnerColor, influence: influence ?? 0}),
          ...(influence === undefined ? {} : {influence}),
          ...(line === undefined ? {} : {line}),
        };
      }
      return row;
    });
    const notOwed = winnerOnly ? paidSeats.filter((player) => !draft.parts.has(player)).sort(byOrder) : [];
    sections.push({
      id,
      kind: draft.kind,
      ...(draft.effect === undefined ? {} : {effect: draft.effect}),
      ...(draft.party === undefined ? {} : {party: draft.party}),
      ...(draft.kind === 'grant' && recipients !== undefined ? {recipients} : {}),
      ...(draft.title === undefined ? {} : {title: draft.title}),
      winnerOnly,
      rows,
      notOwed,
    });
  }
  foldLevy(sections);
  // The levy is TAKEN FIRST (the printed order — «lose 10 M€, then …»), whatever order the records arrived in.
  sections.sort((a, b) => (a.kind === 'levy' ? -1 : 0) - (b.kind === 'levy' ? -1 : 0));
  return {
    ...(winnerColor === undefined ? {} : {winner: {player: winnerColor, votes: summary.winner.votes, ...(summary.winner.tieBreak === undefined ? {} : {tieBreak: summary.winner.tieBreak})}}),
    sections,
  };
}

/**
 * THE LEVY RIDES ITS PAYOUT'S ROW: where the law pays back in the levy's own currency (a budget — «−10 M€, then
 * +7 M€»), the seat's reading of that rule already prints the levy at its head and the day's net at its tail
 * (`ConsoleInfluenceYield`'s `levy`), so the levy's row MOVES into that rule's row (its reading and its part) —
 * one line per seat says the whole day. A levy with no such row stays its own section.
 */
function foldLevy(sections: Array<PayoutDetailsSection>): void {
  const index = sections.findIndex((section) => section.kind === 'levy');
  if (index < 0) {
    return;
  }
  const levy = sections[index];
  const kept: Array<PayoutDetailsRow> = [];
  for (const row of levy.rows) {
    const effectId = row.levy?.payout?.effectId;
    const target = effectId === undefined ? undefined : sections.find((section) => section.kind === 'rule' && section.effect?.id === effectId);
    const into = target?.rows.find((r) => r.player === row.player) as PayoutDetailsRow | undefined;
    if (into === undefined || row.levy === undefined) {
      kept.push(row);
      continue;
    }
    into.levy = row.levy;
    into.parts = [...row.parts, ...into.parts];
  }
  if (kept.length === 0) {
    sections.splice(index, 1);
  } else {
    sections[index] = {...levy, rows: kept};
  }
}

/** The step has something to explain — a quiet law (nothing paid to any seat) has no door. */
export function payoutDetailsAvailable(details: PayoutDetails | undefined): boolean {
  return details !== undefined && details.sections.some((section) => section.rows.length > 0);
}

/**
 * The details of the sitting ON SCREEN — the ONE construction both readers ask (the section, for the door and the
 * bar; the sitting, for the table): the summary's enacted law, the model's participating seats in its own order.
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
