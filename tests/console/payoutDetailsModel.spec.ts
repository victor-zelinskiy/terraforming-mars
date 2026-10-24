import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {getResolutionOrThrow} from '@/client/parliament/ClientParliamentManifest';
import {payoutDetailsAvailable, payoutDetailsOf} from '@/client/console/parliament/payoutDetailsModel';
import {ResultsSeat} from '@/client/console/parliament/parliamentResultsModel';

/*
 * «ПОДРОБНОСТИ ВЫПЛАТ» (the owner, 2026-10-24) — one level below the results card's payouts: WHY each seat got
 * exactly what it got. A table per RULE of the law (the levy first, the printed order), a row per seat with the
 * seat's RECORDED reading, a part for the winner alone named once for everybody else — never a «0» per seat.
 */
const BUDGET = 'RDX_GREENS_GREENS_BUDGET';
const AQUIFER = 'RDX_GREENS_AQUIFER_CONTEST';
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const BOT = 'green' as Color;

function summary(resolution: string, outcomes: ReadonlyArray<ParliamentEnactOutcomeModel>): ParliamentPhaseSummaryModel {
  return {
    generation: 4,
    final: false,
    winner: {instance: `${resolution}#0`, resolution, party: PartyName.GREENS, votes: 3, player: BLUE, slot: 0},
    outcomes,
    support: [],
    enacted: {instance: `${resolution}#0`, resolution, party: PartyName.GREENS},
    refreshed: [],
    lobbyRefilled: [],
  } as unknown as ParliamentPhaseSummaryModel;
}
const modelOf = (s: ParliamentPhaseSummaryModel) => ({phase: {outcomes: s.outcomes}}) as unknown as ParliamentModel;
const outcome = (over: Partial<ParliamentEnactOutcomeModel>): ParliamentEnactOutcomeModel =>
  ({player: BLUE, step: 'effect', kind: 'stock', amount: 2, stock: Resource.MEGACREDITS, ...over}) as ParliamentEnactOutcomeModel;
const seat = (player: Color, over: Partial<ResultsSeat> = {}): ResultsSeat => ({player, lobby: true, reserve: 3, ...over});

describe('payoutDetailsModel — WHY every seat got exactly what it got', () => {
  it('a table per rule, a row per seat in the card\'s order, each with its recorded reading; the levy rides its payout\'s row', () => {
    const s = summary(BUDGET, [
      outcome({player: RED, step: 'megacredits', effect: 'megacredits', amount: 5, influence: 1, count: 4}),
      outcome({player: BLUE, step: 'megacredits', effect: 'megacredits', amount: 7, influence: 3, count: 4}),
      outcome({player: BLUE, step: 'levy', amount: -10, owed: 10}),
      outcome({player: RED, step: 'levy', amount: -6, owed: 10, reason: 'Pays only what it has'}),
      outcome({player: BLUE, step: 'animals', effect: 'animals', kind: 'skipped', amount: 2, reason: 'No card that can hold animals'}),
    ]);
    const details = payoutDetailsOf(getResolutionOrThrow(BUDGET), s, modelOf(s), [seat(BLUE), seat(RED)]);
    expect(details.sections.map((x) => x.id), 'the levy is read at the head of the M€ payout — no section of its own').deep.eq(['rule:megacredits', 'rule:animals']);
    const mc = details.sections[0];
    expect(mc.kind).eq('rule');
    expect(mc.effect?.id).eq('megacredits');
    expect(mc.rows.map((r) => r.player), 'the card\'s seat order, not the records\'').deep.eq([BLUE, RED]);
    expect(mc.rows.map((r) => [r.reading?.influence, r.reading?.count, r.reading?.amount])).deep.eq([[3, 4, 7], [1, 4, 5]]);
    expect(mc.rows[0].winner, 'the crown rides the winner\'s row').is.true;
    expect(mc.winnerOnly).is.false;
    expect(mc.notOwed).deep.eq([]);
    const animals = details.sections[1];
    expect(animals.rows[0].parts[0].skipped?.reason, 'a skip names itself with the server\'s reason').eq('No card that can hold animals');
    expect(mc.rows.map((r) => [r.levy?.paid, r.levy?.owed, r.levy?.short]), 'each seat\'s levy as recorded — a short seat paid less').deep.eq([[10, 10, false], [6, 10, true]]);
    expect(mc.rows.map((r) => r.parts.map((p) => p.amount)), 'what moved: the levy first, then the payout').deep.eq([[-10, 7], [-6, 5]]);
  });

  it('a part for the WINNER alone is its own section, the other paid seats named once — the bot never', () => {
    const s = summary(AQUIFER, [
      outcome({player: BLUE, step: 'animals', effect: 'animals', kind: 'cardResource', amount: 2, influence: 2}),
      outcome({player: RED, step: 'animals', effect: 'animals', kind: 'cardResource', amount: 1, influence: 1}),
      outcome({player: BLUE, step: 'winner', part: 'winner', kind: 'ocean', parameter: {id: 'oceans', before: 3, after: 4}, tr: 1}),
      {step: 'oxygen', part: 'world', kind: 'globalParameter', parameter: {id: 'oxygen', before: 5, after: 6}} as ParliamentEnactOutcomeModel,
    ]);
    const details = payoutDetailsOf(getResolutionOrThrow(AQUIFER), s, modelOf(s), [seat(BLUE), seat(RED), seat(BOT, {enacts: false})]);
    const winner = details.sections.find((x) => x.kind === 'winner');
    expect(winner?.winnerOnly).is.true;
    expect(winner?.rows.map((r) => r.player)).deep.eq([BLUE]);
    expect(winner?.rows[0].parts[0].tile).eq('ocean');
    expect(winner?.notOwed, 'the paid seats that were never owed it — never MarsBot, whom no law pays').deep.eq([RED]);
    expect(details.winner).deep.eq({player: BLUE, votes: 3});
    expect(details.sections.every((x) => x.rows.every((r) => r.player !== undefined)), 'a world record is the planet line, never a row').is.true;
    expect(details.sections.map((x) => x.id)).deep.eq(['rule:animals', 'winner']);
  });

  it('a law that paid no seat has no door', () => {
    const s = summary(BUDGET, []);
    expect(payoutDetailsAvailable(payoutDetailsOf(getResolutionOrThrow(BUDGET), s, modelOf(s), [seat(BLUE)]))).is.false;
    expect(payoutDetailsAvailable(undefined)).is.false;
  });
});
