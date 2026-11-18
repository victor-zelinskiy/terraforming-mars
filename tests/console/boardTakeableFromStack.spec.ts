import {expect} from 'chai';
import {
  boardTakeableFromStack, enterWorkspace, hostCarriesPlayersLook, pushWorkspaceFrame, resetWorkspaceStack, setWorkspaceFramePhase,
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
