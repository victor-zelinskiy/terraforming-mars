import {expect} from 'chai';
import {testGame} from '../TestGame';
import {GameLoader} from '../../src/server/database/GameLoader';
import {GameInvalidation, RealtimeHub} from '../../src/server/server/realtime/RealtimeHub';

describe('realtime/GameLoader broadcast', () => {
  it('saveGame broadcasts a single invalidation after persistence', async () => {
    const [game] = testGame(2);
    // Let any saves queued during game setup settle BEFORE we start spying, so
    // this test isolates the single explicit saveGame below.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const hub = RealtimeHub.getInstance();
    const original = hub.invalidate.bind(hub);
    const calls: Array<GameInvalidation> = [];
    hub.invalidate = (update) => {
      calls.push(update);
      return 0;
    };
    try {
      await GameLoader.getInstance().saveGame(game);
    } finally {
      hub.invalidate = original;
    }
    expect(calls).to.have.length(1);
    expect(calls[0].gameId).to.eq(game.id);
    expect(calls[0].gameAge).to.eq(game.gameAge);
    expect(calls[0].undoCount).to.eq(game.undoCount);
    expect(calls[0].phase).to.eq(game.phase);
  });
});
