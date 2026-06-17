import {expect} from 'chai';
import {buildEndgameFacts, BuildFactsOptions, EndgameFact} from '@/common/events/endgameFacts';
import {EventSource} from '@/common/events/EventSource';
import {GameEvent} from '@/common/events/GameEvent';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {FactStream} from './endgameFactFixtures';

/**
 * Iteration 13 — the corporation fact builder (corporationFacts inside buildEndgameFacts).
 * Built purely from the event stream: a corporation's PASSIVE rule, its ACTION, the
 * owner's early-game tempo, and graceful degradation. Tested through the public
 * buildEndgameFacts so the integration (registration + filtering) is covered too.
 */

const corp = (c: CardName, owner: Color): EventSource => ({kind: 'corporation', card: c, owner});
const proj = (c: CardName, owner: Color): EventSource => ({kind: 'card', card: c, owner});

function corpFacts(events: ReadonlyArray<GameEvent>, opts: BuildFactsOptions = {}): Array<EndgameFact> {
  return buildEndgameFacts(events, opts).filter((f) => f.type === 'corporationImpact');
}

describe('corporation facts (Iteration 13)', () => {
  it('passive corporation engine → a fact with passive metrics, no action', () => {
    const s = new FactStream();
    const play = s.root({gen: 1, player: 'red', source: corp(CardName.SATURN_SYSTEMS, 'red'), category: 'card-play'});
    for (let gen = 2; gen <= 6; gen++) {
      s.child({corr: play, gen, player: 'red', source: corp(CardName.SATURN_SYSTEMS, 'red'),
        type: 'effect-triggered', impact: {production: {megacredits: 1}}, tags: ['passive-effect']});
    }
    const facts = corpFacts(s.events, {cardHasAction: () => false});
    expect(facts).to.have.length(1);
    const f = facts[0];
    expect(f.player).to.eq('red');
    expect(f.sourceCard).to.eq(CardName.SATURN_SYSTEMS);
    expect(f.metrics.passiveTriggers).to.eq(5);
    expect(f.metrics.passiveProduction).to.eq(5);
    expect(f.metrics.actionActivations).to.eq(0);
    expect(f.metrics.hasAction).to.eq(0);
    expect(f.metrics.totalMeasuredValue).to.be.greaterThan(0);
  });

  it('corporate action → a fact with action metrics + hasAction flag', () => {
    const s = new FactStream();
    s.root({gen: 1, player: 'blue', source: corp(CardName.VIRON, 'blue'), category: 'card-play'});
    for (let gen = 3; gen <= 7; gen++) {
      const a = s.root({gen, player: 'blue', source: corp(CardName.VIRON, 'blue'), category: 'corporation-action'});
      s.child({corr: a, gen, player: 'blue', source: corp(CardName.VIRON, 'blue'), type: 'cards-drawn', impact: {cardsDrawn: 2}});
    }
    const f = corpFacts(s.events, {cardHasAction: (c: CardName) => c === CardName.VIRON})[0];
    expect(f).to.not.be.undefined;
    expect(f.metrics.actionActivations).to.eq(5);
    expect(f.metrics.actionCardsDrawn).to.eq(10);
    expect(f.metrics.hasAction).to.eq(1);
  });

  it('early-game economy contextualises a capital corp (earlyValue, gens 1–3 only)', () => {
    const s = new FactStream();
    s.root({gen: 1, player: 'red', source: corp(CardName.CREDICOR, 'red'), category: 'card-play'});
    const r2 = s.root({gen: 2, player: 'red', source: proj(CardName.EARTH_CATAPULT, 'red'), category: 'card-play'});
    s.child({corr: r2, gen: 2, player: 'red', source: proj(CardName.EARTH_CATAPULT, 'red'),
      type: 'discount-applied', impact: {megacreditsSaved: 8}, tags: ['discount', 'passive-effect']});
    // A late discount (gen 9) must NOT count toward early tempo.
    const r9 = s.root({gen: 9, player: 'red', source: proj(CardName.EARTH_CATAPULT, 'red'), category: 'card-play'});
    s.child({corr: r9, gen: 9, player: 'red', source: proj(CardName.EARTH_CATAPULT, 'red'),
      type: 'discount-applied', impact: {megacreditsSaved: 20}, tags: ['discount', 'passive-effect']});
    const f = corpFacts(s.events, {}).find((x) => x.sourceCard === CardName.CREDICOR);
    expect(f).to.not.be.undefined;
    expect(f!.metrics.earlyValue).to.eq(8);
  });

  it('a corporation played but inert still yields a fact (for underused detection)', () => {
    const s = new FactStream();
    s.root({gen: 1, player: 'red', source: corp(CardName.UNITED_NATIONS_MARS_INITIATIVE, 'red'), category: 'card-play'});
    const f = corpFacts(s.events, {cardHasAction: () => true})[0];
    expect(f).to.not.be.undefined;
    expect(f.metrics.totalMeasuredValue).to.eq(0);
    expect(f.metrics.hasAction).to.eq(1);
  });

  it('no corporation events → no corporationImpact facts (graceful)', () => {
    expect(buildEndgameFacts([], {}).filter((f) => f.type === 'corporationImpact')).to.have.length(0);
  });

  it('two players, two corporations → one fact each, attributed correctly', () => {
    const s = new FactStream();
    s.root({gen: 1, player: 'red', source: corp(CardName.SATURN_SYSTEMS, 'red'), category: 'card-play'});
    s.root({gen: 1, player: 'blue', source: corp(CardName.POSEIDON, 'blue'), category: 'card-play'});
    const facts = corpFacts(s.events, {});
    expect(facts).to.have.length(2);
    expect(facts.find((f) => f.player === 'red')!.sourceCard).to.eq(CardName.SATURN_SYSTEMS);
    expect(facts.find((f) => f.player === 'blue')!.sourceCard).to.eq(CardName.POSEIDON);
  });
});
