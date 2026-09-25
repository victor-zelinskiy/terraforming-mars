import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ParliamentEnactedModel, ParliamentEnactOutcomeModel, ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
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

  /*
   * ПЛАНЕТА (Gas Export, RX12) — the WORLD's own part. It belongs to no seat,
   * so it is never a payout row; and the panel's law holds: the scales have
   * already moved on the board (the sitting stepped aside for exactly that),
   * so the line states the STEP and the one fact that is nowhere else — that
   * nobody was credited for it.
   */
  it('the WORLD’s moves are their own line, never a seat’s row', () => {
    const world = (step: string, over: Partial<ParliamentEnactOutcomeModel>): ParliamentEnactOutcomeModel =>
      ({step, part: 'world', kind: 'globalParameter', unrewarded: true, ...over}) as ParliamentEnactOutcomeModel;
    const reading = resultsReadingOf(summary({outcomes: [
      outcome({}),
      world('oxygen', {amount: -1, parameter: {id: 'oxygen', before: 5, after: 4}}),
      world('venus', {amount: 2, parameter: {id: 'venus', before: 10, after: 14}}),
    ]}), [seat(BLUE)], SUPPORT);
    expect(reading.payouts[0].parts.map((p) => p.kind), 'the seat’s row carries only the seat’s own record').deep.eq(['stock']);
    expect(reading.planet?.map((m) => `${m.parameter}:${m.before}→${m.after}:${m.steps}`))
      .deep.eq(['oxygen:5→4:-1', 'venus:10→14:2']);
    expect(reading.planet?.every((m) => m.unrewarded), 'nobody was credited — the one fact the scales cannot state').is.true;
    expect(reading.planet?.every((m) => m.skipped === undefined)).is.true;
  });

  it('…and a world move that did NOT happen is on the line too, with its reason', () => {
    const reading = resultsReadingOf(summary({outcomes: [
      {step: 'oxygen', part: 'world', kind: 'skipped', amount: 0, unrewarded: true,
        reason: 'Oxygen is at its maximum — it is not reduced', parameter: {id: 'oxygen', before: 14, after: 14}} as ParliamentEnactOutcomeModel,
    ]}), [seat(BLUE)], SUPPORT);
    expect(reading.planet).lengthOf(1);
    expect(reading.planet?.[0]).deep.include({parameter: 'oxygen', steps: 0, skipped: 'Oxygen is at its maximum — it is not reduced'});
  });

  /* Mohole Contest (RX23): the WINNER's own step of a parameter is the winner's record — the seat's row states the
   * step and the rating it paid; the planet line stays what it is, a move nobody made. */
  it('the WINNER’s own step of a parameter is a part of the winner’s row — the parameter, before → after, the TR — and never the planet line', () => {
    const reading = resultsReadingOf(summary({outcomes: [
      outcome({step: 'heat', kind: 'stock', stock: Resource.HEAT, amount: 6}),
      outcome({step: 'temperature', part: 'winner', kind: 'globalParameter', amount: 2, stock: undefined, parameter: {id: 'temperature', before: -20, after: -16}, tr: 2}),
    ]}), [seat(BLUE), seat(RED)], SUPPORT);
    expect(reading.planet, 'no world record — no planet line').is.undefined;
    const parts = reading.payouts[0].parts;
    expect(parts.map((p) => p.kind)).deep.eq(['stock', 'globalParameter']);
    expect(parts[1]).deep.include({amount: 2, tr: 2, unit: '', production: false});
    expect(parts[1].parameter).deep.eq({id: 'temperature', before: -20, after: -16});
    expect(parts[1].skipped, 'a step that moved is paid, never a skip').is.undefined;
    expect(reading.payouts[1].parts, 'the other seat has no part of it').deep.eq([]);
    // At the ceiling the step is a NAMED skip on the winner's row, under the winner's own title.
    const maxed = resultsReadingOf(summary({outcomes: [
      outcome({step: 'temperature', part: 'winner', kind: 'skipped', amount: 0, stock: undefined, reason: 'Temperature is at its maximum — it is not raised', parameter: {id: 'temperature', before: 8, after: 8}}),
    ]}), [seat(BLUE)], SUPPORT);
    expect(maxed.payouts[0].parts[0].skipped).deep.eq({title: 'Reward for the winner of the vote', reason: 'Temperature is at its maximum — it is not raised'});
    expect(maxed.planet).is.undefined;
  });

  it('a law that MOVED THE WORLD is never «quiet», even when it paid no seat', () => {
    const quiet = {kicker: 'Effect while enacted', kind: 'passive' as const};
    const world = {step: 'venus', part: 'world', kind: 'globalParameter', amount: 2, unrewarded: true,
      parameter: {id: 'venus', before: 10, after: 14}} as ParliamentEnactOutcomeModel;
    expect(resultsReadingOf(summary({outcomes: [world]}), [seat(BLUE)], SUPPORT, {quiet}).quiet,
      'the planet line IS its reading').is.undefined;
    expect(resultsReadingOf(summary({outcomes: []}), [seat(BLUE)], SUPPORT, {quiet}).quiet, 'a truly quiet law still says so').deep.eq(quiet);
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

  it('a LEVEL part at its target (Joint Research: a `target` record that owed nothing) reads CALMLY — «no draw needed» beside the reason, never «skipped»', () => {
    const atTarget = outcome({
      kind: 'skipped', amount: 0, stock: undefined, effect: 'draw', target: 9, total: {before: 11, after: 11}, reason: 'Already at the target hand size',
    });
    const reading = resultsReadingOf(summary({outcomes: [atTarget]}), [seat(BLUE)], SUPPORT);
    const part = reading.payouts[0].parts[0];
    expect(part.skipped, 'the server\'s reason still reads beside it').deep.eq({title: 'Resolution effect', reason: 'Already at the target hand size'});
    expect(part.none, 'the calm phrase the band and the panel print').eq('no draw needed');
    // A level part the DECK could not serve is a forfeit with its size — not the calm zero.
    const short = resultsReadingOf(summary({outcomes: [outcome({kind: 'skipped', amount: 4, stock: undefined, effect: 'draw', target: 9, total: {before: 5, after: 5}, reason: 'The project deck is empty'})]}), [seat(BLUE)], SUPPORT);
    expect(short.payouts[0].parts[0].none).is.undefined;
    // …and an ordinary skip without a target is what it always was.
    const plain = resultsReadingOf(summary({outcomes: [outcome({kind: 'skipped', amount: 0, stock: undefined, reason: 'No influence'})]}), [seat(BLUE)], SUPPORT);
    expect(plain.payouts[0].parts[0].none).is.undefined;
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

  it('a CITY TIER (Skyscrapers) carries its tile and the STACK the cell became — «×2» beside the city glyph, no amount; its skip names the rule', () => {
    const reading = resultsReadingOf(summary({outcomes: [
      outcome({step: 'city-tier', kind: 'city', stock: undefined, amount: undefined, space: '35', stackHeight: 2, influence: 2}),
      outcome({player: RED, step: 'city-tier', kind: 'skipped', stock: undefined, amount: undefined, influence: 1, reason: 'Below 2 influence and not the winner of the vote'}),
    ]}), [seat(BLUE), seat(RED)], SUPPORT);
    const part = reading.payouts[0].parts[0];
    expect(part).deep.include({kind: 'city', tile: 'city', stack: 2, unit: ''});
    expect(part.amount).is.undefined;
    expect(part.skipped).is.undefined;
    expect(reading.payouts[1].parts[0].skipped).deep.eq({title: 'Resolution effect', reason: 'Below 2 influence and not the winner of the vote'});
    expect(reading.payouts[1].parts[0].stack).is.undefined;
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

  it('a LEVY (Industrialist Budget) is a SIGNED supply part with its owed sum — never a skip; a short one carries its note; the seat\'s NET stands beside its parts', () => {
    const BUDGET = 'RDX_INDUSTRIALISTS_INDUSTRIALIST_BUDGET';
    const enacted: ParliamentEnactedModel = {instance: `${BUDGET}#0`, resolution: BUDGET, party: PartyName.INDUSTRIALISTS};
    const reading = resultsReadingOf(summary({
      enacted,
      winner: {instance: enacted.instance, resolution: BUDGET, party: PartyName.INDUSTRIALISTS, votes: 2, player: BLUE, slot: 0},
      outcomes: [
        outcome({step: 'levy', stock: Resource.MEGACREDITS, amount: -10, owed: 10, before: 40, after: 30}),
        outcome({step: 'megacredits', effect: 'megacredits', stock: Resource.MEGACREDITS, amount: 7, before: 30, after: 37}),
        outcome({step: 'production', effect: 'production', kind: 'production', production: Resource.MEGACREDITS, stock: undefined, amount: 4}),
        outcome({player: RED, step: 'levy', stock: Resource.MEGACREDITS, amount: -4, owed: 10, reason: 'Not enough M€: the rest of the levy is not taken', before: 4, after: 0}),
        outcome({player: RED, step: 'megacredits', effect: 'megacredits', kind: 'skipped', stock: Resource.MEGACREDITS, amount: 0, reason: 'No steel, titanium or energy production and no influence'}),
        outcome({player: RED, step: 'production', effect: 'production', kind: 'production', production: Resource.MEGACREDITS, stock: undefined, amount: 4}),
      ],
    }), [seat(BLUE), seat(RED)], SUPPORT);
    const [blue, red] = reading.payouts;
    expect(blue.parts.map((p) => [p.kind, p.amount, p.skipped === undefined])).to.deep.eq([['stock', -10, true], ['stock', 7, true], ['production', 4, true]]);
    expect(blue.parts[0]).to.deep.include({unit: 'megacredits', production: false, owed: 10});
    expect(blue.parts[0].note, 'a whole take has nothing to explain').is.undefined;
    expect(blue.net, 'the day\'s balance: −10 + 7').to.deep.eq({unit: 'megacredits', amount: -3});
    // Red: 4 of 10 taken with the shortfall's reason on the PAYING part, the payout a named skip — the net is the levy alone.
    expect(red.parts[0]).to.deep.include({kind: 'stock', amount: -4, owed: 10, note: 'Not enough M€: the rest of the levy is not taken'});
    expect(red.parts[0].skipped, 'a loss is never a skip').is.undefined;
    expect(red.parts[1].skipped).to.deep.eq({title: 'Resolution effect', reason: 'No steel, titanium or energy production and no influence'});
    expect(red.net).to.deep.eq({unit: 'megacredits', amount: -4});
    // A seat that never lost anything has no net line: its parts read as they are.
    const plain = resultsReadingOf(summary({outcomes: [outcome({amount: 2})]}), [seat(BLUE)], SUPPORT);
    expect(plain.payouts[0].net).is.undefined;
    // …and a levy skipped for an empty supply stays a skip with its own reason (the owed sum rides the part).
    const empty = resultsReadingOf(summary({outcomes: [outcome({step: 'levy', kind: 'skipped', stock: Resource.MEGACREDITS, amount: 0, owed: 10, reason: 'No M€ to pay the levy'})]}), [seat(BLUE)], SUPPORT);
    expect(empty.payouts[0].parts[0]).to.deep.include({kind: 'skipped', owed: 10, skipped: {title: 'Resolution effect', reason: 'No M€ to pay the levy'}});
    expect(empty.payouts[0].net).is.undefined;
  });
});
