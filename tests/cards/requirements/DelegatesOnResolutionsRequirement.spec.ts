import {expect} from 'chai';
import {Card} from '../../../src/server/cards/Card';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {CardRequirements} from '../../../src/server/cards/requirements/CardRequirements';
import {DelegatesOnResolutionsRequirement} from '../../../src/server/cards/requirements/DelegatesOnResolutionsRequirement';
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

/**
 * «REQUIRES N DELEGATES ON RESOLUTIONS» — the Turmoil Redux requirement kind
 * (TR02 Political Science prints it first), pinned END TO END: the descriptor
 * → type → compiled class → the political facade → the rule line the info
 * panel prints → the unplayable reason with its honest count. The count is
 * the player's OWN delegates on the resolutions of the VOTING AREA and
 * nothing else — the lobby, the chairman's seat and the reserve never count;
 * outside the Mars Parliament the answer is 0 (unmeetable, never a crash).
 */
class ThreeDelegatesCard extends Card implements IProjectCard {
  constructor(descriptor: CardRequirementDescriptor = {delegatesOnResolutions: 3}) {
    // `Card` caches its static properties PER NAME: a second card of one name reuses the first's descriptor, so the name carries the descriptor.
    super({name: `Delegates on resolutions test ${JSON.stringify(descriptor)}` as CardName, type: CardType.AUTOMATED, cost: 3, requirements: descriptor, metadata: {cardNumber: 'X00'}});
  }
}

function reduxTable(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

describe('DelegatesOnResolutionsRequirement', () => {
  describe('the descriptor → the type → the compiled requirement', () => {
    it('`{delegatesOnResolutions: N}` is its own requirement type and compiles to its own class with N as the count', () => {
      expect(requirementType({delegatesOnResolutions: 3})).eq(RequirementType.DELEGATES_ON_RESOLUTIONS);
      const compiled = CardRequirements.compile([{delegatesOnResolutions: 3}]).requirements[0];
      expect(compiled).is.instanceOf(DelegatesOnResolutionsRequirement);
      expect(compiled.type).eq(RequirementType.DELEGATES_ON_RESOLUTIONS);
      expect(compiled.count).eq(3);
      // `Card.populateCount` mirrors the number into `count`, as for every other kind.
      expect(new ThreeDelegatesCard().requirements).deep.eq([{delegatesOnResolutions: 3, count: 3}]);
    });
  });

  describe('on the Redux table — the voting area and nothing else', () => {
    let game: IGame;
    let p1: TestPlayer;
    let parliament: Parliament;
    let card: ThreeDelegatesCard;

    beforeEach(() => {
      [game, p1, , parliament] = reduxTable();
      card = new ThreeDelegatesCard();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
    });

    it('counts the own delegates on the three resolutions of the voting area, across slots', () => {
      expect(game.politics?.delegatesOnResolutions(p1)).eq(0);
      expect(p1.canPlay(card)).is.false;
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      parliament.placeVote(p1, parliament.slots[1], 'reserve');
      expect(game.politics?.delegatesOnResolutions(p1)).eq(2);
      expect(p1.canPlay(card)).is.false;
      parliament.placeVote(p1, parliament.slots[2], 'reserve');
      expect(game.politics?.delegatesOnResolutions(p1)).eq(3);
      expect(p1.canPlay(card)).is.true;
      expect(unplayableReasons(p1, card)).deep.eq([]);
    });

    it('the unmet requirement names itself as a COUNT with the honest «now» and restates the whole printed rule', () => {
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      const reasons = unplayableReasons(p1, card);
      expect(reasons).has.lengthOf(1);
      expect(reasons[0]).deep.include({type: 'count', message: 'Requires ${0} delegate(s) on resolutions', params: ['3'], current: 2, requirement: true});
      // FULLY_RESTATED: the surface showing the reason may hide the rule line it restates.
      expect(reasons[0].requirementKey).eq(`req:${RequirementType.DELEGATES_ON_RESOLUTIONS}`);
    });

    it('a delegate in the LOBBY, in the CHAIRMAN\'S SEAT or in the RESERVE is not «on a resolution»', () => {
      // Two on resolutions from the reserve; the free delegate stays in the lobby; the seat is p1's.
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.placeVote(p1, parliament.slots[1], 'reserve');
      parliament.chairman = p1.id;
      expect(parliament.lobby.has(p1.id), 'the lobby delegate is still there').is.true;
      expect(parliament.reserve(p1), 'the reserve holds the rest').is.greaterThan(0);
      expect(game.politics?.delegatesOnResolutions(p1)).eq(2);
      expect(p1.canPlay(card)).is.false;
      expect(unplayableReasons(p1, card)[0]).deep.include({current: 2});
    });

    it('another seat\'s delegates never count for you', () => {
      const [, , p2, parl] = [game, p1, game.players[1], parliament];
      parl.placeVote(p2, parl.slots[0], 'lobby');
      parl.placeVote(p2, parl.slots[0], 'reserve');
      parl.placeVote(p2, parl.slots[1], 'reserve');
      expect(game.politics?.delegatesOnResolutions(p2)).eq(3);
      expect(game.politics?.delegatesOnResolutions(p1)).eq(0);
      expect(p1.canPlay(card)).is.false;
    });
  });

  describe('outside the Mars Parliament', () => {
    it('classic Turmoil answers 0 — a delegate in a party is not a delegate on a resolution', () => {
      const [game, p1] = testGame(2, {turmoilExtension: true});
      const turmoil = Turmoil.getTurmoil(game);
      turmoil.sendDelegateToParty(p1, PartyName.GREENS, game);
      turmoil.sendDelegateToParty(p1, PartyName.GREENS, game);
      turmoil.sendDelegateToParty(p1, PartyName.GREENS, game);
      expect(game.politics?.engine).eq('classic');
      expect(game.politics?.delegatesOnResolutions(p1)).eq(0);
      const card = new ThreeDelegatesCard();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
      expect(p1.canPlay(card)).is.false;
      expect(unplayableReasons(p1, card)[0]).deep.include({type: 'count', current: 0, requirement: true});
    });

    it('a game with no political engine at all answers 0 without throwing', () => {
      const [game, p1] = testGame(2);
      expect(game.politics).is.undefined;
      const card = new ThreeDelegatesCard();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
      expect(() => p1.canPlay(card)).to.not.throw();
      expect(p1.canPlay(card)).is.false;
      expect(unplayableReasons(p1, card)[0]).deep.include({current: 0});
    });
  });

  describe('the rule line of the info panel', () => {
    function requirementLine(descriptor: CardRequirementDescriptor): string | undefined {
      const info = buildCardInformation(new ThreeDelegatesCard(descriptor), 'turmoilRedux');
      return info?.groups.find((g) => g.kind === 'requirements')?.blocks[0]?.text;
    }

    it('names the player\'s own delegates and the Voting Area, plural and singular, min and max', () => {
      expect(requirementLine({delegatesOnResolutions: 3})).eq('Requires 3 delegates of yours on resolutions in the Voting Area.');
      expect(requirementLine({delegatesOnResolutions: 1})).eq('Requires 1 delegate of yours on resolutions in the Voting Area.');
      expect(requirementLine({delegatesOnResolutions: 2, max: true})).eq('Requires at most 2 delegates of yours on resolutions in the Voting Area.');
    });

    it('the block is linked to the requirement graphic of its own type', () => {
      const info = buildCardInformation(new ThreeDelegatesCard(), 'turmoilRedux');
      const block = info?.groups.find((g) => g.kind === 'requirements')?.blocks[0];
      expect(block?.id).eq(`req:${RequirementType.DELEGATES_ON_RESOLUTIONS}`);
      expect(block?.graphicId).eq(`req:${RequirementType.DELEGATES_ON_RESOLUTIONS}`);
    });
  });
});
