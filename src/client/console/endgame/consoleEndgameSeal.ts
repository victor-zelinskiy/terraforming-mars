/*
 * THE END OF THE GAME IS A HARD BOUNDARY — the live game's instruments are
 * SEALED as the scoring workspace stands up.
 *
 * Phase.END arrives from the POLL, not from a press: whatever the player had
 * open at that instant is still open one frame later, and the scoring scene
 * («.con-endgame», z 11480) is one of the LOWEST layers in the shell. The
 * quick wheel (11500), a sheet (11500), Info Mode (11560), the hand bodies
 * (11645) therefore keep painting OVER the final scoring — and because the
 * workspace deliberately consumes the whole pad while it stands, none of them
 * can be dismissed any more. That is not a stack of small bugs; it is one
 * missing beat: nothing ever told the live game it was over.
 *
 * This is that beat. ONE named function, called once on the rising edge of
 * Phase.END (ConsoleShell.endgameFrameLive), which dismisses every live-game
 * surface by NAME — so a new surface is a new line here, reviewed, and not a
 * silent regression discovered at somebody's finale.
 *
 * WHAT IS DELIBERATELY NOT HERE:
 *  · the WORKSPACE STACK — `enterWorkspace('endgame')` unwinds it by itself
 *    (the phase root's own verb); only the PARK needs killing, because a
 *    parked flow is a decision set aside and there is no longer a game to
 *    resume it into;
 *  · every prompt-derived surface (task host, composites, placement, …) —
 *    they mount off `waitingFor`, and at Phase.END the transport is down and
 *    nothing is ever owed;
 *  · the drawn-cards REVEAL — a reload into an ended game can still owe
 *    undelivered draws, and «no silent loss» outranks a tidy screen (the
 *    shell keeps routing the pad to it above the workspace).
 *
 * Sealing is NOT the same as forbidding. Past the boundary the player may
 * COLLAPSE the scoring scene (B) and walk the final state read-only — the
 * journal, «Разыграно», Information, the board, the colonies. What the seal
 * guarantees is that the post-game starts from a clean screen, chosen, rather
 * than inheriting whatever the last live frame happened to be showing.
 */
import {clearCardBrowserPicks, closeConsoleLayers, consoleState} from '@/client/console/consoleRouter';
import {discardWorkspacePark} from '@/client/console/consoleWorkspaceStack';
import {closeInfoMode, infoModeState, settleInfoModeClose} from '@/client/console/infoModeState';
import {journalState} from '@/client/components/journal/journalState';
import {resetConsoleJournalUi} from '@/client/console/consoleJournalState';
import {closeConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {closeColonyFocus} from '@/client/console/consoleColoniesModel';
import {resetPlanetFocus} from '@/client/console/planetFocus';
import {resetSurfaceMotion} from '@/client/console/surfaceMotion/surfaceMotionState';
import {clearTransient, setTurn} from '@/client/components/notifications/notificationState';

/**
 * Dismiss every live-game instrument that survives a phase change on its own.
 * Idempotent and synchronous — safe to call from a watcher, safe to call twice.
 *
 * The shell adds the few surfaces it owns as component state («Разыграно», the
 * journal's colony dossier); everything module-reactive is here.
 */
export function sealLiveGameSurfaces(): void {
  // The direct-input command layers + the sheet-shaped frames + the pass /
  // heat confirm + sell-patents mode. The wheel is the loud one: it is the
  // surface a player is most likely to be holding open when the last seat
  // passes, and the one that ends up welded over the ceremony.
  closeConsoleLayers();
  // A PARKED flow is a decision set aside for later, and there is no later:
  // the restore card must not offer a trip back into a game that has ended.
  discardWorkspacePark();
  // The mandatory hand-SELECT picks are prompt-scoped and outlive a defer on
  // purpose — but their prompt cannot exist any more.
  consoleState.select.selected = [];
  consoleState.select.suitableOnly = true;
  clearCardBrowserPicks();
  consoleState.task.deferred = false;
  // Information Mode is a live-game instrument twice over: it stands at
  // 11560, and during the count an Info peek would pre-reveal the very
  // totals the ceremony is about to narrate.
  //
  // ⚠ ASK BEFORE CLOSING — `closeInfoMode` LATCHES a dismiss tail
  // (`infoModeState.closing`), and the release is the PANEL'S OWN after-leave
  // hook, which cannot fire for a panel that was never mounted. Closing an
  // already-closed Info Mode therefore pinned `closing` true for the rest of
  // the session, and `con-root--rail-replaced` reads it: the trophy gallery
  // stayed dark for the whole post-game inspection, which is the very defect
  // `endgameStageUp` was written to fix. A latch belongs to the WORK, not to
  // the ATTEMPT.
  if (infoModeState.open) {
    closeInfoMode();
  } else {
    settleInfoModeClose();
  }
  journalState.open = false;
  resetConsoleJournalUi();
  closeConsoleCardZoom();
  resetPlanetFocus();
  // The colony FOCUS STAGE outlives its own frame (it is module state, not a
  // frame phase): the endgame root unwinds the stack, but a stage left open
  // would re-open UNDER the player the next time they walk into «Колонии»
  // during the inspection — on the colony they descended into an hour ago.
  closeColonyFocus();
  // The board's two inspection modes and the placement free-roam: each of
  // them puts a cursor (and the right-hand dossier) on a board nobody is
  // playing on any more. The post-game inspection re-enters them on purpose.
  consoleState.inspecting = false;
  consoleState.scaleInspecting = false;
  consoleState.trackMarker = undefined;
  consoleState.freeRoam = false;
  // THE LIVE GAME'S EVENT FEED belongs to the live game. The ceremony holds
  // the foreground, so ordinary toasts do not vanish — they QUEUE, and the
  // hold releases the moment the player collapses the scene: the reward for
  // going to look at the final board was a burst of «Игрок-blue разыграл…»
  // over it, at z 12650, above every console layer. Nothing is lost — the
  // journal is the record of all of it, and the journal is one press away in
  // the post-game inspection.
  clearTransient();
  setTurn(undefined);
  // Never inherit a held handoff or a stuck shade owner: the dim belongs to
  // the surface that raised it, and every one of them has just left.
  resetSurfaceMotion();
}
