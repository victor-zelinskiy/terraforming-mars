import {expect} from 'chai';
import {runLeakDetection, leakDetectorState, stopConsoleLeakDetector} from '@/client/console/consoleLeakDetector';
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
  beforeEach(() => stopConsoleLeakDetector());
  afterEach(() => stopConsoleLeakDetector());

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
