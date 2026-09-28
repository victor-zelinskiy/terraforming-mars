import {expect} from 'chai';
import {IGame} from '../../../src/server/IGame';
import {runAllActions} from '../../TestingUtils';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {Prospecting} from '../../../src/server/cards/underworld/Prospecting';
import {Titan} from '../../../src/server/colonies/Titan';
import {Celestic} from '../../../src/server/cards/venusNext/Celestic';
import {cast} from '../../../src/common/utils/utils';

describe('Prospecting', () => {
  let card: Prospecting;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new Prospecting();
    [game, player/* , player2 */] = testGame(2, {coloniesExtension: true});
  });

  it('Can play', () => {
    player.megaCredits = 3;
    expect(card.canPlay(player)).is.false;
    player.megaCredits = 4;
    expect(card.canPlay(player)).is.true;
  });

  it('play', () => {
    player.megaCredits = 4;
    const coloniesInPlay = game.colonies.length;
    cast(card.play(player), undefined);
    runAllActions(player.game);
    const selectColony = cast(player.popWaitingFor(), SelectColony);
    const selectedColony = selectColony.colonies[0];
    selectColony.cb(selectedColony);
    runAllActions(game);

    expect(game.colonies).to.contain(selectedColony);
    expect(game.colonies).has.length(coloniesInPlay + 1);

    expect(player.megaCredits).eq(0);
  });

  it('Titan cannot be activated, so is not selectable', () => {
    const titan = new Titan();
    game.discardedColonies.push(titan);
    cast(card.play(player), undefined);
    runAllActions(player.game);
    const selectColony = cast(player.popWaitingFor(), SelectColony);
    expect(selectColony.colonies).to.not.contain(titan);
  });

  it('Titan can be activated, so is not selectable', () => {
    player.playedCards.push(new Celestic());
    const titan = new Titan();
    game.discardedColonies = [];
    game.discardedColonies.push(titan);
    cast(card.play(player), undefined);
    runAllActions(player.game);
    const selectColony = cast(player.popWaitingFor(), SelectColony);
    expect(selectColony.colonies).to.contain(titan);
  });
});
