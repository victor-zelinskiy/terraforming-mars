import {expect} from 'chai';
import {cast} from '@/common/utils/utils';
import {Decomposers} from '../../../src/server/cards/base/Decomposers';
import {ImportedHydrogen} from '../../../src/server/cards/base/ImportedHydrogen';
import {Pets} from '../../../src/server/cards/base/Pets';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';

describe('ImportedHydrogen', () => {
  let card: ImportedHydrogen;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new ImportedHydrogen();
    [game, player] = testGame(2);
  });

  it('Offers all three branches when microbe and animal targets exist', () => {
    const pets = new Pets();
    const tardigrades = new Tardigrades();
    const decomposers = new Decomposers();
    player.playedCards.push(pets, tardigrades, decomposers);

    // The choice is now DEFERRED ahead of the ocean (so the play modal can pre-collect
    // it); play() returns nothing, the OrOptions surfaces from the deferred queue.
    card.play(player);
    runAllActions(game);
    const action = cast(player.popWaitingFor(), OrOptions);
    expect(action.options).has.lengthOf(3); // gain plants / add microbes / add animals

    // Gain 3 plants.
    action.options[0].cb();
    expect(player.plants).to.eq(3);
  });

  it('Adding microbes always asks which card (no autoselect), even past one candidate', () => {
    const tardigrades = new Tardigrades();
    const decomposers = new Decomposers();
    player.playedCards.push(tardigrades, decomposers);

    card.play(player);
    runAllActions(game);
    const action = cast(player.popWaitingFor(), OrOptions);
    expect(action.options).has.lengthOf(2); // plants + microbes (no animal card)

    action.options[1].cb(); // add microbes → defers the target picker
    runAllActions(game);
    const selectMicrobe = cast(player.popWaitingFor(), SelectCard);
    expect(selectMicrobe.cards).has.lengthOf(2);
    selectMicrobe.cb([tardigrades]);
    runAllActions(game);
    expect(tardigrades.resourceCount).to.eq(3);
  });

  it('Adding animals asks which card and adds 2', () => {
    const pets = new Pets();
    player.playedCards.push(pets);

    card.play(player);
    runAllActions(game);
    const action = cast(player.popWaitingFor(), OrOptions);
    expect(action.options).has.lengthOf(2); // plants + animals (no microbe card)

    action.options[1].cb(); // add animals → defers the target picker (even single candidate)
    runAllActions(game);
    const selectAnimal = cast(player.popWaitingFor(), SelectCard);
    expect(selectAnimal.cards).has.lengthOf(1);
    selectAnimal.cb([pets]);
    runAllActions(game);
    expect(pets.resourceCount).to.eq(2);
  });

  it('Should add plants directly if no microbe or animal cards available', () => {
    expect(player.plants).to.eq(0);
    card.play(player);
    expect(player.plants).to.eq(3);
    // No choice surfaces — only the ocean placement remains queued.
    expect(player.getWaitingFor()).is.undefined;
  });
});
