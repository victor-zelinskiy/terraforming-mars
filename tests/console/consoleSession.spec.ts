import {expect} from 'chai';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {dumpFlowTree, resetFlowKernel} from '@/client/console/kernel/flowScope';
import {
  beginConsoleSession, consoleSessionLive, consoleSessionScope, declaredSessionStates, endConsoleSession, leaveConsoleSession,
  onConsoleSessionEnd, resetConsoleSession, sessionChild, sessionState,
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
    resetConsoleSession();
    resetFlowKernel();
    setFlowClock(createManualClock(0));
  });
  afterEach(() => {
    resetWorkspaceStack();
    resetMandatoryGate();
    resetConsoleSession();
    setFlowClock(undefined);
  });

  const roots = () => dumpFlowTree().filter((line) => !line.startsWith(' '));

  it('answers the LOBBY while no game screen is up, the GAME session while one stands — and the lobby outlives the game', () => {
    expect(consoleSessionLive()).to.equal(false);
    const lobby = consoleSessionScope();
    expect(lobby.kind).to.equal('session');
    expect(lobby.label).to.equal('lobby');
    expect(consoleSessionScope(), 'the same scope until it ends').to.equal(lobby);
    expect(consoleSessionLive(), 'the lobby is not a game session').to.equal(false);

    const game = beginConsoleSession();
    expect(game.label).to.equal('game');
    expect(consoleSessionLive()).to.equal(true);
    expect(consoleSessionScope()).to.equal(game);

    endConsoleSession();
    expect(game.ended?.how).to.equal('cancelled');
    expect(lobby.ended, 'a game that comes and goes does not end the lobby').to.equal(undefined);
    expect(consoleSessionScope()).to.equal(lobby);
  });

  it('the workspace frames and the announce plate stand INSIDE it — one tree, one root', () => {
    beginConsoleSession();
    enterWorkspace('hand');
    noteMandatoryBeatIdentity('task:x#1');
    const tree = dumpFlowTree();
    expect(roots(), tree.join('\n')).to.have.length(1);
    expect(roots()[0]).to.match(/^session:game#/);
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

  it('A SESSION HAS AN IDENTITY: the shell that leaves ends the session IT opened — never the one a new shell already stands on', () => {
    // A new shell's `setup()` runs before the old shell's `unmounted`: the old one used to end «the current session»,
    // which by then was the new shell's.
    const old = beginConsoleSession();
    const fresh = beginConsoleSession();
    enterWorkspace('hand');
    const frame = workspaceFrameScope('hand');

    endConsoleSession('the game screen left', old); // the old shell's unmount, late

    expect(fresh.ended, 'the new session stands').to.equal(undefined);
    expect(frame?.ended, 'and so does what the new shell opened in it').to.equal(undefined);
    expect(consoleSessionScope()).to.equal(fresh);
    expect(consoleSessionLive()).to.equal(true);
  });

  it('after a session ended a module\'s flow opens where flows belong now — a module never holds a dead root', () => {
    beginConsoleSession();
    enterWorkspace('hand');
    endConsoleSession();
    resetWorkspaceStack();

    enterWorkspace('colonies');
    expect(consoleSessionLive(), 'no game screen is up').to.equal(false);
    expect(workspaceFrameScope('colonies')?.ended).to.equal(undefined);
    expect(roots()).to.have.length(1);
    expect(roots()[0]).to.match(/^session:lobby#/);
  });

  it('`sessionChild` — a module\'s own root is RE-HOMED when the session that stands is not the one it was opened in', () => {
    const inLobby = sessionChild(undefined, 'chain', 'spec');
    expect(inLobby.parent).to.equal(consoleSessionScope());
    expect(sessionChild(inLobby, 'chain', 'spec'), 'the same root while its session stands').to.equal(inLobby);

    const game = beginConsoleSession();
    const inGame = sessionChild(inLobby, 'chain', 'spec');
    expect(inGame).to.not.equal(inLobby);
    expect(inGame.parent).to.equal(game);
    expect(inLobby.ended?.how, 'the root left behind is ended by name — nothing keeps opening flows in it').to.equal('cancelled');

    endConsoleSession();
    expect(inGame.ended?.how).to.equal('cancelled');
    const after = sessionChild(inGame, 'chain', 'spec');
    expect(after.ended).to.equal(undefined);
    expect(after.parent?.label).to.equal('lobby');
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

  it('`sessionState` — module state DECLARES itself; the leaving screen takes every declared state down in ONE ordered pass', () => {
    const ran: Array<string> = [];
    // Declared in any order (the order modules happen to be evaluated in) — the pass is ordered by `at`.
    sessionState('spec:c', () => ran.push('c'), 9_000_030);
    sessionState('spec:a', () => ran.push('a'), 9_000_010);
    sessionState('spec:b', () => ran.push('b'), 9_000_020);
    const places = declaredSessionStates().map((state) => state.at);
    expect(places, 'the pass is sorted').to.deep.equal([...places].sort((x, y) => x - y));

    beginConsoleSession();
    leaveConsoleSession();
    expect(ran).to.deep.equal(['a', 'b', 'c']);
    leaveConsoleSession(); // a declaration STANDS — it serves every game screen of the page, and the pass is idempotent
    expect(ran).to.deep.equal(['a', 'b', 'c', 'a', 'b', 'c']);

    // A module evaluated again: its newest declaration stands, in its (new) place.
    sessionState('spec:a', () => ran.push('a2'), 9_000_040);
    ran.length = 0;
    leaveConsoleSession();
    expect(ran).to.deep.equal(['b', 'c', 'a2']);
    for (const label of ['spec:a', 'spec:b', 'spec:c']) {
      sessionState(label, () => {}, 9_000_000);
    }
  });

  it('a session state that throws in its reset is said by name — and the pass goes on', () => {
    const ran: Array<string> = [];
    const said: Array<string> = [];
    const warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      said.push(String(args[0]));
    };
    try {
      sessionState('spec:first', () => ran.push('first'), 9_100_010);
      sessionState('spec:boom', () => {
        throw new Error('boom');
      }, 9_100_020);
      sessionState('spec:last', () => ran.push('last'), 9_100_030);
      beginConsoleSession();
      leaveConsoleSession();
    } finally {
      console.warn = warn;
      for (const label of ['spec:first', 'spec:boom', 'spec:last']) {
        sessionState(label, () => {}, 9_100_000);
      }
    }
    expect(ran).to.deep.equal(['first', 'last']);
    expect(said.filter((line) => line.includes('the session state «spec:boom» threw in its reset'))).to.have.length(1);
  });
});
