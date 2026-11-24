import {expect} from 'chai';
import {
  boardTakeableFromStack, collapseWorkspaceStack, enterWorkspace, hostCarriesPlayersLook, pushWorkspaceFrame, pushWouldNestInItself, resetWorkspaceStack,
  resumeStackFromBoard, setWorkspaceFramePhase, workspaceReturnsFromBoard, yieldStackToBoard,
} from '@/client/console/consoleWorkspaceStack';

/*
 * CAN THE BOARD BE TAKEN FROM THIS STACK (PL-1840's cover, 2026-11-06). A server placement is held for a scale story
 * under a cover only when taking the board can uncover it — a phase root that never yields (the start) stands through
 * its own placements, and a placement held there waited out the park's 30 s safety (e2e `console-start-placement`,
 * `console-start-held-placement`).
 */
describe('boardTakeableFromStack', () => {
  afterEach(() => resetWorkspaceStack());

  it('an empty stack — the board is already there to take', () => {
    resetWorkspaceStack();
    expect(boardTakeableFromStack()).is.true;
  });

  it('an ordinary workspace — board-home truncates it', () => {
    enterWorkspace('card-actions', {anchor: {type: 'always'}});
    expect(boardTakeableFromStack()).is.true;
  });

  it('the START — a phase root that never yields to the board — cannot be taken', () => {
    enterWorkspace('start', {anchor: {type: 'phase', phase: 'start'}});
    expect(boardTakeableFromStack()).is.false;
  });

  it('…nor with a step of its own standing on it', () => {
    enterWorkspace('start', {anchor: {type: 'phase', phase: 'start'}});
    pushWorkspaceFrame({kind: 'hand', subject: '', stage: '', phase: 'browse', serves: [], anchor: {type: 'always'}});
    expect(boardTakeableFromStack()).is.false;
  });

  it('a root that yields to the board (the Hydronetwork) can be taken', () => {
    enterWorkspace('hydro', {anchor: {type: 'phase', phase: 'hydro'}});
    expect(boardTakeableFromStack()).is.true;
  });
});

/*
 * WHOSE IS WHAT STANDS ON A HOST (FREEZE ZERO, stage 1 — who is waited for decides the wait; `fz3` · `duo` ·
 * `parliament`, 2026-11-18). «The player goes to a screen» over a phase root leaves an OVERLAY in browse; a flow's step
 * nests INSIDE the host. Only the first is the player's own look.
 */
describe('hostCarriesPlayersLook', () => {
  afterEach(() => resetWorkspaceStack());

  it('the colony rail the player went to over the start is their own look', () => {
    enterWorkspace('start', {anchor: {type: 'phase', phase: 'start'}});
    expect(hostCarriesPlayersLook('start'), 'nothing stands on it').is.false;
    enterWorkspace('colonies');
    expect(hostCarriesPlayersLook('start')).is.true;
    expect(hostCarriesPlayersLook('colonies'), 'the look itself carries nothing').is.false;
    expect(hostCarriesPlayersLook('hand'), 'a workspace that is not standing carries nothing').is.false;
  });

  it('a STEP a flow opened on the start is not a look — the hand for a prelude, a colony pick for its prompt', () => {
    enterWorkspace('start', {anchor: {type: 'phase', phase: 'start'}});
    // The hand hosted for a play-from-hand prelude: nested INSIDE the start (never an overlay), though in browse.
    pushWorkspaceFrame({kind: 'hand', subject: '', stage: '', phase: 'browse', serves: ['projectCard'], anchor: {type: 'always'}});
    expect(hostCarriesPlayersLook('start')).is.false;
    resetWorkspaceStack();
    enterWorkspace('start', {anchor: {type: 'phase', phase: 'start'}});
    // A prelude's colony pick: anchored to its prompt, past browse.
    pushWorkspaceFrame({kind: 'colonies', subject: '', stage: '', phase: 'committed', serves: ['colony'], anchor: {type: 'prompt', promptType: 'colony'}});
    expect(hostCarriesPlayersLook('start')).is.false;
  });

  it('a look the player took past its browse layer is a flow again', () => {
    enterWorkspace('start', {anchor: {type: 'phase', phase: 'start'}});
    enterWorkspace('colonies');
    setWorkspaceFramePhase('colonies', 'configure');
    expect(hostCarriesPlayersLook('start')).is.false;
  });
});

/*
 * A SURFACE NEVER STANDS INSIDE ITSELF (the autopilot in a real browser, 2026-11-24 — game 55: a sitting's colony
 * step embedded in the sitting's own stage, and the law's next question opened as a Parliament step of those
 * colonies — the one Parliament component teleported into a node inside itself, `HierarchyRequestError`).
 */
describe('pushWouldNestInItself', () => {
  afterEach(() => resetWorkspaceStack());
  const step = (kind: 'colonies' | 'card-actions' | 'parliament' | 'hand') =>
    pushWorkspaceFrame({kind, subject: '', stage: '', phase: 'committed', serves: [], anchor: {type: 'always'}});

  it('an empty stack, or a stack without the kind — nothing to stand inside', () => {
    expect(pushWouldNestInItself('parliament')).is.false;
    enterWorkspace('colonies');
    expect(pushWouldNestInItself('parliament')).is.false;
  });

  it('a step EMBEDDED in the Parliament: a Parliament pushed on it would stand inside itself', () => {
    enterWorkspace('parliament', {anchor: {type: 'always'}});
    step('colonies');
    expect(pushWouldNestInItself('parliament')).is.true;
    expect(pushWouldNestInItself('hand'), 'another kind nests freely').is.false;
  });

  it('a frame that took the SCENE stands over its host — the chain ends there (the Unity door\'s trade)', () => {
    enterWorkspace('parliament', {anchor: {type: 'always'}});
    pushWorkspaceFrame({kind: 'card-actions', subject: '', stage: '', phase: 'committed', serves: [], anchor: {type: 'always'}, overlay: true});
    step('colonies');
    expect(pushWouldNestInItself('parliament')).is.false;
  });

  it('the kind on top of the stack is itself the answer — a push there is a re-entry, asked elsewhere', () => {
    enterWorkspace('parliament', {anchor: {type: 'always'}});
    expect(pushWouldNestInItself('parliament')).is.true;
  });
});

/*
 * THE LATERAL DOOR's QUESTION (the one-owner law's EXTRA — finding #138, 2026-11-25): a workspace standing ASIDE FOR THE
 * BOARD is the same workspace mid-step — entering its kind again stands a second instance beside the one coming back.
 */
describe('workspaceReturnsFromBoard', () => {
  afterEach(() => resetWorkspaceStack());

  it('a sitting aside for the board returns by itself — its kind is not to be entered again; back on stage, the question is over', () => {
    enterWorkspace('parliament', {anchor: {type: 'always'}});
    expect(workspaceReturnsFromBoard('parliament'), 'on stage: nothing is coming back').is.false;
    expect(yieldStackToBoard(), 'the Parliament steps aside for the board').is.true;
    expect(workspaceReturnsFromBoard('parliament')).is.true;
    expect(workspaceReturnsFromBoard('colonies'), 'another kind is free to open').is.false;
    expect(resumeStackFromBoard()).is.true;
    expect(workspaceReturnsFromBoard('parliament')).is.false;
  });

  it('a PARKED workspace is not this: a fresh instance beside the park is the wheel\'s own law', () => {
    enterWorkspace('card-actions');
    collapseWorkspaceStack();
    expect(workspaceReturnsFromBoard('card-actions')).is.false;
  });
});
