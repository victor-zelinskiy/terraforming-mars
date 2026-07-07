import {expect} from 'chai';
import {TileType} from '../../src/common/TileType';
import {IGame} from '../../src/server/IGame';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {setOxygenLevel, setTemperature} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const BUILDING = 0;

function failedActions(game: IGame): number {
  return game.gameLog.filter((m) => m.message.includes('Failed Action')).length;
}

describe('AutomaTerraformer', () => {
  it('raises the temperature 1 step with TR per the normal rules', () => {
    const [game, /* human */, bot] = testAutomaGame();
    AutomaResolver.performTrackAction(game, 'temperature', BUILDING);
    expect(game.getTemperature()).eq(-28);
    expect(bot.terraformRating).eq(21);
  });

  it('the −24/−20 heat-production bonus steps give MarsBot 2 M€ instead', () => {
    const [game, /* human */, bot] = testAutomaGame();
    setTemperature(game, -26);
    AutomaResolver.performTrackAction(game, 'temperature', BUILDING);
    expect(game.getTemperature()).eq(-24);
    expect(bot.megaCredits).eq(2);
    expect(bot.production.heat).eq(0);

    setTemperature(game, -22);
    AutomaResolver.performTrackAction(game, 'temperature', BUILDING);
    expect(game.getTemperature()).eq(-20);
    expect(bot.megaCredits).eq(4);
    expect(bot.production.heat).eq(0);
  });

  it('the 0 °C ocean bonus resolves immediately with MarsBot\'s own placement — no prompt', () => {
    const [game, /* human */, bot] = testAutomaGame();
    setTemperature(game, -2);
    AutomaResolver.performTrackAction(game, 'temperature', BUILDING);
    expect(game.getTemperature()).eq(0);
    expect(game.board.getOceanSpaces()).has.length(1);
    expect(bot.terraformRating).eq(22); // +1 temperature, +1 ocean.
    expect(game.deferredActions.length).eq(0);
    expect(failedActions(game)).eq(0);
  });

  it('the 0 °C ocean bonus with all oceans placed is a Failed Action', () => {
    const [game, human, bot] = testAutomaGame();
    for (let i = 0; i < 9; i++) {
      const space = game.board.getAvailableSpacesForOcean(human)[0];
      game.simpleAddTile(human, space, {tileType: TileType.OCEAN});
    }
    setTemperature(game, -2);
    AutomaResolver.performTrackAction(game, 'temperature', BUILDING);
    expect(game.getTemperature()).eq(0);
    expect(failedActions(game)).eq(1);
    expect(bot.megaCredits).eq(5);
    expect(bot.terraformRating).eq(21); // Only the temperature step.
  });

  it('raising a completed temperature is a Failed Action', () => {
    const [game, /* human */, bot] = testAutomaGame();
    setTemperature(game, 8);
    AutomaResolver.performTrackAction(game, 'temperature', BUILDING);
    expect(game.getTemperature()).eq(8);
    expect(failedActions(game)).eq(1);
    expect(bot.megaCredits).eq(5);
  });

  it('temperature2 = two separate steps; the second onto a completed track fails', () => {
    const [game, /* human */, bot] = testAutomaGame();
    setTemperature(game, 6);
    AutomaResolver.performTrackAction(game, 'temperature2', BUILDING);
    expect(game.getTemperature()).eq(8);
    expect(failedActions(game)).eq(1);
    expect(bot.megaCredits).eq(5);
    expect(bot.terraformRating).eq(21);
  });

  it('the greenery track action raises oxygen; the 8% bonus raises the temperature immediately', () => {
    const [game, /* human */, bot] = testAutomaGame();
    setOxygenLevel(game, 7);
    AutomaResolver.performTrackAction(game, 'greenery', BUILDING);
    expect(game.getOxygenLevel()).eq(8);
    expect(game.getTemperature()).eq(-28); // The bonus step.
    expect(bot.terraformRating).greaterThanOrEqual(22); // O2 + temperature (+ maybe icon M€, no TR).
    expect(failedActions(game)).eq(0);
  });

  it('the 8% oxygen bonus with a completed temperature is a Failed Action', () => {
    const [game] = testAutomaGame();
    setOxygenLevel(game, 7);
    setTemperature(game, 8);
    AutomaResolver.performTrackAction(game, 'greenery', BUILDING);
    expect(game.getOxygenLevel()).eq(8);
    expect(failedActions(game)).eq(1);
  });

  it('a greenery at maxed oxygen still places — no oxygen, no TR for it, no Failed Action', () => {
    const [game, /* human */, bot] = testAutomaGame();
    setOxygenLevel(game, 14);
    AutomaResolver.performTrackAction(game, 'greenery', BUILDING);
    expect(game.board.spaces.some((s) => s.tile?.tileType === TileType.GREENERY)).is.true;
    expect(game.getOxygenLevel()).eq(14);
    expect(bot.terraformRating).eq(20);
    expect(failedActions(game)).eq(0);
  });
});
