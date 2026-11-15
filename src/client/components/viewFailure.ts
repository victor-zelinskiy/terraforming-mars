/*
 * THE VIEW'S ROAD HAS ONE ENDING FOR A FAILURE — and it is never a native dialog
 * (FREEZE ZERO — docs/claude/console/freeze-zero/PLAN.md §4).
 *
 * Until this module a failure anywhere between the root's fetch of the view and its commit (`App.update`) ended in
 * `alert('Error getting game data')`: a BLOCKING browser dialog — on a pad-only device a window no button reaches,
 * with the page's script (the arbiter, the pulse, the transport) stopped behind it. And «anywhere» was wide: the
 * network, the server's refusal, or ANY throw of the commit and of every seeder it runs.
 *
 *  · THE FETCH failed (the network, the server's status, the fetch's own bound): nothing was applied — the page
 *    stands on its last truth. Said in a line; the POLL re-drives it (it asks the same server once a second, and it
 *    is the one that tells the player when the server cannot be reached — a pad-answerable alert).
 *  · THE APPLY threw: the page may hold HALF of a view — its state is no longer a function of the server's truth,
 *    which is exactly what the last line exists for: the console session is rebuilt from the server's view
 *    (`sessionRebuild.ts` — a fresh document applies the view by the boot road, with no previous view to differ
 *    from). Refused by its bound (this view was already rebuilt for, or the window is full), the failure becomes the
 *    loading curtain's own error state — the surface the game already has for «the game's data could not be loaded».
 *
 * Under the loading curtain every failure is the curtain's own error state at once (the boot, a rebuild in flight).
 */
import {failLoading, loadingScreenState} from '@/client/console/loadingScreenState';
import {rebuildConsoleSession} from '@/client/console/session/sessionRebuild';

/** The view the page stands on, as far as the bound of the last line needs it. */
export type StandingView = {id?: string, game?: {gameAge?: number}} | undefined;

export type ViewFailure = 'curtain' | 'said' | 'rebuilding' | 'refused';

export function viewFailed(phase: 'fetch' | 'apply', err: unknown, standing: StandingView): ViewFailure {
  console.error(err);
  if (loadingScreenState.active) {
    failLoading('Error getting game data');
    return 'curtain';
  }
  const said = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  if (phase === 'fetch') {
    console.warn(`[view] fetch failed — ${said} — the poll re-asks`);
    return 'said';
  }
  const verdict = rebuildConsoleSession({
    by: 'view', seat: standing?.id ?? '',
    question: `view@${standing?.game?.gameAge ?? 0}`, task: 'view-apply',
    why: `the fetched view could not be applied — ${said}`,
  });
  if (verdict === 'refused') {
    failLoading('Error getting game data');
  }
  return verdict;
}
