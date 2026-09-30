import {expect} from 'chai';
import {Card} from '../../../src/server/cards/Card';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {CardRequirements} from '../../../src/server/cards/requirements/CardRequirements';
import {InfluenceRequirement} from '../../../src/server/cards/requirements/InfluenceRequirement';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Phase} from '../../../src/common/Phase';
import {RequirementType} from '../../../src/common/cards/RequirementType';
import {CardRequirementDescriptor, requirementType} from '../../../src/common/cards/CardRequirementDescriptor';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Turmoil} from '../../../src/server/turmoil/Turmoil';
import {fakeCard} from '../../TestingUtils';

/**
 * «REQUIRES (NO MORE THAN) N INFLUENCE» — the Turmoil Redux requirement kind
 * (TR04 Minority Representation prints «max 1» first), pinned END TO END: the
 * descriptor → type → compiled class → the political facade → the rule line
 * the info panel prints → the unplayable reason with its honest count and the
 * «or less» marker the compact hand counter draws «≤» from. The score is the
 * player's WHOLE influence — the track's level, every bonus, the tableau's
 * hooks — never the marker's position.
 */
class InfluenceCard extends Card implements IProjectCard {
  constructor(descriptor: CardRequirementDescriptor = {influence: 1, max: true}) {
    // `Card` caches its static properties PER NAME: the name carries the descriptor.
    super({name: `Influence test ${JSON.stringify(descriptor)}` as CardName, type: CardType.EVENT, cost: 3, requirements: descriptor, metadata: {cardNumber: 'X00'}});
  }
}

function reduxTable(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

describe('InfluenceRequirement', () => {
  describe('the descriptor → the type → the compiled requirement', () => {
    it('`{influence: N, max}` is its own requirement type and compiles to its own class with N as the count and the ceiling kept', () => {
      expect(requirementType({influence: 1, max: true})).eq(RequirementType.INFLUENCE);
      const compiled = CardRequirements.compile([{influence: 1, max: true}]).requirements[0];
      expect(compiled).is.instanceOf(InfluenceRequirement);
      expect(compiled.type).eq(RequirementType.INFLUENCE);
      expect(compiled.count).eq(1);
      expect(compiled.max).is.true;
      // `Card.populateCount` mirrors the number into `count`, as for every other kind.
      expect(new InfluenceCard().requirements).deep.eq([{influence: 1, max: true, count: 1}]);
    });
  });

  describe('on the Redux table — the WHOLE influence, never the position', () => {
    let game: IGame;
    let p1: TestPlayer;
    let parliament: Parliament;
    let card: InfluenceCard;

    beforeEach(() => {
      [game, p1, , parliament] = reduxTable();
      card = new InfluenceCard();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
    });

    it('«max 1»: playable while the influence is 0 or 1 — positions 0, 1 and 2 of the track — and closed from position 3 (level 2)', () => {
      for (const position of [0, 1, 2]) {
        parliament.agenda.set(p1.id, position);
        expect(game.politics?.influence(p1), `position ${position}`).to.be.at.most(1);
        expect(p1.canPlay(card), `position ${position}`).is.true;
        expect(unplayableReasons(p1, card)).deep.eq([]);
      }
      parliament.agenda.set(p1.id, 3);
      expect(game.politics?.influence(p1)).eq(2);
      expect(p1.canPlay(card)).is.false;
      const reasons = unplayableReasons(p1, card);
      expect(reasons).has.lengthOf(1);
      expect(reasons[0]).deep.include({type: 'count', message: 'Requires influence ${0} or less', params: ['1'], current: 2, requirement: true});
      // FULLY_RESTATED: the surface showing the reason may hide the rule line it restates.
      expect(reasons[0].requirementKey).eq(`req:${RequirementType.INFLUENCE}`);
    });

    it('an influence BONUS counts (a card\'s grant, a colony\'s): the marker on step 1 with a +1 bonus is 2 — closed', () => {
      parliament.agenda.set(p1.id, 1);
      expect(p1.canPlay(card)).is.true;
      parliament.addInfluenceBonus(p1, 1, 'a test card');
      expect(game.politics?.influence(p1)).eq(2);
      expect(p1.canPlay(card)).is.false;
      expect(unplayableReasons(p1, card)[0]).deep.include({current: 2});
    });

    it('a tableau card\'s own `getInfluenceBonus` hook counts too', () => {
      parliament.agenda.set(p1.id, 2);
      p1.playedCards.push(fakeCard({name: 'Influence hook' as CardName, getInfluenceBonus: () => 1}));
      expect(game.politics?.influence(p1)).eq(2);
      expect(p1.canPlay(card)).is.false;
    });

    it('the FLOOR form («requires 2 influence») opens exactly at the level and names its count', () => {
      const floor = new InfluenceCard({influence: 2});
      p1.cardsInHand.push(floor);
      parliament.agenda.set(p1.id, 2);
      expect(p1.canPlay(floor)).is.false;
      expect(unplayableReasons(p1, floor)[0]).deep.include({type: 'count', message: 'Requires ${0} influence', params: ['2'], current: 1, requirement: true});
      parliament.agenda.set(p1.id, 3);
      expect(p1.canPlay(floor)).is.true;
    });

    it('another seat\'s influence is not yours', () => {
      const p2 = game.players[1];
      parliament.agenda.set(p2.id, 5);
      parliament.agenda.set(p1.id, 0);
      expect(game.politics?.influence(p2)).eq(3);
      expect(game.politics?.influence(p1)).eq(0);
      expect(p1.canPlay(card)).is.true;
    });
  });

  describe('outside the Mars Parliament', () => {
    it('classic Turmoil answers its own influence (the chairman, the party leaders, the bonuses)', () => {
      const [game, p1] = testGame(2, {turmoilExtension: true});
      const turmoil = Turmoil.getTurmoil(game);
      expect(game.politics?.engine).eq('classic');
      const card = new InfluenceCard();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
      turmoil.chairman = 'NEUTRAL';
      const base = turmoil.getInfluence(p1);
      expect(game.politics?.influence(p1)).eq(base);
      turmoil.addInfluenceBonus(p1, 2 - base + 0);
      expect(game.politics?.influence(p1)).eq(2);
      expect(p1.canPlay(card)).is.false;
      expect(unplayableReasons(p1, card)[0]).deep.include({type: 'count', current: 2, requirement: true});
      void PartyName;
    });

    it('a game with no political engine at all answers 0 without throwing — the ceiling is met, the floor is not', () => {
      const [game, p1] = testGame(2);
      expect(game.politics).is.undefined;
      const ceiling = new InfluenceCard();
      const floor = new InfluenceCard({influence: 1});
      p1.cardsInHand.push(ceiling, floor);
      p1.megaCredits = 20;
      expect(() => p1.canPlay(ceiling)).to.not.throw();
      expect(p1.canPlay(ceiling)).is.true;
      expect(p1.canPlay(floor)).is.false;
      expect(unplayableReasons(p1, floor)[0]).deep.include({current: 0});
    });
  });

  describe('the rule line of the info panel', () => {
    function requirementLine(descriptor: CardRequirementDescriptor): string | undefined {
      const info = buildCardInformation(new InfluenceCard(descriptor), 'turmoilRedux');
      return info?.groups.find((g) => g.kind === 'requirements')?.blocks[0]?.text;
    }

    it('reads the scan\'s own words for the ceiling, and «at least» for the floor', () => {
      expect(requirementLine({influence: 1, max: true})).eq('Requires that you have no more than 1 Influence.');
      expect(requirementLine({influence: 2})).eq('Requires that you have at least 2 Influence.');
    });

    it('the block is linked to the requirement graphic of its own type', () => {
      const info = buildCardInformation(new InfluenceCard(), 'turmoilRedux');
      const block = info?.groups.find((g) => g.kind === 'requirements')?.blocks[0];
      expect(block?.id).eq(`req:${RequirementType.INFLUENCE}`);
      expect(block?.graphicId).eq(`req:${RequirementType.INFLUENCE}`);
    });
  });
});
