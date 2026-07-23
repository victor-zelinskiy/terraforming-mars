import {expect} from 'chai';
import {
  DEFAULT_DEADZONE,
  GamepadIntent,
  GamepadSnapshot,
  NAV_REPEAT_DELAY_MS,
  NAV_REPEAT_INTERVAL_MS,
  SCROLL_DEADZONE,
  TRIGGER_PRESS_AT,
  TRIGGER_RELEASE_AT,
  diffSnapshots,
  electActivePad,
  emptySnapshot,
  initialPollState,
  readSnapshot,
  snapshotActivity,
} from '@/client/gamepad/gamepadPollModel';

function snap(overrides: {buttons?: Array<number>, axes?: Array<number>} = {}): GamepadSnapshot {
  // buttons: list of pressed indices; triggers set via axesful value below.
  const buttons = Array.from({length: 17}, (_, i) => ({
    pressed: overrides.buttons?.includes(i) ?? false,
    value: overrides.buttons?.includes(i) ? 1 : 0,
  }));
  return {buttons, axes: overrides.axes ?? [0, 0, 0, 0]};
}

function triggerSnap(index: 6 | 7, value: number): GamepadSnapshot {
  const s = snap();
  const buttons = s.buttons.map((b, i) => (i === index ? {pressed: value > 0.5, value} : b));
  return {buttons, axes: s.axes};
}

function kinds(intents: Array<GamepadIntent>): Array<string> {
  return intents.map((i) => (i.kind === 'press' || i.kind === 'release' ? `${i.kind}:${i.button}` : i.kind === 'nav' ? `nav:${i.dir}:${i.repeat ? 'r' : 'f'}` : 'scroll'));
}

describe('gamepadPollModel', () => {
  it('emits press/release edges for digital buttons', () => {
    const s0 = emptySnapshot();
    const s1 = snap({buttons: [0]});
    const r1 = diffSnapshots(s0, s1, initialPollState(), 1000);
    expect(kinds(r1.intents)).to.deep.eq(['press:confirm']);

    const r2 = diffSnapshots(s1, s1, r1.state, 1016);
    expect(r2.intents).to.be.empty;

    const r3 = diffSnapshots(s1, snap(), r2.state, 1032);
    expect(kinds(r3.intents)).to.deep.eq(['release:confirm']);
  });

  it('maps the full standard-mapping button set to semantics', () => {
    const all = snap({buttons: [0, 1, 2, 3, 4, 5, 8, 9, 10, 11]});
    const {intents} = diffSnapshots(emptySnapshot(), all, initialPollState(), 0);
    expect(kinds(intents)).to.include.members([
      'press:confirm', 'press:back', 'press:secondary', 'press:inspect',
      'press:bumperL', 'press:bumperR', 'press:view', 'press:menu',
      'press:stickL', 'press:stickR',
    ]);
  });

  it('digitalizes analog triggers with hysteresis', () => {
    let state = initialPollState();
    // Below press threshold — nothing.
    let r = diffSnapshots(emptySnapshot(), triggerSnap(6, TRIGGER_PRESS_AT - 0.05), state, 0);
    expect(r.intents).to.be.empty;
    state = r.state;
    // Above threshold — press.
    r = diffSnapshots(emptySnapshot(), triggerSnap(6, TRIGGER_PRESS_AT + 0.05), state, 16);
    expect(kinds(r.intents)).to.deep.eq(['press:triggerL']);
    state = r.state;
    // In the hysteresis band — held, no release.
    r = diffSnapshots(emptySnapshot(), triggerSnap(6, TRIGGER_RELEASE_AT + 0.02), state, 32);
    expect(r.intents).to.be.empty;
    state = r.state;
    // Below release threshold — release.
    r = diffSnapshots(emptySnapshot(), triggerSnap(6, TRIGGER_RELEASE_AT - 0.05), state, 48);
    expect(kinds(r.intents)).to.deep.eq(['release:triggerL']);
  });

  it('fires a fresh nav immediately and repeats on the configured cadence', () => {
    const held = snap({buttons: [13]}); // d-pad down
    let r = diffSnapshots(emptySnapshot(), held, initialPollState(), 1000);
    expect(kinds(r.intents)).to.deep.eq(['nav:down:f']);

    // Held but before the initial delay — silent.
    r = diffSnapshots(held, held, r.state, 1000 + NAV_REPEAT_DELAY_MS - 1);
    expect(r.intents).to.be.empty;

    // Past the delay — first repeat.
    r = diffSnapshots(held, held, r.state, 1000 + NAV_REPEAT_DELAY_MS);
    expect(kinds(r.intents)).to.deep.eq(['nav:down:r']);

    // Next repeat rides the (shorter) interval.
    const t = 1000 + NAV_REPEAT_DELAY_MS;
    r = diffSnapshots(held, held, r.state, t + NAV_REPEAT_INTERVAL_MS - 1);
    expect(r.intents).to.be.empty;
    r = diffSnapshots(held, held, r.state, t + NAV_REPEAT_INTERVAL_MS);
    expect(kinds(r.intents)).to.deep.eq(['nav:down:r']);
  });

  it('a direction change fires immediately and re-arms the delay', () => {
    const down = snap({buttons: [13]});
    const right = snap({buttons: [15]});
    let r = diffSnapshots(emptySnapshot(), down, initialPollState(), 0);
    r = diffSnapshots(down, right, r.state, 50);
    expect(kinds(r.intents)).to.deep.eq(['nav:right:f']);
    // The delay re-armed: no repeat before it elapses.
    r = diffSnapshots(right, right, r.state, 50 + NAV_REPEAT_DELAY_MS - 1);
    expect(r.intents).to.be.empty;
  });

  it('releasing the direction clears the hold so the next press is fresh', () => {
    const down = snap({buttons: [13]});
    let r = diffSnapshots(emptySnapshot(), down, initialPollState(), 0);
    r = diffSnapshots(down, snap(), r.state, 100);
    expect(r.state.heldDir).to.eq(undefined);
    r = diffSnapshots(snap(), down, r.state, 200);
    expect(kinds(r.intents)).to.deep.eq(['nav:down:f']);
  });

  it('left stick navigates only past the radial deadzone, dominant axis wins', () => {
    const inside = snap({axes: [DEFAULT_DEADZONE - 0.02, 0, 0, 0]});
    let r = diffSnapshots(emptySnapshot(), inside, initialPollState(), 0);
    expect(r.intents).to.be.empty;

    const left = snap({axes: [-0.8, 0.3, 0, 0]});
    r = diffSnapshots(emptySnapshot(), left, initialPollState(), 0);
    expect(kinds(r.intents)).to.deep.eq(['nav:left:f']);

    const up = snap({axes: [0.2, -0.9, 0, 0]});
    r = diffSnapshots(emptySnapshot(), up, initialPollState(), 0);
    expect(kinds(r.intents)).to.deep.eq(['nav:up:f']);
  });

  it('d-pad wins over the left stick', () => {
    const both = snap({buttons: [12], axes: [0.9, 0, 0, 0]});
    const {intents} = diffSnapshots(emptySnapshot(), both, initialPollState(), 0);
    expect(kinds(intents)).to.deep.eq(['nav:up:f']);
  });

  it('right stick produces normalized scroll intents outside its deadzone', () => {
    const idle = snap({axes: [0, 0, SCROLL_DEADZONE - 0.05, 0]});
    let r = diffSnapshots(emptySnapshot(), idle, initialPollState(), 0);
    expect(r.intents).to.be.empty;

    const scrolling = snap({axes: [0, 0, 0, 1]});
    r = diffSnapshots(emptySnapshot(), scrolling, initialPollState(), 0);
    expect(r.intents).to.have.length(1);
    const intent = r.intents[0];
    expect(intent.kind).to.eq('scroll');
    if (intent.kind === 'scroll') {
      expect(intent.dx).to.eq(0);
      expect(intent.dy).to.be.closeTo(1, 0.001);
    }
  });

  it('tolerates snapshots with fewer buttons/axes (pad swap)', () => {
    const tiny: GamepadSnapshot = {buttons: [{pressed: true, value: 1}], axes: []};
    const {intents} = diffSnapshots(emptySnapshot(), tiny, initialPollState(), 0);
    expect(kinds(intents)).to.deep.eq(['press:confirm']);
  });

  it('snapshotActivity sees pressed buttons, trigger values and deflected sticks', () => {
    expect(snapshotActivity(emptySnapshot())).to.eq(false);
    expect(snapshotActivity(snap({buttons: [3]}))).to.eq(true);
    expect(snapshotActivity(triggerSnap(7, 0.5))).to.eq(true);
    expect(snapshotActivity(snap({axes: [0, 0.5, 0, 0]}))).to.eq(true);
    expect(snapshotActivity(snap({axes: [DEFAULT_DEADZONE - 0.01, 0, 0, 0]}))).to.eq(false);
  });

  it('readSnapshot copies values (no live-object retention)', () => {
    const live = {buttons: [{pressed: true, value: 0.7}], axes: [0.1, -0.2]};
    const copy = readSnapshot(live);
    live.buttons[0].pressed = false;
    live.axes[0] = 0.9;
    expect(copy.buttons[0].pressed).to.eq(true);
    expect(copy.axes[0]).to.eq(0.1);
  });

  describe('electActivePad (single-driver election)', () => {
    it('keeps the incumbent while it is still engaged this frame', () => {
      // Two mirrored pads (Steam Input duplicate) both active — the incumbent
      // keeps driving, so the mirror can never also dispatch the same edge.
      const engaged = [{index: 0, active: true}, {index: 1, active: true}];
      expect(electActivePad(engaged, 0)).to.eq(0);
      expect(electActivePad(engaged, 1)).to.eq(1);
    });

    it('elects the first active pad when there is no incumbent (index -1)', () => {
      expect(electActivePad([{index: 3, active: true}, {index: 5, active: true}], -1)).to.eq(3);
    });

    it('keeps a releasing incumbent (engaged but not active) so its release dispatches', () => {
      expect(electActivePad([{index: 2, active: false}], 2)).to.eq(2);
    });

    it('takes over with another active pad only once the incumbent is idle/gone', () => {
      // Incumbent 0 not in the frame (fully idle) → the other active pad drives.
      expect(electActivePad([{index: 1, active: true}], 0)).to.eq(1);
    });

    it('holds the incumbent when nothing is engaged this frame', () => {
      expect(electActivePad([], 0)).to.eq(0);
    });
  });
});
