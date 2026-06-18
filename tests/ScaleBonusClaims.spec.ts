import {expect} from 'chai';
import {testGame} from './TestGame';
import {Phase} from '../src/common/Phase';

describe('scaleBonusClaims', () => {
  it('records the player who crosses a temperature heat-bonus threshold', () => {
    const [game, player] = testGame(2);
    // Temperature starts at -30; +6 reaches -24 (the first heat-production bonus).
    game.increaseTemperature(player, 3);
    expect(game.scaleBonusClaims.get('temperature--24')).to.eq(player.color);
    // -20 isn't crossed yet.
    expect(game.scaleBonusClaims.get('temperature--20')).to.be.undefined;
  });

  it('records the temperature ocean bonus at 0', () => {
    const [game, player] = testGame(2);
    game.increaseTemperature(player, 3); // -30 -> -24
    game.increaseTemperature(player, 3); // -24 -> -18
    game.increaseTemperature(player, 3); // -18 -> -12
    game.increaseTemperature(player, 3); // -12 -> -6
    game.increaseTemperature(player, 3); // -6 -> 0
    expect(game.scaleBonusClaims.get('temperature-0')).to.eq(player.color);
  });

  it('records a neutral (World Government) claim during the SOLAR phase', () => {
    const [game, player] = testGame(2);
    game.phase = Phase.SOLAR;
    game.increaseTemperature(player, 3); // -30 -> -24 via World Government
    expect(game.scaleBonusClaims.get('temperature--24')).to.eq('neutral');
  });

  it('records Venus scale bonuses for the player', () => {
    const [game, player] = testGame(2, {venusNextExtension: true});
    game.increaseVenusScaleLevel(player, 3); // 0 -> 6
    expect(game.scaleBonusClaims.get('venus-8')).to.be.undefined;
    game.increaseVenusScaleLevel(player, 1); // 6 -> 8 (card bonus)
    expect(game.scaleBonusClaims.get('venus-8')).to.eq(player.color);
  });

  it('only records the FIRST claim of a threshold', () => {
    const [game, p1, p2] = testGame(2);
    game.increaseTemperature(p1, 3); // p1 takes -24
    game.increaseTemperature(p2, 3); // p2 raises to -18, doesn't re-take -24
    expect(game.scaleBonusClaims.get('temperature--24')).to.eq(p1.color);
  });
});
