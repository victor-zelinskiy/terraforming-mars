import {expect} from 'chai';
import {IGame} from '../../../src/server/IGame';
import {forceGenerationEnd, runAllActions} from '../../TestingUtils';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {Maria} from '../../../src/server/cards/ceos/Maria';
import {Celestic} from '../../../src/server/cards/venusNext/Celestic';
import {IapetusII} from '../../../src/server/cards/pathfinders/IapetusII';
import {CollegiumCopernicus} from '../../../src/server/cards/pathfinders/CollegiumCopernicus';
import {Callisto} from '../../../src/server/colonies/Callisto';
import {Titan} from '../../../src/server/colonies/Titan';
import {cast, toName} from '../../../src/common/utils/utils';

describe('Maria', () => {
  let card: Maria;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new Maria();
    [game, player, player2] = testGame(2, {ceoExtension: true, coloniesExtension: true});
  });

  it('Can act', () => {
    expect(card.canAct(player)).is.true;
  });

  it('Takes action generation 1', () => {
    const coloniesInPlay = game.colonies.length;
    cast(card.action(player), undefined);
    runAllActions(player.game);
    const selectColony = cast(player.popWaitingFor(), SelectColony);
    const selectedColony = selectColony.colonies[0];
    selectColony.cb(selectedColony);
    expect(game.colonies).to.contain(selectedColony);
    expect(game.colonies).has.length(coloniesInPlay + 1);
  });

  it('Draws from discarded colonies without mutating their order', () => {
    game.discardedColonies = [new Titan(), new Callisto()];

    cast(card.action(player), undefined);
    runAllActions(player.game);

    const selectColony = cast(player.popWaitingFor(), SelectColony);
    const drawnColonyNames = selectColony.colonies.map(toName);
    expect(drawnColonyNames).has.length(1);
    expect(['Titan', 'Callisto']).contains(drawnColonyNames[0]);
    expect(game.discardedColonies.map(toName)).deep.eq(['Titan', 'Callisto']);
  });

  it('Takes action in Generation 4', () => {
    game.generation = 4;

    cast(card.action(player), undefined);
    runAllActions(player.game);
    const selectColony = cast(player.popWaitingFor(), SelectColony);
    expect(selectColony.colonies).has.length(4);
  });

  it('Takes action - chooses Titan which cannot be activated', () => {
    const titan = new Titan();
    game.discardedColonies = [];
    game.discardedColonies.push(titan);
    cast(card.action(player), undefined);
    runAllActions(player.game);
    const selectColony = cast(player.popWaitingFor(), SelectColony);
    selectColony?.cb(titan);

    expect(game.colonies).includes(titan);
    expect(titan.isActive).is.false;
    expect(titan.colonies).is.empty;
  });

  it('Takes action - chooses Titan, which is activated', () => {
    player2.playedCards.push(new Celestic());
    const titan = new Titan();
    game.discardedColonies = [];
    game.discardedColonies.push(titan);
    cast(card.action(player), undefined);
    runAllActions(player.game);
    const selectColony = cast(player.popWaitingFor(), SelectColony);
    selectColony?.cb(titan);

    expect(game.colonies).includes(titan);
    expect(titan.isActive).is.true;
    expect(titan.colonies).is.not.empty;
  });

  it('Takes action - chooses Ieptus II, which is not activated', () => {
    const iapetusii = new IapetusII();
    game.discardedColonies = [];
    game.discardedColonies.push(iapetusii);
    cast(card.action(player), undefined);
    runAllActions(player.game);
    const selectColony = cast(player.popWaitingFor(), SelectColony);
    selectColony?.cb(iapetusii);

    expect(game.colonies).includes(iapetusii);
    expect(iapetusii.isActive).is.false;
    expect(iapetusii.colonies).is.empty;
  });

  it('Takes action - chooses Ieptus II, which is activated', () => {
    player2.playedCards.push(new CollegiumCopernicus());
    const iapetusii = new IapetusII();
    game.discardedColonies = [];
    game.discardedColonies.push(iapetusii);
    cast(card.action(player), undefined);
    runAllActions(player.game);
    const selectColony = cast(player.popWaitingFor(), SelectColony);
    selectColony?.cb(iapetusii);

    expect(game.colonies).includes(iapetusii);
    expect(iapetusii.isActive).is.true;
    expect(iapetusii.colonies).is.not.empty;
  });

  it('Can only act once per game', () => {
    card.action(player);
    forceGenerationEnd(game);

    expect(card.isDisabled).is.true;
    expect(card.canAct(player)).is.false;
  });
});
