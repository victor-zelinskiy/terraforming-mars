import {expect} from 'chai';
import {
  AIM_ENGAGE_AT,
  AIM_HYSTERESIS_DEG,
  AIM_NEUTRAL_MS,
  AIM_REAIM_FRAMES,
  AIM_RELEASE_AT,
  DEFAULT_DEADZONE,
  GamepadIntent,
  GamepadSnapshot,
  HANDOVER_SILENCE_MS,
  NAV_REPEAT_DELAY_MS,
  NAV_REPEAT_INTERVAL_MS,
  PollState,
  SCROLL_DEADZONE,
  TRIGGER_PRESS_AT,
  TRIGGER_RELEASE_AT,
  decisiveEdge,
  diffSnapshots,
  electActivePad,
  emptySnapshot,
  initialElectionState,
  initialPollState,
  pollStatePending,
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
  return intents.map((i) => (
    i.kind === 'press' || i.kind === 'release' ? `${i.kind}:${i.button}` :
      i.kind === 'nav' ? `nav:${i.dir}:${i.repeat ? 'r' : 'f'}${i.analog === true ? ':s' : ''}` :
        i.kind === 'navEnd' ? `navEnd:${i.dir}` :
          i.kind === 'aim' ? `aim:${i.dir}` :
            i.kind === 'aimEnd' ? 'aimEnd' : 'scroll'));
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
    // The old direction ENDS before the new one begins (a coherent
    // down…up pairing per direction for press→release consumers).
    expect(kinds(r.intents)).to.deep.eq(['navEnd:down', 'nav:right:f']);
    // The delay re-armed: no repeat before it elapses.
    r = diffSnapshots(right, right, r.state, 50 + NAV_REPEAT_DELAY_MS - 1);
    expect(r.intents).to.be.empty;
  });

  it('releasing the direction emits its falling edge and clears the hold', () => {
    const down = snap({buttons: [13]});
    let r = diffSnapshots(emptySnapshot(), down, initialPollState(), 0);
    r = diffSnapshots(down, snap(), r.state, 100);
    expect(kinds(r.intents)).to.deep.eq(['navEnd:down']);
    expect(r.state.heldDir).to.eq(undefined);
    // The falling edge fires ONCE — a still-idle next frame is silent.
    r = diffSnapshots(snap(), snap(), r.state, 116);
    expect(r.intents).to.be.empty;
    r = diffSnapshots(snap(), down, r.state, 200);
    expect(kinds(r.intents)).to.deep.eq(['nav:down:f']);
  });

  it('a held repeat never carries a falling edge', () => {
    const held = snap({buttons: [12]}); // d-pad up
    let r = diffSnapshots(emptySnapshot(), held, initialPollState(), 0);
    r = diffSnapshots(held, held, r.state, NAV_REPEAT_DELAY_MS);
    expect(kinds(r.intents)).to.deep.eq(['nav:up:r']);
  });

  it('left stick navigates only past the radial deadzone, dominant axis wins', () => {
    const inside = snap({axes: [DEFAULT_DEADZONE - 0.02, 0, 0, 0]});
    let r = diffSnapshots(emptySnapshot(), inside, initialPollState(), 0);
    expect(r.intents).to.be.empty;

    // A strong deflection carries BOTH protocols: the analog-flagged nav
    // (list navigation) and the wheel-grade aim sector event.
    const left = snap({axes: [-0.8, 0.3, 0, 0]});
    r = diffSnapshots(emptySnapshot(), left, initialPollState(), 0);
    expect(kinds(r.intents)).to.deep.eq(['nav:left:f:s', 'aim:left']);

    const up = snap({axes: [0.2, -0.9, 0, 0]});
    r = diffSnapshots(emptySnapshot(), up, initialPollState(), 0);
    expect(kinds(r.intents)).to.deep.eq(['nav:up:f:s', 'aim:up']);
  });

  it('d-pad wins over the left stick (nav digital, aim engage suppressed)', () => {
    const both = snap({buttons: [12], axes: [0.9, 0, 0, 0]});
    const {intents} = diffSnapshots(emptySnapshot(), both, initialPollState(), 0);
    expect(kinds(intents)).to.deep.eq(['nav:up:f']);
  });

  describe('the AIM protocol (left stick → wheel focus)', () => {
    const stick = (x: number, y: number) => snap({axes: [x, y, 0, 0]});
    /** Step frames through the model, 8ms apart, collecting intent strings. */
    function walk(frames: ReadonlyArray<{x: number, y: number, dt?: number}>): {seen: Array<string>, state: PollState} {
      let state = initialPollState();
      let prev = emptySnapshot();
      let now = 1000;
      const seen: Array<string> = [];
      for (const f of frames) {
        now += f.dt ?? 8;
        const next = stick(f.x, f.y);
        const r = diffSnapshots(prev, next, state, now);
        seen.push(...kinds(r.intents).filter((k) => k.startsWith('aim')));
        state = r.state;
        prev = next;
      }
      return {seen, state};
    }

    it('engages only past the deliberate radius; drift never engages', () => {
      expect(walk([{x: AIM_ENGAGE_AT - 0.05, y: 0}]).seen).to.deep.eq([]);
      expect(walk([{x: 0.15, y: 0.1}, {x: 0.2, y: 0}, {x: 0.1, y: 0}]).seen).to.deep.eq([]); // drift
      expect(walk([{x: AIM_ENGAGE_AT + 0.05, y: 0}]).seen).to.deep.eq(['aim:right']);
    });

    it('commits (aimEnd) only after neutral HELD for the confirm window', () => {
      const settle = Math.ceil(AIM_NEUTRAL_MS / 8) + 1;
      const frames = [{x: 0.9, y: 0}, {x: 0.1, y: 0}];
      for (let i = 0; i < settle; i++) {
        frames.push({x: 0.05, y: 0});
      }
      expect(walk(frames).seen).to.deep.eq(['aim:right', 'aimEnd']);
    });

    it('a single noisy neutral frame never commits (tracking resumes)', () => {
      const r = walk([
        {x: 0.9, y: 0},
        {x: 0.1, y: 0}, // one noise frame at rest
        {x: 0.9, y: 0}, // deflection back — same sector, tracking resumes
        {x: 0.9, y: 0},
      ]);
      expect(r.seen).to.deep.eq(['aim:right']);
      expect(r.state.aimSector).to.eq('right');
    });

    it('circling the stick walks the sectors with angular hysteresis (no border flicker)', () => {
      // 0° → 90° → 180° → 270° full circle at full deflection.
      const circle = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
        .map((deg) => ({x: Math.cos(deg * Math.PI / 180), y: Math.sin(deg * Math.PI / 180)}));
      expect(walk(circle).seen).to.deep.eq(['aim:right', 'aim:down', 'aim:left', 'aim:up', 'aim:right']);
      // Resting ON the 45° border: the current sector keeps ownership.
      const border = Math.PI / 4;
      const flickery = [
        {x: 1, y: 0},
        {x: Math.cos(border - 0.02), y: Math.sin(border - 0.02)},
        {x: Math.cos(border + 0.02), y: Math.sin(border + 0.02)},
        {x: Math.cos(border - 0.02), y: Math.sin(border - 0.02)},
      ];
      expect(walk(flickery).seen).to.deep.eq(['aim:right']);
      // …but a decisive cross PAST the hysteresis margin hands over.
      const past = border + (AIM_HYSTERESIS_DEG + 3) * Math.PI / 180;
      expect(walk([{x: 1, y: 0}, {x: Math.cos(past), y: Math.sin(past)}]).seen)
        .to.deep.eq(['aim:right', 'aim:down']);
    });

    it('a release flick through the far sector does not re-aim (sustain rule)', () => {
      const r = walk([
        {x: 0.9, y: 0}, // engaged right
        {x: 0.2, y: 0}, // collapsing toward neutral — settle starts
        {x: -0.8, y: 0}, // the spring-back overshoot (1 fast frame left)
        {x: 0.1, y: 0}, // back inside release
        {x: 0.05, y: 0, dt: AIM_NEUTRAL_MS + 10}, // neutral holds
      ]);
      expect(r.seen).to.deep.eq(['aim:right', 'aimEnd']);
    });

    it('a SUSTAINED redeflection during settle re-aims instead of committing', () => {
      const frames = [{x: 0.9, y: 0}, {x: 0.2, y: 0}];
      for (let i = 0; i < AIM_REAIM_FRAMES; i++) {
        frames.push({x: -0.9, y: 0});
      }
      expect(walk(frames).seen).to.deep.eq(['aim:right', 'aim:left']);
    });

    it('the in-between band interrupts the neutral confirm (no commit while resting there)', () => {
      const mid = (AIM_ENGAGE_AT + AIM_RELEASE_AT) / 2;
      const r = walk([
        {x: 0.9, y: 0},
        {x: 0.2, y: 0},
        {x: mid, y: 0, dt: AIM_NEUTRAL_MS + 20}, // hovers in the band past the window
        {x: mid, y: 0, dt: AIM_NEUTRAL_MS + 20},
      ]);
      expect(r.seen).to.deep.eq(['aim:right']);
      expect(r.state.aimSector).to.eq('right');
    });

    it('pollStatePending keeps the poll loop alive through the neutral confirm', () => {
      expect(pollStatePending(initialPollState())).to.eq(false);
      const engaged = walk([{x: 0.9, y: 0}]).state;
      expect(pollStatePending(engaged)).to.eq(true);
      const settling = walk([{x: 0.9, y: 0}, {x: 0.05, y: 0}]).state;
      expect(pollStatePending(settling), 'still pending while neutral confirms').to.eq(true);
    });
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
    /** An incumbent that acted `ago` ms before `now`. */
    const drivenBy = (index: number, ago: number, now: number) => ({index, edgeAt: now - ago});

    it('keeps the incumbent while it is still engaged this frame', () => {
      // Two mirrored pads (Steam Input duplicate) both active — the incumbent
      // keeps driving, so the mirror can never also dispatch the same edge.
      const engaged = [{index: 0, active: true}, {index: 1, active: true}];
      expect(electActivePad(engaged, {index: 0, edgeAt: 1000}, 1000).index).to.eq(0);
      expect(electActivePad(engaged, {index: 1, edgeAt: 1000}, 1000).index).to.eq(1);
    });

    it('elects the first active pad when there is no incumbent (index -1)', () => {
      const engaged = [{index: 3, active: true}, {index: 5, active: true}];
      expect(electActivePad(engaged, initialElectionState(), 1000).index).to.eq(3);
    });

    it('keeps a releasing incumbent (engaged but not active) so its release dispatches', () => {
      expect(electActivePad([{index: 2, active: false}], drivenBy(2, 0, 5000), 5000).index).to.eq(2);
    });

    it('takes over with another active pad only once the incumbent is idle/gone', () => {
      // Incumbent 0 not in the frame (fully idle) → the other active pad drives.
      expect(electActivePad([{index: 1, active: true}], drivenBy(0, 0, 5000), 5000).index).to.eq(1);
    });

    it('holds the incumbent when nothing is engaged this frame', () => {
      expect(electActivePad([], drivenBy(0, 0, 5000), 5000).index).to.eq(0);
    });

    it('stamps edgeAt only when the elected pad actually acted', () => {
      const acted = electActivePad([{index: 0, active: true, edge: true}], drivenBy(0, 900, 5000), 5000);
      expect(acted.edgeAt).to.eq(5000);
      // Merely engaged (a release, a drifting stick) must NOT refresh the timer,
      // otherwise a noisy pad renews its own incumbency forever.
      const idle = electActivePad([{index: 0, active: true, edge: false}], drivenBy(0, 900, 5000), 5000);
      expect(idle.edgeAt).to.eq(4100);
    });

    // ── The docked Steam Deck report: built-in controls keep working, an
    //    external pad does nothing. A pad that is permanently `engaged` (a stick
    //    resting off-centre, a non-zero trigger rest value, a mid-flight aim)
    //    used to hold the wheel forever, because incumbency asked "engaged?"
    //    rather than "acting?".
    it('hands over to a pad that ACTS when a permanently-engaged incumbent has not', () => {
      const noisyIncumbent = {index: 0, active: true, edge: false};
      const pressedPad = {index: 1, active: true, edge: true};
      const next = electActivePad([noisyIncumbent, pressedPad], drivenBy(0, 5000, 9000), 9000);
      expect(next.index).to.eq(1);
      expect(next.edgeAt).to.eq(9000);
    });

    it('never lets a mirror steal the wheel mid-press (offset duplicate)', () => {
      // The mirror reports the SAME press one poll (8ms) after the driver did.
      // Inside the silence window the incumbent keeps the wheel, so the edge is
      // dispatched exactly once — the Steam Machine double-input protection.
      const engaged = [{index: 0, active: true, edge: true}, {index: 1, active: true, edge: false}];
      const next = electActivePad(engaged, drivenBy(1, 8, 3000), 3000);
      expect(next.index).to.eq(1);
    });

    it('requires the incumbent to be decision-silent for the full window', () => {
      const engaged = [{index: 0, active: true, edge: false}, {index: 1, active: true, edge: true}];
      const tooSoon = electActivePad(engaged, drivenBy(0, HANDOVER_SILENCE_MS - 1, 9000), 9000);
      expect(tooSoon.index).to.eq(0);
      const longEnough = electActivePad(engaged, drivenBy(0, HANDOVER_SILENCE_MS, 9000), 9000);
      expect(longEnough.index).to.eq(1);
    });

    it('lets a pad that acts take over from an incumbent that never acted', () => {
      // A pad elected by `gamepadconnected` alone carries edgeAt = 0; the pad
      // the player actually presses must win immediately, not 400ms later.
      const engaged = [{index: 0, active: true, edge: false}, {index: 1, active: true, edge: true}];
      expect(electActivePad(engaged, {index: 0, edgeAt: 0}, 50).index).to.eq(1);
    });
  });

  describe('decisiveEdge', () => {
    it('counts a deliberate act', () => {
      expect(decisiveEdge([{kind: 'press', button: 'confirm'}])).to.eq(true);
      expect(decisiveEdge([{kind: 'nav', dir: 'up', repeat: false}])).to.eq(true);
      expect(decisiveEdge([{kind: 'aim', dir: 'left'}])).to.eq(true);
    });

    it('ignores what an UNTOUCHED pad emits forever', () => {
      // Exactly the signals a resting/drifting pad produces — treating any of
      // them as "in use" is what locked a second controller out.
      expect(decisiveEdge([])).to.eq(false);
      expect(decisiveEdge([{kind: 'scroll', dx: 0.4, dy: 0}])).to.eq(false);
      expect(decisiveEdge([{kind: 'nav', dir: 'down', repeat: true}])).to.eq(false);
      expect(decisiveEdge([{kind: 'release', button: 'confirm'}])).to.eq(false);
      expect(decisiveEdge([{kind: 'navEnd', dir: 'up'}])).to.eq(false);
      expect(decisiveEdge([{kind: 'aimEnd'}])).to.eq(false);
    });
  });
});
