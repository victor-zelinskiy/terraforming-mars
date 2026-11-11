import {expect} from 'chai';
import {reactive} from 'vue';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {dumpFlowTree, resetFlowKernel, waitTable} from '@/client/console/kernel/flowScope';
import {
  animationHoldCount, beginAnimationHold, expireActiveAnimationHolds, expireAnimationHoldNow, refreshAnimationHolds,
  registerAnimationHoldSupplier, resetAnimationHoldsForTest, unregisterAnimationHoldSupplier,
} from '@/client/components/presentation/animationHold';
import {beginConsoleSession, endConsoleSession, resetConsoleSession} from '@/client/console/session/consoleSession';

/**
 * EVERY HOLD IS A RUN OF THE FLOW TREE (architecture v2 — PLAN §10 · C2). A hold that stands is a `scene` scope in the
 * session that stands when it rises; its ceiling is a timer that scope owns; and it ends exactly once — released,
 * expired, or WITH ITS SESSION. The last one is the property the registry did not have: a hold raised in a game that is
 * gone cannot stand into the next one.
 *
 * The suite counts only its OWN holds (labels `spec-run-*`): the registry is shared by every spec of the process.
 */
describe('animation holds · every hold is a run of the flow tree', () => {
  let clock: ManualFlowClock;
  let warn: typeof console.warn;
  let warned: Array<string>;
  const flag = reactive({on: false});

  const scenes = (): Array<string> => dumpFlowTree().filter((line) => /scene:hold:spec-run/.test(line)).map((line) => line.trim().split(' ')[0]);
  const ceilings = (): number => waitTable().filter((row) => row.family === 'timer' && /scene:hold:spec-run/.test(row.owner)).length;

  beforeEach(() => {
    resetAnimationHoldsForTest();
    resetConsoleSession();
    resetFlowKernel();
    clock = createManualClock(Date.now());
    setFlowClock(clock);
    flag.on = false;
    warned = [];
    warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      warned.push(String(args[0]));
    };
  });
  afterEach(() => {
    console.warn = warn;
    unregisterAnimationHoldSupplier('spec-run-supplier');
    resetAnimationHoldsForTest();
    resetConsoleSession();
    setFlowClock(undefined);
  });

  it('a manual hold is a `scene` scope in the session; releasing it ends the scope and takes the ceiling\'s timer with it', () => {
    const session = beginConsoleSession();
    const before = animationHoldCount();
    const hold = beginAnimationHold('spec-run-manual');

    expect(hold.scope.kind).to.equal('scene');
    expect(hold.scope.parent).to.equal(session);
    expect(scenes()).to.have.length(1);
    expect(ceilings(), 'the ceiling is a timer the run owns — a row of the wait table').to.equal(1);
    expect(animationHoldCount()).to.equal(before + 1);

    hold.release();
    hold.release(); // idempotent
    expect(hold.scope.ended?.how).to.equal('done');
    expect(scenes()).to.deep.equal([]);
    expect(ceilings()).to.equal(0);
    expect(animationHoldCount()).to.equal(before);
  });

  it('the ceiling runs on the kernel\'s clock: past it the hold is dropped, the owner\'s recovery runs, the run is `expired`', () => {
    beginConsoleSession();
    let recovered = 0;
    const hold = beginAnimationHold('spec-run-leaked', {maxHoldMs: 5_000, expire: () => recovered++});

    clock.advance(4_999);
    expect(hold.scope.ended).to.equal(undefined);
    clock.advance(1);

    expect(hold.scope.ended?.how).to.equal('expired');
    expect(recovered).to.equal(1);
    expect(warned.some((line) => line.includes('"spec-run-leaked" held for over 5000ms'))).to.equal(true);
    hold.release(); // a late release is nothing
    expect(recovered).to.equal(1);
  });

  it('a beat\'s own timer lives IN the hold\'s scope — it never fires after the hold let go', () => {
    beginConsoleSession();
    const hold = beginAnimationHold('spec-run-beat');
    let fired = 0;
    hold.scope.after(300, 'the beat\'s next step', () => fired++);

    hold.release();
    clock.advance(1_000);
    expect(fired, 'a timer nobody owns would have fired into whatever stands there by then').to.equal(0);
  });

  it('THE GAME SCREEN LEFT: a manual hold nobody released goes with its session, through its owner\'s recovery', () => {
    beginConsoleSession();
    const before = animationHoldCount();
    let recovered = 0;
    const hold = beginAnimationHold('spec-run-orphan', {expire: () => recovered++});
    expect(animationHoldCount()).to.equal(before + 1);

    endConsoleSession();

    expect(hold.scope.ended?.how).to.equal('cancelled');
    expect(animationHoldCount(), 'the next game does not start under a dead game\'s hold').to.equal(before);
    expect(recovered, 'the wedge behind it ends too').to.equal(1);
    expect(warned.filter((line) => line.includes('[animation-hold]')), 'leaving a game mid-scene is not a leak to report').to.deep.equal([]);
    clock.advance(60_000);
    expect(recovered, 'and the ceiling does not fire for it later').to.equal(1);
  });

  it('THE GAME SCREEN LEFT: a supplier that still says it holds is masked AT ONCE and its owner\'s recovery runs — not 35 s into the next game', () => {
    beginConsoleSession();
    const before = animationHoldCount();
    let recovered = 0;
    registerAnimationHoldSupplier('spec-run-supplier', () => flag.on, {expire: () => recovered++});
    flag.on = true;
    refreshAnimationHolds(); // the sweep arms what the watcher would arm a flush later
    expect(animationHoldCount()).to.equal(before + 1);
    expect(scenes()).to.have.length(1);
    expect(ceilings()).to.equal(1);

    endConsoleSession(); // …and nobody reset the module behind the supplier

    expect(scenes()).to.deep.equal([]);
    expect(animationHoldCount(), 'masked — exactly what the ceiling would have done, now').to.equal(before);
    expect(recovered).to.equal(1);

    // The next game: the mask lifts on an honest false, and the flow's next run is a new scene in the NEW session.
    const next = beginConsoleSession();
    refreshAnimationHolds();
    expect(animationHoldCount(), 'still masked while the stale claim stands').to.equal(before);
    flag.on = false;
    refreshAnimationHolds();
    flag.on = true;
    refreshAnimationHolds();
    expect(animationHoldCount()).to.equal(before + 1);
    expect(scenes()).to.have.length(1);
    const tree = dumpFlowTree();
    const at = tree.findIndex((line) => /scene:hold:spec-run/.test(line));
    const root = tree.slice(0, at).reverse().find((line) => !line.startsWith(' ')) ?? '';
    expect(root.startsWith(next.id), `under the new session — ${tree.join(' / ')}`).to.equal(true);
  });

  it('a supplier\'s run follows its edges: rise → a scene, fall → done; a hold that fell before the session ended is not touched by its end', () => {
    beginConsoleSession();
    let recovered = 0;
    registerAnimationHoldSupplier('spec-run-supplier', () => flag.on, {expire: () => recovered++});
    flag.on = true;
    refreshAnimationHolds();
    expect(scenes()).to.have.length(1);
    flag.on = false;
    refreshAnimationHolds();
    expect(scenes()).to.deep.equal([]);
    expect(ceilings()).to.equal(0);

    endConsoleSession();
    expect(recovered).to.equal(0);
  });

  it('a hold raised in the LOBBY (the curtain into a game) is not ended by a game that comes and goes', () => {
    const hold = beginAnimationHold('spec-run-lobby');
    expect(hold.scope.parent?.label).to.equal('lobby');

    beginConsoleSession();
    endConsoleSession();

    expect(hold.scope.ended, 'its owner is the lobby, which still stands').to.equal(undefined);
    hold.release();
    expect(hold.scope.ended?.how).to.equal('done');
  });

  it('a net that ends a hold ends its run — the ceiling does not run the owner\'s recovery a second time', () => {
    beginConsoleSession();
    let recovered = 0;
    registerAnimationHoldSupplier('spec-run-supplier', () => flag.on, {expire: () => recovered++, maxHoldMs: 5_000});
    flag.on = true;
    refreshAnimationHolds();

    expect(expireAnimationHoldNow('spec-run-supplier')).to.equal(true);
    expect(recovered).to.equal(1);
    expect(scenes()).to.deep.equal([]);
    clock.advance(10_000);
    refreshAnimationHolds();
    expect(recovered, 'once').to.equal(1);

    // …and the watchdog's door, over a manual hold and a fresh supplier edge.
    flag.on = false;
    refreshAnimationHolds();
    flag.on = true;
    refreshAnimationHolds();
    let manualRecovered = 0;
    const hold = beginAnimationHold('spec-run-manual', {expire: () => manualRecovered++});
    const expired = expireActiveAnimationHolds();
    expect(expired).to.include.members(['animation:spec-run-supplier', 'animation:spec-run-manual']);
    expect(hold.scope.ended?.how).to.equal('expired');
    expect(scenes()).to.deep.equal([]);
    clock.advance(60_000);
    expect(recovered).to.equal(2);
    expect(manualRecovered).to.equal(1);
  });
});
