import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ParliamentEnactOutcomeModel, ParliamentInfluenceReadModel, ParliamentModel, ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {getResolutionOrThrow} from '@/client/parliament/ClientParliamentManifest';
import {payoutDetailsAvailable, payoutDetailsOf} from '@/client/console/parliament/payoutDetailsModel';
import {ResultsSeat, resultsReadingOf} from '@/client/console/parliament/parliamentResultsModel';

/*
 * «ПОДРОБНОСТИ ВЫПЛАТ» (the owner, 2026-10-24; P71 · ledger CY) — one level below the results card's ledger: WHY each
 * seat got exactly what it got. A BREAKDOWN PER SEAT (a column read top-down): the influence the law READ with what it
 * was made of (the server's SNAPSHOT) and what it meant, a line per SOURCE (a tile, the levy, a part, the winner's
 * reward, the party's answer), and ИТОГО by the card's own function. Over the columns, ONE strip of the law: its
 * formula once, its rule of WHO, the seats a winner-only part was never owed to — once. Nothing is recomputed.
 */
const BUDGET = 'RDX_GREENS_GREENS_BUDGET';
const AQUIFER = 'RDX_GREENS_AQUIFER_CONTEST';
const COLONIAL = 'RDX_UNITY_COLONIAL_AFFAIRS';
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const BOT = 'green' as Color;

function summary(resolution: string, outcomes: ReadonlyArray<ParliamentEnactOutcomeModel>, over: Partial<ParliamentPhaseSummaryModel> = {}): ParliamentPhaseSummaryModel {
  return {
    generation: 4,
    final: false,
    winner: {instance: `${resolution}#0`, resolution, party: PartyName.GREENS, votes: 3, player: BLUE, slot: 0},
    outcomes,
    support: [],
    enacted: {instance: `${resolution}#0`, resolution, party: PartyName.GREENS},
    refreshed: [],
    lobbyRefilled: [],
    ...over,
  } as unknown as ParliamentPhaseSummaryModel;
}
const modelOf = (s: ParliamentPhaseSummaryModel) => ({phase: {outcomes: s.outcomes}}) as unknown as ParliamentModel;
const outcome = (over: Partial<ParliamentEnactOutcomeModel>): ParliamentEnactOutcomeModel =>
  ({player: BLUE, step: 'effect', kind: 'stock', amount: 2, stock: Resource.MEGACREDITS, ...over}) as ParliamentEnactOutcomeModel;
const seat = (player: Color, over: Partial<ResultsSeat> = {}): ResultsSeat => ({player, lobby: true, reserve: 3, ...over});

describe('payoutDetailsModel — WHY every seat got exactly what it got, seat by seat', () => {
  const budget = () => summary(BUDGET, [
    outcome({player: RED, step: 'megacredits', effect: 'megacredits', amount: 5, influence: 1, count: 4}),
    outcome({player: BLUE, step: 'megacredits', effect: 'megacredits', amount: 7, influence: 3, count: 4}),
    outcome({player: BLUE, step: 'levy', amount: -10, owed: 10}),
    outcome({player: RED, step: 'levy', amount: -6, owed: 10, reason: 'Pays only what it has'}),
    outcome({player: BLUE, step: 'animals', effect: 'animals', kind: 'skipped', amount: 2, reason: 'No card that can hold animals'}),
  ]);

  it('a column per seat in the card\'s order; the levy line FIRST (the printed order), a line per part, the skip named with the server\'s reason', () => {
    const s = budget();
    const details = payoutDetailsOf(getResolutionOrThrow(BUDGET), s, modelOf(s), [seat(BLUE), seat(RED)]);
    expect(details.seats.map((x) => x.player), 'the card\'s seat order, not the records\'').deep.eq([BLUE, RED]);
    const [blue, red] = details.seats;
    expect(blue.winner, 'the crown rides the winner\'s column').is.true;
    expect(blue.lines.map((l) => l.id)).deep.eq(['levy', 'rule:megacredits', 'rule:animals']);
    expect(blue.lines[0].levy).deep.include({paid: 10, owed: 10, short: false});
    expect(red.lines[0].levy, 'a short seat paid less').deep.include({paid: 6, owed: 10, short: true});
    expect(blue.lines[2].parts[0].skipped?.reason).eq('No card that can hold animals');
    expect(details.law.effects.map((e) => e.id), 'the law\'s formula — once, in its strip').deep.eq(getResolutionOrThrow(BUDGET).scaled?.map((e) => e.id));
    expect(details.law.notOwed).deep.eq([]);
  });

  it('every scaled part\'s RECORDED reading is printed exactly ONCE — in the influence block when its formula reads influence, else on its own line', () => {
    const s = budget();
    const details = payoutDetailsOf(getResolutionOrThrow(BUDGET), s, modelOf(s), [seat(BLUE), seat(RED)]);
    for (const column of details.seats) {
      const inBlock = (column.influence?.meanings ?? []).map((m) => m.effect.id);
      const onLines = column.lines.flatMap((l) => l.reading === undefined ? [] : [l.reading.effect.id]);
      expect([...inBlock, ...onLines].filter((id) => id === 'megacredits'), column.player).lengthOf(1);
      const reading = [...(column.influence?.meanings ?? []), ...column.lines.flatMap((l) => l.reading === undefined ? [] : [l.reading])].find((y) => y.effect.id === 'megacredits')!;
      expect([reading.influence, reading.count, reading.amount], 'the record\'s own numbers').deep.eq(column.player === BLUE ? [3, 4, 7] : [1, 4, 5]);
    }
  });

  it('the INFLUENCE the law read is the server\'s SNAPSHOT — the Career at its step and every giver by name; an older save prints the number alone', () => {
    const read: ParliamentInfluenceReadModel = {player: BLUE, total: 3, agendaStep: 3, track: 2, sources: [{amount: 1, source: 'Colonial Representation'}]};
    const s = summary(COLONIAL, [
      outcome({player: BLUE, step: 'colony:Luna', effect: 'colonyBonuses', kind: 'stock', amount: 6, influence: 3, multiplier: 3, colony: 'Luna' as never}),
      outcome({player: RED, step: 'colony:Luna', effect: 'colonyBonuses', kind: 'stock', amount: 4, influence: 1, multiplier: 2, colony: 'Luna' as never}),
    ], {influenceRead: [read]});
    const details = payoutDetailsOf(getResolutionOrThrow(COLONIAL), s, modelOf(s), [seat(BLUE), seat(RED)]);
    const [blue, red] = details.seats;
    expect(blue.influence).deep.include({total: 3, composition: {agendaStep: 3, track: 2, sources: [{amount: 1, source: 'Colonial Representation'}]}});
    expect(blue.influence?.meanings.map((m) => [m.effect.id, m.influence]), 'what it MEANT: ×k read at this influence').deep.eq([['colonyBonuses', 3]]);
    expect(red.influence?.total, 'the record\'s own number').eq(1);
    expect(red.influence?.composition, 'no snapshot (an older save) — never «bonuses 0»').is.undefined;
  });

  it('Colonial Affairs: a line per TILE, Pluto\'s k pairs merged into the line\'s totals «+3 [card] · ⌫3» with the tile\'s ×k', () => {
    const k = {multiplier: 3, influence: 2, effect: 'colonyBonuses'};
    const s = summary(COLONIAL, [
      outcome({step: 'colony:Luna', kind: 'stock', amount: 6, colony: 'Luna' as never, ...k}),
      ...[1, 2, 3].flatMap((n) => [
        outcome({step: `colony:Pluto:${n}:draw`, kind: 'cards', stock: undefined, amount: 1, colony: 'Pluto' as never, ...k}),
        outcome({step: `colony:Pluto:${n}:discard`, kind: 'discard', stock: undefined, amount: 1, colony: 'Pluto' as never, ...k}),
      ]),
    ]);
    const details = payoutDetailsOf(getResolutionOrThrow(COLONIAL), s, modelOf(s), [seat(BLUE)]);
    const lines = details.seats[0].lines;
    expect(lines.map((l) => [l.id, l.kind, l.times])).deep.eq([['colony:Luna', 'colony', 3], ['colony:Pluto', 'colony', 3]]);
    expect(lines[1].parts).lengthOf(6);
    expect(lines[1].totals.map((t) => [t.kind, t.amount])).deep.eq([['unit', 3], ['discard', 3]]);
  });

  it('ИТОГО is the card\'s own totals — the two surfaces read ONE function', () => {
    const s = budget();
    const seats = [seat(BLUE), seat(RED)];
    const details = payoutDetailsOf(getResolutionOrThrow(BUDGET), s, modelOf(s), seats);
    const card = resultsReadingOf(s, seats, []);
    expect(details.seats.map((x) => x.totals)).deep.eq(card.payouts.map((p) => p.totals));
  });

  it('a part for the WINNER alone is the winner\'s line; the other paid seats are named ONCE in the law\'s strip — the bot never', () => {
    const s = summary(AQUIFER, [
      outcome({player: BLUE, step: 'animals', effect: 'animals', kind: 'cardResource', amount: 2, influence: 2}),
      outcome({player: RED, step: 'animals', effect: 'animals', kind: 'cardResource', amount: 1, influence: 1}),
      outcome({player: BLUE, step: 'winner', part: 'winner', kind: 'ocean', parameter: {id: 'oceans', before: 3, after: 4}, tr: 1}),
      {step: 'oxygen', part: 'world', kind: 'globalParameter', parameter: {id: 'oxygen', before: 5, after: 6}} as ParliamentEnactOutcomeModel,
    ]);
    const details = payoutDetailsOf(getResolutionOrThrow(AQUIFER), s, modelOf(s), [seat(BLUE), seat(RED), seat(BOT, {enacts: false})]);
    expect(details.seats.map((x) => x.player), 'MarsBot, paid nothing, has no column').deep.eq([BLUE, RED]);
    expect(details.seats[0].lines.find((l) => l.kind === 'winner')?.parts[0].tile).eq('ocean');
    expect(details.seats[1].lines.some((l) => l.kind === 'winner')).is.false;
    expect(details.law.notOwed, 'the paid seats never owed it — never MarsBot, whom no law pays').deep.eq([RED]);
    expect(details.winner).deep.eq({player: BLUE, votes: 3});
    expect(details.seats.every((x) => x.lines.every((l) => l.parts.every((p) => p.id.startsWith(x.player)))), 'a world record is the planet line, never a seat\'s').is.true;
  });

  it('a law that paid no seat has no door', () => {
    const s = summary(BUDGET, []);
    expect(payoutDetailsAvailable(payoutDetailsOf(getResolutionOrThrow(BUDGET), s, modelOf(s), [seat(BLUE)]))).is.false;
    expect(payoutDetailsAvailable(undefined)).is.false;
  });
});
