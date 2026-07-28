import {expect} from 'chai';
import {
  WheelArmEvent,
  WheelInputState,
  initialWheelInput,
  reduceWheel,
  stepWheelFocus,
} from '@/client/console/quickWheel/wheelArmModel';
import {WheelControlMode} from '@/client/console/quickWheel/wheelControlMode';
import {QuickSlot} from '@/client/console/consoleQuickModel';

/** A standard five-slot wheel; `blocked` slots exist but are unavailable. */
function slots(blocked: ReadonlyArray<QuickSlot> = [], missing: ReadonlyArray<QuickSlot> = []) {
  return {
    has: (slot: QuickSlot) => !missing.includes(slot),
    available: (slot: QuickSlot) => !blocked.includes(slot) && !missing.includes(slot),
  };
}

function run(mode: WheelControlMode, events: ReadonlyArray<WheelArmEvent>, table = slots()) {
  let state: WheelInputState = initialWheelInput();
  const effects: Array<string> = [];
  for (const event of events) {
    const r = reduceWheel(state, event, mode, table);
    state = r.state;
    if (r.effect.kind === 'commit' || r.effect.kind === 'refuse') {
      effects.push(`${r.effect.kind}:${r.effect.slot}`);
    } else if (r.effect.kind === 'dismiss') {
      effects.push('dismiss');
    }
  }
  return {state, effects};
}

const down = (dir: 'up' | 'down' | 'left' | 'right', opts: {repeat?: boolean, analog?: boolean} = {}): WheelArmEvent =>
  ({type: 'navDown', dir, repeat: opts.repeat === true, analog: opts.analog === true});
const up = (dir: 'up' | 'down' | 'left' | 'right'): WheelArmEvent => ({type: 'navUp', dir});

describe('wheelArmModel', () => {
  describe('QUICK-SELECT (regression: the shipped press→release model)', () => {
    const qs = (events: ReadonlyArray<WheelArmEvent>, table = slots()) => run('quick-select', events, table);

    it('a d-pad tap arms on the down edge and commits on the up edge', () => {
      const r = qs([down('up'), up('up')]);
      expect(r.effects).to.deep.eq(['commit:up']);
      expect(r.state.arm).to.eq(undefined);
    });

    it('A arms the centre and commits on its release', () => {
      expect(qs([{type: 'confirmDown'}, {type: 'confirmUp'}]).effects).to.deep.eq(['commit:center']);
    });

    it('hold-repeat and stick-flagged nav never arm', () => {
      expect(qs([down('down', {repeat: true}), up('down')]).effects).to.be.empty;
      expect(qs([down('right', {analog: true}), up('right')]).effects).to.be.empty;
    });

    it('a stale release commits nothing', () => {
      expect(qs([up('right')]).effects).to.be.empty;
      expect(qs([{type: 'confirmUp'}]).effects).to.be.empty;
    });

    it('rocking re-arms; the final release commits the live direction', () => {
      expect(qs([down('up'), down('right'), up('up'), up('right')]).effects).to.deep.eq(['commit:right']);
    });

    it('first-wins across families (A vs d-pad, both orders)', () => {
      expect(qs([{type: 'confirmDown'}, down('up'), up('up'), {type: 'confirmUp'}]).effects).to.deep.eq(['commit:center']);
      expect(qs([down('left'), {type: 'confirmDown'}, {type: 'confirmUp'}, up('left')]).effects).to.deep.eq(['commit:left']);
    });

    it('B cancels an armed slot; the later release is inert', () => {
      expect(qs([down('up'), {type: 'cancel'}, up('up')]).effects).to.deep.eq(['dismiss']);
    });

    it('a blocked slot arms in blocked mode and REFUSES on release', () => {
      expect(qs([down('left'), up('left')], slots(['left'])).effects).to.deep.eq(['refuse:left']);
    });

    it('aim focuses, aimEnd commits; circling commits only the FINAL sector', () => {
      const r = qs([
        {type: 'aim', dir: 'right'},
        {type: 'aim', dir: 'down'},
        {type: 'aim', dir: 'up'},
        {type: 'aimEnd'},
      ]);
      expect(r.effects).to.deep.eq(['commit:up']);
    });

    it('the d-pad takes over a stick focus; the stale aimEnd drops', () => {
      const r = qs([{type: 'aim', dir: 'right'}, down('up'), {type: 'aimEnd'}, up('up')]);
      expect(r.effects).to.deep.eq(['commit:up']);
    });

    it('A during stick tracking is ignored (first-wins)', () => {
      const r = qs([{type: 'aim', dir: 'down'}, {type: 'confirmDown'}, {type: 'confirmUp'}, {type: 'aimEnd'}]);
      expect(r.effects).to.deep.eq(['commit:down']);
    });

    it('an action that died between press and release REFUSES (live re-check)', () => {
      let avail = true;
      const table = {has: () => true, available: () => avail};
      let state = initialWheelInput();
      let r = reduceWheel(state, down('up'), 'quick-select', table);
      state = r.state;
      avail = false; // the server moved on mid-hold
      r = reduceWheel(state, up('up'), 'quick-select', table);
      expect(r.effect).to.deep.eq({kind: 'refuse', slot: 'up'});
    });

    it('reset dissolves everything silently', () => {
      expect(qs([{type: 'confirmDown'}, {type: 'reset'}, {type: 'confirmUp'}]).effects).to.be.empty;
    });
  });

  describe('FOCUS-CONFIRM (persistent focus, A commits it)', () => {
    const fc = (events: ReadonlyArray<WheelArmEvent>, table = slots()) => run('focus-confirm', events, table);

    it('every wheel starts at the fixed HOME focus (the centre tile)', () => {
      expect(initialWheelInput().focus).to.eq('center');
    });

    it('an immediate A confirms the default focus', () => {
      expect(fc([{type: 'confirmDown'}, {type: 'confirmUp'}]).effects).to.deep.eq(['commit:center']);
    });

    it('d-pad moves the focus; its release executes NOTHING', () => {
      const r = fc([down('right'), up('right')]);
      expect(r.effects).to.be.empty;
      expect(r.state.focus).to.eq('right');
    });

    it('the stick moves the focus; the confirmed neutral executes NOTHING', () => {
      const r = fc([{type: 'aim', dir: 'left'}, {type: 'aimEnd'}]);
      expect(r.effects).to.be.empty;
      expect(r.state.focus).to.eq('left');
    });

    it('the stick reaches the CENTRE: an opposite deflection returns home', () => {
      // The centre is not a sector — the stick walks the d-pad's map, so
      // «Стандартные проекты» / «Карты» stay reachable without the d-pad.
      const r = fc([{type: 'aim', dir: 'right'}, {type: 'aim', dir: 'left'}]);
      expect(r.state.focus).to.eq('center');
      expect(r.effects).to.be.empty;
    });

    it('re-deflecting into the SAME arm after neutral keeps the focus (felt edge)', () => {
      const r = fc([
        {type: 'aim', dir: 'up'},
        {type: 'aimEnd'}, // released to neutral — focus survives
        {type: 'aim', dir: 'up'}, // pointed there again
      ]);
      expect(r.state.focus).to.eq('up');
    });

    it('a neutral return NEVER steals the focus (the player is reaching for A)', () => {
      const r = fc([{type: 'aim', dir: 'left'}, {type: 'aimEnd'}, {type: 'confirmDown'}, {type: 'confirmUp'}]);
      expect(r.effects).to.deep.eq(['commit:left']);
    });

    it('circling the stick walks the focus; only A commits', () => {
      const r = fc([
        {type: 'aim', dir: 'right'},
        {type: 'aim', dir: 'down'},
        {type: 'aim', dir: 'left'},
        {type: 'aimEnd'},
        {type: 'confirmDown'},
        {type: 'confirmUp'},
      ]);
      expect(r.effects).to.deep.eq(['commit:left']);
    });

    it('A confirms ANY focused tile, not just the centre', () => {
      expect(fc([down('up'), {type: 'confirmDown'}, {type: 'confirmUp'}]).effects).to.deep.eq(['commit:up']);
    });

    it('A press FIXES the action: navigation during the hold cannot swap it', () => {
      const r = fc([
        down('right'),
        {type: 'confirmDown'},
        down('left'), // frozen
        {type: 'aim', dir: 'up'}, // frozen
        {type: 'confirmUp'},
      ]);
      expect(r.effects).to.deep.eq(['commit:right']);
      expect(r.state.focus).to.eq('right'); // the focus never silently moved
    });

    it('A while the stick is still deflected confirms the CURRENT focus', () => {
      const r = fc([{type: 'aim', dir: 'down'}, {type: 'confirmDown'}, {type: 'confirmUp'}]);
      expect(r.effects).to.deep.eq(['commit:down']);
    });

    it('B during a held A cancels; the later A release is inert', () => {
      expect(fc([{type: 'confirmDown'}, {type: 'cancel'}, {type: 'confirmUp'}]).effects).to.deep.eq(['dismiss']);
    });

    it('a blocked tile stays focusable; A REFUSES and the focus survives', () => {
      const r = fc([down('left'), {type: 'confirmDown'}, {type: 'confirmUp'}], slots(['left']));
      expect(r.effects).to.deep.eq(['refuse:left']);
      expect(r.state.focus).to.eq('left');
    });

    it('an action that died between A press and release REFUSES', () => {
      let avail = true;
      const table = {has: () => true, available: () => avail};
      let state = initialWheelInput();
      state = reduceWheel(state, down('up'), 'focus-confirm', table).state;
      state = reduceWheel(state, {type: 'confirmDown'}, 'focus-confirm', table).state;
      avail = false;
      const r = reduceWheel(state, {type: 'confirmUp'}, 'focus-confirm', table);
      expect(r.effect).to.deep.eq({kind: 'refuse', slot: 'up'});
    });

    it('gamepad repeat of a direction never moves twice per press, and repeats never commit', () => {
      const r = fc([down('right'), down('right', {repeat: true}), down('right', {repeat: true})]);
      expect(r.state.focus).to.eq('right');
      expect(r.effects).to.be.empty;
    });

    it('reset (LT↔RT switch / mode change) returns to the home focus, never executing', () => {
      const r = fc([down('up'), {type: 'confirmDown'}, {type: 'reset'}, {type: 'confirmUp'}]);
      expect(r.effects).to.be.empty;
      expect(r.state.focus).to.eq('center');
    });
  });

  describe('stepWheelFocus (the explicit d-pad neighbourhood map)', () => {
    const has = () => true;

    it('from the centre a direction reaches its arm tile', () => {
      expect(stepWheelFocus('center', 'up', has)).to.eq('up');
      expect(stepWheelFocus('center', 'left', has)).to.eq('left');
    });

    it('the OPPOSITE direction returns to the centre', () => {
      expect(stepWheelFocus('up', 'down', has)).to.eq('center');
      expect(stepWheelFocus('left', 'right', has)).to.eq('center');
    });

    it('a PERPENDICULAR direction crosses to that arm', () => {
      expect(stepWheelFocus('up', 'left', has)).to.eq('left');
      expect(stepWheelFocus('right', 'down', has)).to.eq('down');
    });

    it('the SAME direction is the felt edge', () => {
      expect(stepWheelFocus('up', 'up', has)).to.eq('up');
      expect(stepWheelFocus('down', 'down', has)).to.eq('down');
    });

    it('a missing slot keeps the focus (stable, never a surprise jump)', () => {
      const missingLeft = (s: QuickSlot) => s !== 'left';
      expect(stepWheelFocus('center', 'left', missingLeft)).to.eq('center');
      expect(stepWheelFocus('up', 'left', missingLeft)).to.eq('up');
    });
  });
});
