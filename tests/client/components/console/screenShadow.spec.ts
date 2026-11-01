import {expect} from 'chai';
import {leakDetectorState, registerScreenShadowContext, runLeakDetection, stopConsoleLeakDetector} from '@/client/console/consoleLeakDetector';
import {resetScreenShadowLog, screenShadowLog, SCREEN_SHADOW_CONFIRM_TICKS} from '@/client/console/screenDirector';
import {setMandatoryGateHeld, resetMandatoryGate} from '@/client/console/consoleMandatoryGate';
import {beginAnimationHold, expireActiveAnimationHolds, resetAnimationHoldsForTest} from '@/client/components/presentation/animationHold';
import {resetGovScaleFocus} from '@/client/console/consoleGovScaleFocus';
import {resetConsoleHandPick} from '@/client/console/consoleHandPick';
import {enterWorkspace, resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/*
 * THE SCREEN SHADOW'S POSITIVE CONTROLS — the whole path the e2e harvest relies on (the shell's context → the leak
 * detector's 1 Hz pass → the DOM probe → the verdict → the confirmation → the `[screen-shadow]` line and the stats),
 * driven with a defect PUT IN on purpose. A suite that files no finding proves the product right only if these are
 * green: each class the shadow exists for is caught here, and each legitimate wait is NOT.
 *
 * The foreground is established idle before every case (the module state is bundle-shared — see the stranded-guard
 * spec beside this one), and every DOM node a case paints is removed after it.
 */
function clearForeground(): void {
  stopConsoleLeakDetector();
  setMandatoryGateHeld(false);
  resetMandatoryGate();
  resetGovScaleFocus();
  resetConsoleHandPick();
  resetWorkspaceStack();
  resetAnimationHoldsForTest();
  registerScreenShadowContext(undefined);
  resetScreenShadowLog();
}

/** A `handSelect` prompt — by the table, only the HAND may serve it. */
function handSelectView(promptId = 7): PlayerViewModel {
  return {
    waitingFor: {type: 'card', title: 'Select a card to discard', buttonLabel: 'Discard', cards: [{name: 'Birds'}], promptId},
    cardsInHand: [{name: 'Birds'}],
    thisPlayer: {selfReplicatingRobotsCards: []},
  } as unknown as PlayerViewModel;
}

describe('screen shadow — positive controls through the leak detector', () => {
  const painted: Array<HTMLElement> = [];
  const warns: Array<string> = [];
  let realWarn: typeof console.warn;
  let admission = '';
  let startOwned = false;

  /** A node with layout — what the probe counts as PAINTED. */
  function paint(cls: string): HTMLElement {
    const el = document.createElement('div');
    el.className = cls;
    el.getBoundingClientRect = () => ({left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => ({})}) as DOMRect;
    el.getClientRects = () => [el.getBoundingClientRect()] as unknown as DOMRectList;
    document.body.appendChild(el);
    painted.push(el);
    return el;
  }
  function passes(view: PlayerViewModel, n: number): void {
    for (let i = 0; i < n; i++) {
      runLeakDetection(view);
    }
  }
  const shadowLines = () => warns.filter((w) => w.startsWith('[screen-shadow]'));

  beforeEach(() => {
    clearForeground();
    expireActiveAnimationHolds();
    admission = '';
    startOwned = false;
    registerScreenShadowContext(() => ({startOwned, admission}));
    warns.length = 0;
    realWarn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      warns.push(args.map(String).join(' '));
    };
  });
  afterEach(() => {
    console.warn = realWarn;
    painted.splice(0).forEach((el) => el.remove());
    clearForeground();
  });

  it('with no context from the shell nothing is judged — and the stats SAY so (a silent shadow is visible)', () => {
    registerScreenShadowContext(undefined);
    passes(handSelectView(), 4);
    expect(screenShadowLog.stats.verdicts['none:no-context']).eq(4);
    expect(screenShadowLog.judged).eq(0);
    expect(shadowLines()).deep.eq([]);
  });

  it('UNSERVED — nothing paints: confirmed on the third pass, logged ONCE, counted every pass', () => {
    const view = handSelectView();
    passes(view, SCREEN_SHADOW_CONFIRM_TICKS - 1);
    expect(screenShadowLog.findings).length(0);
    passes(view, 3);
    expect(screenShadowLog.findings).length(1);
    expect(screenShadowLog.findings[0]).include({kind: 'unserved', prompt: 'handSelect#7'});
    expect(shadowLines()).length(1);
    expect(shadowLines()[0]).match(/^\[screen-shadow\] unserved — expected «hand», on screen «nothing» for «handSelect#7» \{/);
    expect(screenShadowLog.stats.verdicts.unserved).eq(SCREEN_SHADOW_CONFIRM_TICKS + 2);
    expect(screenShadowLog.judged).eq(SCREEN_SHADOW_CONFIRM_TICKS + 2);
  });

  it('MISSERVED — a FOREIGN workspace stands (the class no other net judges): named with what stood', () => {
    enterWorkspace('colonies');
    paint('con-colonies');
    passes(handSelectView(), SCREEN_SHADOW_CONFIRM_TICKS);
    expect(screenShadowLog.findings).length(1);
    expect(screenShadowLog.findings[0]).deep.include({kind: 'misserved', present: ['colonies'], expected: ['hand']});
  });

  it('AGREE — the expected workspace stands and paints: no finding, the observed owner counted', () => {
    enterWorkspace('hand');
    paint('con-hand');
    passes(handSelectView(), 5);
    expect(screenShadowLog.findings).length(0);
    expect(screenShadowLog.stats.verdicts.agree).eq(5);
    expect(screenShadowLog.stats.owners.handSelect).deep.eq({hand: 5});
  });

  it('a root that paints WITHOUT its frame does not count — the stack decides presence (two kinds share a root)', () => {
    paint('con-hand'); // no frame entered
    passes(handSelectView(), SCREEN_SHADOW_CONFIRM_TICKS);
    expect(screenShadowLog.findings[0]?.kind).eq('unserved');
  });

  it('HELD — the announce gate and the shell\'s admission block explain the wait, each with its run length', () => {
    setMandatoryGateHeld(true);
    passes(handSelectView(), 4);
    setMandatoryGateHeld(false);
    admission = 'remote-landing';
    passes(handSelectView(), 2);
    expect(screenShadowLog.findings).length(0);
    expect(screenShadowLog.stats.held).deep.eq({'announce-gate': 4, 'admit:remote-landing': 2});
    expect(screenShadowLog.stats.heldMaxRun['announce-gate']).eq(4);
    expect(screenShadowLog.stats.masked.handSelect).deep.eq({'held:announce-gate | nothing': 4, 'held:admit:remote-landing | nothing': 2});
  });

  it('a hold HIDES nothing from the stats — a foreign surface standing under it is recorded beside the reason', () => {
    enterWorkspace('colonies');
    paint('con-colonies');
    setMandatoryGateHeld(true);
    passes(handSelectView(), 3);
    expect(screenShadowLog.findings, 'a held prompt files no finding').length(0);
    expect(screenShadowLog.stats.masked.handSelect).deep.eq({'held:announce-gate | colonies': 3});
  });

  it('a BLOCKING hold holds; a NOTIFICATION-ONLY hold does not — while the stranded check stays masked by it', () => {
    const blocking = beginAnimationHold('control-blocking');
    passes(handSelectView(), 4);
    expect(screenShadowLog.findings).length(0);
    expect(screenShadowLog.stats.held['animation-hold']).eq(4);
    blocking.release();
    resetScreenShadowLog();
    beginAnimationHold('control-story', {scope: 'notification-only'});
    passes(handSelectView(), SCREEN_SHADOW_CONFIRM_TICKS);
    expect(leakDetectorState.stranded, 'the stranded check counts ANY hold').eq(undefined);
    expect(screenShadowLog.findings[0]?.kind, 'the shadow does not wait on a story').eq('unserved');
  });

  it('BEAT — a transient scene explains the wait and is counted by selector', () => {
    paint('con-reveal');
    passes(handSelectView(), 4);
    expect(screenShadowLog.findings).length(0);
    expect(screenShadowLog.stats.beats['.con-reveal']).eq(4);
  });

  it('the START\'s question is the start director\'s — counted as out of scope, never judged', () => {
    startOwned = true;
    passes(handSelectView(), 4);
    expect(screenShadowLog.stats.verdicts['none:start-owned']).eq(4);
    expect(screenShadowLog.findings).length(0);
  });

  it('a different prompt id is a different finding; the same one is never logged twice', () => {
    passes(handSelectView(7), 6);
    passes(handSelectView(8), 3);
    expect(screenShadowLog.findings.map((f) => f.prompt)).deep.eq(['handSelect#7', 'handSelect#8']);
  });
});
