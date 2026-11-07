import {expect} from 'chai';
import {ConsoleTask, SHELL_SECTION_KINDS} from '../../src/client/console/consoleTaskRouter';
import {
  destinationServesShellTask, navigationDefersShellTask, questionKeepsFrame, ShellTaskDestination,
} from '../../src/client/console/shellTaskSurface';
import {
  enterWorkspace, handFrameToQuestion, resetWorkspaceStack, workspaceFrameAnchor, workspaceFramePhase, workspaceStackTop,
  descendWorkspaceFrame,
} from '../../src/client/console/consoleWorkspaceStack';

/**
 * A LIVE QUESTION AND ITS SURFACE (the owner's bug, 2026-11-07 — WG Project deals Eccentric Sponsor, whose play asks
 * «play a card from your hand»): a door TO the question never sets it aside (law 1), and a finished flow hands its
 * frame to the question standing on it instead of closing it (law 2).
 */
const PLAY_FROM_HAND: ConsoleTask = {kind: 'projectCard', mode: 'playFromHand'};
const HAND_SELECT: ConsoleTask = {kind: 'handSelect'};
const STD_PROJECT: ConsoleTask = {kind: 'projectCard', mode: 'standardProject'};
const GENERIC: ConsoleTask = {kind: 'projectCard', mode: 'generic'};
const AWARD: ConsoleTask = {kind: 'awardFunding'};
const COLONY: ConsoleTask = {kind: 'colony'};

describe('shellTaskSurface — a live question and the surface that answers it', () => {
  describe('law 1 — a door to the question never sets it aside', () => {
    const cases: ReadonlyArray<[ConsoleTask, ShellTaskDestination, boolean]> = [
      // The reported bug: the hand opened FOR the play-from-hand prompt.
      [PLAY_FROM_HAND, 'hand', false],
      [HAND_SELECT, 'hand', false],
      [STD_PROJECT, 'standard-projects', false],
      [AWARD, 'awards', false],
      [COLONY, 'colonies', false],
      // Away from the question — the old contract stands.
      [PLAY_FROM_HAND, 'board', true],
      [PLAY_FROM_HAND, 'colonies', true],
      [PLAY_FROM_HAND, 'standard-projects', true],
      [STD_PROJECT, 'hand', true],
      [COLONY, 'hand', true],
      [HAND_SELECT, 'card-actions', true],
      // A generic project-card pick is the task host's — no workspace is its surface.
      [GENERIC, 'hand', true],
      [GENERIC, 'standard-projects', true],
    ];
    for (const [task, destination, defers] of cases) {
      it(`${task.kind}${'mode' in task ? '/' + task.mode : ''} → ${destination}: ${defers ? 'set aside' : 'kept'}`, () => {
        expect(navigationDefersShellTask(task, destination)).to.eq(defers);
        expect(destinationServesShellTask(task, destination)).to.eq(!defers);
      });
    }
    it('no question — nothing to set aside, no surface', () => {
      expect(navigationDefersShellTask(undefined, 'hand')).to.be.false;
      expect(destinationServesShellTask(undefined, 'hand')).to.be.false;
    });
  });

  describe('law 2 — a finished flow hands its frame to the question standing on it', () => {
    const base = {deferred: false, hosted: false, phaseRoot: false};
    it('the play-from-hand question keeps the hand (the reported bug)', () => {
      expect(questionKeepsFrame({...base, task: PLAY_FROM_HAND, kind: 'hand'})).to.be.true;
      expect(questionKeepsFrame({...base, task: HAND_SELECT, kind: 'hand'})).to.be.true;
    });
    it('a question answered elsewhere lets the flow leave', () => {
      expect(questionKeepsFrame({...base, task: COLONY, kind: 'hand'})).to.be.false;
      expect(questionKeepsFrame({...base, task: GENERIC, kind: 'hand'})).to.be.false;
      expect(questionKeepsFrame({...base, task: undefined, kind: 'hand'})).to.be.false;
      expect(questionKeepsFrame({...base, task: {kind: 'actionMenu'} as ConsoleTask, kind: 'hand'})).to.be.false;
    });
    it('a set-aside question, a hosted frame and a phase root never keep the frame', () => {
      expect(questionKeepsFrame({...base, deferred: true, task: PLAY_FROM_HAND, kind: 'hand'})).to.be.false;
      expect(questionKeepsFrame({...base, hosted: true, task: PLAY_FROM_HAND, kind: 'hand'})).to.be.false;
      expect(questionKeepsFrame({...base, phaseRoot: true, task: PLAY_FROM_HAND, kind: 'hand'})).to.be.false;
    });
    it('only a shell-section question keeps a frame', () => {
      for (const kind of SHELL_SECTION_KINDS) {
        const task = (kind === 'projectCard' ? PLAY_FROM_HAND : {kind}) as ConsoleTask;
        // Whatever the kind, the verdict is «is this frame its surface» — never true for a frame that is not.
        expect(questionKeepsFrame({...base, task, kind: 'milestones'}), kind).to.be.false;
      }
    });
  });

  describe('handFrameToQuestion — the frame folds to its browse layer', () => {
    afterEach(() => resetWorkspaceStack());
    it('releases the carried card and re-anchors on the browse layer', () => {
      resetWorkspaceStack();
      enterWorkspace('hand');
      descendWorkspaceFrame('hand', 'WG Project', 'Playing', {type: 'cardInHand', card: 'WG Project'});
      expect(workspaceFramePhase('hand')).to.eq('configure');
      handFrameToQuestion('hand');
      const top = workspaceStackTop();
      expect(top?.kind).to.eq('hand');
      expect(top?.subject).to.eq('');
      expect(top?.stage).to.eq('');
      expect(workspaceFramePhase('hand')).to.eq('browse');
      expect(workspaceFrameAnchor('hand')).to.deep.eq({type: 'always'});
    });
  });
});
