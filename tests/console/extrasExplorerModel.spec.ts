import {expect} from 'chai';
import {CardResource} from '../../src/common/CardResource';
import {CardVictoryPointsDetail} from '../../src/common/game/VictoryPointsBreakdown';
import {
  buildBotExtrasTypes,
  buildExtrasTypes,
  ExtrasCardLookup,
  extrasNavigate,
  extrasPageCount,
  extrasPageOf,
  extrasTypeKey,
  resourcesToNextVp,
} from '../../src/client/console/extrasExplorerModel';
import type {AdditionalResourceGroup} from '../../src/client/components/additionalResources/additionalResources';
import type {MarsBotExtraGroup} from '../../src/client/components/console/marsBotRailModel';
import type {RailMcBadge} from '../../src/client/console/railValueModel';

function group(resource: CardResource, cards: Array<{name: string, amount: number, isCorporation?: boolean}>): AdditionalResourceGroup {
  return {
    resource,
    total: cards.reduce((s, c) => s + c.amount, 0),
    cards: cards.map((c) => ({name: c.name as never, amount: c.amount, isCorporation: c.isCorporation === true})),
  };
}

function detail(cardName: string, vp: number, mechanics?: CardVictoryPointsDetail['mechanics'],
  kind: CardVictoryPointsDetail['kind'] = 'resource'): CardVictoryPointsDetail {
  return {cardName, victoryPoint: vp, kind, mechanics};
}

const NO_LOOKUP: ExtrasCardLookup = () => ({isCorporation: false, hasAction: false});

describe('extrasExplorerModel — the «Доп. ресурсы» view-model', () => {
  it('keeps the canonical group order and the zero holders (a holder is a fact)', () => {
    const types = buildExtrasTypes({
      groups: [
        group(CardResource.FLOATER, [{name: 'Dirigibles', amount: 0}]),
        group(CardResource.ANIMAL, [{name: 'Birds', amount: 3}, {name: 'Fish', amount: 0}]),
      ],
      detailsCards: [],
      vpVisible: true,
      lookup: NO_LOOKUP,
    });
    expect(types.map((t) => t.key), 'first-appearance order, never by totals').to.deep.eq(['floater', 'animal']);
    expect(types[0].total).to.eq(0);
    expect(types[1].cards.map((c) => c.name), 'holders keep play order, zeros included').to.deep.eq(['Birds', 'Fish']);
  });

  it('per-card VP is the SERVER row — flooring is per card, never over the sum', () => {
    // The mandated case: two independent cards, 1 resource each, «2 → 1 VP»
    // — the honest answer is 0 + 0, not floor(2/2) = 1.
    const types = buildExtrasTypes({
      groups: [group(CardResource.MICROBE, [{name: 'A', amount: 1}, {name: 'B', amount: 1}])],
      detailsCards: [
        detail('A', 0, {shape: 'per', each: 1, per: 2, counted: 1, unit: 'resources', resourceType: 'Microbe'}),
        detail('B', 0, {shape: 'per', each: 1, per: 2, counted: 1, unit: 'resources', resourceType: 'Microbe'}),
      ],
      vpVisible: true,
      lookup: NO_LOOKUP,
    });
    const t = types[0];
    expect(t.vpFromResources).to.eq(0);
    expect(t.scoringCards).to.eq(2);
    for (const card of t.cards) {
      expect(card.scoring?.vpNow).to.eq(0);
      expect(card.scoring?.toNext, 'one more resource reaches the next VP').to.eq(1);
    }
  });

  it('«toward the next VP» is honest at a full step and absent for per-1 rules', () => {
    expect(resourcesToNextVp(0, 2)).to.eq(2);
    expect(resourcesToNextVp(1, 2)).to.eq(1);
    expect(resourcesToNextVp(2, 2), 'a full step needs the WHOLE next batch').to.eq(2);
    expect(resourcesToNextVp(5, 3)).to.eq(1);
    const types = buildExtrasTypes({
      groups: [group(CardResource.ANIMAL, [{name: 'Birds', amount: 4}])],
      detailsCards: [detail('Birds', 4, {shape: 'per', each: 1, per: 1, counted: 4, unit: 'resources', resourceType: 'Animal'})],
      vpVisible: true,
      lookup: NO_LOOKUP,
    });
    expect(types[0].cards[0].scoring?.toNext, 'per-1: the rule chip already says it').to.be.undefined;
    expect(types[0].vpFromResources).to.eq(4);
  });

  it('a special clause is CONDITIONAL — named apart, never folded into the linear sum', () => {
    // Search For Life: kind 'resource' (it stores science), shape 'special'.
    const types = buildExtrasTypes({
      groups: [group(CardResource.SCIENCE, [{name: 'Search For Life', amount: 1}])],
      detailsCards: [detail('Search For Life', 3, {shape: 'special', counted: 1, unit: 'resources', resourceType: 'Science'})],
      vpVisible: true,
      lookup: NO_LOOKUP,
    });
    const t = types[0];
    expect(t.vpFromResources, 'the linear sum stays clean').to.eq(0);
    expect(t.vpConditional).to.eq(3);
    expect(t.cards[0].scoring?.kind).to.eq('special');
    expect(t.cards[0].scoring?.toNext, 'no universal «N more» exists for a bespoke rule').to.be.undefined;
  });

  it('a holder whose VP is NOT from resources keeps it in its own bucket (no double count)', () => {
    // An Olympus-Conference-like holder: printed fixed VP + science storage.
    const types = buildExtrasTypes({
      groups: [group(CardResource.SCIENCE, [{name: 'Olympus Conference', amount: 1}])],
      detailsCards: [detail('Olympus Conference', 1, {shape: 'fixed'}, 'fixed')],
      vpVisible: true,
      lookup: NO_LOOKUP,
    });
    const card = types[0].cards[0];
    expect(card.scoring, 'the resources themselves score nothing').to.be.undefined;
    expect(card.otherVp).to.deep.eq({vpNow: 1, conditional: false});
    expect(types[0].vpFromResources, 'the fixed VP never inflates the resource sum').to.eq(0);
    expect(types[0].scoringCards).to.eq(0);
  });

  it('a hidden score keeps the PRINTED rule and withholds every number', () => {
    const lookup: ExtrasCardLookup = (name) => ({
      isCorporation: false,
      hasAction: false,
      printedRule: name === 'Birds' ? {per: 1, each: 1} : 'special',
    });
    const types = buildExtrasTypes({
      groups: [group(CardResource.ANIMAL, [{name: 'Birds', amount: 2}, {name: 'Oddity', amount: 1}])],
      detailsCards: [], // the server ships an EMPTY breakdown for a hidden seat
      vpVisible: false,
      lookup,
    });
    const t = types[0];
    expect(t.vpFromResources).to.be.undefined;
    expect(t.vpConditional).to.be.undefined;
    expect(t.cards[0].scoring).to.deep.include({kind: 'per', per: 1, each: 1});
    expect(t.cards[0].scoring?.vpNow, 'values are score information').to.be.undefined;
    expect(t.cards[0].scoring?.toNext).to.be.undefined;
    expect(t.cards[1].scoring?.kind).to.eq('special');
  });

  it('a payment grant belongs to the ENABLING card alone (storage is not tender)', () => {
    const badge: RailMcBadge = {
      text: '3',
      rates: [3],
      facts: [{unit: 'floaters', rate: 3, context: 'venus', source: 'Dirigibles' as never, spendableAmount: 2}],
    };
    const types = buildExtrasTypes({
      groups: [group(CardResource.FLOATER, [{name: 'Dirigibles', amount: 2}, {name: 'Stormcraft Incorporated', amount: 5, isCorporation: true}])],
      detailsCards: [],
      vpVisible: true,
      lookup: NO_LOOKUP,
      payments: new Map([[CardResource.FLOATER, badge]]),
    });
    const t = types[0];
    expect(t.payment).to.eq(badge);
    expect(t.cards[0].payRate).to.eq('3');
    expect(t.cards[1].payRate, 'same-typed storage earns no coin').to.be.undefined;
    expect(t.cards[1].isCorporation).to.be.true;
  });

  it('the bot adapter keeps the same semantic shape over the real CARD-TYPE pools', () => {
    const groups: Array<MarsBotExtraGroup> = [
      {key: 'floater', iconClass: 'card-resource card-resource-floater', label: 'Floaters', total: 4, holders: [], metricKey: 'card-resource.Floater.stock', origin: 'pool'},
      {key: 'microbe', iconClass: 'card-resource card-resource-microbe', label: 'Microbes', total: 2, holders: [{name: 'Enceladus', amount: 2}], metricKey: 'card-resource.Microbe.stock', origin: 'storage'},
    ];
    const types = buildBotExtrasTypes(groups);
    expect(types.map((t) => t.key)).to.deep.eq(['floater', 'microbe']);
    expect(types[0].holders).to.deep.eq([]);
    expect(types[0].botOrigin).to.eq('pool');
    expect(types[1].holders).to.deep.eq([{name: 'Enceladus', amount: 2}]);
    expect(types[1].botOrigin).to.eq('storage');
    expect(types[1].vpFromResources, 'the bot\'s VP never comes from these pools').to.be.undefined;
    expect(types[1].cards).to.have.length(0);
  });

  it('navigation: the column clamps, right crosses into the gallery, left at card 0 returns', () => {
    const at = (zone: 'types' | 'cards', typeCursor: number, cardCursor: number) => ({zone, typeCursor, cardCursor});
    expect(extrasNavigate(at('types', 0, 0), 'up', 3, 5)).to.deep.eq(at('types', 0, 0));
    expect(extrasNavigate(at('types', 0, 0), 'down', 3, 5)).to.deep.eq(at('types', 1, 0));
    expect(extrasNavigate(at('types', 2, 0), 'down', 3, 5), 'the bottom clamps').to.deep.eq(at('types', 2, 0));
    expect(extrasNavigate(at('types', 1, 0), 'right', 3, 5).zone).to.eq('cards');
    expect(extrasNavigate(at('types', 1, 0), 'right', 3, 0).zone, 'an empty gallery refuses the crossing').to.eq('types');
    expect(extrasNavigate(at('cards', 1, 0), 'left', 3, 5).zone, 'left at the first card returns to the column').to.eq('types');
    expect(extrasNavigate(at('cards', 1, 2), 'left', 3, 5)).to.deep.eq(at('cards', 1, 1));
    expect(extrasNavigate(at('cards', 1, 4), 'right', 3, 5), 'the last card clamps').to.deep.eq(at('cards', 1, 4));
  });

  it('the page is DERIVED from the cursor — crossing an edge IS the turn', () => {
    expect(extrasPageOf(0, 4)).to.eq(0);
    expect(extrasPageOf(3, 4)).to.eq(0);
    expect(extrasPageOf(4, 4)).to.eq(1);
    expect(extrasPageCount(0, 4), 'an empty list still has one (empty) page').to.eq(1);
    expect(extrasPageCount(9, 4)).to.eq(3);
  });

  it('type keys mirror the satellite anchors (normalized resource names)', () => {
    expect(extrasTypeKey('Venusian Habitat')).to.eq('venusian-habitat');
    expect(extrasTypeKey('Animal')).to.eq('animal');
  });
});
