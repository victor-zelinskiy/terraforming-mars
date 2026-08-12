import {expect} from 'chai';
import {
  JS_EVENT_SIZE,
  MappedPad,
  RawPadState,
  TWIN_CONFIRM,
  TWIN_DISAGREE_TOLERANCE_MS,
  TwinState,
  applyJsEvent,
  areTwins,
  initialTwinState,
  padsAgree,
  parseJsEvents,
  suppressedMirrors,
  toStandardPad,
  updateTwinState,
} from '../../electron/nativeGamepadLinux';

/** Build one joydev `struct js_event` record. */
function jsEvent(opts: {type: number, number: number, value: number, init?: boolean}): Buffer {
  const buf = Buffer.alloc(JS_EVENT_SIZE);
  buf.writeUInt32LE(0, 0); // time — unused
  buf.writeInt16LE(opts.value, 4);
  buf.writeUInt8(opts.type | (opts.init === true ? 0x80 : 0), 6);
  buf.writeUInt8(opts.number, 7);
  return buf;
}

const BUTTON = 0x01;
const AXIS = 0x02;

function emptyState(): RawPadState {
  return {buttons: [], axes: []};
}

describe('electron/nativeGamepadLinux parseJsEvents', () => {
  it('decodes a button press and an axis move', () => {
    const {events, rest} = parseJsEvents(Buffer.concat([
      jsEvent({type: BUTTON, number: 3, value: 1}),
      jsEvent({type: AXIS, number: 1, value: -32767}),
    ]));
    expect(rest.length).to.eq(0);
    expect(events).to.deep.eq([
      {type: BUTTON, number: 3, value: 1, init: false},
      {type: AXIS, number: 1, value: -32767, init: false},
    ]);
  });

  it('flags the synthetic init burst joydev replays on open', () => {
    const {events} = parseJsEvents(jsEvent({type: BUTTON, number: 0, value: 0, init: true}));
    expect(events[0].init).to.eq(true);
    // The init bit must be stripped, or the event matches no known type and the
    // whole opening state would be discarded.
    expect(events[0].type).to.eq(BUTTON);
  });

  it('returns a split record as `rest` instead of dropping it', () => {
    // A read on a character device is not guaranteed to land on an 8-byte
    // boundary; dropping the tail would desynchronise every following event.
    const whole = Buffer.concat([
      jsEvent({type: BUTTON, number: 1, value: 1}),
      jsEvent({type: AXIS, number: 0, value: 12345}),
    ]);
    const first = parseJsEvents(whole.subarray(0, JS_EVENT_SIZE + 3));
    expect(first.events).to.have.length(1);
    expect(first.rest.length).to.eq(3);

    const second = parseJsEvents(Buffer.concat([first.rest, whole.subarray(JS_EVENT_SIZE + 3)]));
    expect(second.events).to.deep.eq([{type: AXIS, number: 0, value: 12345, init: false}]);
    expect(second.rest.length).to.eq(0);
  });

  it('yields nothing for a buffer shorter than one record', () => {
    const {events, rest} = parseJsEvents(Buffer.alloc(5));
    expect(events).to.have.length(0);
    expect(rest.length).to.eq(5);
  });
});

describe('electron/nativeGamepadLinux applyJsEvent', () => {
  it('folds button and axis events into the raw state', () => {
    const state = emptyState();
    applyJsEvent(state, {type: BUTTON, number: 2, value: 1, init: false});
    applyJsEvent(state, {type: AXIS, number: 5, value: 4321, init: false});
    expect(state.buttons[2]).to.eq(1);
    expect(state.axes[5]).to.eq(4321);
    applyJsEvent(state, {type: BUTTON, number: 2, value: 0, init: false});
    expect(state.buttons[2]).to.eq(0);
  });
});

describe('electron/nativeGamepadLinux toStandardPad', () => {
  it('places the face buttons and bumpers at their standard indices', () => {
    const state = emptyState();
    for (const n of [0, 1, 2, 3, 4, 5]) {
      applyJsEvent(state, {type: BUTTON, number: n, value: 1, init: false});
    }
    const pad = toStandardPad(state);
    expect(pad.buttons.slice(0, 6)).to.deep.eq([1, 1, 1, 1, 1, 1]);
  });

  it('moves View/Menu/L3/R3/Guide from joydev order to standard order', () => {
    // joydev: 6 Back, 7 Start, 8 Guide, 9 L3, 10 R3
    // standard: 8 View, 9 Menu, 10 L3, 11 R3, 16 Guide — a straight copy is wrong.
    const state = emptyState();
    applyJsEvent(state, {type: BUTTON, number: 7, value: 1, init: false});
    applyJsEvent(state, {type: BUTTON, number: 8, value: 1, init: false});
    applyJsEvent(state, {type: BUTTON, number: 9, value: 1, init: false});
    const pad = toStandardPad(state);
    expect(pad.buttons[9]).to.eq(1, 'Menu/Start');
    expect(pad.buttons[16]).to.eq(1, 'Guide');
    expect(pad.buttons[10]).to.eq(1, 'L3');
    expect(pad.buttons[8]).to.eq(0, 'View must NOT be set');
  });

  it('normalizes an untouched trigger to 0 and a fully pulled one to 1', () => {
    const state = emptyState();
    // Untouched analog triggers rest at -32767 on joydev; reading that as a raw
    // stick value would report both triggers held down forever.
    applyJsEvent(state, {type: AXIS, number: 2, value: -32767, init: true});
    applyJsEvent(state, {type: AXIS, number: 5, value: 32767, init: false});
    const pad = toStandardPad(state);
    expect(pad.buttons[6]).to.eq(0, 'LT at rest');
    expect(pad.buttons[7]).to.eq(1, 'RT fully pulled');
  });

  it('defaults triggers to 0 before any axis event has arrived', () => {
    const pad = toStandardPad(emptyState());
    expect(pad.buttons[6]).to.eq(0);
    expect(pad.buttons[7]).to.eq(0);
  });

  it('maps the sticks to standard axes, dropping the trigger axes', () => {
    const state = emptyState();
    applyJsEvent(state, {type: AXIS, number: 0, value: 32767, init: false}); // LX
    applyJsEvent(state, {type: AXIS, number: 1, value: -32767, init: false}); // LY
    applyJsEvent(state, {type: AXIS, number: 3, value: 16384, init: false}); // RX (joydev 3)
    applyJsEvent(state, {type: AXIS, number: 4, value: -16384, init: false}); // RY (joydev 4)
    const pad = toStandardPad(state);
    expect(pad.axes).to.have.length(4);
    expect(pad.axes[0]).to.eq(1);
    expect(pad.axes[1]).to.eq(-1);
    expect(pad.axes[2]).to.be.closeTo(0.5, 0.01);
    expect(pad.axes[3]).to.be.closeTo(-0.5, 0.01);
  });

  it('reads the d-pad from the hat axes', () => {
    const state = emptyState();
    applyJsEvent(state, {type: AXIS, number: 7, value: -32767, init: false}); // up
    applyJsEvent(state, {type: AXIS, number: 6, value: 32767, init: false}); // right
    const pad = toStandardPad(state);
    expect(pad.buttons[12]).to.eq(1, 'up');
    expect(pad.buttons[13]).to.eq(0, 'down');
    expect(pad.buttons[14]).to.eq(0, 'left');
    expect(pad.buttons[15]).to.eq(1, 'right');
  });

  it('also reads a d-pad exposed as buttons (driver-dependent layout)', () => {
    // Some drivers report the hat as buttons 11..14 instead of axes 6/7; taking
    // the union of both conventions costs nothing and a wrong guess costs the
    // entire d-pad.
    const state = emptyState();
    applyJsEvent(state, {type: BUTTON, number: 12, value: 1, init: false}); // down
    const pad = toStandardPad(state);
    expect(pad.buttons[13]).to.eq(1, 'down');
    expect(pad.buttons[12]).to.eq(0, 'up');
  });

  it('reports a neutral pad as fully released', () => {
    const pad = toStandardPad(emptyState());
    expect(pad.buttons.every((v) => v === 0)).to.eq(true);
    expect(pad.axes).to.deep.eq([0, 0, 0, 0]);
  });
});

describe('electron/nativeGamepadLinux mirror suppression', () => {
  const neutral = (): MappedPad => ({buttons: [0, 0, 0, 0], axes: [0, 0, 0, 0]});
  const pressed = (index: number): MappedPad => {
    const pad = neutral();
    pad.buttons[index] = 1;
    return pad;
  };

  /** Feed the same observation `times` times, 8 ms apart (one poll period). */
  function observe(state: TwinState, a: MappedPad, b: MappedPad, times: number, from = 1000): TwinState {
    let next = state;
    for (let i = 0; i < times; i++) {
      next = updateTwinState(next, a, b, from + i * 8);
    }
    return next;
  }

  it('never twins two idle pads — shared idleness proves nothing', () => {
    const state = observe(initialTwinState(), neutral(), neutral(), 50);
    expect(areTwins(state)).to.eq(false);
    expect(state.activeAgreements).to.eq(0);
  });

  it('twins two nodes that agree while a button is actually held', () => {
    const state = observe(initialTwinState(), pressed(0), pressed(0), TWIN_CONFIRM);
    expect(areTwins(state)).to.eq(true);
  });

  it('tolerates the brief divergence of one edge reaching two nodes', () => {
    // The mirror lags by a poll or two — it must not break twinhood.
    let state = observe(initialTwinState(), pressed(0), pressed(0), TWIN_CONFIRM);
    state = updateTwinState(state, pressed(1), pressed(0), 2000); // mirror lags
    state = updateTwinState(state, pressed(1), pressed(1), 2008); // caught up
    expect(areTwins(state)).to.eq(true);
  });

  it('REJECTS two genuinely different controllers, permanently', () => {
    // One pad held while the other rests — sustained divergence.
    let state = observe(initialTwinState(), pressed(0), pressed(0), TWIN_CONFIRM);
    expect(areTwins(state)).to.eq(true);
    state = observe(state, pressed(0), neutral(), 20, 3000);
    expect(state.rejected).to.eq(true);
    expect(areTwins(state)).to.eq(false);
    // And it can never be re-twinned by later coincidence.
    state = observe(state, pressed(2), pressed(2), 50, 9000);
    expect(areTwins(state)).to.eq(false);
  });

  it('does not reject on divergence shorter than the tolerance', () => {
    let state = observe(initialTwinState(), pressed(0), pressed(0), TWIN_CONFIRM);
    state = updateTwinState(state, pressed(0), neutral(), 5000);
    state = updateTwinState(state, pressed(0), neutral(), 5000 + TWIN_DISAGREE_TOLERANCE_MS);
    expect(state.rejected).to.eq(false);
    expect(areTwins(state)).to.eq(true);
  });

  it('treats differing pad shapes as different devices', () => {
    const short: MappedPad = {buttons: [0, 0], axes: [0, 0]};
    expect(padsAgree(short, neutral())).to.eq(false);
  });

  describe('suppressedMirrors', () => {
    const raz = {node: 'js1', index: 1, steamVirtual: false};
    const steam0 = {node: 'js0', index: 0, steamVirtual: true};
    const steam2 = {node: 'js2', index: 2, steamVirtual: true};

    it('keeps the Steam Input view and drops the raw twin', () => {
      // The Steam view honours the player's configured layout, so it survives.
      const hidden = suppressedMirrors([steam0, raz, steam2], (a, b) =>
        (a === 'js0' && b === 'js1') || (a === 'js1' && b === 'js0'));
      expect([...hidden]).to.deep.eq(['js1']);
    });

    it('hides nothing when no pair is a twin (the mixed set-up)', () => {
      // One controller through Steam Input, another with it forced off: both
      // must survive, which is the whole reason twinhood is behavioural.
      const hidden = suppressedMirrors([steam0, raz, steam2], () => false);
      expect(hidden.size).to.eq(0);
    });

    it('keeps exactly one from a mutually-correlated group', () => {
      const hidden = suppressedMirrors([steam0, raz, steam2], () => true);
      expect(hidden.size).to.eq(2);
      expect(hidden.has('js0')).to.eq(false, 'the preferred survivor stays');
    });

    it('falls back to the lowest index when neither is a Steam view', () => {
      const a = {node: 'js3', index: 3, steamVirtual: false};
      const b = {node: 'js1', index: 1, steamVirtual: false};
      const hidden = suppressedMirrors([a, b], () => true);
      expect([...hidden]).to.deep.eq(['js3']);
    });

    it('never suppresses a lone device', () => {
      expect(suppressedMirrors([raz], () => true).size).to.eq(0);
    });
  });
});
