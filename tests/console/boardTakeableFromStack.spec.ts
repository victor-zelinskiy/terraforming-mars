import {expect} from 'chai';
import {
  boardTakeableFromStack, enterWorkspace, pushWorkspaceFrame, resetWorkspaceStack,
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
