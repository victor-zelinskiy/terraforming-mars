import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions, addCity} from '../TestingUtils';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Units} from '@/common/Units';
import {Pets} from '@/server/cards/base/Pets';
import {CarbonNanosystems} from '@/server/cards/promo/CarbonNanosystems';
import {Resource} from '@/common/Resource';
import {effectOverlayStats, EffectOverlayStat} from '@/common/events/aggregate';
import {getEffectSummary, classifyEffect, classifyEffectSignature} from '@/client/components/effects/effectSummary';

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
    tr: 0,
    globalParameterSteps: {},
    vp: 0,
    ...overrides,
  };
}

const PASSIVE_RULE_NOTE = 'A passive rule — it shapes how you play rather than producing a tally.';

describe('effect summary view-model', () => {
  it('reports an empty state for an effect that never fired', () => {
    const vm = getEffectSummary(stat({card: CardName.EARTH_CATAPULT}), {sourceName: CardName.EARTH_CATAPULT, sourceKind: 'card'});
    expect(vm.empty).to.be.true;
    expect(vm.triggerCount).to.eq(0);
  });

  it('builds generic impact lines from the aggregate', () => {
    const vm = getEffectSummary(
      stat({card: CardName.EARTH_CATAPULT, triggerCount: 12, megacreditsSaved: 24}),
      {sourceName: CardName.EARTH_CATAPULT, sourceKind: 'card'});
    expect(vm.empty).to.be.false;
    expect(vm.triggerCount).to.eq(12);
    const saved = vm.lines.find((l) => l.label === 'Saved');
    expect(saved?.value).to.eq('24');
    expect(saved?.icon).to.eq('megacredits');
  });

  it('uses a bespoke summary for a registered card (Pharmacy Union)', () => {
    const vm = getEffectSummary(
      stat({card: CardName.PHARMACY_UNION, kind: 'corporation', triggerCount: 5, tr: 2, cardResources: {[CardResource.DISEASE]: 4}}),
      {sourceName: CardName.PHARMACY_UNION, sourceKind: 'corporation'});
    expect(vm.headline).to.eq('Corporation ability');
    expect(vm.lines[0]).to.deep.include({icon: CardResource.DISEASE, label: 'Diseases', value: '+4'});
  });

  it('integrates with the real stream (Pets gathers animals)', () => {
    const [game, player] = testGame(1);
    player.playedCards.push(new Pets());
    addCity(player);
    addCity(player);
    runAllActions(game);

    const stats = effectOverlayStats(game.events.events, player.color);
    const pets = stats.find((s) => s.card === CardName.PETS);
    expect(pets, 'Pets overlay stat').to.not.be.undefined;
    expect(pets!.cardResources[CardResource.ANIMAL]).to.eq(2);

    const vm = getEffectSummary(pets!, {sourceName: CardName.PETS, sourceKind: 'card'});
    expect(vm.headline).to.eq('Animals gathered from cities');
    expect(vm.empty).to.be.false;
    const animals = vm.lines.find((l) => l.icon === CardResource.ANIMAL);
    expect(animals?.value).to.eq('+2');
    expect(vm.lastTrigger?.generation).to.eq(game.generation);
  });

  it('keeps passive-effect savings but EXCLUDES on-play (action-scope) gains', () => {
    const [game, player] = testGame(1);
    const events = game.events;
    const card = new CarbonNanosystems();
    // An on-play gain recorded under an ACTION scope (a card's immediate behavior
    // bonus, e.g. Solar Logistics' "+2 titanium" on play) must NOT leak into the
    // card's passive-effect stats.
    events.beginAction(player, {kind: 'card', card: card.name, owner: player.color});
    events.recordResourceDelta(player, Resource.TITANIUM, 2, false, {card});
    events.endScope();
    // A passive resource-as-payment saving (2 graphene spent, worth 8 M€).
    events.recordResourceAsPayment(player, card, 2, 8);

    const stats = effectOverlayStats(events.events, player.color);
    const cn = stats.find((s) => s.card === card.name);
    expect(cn, 'Carbon Nanosystems stat').to.not.be.undefined;
    expect(cn!.megacreditsSaved).to.eq(8); // passive payment saving kept
    expect(cn!.paymentResources[CardResource.GRAPHENE]).to.eq(2);
    expect(cn!.stock.titanium ?? 0).to.eq(0); // on-play gain excluded

    // The payment event is tagged so the JOURNAL route can EXCLUDE it (the spend is
    // already shown in the "Оплата" row) while the OVERLAY (above) still counts it.
    const paymentEvent = events.events.find((e) => e.tags?.includes('resource-payment'));
    expect(paymentEvent, 'a resource-payment event is recorded').to.not.be.undefined;
    expect(paymentEvent!.tags).to.include('passive-effect');
  });

  it('classifies an effect by its nature', () => {
    const ctx = (overrides: Partial<{sourceKind: 'card' | 'corporation', cardResourceType: CardResource}> = {}) =>
      ({sourceName: CardName.EARTH_CATAPULT, sourceKind: 'card' as const, ...overrides});
    expect(classifyEffect(ctx({sourceKind: 'corporation'}), stat({}))).to.eq('corporation');
    expect(classifyEffect(ctx(), stat({megacreditsSaved: 4}))).to.eq('discount');
    expect(classifyEffect(ctx({cardResourceType: CardResource.ANIMAL}), stat({}))).to.eq('resourceAccumulation');
    expect(classifyEffect(ctx(), stat({tr: 2}))).to.eq('passiveTr');
    expect(classifyEffect(ctx(), stat({production: {...Units.EMPTY, heat: 1}}))).to.eq('passiveProduction');
    expect(classifyEffect(ctx(), stat({triggerCount: 3}))).to.eq('trigger');
    expect(classifyEffect(ctx(), stat({}))).to.eq('ruleChange');
  });

  it('a discount effect reads as savings (category + headline)', () => {
    const vm = getEffectSummary(
      stat({card: CardName.EARTH_CATAPULT, triggerCount: 6, megacreditsSaved: 12}),
      {sourceName: CardName.EARTH_CATAPULT, sourceKind: 'card'});
    expect(vm.category).to.eq('discount');
    expect(vm.headline).to.eq('Cost reductions this game');
    expect(vm.empty).to.be.false;
    expect(vm.lines[0]).to.deep.include({label: 'Saved', value: '12'});
  });

  it('a resource card shows the live current value (distinct from cumulative added)', () => {
    const vm = getEffectSummary(
      stat({card: CardName.PETS, triggerCount: 3, cardResources: {[CardResource.ANIMAL]: 3}}),
      {sourceName: CardName.PETS, sourceKind: 'card', cardResourceType: CardResource.ANIMAL, currentCardResource: 5});
    expect(vm.category).to.eq('resourceAccumulation');
    expect(vm.currentValue).to.deep.eq({icon: CardResource.ANIMAL, value: '5'});
  });

  it('an empty rule-changing effect shows a thematic note, never a dead state', () => {
    const vm = getEffectSummary(
      stat({card: CardName.PROTECTED_HABITATS}),
      {sourceName: CardName.PROTECTED_HABITATS, sourceKind: 'card'});
    expect(vm.empty).to.be.true;
    expect(vm.lines).to.have.length(0);
    expect(vm.note).to.not.be.undefined;
  });

  it('a corporation effect is framed as a corporation ability', () => {
    const vm = getEffectSummary(
      stat({card: CardName.THARSIS_REPUBLIC, kind: 'corporation', triggerCount: 4}),
      {sourceName: CardName.THARSIS_REPUBLIC, sourceKind: 'corporation'});
    expect(vm.category).to.eq('corporation');
    expect(vm.headline).to.eq('Corporation ability');
  });

  it('marks a multi-effect card summary as card-scoped (stats aggregate the whole card)', () => {
    const vm = getEffectSummary(
      stat({card: CardName.PHARMACY_UNION, kind: 'corporation', triggerCount: 3, tr: 1}),
      {sourceName: CardName.PHARMACY_UNION, sourceKind: 'corporation', effectIndex: 0, effectCount: 2});
    expect(vm.cardScoped).to.be.true;
  });

  it('a single-effect summary is NOT card-scoped', () => {
    const vm = getEffectSummary(
      stat({card: CardName.EARTH_CATAPULT, megacreditsSaved: 4}),
      {sourceName: CardName.EARTH_CATAPULT, sourceKind: 'card', effectIndex: 0, effectCount: 1});
    expect(vm.cardScoped).to.eq(undefined);
  });

  it('scopes a multi-effect card stat to the SELECTED effect (hides sibling-only metrics)', () => {
    // PolderTech Dutch: effect A (ocean→energy) vs effect B (greenery→plant). Viewing
    // effect A must show energy but NOT the plant that belongs to effect B.
    const vm = getEffectSummary(
      stat({card: CardName.POLDERTECH_DUTCH, stock: {...Units.EMPTY, energy: 3, plants: 2}}),
      {
        sourceName: CardName.POLDERTECH_DUTCH, sourceKind: 'card', effectCount: 2,
        signature: {icons: ['energy'], discount: false, valueModifier: false, valueAsPayment: false},
        siblingIcons: ['plants'],
      });
    const icons = vm.lines.map((l) => l.icon);
    expect(icons).to.include('energy');
    expect(icons).to.not.include('plants'); // belongs to the sibling effect
    expect(vm.cardScoped).to.be.true;
    expect(vm.triggerCount).to.eq(0); // card-level firing count is hidden for a multi-effect card
  });

  it('classifies an effect from its render signature (per-effect headline)', () => {
    const c = {sourceName: CardName.SOLAR_LOGISTICS, sourceKind: 'card' as const};
    expect(classifyEffectSignature({icons: ['megacredits'], discount: true, valueModifier: false, valueAsPayment: false}, c)).to.eq('discount');
    expect(classifyEffectSignature({icons: ['cards'], discount: false, valueModifier: false, valueAsPayment: false}, c)).to.eq('trigger');
    expect(classifyEffectSignature({icons: ['Graphene'], discount: false, valueModifier: false, valueAsPayment: false}, c)).to.eq('resourceAccumulation');
    expect(classifyEffectSignature({icons: ['megacredits'], discount: false, valueModifier: true, valueAsPayment: false}, c)).to.eq('ruleChange');
    expect(classifyEffectSignature({icons: ['Graphene', 'megacredits'], discount: false, valueModifier: false, valueAsPayment: true}, c)).to.eq('payment');
  });

  it('a resource-as-payment effect shows VALUE + USED, never accumulation (Psychrophiles)', () => {
    const vm = getEffectSummary(
      stat({
        card: CardName.PSYCHROPHILES, megacreditsSaved: 6,
        paymentResources: {[CardResource.MICROBE]: 3},
        // Even if the card stat carried a microbe accumulation, the payment effect
        // must NOT show it as "Added".
        cardResources: {[CardResource.MICROBE]: 9},
      }),
      {
        sourceName: CardName.PSYCHROPHILES, sourceKind: 'card',
        cardResourceType: CardResource.MICROBE, currentCardResource: 4,
        signature: {icons: [CardResource.MICROBE, 'megacredits'], discount: false, valueModifier: false, valueAsPayment: true},
      });
    expect(vm.category).to.eq('payment');
    expect(vm.lines.find((l) => l.label === 'Payment value')?.value).to.eq('6');
    expect(vm.lines.find((l) => l.label === 'Spent as payment')?.value).to.eq('3');
    expect(vm.lines.some((l) => l.label === 'Added'), 'no accumulation line').to.be.false;
    expect(vm.currentValue).to.deep.eq({icon: CardResource.MICROBE, value: '4'});
  });

  it('an unused resource-as-payment effect shows a useful note, not a dead state', () => {
    const vm = getEffectSummary(
      stat({card: CardName.CARBON_NANOSYSTEMS}),
      {
        sourceName: CardName.CARBON_NANOSYSTEMS, sourceKind: 'card', effectCount: 2,
        cardResourceType: CardResource.GRAPHENE, currentCardResource: 2,
        signature: {icons: [CardResource.GRAPHENE, 'megacredits'], discount: false, valueModifier: false, valueAsPayment: true},
        siblingIcons: [CardResource.GRAPHENE],
      });
    expect(vm.category).to.eq('payment');
    expect(vm.empty).to.be.true;
    expect(vm.note).to.not.be.undefined;
  });

  // ── ROOT-CAUSE FIX: signature-driven empty note (no more blanket "passive rule") ──

  it('an unfired trigger effect frames its empty note by capability, NOT "passive rule"', () => {
    const vm = getEffectSummary(
      stat({card: CardName.MEDIA_GROUP}),
      {
        sourceName: CardName.MEDIA_GROUP,
        sourceKind: 'card',
        signature: {icons: ['megacredits'], discount: false, valueModifier: false, valueAsPayment: false},
      });
    expect(vm.empty).to.be.true;
    expect(vm.category).to.eq('trigger');
    expect(vm.note).to.not.eq(PASSIVE_RULE_NOTE);
  });

  it('a genuine rule-only effect (no result icons) still gets the honest "passive rule" note + ruleOnly confidence', () => {
    const vm = getEffectSummary(
      stat({card: CardName.PROTECTED_HABITATS}),
      {
        sourceName: CardName.PROTECTED_HABITATS,
        sourceKind: 'card',
        signature: {icons: [], discount: false, valueModifier: false, valueAsPayment: false},
      });
    expect(vm.empty).to.be.true;
    // Protected Habitats has a curated note (not the bare fallback), but confidence is rule-only.
    expect(vm.confidence).to.eq('ruleOnly');
  });

  // ── Payment-value modifier (steel/titanium worth more) ──

  it('frames a steel/titanium value modifier as a payment-value bonus even before any payment', () => {
    const vm = getEffectSummary(
      stat({card: CardName.ADVANCED_ALLOYS}),
      {sourceName: CardName.ADVANCED_ALLOYS, sourceKind: 'card'});
    expect(vm.category).to.eq('paymentValueBonus');
    expect(vm.note).to.not.eq(PASSIVE_RULE_NOTE);
    expect(vm.confidence).to.eq('exact');
  });

  it('shows the recorded payment-value bonus (extra value + spent under effect)', () => {
    const vm = getEffectSummary(
      stat({card: CardName.ADVANCED_ALLOYS, paymentValueBonus: {steel: 4, titanium: 3, bonusValue: 7, count: 2}}),
      {sourceName: CardName.ADVANCED_ALLOYS, sourceKind: 'card'});
    expect(vm.empty).to.be.false;
    expect(vm.headline).to.eq('Payment value bonus');
    expect(vm.triggerCount).to.eq(2);
    expect(vm.lines).to.deep.include({icon: 'megacredits', label: 'Extra value', value: '+7'});
    expect(vm.lines).to.deep.include({icon: 'steel', label: 'Spent under effect', value: '4'});
    expect(vm.lines).to.deep.include({icon: 'titanium', label: 'Spent under effect', value: '3'});
    expect(vm.confidence).to.eq('exact');
  });

  // ── Colony-track bonus (Trading Colony) ──

  it('frames Trading Colony AND Trade Envoys as colony-track effects even before any trade', () => {
    for (const card of [CardName.TRADING_COLONY, CardName.TRADE_ENVOYS]) {
      const vm = getEffectSummary(stat({card}), {sourceName: card, sourceKind: 'card'});
      expect(vm.category, card).to.eq('colonyTrade');
      expect(vm.note, card).to.not.eq(PASSIVE_RULE_NOTE);
      expect(vm.confidence, card).to.eq('partial');
    }
  });

  it('shows the recorded colony-track advances + per-colony breakdown', () => {
    const vm = getEffectSummary(
      stat({card: CardName.TRADING_COLONY, colonyTrack: {steps: 4, extraReward: 6, count: 4, colonies: {Pluto: 2, Luna: 1, Europa: 1} as any}}),
      {sourceName: CardName.TRADING_COLONY, sourceKind: 'card'});
    expect(vm.empty).to.be.false;
    expect(vm.headline).to.eq('Colony track advanced');
    expect(vm.triggerCount).to.eq(4);
    expect(vm.lines).to.deep.include({label: 'Track advanced', value: '+4'});
    expect(vm.lines).to.deep.include({label: 'Extra trade reward', value: '+6'});
    expect(vm.breakdown?.[0]).to.deep.eq({label: 'Pluto', value: '+2'}); // sorted desc by steps
    expect(vm.confidence).to.eq('partial');
  });

  // ── Trade discount (Cryo-Sleep / Rim Freighters) ──

  it('frames a trade-discount effect even before any trade', () => {
    const vm = getEffectSummary(
      stat({card: CardName.CRYO_SLEEP}),
      {sourceName: CardName.CRYO_SLEEP, sourceKind: 'card'});
    expect(vm.category).to.eq('tradeDiscount');
    expect(vm.note).to.not.eq(PASSIVE_RULE_NOTE);
    expect(vm.confidence).to.eq('partial');
  });

  it('shows the recorded trade-discount savings + per-colony breakdown', () => {
    const vm = getEffectSummary(
      stat({card: CardName.CRYO_SLEEP, tradeDiscount: {energy: 3, titanium: 0, megacredits: 0, count: 3, colonies: {Pluto: 2, Luna: 1} as any}}),
      {sourceName: CardName.CRYO_SLEEP, sourceKind: 'card'});
    expect(vm.empty).to.be.false;
    expect(vm.headline).to.eq('Trade discount');
    expect(vm.triggerCount).to.eq(3);
    expect(vm.lines).to.deep.include({icon: 'energy', label: 'Saved on trades', value: '3'});
    expect(vm.breakdown?.[0]).to.deep.eq({label: 'Pluto', value: '2'});
    expect(vm.confidence).to.eq('partial');
  });
});
