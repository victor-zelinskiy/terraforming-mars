import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {GameLoader} from '../../src/server/database/GameLoader';
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

describe('realtime/GameLoader broadcast', () => {
  it('saveGame broadcasts a single invalidation after persistence', async () => {
    const [game] = testGame(2);
    // Let any saves queued during game setup settle BEFORE we start spying, so
    // this test isolates the single explicit saveGame below.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const {calls, restore} = spyInvalidate();
    try {
      await GameLoader.getInstance().saveGame(game);
    } finally {
      restore();
    }
    expect(calls).to.have.length(1);
    expect(calls[0].gameId).to.eq(game.id);
    expect(calls[0].gameAge).to.eq(game.gameAge);
    expect(calls[0].undoCount).to.eq(game.undoCount);
    expect(calls[0].phase).to.eq(game.phase);
  });

  it('completeGame broadcasts the end state', async () => {
    const [game] = testGame(2);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const {calls, restore} = spyInvalidate();
    try {
      await GameLoader.getInstance().completeGame(game);
    } finally {
      restore();
    }
    expect(calls.some((c) => c.gameId === game.id)).to.be.true;
  });

  it('notifyGameStateChanged broadcasts the current observable version', async () => {
    const [game] = testGame(2);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const {calls, restore} = spyInvalidate();
    try {
      GameLoader.getInstance().notifyGameStateChanged(game);
    } finally {
      restore();
    }
    expect(calls).to.have.length(1);
    expect(calls[0].gameId).to.eq(game.id);
    expect(calls[0].gameAge).to.eq(game.gameAge);
  });

  // The reported bug: a first-of-two action (e.g. a tile placement) with undo
  // disabled advances gameAge but is NOT persisted, so it emitted no WS
  // invalidation and opponents saw it only on the (now stretched) fallback poll.
  it('an intermediate action broadcasts even though it is not saved', async () => {
    const [game, player] = testGame(2);
    game.gameOptions.undoOption = false;
    await new Promise((resolve) => setTimeout(resolve, 0));
    runAllActions(game); // drain any pending deferred actions from setup

    // Make it look like the player already took an action this round, so the
    // takeAction save condition (actionsTakenThisRound === 0 || undoOption) is
    // false — i.e. the not-persisted intermediate-action path.
    player.actionsTakenThisRound = 1;

    const {calls, restore} = spyInvalidate();
    let ageBefore = 0;
    try {
      ageBefore = game.gameAge;
      player.takeAction();
    } finally {
      restore();
    }
    expect(game.gameAge).to.eq(ageBefore + 1); // the action advanced the cursor
    expect(calls.some((c) => c.gameId === game.id && c.gameAge === game.gameAge)).to.be.true;
  });
});
