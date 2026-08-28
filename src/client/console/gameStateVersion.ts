/*
 * THE GAME-STATE VERSION — the ONE stamp every client cache of SERVER-DERIVED
 * data is keyed by.
 *
 * THE RULE. If the value came out of the server (a preview, a verdict, an
 * aggregate — anything the server computed off its own live state), the cache
 * that holds it MUST be keyed by `gameStateVersion(view)`. A cache may add
 * structural terms on top; it may never use them INSTEAD.
 *
 * WHY THE RULE EXISTS (the bug class it closes). A hand-rolled fingerprint —
 * «tableau resources + the server's activatable set + the track position» — is
 * an allow-list of the inputs whoever wrote it happened to think of. Every card
 * that reads something else silently escapes it, and the cache then survives a
 * real change to its own input:
 *
 *   - «Фактотум»'s first branch is available iff `player.energy === 0`. Player
 *     opens the workspace with energy in stock (branch blocked, «Только когда у
 *     вас нет энергии»), SPENDS the energy, comes back next turn — none of the
 *     fingerprint's terms moved, so the cached preview was served again and the
 *     branch stayed blocked FOREVER. The player could not take an action the
 *     server was perfectly willing to accept.
 *   - «Штормовой барьер»'s preview carries a whole Hydronetwork route (from,
 *     to, the landing stage). An ordinary track advance moved none of the terms
 *     either — so the door opened on a spent route (fixed once, per-term, by
 *     bolting `deltaProject.position` on; that patch is exactly the symptom of
 *     the wrong shape).
 *
 * The server, by contrast, ALREADY publishes an exact change signal: `gameAge`
 * increments on every log event and once per fully-resolved action, `undoCount`
 * on every undo. It is the same pair `/api/waitingFor` polls on and the same
 * pair the server's own memo (`routes/overlayStatsCache.ts`) invalidates on.
 * The state cannot move without moving one of them, so a version-keyed cache is
 * complete BY CONSTRUCTION — nothing to keep in sync when a card starts reading
 * a new corner of the state.
 *
 * COST. A version change drops warm data that may still have been valid. That
 * trade is settled: a cold fetch costs a few hundred ms of warmth, a stale
 * verdict costs the player a move they were entitled to.
 */

/** What a cache needs off the view to stamp an entry. */
export type VersionedView = {
  id?: unknown,
  game?: {gameAge?: number, undoCount?: number} | undefined,
};

/**
 * The stamp: viewer + the server's own state counters.
 *
 * The viewer is part of it because every server-derived value is computed FOR a
 * seat (costs, discounts, «уже активировано» — all per-player), so a seat
 * switch must miss, not hit.
 *
 * A view without `game` (partial fixtures) stamps `a?u?` rather than throwing —
 * it degrades to "always the same version", which is why a cache is still
 * expected to carry its structural terms as a secondary net.
 */
export function gameStateVersion(view: VersionedView): string {
  const game = view.game;
  return `${String(view.id ?? '')}|a${game?.gameAge ?? '?'}|u${game?.undoCount ?? '?'}`;
}
