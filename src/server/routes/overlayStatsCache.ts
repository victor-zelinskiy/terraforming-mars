import {Color} from '../../common/Color';
import {IGame} from '../IGame';

/**
 * Per-game memo for the overlay aggregate routes (effect-stats /
 * action-stats). Both aggregates scan the WHOLE event stream, and the console
 * Action Center fetches them on every «ДЕЙСТВИЯ КАРТ» open — O(total events)
 * per open, growing for the entire match (Steam Deck shares that CPU with the
 * renderer).
 *
 * INVALIDATION RULE (exact, not heuristic): `gameAge` increments on every log
 * event and `undoCount` on every undo — the event stream cannot change
 * without moving one of them. Keyed weakly by the live game object, so an
 * evicted/reloaded game drops its memo with it.
 */
type GameMemo = {
  version: string,
  byKind: Map<string, ReadonlyArray<unknown>>,
};

const memos = new WeakMap<IGame, GameMemo>();

export function cachedOverlayStats<T>(
  game: IGame,
  kind: 'effect' | 'action',
  color: Color,
  compute: () => ReadonlyArray<T>,
): ReadonlyArray<T> {
  const version = `${game.gameAge}:${game.undoCount}`;
  let memo = memos.get(game);
  if (memo === undefined || memo.version !== version) {
    memo = {version, byKind: new Map()};
    memos.set(game, memo);
  }
  const key = `${kind}:${color}`;
  const hit = memo.byKind.get(key);
  if (hit !== undefined) {
    return hit as ReadonlyArray<T>;
  }
  const computed = compute();
  memo.byKind.set(key, computed);
  return computed;
}
