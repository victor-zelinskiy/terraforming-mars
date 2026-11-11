import {expect} from 'chai';
import {computed, reactive} from 'vue';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {dumpFlowTree, resetFlowKernel} from '@/client/console/kernel/flowScope';
import {beginConsoleSession, endConsoleSession, resetConsoleSession} from '@/client/console/session/consoleSession';
import {createFlowRun, deriveFlowRun} from '@/client/console/session/flowRun';

/** Let every pending promise continuation run. */
async function flush(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

/**
 * A MODULE FLOW'S RUN IS A SCOPE (architecture v2 — PLAN §10 · C4). What a flow kept as a flag, a handful of timer ids
 * and a `clearTimeout` in every exit path is one scope: begun, ended once, and everything armed in it goes with it —
 * including when the game screen leaves under it.
 */
describe('flow run · a module flow\'s run is a scope of the session', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    resetConsoleSession();
    resetFlowKernel();
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    resetConsoleSession();
    setFlowClock(undefined);
  });

  it('begin opens `scene:<label>` in the session; end ends it — and the timers armed in it never fire', () => {
    const session = beginConsoleSession();
    const run = createFlowRun('spec-build');
    expect(run.live()).to.equal(false);
    expect(run.scope).to.equal(undefined);

    const scope = run.begin('armed');
    expect(scope.parent).to.equal(session);
    expect(scope.kind).to.equal('scene');
    expect(run.live()).to.equal(true);
    expect(dumpFlowTree().some((line) => /^ {2}scene:spec-build#\d+ .*armed/.test(line)), dumpFlowTree().join(' / ')).to.equal(true);

    let fired = 0;
    run.after(12_000, 'the arm\'s safety', () => fired++);
    run.afterFrame('measure', () => fired++);
    expect(clock.pending()).to.equal(2);

    run.end();
    run.end(); // idempotent — every exit path calls it
    expect(run.live()).to.equal(false);
    expect(scope.ended?.how).to.equal('done');
    expect(clock.pending(), 'nothing to clear: the run took its timers').to.equal(0);
    clock.advance(60_000);
    expect(fired).to.equal(0);
  });

  it('an owned timer fires at its time while the run stands; its cancel takes it back', () => {
    beginConsoleSession();
    const run = createFlowRun('spec-build');
    run.begin();
    const fired: Array<string> = [];
    run.after(100, 'a', () => fired.push('a'));
    const cancel = run.after(100, 'b', () => fired.push('b'));
    cancel();
    clock.advance(100);
    expect(fired).to.deep.equal(['a']);
  });

  it('`sleep` is a span of the run: true when it passed, false at once when the run ended first — or when none stands', async () => {
    beginConsoleSession();
    const run = createFlowRun('spec-build');
    expect(await run.sleep(50), 'at rest').to.equal(false);

    run.begin();
    const passed = run.sleep(50);
    clock.advance(50);
    expect(await passed).to.equal(true);

    const cut = run.sleep(5_000);
    run.end({how: 'cancelled', reason: 'aborted'});
    await flush();
    expect(await cut, 'the abort does not wait five seconds for its own beat').to.equal(false);
  });

  it('`guarantee` is a RELEASE of the run: at its time, at the run\'s end, at once with no run standing — never dropped', async () => {
    beginConsoleSession();
    const run = createFlowRun('spec-build');
    const released: Array<string> = [];

    // No run stands: it comes due at once — a microtask later, so a release that uses its own disarm is safe.
    const disarmLate = run.guarantee(120, 'the gate', () => {
      disarmLate();
      released.push('no run');
    });
    expect(released).to.deep.equal([]);
    await flush();
    expect(released, 'a release is never parked on nothing').to.deep.equal(['no run']);

    run.begin();
    run.guarantee(120, 'the gate', () => released.push('on time'));
    clock.advance(120);
    run.guarantee(5_000, 'the gate', () => released.push('aborted'));
    const disarm = run.guarantee(5_000, 'the gate', () => released.push('NEVER'));
    disarm();
    run.end({how: 'cancelled', reason: 'aborted'});
    expect(released).to.deep.equal(['no run', 'on time', 'aborted']);
    expect(clock.pending()).to.equal(0);
  });

  it('A NEW RUN OVER A STANDING ONE ends the old one first — a safety of the build that is over cannot abort the next', () => {
    beginConsoleSession();
    let orphaned = 0;
    const run = createFlowRun('spec-build', {orphaned: () => orphaned++});
    const aborted: Array<string> = [];
    const first = run.begin();
    run.after(12_000, 'the arm\'s safety', () => aborted.push('first'));

    const second = run.begin();
    run.after(12_000, 'the arm\'s safety', () => aborted.push('second'));
    expect(first.ended?.how).to.equal('cancelled');
    expect(second.ended).to.equal(undefined);
    expect(orphaned, 'replaced by its own flow — not orphaned').to.equal(0);

    clock.advance(12_000);
    expect(aborted).to.deep.equal(['second']);
  });

  it('THE GAME SCREEN LEFT under a run: it is cancelled and `orphaned` brings the module to rest — once; an ended run is not orphaned', () => {
    beginConsoleSession();
    const state = {active: false};
    let orphaned = 0;
    const run = createFlowRun('spec-build', {
      orphaned: () => {
        orphaned++;
        state.active = false;
        run.end(); // the module's abort calls end — nothing left to end
      },
    });
    run.begin();
    state.active = true;
    let fired = 0;
    run.after(1_000, 'next beat', () => fired++);

    endConsoleSession();

    expect(orphaned).to.equal(1);
    expect(state.active, 'no reset row is what kept it out of the next game').to.equal(false);
    expect(run.live()).to.equal(false);
    clock.advance(10_000);
    expect(fired).to.equal(0);

    // A run that ended in its own time is not touched by the session's end.
    beginConsoleSession();
    run.begin();
    run.end();
    endConsoleSession();
    expect(orphaned).to.equal(1);
  });

  it('`live()` is reactive — a computed (a hold\'s predicate) follows the run', () => {
    beginConsoleSession();
    const run = createFlowRun('spec-build');
    const holding = computed(() => run.live());
    expect(holding.value).to.equal(false);
    run.begin();
    expect(holding.value).to.equal(true);
    run.end();
    expect(holding.value).to.equal(false);
  });

  it('an `orphaned` that throws is said once and breaks nothing', () => {
    beginConsoleSession();
    const warned: Array<string> = [];
    const warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      warned.push(String(args[0]));
    };
    try {
      const run = createFlowRun('spec-build', {
        orphaned: () => {
          throw new Error('boom');
        },
      });
      run.begin();
      endConsoleSession();
      expect(run.live()).to.equal(false);
    } finally {
      console.warn = warn;
    }
    expect(warned.filter((line) => line.includes('«orphaned» recovery threw'))).to.have.length(1);
  });

  it('a run DERIVED from a record stands exactly while the record says so — whoever wrote it — and its orphaning resets the record', () => {
    beginConsoleSession();
    const record = reactive({promised: undefined as string | undefined, owed: undefined as string | undefined, live: false});
    let orphaned = 0;
    const derived = deriveFlowRun('spec-walk', () => record.promised !== undefined || record.owed !== undefined || record.live, {
      orphaned: () => {
        orphaned++;
        Object.assign(record, {promised: undefined, owed: undefined, live: false});
      },
      detail: () => record.owed ?? record.promised ?? '',
    });
    try {
      expect(derived.scope, 'at rest').to.equal(undefined);

      record.promised = 'hand'; // the press
      const run = derived.scope;
      expect(run?.ended).to.equal(undefined);
      expect(run?.detail).to.equal('hand');
      record.owed = 'hand'; // the seed — the same run, no second scope
      record.promised = undefined;
      record.live = true; // the section plays it
      expect(derived.scope).to.equal(run);

      Object.assign(record, {promised: undefined, owed: undefined, live: false}); // a reset, by assignment
      expect(run?.ended?.how).to.equal('done');
      expect(derived.scope).to.equal(undefined);
      expect(orphaned, 'ended by its own state — not orphaned').to.equal(0);

      record.owed = 'parliament';
      const second = derived.scope;
      endConsoleSession(); // the game screen leaves under it
      expect(second?.ended?.how).to.equal('cancelled');
      expect(orphaned).to.equal(1);
      expect(record.owed, 'the record was brought to rest by the flow itself').to.equal(undefined);
    } finally {
      derived.stop();
    }
  });
});
