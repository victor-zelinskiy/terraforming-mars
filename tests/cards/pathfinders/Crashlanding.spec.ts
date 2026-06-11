import {expect} from 'chai';
import {Crashlanding} from '../../../src/server/cards/pathfinders/Crashlanding';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {CardName} from '../../../src/common/cards/CardName';
import {addCity, fakeCard, runAllActions} from '../../TestingUtils';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {CardResource} from '../../../src/common/CardResource';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {addGreenery} from '../../TestingUtils';
import {SpaceId} from '../../../src/common/Types';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {TileType} from '../../../src/common/TileType';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {Units} from '../../../src/common/Units';
import {EmptyBoard} from '../../testing/EmptyBoard';
import {cast} from '../../../src/common/utils/utils';

/*
 * Partial map of Tharsis used in this test.
 *
 *  26 27 O
 * O 35 36 37
 *  O  O  O
 */

describe('Crashlanding', () => {
  let card: Crashlanding;
  let player: TestPlayer;
  let game: IGame;
  let dataCard: IProjectCard;
  let microbeCard: IProjectCard;
  let animalCard: IProjectCard;

  beforeEach(() => {
    card = new Crashlanding();
    [game, player] = testGame(2, {pathfindersExpansion: true, aresExtension: true, aresHazards: false});
    player.megaCredits = card.cost;
    dataCard = fakeCard({name: 'A' as CardName, resourceType: CardResource.DATA});
    microbeCard = fakeCard({name: 'B' as CardName, resourceType: CardResource.MICROBE});
    animalCard = fakeCard({name: 'C' as CardName, resourceType: CardResource.ANIMAL});
  });

  // Crashlanding's data/resource gains and its adjacency data bonus all flow through
  // deferred AddResourcesToCard, which now ALWAYS asks where the resource goes (even
  // with a single candidate). runAllActions surfaces ONE pick at a time, so drain
  // every pending pick onto `target`.
  function drainPicks(target: IProjectCard) {
    for (;;) {
      runAllActions(game);
      const wf = player.popWaitingFor();
      if (wf === undefined) {
        break;
      }
      cast(wf, SelectCard).cb([target]);
    }
  }

  it('canPlay', () => {
    const ids: Array<SpaceId> = ['26', '27', '35', '36', '37'];
    for (const space of game.board.getAvailableSpacesOnLand(player)) {
      if (!ids.includes(space.id)) {
        addGreenery(player, space.id);
      }
    }
    expect(card.canPlay(player, {cost: 0})).is.true;
    addCity(player, '35');
    expect(card.canPlay(player, {cost: 0})).is.true;
    addCity(player, '37');
    expect(card.canPlay(player, {cost: 0})).is.true;
    addGreenery(player, '26');
    expect(card.canPlay(player, {cost: 0})).is.true;
    addGreenery(player, '27');
    expect(card.canPlay(player, {cost: 0})).is.false;
  });

  it('play - cannot play next to 2 cities', () => {
    const spaceBetweenTwoCities = game.board.getSpaceOrThrow('36');
    addCity(player, '37'),
    expect(cast(card.play(player), SelectSpace).spaces).to.include(spaceBetweenTwoCities);
    addCity(player, '35');
    expect(cast(card.play(player), SelectSpace).spaces).to.not.include(spaceBetweenTwoCities);
  });

  it('play, place tile', () => {
    const selectSpace = cast(card.play(player), SelectSpace);
    const space = selectSpace.spaces[0];
    const orOptions = cast(selectSpace.cb(space), OrOptions);
    expect(space.tile?.tileType).eq(TileType.CRASHLANDING);
    expect(space.tile?.rotated).is.undefined;
    orOptions.options[1].cb();
    expect(space.tile?.rotated).eq(true);
    orOptions.options[0].cb();
    expect(space.tile?.rotated).is.undefined;
  });

  it('adjacency bonuses', () => {
    game.board = EmptyBoard.newInstance(); // Avoids other adjacency bonuses
    player.playedCards.push(dataCard);
    const space = game.board.getSpaceOrThrow('36');
    const selectSpace = cast(card.play(player), SelectSpace);
    const orOptions = cast(selectSpace.cb(space), OrOptions);
    orOptions.options[0].cb();
    // The behavior's "add 1 data / add 1 resource to a card" now ALWAYS asks where
    // (single candidate = dataCard); drain both picks.
    drainPicks(dataCard);

    player.megaCredits = 0;
    expect(dataCard.resourceCount).eq(2);
    addGreenery(player, '35');
    expect(player.stock.asUnits()).deep.eq(Units.of({megacredits: 1, titanium: 1, steel: 0}));
    // The adjacency 1-data bonus also asks where (single candidate).
    drainPicks(dataCard);
    expect(dataCard.resourceCount).eq(3);

    addGreenery(player, '37');
    expect(player.stock.asUnits()).deep.eq(Units.of({megacredits: 2, titanium: 1, steel: 1}));
    drainPicks(dataCard);
    expect(dataCard.resourceCount).eq(4);
  });

  it('adjacency bonuses, rotated', () => {
    game.board = EmptyBoard.newInstance(); // Avoids other adjacency bonuses
    player.playedCards.push(dataCard);
    const space = game.board.getSpaceOrThrow('36');
    const selectSpace = cast(card.play(player), SelectSpace);
    const orOptions = cast(selectSpace.cb(space), OrOptions);
    orOptions.options[1].cb();
    // The behavior's "add 1 data / add 1 resource to a card" now ALWAYS asks where.
    drainPicks(dataCard);

    player.megaCredits = 0;
    expect(dataCard.resourceCount).eq(2);
    addGreenery(player, '35');
    expect(player.stock.asUnits()).deep.eq(Units.of({megacredits: 1, titanium: 0, steel: 1}));
    drainPicks(dataCard);
    expect(dataCard.resourceCount).eq(3);

    addGreenery(player, '37');
    expect(player.stock.asUnits()).deep.eq(Units.of({megacredits: 2, titanium: 1, steel: 1}));
    drainPicks(dataCard);
    expect(dataCard.resourceCount).eq(4);
  });

  it('adjacency bonuses when Crashlanding is placed', () => {
    game.board = EmptyBoard.newInstance(); // Avoids other adjacency bonuses
    player.playedCards.push(dataCard);
    player.megaCredits = 0;

    addGreenery(player, '35');

    const space = game.board.getSpaceOrThrow('36');
    const selectSpace = cast(card.play(player), SelectSpace);
    const orOptions = cast(selectSpace.cb(space), OrOptions);
    orOptions.options[1].cb();
    // The placement adjacency 1-data bonus + the behavior's 2 card-resources all now
    // ask where (single candidate = dataCard); drain every pick.
    drainPicks(dataCard);

    expect(dataCard.resourceCount).eq(3);
    expect(player.stock.asUnits()).deep.eq(Units.of({megacredits: 0, titanium: 0, steel: 1}));
  });

  it('play - resources', () => {
    player.playedCards.push(dataCard, animalCard, microbeCard);

    card.play(player);
    runAllActions(game);
    // DATA target — single candidate (dataCard) now asks before the any-resource pick.
    cast(player.popWaitingFor(), SelectCard).cb([dataCard]);
    expect(dataCard.resourceCount).eq(1);
    // The 2nd gain (any resource) surfaces on the next runAllActions.
    runAllActions(game);
    const selectCard = cast(player.popWaitingFor(), SelectCard);
    expect(selectCard.cards).to.have.members([dataCard, animalCard, microbeCard]);
    selectCard.cb([animalCard]);
    expect(animalCard.resourceCount).eq(1);
  });
});
