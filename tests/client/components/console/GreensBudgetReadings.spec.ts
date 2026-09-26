import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {Tag} from '@/common/cards/Tag';
import {
  ParliamentEnactedModel, ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPhaseSummaryModel, ParliamentPlayerModel,
} from '@/common/models/ParliamentModel';
import {levyNetEffectOf} from '@/common/parliament/resolutionLevy';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import {
  enactedLevyOf, enactedYieldsOf, noRecipientCompactNoteOf, voteLevyOf, voteYieldsOf, yieldCaptionOf, yieldCountPresentation, yieldIconOf,
  yieldInfluenceEnters, yieldIsFlat,
} from '@/client/console/parliament/influenceYieldModel';
import {voteReadingOf} from '@/client/console/parliament/voteInfoModel';
import {ledgerPartText, voteLedgerOf} from '@/client/console/parliament/voteLedgerModel';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * GREENS BUDGET (Turmoil Redux, RX34) — THE READINGS OF THE FIFTH BUDGET.
 * The card writes no reading of its own, so what is pinned here is that the
 * shipped ones compose for a combination they had never met — a levy and a
 * tag count beside TWO flat portions onto a card:
 *  · the NET line is the LEVY's (RX15) and stands on the M€ payout ALONE — a
 *    portion onto a card is never the other half of «−10 → +5 = −5»;
 *  · the count explains itself with the PRINTED plant, microbe and animal
 *    tags — the server's number, the cards that made it, the per-tag
 *    breakdown in the printed rule's order;
 *  · each PORTION is its own row, read as FLAT («the same for every player»),
 *    with no forecast plate and no influence cluster — influence buys no
 *    animals — and never added to the money or to each other;
 *  · the honesty note names the FIRST kind the viewer cannot hold, in the
 *    server's own words, and a forfeited portion reads by its own reason;
 *  · the LEDGER OF OUTCOMES computes a rival's chip from THEIR tags, THEIR
 *    influence and THEIR holders — a seat that can hold neither reads «✕ 2»
 *    and «✕ 3», never a silent gain.
 */
const BUDGET_ID = 'RDX_GREENS_GREENS_BUDGET';
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

const budget = () => {
  const resolution = getResolution(BUDGET_ID);
  if (resolution === undefined) {
    throw new Error(`${BUDGET_ID} is not in the client manifest`);
  }
  return resolution;
};

const BY_TAG = [{tag: Tag.PLANT, count: 1}, {tag: Tag.MICROBE, count: 1}, {tag: Tag.ANIMAL, count: 1}];

/** A seat of the budget's table: the three-tag count the server carries (Fish · Tardigrades · Trees = 3), and the supply the levy reads. */
function seat(color: Color, agenda: number, influence: number, held: number, count = 3): ParliamentPlayerModel {
  return {
    color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence,
    access: [], partyActionUses: {}, resolutionActionUses: 0,
    counts: [{
      id: 'plantMicrobeAnimalTags', count,
      cards: count === 0 ? [] : [CardName.FISH, CardName.TARDIGRADES, CardName.TREES],
      units: count === 0 ? [] : [1, 1, 1],
      byTag: count === 0 ? BY_TAG.map((entry) => ({...entry, count: 0})) : BY_TAG,
    }],
    stock: {[Resource.MEGACREDITS]: held},
  };
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 4, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

const ENACTED: ParliamentEnactedModel = {instance: `${BUDGET_ID}#0`, resolution: BUDGET_ID, party: PartyName.GREENS};

function phase(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel>): ParliamentPhaseSummaryModel {
  return {
    generation: 3, final: false,
    winner: {instance: ENACTED.instance, resolution: BUDGET_ID, party: PartyName.GREENS, votes: 2},
    outcomes: [...outcomes], support: [], enacted: ENACTED, refreshed: [], lobbyRefilled: [],
  };
}

/** The server's own four records for one seat: the levy, the payout, the animals, the microbes. */
const LEVY: ParliamentEnactOutcomeModel =
  {player: BLUE, step: 'levy', part: 'effect', kind: 'stock', stock: Resource.MEGACREDITS, amount: -10, owed: 10, before: 40, after: 30};
const PAYOUT: ParliamentEnactOutcomeModel = {
  player: BLUE, step: 'megacredits', part: 'effect', effect: 'megacredits', kind: 'stock', stock: Resource.MEGACREDITS,
  amount: 6, influence: 3, count: 3, counted: [CardName.FISH, CardName.TARDIGRADES, CardName.TREES], countedUnits: [1, 1, 1], countedByTag: BY_TAG, before: 30, after: 36,
};
const ANIMALS: ParliamentEnactOutcomeModel =
  {player: BLUE, step: 'animals', part: 'effect', effect: 'animals', kind: 'cardResource', resource: CardResource.ANIMAL, amount: 2, card: CardName.FISH, influence: 3};
const MICROBES: ParliamentEnactOutcomeModel =
  {player: BLUE, step: 'microbes', part: 'effect', effect: 'microbes', kind: 'cardResource', resource: CardResource.MICROBE, amount: 3, card: CardName.TARDIGRADES, influence: 3};

const HOLDS_BOTH = [{name: CardName.FISH}, {name: CardName.TARDIGRADES}];

const t = {global: {mocks: {$t: (key: string) => key}}};

describe('Greens Budget — the readings of the fifth budget', () => {
  it('the shipped manifest declares a LEVY of 10 M€ first, the three-tag count + influence (no cap) and TWO FLAT portions onto ONE card — never a spread', () => {
    const law = budget();
    expect(law.code).eq('RX34');
    expect(law.party).eq(PartyName.GREENS);
    expect(law.levy).deep.eq({resource: Resource.MEGACREDITS, amount: 10, recipient: 'each'});
    const [mc, animals, microbes] = law.scaled ?? [];
    expect(mc).deep.include({id: 'megacredits', perInfluence: 1, recipient: 'each'});
    expect(mc.unit).deep.eq({kind: 'stock', resource: Resource.MEGACREDITS});
    expect(mc.count).deep.eq({id: 'plantMicrobeAnimalTags', per: 1});
    expect(mc.cap, 'no maximum is printed').is.undefined;
    expect(animals).deep.eq({id: 'animals', unit: {kind: 'cardResource', resources: [CardResource.ANIMAL]}, base: 2, perInfluence: 0, recipient: 'each'});
    expect(microbes).deep.eq({id: 'microbes', unit: {kind: 'cardResource', resources: [CardResource.MICROBE]}, base: 3, perInfluence: 0, recipient: 'each'});
    expect(yieldIsFlat(animals), 'the animals are the same for everybody').is.true;
    expect(yieldIsFlat(microbes), 'and so are the microbes').is.true;
    expect(yieldIsFlat(mc)).is.false;
    expect(yieldInfluenceEnters(animals), 'influence is no term of a portion').is.false;
    expect(yieldInfluenceEnters(microbes)).is.false;
    expect(yieldIconOf(animals)).deep.eq({family: 'card-resource', resources: [CardResource.ANIMAL]});
    expect(yieldIconOf(microbes)).deep.eq({family: 'card-resource', resources: [CardResource.MICROBE]});
    expect(law.quest).deep.eq({goal: {kind: 'tag', tag: Tag.PLANT}, count: 2});
    expect(familyOf(law), '«to any card» is ONE card: the family is the tag count\'s, never the distributed one').eq('counted-tags');
    // THE NET stands on the payout in the LEVY'S OWN CURRENCY — never on a portion.
    expect(levyNetEffectOf(law.levy!, law.scaled)).eq(mc);
  });

  it('the count explains itself with the PRINTED plant, microbe and animal tags — the three medallions, the server\'s own card list and the per-tag breakdown', () => {
    expect(yieldCountPresentation('plantMicrobeAnimalTags')).deep.eq({
      glyph: {kind: 'tags', tags: [Tag.ANIMAL, Tag.PLANT, Tag.MICROBE]},
      pluralKey: '${0} plant, microbe and animal tag(s)',
      ruleKey: 'Each plant, microbe and animal tag counts: a card with two of them counts twice. Wild tags do not count.',
      skipReasonKey: 'No plant, microbe or animal tags and no influence',
    });
    const law = budget();
    const m = model([seat(BLUE, 4, 2, 34)]);
    const [payout] = voteYieldsOf(law, m, BLUE);
    expect(payout).deep.include({influence: 2, count: 3, amount: 5});
    expect(payout.counted).deep.eq([CardName.FISH, CardName.TARDIGRADES, CardName.TREES]);
    expect(payout.countedUnits).deep.eq([1, 1, 1]);
    expect(payout.countedByTag, 'the breakdown names each tag in the printed rule\'s order').deep.eq(BY_TAG);
    expect(payout.uncapped, 'no cap — no sum beside the amount').is.undefined;
  });

  it('the vote reading: «3 tags + influence 2 → +5», the levy nets it to −5, and the 2 animals and 3 microbes are rows of their own with no forecast and no influence', () => {
    const law = budget();
    const m = model([seat(BLUE, 4, 2, 34)]);
    const yields = voteYieldsOf(law, m, BLUE);
    expect(yields.map((y) => `${y.effect.id}:${y.context}`)).deep.eq(['megacredits:estimate', 'megacredits:forecast', 'animals:estimate', 'microbes:estimate']);
    expect(yields[1], 'a win takes the marker one Agenda step first — the money alone moves').deep.include({influence: 3, amount: 6, agendaStep: 5});
    // THE PORTIONS: flat, so they have no forecast plate and say whose number they are — and they never add up.
    expect(yields[2]).deep.include({amount: 2, influence: 2});
    expect(yields[3]).deep.include({amount: 3, influence: 2});
    expect(yieldCaptionOf(yields[2])).deep.eq({key: 'The same for every player'});
    expect(yieldCaptionOf(yields[3])).deep.eq({key: 'The same for every player'});
    // THE NET: −10 against the +5 of the SAME currency — the animals and the microbes are not addends.
    expect(voteLevyOf(law, m, BLUE)).deep.eq({
      resource: Resource.MEGACREDITS, context: 'estimate', owed: 10, paid: 10, short: false, held: 34,
      payout: {effectId: 'megacredits', amount: 5}, net: -5,
    });
    // A SHORT seat reads its shortfall while it can still set money aside.
    expect(voteLevyOf(law, model([seat(BLUE, 3, 2, 4)]), BLUE)).deep.include(
      {paid: 4, owed: 10, short: true, held: 4, net: 1, note: 'Not enough M€: the rest of the levy is not taken'});
    // …and a seat with no tag and no influence nets to the levy alone — its portions are still 2 and 3.
    const bare = voteYieldsOf(law, model([seat(BLUE, 0, 0, 20, 0)]), BLUE);
    expect(voteLevyOf(law, model([seat(BLUE, 0, 0, 20, 0)]), BLUE)).deep.include({paid: 10, net: -10, payout: {effectId: 'megacredits', amount: 0}});
    expect(bare.filter((y) => y.context === 'estimate').map((y) => `${y.effect.id}:${y.amount}`)).deep.eq(['megacredits:0', 'animals:2', 'microbes:3']);
    expect(voteLevyOf(law, m, RED), 'a seat outside the table reads the formula alone').is.undefined;
  });

  it('the panel reads ONE row per part, the levy beside them, and its honesty note names the FIRST kind the seat cannot hold — in the server\'s own words', () => {
    const law = budget();
    const m = model([seat(BLUE, 4, 2, 34)]);
    const [, animals, microbes] = law.scaled ?? [];
    const whole = voteReadingOf(law, m, BLUE, HOLDS_BOTH);
    expect(whole.yields.map((y) => y.effect.id), 'one reading per part — the forecast folded into a suffix').deep.eq(['megacredits', 'animals', 'microbes']);
    expect(whole.suffixes.map((s) => `${s.effectId}:+${s.delta}`), 'only the money grows with a win').deep.eq(['megacredits:+1']);
    expect(whole.levy).deep.include({paid: 10, net: -5});
    expect(whole.note, 'both kinds can land — no note').is.undefined;
    // No animal holder: the animals' own reason; the microbes are fine and say nothing.
    expect(noRecipientCompactNoteOf(animals, [{name: CardName.TARDIGRADES}])).eq('No card can hold animals');
    expect(noRecipientCompactNoteOf(microbes, [{name: CardName.TARDIGRADES}])).is.undefined;
    expect(voteReadingOf(law, m, BLUE, [{name: CardName.TARDIGRADES}]).note).eq('No card can hold animals');
    // No microbe holder: the microbes' own reason.
    expect(noRecipientCompactNoteOf(microbes, [{name: CardName.FISH}])).eq('No card can hold microbes');
    expect(voteReadingOf(law, m, BLUE, [{name: CardName.FISH}]).note).eq('No card can hold microbes');
    // Neither: the first missing kind is named (one note on the panel), the levy's own warning only when the seat is short.
    expect(voteReadingOf(law, m, BLUE, []).note).eq('No card can hold animals');
    expect(voteReadingOf(law, model([seat(BLUE, 3, 2, 4)]), BLUE, HOLDS_BOTH).note).eq('Not enough M€ for the levy');
    // A seat outside the table reads the formula alone.
    const stranger = voteReadingOf(law, m, RED, []);
    expect(stranger.yields, 'nothing personal for a stranger').deep.eq([]);
  });

  it('an ENACTED budget reads the RECORDS — «−10 (owed 10) → +6 = −4», «+2 animals onto Fish», «+3 microbes onto Tardigrades» — never today\'s tableau or supply', () => {
    const law = budget();
    // Today's supply is 99 and the tableau has grown; the reading is the record.
    const m = model([seat(BLUE, 5, 3, 99, 9)], {enacted: ENACTED, lastPhase: phase([LEVY, PAYOUT, ANIMALS, MICROBES])});
    const yields = enactedYieldsOf(law, m, BLUE);
    expect(yields.map((y) => `${y.effect.id}:${y.context}:${y.amount}`)).deep.eq(['megacredits:applied:6', 'animals:applied:2', 'microbes:applied:3']);
    expect(yields[0]).deep.include({influence: 3, count: 3});
    expect(yields[0].countedByTag).deep.eq(BY_TAG);
    expect(yields[1].skipped, 'the animals landed').is.undefined;
    expect(yields[2].skipped, 'the microbes landed').is.undefined;
    expect(yieldCaptionOf(yields[1])).deep.eq({key: 'Received'});
    expect(enactedLevyOf(law, m, BLUE)).deep.eq({
      resource: Resource.MEGACREDITS, context: 'applied', owed: 10, paid: 10, short: false,
      payout: {effectId: 'megacredits', amount: 6}, net: -4,
    });
    expect(enactedLevyOf(law, m, BLUE, {live: true})?.context).eq('resolving');
    const block = mount(ConsoleInfluenceYield, {props: {yields}, ...t});
    expect(block.findAll('[data-yield-effect]').map((el) => el.attributes('data-yield-effect'))).deep.eq(['megacredits', 'animals', 'microbes']);
    expect(block.findAll('[data-yield-amount]').map((el) => el.attributes('data-yield-amount'))).deep.eq(['6', '2', '3']);
  });

  it('a FORFEITED portion reads by its OWN reason with its size, beside the other portion that landed — and neither touches the levy or the payout', () => {
    const law = budget();
    const skippedMicrobes: ParliamentEnactOutcomeModel = {
      player: BLUE, step: 'microbes', part: 'effect', effect: 'microbes', kind: 'skipped', resource: CardResource.MICROBE, amount: 3, influence: 3, reason: 'No card can hold microbes',
    };
    const m = model([seat(BLUE, 5, 3, 99)], {enacted: ENACTED, lastPhase: phase([LEVY, PAYOUT, ANIMALS, skippedMicrobes])});
    const [, animals, microbes] = enactedYieldsOf(law, m, BLUE);
    expect(animals).deep.include({context: 'applied', amount: 2});
    expect(animals.skipped).is.undefined;
    expect(microbes).deep.include({context: 'applied', amount: 3, skipped: 'No card can hold microbes'});
    expect(yieldCaptionOf(microbes)).deep.eq({key: 'No card can hold microbes'});
    expect(enactedLevyOf(law, m, BLUE)).deep.include({paid: 10, net: -4});
    const block = mount(ConsoleInfluenceYield, {props: {yields: [animals, microbes]}, ...t});
    expect(block.find('[data-yield-effect="microbes"] [data-yield-skipped]').attributes('data-yield-skipped')).eq('No card can hold microbes');
    expect(block.find('[data-yield-effect="animals"] [data-yield-skipped]').exists(), 'the animals\' row wears no reason').is.false;
  });

  it('the LEDGER OF OUTCOMES computes a rival\'s chip from THEIR tags, THEIR influence and THEIR holders — a seat that holds neither reads its portions forfeited', () => {
    const law = budget();
    // The viewer: 3 tags, influence 2, both kinds of holder. The rival: one tag, influence 1, no holder at all.
    const m = model([seat(BLUE, 4, 2, 34), {...seat(RED, 1, 1, 20, 1), counts: [{id: 'plantMicrobeAnimalTags', count: 1, cards: [CardName.TREES], units: [1], byTag: [{tag: Tag.PLANT, count: 1}, {tag: Tag.MICROBE, count: 0}, {tag: Tag.ANIMAL, count: 0}]}]}]);
    const chips = voteLedgerOf({resolution: law, model: m, viewer: BLUE, players: [{color: BLUE, tableau: HOLDS_BOTH}, {color: RED, tableau: []}]});
    expect(chips.map((c) => c.color), 'the viewer first, then the model\'s own order').deep.eq([BLUE, RED]);
    expect(chips[0].you).is.true;
    expect(chips[0].parts.map((p) => `${p.key}:${ledgerPartText(p)}`), 'the net in the levy\'s currency, then each portion as its own number').deep.eq(['megacredits:−5', 'animals:+2', 'microbes:+3']);
    expect(chips[1].you).is.false;
    expect(chips[1].parts.map((p) => `${p.key}:${ledgerPartText(p)}`), 'the rival\'s own count, own influence — and its portions computed and forfeited').deep.eq(['megacredits:−8', 'animals:✕ 2', 'microbes:✕ 3']);
    // …and the viewer's own big reading is unchanged by the row beside it.
    expect(voteYieldsOf(law, m, BLUE)[0]).deep.include({count: 3, amount: 5});
  });
});
