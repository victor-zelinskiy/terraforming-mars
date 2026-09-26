import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {Tag} from '@/common/cards/Tag';
import {
  ParliamentEnactedModel, ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPhaseSummaryModel, ParliamentPlayerModel,
} from '@/common/models/ParliamentModel';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import {
  enactedYieldsOf, voteLevyOf, voteYieldsOf, yieldCaptionOf, yieldCountPresentation, yieldIconOf, yieldInfluenceEnters, yieldIsFlat,
} from '@/client/console/parliament/influenceYieldModel';
import {voteReadingOf} from '@/client/console/parliament/voteInfoModel';
import {voteLedgerOf, ledgerPartText} from '@/client/console/parliament/voteLedgerModel';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * URBAN RESEARCH (Turmoil Redux, RX31) — THE READINGS OF A COUNTED DRAW.
 *
 * The card writes no reading of its own; what is pinned here is that the
 * shipped ones compose for a combination they had never met — a `cards` unit
 * whose amount is a COUNT (it had only ever been flat, a level or sequential):
 *  · the draw reads as a RATE, with the count and the cards that made it, and
 *    the money reads by influence — two rows, never one sum (a hand of cards
 *    and a pocket of M€ are different quantities, with nothing to add them by);
 *  · the two halves carry different terms: influence enters the money and NOT
 *    the draw, so the draw's block prints no influence cluster and its zero
 *    is the count's own («No city tags»), never «and no influence»;
 *  · a SHORT deck names both numbers («+1 / 2») — the habit a plain `cards`
 *    record lost once already (RX27 fixed it for the flat draw; a counted one
 *    takes the same road);
 *  · the LEDGER OF OUTCOMES computes a rival's chip from THEIR tags and THEIR
 *    influence — the whole point of the row, and the one place where feeding
 *    the viewer's own count into a neighbour's column would not fail, only lie.
 */
const LAW_ID = 'RDX_MARS_URBAN_RESEARCH';
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

const law = () => {
  const resolution = getResolution(LAW_ID);
  if (resolution === undefined) {
    throw new Error(`${LAW_ID} is not in the client manifest`);
  }
  return resolution;
};

/** A seat of the table: the city-tag count the server carries for it, and its influence. */
function seat(color: Color, agenda: number, influence: number, count: number): ParliamentPlayerModel {
  return {
    color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence,
    access: [], partyActionUses: {}, resolutionActionUses: 0,
    counts: [{
      id: 'cityTags', count,
      cards: count === 0 ? [] : [CardName.LUNA_ECUMENOPOLIS, CardName.CAPITAL],
      units: count === 0 ? [] : [2, 1],
    }],
  };
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.MARS, popularSupport: {}, players, deckSize: 4, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

const ENACTED: ParliamentEnactedModel = {instance: `${LAW_ID}#0`, resolution: LAW_ID, party: PartyName.MARS};

function phase(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel>): ParliamentPhaseSummaryModel {
  return {
    generation: 3, final: false,
    winner: {instance: ENACTED.instance, resolution: LAW_ID, party: PartyName.MARS, votes: 2},
    outcomes: [...outcomes], support: [], enacted: ENACTED, refreshed: [], lobbyRefilled: [],
  };
}

/** The server's own two records for one seat: the counted draw and the money. */
const DRAW: ParliamentEnactOutcomeModel = {
  player: BLUE, step: 'draw', part: 'effect', effect: 'draw', kind: 'cards', amount: 3, drawn: 3, influence: 3,
  count: 3, counted: [CardName.LUNA_ECUMENOPOLIS, CardName.CAPITAL], countedUnits: [2, 1],
};
const PAYOUT: ParliamentEnactOutcomeModel = {
  player: BLUE, step: 'megacredits', part: 'effect', effect: 'megacredits', kind: 'stock', stock: Resource.MEGACREDITS,
  amount: 6, influence: 3, before: 30, after: 36,
};

const t = {global: {mocks: {$t: (key: string) => key}}};

describe('Urban Research — the readings of a counted draw', () => {
  it('the shipped manifest declares a DRAW sized by the city-tag count and money by influence alone — no levy, no cap', () => {
    const resolution = law();
    expect(resolution.code).eq('RX31');
    expect(resolution.party).eq(PartyName.MARS);
    expect(resolution.levy, 'nothing is paid for it').is.undefined;
    const [draw, money] = resolution.scaled ?? [];
    expect(draw).deep.eq({id: 'draw', unit: {kind: 'cards'}, perInfluence: 0, count: {id: 'cityTags', per: 1}, recipient: 'each'});
    expect(money).deep.eq({id: 'megacredits', unit: {kind: 'stock', resource: Resource.MEGACREDITS}, perInfluence: 2, recipient: 'each'});
    expect(yieldIconOf(draw)).deep.eq({family: 'cards'});
    expect(yieldIconOf(money)).deep.eq({family: 'resource', resource: Resource.MEGACREDITS, production: false});
    // THE TWO HALVES CARRY DIFFERENT TERMS, and the readings are told so by the declaration alone.
    expect(yieldIsFlat(draw), 'a counted draw is not «the same for every player»').is.false;
    expect(yieldInfluenceEnters(draw), 'the card prints no influence beside the card glyph').is.false;
    expect(yieldInfluenceEnters(money)).is.true;
    expect(draw.cap, 'no maximum is printed').is.undefined;
    expect(resolution.quest).deep.eq({goal: {kind: 'tag', tag: Tag.CITY}, count: 1});
    expect(familyOf(resolution)).eq('counted-tags');
  });

  it('the count explains itself with the printed CITY MEDALLION — and its rule says out loud that a city on the board is not a tag', () => {
    expect(yieldCountPresentation('cityTags')).deep.eq({
      glyph: {kind: 'tag', tag: Tag.CITY},
      pluralKey: '${0} city tag(s)',
      ruleKey: 'Each city tag on your cards counts: a card with two city tags counts twice. Wild tags do not count, and a city on the board is not a tag.',
      skipReasonKey: 'No city tags',
    });
    // The three city counts over the BOARD keep their own words — no reading can confuse the four.
    expect(yieldCountPresentation('marsCities').glyph).deep.eq({kind: 'tile', tile: 'marsCity'});
    expect(yieldCountPresentation('marsCityTiers').glyph).deep.eq({kind: 'tile', tile: 'marsCity'});
    expect(yieldCountPresentation('spaceCities').glyph).deep.eq({kind: 'tile', tile: 'spaceCity'});
  });

  it('the vote reading: «3 city tags → +3 cards» and «influence 2 → +4 M€» — two rows, and the cards are never added to the money', () => {
    const resolution = law();
    const m = model([seat(BLUE, 4, 2, 3)]);
    const yields = voteYieldsOf(resolution, m, BLUE);
    expect(yields.map((y) => `${y.effect.id}:${y.context}`)).deep.eq(['draw:estimate', 'megacredits:estimate', 'megacredits:forecast']);
    // THE DRAW: the count is the reading's input and the cards behind it explain the number.
    expect(yields[0]).deep.include({count: 3, amount: 3, influence: 2});
    expect(yields[0].counted).deep.eq([CardName.LUNA_ECUMENOPOLIS, CardName.CAPITAL]);
    expect(yields[0].countedUnits, 'Luna Ecumenopolis prints two').deep.eq([2, 1]);
    expect(yieldCaptionOf(yields[0]), 'a counted term is preliminary and says so').deep.eq({key: 'If enacted now'});
    // THE MONEY: influence alone, and a win takes the marker one Agenda step first.
    expect(yields[1]).deep.include({amount: 4, influence: 2});
    expect(yields[1].count, 'the money counts nothing').is.undefined;
    expect(yields[2], 'the forecast is the money\'s alone — the cards do not move with the Agenda').deep.include({influence: 3, amount: 6, agendaStep: 5});
    expect(voteLevyOf(resolution, m, BLUE), 'no levy, so no net line to state').is.undefined;
    // There is no row that sums them: a hand of cards and a pocket of M€ are two quantities.
    expect(new Set(yields.map((y) => y.effect.unit.kind))).deep.eq(new Set(['cards', 'stock']));
  });

  it('a seat with no city tag reads the DRAW\'s own zero and keeps its money; a seat with no influence reads the other way round', () => {
    const resolution = law();
    const noTags = voteYieldsOf(resolution, model([seat(BLUE, 4, 2, 0)]), BLUE);
    expect(noTags[0]).deep.include({count: 0, amount: 0});
    expect(noTags[1], 'the money is untouched by the missing tags').deep.include({amount: 4});
    const noInfluence = voteYieldsOf(resolution, model([seat(BLUE, 0, 0, 3)]), BLUE);
    expect(noInfluence[0], 'and the cards are untouched by the missing influence').deep.include({count: 3, amount: 3});
    expect(noInfluence[1]).deep.include({amount: 0, influence: 0});
  });

  it('an ENACTED law reads the RECORDS — the draw with its frozen count, the money with its influence — never today\'s tableau', () => {
    const resolution = law();
    // Today the seat has grown to nine tags and influence 5; the reading is the record.
    const m = model([seat(BLUE, 5, 5, 9)], {enacted: ENACTED, lastPhase: phase([DRAW, PAYOUT])});
    const yields = enactedYieldsOf(resolution, m, BLUE);
    expect(yields[0]).deep.include({context: 'applied', amount: 3, count: 3, influence: 3});
    expect(yields[0].countedUnits).deep.eq([2, 1]);
    expect(yields[0].delivered, 'the whole draw landed — nothing to qualify').is.undefined;
    expect(yieldCaptionOf(yields[0])).deep.eq({key: 'Received'});
    expect(yields[1]).deep.include({context: 'applied', amount: 6, influence: 3});
  });

  it('a SHORT deck names BOTH numbers («+1 / 3»); an EMPTY one is the draw\'s own named skip — and neither touches the money', () => {
    const resolution = law();
    const short = model([seat(BLUE, 5, 3, 3)], {enacted: ENACTED, lastPhase: phase([{...DRAW, drawn: 1}, PAYOUT])});
    const [drawn, paid] = enactedYieldsOf(resolution, short, BLUE);
    expect(drawn).deep.include({context: 'applied', amount: 3, delivered: 1, count: 3});
    expect(mount(ConsoleInfluenceYield, {props: {yields: [drawn]}, ...t}).find('[data-yield-amount]').text()).includes('+1 / 3');
    expect(paid, 'the money is untouched by what the deck could not deliver').deep.include({amount: 6});

    const empty = model([seat(BLUE, 5, 3, 3)], {enacted: ENACTED, lastPhase: phase([
      {...DRAW, kind: 'skipped', drawn: 0, reason: 'The project deck is empty'},
      PAYOUT,
    ])});
    const [none] = enactedYieldsOf(resolution, empty, BLUE);
    expect(none).deep.include({context: 'applied', amount: 3, skipped: 'The project deck is empty'});
    expect(yieldCaptionOf(none)).deep.eq({key: 'The project deck is empty'});

    const noTags = model([seat(BLUE, 0, 0, 0)], {enacted: ENACTED, lastPhase: phase([
      {...DRAW, kind: 'skipped', amount: 0, drawn: 0, count: 0, counted: [], countedUnits: [], influence: 0, reason: 'No city tags'},
      {...PAYOUT, kind: 'skipped', amount: 0, influence: 0, reason: 'No influence', before: undefined, after: undefined},
    ])});
    const [noCards, noMoney] = enactedYieldsOf(resolution, noTags, BLUE);
    expect(noCards, 'the draw\'s own zero').deep.include({skipped: 'No city tags', amount: 0, count: 0});
    expect(noMoney, 'and the money\'s own — never one shared «nothing happened»').deep.include({skipped: 'No influence', amount: 0});
  });

  it('THE LEDGER OF OUTCOMES counts a RIVAL by THEIR tags and THEIR influence — never the viewer\'s', () => {
    const resolution = law();
    // The viewer has one city tag and influence 1; the rival has three tags and influence 3.
    const m = model([seat(BLUE, 1, 1, 1), seat(RED, 5, 3, 3)]);
    const chips = voteLedgerOf({resolution, model: m, viewer: BLUE, players: [{color: BLUE, tableau: []}, {color: RED, tableau: []}]});
    expect(chips.map((c) => c.color), 'the viewer first, then the model\'s own order').deep.eq([BLUE, RED]);
    expect(chips[0].you).is.true;
    expect(chips[0].parts.map((p) => `${p.key}:${ledgerPartText(p)}`)).deep.eq(['draw:+1', 'megacredits:+2']);
    expect(chips[1].you).is.false;
    expect(chips[1].parts.map((p) => `${p.key}:${ledgerPartText(p)}`), 'the rival\'s own count and own influence').deep.eq(['draw:+3', 'megacredits:+6']);
    // …and the viewer's own big reading is unchanged by the row beside it.
    expect(voteYieldsOf(resolution, m, BLUE)[0]).deep.include({count: 1, amount: 1});
  });

  it('the vote panel reads BOTH halves for a seat, and the formula alone for one outside the table', () => {
    const resolution = law();
    const m = model([seat(BLUE, 4, 2, 3)]);
    const reading = voteReadingOf(resolution, m, BLUE, []);
    expect(reading?.yields.map((y) => y.effect.id), 'both halves are read').includes('draw').and.includes('megacredits');
    const stranger = voteReadingOf(resolution, m, RED, []);
    expect((stranger?.yields ?? []).every((y) => y.context === 'reference'), 'a seat outside the table reads the formula alone').is.true;
  });
});
