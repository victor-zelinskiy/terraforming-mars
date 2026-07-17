import {expect} from 'chai';
import {padCursorStep, PadCursorState, PadFrame} from '../../electron/devtoolsPadCursor';

// Pure unit test of the gamepad→DevTools-mouse mapping (the Electron side is a thin
// sendInputEvent shim around this step function).
//   npx mocha --import=tsx "tests/electron/devtoolsPadCursor.spec.ts"

const idle: PadCursorState = {x: 100, y: 100, aHeld: false, xHeld: false};
const frame = (over: Partial<PadFrame> = {}): PadFrame => ({ok: true, w: 1280, h: 800, ...over});

describe('electron/devtoolsPadCursor padCursorStep', () => {
  it('a centred stick with no buttons produces NO actions (inert without input)', () => {
    const {next, actions} = padCursorStep(idle, frame());
    expect(actions).to.deep.equal([]);
    expect(next).to.deep.equal(idle);
  });

  it('full deflection moves the cursor and emits a single mouseMove', () => {
    const {next, actions} = padCursorStep(idle, frame({ax: 1}));
    expect(next.x).to.be.greaterThan(idle.x);
    expect(next.y).to.equal(idle.y);
    expect(actions).to.deep.equal([{type: 'move', x: next.x, y: next.y}]);
  });

  it('the quadratic curve makes small deflections precise (0.3 → ~9% of max speed)', () => {
    const full = padCursorStep(idle, frame({ax: 1})).next.x - idle.x;
    const small = padCursorStep(idle, frame({ax: 0.3})).next.x - idle.x;
    expect(small).to.be.closeTo(full * 0.09, full * 0.02);
  });

  it('clamps to the DevTools viewport on both edges', () => {
    const atLeft = padCursorStep({...idle, x: 2}, frame({ax: -1}));
    expect(atLeft.next.x).to.equal(0);
    const atBottom = padCursorStep({...idle, y: 798}, frame({ay: 1}));
    expect(atBottom.next.y).to.equal(799);
  });

  it('A press/release edges = left mouseDown / mouseUp; holding A while moving = drag (no re-press)', () => {
    const press = padCursorStep(idle, frame({btnA: true}));
    expect(press.actions).to.deep.equal([{type: 'down', x: 100, y: 100, button: 'left'}]);
    const drag = padCursorStep(press.next, frame({btnA: true, ax: 1}));
    expect(drag.actions.map((a) => a.type)).to.deep.equal(['move']);
    const release = padCursorStep(drag.next, frame({btnA: false}));
    expect(release.actions).to.deep.equal([{type: 'up', x: drag.next.x, y: drag.next.y, button: 'left'}]);
  });

  it('X maps to the RIGHT button (DevTools context menus)', () => {
    const press = padCursorStep(idle, frame({btnX: true}));
    expect(press.actions).to.deep.equal([{type: 'down', x: 100, y: 100, button: 'right'}]);
  });

  it('right stick emits wheel at the cursor: stick DOWN (+) scrolls content DOWN (negative sendInputEvent deltaY)', () => {
    const {actions} = padCursorStep(idle, frame({scroll: 1}));
    expect(actions).to.have.length(1);
    const wheel = actions[0];
    if (wheel.type !== 'wheel') {
      throw new Error('expected a wheel action');
    }
    expect(wheel.deltaY).to.be.lessThan(0);
    expect(wheel.x).to.equal(100);
  });

  it('pad disconnect mid-hold releases held buttons (no phantom drag left in DevTools)', () => {
    const holding: PadCursorState = {...idle, aHeld: true, xHeld: true};
    const {next, actions} = padCursorStep(holding, {ok: false, w: 0, h: 0});
    expect(actions).to.deep.equal([
      {type: 'up', x: 100, y: 100, button: 'left'},
      {type: 'up', x: 100, y: 100, button: 'right'},
    ]);
    expect(next.aHeld).to.be.false;
    expect(next.xHeld).to.be.false;
  });
});
