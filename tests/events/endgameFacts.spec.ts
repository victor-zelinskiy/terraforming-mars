import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {buildEndgameFacts, EndgameFact, FactType} from '@/common/events/endgameFacts';
import {
  economyEngineStream,
  colonyEngineStream,
  blueActionEngineStream,
  negativeInteractionStream,
  globalParameterStream,
  unusedEngineStream,
  revealSearchStream,
  shownHandStream,
  productionTransferStream,
  lateEconomyBurstStream,
  mixedWinnerStream,
} from './endgameFactFixtures';

/** The analysis-ready Fact Engine over the synthetic analyzer scenarios. PURE, so it
 *  runs under the server runner; deterministic ids → snapshot-stable. */
function factsOf(events: ReadonlyArray<import('@/common/events/GameEvent').GameEvent>, opts = {}): Array<EndgameFact> {
  return buildEndgameFacts(events, opts);
}
function byType(facts: ReadonlyArray<EndgameFact>, type: FactType): Array<EndgameFact> {
  return facts.filter((f) => f.type === type);
}

describe('endgame Fact Engine', () => {
  it('an empty stream yields no facts', () => {
    expect(buildEndgameFacts([])).to.have.length(0);
  });

  it('economy engine → an economy fact with the measured M€ saved + the value bonus', () => {
    const facts = factsOf(economyEngineStream());
    const econ = byType(facts, 'economy');
    expect(econ).to.have.length(1);
    expect(econ[0].player).to.eq('red');
    // 4 gens × (2 discount + 3 titanium-value bonus) = 8 discount + 12 bonus = 20 M€.
    expect(econ[0].metrics.savedMegacredits).to.eq(20);
    expect(econ[0].metrics.discountAndPaymentSaved).to.eq(8);
    expect(econ[0].metrics.paymentValueBonus).to.eq(12);
    expect(econ[0].confidence).to.eq('partial');
  });

  it('colony engine → a colony fact with trades + track + trade-discount', () => {
    const facts = factsOf(colonyEngineStream());
    const colony = byType(facts, 'colony');
    expect(colony).to.have.length(1);
    expect(colony[0].player).to.eq('blue');
    expect(colony[0].metrics.trades).to.eq(4);
    expect(colony[0].metrics.trackBonusSteps).to.eq(4);
    expect(colony[0].metrics.tradeDiscountUnits).to.eq(4);
  });

  it('blue-action engine → an action-usage fact; the PLAY is not counted as an activation', () => {
    const facts = factsOf(blueActionEngineStream(), {cardHasAction: (c: CardName) => c === CardName.AI_CENTRAL});
    const action = byType(facts, 'actionUsage').find((f) => f.sourceCard === CardName.AI_CENTRAL);
    expect(action, 'AI Central action fact').to.not.be.undefined;
    expect(action!.metrics.activations, 'play (gen 2) excluded, 5 activations gen 3-7').to.eq(5);
    expect(action!.metrics.cardsDrawn).to.eq(10);

    // Engine-timing: played gen 2, activated, NOT a never-used engine.
    const timing = byType(facts, 'engineTiming').find((f) => f.sourceCard === CardName.AI_CENTRAL);
    expect(timing, 'engine-timing fact').to.not.be.undefined;
    expect(timing!.metrics.playedGeneration).to.eq(2);
    expect(timing!.metrics.activations).to.eq(5);
    expect(timing!.metrics.neverActivated).to.eq(0);
  });

  it('negative interaction → an attack fact per victim, with what they lost', () => {
    const facts = byType(factsOf(negativeInteractionStream()), 'negativeInteraction');
    const vsBlue = facts.find((f) => f.player === 'red' && f.targetPlayer === 'blue');
    const vsGreen = facts.find((f) => f.player === 'red' && f.targetPlayer === 'green');
    expect(vsBlue, 'red attacked blue').to.not.be.undefined;
    expect(vsBlue!.metrics.totalLost, '2 plants × 2 gens').to.eq(4);
    expect(vsBlue!.metrics.plants).to.eq(4);
    expect(vsBlue!.metrics.hits).to.eq(2);
    expect(vsGreen, 'red stole from green').to.not.be.undefined;
    expect(vsGreen!.metrics.megacredits).to.eq(4);
  });

  it('global-parameter pusher → per-parameter steps + the top source', () => {
    const facts = byType(factsOf(globalParameterStream()), 'globalParameter');
    expect(facts).to.have.length(1);
    expect(facts[0].player).to.eq('blue');
    expect(facts[0].metrics.oxygen).to.eq(3); // 2 (gen2 play) + 1 (gen4 action)
    expect(facts[0].metrics.temperature).to.eq(1);
    expect(facts[0].metrics.totalSteps).to.eq(4);
    expect(facts[0].sourceCard, 'AI Central moved the most steps').to.eq(CardName.AI_CENTRAL);
  });

  it('engine built but never activated → an engineTiming fact flagged neverActivated', () => {
    const facts = byType(factsOf(unusedEngineStream(), {cardHasAction: (c: CardName) => c === CardName.AI_CENTRAL}), 'engineTiming');
    const unused = facts.find((f) => f.sourceCard === CardName.AI_CENTRAL && f.player === 'green');
    expect(unused, 'unused engine fact').to.not.be.undefined;
    expect(unused!.metrics.neverActivated).to.eq(1);
    expect(unused!.metrics.activations).to.eq(0);
    expect(unused!.metrics.playedGeneration).to.eq(2);
    expect(unused!.metrics.availableGenerations).to.eq(7); // played gen 2, final gen 8
    expect(unused!.severity, 'an unused engine is notable').to.be.greaterThan(0);
  });

  it('notable-event facts surface the single biggest discount / draw / attack', () => {
    const facts = byType(factsOf(blueActionEngineStream()), 'notableEvent');
    const biggestDraw = facts.find((f) => f.id === 'notable:biggestDraw');
    expect(biggestDraw, 'biggest draw notable').to.not.be.undefined;
    expect(biggestDraw!.metrics.cardsDrawn).to.eq(2);
  });

  it('facts are deterministic — same stream yields identical fact ids', () => {
    const a = factsOf(economyEngineStream()).map((f) => f.id).sort();
    const b = factsOf(economyEngineStream()).map((f) => f.id).sort();
    expect(a).to.deep.eq(b);
  });

  // ── Iteration 4: reveal / search + notable extensions + transfer ──

  it('reveal/search → a reveal fact with revealed count + search hits', () => {
    const reveal = byType(factsOf(revealSearchStream()), 'reveal');
    expect(reveal).to.have.length(1);
    expect(reveal[0].player).to.eq('red');
    expect(reveal[0].metrics.revealed, '4 deck reveals').to.eq(4);
    expect(reveal[0].metrics.searchHits, 'hits on gens 4 and 6').to.eq(2);
  });

  it('shown hand → a reveal fact with the shown count', () => {
    const reveal = byType(factsOf(shownHandStream()), 'reveal');
    expect(reveal).to.have.length(1);
    expect(reveal[0].metrics.shown).to.eq(5);
    expect(reveal[0].metrics.revealed).to.eq(0);
  });

  it('notable: the biggest reveal is surfaced', () => {
    const notable = byType(factsOf(shownHandStream()), 'notableEvent');
    const biggestReveal = notable.find((f) => f.id === 'notable:biggestReveal');
    expect(biggestReveal, 'biggest reveal notable').to.not.be.undefined;
    expect(biggestReveal!.metrics.revealed).to.eq(5);
  });

  it('notable: a late-game economy burst pins to its generation', () => {
    const burst = byType(factsOf(lateEconomyBurstStream()), 'notableEvent').find((f) => f.id === 'notable:economyBurst');
    expect(burst, 'economy burst notable').to.not.be.undefined;
    expect(burst!.generation, 'the big burst was gen 11').to.eq(11);
    expect(burst!.metrics.savedMegacredits).to.eq(16);
  });

  it('production transfer → a negative-interaction fact with the production lost', () => {
    const neg = byType(factsOf(productionTransferStream()), 'negativeInteraction');
    const vsBlue = neg.find((f) => f.player === 'red' && f.targetPlayer === 'blue');
    expect(vsBlue, 'red reduced blue\'s production').to.not.be.undefined;
    expect(vsBlue!.metrics.energy).to.eq(2);
  });

  it('mixed winner → economy + actionUsage + globalParameter facts all present', () => {
    const facts = factsOf(mixedWinnerStream(), {cardHasAction: (c: CardName) => c === CardName.AI_CENTRAL});
    expect(byType(facts, 'economy').length, 'economy').to.be.greaterThan(0);
    expect(byType(facts, 'actionUsage').length, 'action usage').to.be.greaterThan(0);
    expect(byType(facts, 'globalParameter').length, 'global parameter').to.be.greaterThan(0);
  });
});
