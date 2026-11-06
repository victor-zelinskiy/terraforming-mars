import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {Phase} from '../../src/common/Phase';
import {cast} from '../../src/common/utils/utils';
import {fakeCard, runAllActions, setOxygenLevel, setTemperature, setVenusScaleLevel, testGame} from '../TestingUtils';
import {assertBuildColony} from '../colonies/coloniesAssertions';
import {GrantVenusAltTrackBonusDeferred} from '../../src/server/venusNext/GrantVenusAltTrackBonusDeferred';

/**
 * Amazonis Planitia's longer tracks — upstream's own specs of b745cb9a00 (per-map track bonuses) and 91a4605bd2 (Venus
 * in 1 % steps above 30 %), run against the fork's grant code (`Game.increase*` reading `game.globalParameterTracks`).
 */
describe('Amazonis Planitia — the global-parameter tracks', () => {
  it('queues the 0C ocean after card effects and the TR increase', () => {
    const [game, player] = testGame(1);
    game.phase = Phase.ACTION;
    setTemperature(game, -2);
    const tr = player.terraformRating;
    let queuedWhenCardFires = -1;
    player.playedCards.push(fakeCard({
      onGlobalParameterIncrease: () => {
        queuedWhenCardFires = game.deferredActions.length;
      },
    }));

    game.increaseTemperature(player, 1);

    expect(queuedWhenCardFires).eq(0);
    expect(player.terraformRating).eq(tr + 1);
    expect(game.deferredActions.length).eq(1);
  });

  it('Amazonis Planitia grants plant production at -12C', () => {
    const [game, player] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA});
    game.phase = Phase.ACTION;
    setTemperature(game, -14);

    const before = player.production.plants;
    game.increaseTemperature(player, 1);
    expect(game.getTemperature()).eq(-12);
    expect(player.production.plants).eq(before + 1);
  });

  it('standard maps grant no production at -12C', () => {
    const [game, player] = testGame(1);
    game.phase = Phase.ACTION;
    setTemperature(game, -14);

    const before = player.production.plants;
    game.increaseTemperature(player, 1);
    expect(player.production.plants).eq(before);
  });

  it('Amazonis Planitia draws a card at 7% oxygen', () => {
    const [game, player] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA});
    game.phase = Phase.ACTION;
    setOxygenLevel(game, 6);

    const before = player.cardsInHand.length;
    game.increaseOxygenLevel(player, 1);
    expect(game.getOxygenLevel()).eq(7);
    expect(player.cardsInHand.length).eq(before + 1);
  });

  it('Amazonis Planitia raises temperature at 11% oxygen, not 8%', () => {
    const [game, player] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA});
    game.phase = Phase.ACTION;
    setTemperature(game, -10);

    // Crossing 8% does not raise temperature on this map.
    setOxygenLevel(game, 7);
    game.increaseOxygenLevel(player, 1);
    expect(game.getOxygenLevel()).eq(8);
    expect(game.getTemperature()).eq(-10);

    // Crossing 11% raises temperature one step.
    setOxygenLevel(game, 10);
    game.increaseOxygenLevel(player, 1);
    expect(game.getOxygenLevel()).eq(11);
    expect(game.getTemperature()).eq(-8);

    // Going on to 12% does not raise it again.
    game.increaseOxygenLevel(player, 1);
    expect(game.getOxygenLevel()).eq(12);
    expect(game.getTemperature()).eq(-8);
  });

  it('standard maps still raise temperature at 8% oxygen', () => {
    const [game, player] = testGame(1);
    game.phase = Phase.ACTION;
    setTemperature(game, -10);
    setOxygenLevel(game, 7);

    game.increaseOxygenLevel(player, 1);
    expect(game.getOxygenLevel()).eq(8);
    expect(game.getTemperature()).eq(-8);
  });

  it('player-benefit bonuses are skipped in the solar phase, but cascades still apply', () => {
    const [game, player] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA});
    game.phase = Phase.SOLAR;

    // The 7% oxygen card draw is a player benefit and is skipped during World Government terraforming.
    setOxygenLevel(game, 6);
    const cardsBefore = player.cardsInHand.length;
    game.increaseOxygenLevel(player, 1);
    expect(player.cardsInHand.length).eq(cardsBefore);

    // The 11% oxygen -> temperature cascade is a global effect and applies regardless.
    setTemperature(game, -10);
    setOxygenLevel(game, 10);
    game.increaseOxygenLevel(player, 1);
    expect(game.getTemperature()).eq(-8);
  });

  it('Amazonis Planitia raises the rating at 22% Venus, not 16%', () => {
    const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, venusNextExtension: true});
    game.phase = Phase.ACTION;
    setVenusScaleLevel(game, 14);
    const tr = player.terraformRating;
    game.increaseVenusScaleLevel(player, 1);
    expect(player.terraformRating, '16 %: only the step').eq(tr + 1);
    setVenusScaleLevel(game, 20);
    game.increaseVenusScaleLevel(player, 1);
    expect(player.terraformRating, '22 %: the step and the printed rating').eq(tr + 3);
  });

  for (const run of [
    {colonies: true, phase: Phase.ACTION, expected: true},
    {colonies: false, phase: Phase.ACTION, expected: false},
    {colonies: true, phase: Phase.SOLAR, expected: false},
  ] as const) {
    it('Amazonis Planitia at 16% Venus ' + JSON.stringify(run), () => {
      // 2 players to remove an early-game solo action in the deferred actions queue.
      const [game, player] = testGame(2, {boardName: BoardName.AMAZONIS_PLANITIA, venusNextExtension: true, coloniesExtension: run.colonies});
      game.phase = run.phase;
      setVenusScaleLevel(game, 14);

      game.increaseVenusScaleLevel(player, 1);
      runAllActions(game);

      if (run.expected) {
        assertBuildColony(player, player.popWaitingFor());
      } else {
        cast(player.popWaitingFor(), undefined);
      }
    });
  }

  it('Venus moves 1% per step above 30% on Amazonis Planitia', () => {
    const [game, player] = testGame(2, {venusNextExtension: true, boardName: BoardName.AMAZONIS_PLANITIA});
    setVenusScaleLevel(game, 28);

    expect(game.increaseVenusScaleLevel(player, 2)).eq(2);
    expect(game.getVenusScaleLevel()).eq(31);

    expect(game.increaseVenusScaleLevel(player, 3)).eq(2);
    expect(game.getVenusScaleLevel()).eq(33);

    expect(game.increaseVenusScaleLevel(player, 1)).eq(0);
    expect(game.getVenusScaleLevel()).eq(33);
  });

  it('Venus decreases 1% per step above 30% on Amazonis Planitia', () => {
    const [game, player] = testGame(2, {venusNextExtension: true, boardName: BoardName.AMAZONIS_PLANITIA});
    setVenusScaleLevel(game, 31);

    game.increaseVenusScaleLevel(player, -1);
    expect(game.getVenusScaleLevel()).eq(30);

    game.increaseVenusScaleLevel(player, -1);
    expect(game.getVenusScaleLevel()).eq(28);
  });

  it('the standard Venus scale still stops at 30%', () => {
    const [game, player] = testGame(2, {venusNextExtension: true});
    setVenusScaleLevel(game, 28);
    expect(game.increaseVenusScaleLevel(player, 3)).eq(1);
    expect(game.getVenusScaleLevel()).eq(30);
  });

  // The owner's rule for Alt Venus on the 33 % track (2026-11-06): a standard resource per step from 16 %, 31 · 32 · 33
  // included, and the wild resource on the map's maximum — and every one of those cells is a claimable scale bonus.
  describe('the alternative Venus board on the 33 % track', () => {
    for (const run of [
      {from: 28, steps: 1, standard: 1, wild: false, to: 30},
      {from: 30, steps: 1, standard: 1, wild: false, to: 31},
      {from: 31, steps: 2, standard: 2, wild: true, to: 33},
    ]) {
      it(JSON.stringify(run), () => {
        const [game, player] = testGame(1, {venusNextExtension: true, altVenusBoard: true, boardName: BoardName.AMAZONIS_PLANITIA});
        setVenusScaleLevel(game, run.from);
        game.increaseVenusScaleLevel(player, run.steps as 1 | 2);
        expect(game.getVenusScaleLevel()).eq(run.to);
        const bonus = game.deferredActions.queuedFor(player).find((d) => d instanceof GrantVenusAltTrackBonusDeferred) as GrantVenusAltTrackBonusDeferred | undefined;
        expect(bonus, 'the bonus is asked').is.not.undefined;
        expect([bonus!.standardResourceCount, bonus!.wildResource]).deep.eq([run.standard, run.wild]);
        for (let level = run.from + 1; level <= run.to; level++) {
          if (level > 30 || level % 2 === 0) {
            expect(game.scaleBonusClaims.get(`venus-${level}`), `venus-${level} claimed`).eq(player.color);
          }
        }
      });
    }
  });
});
