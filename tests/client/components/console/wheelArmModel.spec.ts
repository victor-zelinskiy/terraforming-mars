import {expect} from 'chai';
import {WheelArm, WheelArmEvent, reduceWheelArm} from '@/client/console/quickWheel/wheelArmModel';
import {QuickSlot} from '@/client/console/consoleQuickModel';

/** A standard five-slot wheel; `blocked` slots exist but are unavailable. */
function slots(blocked: ReadonlyArray<QuickSlot> = [], missing: ReadonlyArray<QuickSlot> = []) {
  return {
    has: (slot: QuickSlot) => !missing.includes(slot),
    available: (slot: QuickSlot) => !blocked.includes(slot) && !missing.includes(slot),
  };
}

function run(events: ReadonlyArray<WheelArmEvent>, table = slots()): {arm: WheelArm | undefined, effects: Array<string>} {
  let arm: WheelArm | undefined = undefined;
  const effects: Array<string> = [];
  for (const event of events) {
    const r = reduceWheelArm(arm, event, table);
    arm = r.arm;
    if (r.effect.kind === 'commit' || r.effect.kind === 'refuse') {
      effects.push(`${r.effect.kind}:${r.effect.slot}`);
    } else if (r.effect.kind === 'dismiss') {
      effects.push('dismiss');
    }
  }
  return {arm, effects};
}

describe('wheelArmModel', () => {
  it('a d-pad tap arms on the down edge and commits on the up edge', () => {
    const r = run([
      {type: 'navDown', dir: 'up', repeat: false},
      {type: 'navUp', dir: 'up'},
    ]);
    expect(r.effects).to.deep.eq(['commit:up']);
    expect(r.arm).to.eq(undefined);
  });

  it('A arms the centre and commits on its release', () => {
    const r = run([{type: 'confirmDown'}, {type: 'confirmUp'}]);
    expect(r.effects).to.deep.eq(['commit:center']);
  });

  it('the mid-hold state is visible: armed after down, gone after up', () => {
    const down = reduceWheelArm(undefined, {type: 'navDown', dir: 'left', repeat: false}, slots());
    expect(down.arm).to.deep.eq({slot: 'left', source: 'nav', dir: 'left', blocked: false});
    const up = reduceWheelArm(down.arm, {type: 'navUp', dir: 'left'}, slots());
    expect(up.arm).to.eq(undefined);
  });

  it('hold-repeat never arms (a direction held from before the wheel opened)', () => {
    const r = run([
      {type: 'navDown', dir: 'down', repeat: true},
      {type: 'navUp', dir: 'down'},
    ]);
    expect(r.effects).to.be.empty;
  });

  it('a stale release (control already down at open) commits nothing', () => {
    expect(run([{type: 'navUp', dir: 'right'}]).effects).to.be.empty;
    expect(run([{type: 'confirmUp'}]).effects).to.be.empty;
  });

  it('rocking the d-pad re-arms onto the live direction; the final release commits it', () => {
    // up down → right down (rock) → up's stale release → right's release.
    const rock = run([
      {type: 'navDown', dir: 'up', repeat: false},
      {type: 'navDown', dir: 'right', repeat: false},
      {type: 'navUp', dir: 'up'},
      {type: 'navUp', dir: 'right'},
    ]);
    expect(rock.effects).to.deep.eq(['commit:right']);
  });

  it('first-wins across sources: d-pad cannot steal a confirm arm (and vice versa)', () => {
    const confirmFirst = run([
      {type: 'confirmDown'},
      {type: 'navDown', dir: 'up', repeat: false},
      {type: 'navUp', dir: 'up'},
      {type: 'confirmUp'},
    ]);
    expect(confirmFirst.effects).to.deep.eq(['commit:center']);
    const navFirst = run([
      {type: 'navDown', dir: 'left', repeat: false},
      {type: 'confirmDown'},
      {type: 'confirmUp'},
      {type: 'navUp', dir: 'left'},
    ]);
    expect(navFirst.effects).to.deep.eq(['commit:left']);
  });

  it('B cancels an armed slot: the wheel dismisses and the later release is inert', () => {
    const r = run([
      {type: 'navDown', dir: 'up', repeat: false},
      {type: 'cancel'},
      {type: 'navUp', dir: 'up'},
    ]);
    expect(r.effects).to.deep.eq(['dismiss']);
  });

  it('a blocked slot arms in blocked mode and REFUSES on release', () => {
    const table = slots(['left']);
    const down = reduceWheelArm(undefined, {type: 'navDown', dir: 'left', repeat: false}, table);
    expect(down.arm?.blocked).to.eq(true);
    const up = reduceWheelArm(down.arm, {type: 'navUp', dir: 'left'}, table);
    expect(up.effect).to.deep.eq({kind: 'refuse', slot: 'left'});
  });

  it('a direction with no entry arms nothing', () => {
    const r = run([
      {type: 'navDown', dir: 'down', repeat: false},
      {type: 'navUp', dir: 'down'},
    ], slots([], ['down']));
    expect(r.effects).to.be.empty;
  });

  it('reset (LT↔RT switch / wheel closed) dissolves the arm silently', () => {
    const r = run([
      {type: 'confirmDown'},
      {type: 'reset'},
      {type: 'confirmUp'},
    ]);
    expect(r.effects).to.be.empty;
  });

  it('a re-press while confirm-armed refreshes the arm (self-heal), one commit total', () => {
    const r = run([
      {type: 'confirmDown'},
      {type: 'confirmDown'},
      {type: 'confirmUp'},
      {type: 'confirmUp'},
    ]);
    expect(r.effects).to.deep.eq(['commit:center']);
  });
});
