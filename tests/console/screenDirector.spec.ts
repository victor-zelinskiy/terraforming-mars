import {expect} from 'chai';
import {
  ALL_WORKSPACE_KINDS, BEAT_SURFACES, OWNER_SURFACES, SCREEN_SHADOW_CONFIRM_TICKS, ScreenShadowInput,
  ROW_REASONS, SCREEN_TABLE_KINDS, UNOBSERVED_SHAPES, advanceScreenShadowStreak, expectedScreenOwners, hostableStep, noteScreenShadowPass, recordScreenShadowFinding,
  SCREEN_CURE_VERBS, parseScreenCureArming, planScreenCure, screenCureArmingFor, resetScreenShadowLog, screenCurePlanText, screenPromptShape, screenPromptToken, screenShadowLog, screenShadowVerdict,
} from '../../src/client/console/screenDirector';
import {ConsoleTask} from '../../src/client/console/consoleTaskRouter';
import * as fs from 'fs';
import * as path from 'path';

/** The whole suite's observation (`scripts/screen-shadow-report.mjs --write-evidence`) — what served each shape, by basis. */
type Evidence = {shapes: Record<string, {judged: number, table: Record<string, number>}>};
const EVIDENCE = JSON.parse(fs.readFileSync(path.join(__dirname, 'screenDirectorEvidence.json'), 'utf8')) as Evidence;

/** A task of a shape (`kind[:mode]`) — the mode rides as both `mode` and `flavor`, the rows read the one they know. */
function taskOfShape(shape: string): ConsoleTask {
  const [kind, mode] = shape.split(':');
  return (mode === undefined ? {kind} : {kind, mode, flavor: mode}) as unknown as ConsoleTask;
}

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
      expect(expectedScreenOwners({kind: 'projectCard', mode: 'standardProject'})).deep.eq(['standard-projects']);
      expect(expectedScreenOwners({kind: 'projectCard', mode: 'generic'})).deep.eq(['task']);
    });

    it('step 2 — an OBSERVED shape is narrowed to what served it; an unobserved one keeps the family, named', () => {
      expect(expectedScreenOwners({kind: 'payment'} as ConsoleTask)).deep.eq(['task']);
      expect(expectedScreenOwners({kind: 'cardSelect', mode: 'draft'} as ConsoleTask)).deep.eq(['draft']);
      expect(expectedScreenOwners({kind: 'cardSelect', mode: 'buy'} as ConsoleTask)).deep.eq(['draft', 'task']);
      expect(expectedScreenOwners({kind: 'choice', flavor: 'wgt'} as ConsoleTask)).deep.eq(['gov-support']);
      expect(expectedScreenOwners({kind: 'distribute', mode: 'production'} as ConsoleTask)).deep.eq(['prod-loss', 'task']);
      expect(expectedScreenOwners({kind: 'choice', flavor: 'espionage'} as ConsoleTask)).deep.eq(['hydro']);
      expect(expectedScreenOwners({kind: 'player'} as ConsoleTask)).deep.eq(['task']);
      expect(expectedScreenOwners({kind: 'choice', flavor: 'confirm'} as ConsoleTask)).include.members(['task', 'lanes']);
    });

    it('every UNOBSERVED shape keeps the generic family, and only those do', () => {
      const family = expectedScreenOwners({kind: 'composite'} as ConsoleTask);
      for (const shape of Object.keys(UNOBSERVED_SHAPES)) {
        expect(expectedScreenOwners(taskOfShape(shape)), shape).deep.eq(family);
        expect(UNOBSERVED_SHAPES[shape].length, `${shape} carries its reason`).greaterThan(10);
      }
      for (const shape of Object.keys(EVIDENCE.shapes)) {
        if (UNOBSERVED_SHAPES[shape] === undefined) {
          expect(expectedScreenOwners(taskOfShape(shape)), `${shape} was observed — its row is narrowed`).not.deep.eq(family);
        }
      }
    });

    it('THE EVIDENCE GATE: every owner the suite saw serving a shape BY ITS ROW is in that row, and every owner in a row was seen', () => {
      for (const [shape, entry] of Object.entries(EVIDENCE.shapes)) {
        const row = expectedScreenOwners(taskOfShape(shape));
        if (typeof row === 'string' || UNOBSERVED_SHAPES[shape] !== undefined) {
          continue;
        }
        for (const owner of Object.keys(entry.table)) {
          expect(row, `${shape}: «${owner}» served it by its row`).include(owner);
        }
        for (const owner of row) {
          expect(entry.table[owner] !== undefined || ROW_REASONS[`${shape}|${owner}`] !== undefined,
            `${shape}: «${owner}» is in the row but was never seen serving it — narrow it or write its reason`).eq(true);
        }
      }
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

    it('the alternative Venus board’s bonus is a STEP of its host (P89 · EE): the lanes or the host serve it', () => {
      const bonus = {kind: 'venusBonus', mode: 'standard'} as unknown as ConsoleTask;
      expect(hostableStep('venusBonus')).eq(true);
      expect(screenShadowVerdict(base(bonus, {present: ['card-actions'], host: 'card-actions'}))).deep.include({kind: 'agree', basis: 'host'});
      expect(screenShadowVerdict(base(bonus, {present: ['lanes']})).kind, 'the hosted surface keeps its own root').eq('agree');
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

  /*
   * STEP 4, PREPARED — the cure PLAN (pure). Each class through the owner's existing door, or a named `none`; nothing
   * is armed unless the URL asks.
   */
  describe('planScreenCure — the doors (step 4, prepared)', () => {
    const base = {expected: ['hand'] as const, present: [] as const, routerDoor: false, parkServes: false, deferred: false};
    it('UNSERVED: a parked chain that serves the question comes BACK (the restore card’s door) before anything opens', () => {
      expect(screenCurePlanText(planScreenCure({...base, kind: 'unserved', parkServes: true, routerDoor: true}))).eq('restore:restoreDeferredTask');
    });
    it('UNSERVED: the router’s own door when the kind has one; else NAMED as the class’s worklist, never guessed', () => {
      expect(screenCurePlanText(planScreenCure({...base, kind: 'unserved', routerDoor: true}))).eq('open:openShellTaskSurface');
      expect(screenCurePlanText(planScreenCure({...base, kind: 'unserved', expected: ['draft']}))).eq('none:no-door:draft');
    });
    it('MISSERVED: a foreign WORKSPACE goes home (never parked — a parked foreign chain is what the restore would bring back), then the door', () => {
      expect(screenCurePlanText(planScreenCure({...base, kind: 'misserved', present: ['colonies'], routerDoor: true})))
        .eq('yield:goBoardHome+openShellTaskSurface');
      expect(screenCurePlanText(planScreenCure({...base, kind: 'misserved', present: ['colonies'], expected: ['task']})))
        .eq('yield:goBoardHome');
    });
    it('MISSERVED: the generic sheet closes with the layers', () => {
      expect(screenCurePlanText(planScreenCure({...base, kind: 'misserved', present: ['sheet']}))).eq('yield:closeConsoleLayers');
    });
    it('MISSERVED: a foreign surface with no leave verb, and the opening’s own frame, are never touched', () => {
      expect(screenCurePlanText(planScreenCure({...base, kind: 'misserved', present: ['decision', 'colonies']}))).eq('none:no-leave:decision');
      expect(screenCurePlanText(planScreenCure({...base, kind: 'misserved', present: ['start']}))).eq('none:start-director');
    });
    it('a BLIND announce (the gate holds a presented decision nobody can see) is cured by lighting the chip\'s beacon — never by opening it', () => {
      expect(screenCurePlanText(planScreenCure({...base, kind: 'misserved', present: ['hand'], blind: 'announce-gate'}))).eq('announce:forceMandatoryBeacon');
      expect(screenCurePlanText(planScreenCure({...base, kind: 'unserved', blind: 'announce-gate'}))).eq('announce:forceMandatoryBeacon');
    });
    it('the verdict: a blind hold is neither a hold nor the host\'s — a finding with the hold named', () => {
      const v = screenShadowVerdict({task: {kind: 'choice', flavor: 'contextual'} as ConsoleTask, startOwned: false, frameServes: [], host: 'hand',
        held: '', blind: 'announce-gate', present: ['hand'], beats: []});
      expect(v).deep.eq({kind: 'misserved', expected: ['decision', 'task'], blind: 'announce-gate'});
    });
    it('the default arming is the owner\'s armed classes; a URL names its own set', () => {
      expect([...screenCureArmingFor(null)]).deep.eq(['announce']);
      expect([...screenCureArmingFor('none')]).deep.eq([]);
      expect([...screenCureArmingFor('open')]).deep.eq(['open']);
    });
    it('a question the player set aside is never cured', () => {
      expect(screenCurePlanText(planScreenCure({...base, kind: 'unserved', routerDoor: true, deferred: true}))).eq('none:deferred');
    });
    it('the arming reads the URL’s list — unknown tokens ignored, «all» = every verb, nothing by default', () => {
      expect([...parseScreenCureArming(null)]).deep.eq([]);
      expect([...parseScreenCureArming('open, bogus')]).deep.eq(['open']);
      expect([...parseScreenCureArming('all')]).deep.eq([...SCREEN_CURE_VERBS]);
    });
  });
});
