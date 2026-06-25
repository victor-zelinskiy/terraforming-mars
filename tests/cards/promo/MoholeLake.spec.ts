import {expect} from 'chai';
import {churn} from '../../TestingUtils';
import {Ants} from '../../../src/server/cards/base/Ants';
import {Fish} from '../../../src/server/cards/base/Fish';
import {ICard} from '../../../src/server/cards/ICard';
import {MoholeLake} from '../../../src/server/cards/promo/MoholeLake';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {cast} from '../../../src/common/utils/utils';

describe('MoholeLake', () => {
  let card: MoholeLake;
  let player: TestPlayer;

  beforeEach(() => {
    card = new MoholeLake();
    [/* game */, player] = testGame(2);
  });

  it('Can play', () => {
    card.play(player);

    expect(player.game.deferredActions).has.lengthOf(1);
    const selectSpace = cast(player.game.deferredActions.peek()!.execute(), SelectSpace);
    selectSpace.cb(selectSpace.spaces[0]);

    expect(player.game.getTemperature()).to.eq(-28);
    expect(player.game.board.getOceanSpaces()).has.length(1);
    expect(player.terraformRating).to.eq(22);
    expect(player.plants).to.eq(3);
  });

  it('Cannot act - no target (no empty action scope)', () => {
    // The whole action is "add a microbe/animal to another card" — with no card
    // able to hold one, the action is unavailable (it would otherwise do nothing
    // and open an empty journal scope) and explains why.
    expect(card.canAct(player)).is.false;
    expect(card.actionUnavailableReason()).to.deep.eq({type: 'target', message: 'No card to add the resource to'});
    // Defensive: even if invoked, the action resolves to nothing.
    expect(churn(card.action(player), player)).is.undefined;
  });

  it('No empty action scope: excluded from playable actions without a target, included with one', () => {
    player.playedCards.push(card);
    // No microbe/animal card → MoholeLake is NOT offered as a playable action, so
    // playActionCard never opens an (empty) "used Mohole Lake action" journal scope.
    expect(player.getPlayableActionCards()).does.not.include(card);

    // With a card that can hold the resource it becomes a real, playable action.
    player.playedCards.push(new Fish());
    expect(player.getPlayableActionCards()).does.include(card);
  });

  it('Can act - single target', () => {
    const fish = new Fish();
    player.playedCards.push(fish);

    card.play(player);
    expect(card.canAct(player)).is.true;
    // Always asks which card, even with a single target.
    const action = cast(card.action(player), SelectCard<ICard>);
    expect(action.cards).has.lengthOf(1);
    action.cb([fish]);
    expect(fish.resourceCount).to.eq(1);
  });

  it('Can act - multiple targets', () => {
    const fish = new Fish();
    const ants = new Ants();
    player.playedCards.push(fish, ants);

    card.play(player);
    expect(card.canAct(player)).is.true;
    const action = cast(card.action(player), SelectCard<ICard>);

    action.cb([ants]);
    expect(ants.resourceCount).to.eq(1);
  });
});
