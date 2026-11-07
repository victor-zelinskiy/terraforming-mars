import {expect} from 'chai';
import {dispatchConsoleIntent} from '@/client/console/consoleRouter';
import {inputEchoSnapshot, resetInputEchoForTest} from '@/client/console/inputEcho';

/**
 * THE PRESSES THE LIVENESS ARBITER COUNTS (2026-10-31): A and B — the two verbs every live surface must answer — from
 * ANY device (the router both the key bridge and the gamepad layer go through). An optional verb with nothing to do (X
 * on the pass-confirm panel) or a direction against a ring's wall is an honest no-op, never the wedge signature.
 */
describe('liveness · the presses it counts', () => {
  afterEach(() => resetInputEchoForTest());

  it('counts A and B, never an optional verb, a direction or a release', () => {
    resetInputEchoForTest();
    dispatchConsoleIntent({kind: 'press', button: 'secondary'});
    dispatchConsoleIntent({kind: 'press', button: 'inspect'});
    dispatchConsoleIntent({kind: 'nav', dir: 'left', repeat: false});
    dispatchConsoleIntent({kind: 'release', button: 'confirm'});
    expect(inputEchoSnapshot().verbPresses).to.equal(0);
    dispatchConsoleIntent({kind: 'press', button: 'confirm'});
    dispatchConsoleIntent({kind: 'press', button: 'back'});
    expect(inputEchoSnapshot().verbPresses).to.equal(2);
  });

  it('counts the B presses a handler TOOK apart (the arbiter judges them on a frame past its commit)', () => {
    resetInputEchoForTest();
    dispatchConsoleIntent({kind: 'press', button: 'back'});
    dispatchConsoleIntent({kind: 'press', button: 'confirm'});
    const echo = inputEchoSnapshot();
    // No handler is registered here: both are DROPPED, so neither is a taken B.
    expect(echo.verbDropped).to.equal(2);
    expect(echo.backTaken).to.equal(0);
  });
});
