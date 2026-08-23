import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {cast} from '@/common/utils/utils';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Pluto} from '../../src/server/colonies/Pluto';
import {Titan} from '../../src/server/colonies/Titan';
import {AerialMappers} from '../../src/server/cards/venusNext/AerialMappers';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {GameInvalidation, RealtimeHub} from '../../src/server/server/realtime/RealtimeHub';

/** Spy on the singleton hub's invalidate; returns the captured calls + a restore. */
function spyInvalidate(): {calls: Array<GameInvalidation>, restore: () => void} {
  const hub = RealtimeHub.getInstance();
  const original = hub.invalidate.bind(hub);
  const calls: Array<GameInvalidation> = [];
  hub.invalidate = (update) => {
    calls.push(update);
    return 0;
  };
  return {calls, restore: () => {
    hub.invalidate = original;
  }};
}

/**
 * THE QUEUE PAUSE IS AN OBSERVABLE EVENT. When the deferred-actions queue
 * pauses on a player's prompt, `Player.takeAction` — the only other
 * input-path site that emits the realtime invalidation — is never reached.
 * Without a broadcast at the pause, a prompt created for an OFF-TURN player
 * (an opponent's colony-bonus discard, a forced reaction) reached their
 * client only on the healthy-socket fallback poll: ~20 seconds of a server
 * silently holding a prompt nobody was told about.
 */
describe('realtime/queue-pause broadcast', () => {
  it('a deferred prompt assigned to an opponent broadcasts an invalidation', () => {
    const pluto = new Pluto();
    const [game, player, player2] = testGame(2, {coloniesExtension: true});
    game.colonies.push(pluto);
    pluto.addColony(player2);
    runAllActions(game);
    player2.acknowledgeCardDrawReveals('all');

    pluto.increaseTrack(3);
    const {calls, restore} = spyInvalidate();
    try {
      pluto.trade(player);
      runAllActions(game); // drains through the reset, pauses on player2's discard
    } finally {
      restore();
    }

    // The pause really happened on the opponent…
    cast(player2.getWaitingFor(), SelectCard<IProjectCard>);
    // …and it was announced to the game's room.
    expect(calls.some((c) => c.gameId === game.id)).is.true;
  });

  it('an inline colony-bonus prompt for the trader broadcasts too (GiveColonyBonus pause)', () => {
    const titan = new Titan();
    const [game, player] = testGame(2, {coloniesExtension: true});
    game.colonies.push(titan);
    const mappers = new AerialMappers();
    player.playCard(mappers);
    titan.addColony(player);
    runAllActions(game); // placement floaters auto-apply (single candidate)
    player.playCard(new Dirigibles()); // …now the trade picks are real prompts

    const {calls, restore} = spyInvalidate();
    try {
      titan.trade(player);
      runAllActions(game); // pauses on the trader's own colony-bonus pick
    } finally {
      restore();
    }

    cast(player.getWaitingFor(), SelectCard<IProjectCard>);
    expect(calls.some((c) => c.gameId === game.id)).is.true;
  });
});
