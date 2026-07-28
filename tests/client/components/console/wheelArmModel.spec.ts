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

const down = (dir: 'up' | 'down' | 'left' | 'right', opts: {repeat?: boolean, analog?: boolean} = {}): WheelArmEvent =>
  ({type: 'navDown', dir, repeat: opts.repeat === true, analog: opts.analog === true});
const up = (dir: 'up' | 'down' | 'left' | 'right'): WheelArmEvent => ({type: 'navUp', dir});

describe('wheelArmModel', () => {
  describe('digital (d-pad / A): arm on DOWN, commit on UP', () => {
    it('a d-pad tap arms on the down edge and commits on the up edge', () => {
      const r = run([down('up'), up('up')]);
      expect(r.effects).to.deep.eq(['commit:up']);
      expect(r.arm).to.eq(undefined);
    });

    it('A arms the centre and commits on its release', () => {
      const r = run([{type: 'confirmDown'}, {type: 'confirmUp'}]);
      expect(r.effects).to.deep.eq(['commit:center']);
    });

    it('the mid-hold state is visible: armed after down, gone after up', () => {
      const d = reduceWheelArm(undefined, down('left'), slots());
      expect(d.arm).to.deep.eq({slot: 'left', source: 'nav', dir: 'left', blocked: false});
      const u = reduceWheelArm(d.arm, up('left'), slots());
      expect(u.arm).to.eq(undefined);
    });

    it('hold-repeat never arms (a direction held from before the wheel opened)', () => {
      expect(run([down('down', {repeat: true}), up('down')]).effects).to.be.empty;
    });

    it('a stale release (control already down at open) commits nothing', () => {
      expect(run([up('right')]).effects).to.be.empty;
      expect(run([{type: 'confirmUp'}]).effects).to.be.empty;
    });

    it('rocking the d-pad re-arms onto the live direction; the final release commits it', () => {
      const rock = run([down('up'), down('right'), up('up'), up('right')]);
      expect(rock.effects).to.deep.eq(['commit:right']);
    });

    it('first-wins across families: d-pad cannot steal a confirm arm (and vice versa)', () => {
      const confirmFirst = run([{type: 'confirmDown'}, down('up'), up('up'), {type: 'confirmUp'}]);
      expect(confirmFirst.effects).to.deep.eq(['commit:center']);
      const navFirst = run([down('left'), {type: 'confirmDown'}, {type: 'confirmUp'}, up('left')]);
      expect(navFirst.effects).to.deep.eq(['commit:left']);
    });

    it('B cancels an armed slot: the wheel dismisses and the later release is inert', () => {
      const r = run([down('up'), {type: 'cancel'}, up('up')]);
      expect(r.effects).to.deep.eq(['dismiss']);
    });

    it('a blocked slot arms in blocked mode and REFUSES on release', () => {
      const table = slots(['left']);
      const d = reduceWheelArm(undefined, down('left'), table);
      expect(d.arm?.blocked).to.eq(true);
      const u = reduceWheelArm(d.arm, up('left'), table);
      expect(u.effect).to.deep.eq({kind: 'refuse', slot: 'left'});
    });

    it('a direction with no entry arms nothing', () => {
      expect(run([down('down'), up('down')], slots([], ['down'])).effects).to.be.empty;
    });

    it('reset (LT↔RT switch / wheel closed) dissolves the arm silently', () => {
      expect(run([{type: 'confirmDown'}, {type: 'reset'}, {type: 'confirmUp'}]).effects).to.be.empty;
    });

    it('a re-press while confirm-armed refreshes the arm (self-heal), one commit total', () => {
      const r = run([{type: 'confirmDown'}, {type: 'confirmDown'}, {type: 'confirmUp'}, {type: 'confirmUp'}]);
      expect(r.effects).to.deep.eq(['commit:center']);
    });
  });

  describe('analog (left stick): focus follows the sector, neutral commits', () => {
    it('aim focuses, aimEnd commits the focused slot', () => {
      const r = run([{type: 'aim', dir: 'right'}, {type: 'aimEnd'}]);
      expect(r.effects).to.deep.eq(['commit:right']);
    });

    it('circling re-focuses freely — only the FINAL sector commits', () => {
      const r = run([
        {type: 'aim', dir: 'right'},
        {type: 'aim', dir: 'down'},
        {type: 'aim', dir: 'left'},
        {type: 'aim', dir: 'up'},
        {type: 'aimEnd'},
      ]);
      expect(r.effects).to.deep.eq(['commit:up']);
    });

    it('a stick-sourced nav NEVER digital-arms (the aim protocol owns the stick)', () => {
      const r = run([down('right', {analog: true}), up('right')]);
      expect(r.effects).to.be.empty;
    });

    it('an aimEnd without engagement commits nothing', () => {
      expect(run([{type: 'aimEnd'}]).effects).to.be.empty;
    });

    it('B during tracking cancels; the later aimEnd is inert', () => {
      const r = run([{type: 'aim', dir: 'left'}, {type: 'cancel'}, {type: 'aimEnd'}]);
      expect(r.effects).to.deep.eq(['dismiss']);
    });

    it('the d-pad TAKES OVER a stick focus; the stale aimEnd drops, the d-pad release commits', () => {
      const r = run([
        {type: 'aim', dir: 'right'},
        down('up'),
        {type: 'aimEnd'},
        up('up'),
      ]);
      expect(r.effects).to.deep.eq(['commit:up']);
    });

    it('A pressed during tracking is ignored (first-wins), its release too', () => {
      const r = run([
        {type: 'aim', dir: 'down'},
        {type: 'confirmDown'},
        {type: 'confirmUp'},
        {type: 'aimEnd'},
      ]);
      expect(r.effects).to.deep.eq(['commit:down']);
    });

    it('the merged navEnd finishes a d-pad arm even when the stick let go last', () => {
      // D-pad armed 'right', stick also held right; the d-pad releases first
      // (no navEnd — the merged direction persists via the stick), then the
      // stick lets go → ONE navEnd commits the digital arm.
      const r = run([down('right'), up('right')]);
      expect(r.effects).to.deep.eq(['commit:right']);
    });

    it('a blocked slot focused by the stick REFUSES on neutral', () => {
      const table = slots(['left']);
      const r = run([{type: 'aim', dir: 'left'}, {type: 'aimEnd'}], table);
      expect(r.effects).to.deep.eq(['refuse:left']);
    });

    it('aiming at an EMPTY sector clears the focus — neutral then commits nothing', () => {
      const r = run([
        {type: 'aim', dir: 'right'},
        {type: 'aim', dir: 'down'},
        {type: 'aimEnd'},
      ], slots([], ['down']));
      expect(r.effects).to.be.empty;
    });
  });
});
