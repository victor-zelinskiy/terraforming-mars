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
 * IS THE VIEW'S LAG A LIE — or a debt somebody owns? (FREEZE ZERO — the field corpus's commonest «defect».)
 *
 * The freshness witness of the transport heals «the applied view is behind the server's cursor» after a grace. But
 * the commonest reason a view is behind is HONEST and already OWNED: the poll fetched the newer view while a scene
 * was playing, the root refused to commit it over the scene and PARKED the refresh (`deferredViewRefresh.ts` — re-run
 * on the release edge, bounded by its own 15 s ceiling, named when it runs out). The witness did not know: every
 * 3 s of a tile's flight or a played card's cinematic it «healed» — one more fetch, refused and parked again — and
 * printed a defect line (51 of them in 14 of the owner's 47 field exports). Two nets, one fact.
 *
 * The law: a debt that has an owner is not a lie. The witness judges only a lag NOBODY holds — no request on the
 * wire, no refresh parked: a consumed wake, a dropped model.
 */
export function viewLagIsALie(f: {ahead: boolean, requestInProgress: boolean, refreshParked: boolean}): boolean {
  return f.ahead && !f.requestInProgress && !f.refreshParked;
}

/** What the view is behind by, for a line: `age +3 (undo +0)`. */
export function viewLagOf(game: ViewCursor | undefined): string {
  if (game === undefined) {
    return 'no view';
  }
  const age = realtimeState.lastInvalidationGameAge;
  const undo = realtimeState.lastInvalidationUndoCount;
  return `age +${age === undefined ? 0 : Math.max(0, age - game.gameAge)} (undo +${undo === undefined ? 0 : Math.max(0, undo - game.undoCount)})`;
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
