import {expect} from 'chai';
import {taskFor, SHELL_SECTION_KINDS, NATIVE_KINDS, taskServedByHost, corpFirstActionInStartFlow} from '@/client/console/consoleTaskRouter';
import {runLeakDetection, leakDetectorState} from '@/client/console/consoleLeakDetector';
import {beginAnimationHold, isAnimationHoldActive, resetAnimationHoldsForTest} from '@/client/components/presentation/animationHold';
import {setMandatoryGateHeld, resetMandatoryGate} from '@/client/console/consoleMandatoryGate';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/**
 * The corporation's MANDATORY FIRST ACTION has TWO serving surfaces that never
 * compete:
 *  · inside the START FLOW (`corpFirstActionInStartFlow` — generation 1, zero
 *    actions taken) it is the Game Start Workspace's own final conditional
 *    stage «ПЕРВОЕ ДЕЙСТВИЕ» — the confirm modal must never appear there;
 *  · outside it (a mid-game merger chain acquiring a corp that still owes its
 *    opening move) the dedicated confirm modal remains the serving surface.
 * The prompt arrives as an OrOptions with NO title of its own — so it MUST be
 * routed by its structural marker; the untitled prompt is exactly what used to
 * fall through to the honest stranded guard.
 */
function corpActionView(opts: {generation: number}): PlayerViewModel {
  return {
    id: 'p1',
    cardsInHand: [],
    game: {generation: opts.generation},
    thisPlayer: {
      color: 'red',
      tableau: [{name: 'Tharsis Republic'}],
      selfReplicatingRobotsCards: [],
    },
    pendingInitialActions: ['Tharsis Republic'],
    waitingFor: {
      type: 'or',
      // The REAL prompt carries no title (Player.takeAction builds a bare
      // OrOptions) — the client renders «Select one option» for it.
      title: '',
      options: [],
      startGamePrompt: {kind: 'corporationInitialAction'},
    },
  } as unknown as PlayerViewModel;
}

/** The START-FLOW shape: generation 1 — the start of the game. */
const startFlowView = () => corpActionView({generation: 1});
/** The MID-GAME shape: a merger chain long past the start. */
const midGameView = () => corpActionView({generation: 3});

describe('corporation first action (console routing)', () => {
  // Module state (animation holds + the mandatory gate) is BUNDLE-SHARED in
  // mochapack — the leak detector now consults isAnimationHoldActive() and the
  // gate, so clear any stray state a sibling spec may have left, each case.
  beforeEach(() => {
    resetAnimationHoldsForTest();
    resetMandatoryGate();
  });
  afterEach(() => {
    resetAnimationHoldsForTest();
    resetMandatoryGate();
  });

  it('routes the untitled corp-action OrOptions by its structural marker, never the host', () => {
    const view = startFlowView();
    const task = taskFor(view);
    expect(task?.kind).to.eq('corpFirstAction');
    expect(NATIVE_KINDS.has('corpFirstAction')).to.be.true;
    expect(SHELL_SECTION_KINDS.has('corpFirstAction'), 'the mid-game modal path stays a shell section').to.be.true;
    expect(taskServedByHost(view)).to.eq(undefined);
  });

  it('the START FLOW discriminator is domain state: generation 1 IS the start of the game', () => {
    expect(corpFirstActionInStartFlow(startFlowView()), 'gen 1 → the start workspace stage').to.be.true;
    expect(corpFirstActionInStartFlow(midGameView()), 'mid-game merger chain → the confirm modal').to.be.false;
    // Deliberately NOT actions-counted: this fork counts the deferred corp
    // play and every prelude as taken actions, so the counter is already
    // past zero when the first-action prompt stands (the live-game finding).
    expect(corpFirstActionInStartFlow(corpActionView({generation: 2}))).to.be.false;
  });

  it('inside the start flow the GAME START WORKSPACE is the serving surface (never the modal)', () => {
    const view = startFlowView();
    document.body.innerHTML = '';
    runLeakDetection(view);
    runLeakDetection(view); // the guard is debounced by 2 consecutive passes
    expect(leakDetectorState.stranded?.taskKind).to.eq('corpFirstAction');

    // The start workspace on screen IS the surface — the registry row
    // (`WORKSPACE_KINDS.start.serves` includes 'corpFirstAction') derives it;
    // no modal is required anywhere in the start flow.
    const scene = document.createElement('div');
    scene.className = 'con-start';
    scene.getClientRects = () => ([{}] as unknown as DOMRectList);
    document.body.appendChild(scene);
    runLeakDetection(view);
    expect(leakDetectorState.stranded).to.eq(undefined);
    document.body.innerHTML = '';
  });

  it('mid-game (merger chain) the dedicated confirm modal is the serving surface', () => {
    const view = midGameView();
    document.body.innerHTML = '';
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded?.taskKind).to.eq('corpFirstAction');

    const modal = document.createElement('div');
    modal.className = 'con-composer con-composer--corpfirst';
    modal.getClientRects = () => ([{}] as unknown as DOMRectList);
    document.body.appendChild(modal);
    runLeakDetection(view);
    expect(leakDetectorState.stranded).to.eq(undefined);
    document.body.innerHTML = '';
  });

  it('does NOT strand the corp-action prompt while a critical animation owns the foreground', () => {
    const view = midGameView();
    // No serving surface on screen — but a 'notification-only' hold is laying
    // cards into the dock. The confirm is deliberately withheld until it
    // settles, so the prompt is legitimately held BEHIND the beat.
    document.body.innerHTML = '';
    const hold = beginAnimationHold('test-corp-intake', {scope: 'notification-only'});
    expect(isAnimationHoldActive()).to.be.true;
    runLeakDetection(view);
    runLeakDetection(view); // even past the 2-pass debounce
    expect(leakDetectorState.stranded).to.eq(undefined);

    // Once the beat settles and there is STILL no serving surface, the honest
    // guard returns (the ceiling-bounded hold can never hide a real strand).
    hold.release();
    expect(isAnimationHoldActive()).to.be.false;
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded?.taskKind).to.eq('corpFirstAction');

    resetAnimationHoldsForTest();
    document.body.innerHTML = '';
  });

  it('does NOT strand the corp-action prompt while the mandatory gate holds it announced', () => {
    const view = midGameView();
    // The gate holds the mid-game corp first action CLOSED — it is announced
    // (the plate + the chip status) and opens only on the player's press. With
    // no surface rendered the prompt is legitimately served by the
    // announcement, never stranded. (Inside the START FLOW there is no beat at
    // all — the workspace stage is the presentation.)
    document.body.innerHTML = '';
    setMandatoryGateHeld(true);
    runLeakDetection(view);
    runLeakDetection(view); // past the 2-pass debounce
    expect(leakDetectorState.stranded).to.eq(undefined);

    // Once the player opens it (gate released) and there is STILL no surface,
    // the honest guard returns.
    setMandatoryGateHeld(false);
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded?.taskKind).to.eq('corpFirstAction');

    resetMandatoryGate();
    document.body.innerHTML = '';
  });
});
