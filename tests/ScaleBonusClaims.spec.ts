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

  it('the claim log RIDES the claiming action\'s own correlation — a beat of that story, never a detached announcement', () => {
    // The old standalone client toast diffed `scaleBonusClaims` from the public
    // game model: no correlation, no inspect route, a late arrival with the
    // zone's imperative rule text (and, for MarsBot, the wrong reward). The
    // contract now: the claim is logged INSIDE the live action scope, so the
    // journal group / bot-turn script that crossed the threshold carries it.
    const [game, player] = testGame(2);
    game.events.beginAction(player, undefined, {category: 'card-play'});
    game.increaseTemperature(player, 3); // -30 → -24 crosses the heat-bonus step
    game.events.endScope();
    const claim = game.gameLog.find((m) => m.message === '${0} claimed the ${1} scale bonus');
    expect(claim, 'the claim line exists').is.not.undefined;
    expect(claim?.correlationId, 'the claim is correlated to the action').is.not.undefined;
    // …and it shares the correlation of the OTHER lines of the same action
    // (the heat-production reward the same crossing granted).
    const sibling = game.gameLog.find((m) => m !== claim && m.correlationId === claim?.correlationId);
    expect(sibling, 'the claim sits inside the action\'s own group').is.not.undefined;
  });

  it('the claim line carries the parameter as a RESOURCE token (an icon chip, never an untranslatable raw word)', () => {
    const [game, player] = testGame(2);
    game.increaseTemperature(player, 3);
    const claim = game.gameLog.find((m) => m.message === '${0} claimed the ${1} scale bonus');
    expect(claim?.data[1]?.type).to.eq(15 /* LogMessageDataType.RESOURCE */);
    expect(claim?.data[1]?.value).to.eq('temperature');
  });
});
