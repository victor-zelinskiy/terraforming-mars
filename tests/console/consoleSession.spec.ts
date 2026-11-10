import {expect} from 'chai';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {dumpFlowTree, resetFlowKernel} from '@/client/console/kernel/flowScope';
import {
  beginConsoleSession, consoleSessionLive, consoleSessionScope, endConsoleSession, onConsoleSessionEnd,
} from '@/client/console/session/consoleSession';
import {
  enterWorkspace, resetWorkspaceStack, workspaceFrameScope,
} from '@/client/console/consoleWorkspaceStack';
import {noteMandatoryBeatIdentity, resetMandatoryGate} from '@/client/console/consoleMandatoryGate';

/**
 * THE CONSOLE SESSION IS THE ONE ROOT (architecture v2 · S1). Every flow of the console is opened inside it, so «the
 * game screen left» is one event: nothing a module forgot to reset can stand into the next game (the session-leak
 * class — «иногда зависает» after a rematch), because there is no list to be on.
 */
describe('console session · one root for every flow', () => {
  beforeEach(() => {
    resetFlowKernel();
    resetWorkspaceStack();
    resetMandatoryGate();
    endConsoleSession('spec begins');
    setFlowClock(createManualClock(0));
  });
  afterEach(() => {
    resetWorkspaceStack();
    resetMandatoryGate();
    endConsoleSession('spec over');
    setFlowClock(undefined);
  });

  const roots = () => dumpFlowTree().filter((line) => !line.startsWith(' '));

  it('opens lazily, and is the same scope until it ends', () => {
    expect(consoleSessionLive()).to.equal(false);
    const a = consoleSessionScope();
    expect(consoleSessionLive()).to.equal(true);
    expect(consoleSessionScope()).to.equal(a);
    expect(a.kind).to.equal('session');
  });

  it('the workspace frames and the announce plate stand INSIDE it — one tree, one root', () => {
    beginConsoleSession();
    enterWorkspace('hand');
    noteMandatoryBeatIdentity('task:x#1');
    const tree = dumpFlowTree();
    expect(roots(), tree.join('\n')).to.have.length(1);
    expect(roots()[0]).to.match(/^session#/);
    expect(tree.some((line) => line.startsWith('  chain:workspace#')), tree.join('\n')).to.equal(true);
    expect(tree.some((line) => line.startsWith('  chain:announce#')), tree.join('\n')).to.equal(true);
    expect(tree.some((line) => line.includes('frame') && line.includes('hand')), tree.join('\n')).to.equal(true);
  });

  it('THE GAME SCREEN LEFT: every flow of the session ends with it — a frame nobody reset is not carried over', () => {
    beginConsoleSession();
    enterWorkspace('hand');
    const frame = workspaceFrameScope('hand');
    expect(frame?.ended).to.equal(undefined);
    noteMandatoryBeatIdentity('task:x#1');

    // No resetWorkspaceStack(), no resetMandatoryGate(): the list is not what ends them.
    endConsoleSession();

    expect(frame?.ended?.how).to.equal('cancelled');
    expect(frame?.ended !== undefined && 'reason' in frame.ended ? frame.ended.reason : '').to.contain('the game screen left');
    expect(dumpFlowTree()).to.deep.equal([]);
    expect(consoleSessionLive()).to.equal(false);
  });

  it('a NEW session over a standing one ends the old one first, by name', () => {
    const old = beginConsoleSession();
    const fresh = beginConsoleSession();
    expect(old.ended?.how).to.equal('cancelled');
    expect(old.ended !== undefined && 'reason' in old.ended ? old.ended.reason : '').to.contain('a new session began');
    expect(fresh).to.not.equal(old);
    expect(fresh.ended).to.equal(undefined);
    expect(roots()).to.have.length(1);
  });

  it('after a session ended the next flow opens a new one — a module never holds a dead root', () => {
    beginConsoleSession();
    enterWorkspace('hand');
    endConsoleSession();
    resetWorkspaceStack();

    enterWorkspace('colonies');
    expect(consoleSessionLive()).to.equal(true);
    expect(workspaceFrameScope('colonies')?.ended).to.equal(undefined);
    expect(roots()).to.have.length(1);
  });

  it('`onConsoleSessionEnd` — module state that is not a flow yet hangs its reset on the session: run once, at its end', () => {
    beginConsoleSession();
    const ran: Array<string> = [];
    onConsoleSessionEnd(() => ran.push('first'));
    onConsoleSessionEnd(() => ran.push('second'));
    const off = onConsoleSessionEnd(() => ran.push('withdrawn'));
    off();
    expect(ran).to.deep.equal([]);

    endConsoleSession();
    expect(ran).to.deep.equal(['second', 'first']); // LIFO, like every cleanup of a scope

    endConsoleSession();
    beginConsoleSession();
    endConsoleSession();
    expect(ran, 'a reset belongs to the session it was registered in').to.deep.equal(['second', 'first']);
  });

  it('a reset that throws does not keep the others from running', () => {
    beginConsoleSession();
    const ran: Array<string> = [];
    const warn = console.warn;
    console.warn = () => {};
    try {
      onConsoleSessionEnd(() => ran.push('a'));
      onConsoleSessionEnd(() => {
        throw new Error('boom');
      });
      onConsoleSessionEnd(() => ran.push('c'));
      endConsoleSession();
    } finally {
      console.warn = warn;
    }
    expect(ran).to.deep.equal(['c', 'a']);
  });
});
