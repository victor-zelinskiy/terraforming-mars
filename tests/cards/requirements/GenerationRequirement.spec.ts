import {expect} from 'chai';
import {Card} from '../../../src/server/cards/Card';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {CardRequirements} from '../../../src/server/cards/requirements/CardRequirements';
import {GenerationRequirement} from '../../../src/server/cards/requirements/GenerationRequirement';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Phase} from '../../../src/common/Phase';
import {RequirementType} from '../../../src/common/cards/RequirementType';
import {CardRequirementDescriptor, requirementType} from '../../../src/common/cards/CardRequirementDescriptor';

/**
 * «THIS CAN ONLY BE PLAYED DURING GENERATION N OR LATER» — the Turmoil Redux
 * requirement kind (TR10 Fringe Colony prints «GEN 4+» first), pinned END TO
 * END: the descriptor → type → compiled class → the game's clock → the rule
 * line the info panel prints → the unplayable reason with its honest «now».
 * The score is `game.generation` — the table's, the same for every seat.
 */
class GenerationCard extends Card implements IProjectCard {
  constructor(descriptor: CardRequirementDescriptor = {generation: 4}) {
    // `Card` caches its static properties PER NAME: the name carries the descriptor.
    super({name: `Generation test ${JSON.stringify(descriptor)}` as CardName, type: CardType.EVENT, cost: 3, requirements: descriptor, metadata: {cardNumber: 'X00'}});
  }
}

describe('GenerationRequirement', () => {
  describe('the descriptor → the type → the compiled requirement', () => {
    it('`{generation: N}` is its own requirement type and compiles to its own class with N as the count', () => {
      expect(requirementType({generation: 4})).eq(RequirementType.GENERATION);
      const compiled = CardRequirements.compile([{generation: 4}]).requirements[0];
      expect(compiled).is.instanceOf(GenerationRequirement);
      expect(compiled.type).eq(RequirementType.GENERATION);
      expect(compiled.count).eq(4);
      expect(compiled.max).is.false;
      // `Card.populateCount` mirrors the number into `count`, as for every other kind.
      expect(new GenerationCard().requirements).deep.eq([{generation: 4, count: 4}]);
    });
  });

  describe('against the game\'s clock', () => {
    let game: IGame;
    let p1: TestPlayer;
    let p2: TestPlayer;
    let card: GenerationCard;

    beforeEach(() => {
      [game, p1, p2] = testGame(2);
      game.phase = Phase.ACTION;
      card = new GenerationCard();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
    });

    it('«generation 4 or later»: closed in generations 1–3 with the honest «now», open from the 4th', () => {
      for (const generation of [1, 2, 3]) {
        game.generation = generation;
        expect(p1.canPlay(card), `generation ${generation}`).is.false;
        const reasons = unplayableReasons(p1, card);
        expect(reasons).has.lengthOf(1);
        expect(reasons[0]).deep.include({type: 'count', message: 'Requires generation ${0} or later', params: ['4'], current: generation, requirement: true});
        // FULLY_RESTATED: the surface showing the reason may hide the rule line it restates.
        expect(reasons[0].requirementKey).eq(`req:${RequirementType.GENERATION}`);
      }
      for (const generation of [4, 5, 12]) {
        game.generation = generation;
        expect(p1.canPlay(card), `generation ${generation}`).is.true;
        expect(unplayableReasons(p1, card)).deep.eq([]);
      }
    });

    it('the clock is the TABLE\'s — the same answer for every seat', () => {
      const other = new GenerationCard();
      p2.cardsInHand.push(other);
      p2.megaCredits = 20;
      game.generation = 3;
      expect(p1.canPlay(card)).is.false;
      expect(p2.canPlay(other)).is.false;
      game.generation = 4;
      expect(p1.canPlay(card)).is.true;
      expect(p2.canPlay(other)).is.true;
    });

    it('the CEILING form («generation N or earlier») is the same comparison turned around', () => {
      const ceiling = new GenerationCard({generation: 2, max: true});
      p1.cardsInHand.push(ceiling);
      game.generation = 2;
      expect(p1.canPlay(ceiling)).is.true;
      game.generation = 3;
      expect(p1.canPlay(ceiling)).is.false;
      expect(unplayableReasons(p1, ceiling)[0]).deep.include({type: 'count', message: 'Requires generation ${0} or less', params: ['2'], current: 3, requirement: true});
    });
  });

  describe('the rule line of the info panel', () => {
    function requirementLine(descriptor: CardRequirementDescriptor): string | undefined {
      const info = buildCardInformation(new GenerationCard(descriptor), 'turmoilRedux');
      return info?.groups.find((g) => g.kind === 'requirements')?.blocks[0]?.text;
    }

    it('reads the scan\'s own words for the floor, and «at most» for the ceiling', () => {
      expect(requirementLine({generation: 4})).eq('Can only be played during generation 4 or later.');
      expect(requirementLine({generation: 2, max: true})).eq('Can only be played while the generation is at most 2.');
    });

    it('the block is linked to the requirement graphic of its own type', () => {
      const info = buildCardInformation(new GenerationCard(), 'turmoilRedux');
      const block = info?.groups.find((g) => g.kind === 'requirements')?.blocks[0];
      expect(block?.id).eq(`req:${RequirementType.GENERATION}`);
      expect(block?.graphicId).eq(`req:${RequirementType.GENERATION}`);
    });
  });
});
