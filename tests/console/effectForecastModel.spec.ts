import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Color} from '@/common/Color';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {EffectForecast, EffectForecastFact, emptyEffectForecast} from '@/common/models/EffectForecastModel';
import {EffectSignature} from '@/client/components/effects/effectSummary';
import {
  FORECAST_CHIP_CAP,
  FORECAST_GROUP_META,
  FORECAST_GROUP_ORDER,
  VARIANT_REACTION_CAP,
  attributeFactToEffect,
  timingLabel,
  attributeItemToEffect,
  buildForecastBrowseModel,
  compactForecastChips,
  cycleForecastSection,
  discountTail,
  factBeyondOwnEffect,
  factInRow,
  forecastGroups,
  forecastItemCard,
  forecastItemOwner,
  forecastLayerAvailable,
  forecastMetaLine,
  forecastOrderBand,
  forecastRowPresent,
  forecastSectionChips,
  groupOfFact,
  variantReactionChips,
} from '@/client/console/effectForecastModel';

/**
 * THE PURE FORECAST VIEW-MODEL — the client arranges the server's facts and
 * adds no rule: degrees → groups, chip merging by pool inside one degree, the
 * cap with «+N», the parity of the row's counters, the «Не сработает»
 * membership, the «ПОРЯДОК» band's honesty rule, the arrow-only-for-untouched
 * reading, the section chips and the printed-effect attribution.
 */

const YOU = {kind: 'you'} as const;
const RED = {kind: 'player', color: ('red' as Color)} as const;
const BOT = {kind: 'bot', color: ('green' as Color)} as const;

let seq = 0;
function fact(over: Partial<EffectForecastFact> & {effects?: Array<ActionEffect>} = {}): EffectForecastFact {
  seq++;
  return {
    id: over.id ?? `f${seq}`,
    source: over.source ?? {kind: 'card', name: CardName.CARBON_NANOSYSTEMS, owner: ('blue' as Color), channel: 'card-played'},
    certainty: over.certainty ?? 'exact',
    recipient: over.recipient ?? YOU,
    timing: over.timing ?? 'immediate',
    effects: over.effects ?? [gain('graphene', 1)],
    reason: over.reason ?? 'You play a card with a ${0} tag',
    ...(over.sequence !== undefined ? {sequence: over.sequence} : {}),
    ...(over.alternatives !== undefined ? {alternatives: over.alternatives} : {}),
    ...(over.condition !== undefined ? {condition: over.condition} : {}),
    ...(over.note !== undefined ? {note: over.note} : {}),
  };
}

function gain(icon: string, amount: number, extra: Partial<ActionEffect> = {}): ActionEffect {
  return {direction: 'gain', icon, amount, ...extra};
}

function cost(icon: string, amount: number, extra: Partial<ActionEffect> = {}): ActionEffect {
  return {direction: 'cost', icon, amount, ...extra};
}

function forecast(facts: Array<EffectForecastFact>, over: Partial<EffectForecast> = {}): EffectForecast {
  return {...emptyEffectForecast(10), facts, ...over};
}

const sig = (overrides: Partial<EffectSignature> = {}): EffectSignature =>
  ({icons: [], discount: false, valueModifier: false, valueAsPayment: false, ...overrides});

describe('effectForecastModel', () => {
  describe('the certainty ladder → the eight groups', () => {
    it('crosses certainty with the recipient', () => {
      expect(groupOfFact(fact({certainty: 'exact'}), false)).to.eq('receive');
      expect(groupOfFact(fact({certainty: 'exact', recipient: RED}), false)).to.eq('others');
      expect(groupOfFact(fact({certainty: 'asks'}), false)).to.eq('asked');
      expect(groupOfFact(fact({certainty: 'asks', recipient: BOT}), false)).to.eq('others');
      expect(groupOfFact(fact({certainty: 'deferred'}), false)).to.eq('later');
      expect(groupOfFact(fact({certainty: 'deferred', recipient: RED}), false)).to.eq('others');
      expect(groupOfFact(fact({certainty: 'unknown'}), false)).to.eq('later');
      expect(groupOfFact(fact({certainty: 'skipped'}), false)).to.eq('skipped');
      expect(groupOfFact(fact({certainty: 'no'}), false)).to.eq('no');
      expect(groupOfFact(fact({certainty: 'conditional'}), false)).to.eq('depends');
      // A branch-tied fact is «depends» whatever its own certainty says.
      expect(groupOfFact(fact({certainty: 'exact'}), true)).to.eq('depends');
    });

    it('«Не сработает» holds ONLY explicit `no` facts — never the rest of the table', () => {
      const f = forecast([fact({certainty: 'no', effects: [], reason: 'The card is not an event'}), fact({certainty: 'exact'})]);
      const groups = forecastGroups(f);
      expect(groups.map((g) => g.id)).to.deep.eq(['receive', 'no']);
      expect(groups[1].items).to.have.length(1);
    });
  });

  describe('the compact «Сработает» row', () => {
    it('membership: exact / asks / unknown are in; deferred / conditional / skipped / no are not', () => {
      expect(factInRow(fact({certainty: 'exact'}))).to.be.true;
      expect(factInRow(fact({certainty: 'asks', effects: []}))).to.be.true;
      expect(factInRow(fact({certainty: 'unknown', effects: []}))).to.be.true;
      expect(factInRow(fact({certainty: 'deferred'}))).to.be.false;
      expect(factInRow(fact({certainty: 'conditional'}))).to.be.false;
      expect(factInRow(fact({certainty: 'skipped'}))).to.be.false;
      expect(factInRow(fact({certainty: 'no', effects: []}))).to.be.false;
      // An exact fact with NO chips (a chip-less deferred-style reading) draws nothing.
      expect(factInRow(fact({certainty: 'exact', effects: []}))).to.be.false;
    });

    it('merges the SAME pool inside one degree (two +2 M€ sources → one +4 M€) and never across degrees', () => {
      const f = forecast([
        fact({effects: [gain('megacredits', 2)]}),
        fact({effects: [gain('megacredits', 2)]}),
        fact({certainty: 'asks', effects: [gain('megacredits', 2)], alternatives: [{label: 'Do nothing', effects: []}]}),
      ]);
      const row = compactForecastChips(f);
      expect(row.chips.map((c) => c.kind)).to.deep.eq(['own', 'asks']);
      expect(row.chips[0].kind === 'own' && row.chips[0].effect.amount).to.eq(4);
      expect(row.chips[1].kind === 'asks' && row.chips[1].effect.amount).to.eq(2);
      expect(row.chips[0].facts).to.eq(2);
    });

    it('a production step never merges with a stock gain of the same resource — and keeps its production flag', () => {
      const f = forecast([
        fact({effects: [gain('megacredits', 1, {note: 'production'})]}),
        fact({effects: [gain('megacredits', 3)]}),
      ]);
      const chips = compactForecastChips(f).chips;
      expect(chips).to.have.length(2);
      expect(chips.map((c) => c.kind === 'own' && c.production)).to.deep.eq([true, false]);
    });

    it('every chip is a BARE delta: no arrow, no note, no basis, no host — whatever the fact carried', () => {
      const f = forecast([
        fact({effects: [gain('megacredits', 2, {current: 10, resulting: 12, basis: [{count: 2, label: 'Cities on Mars'}]})]}),
        fact({effects: [gain('megacredits', 3, {current: 10, resulting: 13})]}),
        fact({certainty: 'asks', effects: [gain('microbe', 1, {note: 'on the played card', host: CardName.NITRITE_REDUCING_BACTERIA})], alternatives: []}),
        fact({recipient: RED, effects: [cost('megacredits', 4, {current: 30, resulting: 26})]}),
      ]);
      const chips = compactForecastChips(f).chips;
      expect(chips.map((c) => c.kind)).to.deep.eq(['own', 'asks', 'other']);
      for (const chip of chips) {
        expect(chip.kind === 'own' || chip.kind === 'asks' || chip.kind === 'other').to.be.true;
        if (chip.kind === 'own' || chip.kind === 'asks' || chip.kind === 'other') {
          expect(Object.keys(chip.effect).sort()).to.deep.eq(['amount', 'direction', 'icon']);
        }
      }
      expect(chips[0].kind === 'own' && chips[0].effect.amount).to.eq(5);
      // A unit suffix (a global parameter's °C / %) is part of the delta and stays.
      const unit = compactForecastChips(forecast([fact({effects: [gain('temperature', 2, {unit: '°C', current: -30, resulting: -26})]})])).chips[0];
      expect(unit.kind === 'own' && unit.effect).to.deep.eq({direction: 'gain', icon: 'temperature', amount: 2, unit: '°C'});
    });

    it('other seats merge per seat per pool; different seats never merge; bots keep their flag', () => {
      const f = forecast([
        fact({recipient: RED, effects: [gain('megacredits', 2)]}),
        fact({recipient: RED, effects: [gain('megacredits', 2)]}),
        fact({recipient: BOT, effects: [gain('megacredits', 2)]}),
      ]);
      const row = compactForecastChips(f);
      expect(row.chips.map((c) => c.kind)).to.deep.eq(['other', 'other']);
      const [red, bot] = row.chips;
      expect(red.kind === 'other' && red.color).to.eq(('red' as Color));
      expect(red.kind === 'other' && red.effect.amount).to.eq(4);
      expect(red.kind === 'other' && red.bot).to.be.false;
      expect(bot.kind === 'other' && bot.bot).to.be.true;
    });

    it('order: own exact → asks → other seats → ⚡?; ONE unknown chip for every uncomputed reaction', () => {
      const f = forecast([
        fact({certainty: 'unknown', effects: []}),
        fact({recipient: RED, effects: [cost('megacredits', 4)]}),
        fact({certainty: 'asks', effects: [gain('science', 1)], alternatives: []}),
        fact({certainty: 'unknown', effects: []}),
        fact({effects: [gain('graphene', 1)]}),
      ]);
      const row = compactForecastChips(f);
      expect(row.chips.map((c) => c.kind)).to.deep.eq(['own', 'asks', 'other', 'unknown']);
      expect(row.chips[3].facts).to.eq(2);
    });

    it('an ASKS chip shows the first GAIN of the first outcome', () => {
      const f = forecast([fact({certainty: 'asks', effects: [cost('cards', 1), gain('cards', 1)], alternatives: [{label: 'Do nothing', effects: []}]})]);
      const chip = compactForecastChips(f).chips[0];
      expect(chip.kind === 'asks' && chip.effect.direction).to.eq('gain');
    });

    it(`caps at ${FORECAST_CHIP_CAP} chips with «+N», and the counters stay in PARITY with the facts`, () => {
      const f = forecast([
        fact({effects: [gain('megacredits', 1)]}),
        fact({effects: [gain('steel', 1)]}),
        fact({effects: [gain('titanium', 1)]}),
        fact({effects: [gain('plants', 1)]}),
        fact({effects: [gain('energy', 1)]}),
        fact({recipient: RED, effects: [gain('heat', 1)]}),
      ]);
      const row = compactForecastChips(f);
      expect(row.chips).to.have.length(FORECAST_CHIP_CAP);
      const last = row.chips[FORECAST_CHIP_CAP - 1];
      expect(last.kind).to.eq('more');
      expect(last.kind === 'more' && last.count).to.eq(3);
      expect(last.facts).to.eq(3);
      expect(row.total).to.eq(6);
      expect(row.represented).to.eq(row.total);
    });

    it('parity: a fact that feeds TWO pools (M€ + heat) is counted once', () => {
      const f = forecast([fact({effects: [gain('megacredits', 3), gain('heat', 3)]})]);
      const row = compactForecastChips(f);
      expect(row.chips).to.have.length(2);
      expect(row.total).to.eq(1);
      expect(row.represented).to.eq(1);
    });

    it('merges by `icon + stock/production + degree + recipient` — the ASSIGNMENT is not in the key (a microbe on Decomposers + a microbe on the played card = «+2 🦠»)', () => {
      const f = forecast([
        fact({id: 'decomposers', effects: [gain('microbe', 1, {note: 'on this card', host: CardName.DECOMPOSERS, current: 0, resulting: 1})]}),
        fact({id: 'splice-own', effects: [gain('microbe', 1, {note: 'on the played card', host: CardName.NITRITE_REDUCING_BACTERIA})]}),
        fact({id: 'to-any', effects: [gain('microbe', 1, {note: 'to a card'})]}),
      ]);
      const row = compactForecastChips(f);
      expect(row.chips).to.have.length(1);
      expect(row.chips[0].kind === 'own' && row.chips[0].effect).to.deep.eq({direction: 'gain', icon: 'microbe', amount: 3});
      expect(row.chips[0].facts).to.eq(3);
      expect(row.represented).to.eq(row.total);
    });

    it('never merges ACROSS a degree: «+1 🦠» and «+1 🦠 ?» stay two chips, and a foreign asked gain never joins a foreign guaranteed one', () => {
      const f = forecast([
        fact({effects: [gain('microbe', 1, {note: 'on this card'})]}),
        fact({certainty: 'asks', effects: [gain('microbe', 1, {note: 'on the played card'})], alternatives: []}),
        fact({recipient: RED, effects: [gain('megacredits', 2)]}),
        fact({recipient: RED, certainty: 'asks', effects: [gain('megacredits', 2)], alternatives: []}),
      ]);
      const row = compactForecastChips(f);
      expect(row.chips.map((c) => c.kind)).to.deep.eq(['own', 'asks', 'other', 'other']);
      expect(row.chips.map((c) => (c.kind === 'own' || c.kind === 'asks' || c.kind === 'other') ? c.effect.amount : 0)).to.deep.eq([1, 1, 2, 2]);
      expect(row.total).to.eq(4);
      expect(row.represented).to.eq(4);
    });

    it('keeps a gain and a LOSS of one pool as two chips — a net the server never stated is not a merge', () => {
      const f = forecast([
        fact({recipient: RED, effects: [gain('megacredits', 2)]}),
        fact({recipient: RED, effects: [cost('megacredits', 4)]}),
      ]);
      const row = compactForecastChips(f);
      expect(row.chips.map((c) => c.kind === 'other' && c.effect.direction)).to.deep.eq(['gain', 'cost']);
    });

    it('branch-tied facts never reach the row (they live in their variant)', () => {
      const f = forecast([], {byBranch: {0: [fact({certainty: 'conditional'})]}});
      expect(compactForecastChips(f).chips).to.have.length(0);
      expect(forecastRowPresent(f)).to.be.false;
      expect(forecastLayerAvailable(f)).to.be.true;
    });
  });

  describe('the variant reaction chips («⚡ сработает»)', () => {
    it(`draws ONLY the branch's facts as bare deltas — own → asked → other seats — capped at ${VARIANT_REACTION_CAP} + «+N», with the seat colour and the ask flag`, () => {
      const f = forecast([fact({effects: [gain('graphene', 1)]})], {byBranch: {
        1: [
          fact({certainty: 'conditional', effects: [gain('energy', 1, {current: 0, resulting: 1})]}),
          fact({certainty: 'asks', recipient: RED, effects: [gain('megacredits', 2)], alternatives: []}),
          fact({certainty: 'conditional', effects: [gain('plants', 2, {note: 'production'})]}),
          fact({certainty: 'unknown', effects: []}),
        ],
      }});
      const v = variantReactionChips(f, 1);
      // Own first, then the foreign asked gain — folded past the cap.
      expect(v.chips.map((c) => c.effect.icon)).to.deep.eq(['energy', 'plants']);
      expect(v.chips[0].effect).to.deep.eq({direction: 'gain', icon: 'energy', amount: 1});
      expect(v.chips[1].production).to.be.true;
      expect(v.more).to.eq(1);
      expect(v.total, 'the unknown is not a chip').to.eq(3);
      expect(variantReactionChips(f, 0).chips).to.have.length(0);
      const two = variantReactionChips(forecast([], {byBranch: {0: [
        fact({certainty: 'conditional', effects: [gain('energy', 1)]}),
        fact({certainty: 'asks', recipient: RED, effects: [gain('megacredits', 2)], alternatives: []}),
      ]}}), 0);
      expect(two.chips[1].color).to.eq(('red' as Color));
      expect(two.chips[1].asks).to.be.true;
      expect(two.more).to.eq(0);
    });

    it('merges inside a variant by the row\'s own key, never across a degree', () => {
      const f = forecast([], {byBranch: {0: [
        fact({id: 'a', certainty: 'conditional', effects: [gain('microbe', 1, {note: 'on this card'})]}),
        fact({id: 'b', certainty: 'conditional', effects: [gain('microbe', 1, {note: 'on the played card'})]}),
        fact({id: 'c', certainty: 'asks', effects: [gain('microbe', 1, {note: 'on the played card'})], alternatives: []}),
      ]}});
      const v = variantReactionChips(f, 0);
      expect(v.chips.map((c) => [c.effect.amount, c.asks, c.facts])).to.deep.eq([[2, false, 2], [1, true, 1]]);
      expect(v.more).to.eq(0);
      expect(v.total).to.eq(3);
    });
  });

  describe('the WHEN vocabulary per operation', () => {
    it('an immediate reaction lands «right after the play» on the play screen and «right after the action» on the action screen', () => {
      expect(timingLabel('immediate')).to.eq('Right after the play');
      expect(timingLabel('immediate', 'play')).to.eq('Right after the play');
      expect(timingLabel('immediate', 'action')).to.eq('Right after the action');
      // Every other moment names itself the same on both screens.
      expect(timingLabel('after-placement', 'action')).to.eq('After the tile is placed');
      expect(timingLabel('before-card-choices', 'action')).to.eq('Before the card\'s own choices');
      const meta = forecastMetaLine({kind: 'fact', key: 'a', group: 'later', fact: fact({certainty: 'deferred', timing: 'after-placement'})}, 'action');
      expect(meta.label).to.eq('After the tile is placed');
    });

    it('«Зависит от вашего выбора» wears the effects bolt — the same glyph the variant cards\' «сработает» note carries', () => {
      expect(FORECAST_GROUP_META.depends.glyph).to.eq('⚡');
      expect(FORECAST_GROUP_META.receive.glyph).to.eq('⚡');
    });
  });

  describe('the discount tail + the layer / row presence', () => {
    it('a discounted price reads base → final with the saving; an undiscounted one draws nothing', () => {
      expect(discountTail(forecast([], {discounts: {base: 10, final: 8, items: [], other: 2}}))).to.deep.eq({base: 10, final: 8, saved: 2});
      expect(discountTail(forecast([]))).to.be.undefined;
      expect(discountTail(undefined)).to.be.undefined;
    });

    it('an EMPTY forecast publishes nothing; a discount-only forecast keeps the layer but draws no row', () => {
      expect(forecastLayerAvailable(forecast([]))).to.be.false;
      expect(forecastRowPresent(forecast([]))).to.be.false;
      const discountOnly = forecast([], {discounts: {base: 10, final: 8, items: [{source: {kind: 'card', card: CardName.EARTH_CATAPULT}, amount: 2}], other: 0}});
      expect(forecastLayerAvailable(discountOnly)).to.be.true;
      expect(forecastRowPresent(discountOnly)).to.be.false;
      const payOnly = forecast([], {paymentValues: [{source: {kind: 'card', card: CardName.CARBON_NANOSYSTEMS}, resource: CardResource.GRAPHENE, value: 4, count: 2}]});
      expect(forecastLayerAvailable(payOnly)).to.be.true;
    });
  });

  describe('the groups of the layer', () => {
    it('keeps the fixed order and lists NON-EMPTY groups only', () => {
      const f = forecast([
        fact({certainty: 'no', effects: []}),
        fact({recipient: RED}),
        fact({certainty: 'asks', alternatives: []}),
        fact({certainty: 'exact'}),
      ], {discounts: {base: 10, final: 7, items: [{source: {kind: 'card', card: CardName.EARTH_CATAPULT}, amount: 2}], other: 1}});
      const groups = forecastGroups(f);
      expect(groups.map((g) => g.id)).to.deep.eq(['receive', 'asked', 'discounts', 'others', 'no']);
      for (const id of groups.map((g) => g.id)) {
        expect(FORECAST_GROUP_ORDER).to.include(id);
      }
      const discounts = groups.find((g) => g.id === 'discounts');
      expect(discounts?.items.map((i) => i.kind)).to.deep.eq(['discount', 'other-discount']);
    });

    it('«Зависит от выбора» lists one entry per AVAILABLE branch — its facts or «nothing will trigger»', () => {
      const f = forecast([], {byBranch: {0: [fact({certainty: 'conditional'})]}});
      const groups = forecastGroups(f, [
        {pos: 0, title: 'A', available: true},
        {pos: 1, title: 'B', available: true},
        {pos: 2, title: 'C', available: false},
      ]);
      expect(groups).to.have.length(1);
      expect(groups[0].id).to.eq('depends');
      expect(groups[0].items.map((i) => i.kind)).to.deep.eq(['fact', 'branch-empty']);
      const empty = groups[0].items[1];
      expect(empty.kind === 'branch-empty' && empty.branchPos).to.eq(1);
    });

    it('the payment values join the discounts group', () => {
      const f = forecast([], {paymentValues: [{source: {kind: 'card', card: CardName.CARBON_NANOSYSTEMS}, resource: CardResource.GRAPHENE, value: 4, count: 2}]});
      const groups = forecastGroups(f);
      expect(groups.map((g) => g.id)).to.deep.eq(['discounts']);
      expect(groups[0].items[0].kind).to.eq('payment');
    });
  });

  describe('the section chips (LT/RT)', () => {
    it('«All N» + every non-empty group, and the cycle wraps in both directions', () => {
      const f = forecast([fact(), fact({certainty: 'asks', alternatives: []})]);
      const groups = forecastGroups(f);
      const chips = forecastSectionChips(groups, 'all');
      expect(chips.map((c) => c.id)).to.deep.eq(['all', 'receive', 'asked']);
      expect(chips[0].count).to.eq(2);
      expect(chips[0].active).to.be.true;
      expect(cycleForecastSection(groups, 'all', 1)).to.eq('receive');
      expect(cycleForecastSection(groups, 'asked', 1)).to.eq('all');
      expect(cycleForecastSection(groups, 'all', -1)).to.eq('asked');
    });
  });

  describe('the browse model', () => {
    it('packs each section into its own rows, `columns` abreast, and keys every tile', () => {
      const f = forecast([fact(), fact(), fact(), fact({certainty: 'asks', alternatives: []})]);
      const two = buildForecastBrowseModel({forecast: f, branches: [], sectionFilter: 'all', columns: 2});
      expect(two.sections.map((s) => s.id)).to.deep.eq(['receive', 'asked']);
      expect(two.rows.map((r) => r.length)).to.deep.eq([2, 1, 1]);
      expect(two.flatKeys).to.have.length(4);
      const one = buildForecastBrowseModel({forecast: f, branches: [], sectionFilter: 'all', columns: 1});
      expect(one.rows.map((r) => r.length)).to.deep.eq([1, 1, 1, 1]);
      const faceted = buildForecastBrowseModel({forecast: f, branches: [], sectionFilter: 'asked', columns: 2});
      expect(faceted.sections.map((s) => s.id)).to.deep.eq(['asked']);
      expect(faceted.total, 'counts stay facet-independent').to.eq(4);
    });

    it('names the source card and the owner of every item kind', () => {
      const f = forecast([
        fact({source: {kind: 'rule', name: 'Ruling party policy', owner: ('blue' as Color), channel: 'card-played'}, certainty: 'unknown', effects: []}),
        fact({source: {kind: 'card', name: CardName.PHARMACY_UNION, owner: ('red' as Color), channel: 'card-played-by-any'}, recipient: RED}),
      ], {
        discounts: {base: 10, final: 7, items: [{source: {kind: 'card', card: CardName.EARTH_CATAPULT, owner: ('blue' as Color)}, amount: 2}], other: 1},
      });
      const model = buildForecastBrowseModel({forecast: f, branches: [], sectionFilter: 'all', columns: 2});
      const items = model.sections.flatMap((s) => s.tiles.map((t) => t.item));
      const rule = items.find((i) => i.kind === 'fact' && i.fact.source.kind === 'rule');
      const foreign = items.find((i) => i.kind === 'fact' && i.fact.source.kind === 'card');
      const discount = items.find((i) => i.kind === 'discount');
      const other = items.find((i) => i.kind === 'other-discount');
      expect(rule !== undefined && forecastItemCard(rule)).to.be.undefined;
      expect(foreign !== undefined && forecastItemCard(foreign)).to.eq(CardName.PHARMACY_UNION);
      expect(foreign !== undefined && forecastItemOwner(foreign, ('blue' as Color))).to.eq(('red' as Color));
      expect(discount !== undefined && forecastItemCard(discount)).to.eq(CardName.EARTH_CATAPULT);
      expect(other !== undefined && forecastItemCard(other)).to.be.undefined;
      expect(other !== undefined && forecastItemOwner(other, ('blue' as Color))).to.eq(('blue' as Color));
    });
  });

  describe('the «ПОРЯДОК» band', () => {
    it('renders only with two or more asks/deferred facts that ALL declare a sequence', () => {
      const one = forecast([fact({certainty: 'asks', sequence: 1, alternatives: []})]);
      expect(forecastOrderBand(one, undefined, {cardChoices: false, placesTile: false})).to.have.length(0);
      const missing = forecast([
        fact({certainty: 'asks', sequence: 1, alternatives: []}),
        fact({certainty: 'deferred', timing: 'after-placement'}),
      ]);
      expect(forecastOrderBand(missing, undefined, {cardChoices: false, placesTile: false}), 'a guessed order is worse than none').to.have.length(0);
    });

    it('orders by timing then by the declared priority, with the play\'s own moments in between', () => {
      const f = forecast([
        fact({id: 'rover', certainty: 'deferred', timing: 'after-placement', sequence: 20}),
        fact({id: 'olympus', certainty: 'asks', timing: 'before-card-choices', sequence: 5, alternatives: []}),
        fact({id: 'pharmacy', certainty: 'asks', timing: 'before-card-choices', sequence: 2, alternatives: []}),
        fact({id: 'viral', certainty: 'asks', timing: 'after-card', sequence: 10, alternatives: []}),
      ]);
      const band = forecastOrderBand(f, undefined, {cardChoices: true, placesTile: true});
      expect(band.map((s) => s.key)).to.deep.eq(['pharmacy', 'olympus', 'card-choice', 'viral', 'cell', 'rover']);
    });

    it('includes the SELECTED branch\'s deferred facts, not the other branches\'', () => {
      const f = forecast([fact({certainty: 'asks', sequence: 1, alternatives: []})], {byBranch: {
        0: [fact({id: 'b0', certainty: 'conditional', timing: 'after-placement', sequence: 20})],
        1: [fact({id: 'b1', certainty: 'conditional', timing: 'after-placement', sequence: 20})],
      }});
      const band = forecastOrderBand(f, 1, {cardChoices: false, placesTile: false});
      expect(band.map((s) => s.key)).to.include('b1');
      expect(band.map((s) => s.key)).to.not.include('b0');
    });
  });

  describe('the attribution to the printed effect block', () => {
    const cn0 = {key: 'CN#0', cardName: CardName.CARBON_NANOSYSTEMS, effectIndex: 0, signature: sig()};
    const cn1 = {key: 'CN#1', cardName: CardName.CARBON_NANOSYSTEMS, effectIndex: 1, signature: sig({valueAsPayment: true})};

    it('a single-effect card attributes to its one block; a multi-effect card by the channel plan', () => {
      expect(attributeFactToEffect('card-played', [cn0])).to.eq(cn0);
      expect(attributeFactToEffect('card-played', [cn0, cn1])).to.eq(cn0);
      // A channel no block claims → honest «an effect of this card».
      expect(attributeFactToEffect('tile-placed', [cn0, cn1])).to.be.undefined;
    });

    it('a block the CARD FILE declared (`printedEffect`) wins over the plan — Pharmacy Union\'s two halves share one channel', () => {
      const pu0 = {key: 'PU#0', cardName: CardName.PHARMACY_UNION, effectIndex: 0, signature: sig()};
      const pu1 = {key: 'PU#1', cardName: CardName.PHARMACY_UNION, effectIndex: 1, signature: sig()};
      // No plan and two blocks → nothing to vouch for…
      expect(attributeFactToEffect('card-played-by-any', [pu0, pu1])).to.be.undefined;
      // …unless the fact names its block.
      expect(attributeFactToEffect('card-played-by-any', [pu0, pu1], 0)).to.eq(pu0);
      expect(attributeFactToEffect('card-played-by-any', [pu0, pu1], 1)).to.eq(pu1);
      // A declared index the card does not have falls back to the plan (honestly undefined here).
      expect(attributeFactToEffect('card-played-by-any', [pu0, pu1], 7)).to.be.undefined;
      const microbe = fact({source: {kind: 'corporation', name: CardName.PHARMACY_UNION, owner: ('red' as Color), channel: 'card-played-by-any', printedEffect: 0}, recipient: RED});
      expect(attributeItemToEffect({kind: 'fact', key: 'm', fact: microbe, group: 'others'}, [pu0, pu1])).to.eq(pu0);
    });

    it('a discount item points at the discount block, a payment value at the spending-power block', () => {
      const disc = {key: 'EC#0', cardName: CardName.EARTH_CATAPULT, effectIndex: 0, signature: sig({discount: true})};
      const other = {key: 'EC#1', cardName: CardName.EARTH_CATAPULT, effectIndex: 1, signature: sig()};
      expect(attributeItemToEffect({kind: 'discount', key: 'd', source: {kind: 'card', card: CardName.EARTH_CATAPULT}, amount: 2, group: 'discounts'}, [other, disc])).to.eq(disc);
      expect(attributeItemToEffect({kind: 'payment', key: 'p', value: {source: {kind: 'card', card: CardName.CARBON_NANOSYSTEMS}, resource: CardResource.GRAPHENE, value: 4, count: 1}, group: 'discounts'}, [cn0, cn1])).to.eq(cn1);
      expect(attributeItemToEffect({kind: 'other-discount', key: 'o', amount: 1, group: 'discounts'}, [cn0])).to.be.undefined;
    });
  });

  describe('the five questions', () => {
    it('«was → becomes» only for an untouched pool: a bare gain reads «beyond the card\'s own effect»', () => {
      expect(factBeyondOwnEffect(fact({effects: [gain('megacredits', 3)]}))).to.be.true;
      expect(factBeyondOwnEffect(fact({effects: [gain('megacredits', 3, {current: 10, resulting: 13})]}))).to.be.false;
      expect(factBeyondOwnEffect(fact({recipient: RED, effects: [gain('megacredits', 3)]}))).to.be.false;
    });

    it('the meta line: an exact gain speaks through its chips alone; every other degree adds its one word', () => {
      expect(forecastMetaLine({kind: 'fact', key: 'a', fact: fact(), group: 'receive'}).label).to.be.undefined;
      const asks = forecastMetaLine({kind: 'fact', key: 'b', group: 'asked',
        fact: fact({certainty: 'asks', effects: [gain('science', 1)], alternatives: [{label: 'Draw a card', effects: [gain('cards', 1)]}]})});
      expect(asks.label).to.eq('You will be asked');
      expect(asks.alternative?.chips[0].icon).to.eq('cards');
      expect(forecastMetaLine({kind: 'fact', key: 'c', group: 'later', fact: fact({certainty: 'deferred', timing: 'after-placement'})}).label).to.eq('After the tile is placed');
      expect(forecastMetaLine({kind: 'fact', key: 'd', group: 'later', fact: fact({certainty: 'unknown', effects: []})}).label).to.eq('Not calculated');
      expect(forecastMetaLine({kind: 'fact', key: 'e', group: 'no', fact: fact({certainty: 'no', effects: []})}).label).to.eq('Will not trigger');
      expect(forecastMetaLine({kind: 'other-discount', key: 'f', amount: 1, group: 'discounts'}).chips).to.have.length(0);
    });
  });
});
