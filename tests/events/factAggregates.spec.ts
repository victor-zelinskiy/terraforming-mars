import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  aggregateByPlayerGeneration,
  actionVictimBreakdown,
  aggregateAttacks,
  eventAttacker,
} from '@/common/events/aggregate';
import {sourceKey} from '@/common/events/EventSource';
import {economyEngineStream, negativeInteractionStream, blueActionEngineStream} from './endgameFactFixtures';

describe('analysis-ready aggregates (Iteration 3)', () => {
  describe('aggregateByPlayerGeneration — the timeline', () => {
    it('splits a player\'s stats per generation', () => {
      // economyEngineStream: red saves (2 discount + 3 titanium bonus) in gens 2..5.
      const timeline = aggregateByPlayerGeneration(economyEngineStream());
      const red = timeline.get('red');
      expect(red, 'red has a per-generation timeline').to.not.be.undefined;
      expect([...red!.keys()].sort()).to.deep.eq([2, 3, 4, 5]);
      // Each generation: 2 M€ discount + 12... no: discount 2 + payment bonus 3 = the
      // megacreditsSaved field folds discount(2) + nothing; paymentValueBonus is separate.
      expect(red!.get(2)!.megacreditsSaved).to.eq(2);
      expect(red!.get(2)!.paymentValueBonus.titanium).to.eq(3);
    });
  });

  describe('actionVictimBreakdown — per-action victims', () => {
    it('attributes opponents\' losses to the attacking action', () => {
      const bySource = actionVictimBreakdown(negativeInteractionStream(), 'red');
      const predators = bySource.get(sourceKey({kind: 'card', card: CardName.PREDATORS, owner: 'red'}));
      expect(predators, 'Predators action victims').to.not.be.undefined;
      expect(predators!).to.have.length(1);
      expect(predators![0].color).to.eq('blue');
      expect(predators![0].totalLost).to.eq(4); // 2 plants × 2 activations
      expect(predators![0].resources.plants).to.eq(4);
      expect(predators![0].hits).to.eq(2);
    });

    it('does not attribute a card-PLAY attack to the action breakdown', () => {
      // HiredRaiders is a card-PLAY (category card-play), not an action.
      const bySource = actionVictimBreakdown(negativeInteractionStream(), 'red');
      expect(bySource.get(sourceKey({kind: 'card', card: CardName.HIRED_RAIDERS, owner: 'red'}))).to.be.undefined;
    });
  });

  describe('aggregateAttacks — whole-game attack ledger (play + action)', () => {
    it('captures both the action destroy and the play steal', () => {
      const ledger = aggregateAttacks(negativeInteractionStream());
      const redVictims = ledger.get('red');
      expect(redVictims, 'red attacked someone').to.not.be.undefined;
      const blue = redVictims!.find((v) => v.color === 'blue');
      const green = redVictims!.find((v) => v.color === 'green');
      expect(blue!.resources.plants).to.eq(4); // from the Predators action
      expect(green!.resources.megacredits).to.eq(4); // from the HiredRaiders play steal
    });
  });

  describe('eventAttacker', () => {
    it('reads the recipient (steal) then the source owner (destroy)', () => {
      expect(eventAttacker({player: 'green', target: {player: 'red'}, impact: {}} as any)).to.eq('red');
      expect(eventAttacker({player: 'blue', source: {kind: 'card', card: CardName.PREDATORS, owner: 'red'}, impact: {}} as any)).to.eq('red');
      expect(eventAttacker({player: 'red', source: {kind: 'card', card: CardName.PREDATORS, owner: 'red'}, impact: {}} as any), 'own card → not an attack').to.be.undefined;
    });
  });

  describe('blue-action stream does not leak the play into action stats', () => {
    it('aggregateAttacks is empty for a non-attacking engine', () => {
      expect(aggregateAttacks(blueActionEngineStream()).size).to.eq(0);
    });
  });
});
