import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ParliamentEnactOutcomeModel, ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {resultsReadingOf} from '@/client/console/parliament/parliamentResultsModel';

/*
 * ПАНЕЛЬ ИТОГОВ («Заседание v5» §4) — three sections and nothing beside them, because the panel shows
 * only what is NOWHERE ELSE on the screen. Its main content is the PAYOUTS: a seat watched its own
 * chips fly to its own rail and has never been shown anybody else's.
 */
const AQUIFER = 'RDX_GREENS_AQUIFER_CONTEST';
const ARCHITECTURE = 'RDX_MARS_ARCHITECTURE_AWARD';
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

function summary(over: Partial<ParliamentPhaseSummaryModel> = {}): ParliamentPhaseSummaryModel {
  return {
    generation: 4,
    final: false,
    winner: {instance: `${AQUIFER}#0`, resolution: AQUIFER, party: PartyName.GREENS, votes: 2, player: BLUE, slot: 0},
    support: [],
    enacted: {instance: `${AQUIFER}#0`, resolution: AQUIFER, party: PartyName.GREENS},
    refreshed: [],
    lobbyRefilled: [],
    ...over,
  } as ParliamentPhaseSummaryModel;
}

const outcome = (over: Partial<ParliamentEnactOutcomeModel>): ParliamentEnactOutcomeModel =>
  ({player: BLUE, step: 'effect', kind: 'stock', amount: 2, stock: Resource.PLANTS, ...over}) as ParliamentEnactOutcomeModel;

const SUPPORT: ReadonlyArray<{party: ReduxParty, support: number}> = [{party: PartyName.GREENS, support: 2}, {party: PartyName.MARS, support: 0}];

describe('parliamentResultsModel — the sitting\'s last reading, in three sections', () => {
  it('① ЗАКОН carries the enacted resolution, its party and the chairman\'s new quest', () => {
    const reading = resultsReadingOf(summary(), [BLUE], SUPPORT, {quest: {text: 'Play 2 building tags', generation: 5}, chairman: RED});
    expect(reading.law.resolution).eq(AQUIFER);
    expect(reading.law.party).eq(PartyName.GREENS);
    expect(reading.law.quest?.generation).eq(5);
    expect(reading.law.chairman).eq(RED);
  });

  it('② ВЫПЛАТЫ lists EVERY seat, in the seat order it is given — a seat the law paid nothing keeps its row', () => {
    const reading = resultsReadingOf(
      summary({outcomes: [outcome({}), outcome({player: RED, kind: 'production', amount: 1, production: Resource.HEAT, stock: undefined})]}),
      [BLUE, RED], SUPPORT);
    expect(reading.payouts.map((p) => p.player)).deep.eq([BLUE, RED]);
    expect(reading.payouts[0].parts.map((p) => `${p.kind}:${p.unit}:${p.amount}`)).deep.eq(['stock:plants:2']);
    expect(reading.payouts[1].parts.map((p) => `${p.kind}:${p.unit}:${p.production}`)).deep.eq(['production:heat:true']);
  });

  it('…and in SOLO it is the one row', () => {
    const reading = resultsReadingOf(summary({outcomes: [outcome({})]}), [BLUE], SUPPORT);
    expect(reading.payouts).lengthOf(1);
  });

  it('a SKIP names what it was and why — never a silent loss (law 4), exactly as on the reward beat', () => {
    const reading = resultsReadingOf(
      summary({outcomes: [outcome({kind: 'skipped', amount: undefined, stock: undefined, part: 'winner', reason: 'No free space for the tile'})]}),
      [BLUE], SUPPORT);
    expect(reading.payouts[0].parts[0].skipped).deep.eq({title: 'Reward for the winner of the vote', reason: 'No free space for the tile'});
  });

  it('a paying kind that paid ZERO is a skip too — the address names it', () => {
    const reading = resultsReadingOf(summary({outcomes: [outcome({kind: 'cards', amount: 0, stock: undefined})]}), [BLUE], SUPPORT);
    expect(reading.payouts[0].parts[0].skipped?.title).eq('Skipped: cards');
  });

  it('a resolution that pays NOBODY replaces the rows with what stands instead — never a column of empty rows', () => {
    const quiet = {kicker: 'Resolution effect', kind: 'passive' as const};
    const reading = resultsReadingOf(summary(), [BLUE, RED], SUPPORT, {quiet});
    expect(reading.quiet).deep.eq(quiet);
    const paid = resultsReadingOf(summary({outcomes: [outcome({})]}), [BLUE, RED], SUPPORT, {quiet});
    expect(paid.quiet, 'one paid seat and the rows are the reading').eq(undefined);
  });

  it('③ СТОЛ carries the new resolutions with their parties, the support after the deal, and the lobby', () => {
    const reading = resultsReadingOf(summary({
      refreshed: [{instance: `${ARCHITECTURE}#1`, resolution: ARCHITECTURE, party: PartyName.MARS, neutralVotes: 0}],
      discarded: [{instance: `${ARCHITECTURE}#1`, resolution: ARCHITECTURE, party: PartyName.MARS}],
      lobbyRefilled: [BLUE, RED],
    }), [BLUE], SUPPORT);
    expect(reading.table.fresh.map((f) => `${f.resolution}:${f.stays}`), 'a card dealt straight back never left the table')
      .deep.eq([`${ARCHITECTURE}:true`]);
    expect(reading.table.support.map((s) => `${s.party}:${s.total}`)).deep.eq([`${PartyName.GREENS}:2`, `${PartyName.MARS}:0`]);
    expect(reading.table.lobby).deep.eq([BLUE, RED]);
  });

  it('the RULING PARTY\'s own answer keeps its party — the emblem stands beside the amount', () => {
    const reading = resultsReadingOf(
      summary({outcomes: [outcome({kind: 'reaction', party: PartyName.GREENS, amount: 1, stock: Resource.MEGACREDITS})]}),
      [BLUE], SUPPORT);
    expect(reading.payouts[0].parts[0].party).eq(PartyName.GREENS);
  });

  it('an outcome of a seat outside the given order is dropped, never assigned to somebody else', () => {
    const reading = resultsReadingOf(summary({outcomes: [outcome({player: RED})]}), [BLUE], SUPPORT);
    expect(reading.payouts).lengthOf(1);
    expect(reading.payouts[0].parts).lengthOf(0);
  });
});
