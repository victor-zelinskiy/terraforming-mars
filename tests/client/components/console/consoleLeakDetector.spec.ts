import {expect} from 'chai';
import {runLeakDetection, leakDetectorState, stopConsoleLeakDetector, setConsoleTaskDeferred} from '@/client/console/consoleLeakDetector';
import {setMandatoryGateHeld} from '@/client/console/consoleMandatoryGate';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/*
 * A view with a `handSelect` prompt (candidate already in hand) — a SHELL-
 * SECTION task that NO surface serves in this test (the JSDOM body is empty),
 * i.e. "unserved". Used to exercise the stranded-guard DEBOUNCE that stops a
 * WORKING case's brief no-surface transition (reveal→hand hand-off) from ever
 * flashing the guard.
 */
function handSelectView(): PlayerViewModel {
  return {
    waitingFor: {type: 'card', title: 'Select a card to discard', buttonLabel: 'Discard', cards: [{name: 'Birds'}]},
    cardsInHand: [{name: 'Birds'}],
    thisPlayer: {selfReplicatingRobotsCards: []},
  } as unknown as PlayerViewModel;
}

describe('consoleLeakDetector — stranded-guard debounce', () => {
  // stopConsoleLeakDetector() resets the module-level streak + stranded state.
  // Reset the shared gate mirror too — the stranded checks rely on
  // isMandatoryGateHeld()===false, and module state is bundle-shared in mochapack.
  beforeEach(() => {
    stopConsoleLeakDetector();
    setMandatoryGateHeld(false);
  });
  afterEach(() => {
    stopConsoleLeakDetector();
    setMandatoryGateHeld(false);
  });

  it('does NOT flag stranded on a SINGLE unserved pass (kills transition flashes)', () => {
    runLeakDetection(handSelectView());
    expect(leakDetectorState.stranded, 'the first unserved pass must stay hidden').to.eq(undefined);
  });

  it('flags stranded only after CONSECUTIVE unserved passes for the same prompt', () => {
    const view = handSelectView();
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'pass 1 → still hidden').to.eq(undefined);
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'pass 2 → confirmed').to.not.eq(undefined);
    expect(leakDetectorState.stranded?.taskKind).to.eq('handSelect');
  });

  it('a served / absent pass in between RESETS the streak (a transient never builds up)', () => {
    const view = handSelectView();
    runLeakDetection(view); // streak 1
    runLeakDetection(undefined); // no prompt → clears + resets streak
    runLeakDetection(view); // streak back to 1
    expect(leakDetectorState.stranded, 'the reset prevents a 2-pass confirm').to.eq(undefined);
  });

  it('clears once the prompt goes away', () => {
    const view = handSelectView();
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded).to.not.eq(undefined);
    runLeakDetection(undefined);
    expect(leakDetectorState.stranded).to.eq(undefined);
  });
});

describe('consoleLeakDetector — a DEFERRED task is never stranded', () => {
  // Reset the shared gate mirror too — the stranded checks rely on
  // isMandatoryGateHeld()===false, and module state is bundle-shared in mochapack.
  beforeEach(() => {
    stopConsoleLeakDetector();
    setMandatoryGateHeld(false);
  });
  afterEach(() => {
    stopConsoleLeakDetector();
    setMandatoryGateHeld(false);
  });

  /*
   * A task the player set aside with B (deferred) has NO serving DOM node while
   * they browse the journal / a sheet / an inspection — the unified
   * `.con-mandatory` card is deliberately hidden off the board home. The detector
   * must read the deferred mirror, not look for a surface, or it false-positives
   * (defer the 2nd Established-Methods std project, open the journal → flash).
   */
  it('stays hidden across consecutive unserved passes while deferred', () => {
    const view = handSelectView();
    setConsoleTaskDeferred(true);
    runLeakDetection(view);
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'a deferred task must never strand').to.eq(undefined);
  });

  it('flags again once the task is no longer deferred (regression fence)', () => {
    const view = handSelectView();
    setConsoleTaskDeferred(true);
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'deferred → hidden').to.eq(undefined);
    setConsoleTaskDeferred(false);
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'un-deferred + unserved → stranded').to.not.eq(undefined);
  });

  it('stopConsoleLeakDetector resets the deferred mirror', () => {
    const view = handSelectView();
    setConsoleTaskDeferred(true);
    runLeakDetection(view);
    stopConsoleLeakDetector(); // clears the mirror
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'a reset mirror no longer suppresses').to.not.eq(undefined);
  });
});
