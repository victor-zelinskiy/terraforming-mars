import {expect} from 'chai';
import {taskFor, SHELL_SECTION_KINDS, NATIVE_KINDS, taskServedByHost} from '@/client/console/consoleTaskRouter';
import {runLeakDetection, leakDetectorState} from '@/client/console/consoleLeakDetector';
import {beginAnimationHold, isAnimationHoldActive, resetAnimationHoldsForTest} from '@/client/components/presentation/animationHold';
import {setMandatoryGateHeld, resetMandatoryGate} from '@/client/console/consoleMandatoryGate';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/**
 * The corporation's MANDATORY FIRST ACTION is a FIRST-TURN prompt served by
 * its DEDICATED confirm modal — ConsoleCorpFirstActionConfirm, the play
 * composer's mandatory sibling (never the start scene, never the generic task
 * host, and no longer the «Разыграно» table's action mode). It arrives as an
 * OrOptions with NO title of its own — so it MUST be routed by its structural
 * marker; the untitled prompt is exactly what used to fall through to the
 * honest stranded guard («This prompt is not available in console mode yet»).
 */
function corpActionView(): PlayerViewModel {
  return {
    id: 'p1',
    cardsInHand: [],
    thisPlayer: {color: 'red', tableau: [{name: 'Tharsis Republic'}], selfReplicatingRobotsCards: []},
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

  it('routes the untitled corp-action OrOptions to the dedicated modal, not the host', () => {
    const view = corpActionView();
    const task = taskFor(view);
    expect(task?.kind).to.eq('corpFirstAction');
    // Served by a SHELL surface (the dedicated modal), never the generic host.
    expect(SHELL_SECTION_KINDS.has('corpFirstAction')).to.be.true;
    expect(NATIVE_KINDS.has('corpFirstAction')).to.be.true;
    expect(taskServedByHost(view)).to.eq(undefined);
  });

  it('the leak detector accepts the dedicated first-action modal as its serving surface', () => {
    const view = corpActionView();
    // Nothing rendered → the honest guard (this is what the player saw when
    // the serving surface was closed by the hard-block race).
    document.body.innerHTML = '';
    runLeakDetection(view);
    runLeakDetection(view); // the guard is debounced by 2 consecutive passes
    expect(leakDetectorState.stranded?.taskKind).to.eq('corpFirstAction');

    // The modal on screen IS the surface — the guard must clear. (JSDOM has no
    // layout, so the detector's rect probe is stubbed: it only asks whether the
    // node actually paints.)
    const modal = document.createElement('div');
    modal.className = 'con-composer con-composer--corpfirst';
    modal.getClientRects = () => ([{}] as unknown as DOMRectList);
    document.body.appendChild(modal);
    runLeakDetection(view);
    expect(leakDetectorState.stranded).to.eq(undefined);
    document.body.innerHTML = '';
  });

  it('does NOT strand the corp-action prompt while a critical animation owns the foreground', () => {
    const view = corpActionView();
    // No serving surface on screen — but the drawn-prelude card intake (a
    // 'notification-only' hold) is laying cards into the dock. The corp confirm
    // is deliberately withheld until it settles, so the prompt is legitimately
    // held BEHIND the beat — it must NOT flash the honest stranded guard.
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
    const view = corpActionView();
    // The gate holds the corp first action CLOSED — it is announced (the top
    // card + the chip status) and opens only on B. With no surface rendered the
    // prompt is legitimately served by the announcement, never stranded.
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
