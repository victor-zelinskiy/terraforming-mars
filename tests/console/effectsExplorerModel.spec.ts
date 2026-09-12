import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Units} from '@/common/Units';
import {CardModel} from '@/common/models/CardModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {EffectSignature} from '@/client/components/effects/effectSummary';
import {
  EFFECT_FAMILY_ORDER,
  ExplorerEffectInput,
  buildEffectsBrowseModel,
  effectFamily,
  effectTileMeta,
  effectsZoneCounts,
  effectsZoneStatsLine,
  packEffectRows,
  stepEffect,
} from '@/client/console/effectsExplorerModel';

const sig = (overrides: Partial<EffectSignature> = {}): EffectSignature =>
  ({icons: [], discount: false, valueModifier: false, valueAsPayment: false, ...overrides});

function entry(overrides: Partial<ExplorerEffectInput> & {cardName: CardName}): ExplorerEffectInput {
  return {
    key: `${overrides.cardName}#${overrides.effectIndex ?? 0}`,
    effectIndex: 0,
    isCorporation: false,
    isDisabled: false,
    signature: sig(),
    ...overrides,
  };
}

function stat(overrides: Partial<EffectOverlayStat>): EffectOverlayStat {
  return {
    sourceKey: 'card:Test',
    kind: 'card',
    triggerCount: 0,
    megacreditsSaved: 0,
    cardsDrawn: 0,
    stock: Units.EMPTY,
    production: Units.EMPTY,
    cardResources: {},
    paymentResources: {},
    paymentValueBonus: {steel: 0, titanium: 0, bonusValue: 0, count: 0},
    colonyTrack: {steps: 0, extraReward: 0, count: 0, colonies: {}},
    tradeDiscount: {energy: 0, titanium: 0, megacredits: 0, count: 0, colonies: {}},
    greeneryDiscount: {plants: 0, count: 0},
    tr: 0,
    globalParameterSteps: {},
    vp: 0,
    ...overrides,
  };
}

const card = (name: CardName, overrides: Partial<CardModel> = {}): CardModel =>
  ({name, ...overrides} as CardModel);

describe('effectsExplorerModel', () => {
  describe('effectFamily (the precedence ladder)', () => {
    it('structural payment outranks everything', () => {
      const e = entry({cardName: CardName.PSYCHROPHILES, signature: sig({icons: [CardResource.MICROBE, 'megacredits'], valueAsPayment: true})});
      expect(effectFamily(e, undefined, true)).to.eq('payValue');
    });

    it('curated special categories map to their families', () => {
      expect(effectFamily(entry({cardName: CardName.ADVANCED_ALLOYS}), undefined, true)).to.eq('payValue');
      expect(effectFamily(entry({cardName: CardName.TRADING_COLONY}), undefined, true)).to.eq('triggers');
      expect(effectFamily(entry({cardName: CardName.CRYO_SLEEP}), undefined, true)).to.eq('discounts');
      expect(effectFamily(entry({cardName: CardName.ECOLINE, isCorporation: true}), undefined, true)).to.eq('discounts');
    });

    it('family overrides catch what the signature cannot see', () => {
      expect(effectFamily(entry({cardName: CardName.HELION, isCorporation: true}), undefined, true)).to.eq('payValue');
      expect(effectFamily(entry({cardName: CardName.OLYMPUS_CONFERENCE}), undefined, true)).to.eq('triggers');
      expect(effectFamily(entry({cardName: CardName.NEPTUNIAN_POWER_CONSULTANTS}), undefined, true)).to.eq('triggers');
    });

    it('a printed negative-M€ result is a discount', () => {
      const e = entry({cardName: CardName.EARTH_CATAPULT, signature: sig({icons: ['megacredits'], discount: true})});
      expect(effectFamily(e, undefined, true)).to.eq('discounts');
    });

    it('the server-declared CardModel.discount nets a SINGLE-effect card only', () => {
      const e = entry({cardName: CardName.SPACE_STATION, signature: sig({icons: ['megacredits']})});
      const model = card(CardName.SPACE_STATION, {discount: [{amount: 2}]});
      expect(effectFamily(e, model, true)).to.eq('discounts');
      // The same card-level field must NOT re-family a sibling effect of a
      // multi-effect card.
      expect(effectFamily(e, model, false)).to.eq('triggers');
    });

    it('a corporation effect classifies by its NATURE, never as «corporation»', () => {
      const gains = entry({cardName: CardName.THARSIS_REPUBLIC, isCorporation: true, signature: sig({icons: ['megacredits']})});
      expect(effectFamily(gains, undefined, true)).to.eq('triggers');
      const rule = entry({cardName: CardName.INVENTRIX, isCorporation: true, signature: sig()});
      expect(effectFamily(rule, undefined, true)).to.eq('rules');
    });

    it('signature classification lands every remaining shape in a family', () => {
      expect(effectFamily(entry({cardName: CardName.PETS, signature: sig({icons: [CardResource.ANIMAL]})}), undefined, true)).to.eq('triggers');
      expect(effectFamily(entry({cardName: CardName.MEDIA_GROUP, signature: sig({icons: ['tr']})}), undefined, true)).to.eq('triggers');
      expect(effectFamily(entry({cardName: CardName.PROTECTED_HABITATS, signature: sig()}), undefined, true)).to.eq('rules');
      expect(effectFamily(entry({cardName: CardName.BOOM_TOWN, signature: sig({icons: ['megacredits'], valueModifier: true})}), undefined, true)).to.eq('rules');
    });
  });

  describe('effectTileMeta (the honesty ladder)', () => {
    it('claims nothing while the stats have not arrived', () => {
      expect(effectTileMeta('triggers', undefined)).to.deep.eq({kind: 'none'});
    });

    it('a rules effect never tallies', () => {
      expect(effectTileMeta('rules', {scope: 'effect', stat: stat({triggerCount: 5})}))
        .to.deep.eq({kind: 'idle', label: 'Ongoing rule'});
    });

    it('an unsplittable multi-effect card says card-level', () => {
      expect(effectTileMeta('triggers', {scope: 'card', stat: stat({triggerCount: 3})}))
        .to.deep.eq({kind: 'cardScoped', label: 'Card-level stats'});
    });

    it('an effect with no recorded events is honestly idle', () => {
      expect(effectTileMeta('triggers', {scope: 'effect', stat: undefined}))
        .to.deep.eq({kind: 'idle', label: 'Not triggered yet'});
      expect(effectTileMeta('triggers', {scope: 'effect', stat: stat({})}))
        .to.deep.eq({kind: 'idle', label: 'Not triggered yet'});
    });

    it('family-led stat lines: saved / extra value / trigger count', () => {
      expect(effectTileMeta('discounts', {scope: 'effect', stat: stat({triggerCount: 6, megacreditsSaved: 12})}))
        .to.deep.eq({kind: 'stat', label: 'Saved', value: '12', icon: 'megacredits'});
      expect(effectTileMeta('payValue', {scope: 'effect', stat: stat({paymentValueBonus: {steel: 4, titanium: 0, bonusValue: 4, count: 2}})}))
        .to.deep.eq({kind: 'stat', label: 'Extra value', value: '+4', icon: 'megacredits'});
      expect(effectTileMeta('payValue', {scope: 'effect', stat: stat({triggerCount: 2, megacreditsSaved: 8})}))
        .to.deep.eq({kind: 'stat', label: 'Payment value', value: '8', icon: 'megacredits'});
      expect(effectTileMeta('triggers', {scope: 'effect', stat: stat({triggerCount: 3})}))
        .to.deep.eq({kind: 'stat', label: 'Times triggered', value: '3'});
    });
  });

  describe('buildEffectsBrowseModel', () => {
    const cnEntries = [
      entry({cardName: CardName.CARBON_NANOSYSTEMS, effectIndex: 0, signature: sig({icons: [CardResource.GRAPHENE]})}),
      entry({cardName: CardName.CARBON_NANOSYSTEMS, effectIndex: 1, key: CardName.CARBON_NANOSYSTEMS + '#1',
        signature: sig({icons: [CardResource.GRAPHENE, 'megacredits'], valueAsPayment: true})}),
    ];
    const petsEntry = entry({cardName: CardName.PETS, signature: sig({icons: [CardResource.ANIMAL]})});
    const catapultEntry = entry({cardName: CardName.EARTH_CATAPULT, signature: sig({icons: ['megacredits'], discount: true})});

    it('groups per source card; a multi-effect card is wide', () => {
      const model = buildEffectsBrowseModel({
        entries: [...cnEntries, petsEntry, catapultEntry],
        tableau: [], stats: undefined, familyFilter: 'all', columns: 2,
      });
      expect(model.total).to.eq(4);
      expect(model.groups.map((g) => g.cardName)).to.deep.eq([CardName.CARBON_NANOSYSTEMS, CardName.PETS, CardName.EARTH_CATAPULT]);
      expect(model.groups[0].wide).to.be.true;
      expect(model.groups[0].tiles.map((t) => t.family)).to.deep.eq(['triggers', 'payValue']);
      // Two single groups pack abreast AFTER the wide row.
      expect(model.rows).to.deep.eq([
        [cnEntries[0].key, cnEntries[1].key],
        [petsEntry.key, catapultEntry.key],
      ]);
    });

    it('the family filter narrows tiles (counts stay filter-independent)', () => {
      const model = buildEffectsBrowseModel({
        entries: [...cnEntries, petsEntry, catapultEntry],
        tableau: [], stats: undefined, familyFilter: 'payValue', columns: 2,
      });
      expect(model.groups).to.have.length(1);
      expect(model.groups[0].tiles).to.have.length(1);
      expect(model.groups[0].wide).to.be.false;
      expect(model.familyCounts).to.deep.eq({triggers: 2, payValue: 1, discounts: 1});
      const chip = model.familyChips.find((c) => c.id === 'payValue');
      expect(chip?.active).to.be.true;
      expect(chip?.count).to.eq(1);
    });

    it('handheld (1 column) stacks every tile', () => {
      const model = buildEffectsBrowseModel({
        entries: [...cnEntries, petsEntry],
        tableau: [], stats: undefined, familyFilter: 'all', columns: 1,
      });
      expect(model.rows).to.deep.eq([[cnEntries[0].key], [cnEntries[1].key], [petsEntry.key]]);
    });

    it('resolves per-effect metas through the channel split when stats are present', () => {
      const cnStat = stat({
        sourceKey: 'card:' + CardName.CARBON_NANOSYSTEMS,
        card: CardName.CARBON_NANOSYSTEMS,
        triggerCount: 1,
        megacreditsSaved: 8,
        cardResources: {[CardResource.GRAPHENE]: 1},
        byChannel: {
          'card-played': {...stat({triggerCount: 1, cardResources: {[CardResource.GRAPHENE]: 1}})},
          'resource-payment': {...stat({triggerCount: 1, megacreditsSaved: 8, paymentResources: {[CardResource.GRAPHENE]: 2}})},
        },
      });
      const model = buildEffectsBrowseModel({
        entries: cnEntries, tableau: [], stats: [cnStat], familyFilter: 'all', columns: 2,
      });
      expect(model.groups[0].tiles[0].meta).to.deep.eq({kind: 'stat', label: 'Times triggered', value: '1'});
      expect(model.groups[0].tiles[1].meta).to.deep.eq({kind: 'stat', label: 'Payment value', value: '8', icon: 'megacredits'});
    });

    it('metas claim nothing while stats are loading', () => {
      const model = buildEffectsBrowseModel({
        entries: [catapultEntry], tableau: [], stats: undefined, familyFilter: 'all', columns: 2,
      });
      expect(model.groups[0].tiles[0].meta).to.deep.eq({kind: 'none'});
    });
  });

  describe('grid navigation helpers', () => {
    it('packEffectRows closes a half row before a wide group', () => {
      const rows = packEffectRows([
        {tiles: [{key: 'a'}]},
        {tiles: [{key: 'b1'}, {key: 'b2'}]},
        {tiles: [{key: 'c'}]},
      ], 2);
      expect(rows).to.deep.eq([['a'], ['b1', 'b2'], ['c']]);
    });

    it('stepEffect clamps at both edges and recovers a lost key', () => {
      const keys = ['a', 'b', 'c'];
      expect(stepEffect(keys, 'a', -1)).to.eq('a');
      expect(stepEffect(keys, 'a', 1)).to.eq('b');
      expect(stepEffect(keys, 'c', 1)).to.eq('c');
      expect(stepEffect(keys, 'gone', 1)).to.eq('a');
      expect(stepEffect([], 'a', 1)).to.eq('a');
    });
  });

  describe('the summary-zone readouts', () => {
    it('counts per EFFECT (a two-effect card counts twice, in two families)', () => {
      const zone = effectsZoneCounts([
        entry({cardName: CardName.CARBON_NANOSYSTEMS, effectIndex: 0, signature: sig({icons: [CardResource.GRAPHENE]})}),
        entry({cardName: CardName.CARBON_NANOSYSTEMS, effectIndex: 1, key: CardName.CARBON_NANOSYSTEMS + '#1',
          signature: sig({icons: [CardResource.GRAPHENE, 'megacredits'], valueAsPayment: true})}),
        entry({cardName: CardName.EARTH_CATAPULT, signature: sig({icons: ['megacredits'], discount: true})}),
      ], []);
      expect(zone.total).to.eq(3);
      expect(zone.families).to.deep.eq([
        {family: 'triggers', label: 'Triggers', count: 1},
        {family: 'discounts', label: 'Discounts', count: 1},
        {family: 'payValue', label: 'Spending power', count: 1},
      ]);
      expect(zone.disabledCount).to.eq(0);
    });

    it('counts a disabled effect in its family AND separately', () => {
      const zone = effectsZoneCounts([
        entry({cardName: CardName.PHARMACY_UNION, isCorporation: true, isDisabled: true, signature: sig({icons: [CardResource.DISEASE]})}),
      ], []);
      expect(zone.families).to.deep.eq([{family: 'triggers', label: 'Triggers', count: 1}]);
      expect(zone.disabledCount).to.eq(1);
    });

    it('keeps the canonical family order whatever the entry order', () => {
      const zone = effectsZoneCounts([
        entry({cardName: CardName.ADVANCED_ALLOYS}),
        entry({cardName: CardName.EARTH_CATAPULT, signature: sig({icons: ['megacredits'], discount: true})}),
        entry({cardName: CardName.PETS, signature: sig({icons: [CardResource.ANIMAL]})}),
      ], []);
      expect(zone.families.map((f) => f.family)).to.deep.eq(['triggers', 'discounts', 'payValue']);
      expect(EFFECT_FAMILY_ORDER.indexOf(zone.families[0].family)).to.eq(0);
    });

    it('the stats line: undefined while loading, honest sums when present', () => {
      expect(effectsZoneStatsLine(undefined)).to.be.undefined;
      expect(effectsZoneStatsLine([
        stat({triggerCount: 3, megacreditsSaved: 2}),
        stat({triggerCount: 5}),
      ])).to.deep.eq({triggers: 8, savedMc: 2});
      expect(effectsZoneStatsLine([stat({})])).to.deep.eq({triggers: 0, savedMc: 0});
    });
  });
});
