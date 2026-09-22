import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ParliamentEnactOutcomeModel, ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {ResultsSeat, resultsReadingOf} from '@/client/console/parliament/parliamentResultsModel';

/*
 * ПАНЕЛЬ ИТОГОВ («Заседание v5» §4, «Итоги: честность») — TWO sections and nothing beside them, because
 * the panel shows only what is NOWHERE ELSE on the screen. Its main content is the PAYOUTS: a seat watched
 * its own chips fly to its own rail and has never been shown anybody else's. Two rows died of that one
 * law and the reading carries neither: the LAW line (the government's zone said all three, richer) and
 * В ЛОББИ (the delegates ledger states every seat's lobby socket and reserve by name, permanently). What
 * replaced the second is the EXCEPTION it never stated: who cannot vote at all next generation.
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

/** A participating seat as the panel reads it — armed by default (the lobby step refilled it). */
const seat = (player: Color, over: Partial<ResultsSeat> = {}): ResultsSeat => ({player, lobby: true, reserve: 3, ...over});

/** The LIVE stock per party, as the view reads it AFTER the deal (the Greens rule here — see `summary`). */
const SUPPORT: ReadonlyArray<{party: ReduxParty, support: number}> = [{party: PartyName.GREENS, support: 2}, {party: PartyName.MARS, support: 0}];

const supportRecord = (party: ReduxParty, gained: number, total: number): ParliamentPhaseSummaryModel['support'][number] =>
  ({party, gained, total, reason: 'absent'});

describe('parliamentResultsModel — the sitting\'s last reading, in two sections', () => {
  it('carries NO LAW: the enacted resolution, the ruling party and the chairman\'s quest stand in the government\'s zone', () => {
    const reading = resultsReadingOf(summary(), [seat(BLUE)], SUPPORT);
    expect(Object.keys(reading).sort(), 'the reading is the payouts and the table (plus the quiet pose)')
      .deep.eq(['payouts', 'table']);
    expect((reading as Record<string, unknown>).law, 'nothing of the law survives the reading').eq(undefined);
  });

  it('① ВЫПЛАТЫ lists EVERY seat, in the seat order it is given — a seat the law paid nothing keeps its row', () => {
    const reading = resultsReadingOf(
      summary({outcomes: [outcome({}), outcome({player: RED, kind: 'production', amount: 1, production: Resource.HEAT, stock: undefined})]}),
      [seat(BLUE), seat(RED)], SUPPORT);
    expect(reading.payouts.map((p) => p.player)).deep.eq([BLUE, RED]);
    expect(reading.payouts[0].parts.map((p) => `${p.kind}:${p.unit}:${p.amount}`)).deep.eq(['stock:plants:2']);
    expect(reading.payouts[1].parts.map((p) => `${p.kind}:${p.unit}:${p.production}`)).deep.eq(['production:heat:true']);
  });

  it('…and in SOLO it is the one row', () => {
    const reading = resultsReadingOf(summary({outcomes: [outcome({})]}), [seat(BLUE)], SUPPORT);
    expect(reading.payouts).lengthOf(1);
  });

  it('a SKIP names what it was and why — never a silent loss (law 4), exactly as on the reward beat', () => {
    const reading = resultsReadingOf(
      summary({outcomes: [outcome({kind: 'skipped', amount: undefined, stock: undefined, part: 'winner', reason: 'No free space for the tile'})]}),
      [seat(BLUE)], SUPPORT);
    expect(reading.payouts[0].parts[0].skipped).deep.eq({title: 'Reward for the winner of the vote', reason: 'No free space for the tile'});
  });

  it('a paying kind that paid ZERO is a skip too — the address names it', () => {
    const reading = resultsReadingOf(summary({outcomes: [outcome({kind: 'cards', amount: 0, stock: undefined})]}), [seat(BLUE)], SUPPORT);
    expect(reading.payouts[0].parts[0].skipped?.title).eq('Skipped: cards');
  });

  it('a resolution that pays NOBODY replaces the rows with what stands instead — never a column of empty rows', () => {
    const quiet = {kicker: 'Resolution effect', kind: 'passive' as const};
    const reading = resultsReadingOf(summary(), [seat(BLUE), seat(RED)], SUPPORT, {quiet});
    expect(reading.quiet).deep.eq(quiet);
    const paid = resultsReadingOf(summary({outcomes: [outcome({})]}), [seat(BLUE), seat(RED)], SUPPORT, {quiet});
    expect(paid.quiet, 'one paid seat and the rows are the reading').eq(undefined);
  });

  it('② СТОЛ carries the new resolutions with their parties — and never who got a delegate back', () => {
    const reading = resultsReadingOf(summary({
      refreshed: [{instance: `${ARCHITECTURE}#1`, resolution: ARCHITECTURE, party: PartyName.MARS, neutralVotes: 0}],
      discarded: [{instance: `${ARCHITECTURE}#1`, resolution: ARCHITECTURE, party: PartyName.MARS}],
      lobbyRefilled: [BLUE, RED],
    }), [seat(BLUE)], SUPPORT);
    // «Обновление»: a card dealt straight back from the reshuffled discard LEFT the table and was dealt again — the tact
    // showed exactly that, so the panel names it as a fresh resolution like any other. Nothing says «stays».
    expect(reading.table.fresh.map((f) => f.resolution)).deep.eq([ARCHITECTURE]);
    expect(Object.keys(reading.table.fresh[0]).sort()).deep.eq(['instance', 'party', 'resolution']);
    expect((reading.table as Record<string, unknown>).lobby, 'the refilled seats belong to the delegates ledger, not to the panel').eq(undefined);
    expect(reading.table.noDelegate, 'both seats can vote, so the exception is empty').deep.eq([]);
  });

  describe('БЕЗ СВОБОДНОГО ДЕЛЕГАТА — the exception, never a roster', () => {
    it('names the seats that enter the next vote with an empty lobby AND an empty reserve', () => {
      const reading = resultsReadingOf(summary({lobbyRefilled: [RED]}), [
        seat(BLUE, {lobby: false, reserve: 0}),
        seat(RED, {lobby: true, reserve: 0}),
      ], SUPPORT);
      expect(reading.table.noDelegate, 'RED holds a delegate in its lobby; BLUE has none and nothing to refill from')
        .deep.eq([BLUE]);
    });

    it('an empty lobby with a stocked reserve is NOT the exception — the next lobby step refills it', () => {
      const reading = resultsReadingOf(summary(), [seat(BLUE, {lobby: false, reserve: 2})], SUPPORT);
      expect(reading.table.noDelegate).deep.eq([]);
    });

    it('…and it is read from the SEATS, never from `lobbyRefilled`: a seat that never spent its delegate is not in that record', () => {
      // The server refilled nobody (both lobbies were already full) — the step's record is empty and every
      // seat can vote. A row derived from `lobbyRefilled` would have called that «nobody got one».
      const reading = resultsReadingOf(summary({lobbyRefilled: []}), [seat(BLUE), seat(RED)], SUPPORT);
      expect(reading.table.noDelegate).deep.eq([]);
    });
  });

  describe('НАРОДНАЯ ПОДДЕРЖКА — a STOCK in places, never this deal\'s increment', () => {
    it('the quantity is the LIVE stock after the deal, not the total the support step wrote', () => {
      // The server granted the Mars party a delegate; the deal then dealt it a card and moved its whole
      // stock onto it as votes. What stands on the table is ZERO, and that is what the row says.
      const reading = resultsReadingOf(
        summary({support: [supportRecord(PartyName.MARS, 1, 3)]}),
        [seat(BLUE)],
        [{party: PartyName.MARS, support: 0}, {party: PartyName.REDS, support: 2}]);
      expect(reading.table.support.map((s) => `${s.party}:${s.total}`)).deep.eq([`${PartyName.MARS}:0`, `${PartyName.REDS}:2`]);
    });

    it('this sitting\'s arrivals are MARKED, and the mark is never bigger than the stock it marks', () => {
      const reading = resultsReadingOf(
        summary({support: [supportRecord(PartyName.MARS, 2, 3), supportRecord(PartyName.REDS, 1, 1)]}),
        [seat(BLUE)],
        // Mars kept its three; the Reds' single delegate left with the card the deal gave them.
        [{party: PartyName.MARS, support: 3}, {party: PartyName.REDS, support: 0}, {party: PartyName.SCIENTISTS, support: 1}]);
      expect(reading.table.support.map((s) => `${s.party}:${s.total}/${s.fresh}`)).deep.eq([
        `${PartyName.MARS}:3/2`,
        `${PartyName.REDS}:0/0`,
        `${PartyName.SCIENTISTS}:1/0`,
      ]);
    });

    it('a gain the server CAPPED at three marks only what actually landed (`gained` is the server\'s own count)', () => {
      const reading = resultsReadingOf(
        summary({support: [supportRecord(PartyName.MARS, 0, 3)]}),
        [seat(BLUE)], [{party: PartyName.MARS, support: 3}]);
      expect(reading.table.support[0], 'the full party gained nothing, so nothing is fresh').deep.eq({party: PartyName.MARS, total: 3, fresh: 0});
    });

    it('THE RULING PARTY IS NOT IN THE ROW — its stock is zero by construction and its plaque is in the government', () => {
      const reading = resultsReadingOf(
        summary({support: [supportRecord(PartyName.MARS, 1, 1)]}),
        [seat(BLUE)],
        [{party: PartyName.GREENS, support: 0}, {party: PartyName.MARS, support: 1}]);
      expect(reading.table.support.map((s) => s.party), 'the Greens enacted the law and rule by it').deep.eq([PartyName.MARS]);
    });
  });

  it('THE FINAL PHASE still has a panel: no deal, no lobby — but every seat keeps its payout row and the stocks are stated', () => {
    // The last sitting enacts and pays, then stops: the area is not refreshed and the lobby is not
    // refilled. What is left must still be a reading, never an empty frame.
    const reading = resultsReadingOf(
      summary({final: true, refreshed: [], lobbyRefilled: [], outcomes: [outcome({}), outcome({player: RED, kind: 'stock', amount: 3, stock: Resource.STEEL})]}),
      [seat(BLUE), seat(RED)], SUPPORT);
    expect(reading.payouts.map((p) => p.parts.length), 'both seats are paid and both rows stand').deep.eq([1, 1]);
    expect(reading.table.fresh, 'nothing was dealt').deep.eq([]);
    expect(reading.table.noDelegate, 'both seats still hold a delegate').deep.eq([]);
    expect(reading.table.support.map((s) => s.party), 'the stocks are still the one thing seen nowhere else').deep.eq([PartyName.MARS]);
  });

  it('a COLONY-PAID part (Colonial Affairs) carries its tile — the panel groups a seat\'s parts by it — and a HUD-side bonus its description; a discard speaks the card unit', () => {
    const reading = resultsReadingOf(summary({outcomes: [
      outcome({step: 'colony:Luna', kind: 'stock', stock: Resource.MEGACREDITS, amount: 6, colony: 'Luna' as never, multiplier: 3}),
      outcome({step: 'colony:Pluto:1:draw', kind: 'cards', stock: undefined, amount: 1, colony: 'Pluto' as never, multiplier: 3}),
      outcome({step: 'colony:Pluto:1:discard', kind: 'discard', stock: undefined, amount: 1, card: 'Fish' as never, colony: 'Pluto' as never, multiplier: 3}),
      outcome({step: 'colony:Titania', kind: 'colonyBonus', stock: Resource.MEGACREDITS, amount: -6, colony: 'Titania' as never, multiplier: 2, description: 'Lose 3 M€'}),
      outcome({step: 'colony:Iapetus', kind: 'colonyBonus', stock: undefined, amount: 2, colony: 'Iapetus' as never, multiplier: 2, description: 'Pay 1 M€ less for cards this generation'}),
    ]}), [seat(BLUE)], SUPPORT);
    const parts = reading.payouts[0].parts;
    expect(parts.map((p) => `${p.colony}:${p.kind}:${p.unit}:${p.amount}`)).deep.eq([
      'Luna:stock:megacredits:6', 'Pluto:cards:cards:1', 'Pluto:discard:cards:1', 'Titania:colonyBonus:megacredits:-6', 'Iapetus:colonyBonus::2',
    ]);
    expect(parts.map((p) => p.description)).deep.eq([undefined, undefined, undefined, 'Lose 3 M€', 'Pay 1 M€ less for cards this generation']);
    expect(parts.every((p) => p.skipped === undefined), 'a loss is a payout, never a skip').is.true;
  });

  it('the RULING PARTY\'s own answer keeps its party — the emblem stands beside the amount', () => {
    const reading = resultsReadingOf(
      summary({outcomes: [outcome({kind: 'reaction', party: PartyName.GREENS, amount: 1, stock: Resource.MEGACREDITS})]}),
      [seat(BLUE)], SUPPORT);
    expect(reading.payouts[0].parts[0].party).eq(PartyName.GREENS);
  });

  it('an outcome of a seat outside the given order is dropped, never assigned to somebody else', () => {
    const reading = resultsReadingOf(summary({outcomes: [outcome({player: RED})]}), [seat(BLUE)], SUPPORT);
    expect(reading.payouts).lengthOf(1);
    expect(reading.payouts[0].parts).lengthOf(0);
  });
});
