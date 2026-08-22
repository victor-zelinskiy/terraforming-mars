import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {cachedOverlayStats} from '../../src/server/routes/overlayStatsCache';

describe('overlayStatsCache', () => {
  it('memoizes per (game, version, kind, color) and invalidates on gameAge/undoCount', () => {
    const player = TestPlayer.BLACK.newPlayer();
    const game = Game.newInstance('game-osc', [player], player, 'spectatorid');
    let computes = 0;
    const compute = () => {
      computes++;
      return [{n: computes}];
    };

    const a = cachedOverlayStats(game, 'effect', player.color, compute);
    const b = cachedOverlayStats(game, 'effect', player.color, compute);
    expect(computes).eq(1);
    expect(b).eq(a); // identity — the memo, not a re-aggregation

    // A different kind / color is its own entry under the same version.
    cachedOverlayStats(game, 'action', player.color, compute);
    expect(computes).eq(2);

    // The event stream cannot change without gameAge/undoCount moving —
    // moving either drops the whole memo.
    game.gameAge++;
    cachedOverlayStats(game, 'effect', player.color, compute);
    expect(computes).eq(3);
    game.undoCount++;
    cachedOverlayStats(game, 'effect', player.color, compute);
    expect(computes).eq(4);
    cachedOverlayStats(game, 'effect', player.color, compute);
    expect(computes).eq(4); // stable again at the new version
  });
});
