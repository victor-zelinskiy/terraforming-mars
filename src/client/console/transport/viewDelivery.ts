/*
 * ASKED IS THE SERVER'S WORD — THE VIEW'S DELIVERY IS JUDGED TOO (FREEZE ZERO — docs/claude/console/freeze-zero/PLAN.md §4).
 *
 * The liveness arbiter's invariant is «while the server asks the player something, a surface serves it or something
 * is provably in flight». Until this module «the server asks» was read off the APPLIED VIEW (`playerView.waitingFor`)
 * — so the whole road between the server and that view was outside every judge: a view the page could not apply (a
 * throw in the commit), a commit parked behind a scene flag that never released, a fetch that never came back. Each
 * of them leaves the page on its last view — «the other seat's turn», a healthy accepting screen with nobody asked —
 * while the server waits for THIS player. No stall, no rung, no last line: the bot moved minutes ago and the player
 * watches its chip.
 *
 * The page holds the server's own word apart from the view: THE POLL'S ANSWER (`GO` — «you are being waited on»).
 * This module is the judge's vocabulary for the gap between the two:
 *
 *   · THE DEBT — the poll says GO while the applied view asks nothing (`gameTransport.undeliveredQuestionSince`);
 *   · ITS HOLDER — who keeps the view from being committed, by ONE precedence: the fetch on the wire, the scenes the
 *     root parks a commit behind (`deferredViewRefresh.ts`), the bot's run being walked onto the board;
 *   · ITS BOUND — a holder is «in flight» only within `VIEW_DELIVERY_BOUND_MS` of the server's word: past it no
 *     holder excuses the debt (every one of them is bounded below that by its own law — a fetch by its timeout, a
 *     scene by the hold registry's ceiling, a run by its steps), and with NO holder it is never in flight at all.
 *
 * The arbiter then judges it like any unserved question (`supervisorController.checkLiveness`): nothing accepts the
 * server's question, the ordinary grace, the ladder — and past it THE LAST LINE, which is this class's whole cure: a
 * rebuilt page fetches the view by the boot road, with no scene, no park and no previous view to differ from.
 *
 * PURE but for one fact the root reports (`noteViewFetch`: the view's fetch is on the wire). Nothing here acts.
 */
import {sessionState} from '@/client/console/session/consoleSession';

/** No holder excuses an undelivered question for longer than this (the longest lawful holder is a scene: 35 s). */
export const VIEW_DELIVERY_BOUND_MS = 45_000;

export type ViewDebt = {
  /** Since when the server's word says «you are asked» while the applied view asks nothing (0 = no such debt). */
  since: number;
  /** The view's fetch is on the wire. */
  fetching: boolean;
  /** The scenes the root parks the view's commit behind, joined ('' = none). */
  scenes: string;
  /** The bot's run is being walked onto the board — the staged commit of the view. */
  botRun: boolean;
};

/** WHO HOLDS the view the server already speaks of — one word, by one precedence ('' = nobody). */
export function viewDebtHolder(debt: ViewDebt): string {
  if (debt.since === 0) {
    return '';
  }
  if (debt.fetching) {
    return 'fetch';
  }
  if (debt.scenes !== '') {
    return `scene:${debt.scenes}`;
  }
  return debt.botRun ? 'bot-run' : '';
}

export type ViewDebtLook = {
  /** The server asks and the applied view does not know. */
  undelivered: boolean;
  /** The debt is provably in flight — its name for the arbiter's list (`view:fetch`), or '' when it is not. */
  inFlight: string;
  /** The holder's word for a stall's line: `view:nobody`, `view:scene:played-hero` … ('' while delivered). */
  holder: string;
};

/** ONE LOOK at the debt. Pure. */
export function lookAtViewDebt(debt: ViewDebt, now: number): ViewDebtLook {
  if (debt.since === 0) {
    return {undelivered: false, inFlight: '', holder: ''};
  }
  const holder = viewDebtHolder(debt);
  const within = now - debt.since < VIEW_DELIVERY_BOUND_MS;
  return {
    undelivered: true,
    inFlight: holder !== '' && within ? `view:${holder}` : '',
    holder: `view:${holder === '' ? 'nobody' : holder}`,
  };
}

// ── the one fact the root reports: the view's fetch is on the wire ──────────────────────────────────────────────────

let fetches = 0;

/** The root's `update()` says when a fetch of the view leaves and when it ends (answered, failed or cut). */
export function noteViewFetch(onWire: boolean): void {
  fetches = Math.max(0, fetches + (onWire ? 1 : -1));
}

export function viewFetchOnWire(): boolean {
  return fetches > 0;
}

export function resetViewDelivery(): void {
  fetches = 0;
}

sessionState('view-delivery', resetViewDelivery, 665);
