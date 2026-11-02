import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {TileType} from '../../src/common/TileType';
import {boardCellInfo} from '../../src/server/boards/BoardInformationEngine';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {SelectPaymentDeferred} from '../../src/server/deferredActions/SelectPaymentDeferred';
import {cast} from '../../src/common/utils/utils';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions, setTemperature} from '../TestingUtils';

/**
 * VASTITAS BOREALIS, THE FAN MAP — the North Pole for a HUMAN, read off the same game as the commit (the Nova
 * guard applied to the older map): what the tile pays, what the cell's dossier promises, and that a bonus which
 * cannot happen (the scale full) makes the cell neither dearer nor illegal.
 */
const FAN = {boardName: BoardName.VASTITAS_BOREALIS} as const;

function pole(game: IGame): Space {
  const space = game.board.getSpaceOrThrow(SpaceName.VASTITAS_BOREALIS_NORTH_POLE);
  expect(space.bonus, 'the fan map prints the pole on cell 33').to.include(SpaceBonus.TEMPERATURE_4MC);
  return space;
}

function factIds(player: TestPlayer, space: Space): Array<string> {
  return boardCellInfo(player, space).facts.map((f) => f.id);
}

describe('Vastitas Borealis (fan map) — the North Pole for a human', () => {
  it('a greenery on the pole charges 4 M€ and raises the temperature 1 step (+1 TR)', () => {
    const [game, player] = testGame(1, FAN) as [IGame, TestPlayer];
    const space = pole(game);
    player.megaCredits = 10;
    const temperature = game.getTemperature();
    const tr = player.terraformRating;
    game.addGreenery(player, space);
    runAllActions(game);
    const pay = player.popWaitingFor();
    if (pay !== undefined) {
      cast(pay, SelectPaymentDeferred);
    }
    expect(game.getTemperature()).eq(temperature + 2);
    expect(player.megaCredits).eq(6);
    expect(player.terraformRating, 'oxygen +1, temperature +1').eq(tr + 2);
  });

  it('the dossier names the step (°C, TR) beside the bonus', () => {
    const [game, player] = testGame(1, FAN) as [IGame, TestPlayer];
    const ids = factIds(player, pole(game));
    expect(ids).to.include('printed-temperature');
    expect(ids).to.include('printed-temperature-temperature');
    expect(ids).to.include('printed-temperature-tr-temperature');
  });

  it('with the temperature MAXED the bonus does nothing — the dossier says so and nothing is charged', () => {
    const [game, player] = testGame(1, FAN) as [IGame, TestPlayer];
    setTemperature(game, 8);
    const space = pole(game);
    expect(factIds(player, space)).to.include('printed-temperature-maxed');
    player.megaCredits = 10;
    game.addGreenery(player, space);
    runAllActions(game);
    expect(player.megaCredits).eq(10);
    expect(space.tile?.tileType).eq(TileType.GREENERY);
  });

  it('legality = the commit: cold, the 4 M€ are owed; maxed, a player without 4 M€ may still stand there', () => {
    const [game, player] = testGame(1, FAN) as [IGame, TestPlayer];
    const space = pole(game);
    player.megaCredits = 0;
    expect(game.board.getAvailableSpacesForGreenery(player)).to.not.include(space);
    setTemperature(game, 8);
    expect(game.board.getAvailableSpacesForGreenery(player)).to.include(space);
  });
});
