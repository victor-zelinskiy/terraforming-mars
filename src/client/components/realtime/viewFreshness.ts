import {realtimeState} from './realtimeService';

/**
 * VIEW FRESHNESS — «is the applied view behind the server?», answered LOCALLY.
 *
 * Every WS `INVALIDATED` message already carries the server's own change
 * cursor (`gameAge` / `undoCount`, recorded into `realtimeState.lastInvalidation*`),
 * so the client can know it is stale without a round trip. This module is the
 * one reader of that fact:
 *
 *  · the transport's mid-prompt refresh path uses it beside the poll's own
 *    `changed` bit (`WaitingForModel.changed`);
 *  · the presentation ledger's freshness witness re-drives the guarded
 *    refresh when the view stays behind the advertised cursor (a consumed
 *    wake, a refused refresh) — the debt net under the primary paths.
 *
 * PURE READS ONLY — nothing here fetches, applies or schedules.
 */

type ViewCursor = {gameAge: number, undoCount: number};

/**
 * TRUE when the latest WS invalidation advertised a cursor the applied view
 * has not reached. Conservative: with no invalidation seen (WS off, fresh
 * connection) it answers false — the poll's own comparison owns that case.
 */
export function serverAheadOfView(game: ViewCursor | undefined): boolean {
  if (game === undefined) {
    return false;
  }
  const age = realtimeState.lastInvalidationGameAge;
  const undo = realtimeState.lastInvalidationUndoCount;
  return (age !== undefined && age > game.gameAge) ||
    (undo !== undefined && undo > game.undoCount);
}

/**
 * THE MID-PROMPT REFRESH kill switch (mechanism A of
 * docs/claude/console/presentation-reconciliation.md). Default ON: a
 * GO/REFRESH that lands while the viewer holds a prompt APPLIES (the
 * prompt-preserving epoch rule keeps partial input alive) instead of being
 * dropped — the drop is what let another player's tile stay invisible for
 * the whole time the viewer was aiming. `?midpromptrefresh=0` (or
 * localStorage `midprompt_refresh` = '0') restores the historical skip.
 */
export function midPromptRefreshEnabled(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get('midpromptrefresh');
    if (param === '1' || param === 'true') {
      return true;
    }
    if (param === '0' || param === 'false') {
      return false;
    }
  } catch {
    // no window / opaque origin — fall through to storage/default
  }
  try {
    const stored = window.localStorage?.getItem('midprompt_refresh');
    if (stored === '1' || stored === 'true') {
      return true;
    }
    if (stored === '0' || stored === 'false') {
      return false;
    }
  } catch {
    // storage unavailable — default
  }
  return true;
}
