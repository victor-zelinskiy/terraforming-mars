import {expect} from 'chai';
import {coveredPromptSurface, runLeakDetection, leakDetectorState, stopConsoleLeakDetector, setConsoleTaskDeferred, setConsoleTaskSpacePlacement, strandedTitleOf} from '@/client/console/consoleLeakDetector';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {Message} from '@/common/logs/Message';
import {setMandatoryGateHeld, resetMandatoryGate} from '@/client/console/consoleMandatoryGate';
import {expireActiveAnimationHolds, resetAnimationHoldsForTest} from '@/client/components/presentation/animationHold';
import {resetGovScaleFocus} from '@/client/console/consoleGovScaleFocus';
import {resetConsoleHandPick} from '@/client/console/consoleHandPick';
import {enterWorkspace, resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {sittingRiseState, sittingRiseStood} from '@/client/console/parliament/sittingRise';

/*
 * «UNSERVED» IS ONLY A FACT ONCE NOTHING ELSE CLAIMS THE FOREGROUND. Every
 * early exit in `runLeakDetection` — an animation hold, the Government-Support
 * scale beat, the announce gate, a live hand pick, the deferred / space-placement
 * mirrors, a parked workspace stack — is BUNDLE-SHARED module state in mochapack.
 * A sibling's cinematic still running when these blocks start would disarm the
 * guard and read as «not stranded», so each case ESTABLISHES the idle foreground
 * instead of assuming it (the cases themselves are synchronous, so nothing can
 * re-arm a claim between this hook and the assertion).
 *
 * `resetAnimationHoldsForTest` drops MANUAL holds only — a SUPPLIER mirrors its
 * own flow, so the flows are reset by name and `expireActiveAnimationHolds` then
 * neutralises anything left true here. `idleForeground` ends with that expiry;
 * `clearForeground` (the afterEach) ends with the reset that drops it again, so
 * no expiry ever reaches a sibling.
 */
function clearForeground(): void {
  stopConsoleLeakDetector(); // the streak, the stranded state, both mirrors
  setMandatoryGateHeld(false);
  resetMandatoryGate();
  resetGovScaleFocus();
  resetConsoleHandPick();
  resetWorkspaceStack();
  resetAnimationHoldsForTest();
}
function idleForeground(): void {
  clearForeground();
  expireActiveAnimationHolds();
}

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
  beforeEach(idleForeground);
  afterEach(clearForeground);

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

describe('consoleLeakDetector — a sitting ON ITS WAY UP holds its own questions', () => {
  beforeEach(idleForeground);
  afterEach(() => {
    sittingRiseStood();
    clearForeground();
  });

  /** A question the LAW asks this seat (RX40's take): the `stage-gate` block holds it until the Parliament stands. */
  function lawQuestionView(): PlayerViewModel {
    return {
      waitingFor: {type: 'card', title: 'Take the cards', buttonLabel: 'Take', cards: [{name: 'Birds'}],
        choiceContext: {source: {kind: 'resolution', resolution: 'RDX_GREENS_AQUIFER_CONTEST'}}},
      cardsInHand: [],
      thisPlayer: {selfReplicatingRobotsCards: []},
    } as unknown as PlayerViewModel;
  }

  it('a law\'s question held while the sitting rises is never stranded (CI: RX40\'s take, a slow renderer)', () => {
    sittingRiseState.owed = true;
    const view = lawQuestionView();
    runLeakDetection(view);
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'the stage-gate holds it on purpose').to.eq(undefined);
  });

  it('…only the law\'s own question: an ordinary prompt still strands while the sitting rises', () => {
    sittingRiseState.owed = true;
    const view = handSelectView();
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'not the sitting\'s question → judged as usual').to.not.eq(undefined);
  });

  it('…and while the SITTING STANDS its walk hosts the question until its stop (CI: RX40\'s take between beats)', () => {
    enterWorkspace('parliament', {anchor: {type: 'always'}});
    const view = lawQuestionView();
    runLeakDetection(view);
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'the sitting hosts its law\'s question').to.eq(undefined);
  });

  it('with no sitting rising or standing, the law\'s question with no surface strands as usual (regression fence)', () => {
    sittingRiseState.owed = true;
    const view = lawQuestionView();
    runLeakDetection(view);
    sittingRiseStood();
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'no sitting + unserved → stranded').to.not.eq(undefined);
  });
});

describe('consoleLeakDetector — a DEFERRED task is never stranded', () => {
  beforeEach(idleForeground);
  afterEach(clearForeground);

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

/*
 * A task's nested SelectSpace answered on the BOARD. The FINAL GREENERY prompt
 * is the shape that shipped the bug: an OrOptions ('Place any final greenery
 * from plants') whose first branch is a SelectSpace. Once the player picks that
 * branch the shell unmounts the task host (`taskSpacePending !== undefined` in
 * its v-if) and hands the answer to board placement — but `waitingFor` is still
 * the OrOptions, so the task stays `choice` (not the shell-native `space`) and
 * NO serving surface matches. Without the mirror the amber guard covered the
 * board ~2 s into every final-greenery placement.
 */
function finalGreeneryView(): PlayerViewModel {
  return {
    waitingFor: {
      type: 'or',
      title: 'Place any final greenery from plants',
      buttonLabel: 'Confirm',
      options: [
        {type: 'space', title: 'Select space for greenery tile', spaces: ['05']},
        {type: 'option', title: 'Don\'t place a greenery'},
      ],
    },
    cardsInHand: [],
    thisPlayer: {selfReplicatingRobotsCards: []},
  } as unknown as PlayerViewModel;
}

describe('consoleLeakDetector — a nested-space placement is never stranded', () => {
  beforeEach(idleForeground);
  afterEach(clearForeground);

  it('WOULD strand the final-greenery choice while no surface is mounted (the bug)', () => {
    const view = finalGreeneryView();
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded?.taskKind, 'fence: the classification that fooled the detector').to.eq('choice');
  });

  it('stays hidden across consecutive passes while the board serves the branch', () => {
    const view = finalGreeneryView();
    setConsoleTaskSpacePlacement(true);
    runLeakDetection(view);
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'placing a final greenery must never strand').to.eq(undefined);
  });

  it('flags again once the placement is over (regression fence)', () => {
    const view = finalGreeneryView();
    setConsoleTaskSpacePlacement(true);
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'placing → hidden').to.eq(undefined);
    setConsoleTaskSpacePlacement(false);
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'no placement + unserved → stranded').to.not.eq(undefined);
  });

  it('stopConsoleLeakDetector resets the placement mirror', () => {
    const view = finalGreeneryView();
    setConsoleTaskSpacePlacement(true);
    runLeakDetection(view);
    stopConsoleLeakDetector(); // clears the mirror
    runLeakDetection(view);
    runLeakDetection(view);
    expect(leakDetectorState.stranded, 'a reset mirror no longer suppresses').to.not.eq(undefined);
  });
});

describe('consoleLeakDetector — the guard panel reads a prompt title as every surface does', () => {
  it('a Message title gets its parameters substituted (never the raw `${0}` template)', () => {
    const title: Message = {message: 'Add ${0} delegates to a resolution', data: [{type: LogMessageDataType.RAW_STRING, value: '2'}]};
    expect(strandedTitleOf(title)).to.eq('Add 2 delegates to a resolution');
    // …and the model's own message is left alone — the pass translates a COPY.
    expect(title.message).to.eq('Add ${0} delegates to a resolution');
  });

  it('a plain string is looked up as text; an absent or empty title is an empty line', () => {
    expect(strandedTitleOf('Select a card to discard')).to.eq('Select a card to discard');
    expect(strandedTitleOf('')).to.eq('');
    expect(strandedTitleOf(undefined)).to.eq('');
  });
});

/*
 * CHECK 3 — A COVERED PROMPT (the «Корпоративные архивы» blocker of
 * 2026-10-18): the pick was MOUNTED, owned the pad and answered every press,
 * while the start scene — same layer, later in the shell — was painted over it.
 * The stranded check calls that served (`.con-start` is a serving surface), so
 * only STACKING ORDER can tell. JSDOM has no layout: boxes are stubbed, the
 * z-index and visibility come from inline styles (its computed style reads them).
 */
describe('consoleLeakDetector — a prompt surface painted over by a full-bleed scene', () => {
  let root: HTMLElement;
  const box = (el: HTMLElement) => {
    el.getBoundingClientRect = () => ({left: 0, top: 0, right: 1920, bottom: 1080, width: 1920, height: 1080, x: 0, y: 0, toJSON: () => ({})}) as DOMRect;
    el.getClientRects = () => [el.getBoundingClientRect()] as unknown as DOMRectList;
  };
  const layer = (cls: string, z = 11480): HTMLElement => {
    const el = document.createElement('div');
    el.className = cls;
    el.style.position = 'fixed';
    el.style.zIndex = String(z);
    box(el);
    return el;
  };
  const deckPickView = (): PlayerViewModel => ({
    waitingFor: {type: 'card', title: 'Select 2 cards', buttonLabel: 'Keep', cards: [{name: 'Birds'}], min: 2, max: 2,
      deckPickPrompt: {revealed: 7, min: 2, max: 2, origin: 'deck', mode: 'keep'}},
    cardsInHand: [],
    thisPlayer: {selfReplicatingRobotsCards: []},
  } as unknown as PlayerViewModel);

  beforeEach(() => {
    idleForeground();
    root = document.createElement('div');
    root.className = 'con-root';
    document.body.appendChild(root);
  });
  afterEach(() => {
    root.remove();
    clearForeground();
  });

  it('the scene LATER on the same layer covers a standalone band — named, and reported on the 2nd pass', () => {
    root.appendChild(layer('con-deckpick'));
    root.appendChild(layer('con-start'));
    expect(coveredPromptSurface()).to.eq('.con-deckpick ← .con-start');
    runLeakDetection(deckPickView());
    expect(leakDetectorState.covered, 'pass 1 — a hand-off frame never reports').to.eq(undefined);
    runLeakDetection(deckPickView());
    expect(leakDetectorState.covered).to.eq('.con-deckpick ← .con-start');
  });

  it('a step EMBEDDED in the scene is its host, not its cover', () => {
    const scene = layer('con-start');
    const zone = document.createElement('div');
    zone.className = 'con-start__embed';
    const pick = document.createElement('div');
    pick.className = 'con-deckpick';
    box(pick);
    zone.appendChild(pick);
    scene.appendChild(zone);
    root.appendChild(scene);
    expect(coveredPromptSurface()).to.eq(undefined);
  });

  it('a YIELDED scene (visibility hidden) or one stacked below covers nothing', () => {
    root.appendChild(layer('con-task-host'));
    const scene = layer('con-start');
    scene.style.visibility = 'hidden';
    root.appendChild(scene);
    expect(coveredPromptSurface(), 'yielded').to.eq(undefined);
    scene.style.visibility = '';
    root.insertBefore(scene, root.firstChild);
    expect(coveredPromptSurface(), 'earlier in the document on the same layer').to.eq(undefined);
    scene.style.zIndex = '11470';
    root.appendChild(scene);
    expect(coveredPromptSurface(), 'a lower layer').to.eq(undefined);
  });

  it('clears once the surface is uncovered, and with the prompt gone', () => {
    root.appendChild(layer('con-decision'));
    const scene = layer('con-start');
    root.appendChild(scene);
    runLeakDetection(deckPickView());
    runLeakDetection(deckPickView());
    expect(leakDetectorState.covered).to.not.eq(undefined);
    scene.style.visibility = 'hidden';
    runLeakDetection(deckPickView());
    expect(leakDetectorState.covered).to.eq(undefined);
    scene.style.visibility = '';
    runLeakDetection(undefined);
    expect(leakDetectorState.covered).to.eq(undefined);
  });
});
