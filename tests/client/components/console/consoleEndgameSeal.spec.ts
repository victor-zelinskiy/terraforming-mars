import {expect} from 'chai';
import {sealLiveGameSurfaces} from '@/client/console/endgame/consoleEndgameSeal';
import {
  consoleState, rememberCardBrowserPicks, recallCardBrowserPicks,
} from '@/client/console/consoleRouter';
import {
  enterWorkspace, collapseWorkspaceStack, resetWorkspaceStack,
  workspaceStackDepth, workspaceStackCollapsed, workspaceFrameIndex,
} from '@/client/console/consoleWorkspaceStack';
import {infoModeState, openInfoMode, closeInfoMode, settleInfoModeClose} from '@/client/console/infoModeState';
import {journalState} from '@/client/components/journal/journalState';
import {consoleJournalUi, resetConsoleJournalUi} from '@/client/console/consoleJournalState';
import {consoleCardZoom, openConsoleCardZoom, closeConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {colonyFocusState, openColonyFocus, closeColonyFocus} from '@/client/console/consoleColoniesModel';
import {planetFocusState, resetPlanetFocus} from '@/client/console/planetFocus';
import {surfaceMotionState, addShadeOwner, resetSurfaceMotion} from '@/client/console/surfaceMotion/surfaceMotionState';
import {notificationState, pushTransient, clearTransient} from '@/client/components/notifications/notificationState';
import {NotificationModel} from '@/client/components/notifications/notificationTypes';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {ColonyName} from '@/common/colonies/ColonyName';

const zoomCard = (name: CardName): CardModel => ({name} as CardModel);
const toast = (id: string, kind: 'normal' | 'negative'): NotificationModel => ({
  id, kind, variant: 'generic', priority: 1, typeLabelKey: 'Event',
  pills: [], detailCount: 0, generation: 1, ttl: 6000,
} as unknown as NotificationModel);

/**
 * THE END-OF-GAME SEAL (`consoleEndgameSeal.ts`).
 *
 * Phase.END arrives from the POLL, so whatever the player had open at that
 * instant is still open one frame later — and the scoring scene is one of the
 * LOWEST layers in the shell (11480). The quick wheel (11500), a sheet, Info
 * Mode (11560) and the hand pack (11645) therefore paint OVER the finale, and
 * because the workspace consumes the whole pad while it stands, none of them
 * can be dismissed any more: an open action wheel becomes a lid welded over
 * the final scoring.
 *
 * This spec is the WORKLIST of that boundary: each surface is named, so
 * adding one to the shell without adding it here fails loudly instead of
 * shipping as a lock somebody discovers at their own finale.
 */
describe('consoleEndgameSeal', () => {
  const clean = () => {
    resetWorkspaceStack();
    closeInfoMode();
    settleInfoModeClose();
    closeConsoleCardZoom();
    closeColonyFocus();
    resetConsoleJournalUi();
    resetPlanetFocus();
    resetSurfaceMotion();
    clearTransient();
    journalState.open = false;
    consoleState.quick = undefined;
    consoleState.confirm = undefined;
    consoleState.inspecting = false;
    consoleState.scaleInspecting = false;
    consoleState.trackMarker = undefined;
    consoleState.freeRoam = false;
    consoleState.task.deferred = false;
    consoleState.sale.active = false;
    consoleState.sale.selected = [];
    consoleState.select.selected = [];
    consoleState.select.suitableOnly = true;
  };

  beforeEach(clean);
  after(clean);

  it('closes the QUICK WHEEL — the surface that welded itself over the finale', () => {
    consoleState.quick = 'actions';
    sealLiveGameSurfaces();
    expect(consoleState.quick).to.eq(undefined);
  });

  it('closes the pass / heat CONFIRM and sell-patents mode', () => {
    consoleState.confirm = 'pass';
    consoleState.sale.active = true;
    consoleState.sale.selected = [CardName.ANTS];
    sealLiveGameSurfaces();
    expect(consoleState.confirm, 'confirm').to.eq(undefined);
    expect(consoleState.sale.active, 'sale').to.eq(false);
    expect(consoleState.sale.selected, 'picks').to.deep.eq([]);
  });

  it('pops the SHEET-shaped frames and leaves the screen under them', () => {
    enterWorkspace('milestones');
    expect(consoleState.sheet, 'precondition').to.eq('milestones');
    sealLiveGameSurfaces();
    expect(consoleState.sheet).to.eq(undefined);
  });

  it('discards a PARKED flow — there is no game left to resume it into', () => {
    enterWorkspace('colonies');
    collapseWorkspaceStack();
    expect(workspaceStackCollapsed(), 'precondition').to.eq(true);
    sealLiveGameSurfaces();
    expect(workspaceStackCollapsed()).to.eq(false);
  });

  it('closes INFORMATION MODE — it would pre-reveal the totals the count narrates', () => {
    openInfoMode('red', false);
    expect(infoModeState.open, 'precondition').to.eq(true);
    sealLiveGameSurfaces();
    expect(infoModeState.open).to.eq(false);
  });

  /*
   * A LATCH BELONGS TO THE WORK, NOT TO THE ATTEMPT.
   *
   * `closeInfoMode` latches a DISMISS TAIL (`closing`), released by the
   * panel's own after-leave hook — which cannot fire for a panel that was
   * never mounted. Sealing an already-closed Info Mode therefore pinned
   * `closing` true for the rest of the session, and `con-root--rail-replaced`
   * reads it: the trophy gallery stayed dark for the WHOLE post-game
   * inspection — the exact defect `endgameStageUp` exists to prevent. Caught
   * by `console-endgame.spec.ts` § «the whole HUD comes back».
   */
  it('leaves NO dismiss tail behind when Information Mode was never open', () => {
    expect(infoModeState.open, 'precondition').to.eq(false);
    sealLiveGameSurfaces();
    expect(infoModeState.closing, 'the closing latch').to.eq(false);
  });

  it('…and still hands an OPEN Information Mode to its own leave hook', () => {
    openInfoMode('red', false);
    sealLiveGameSurfaces();
    expect(infoModeState.open, 'closed').to.eq(false);
    // The panel IS mounted here, so its after-leave hook owns the release —
    // settling it from the seal would drop `--info` mid-transition.
    expect(infoModeState.closing, 'the leave still owns its tail').to.eq(true);
    settleInfoModeClose();
  });

  it('closes the JOURNAL and its local layers', () => {
    journalState.open = true;
    consoleJournalUi.filterOpen = true;
    consoleJournalUi.inspectOpen = true;
    consoleJournalUi.peekActive = true;
    sealLiveGameSurfaces();
    expect(journalState.open, 'panel').to.eq(false);
    expect(consoleJournalUi.filterOpen, 'filter').to.eq(false);
    expect(consoleJournalUi.inspectOpen, 'inspect').to.eq(false);
    expect(consoleJournalUi.peekActive, 'peek').to.eq(false);
  });

  it('closes the fullscreen card VIEWER', () => {
    openConsoleCardZoom([zoomCard(CardName.ANTS)], 0);
    expect(consoleCardZoom.card, 'precondition').to.not.eq(undefined);
    sealLiveGameSurfaces();
    expect(consoleCardZoom.card).to.eq(undefined);
  });

  it('closes the colony FOCUS STAGE — module state that outlives its own frame', () => {
    openColonyFocus(ColonyName.CERES, 'trade');
    expect(colonyFocusState.open, 'precondition').to.eq(true);
    sealLiveGameSurfaces();
    expect(colonyFocusState.open, 'stage').to.eq(false);
    expect(colonyFocusState.colonyName, 'carried colony').to.eq('');
  });

  it('leaves both board INSPECTION modes and the placement free-roam', () => {
    consoleState.inspecting = true;
    consoleState.scaleInspecting = true;
    consoleState.trackMarker = 'temperature';
    consoleState.freeRoam = true;
    sealLiveGameSurfaces();
    expect(consoleState.inspecting, 'cells').to.eq(false);
    expect(consoleState.scaleInspecting, 'scales').to.eq(false);
    expect(consoleState.trackMarker, 'marker').to.eq(undefined);
    expect(consoleState.freeRoam, 'free roam').to.eq(false);
  });

  it('drops the prompt-scoped picks and the deferred-task flag', () => {
    consoleState.select.selected = [CardName.ANTS];
    consoleState.select.suitableOnly = false;
    consoleState.task.deferred = true;
    rememberCardBrowserPicks('k', [CardName.ANTS]);
    sealLiveGameSurfaces();
    expect(consoleState.select.selected, 'hand select').to.deep.eq([]);
    expect(consoleState.select.suitableOnly, 'suitable filter').to.eq(true);
    expect(consoleState.task.deferred, 'deferred').to.eq(false);
    expect(recallCardBrowserPicks('k'), 'browser picks').to.deep.eq([]);
  });

  /*
   * The ceremony HOLDS the foreground, so live-game toasts do not vanish —
   * they QUEUE, and the hold releases the moment the player collapses the
   * scene. The reward for going to look at the final board was a burst of
   * stale «разыграл карту» cards over it, at z 12650 — above every console
   * layer. Nothing is lost: the journal is the record, and it is one press
   * away in the post-game inspection.
   */
  it('drains the live-game NOTIFICATION feed, visible and queued alike', () => {
    pushTransient(toast('seal-a', 'normal'));
    pushTransient(toast('seal-b', 'negative'));
    expect(notificationState.transient.length + notificationState.queue.length,
      'precondition').to.be.greaterThan(0);
    sealLiveGameSurfaces();
    expect(notificationState.transient, 'visible').to.deep.eq([]);
    expect(notificationState.queue, 'queued').to.deep.eq([]);
    expect(notificationState.turn, 'the turn card').to.eq(undefined);
  });

  /*
   * PLANET FOCUS IS ASKED TO END, NOT TO VANISH. The module owns WHEN the
   * mode ends; the BOARD owns its geometry — the camera moved in, and the
   * pre-focus framing is replayed on the `exiting` phase. A hard
   * `resetPlanetFocus()` jumps straight to `idle`, so nothing replays it and
   * nothing re-derives it either (the stage's box does not change across the
   * boundary, so no resize reaches the fit): the player collapsed the results
   * onto a planet zoomed in, clipped by both bars, arcs cut off.
   */
  it('ENDS an engaged planet focus through its own exit (never a hard drop)', () => {
    planetFocusState.phase = 'active';
    sealLiveGameSurfaces();
    expect(planetFocusState.phase, 'the exit has begun').to.eq('exit-prep');
  });

  it('…and hard-drops it when nothing is engaged — the case the reset is for', () => {
    planetFocusState.phase = 'idle';
    planetFocusState.heldParams = {temperature: -30, oxygenLevel: 0, oceans: 0, venusScaleLevel: 0};
    sealLiveGameSurfaces();
    expect(planetFocusState.phase, 'phase').to.eq('idle');
    expect(planetFocusState.heldParams, 'no frozen parameters survive').to.eq(undefined);
  });

  it('releases every SHADE OWNER — the dim belongs to surfaces that have all left', () => {
    addShadeOwner('quick');
    expect(surfaceMotionState.shadeOwners.length, 'precondition').to.be.greaterThan(0);
    sealLiveGameSurfaces();
    expect(surfaceMotionState.shadeOwners.length).to.eq(0);
  });

  it('is IDEMPOTENT — a watcher may fire it twice, and a reload starts sealed', () => {
    consoleState.quick = 'basics';
    sealLiveGameSurfaces();
    sealLiveGameSurfaces();
    expect(consoleState.quick).to.eq(undefined);
  });

  /*
   * The seal is NOT a stack unwind: the endgame root's own verb
   * (`enterWorkspace`) does that, and doing it here as well would make two
   * writers of the same fact. What the seal owes the stack is only the PARK.
   */
  it('leaves the live stack to the endgame root itself', () => {
    enterWorkspace('colonies');
    const before = workspaceStackDepth();
    sealLiveGameSurfaces();
    expect(workspaceStackDepth(), 'depth').to.eq(before);
    expect(workspaceFrameIndex('colonies'), 'frame').to.not.eq(-1);
  });
});
