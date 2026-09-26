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
import {levyNetEffectOf} from '@/common/parliament/resolutionLevy';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import {
  enactedLevyOf, enactedYieldsOf, voteLevyOf, voteYieldsOf, yieldCaptionOf, yieldCountPresentation, yieldIconOf, yieldIsFlat,
} from '@/client/console/parliament/influenceYieldModel';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * SCIENTISTS BUDGET (Turmoil Redux, RX27) — THE READINGS OF THE SECOND BUDGET.
 * The card writes no reading of its own, so what is pinned here is that the
 * three shipped ones compose correctly:
 *  · the NET line is the LEVY's (RX15), and it stands on the M€ payout ALONE —
 *    a hand of cards is never the other half of «−10 → +5 = −5»;
 *  · the DRAW is its own row, read as FLAT («the same for every player»), with
 *    no forecast plate and no influence cluster — influence buys no cards;
 *  · the count explains itself with the PRINTED science tags (RX18) — the
 *    server's own number and the cards that made it, never a law's addition;
 *  · a SHORT deck names both numbers («+1 / 2»), a habit the level and sequel
 *    families already had and a flat draw silently lacked.
 */
const BUDGET_ID = 'RDX_SCIENTISTS_SCIENTISTS_BUDGET';
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

const budget = () => {
  const resolution = getResolution(BUDGET_ID);
  if (resolution === undefined) {
    throw new Error(`${BUDGET_ID} is not in the client manifest`);
  }
  return resolution;
};

/** A seat of the budget's table: the science-tag count the server carries, and the supply the levy reads. */
function seat(color: Color, agenda: number, influence: number, held: number, count = 3): ParliamentPlayerModel {
  return {
    color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence,
    access: [], partyActionUses: {}, resolutionActionUses: 0,
    counts: [{id: 'scienceTags', count, cards: count === 0 ? [] : [CardName.RESEARCH, CardName.GHG_PRODUCING_BACTERIA], units: count === 0 ? [] : [2, 1]}],
    stock: {[Resource.MEGACREDITS]: held},
  };
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.SCIENTISTS, popularSupport: {}, players, deckSize: 4, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

const ENACTED: ParliamentEnactedModel = {instance: `${BUDGET_ID}#0`, resolution: BUDGET_ID, party: PartyName.SCIENTISTS};

function phase(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel>): ParliamentPhaseSummaryModel {
  return {
    generation: 3, final: false,
    winner: {instance: ENACTED.instance, resolution: BUDGET_ID, party: PartyName.SCIENTISTS, votes: 2},
    outcomes: [...outcomes], support: [], enacted: ENACTED, refreshed: [], lobbyRefilled: [],
  };
}

/** The server's own three records for one seat: the levy, the payout, the draw. */
const LEVY: ParliamentEnactOutcomeModel =
  {player: BLUE, step: 'levy', part: 'effect', kind: 'stock', stock: Resource.MEGACREDITS, amount: -10, owed: 10, before: 40, after: 30};
const PAYOUT: ParliamentEnactOutcomeModel = {
  player: BLUE, step: 'megacredits', part: 'effect', effect: 'megacredits', kind: 'stock', stock: Resource.MEGACREDITS,
  amount: 6, influence: 3, count: 3, counted: [CardName.RESEARCH, CardName.GHG_PRODUCING_BACTERIA], countedUnits: [2, 1], before: 30, after: 36,
};
const DRAW: ParliamentEnactOutcomeModel =
  {player: BLUE, step: 'draw', part: 'effect', effect: 'draw', kind: 'cards', amount: 2, drawn: 2, influence: 3};

const t = {global: {mocks: {$t: (key: string) => key}}};

describe('Scientists Budget — the readings of the second budget', () => {
  it('the shipped manifest declares a LEVY of 10 M€ first, the science-tag count + influence (no cap) and a FLAT 2-card draw', () => {
    const law = budget();
    expect(law.code).eq('RX27');
    expect(law.party).eq(PartyName.SCIENTISTS);
    expect(law.levy).deep.eq({resource: Resource.MEGACREDITS, amount: 10, recipient: 'each'});
    const [mc, draw] = law.scaled ?? [];
    expect(mc).deep.include({id: 'megacredits', perInfluence: 1, recipient: 'each'});
    expect(mc.unit).deep.eq({kind: 'stock', resource: Resource.MEGACREDITS});
    expect(mc.count).deep.eq({id: 'scienceTags', per: 1});
    expect(mc.cap, 'no maximum is printed').is.undefined;
    expect(draw).deep.eq({id: 'draw', unit: {kind: 'cards'}, base: 2, perInfluence: 0, recipient: 'each'});
    expect(yieldIsFlat(draw), 'the cards are the same for everybody').is.true;
    expect(yieldIsFlat(mc)).is.false;
    expect(yieldIconOf(draw)).deep.eq({family: 'cards'});
    expect(law.quest).deep.eq({goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2});
    expect(familyOf(law)).eq('counted-tags');
    // THE NET stands on the payout in the LEVY'S OWN CURRENCY — never on the draw.
    expect(levyNetEffectOf(law.levy!, law.scaled)).eq(mc);
  });

  it('the count explains itself with the PRINTED science tags — the medallion Medical Database introduced, and the server\'s own card list', () => {
    expect(yieldCountPresentation('scienceTags')).deep.eq({
      glyph: {kind: 'tag', tag: Tag.SCIENCE},
      pluralKey: '${0} science tag(s)',
      ruleKey: 'Each science tag counts: a card with two science tags counts twice. Wild tags do not count.',
      skipReasonKey: 'No science tags and no influence',
    });
    const law = budget();
    const m = model([seat(BLUE, 4, 2, 34)]);
    const [payout] = voteYieldsOf(law, m, BLUE);
    // THE READING'S INPUT IS THE SEAT'S RECORDED COUNT and the cards behind it.
    // A law's tag bonus (R&D Funding's «when taking actions») has no card and no
    // entry here — the number a surface prints is the server's raw count, so the
    // panel can never quietly pay for tags the enactment does not count.
    expect(payout).deep.include({influence: 2, count: 3, amount: 5});
    expect(payout.counted).deep.eq([CardName.RESEARCH, CardName.GHG_PRODUCING_BACTERIA]);
    expect(payout.countedUnits, 'Research prints two').deep.eq([2, 1]);
    expect(payout.uncapped, 'no cap — no sum beside the amount').is.undefined;
  });

  it('the vote reading: «3 science tags + influence 2 → +5», the levy nets it to −5, and the 2 CARDS are a row of their own with no forecast', () => {
    const law = budget();
    const m = model([seat(BLUE, 4, 2, 34)]);
    const yields = voteYieldsOf(law, m, BLUE);
    expect(yields.map((y) => `${y.effect.id}:${y.context}`)).deep.eq(['megacredits:estimate', 'megacredits:forecast', 'draw:estimate']);
    expect(yields[1], 'a win takes the marker one Agenda step first').deep.include({influence: 3, amount: 6, agendaStep: 5});
    // THE DRAW: flat, so it has no forecast plate and says whose number it is.
    expect(yields[2]).deep.include({amount: 2, influence: 2});
    expect(yieldCaptionOf(yields[2])).deep.eq({key: 'The same for every player'});
    // THE NET: −10 against the +5 of the SAME currency — the cards are not an addend.
    expect(voteLevyOf(law, m, BLUE)).deep.eq({
      resource: Resource.MEGACREDITS, context: 'estimate', owed: 10, paid: 10, short: false, held: 34,
      payout: {effectId: 'megacredits', amount: 5}, net: -5,
    });
    // A SHORT seat reads its shortfall while it can still set money aside.
    expect(voteLevyOf(law, model([seat(BLUE, 3, 2, 4)]), BLUE)).deep.include(
      {paid: 4, owed: 10, short: true, held: 4, net: 1, note: 'Not enough M€: the rest of the levy is not taken'});
    // …and a seat with no tag and no influence nets to the levy alone.
    expect(voteLevyOf(law, model([seat(BLUE, 0, 0, 20, 0)]), BLUE)).deep.include({paid: 10, net: -10, payout: {effectId: 'megacredits', amount: 0}});
    expect(voteLevyOf(law, m, RED), 'a seat outside the table reads the formula alone').is.undefined;
  });

  it('an ENACTED budget reads the RECORDS — «−10 (owed 10) → +6 = −4» and «+2 cards» — never today\'s tableau or supply', () => {
    const law = budget();
    // Today's supply is 99 and the tableau has grown; the reading is the record.
    const m = model([seat(BLUE, 5, 3, 99, 9)], {enacted: ENACTED, lastPhase: phase([LEVY, PAYOUT, DRAW])});
    const yields = enactedYieldsOf(law, m, BLUE);
    expect(yields[0]).deep.include({context: 'applied', amount: 6, influence: 3, count: 3});
    expect(yields[0].countedUnits).deep.eq([2, 1]);
    expect(yields[1]).deep.include({context: 'applied', amount: 2});
    expect(yields[1].delivered, 'the whole draw landed — nothing to qualify').is.undefined;
    expect(enactedLevyOf(law, m, BLUE)).deep.eq({
      resource: Resource.MEGACREDITS, context: 'applied', owed: 10, paid: 10, short: false,
      payout: {effectId: 'megacredits', amount: 6}, net: -4,
    });
    expect(enactedLevyOf(law, m, BLUE, {live: true})?.context).eq('resolving');
  });

  it('a SHORT DECK names BOTH numbers («+1 / 2»); an EMPTY one is the draw\'s own named skip — and neither touches the levy or the payout', () => {
    const law = budget();
    const short = model([seat(BLUE, 5, 3, 99)], {enacted: ENACTED, lastPhase: phase([LEVY, PAYOUT, {...DRAW, drawn: 1}])});
    const [, drawn] = enactedYieldsOf(law, short, BLUE);
    expect(drawn).deep.include({context: 'applied', amount: 2, delivered: 1});
    expect(mount(ConsoleInfluenceYield, {props: {yields: [drawn]}, ...t}).find('[data-yield-amount]').text()).includes('+1 / 2');
    // The money is untouched by what the deck could not deliver.
    expect(enactedLevyOf(law, short, BLUE)).deep.include({paid: 10, net: -4});

    const empty = model([seat(BLUE, 5, 3, 99)], {enacted: ENACTED, lastPhase: phase([
      LEVY, PAYOUT,
      {player: BLUE, step: 'draw', part: 'effect', effect: 'draw', kind: 'skipped', amount: 2, drawn: 0, influence: 3, reason: 'The project deck is empty'},
    ])});
    const [, none] = enactedYieldsOf(law, empty, BLUE);
    expect(none).deep.include({context: 'applied', amount: 2, skipped: 'The project deck is empty'});
    expect(yieldCaptionOf(none)).deep.eq({key: 'The project deck is empty'});
    expect(enactedLevyOf(law, empty, BLUE)).deep.include({paid: 10, net: -4});
  });
});
