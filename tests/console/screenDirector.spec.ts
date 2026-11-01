import {expect} from 'chai';
import {
  ALL_WORKSPACE_KINDS, BEAT_SURFACES, OWNER_SURFACES, SCREEN_SHADOW_CONFIRM_TICKS, ScreenShadowInput,
  SCREEN_TABLE_KINDS, advanceScreenShadowStreak, expectedScreenOwners, hostableStep, noteScreenShadowPass, recordScreenShadowFinding,
  resetScreenShadowLog, screenPromptShape, screenPromptToken, screenShadowLog, screenShadowVerdict,
} from '../../src/client/console/screenDirector';
import {ConsoleTask} from '../../src/client/console/consoleTaskRouter';

/**
 * THE SCREEN DIRECTOR — phase 0, the SHADOW for the whole console (the owner, 2026-10-31: «внедрять на 100% по всему
 * консольному интерфейсу»). Who may serve the server's one question is a pure function of its kind; what stands on
 * screen is read beside it and a sustained disagreement is only logged.
 */
describe('screenDirector', () => {
  const base = (task: ConsoleTask | undefined, over: Partial<ScreenShadowInput> = {}): ScreenShadowInput => ({
    task, startOwned: false, frameServes: [], held: '', present: [], beats: [], ...over,
  });

  describe('the table', () => {
    it('scopes out the free action menu, the start\'s own questions and the unknown', () => {
      expect(expectedScreenOwners({kind: 'actionMenu'})).eq('free');
      expect(expectedScreenOwners({kind: 'initialDraft'} as ConsoleTask)).eq('start');
      expect(expectedScreenOwners({kind: 'startSequence'} as ConsoleTask)).eq('start');
      expect(expectedScreenOwners({kind: 'unknown'} as ConsoleTask)).eq('unknown');
    });

    it('a placement is the board\'s, a colony the colonies\', a hand pick the hand\'s', () => {
      expect(expectedScreenOwners({kind: 'space'} as ConsoleTask)).deep.eq(['board']);
      expect(expectedScreenOwners({kind: 'colony'} as ConsoleTask)).deep.eq(['colonies']);
      expect(expectedScreenOwners({kind: 'handSelect'} as ConsoleTask)).deep.eq(['hand']);
      expect(expectedScreenOwners({kind: 'externalDraw'} as ConsoleTask)).deep.eq(['external-draw']);
    });

    it('a project card is read by its mode', () => {
      expect(expectedScreenOwners({kind: 'projectCard', mode: 'playFromHand'})).deep.eq(['hand']);
      expect(expectedScreenOwners({kind: 'projectCard', mode: 'standardProject'})).deep.eq(['standard-projects', 'sheet']);
      expect(expectedScreenOwners({kind: 'projectCard', mode: 'generic'})).deep.eq(['task']);
    });

    it('the generic family may stand in the task host or any of its dedicated stand-ins', () => {
      const payment = expectedScreenOwners({kind: 'payment'} as ConsoleTask);
      expect(payment).include.members(['task', 'decision', 'deck-pick']);
      expect(expectedScreenOwners({kind: 'cardSelect', mode: 'draft'} as ConsoleTask)).include('draft');
    });

    it('lists every workspace kind once and every own surface once', () => {
      expect(new Set(ALL_WORKSPACE_KINDS).size).eq(ALL_WORKSPACE_KINDS.length);
      expect(ALL_WORKSPACE_KINDS).include.members(['start', 'hand', 'parliament', 'endgame', 'repeat-pick']);
      const selectors = Object.values(OWNER_SURFACES);
      expect(new Set(selectors).size).eq(selectors.length);
      // A beat explains a wait; it never answers a question — no selector is both.
      expect(selectors.filter((s) => BEAT_SURFACES.includes(s))).deep.eq([]);
    });
  });

  describe('the verdict', () => {
    const payment = {kind: 'payment'} as ConsoleTask;

    it('nothing asked, the start\'s question, an out-of-scope kind → none', () => {
      expect(screenShadowVerdict(base(undefined)).kind).eq('none');
      expect(screenShadowVerdict(base(payment, {startOwned: true})).kind).eq('none');
      expect(screenShadowVerdict(base({kind: 'actionMenu'})).kind).eq('none');
    });

    it('an expected owner on screen agrees — a runtime-earned frame counts', () => {
      expect(screenShadowVerdict(base(payment, {present: ['task']})).kind).eq('agree');
      expect(screenShadowVerdict(base(payment, {present: ['hydro'], frameServes: ['hydro']})).kind).eq('agree');
    });

    it('a STEP of a flow is served by the flow\'s HOST — the basis told apart; a non-hostable kind never is', () => {
      const draw = {kind: 'externalDraw'} as ConsoleTask;
      expect(screenShadowVerdict(base(draw, {present: ['parliament'], host: 'parliament'}))).deep.eq({kind: 'agree', owners: ['parliament'], basis: 'host'});
      expect(screenShadowVerdict(base(draw, {present: ['parliament']})).kind, 'no host → a foreign surface').eq('misserved');
      expect(screenShadowVerdict(base(draw, {present: ['external-draw', 'parliament'], host: 'parliament'}))).deep.include({basis: 'table'});
      const attack = {kind: 'botAttack'} as ConsoleTask;
      expect(hostableStep('botAttack')).eq(false);
      expect(screenShadowVerdict(base(attack, {present: ['card-actions'], host: 'card-actions'})).kind, 'a modal of its own is never a step').eq('misserved');
      expect(screenShadowVerdict(base(draw, {host: 'parliament'}))).deep.eq({kind: 'unserved', expected: ['external-draw', 'parliament']});
    });

    it('a task\'s nested placement is the BOARD\'s (the final greenery\'s branch)', () => {
      const branch = {kind: 'choice', flavor: 'generic'} as ConsoleTask;
      expect(screenShadowVerdict(base(branch, {present: ['board'], boardBranch: true}))).deep.eq({kind: 'agree', owners: ['board'], basis: 'branch'});
      expect(screenShadowVerdict(base(branch, {present: ['board']})).kind).eq('misserved');
    });


    it('a named hold outranks a beat, a beat outranks a disagreement', () => {
      expect(screenShadowVerdict(base(payment, {held: 'announce-gate', beats: ['.con-reveal']})).kind).eq('held');
      expect(screenShadowVerdict(base(payment, {beats: ['.con-reveal']})).kind).eq('beat');
    });

    it('nothing painted → unserved; a wrong owner painted → misserved, with what was expected', () => {
      const unserved = screenShadowVerdict(base({kind: 'colony'} as ConsoleTask));
      expect(unserved).deep.eq({kind: 'unserved', expected: ['colonies']});
      const misserved = screenShadowVerdict(base({kind: 'colony'} as ConsoleTask, {present: ['hand']}));
      expect(misserved).deep.eq({kind: 'misserved', expected: ['colonies']});
    });
  });

  describe('confirmation and the log', () => {
    beforeEach(() => resetScreenShadowLog());

    it('a disagreement is confirmed only after the same signature stood the confirm ticks', () => {
      let streak = {signature: '', ticks: 0};
      for (let i = 0; i < SCREEN_SHADOW_CONFIRM_TICKS; i++) {
        streak = advanceScreenShadowStreak(streak, 'unserved||colony#3');
      }
      expect(streak.ticks).eq(SCREEN_SHADOW_CONFIRM_TICKS);
      expect(advanceScreenShadowStreak(streak, 'unserved||colony#4').ticks).eq(1);
      expect(advanceScreenShadowStreak(streak, '')).deep.eq({signature: '', ticks: 0});
    });

    it('records one finding per (kind, owners, prompt)', () => {
      const f = {kind: 'unserved' as const, expected: ['colonies' as const], present: [], prompt: 'colony#3', at: 1};
      expect(recordScreenShadowFinding(f)).eq(true);
      expect(recordScreenShadowFinding({...f, at: 2})).eq(false);
      expect(recordScreenShadowFinding({...f, prompt: 'colony#4'})).eq(true);
      expect(screenShadowLog.findings).length(2);
    });

    it('the stats: every verdict counted, a hold\'s LONGEST unbroken run, the owners that served each shape', () => {
      noteScreenShadowPass('payment', {kind: 'held', reason: 'announce-gate', present: []});
      noteScreenShadowPass('payment', {kind: 'held', reason: 'announce-gate', present: []});
      noteScreenShadowPass('payment', {kind: 'agree', owners: ['task'], basis: 'table'});
      noteScreenShadowPass('payment', {kind: 'held', reason: 'announce-gate', present: []});
      noteScreenShadowPass('payment', {kind: 'beat', beats: ['.con-reveal'], present: ['hand']});
      noteScreenShadowPass('colony', {kind: 'agree', owners: ['parliament'], basis: 'host'});
      noteScreenShadowPass(undefined, {kind: 'none', scope: 'free'});
      const s = screenShadowLog.stats;
      expect(s.verdicts).deep.eq({'held': 3, 'agree': 2, 'beat': 1, 'none:free': 1});
      expect(s.held['announce-gate']).eq(3);
      expect(s.heldMaxRun['announce-gate'], 'two, then broken, then one').eq(2);
      expect(s.owners, 'an owner entitled by the host is told apart').deep.eq({payment: {task: 1}, colony: {'parliament@host': 1}});
      expect(s.shapes).deep.eq({payment: 5, colony: 1});
      expect(s.masked, 'what each wait HID — nothing under the gate, the hand under the reveal').deep.eq(
        {payment: {'held:announce-gate | nothing': 3, 'beat | hand': 1}});
      expect(screenShadowLog.judged, 'a pass out of scope is counted, never judged').eq(6);
    });

    it('the table\'s rows are every prompt kind', () => {
      expect(SCREEN_TABLE_KINDS).include.members(['space', 'payment', 'colony', 'externalDraw', 'actionMenu', 'unknown']);
      expect(new Set(SCREEN_TABLE_KINDS).size).eq(SCREEN_TABLE_KINDS.length);
      expect(screenPromptShape({kind: 'cardSelect', mode: 'draft'} as ConsoleTask)).eq('cardSelect:draft');
    });

    it('the prompt token names the kind, the row-deciding mode and the server\'s prompt id', () => {
      expect(screenPromptToken({kind: 'projectCard', mode: 'generic'}, 7)).eq('projectCard:generic#7');
      expect(screenPromptToken({kind: 'choice', flavor: 'wgt'}, 2)).eq('choice:wgt#2');
      expect(screenPromptToken({kind: 'colony'} as ConsoleTask, undefined)).eq('colony#');
    });
  });
});
