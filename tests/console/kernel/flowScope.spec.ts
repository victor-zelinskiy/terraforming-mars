import {expect} from 'chai';
import {ref} from 'vue';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {
  createFlowSignal, delay, dumpFlowTree, ended, FlowScope, flowTreeDigest, frames, joined, liveScopeCount, motion, openFlowRoot, resetFlowKernel,
  ScopeEnd, settled, signalled, until, waitTable, WaitTarget,
} from '@/client/console/kernel/flowScope';
import {flowTrace, flowTraceStats, resetFlowTrace} from '@/client/console/kernel/flowTrace';

/** Let every pending promise continuation run. */
async function flush(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

/**
 * THE FLOW KERNEL — a scope ends exactly once and takes everything opened in it; a wait is bounded, declared and
 * refused when its edge would close a cycle. Each `describe` is one of the defect classes the field reported, stated
 * as the property that makes it inexpressible.
 */
describe('flow kernel · scope', () => {
  let clock: ManualFlowClock;
  let warn: typeof console.warn;
  let warned: Array<string>;

  beforeEach(() => {
    resetFlowKernel();
    resetFlowTrace();
    clock = createManualClock(1000);
    setFlowClock(clock);
    warned = [];
    warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      warned.push(String(args[0]));
    };
  });
  afterEach(() => {
    console.warn = warn;
    resetFlowKernel();
    setFlowClock(undefined);
  });

  describe('a scope ends exactly once, and nothing opened in it outlives it', () => {
    it('ends its children first (youngest first), then runs its cleanups LIFO, then tells its listeners', () => {
      const order: Array<string> = [];
      const root = openFlowRoot('test', 'root');
      const a = root.open('test', 'a');
      const b = root.open('test', 'b');
      root.defer(() => order.push('root-1'));
      root.defer(() => order.push('root-2'));
      a.defer(() => order.push('a'));
      b.defer(() => order.push('b'));
      root.onEnd(() => order.push('root-told'));
      root.end();
      expect(order).to.deep.eq(['b', 'a', 'root-2', 'root-1', 'root-told']);
      expect(a.ended).to.deep.eq({how: 'cancelled', reason: 'test:root#1 done'});
      expect(liveScopeCount()).to.eq(0);
    });

    it('the first end wins — a later end changes nothing and runs nothing twice', () => {
      let cleanups = 0;
      const scope = openFlowRoot('test');
      scope.defer(() => cleanups++);
      scope.end({how: 'cancelled', reason: 'the player backed out'});
      scope.end({how: 'done'});
      scope.end({how: 'expired', bound: 'late'});
      expect(scope.ended).to.deep.eq({how: 'cancelled', reason: 'the player backed out'});
      expect(cleanups).to.eq(1);
    });

    it('a scope opened in an ended scope is born ended — nothing can be parked under a dead owner', () => {
      const host = openFlowRoot('test', 'host');
      host.end();
      const claim = host.open('test', 'claim');
      expect(claim.ended?.how).to.eq('cancelled');
      expect(claim.isLive()).to.eq(false);
      expect(liveScopeCount()).to.eq(0);
    });

    it('a cleanup registered after the end runs at once (the resource is released, never leaked)', () => {
      const scope = openFlowRoot('test');
      scope.end();
      let released = false;
      scope.defer(() => {
        released = true;
      });
      expect(released).to.eq(true);
    });

    it('a throwing cleanup is named and the rest still run', () => {
      const ran: Array<number> = [];
      const scope = openFlowRoot('test', 'messy');
      scope.defer(() => ran.push(1));
      scope.defer(() => {
        throw new Error('boom');
      });
      scope.defer(() => ran.push(3));
      scope.end();
      expect(ran).to.deep.eq([3, 1]);
      expect(warned.some((line) => line.includes('[flow] test:messy#1') && line.includes('a cleanup threw'))).to.eq(true);
    });

    it('`using` ends the scope at the block\'s end, on a throw as well', () => {
      let inner: FlowScope | undefined;
      const body = (): void => {
        using scope = openFlowRoot('test', 'block');
        inner = scope;
        throw new Error('left early');
      };
      expect(body).to.throw('left early');
      expect(inner?.ended).to.deep.eq({how: 'done'});
    });

    it('its signal aborts with it, and `isLive` is a reactive read', () => {
      const scope = openFlowRoot('test');
      expect(scope.signal.aborted).to.eq(false);
      expect(scope.isLive()).to.eq(true);
      scope.end();
      expect(scope.signal.aborted).to.eq(true);
      expect(scope.isLive()).to.eq(false);
    });
  });

  describe('an async beat is a child — an exception is its failed end, never a half-set flow', () => {
    it('`run` resolves done with the value and leaves no scope behind', async () => {
      const root = openFlowRoot('test');
      const outcome = await root.run('beat', async () => 42);
      expect(outcome).to.deep.eq({status: 'done', value: 42});
      expect(root.children.length).to.eq(0);
    });

    it('a task that throws: failed, named once, its cleanups run, the caller is told — nothing rejects', async () => {
      const root = openFlowRoot('test', 'gate');
      let released = false;
      const outcome = await root.run('scene', async (scope) => {
        scope.defer(() => {
          released = true;
        });
        throw new Error('the scene tripped');
      });
      expect(outcome.status).to.eq('failed');
      expect(released).to.eq(true);
      expect(warned.filter((line) => line.includes('the task threw')).length).to.eq(1);
      expect(root.ended).to.eq(undefined);
    });

    it('a synchronous throw is the same failed end', async () => {
      const root = openFlowRoot('test');
      const outcome = await root.run('beat', () => {
        throw new Error('sync');
      });
      expect(outcome.status).to.eq('failed');
    });

    it('a run past its bound is expired: its waits are cancelled, its cleanups run, the caller moves on', async () => {
      const root = openFlowRoot('test', 'funnel');
      let aborted = false;
      const never = createFlowSignal<void>();
      const running = root.run('hung gate', async (scope) => {
        scope.defer(() => {
          aborted = true;
        });
        const result = await scope.wait(signalled('the scene ends', never), {bound: {ms: 60_000}});
        return result.status;
      }, {bound: {ms: 5000}});
      await flush();
      clock.advance(4999);
      await flush();
      expect(aborted).to.eq(false);
      clock.advance(1);
      const outcome = await running;
      expect(outcome).to.deep.eq({status: 'expired', bound: 'hung gate 5000ms'});
      expect(aborted).to.eq(true);
      expect(waitTable()).to.deep.eq([]);
      expect(warned.some((line) => line.includes('[flow] bound') && line.includes('hung gate'))).to.eq(true);
    });

    it('the parent ending cancels the run and everything it awaits', async () => {
      const root = openFlowRoot('test');
      const never = createFlowSignal<void>();
      let seen = '';
      const running = root.run('beat', async (scope) => {
        seen = (await scope.wait(signalled('x', never), {bound: {ms: 60_000}})).status;
      });
      await flush();
      root.end({how: 'cancelled', reason: 'the host left'});
      const outcome = await running;
      expect(outcome.status).to.eq('cancelled');
      await flush();
      expect(seen).to.eq('cancelled');
      expect(clock.pending()).to.eq(0);
    });
  });

  describe('a wait is bounded and declared', () => {
    it('met: the awaited thing came — the row leaves the table, the bound is disarmed', async () => {
      const root = openFlowRoot('test');
      const answer = createFlowSignal<number>();
      const waiting = root.wait(signalled('the answer', answer, 'server'), {bound: {ms: 60_000}});
      expect(waitTable().map((row) => `${row.owner} ${row.family} ${row.what} ${row.boundMs}`)).to.deep.eq(['test#1 server the answer 60000']);
      answer.emit(7);
      expect(await waiting).to.deep.eq({status: 'met', value: 7});
      expect(waitTable()).to.deep.eq([]);
      expect(clock.pending()).to.eq(0);
    });

    it('bound: it did not come — said once, the caller holds the result', async () => {
      const root = openFlowRoot('test', 'hero');
      const never = createFlowSignal<void>();
      const waiting = root.wait(signalled('the pay-back', never), {bound: {ms: 8000}});
      clock.advance(8000);
      expect(await waiting).to.deep.eq({status: 'bound', afterMs: 8000});
      expect(warned).to.deep.eq(['[flow] bound test:hero#1 — «the pay-back» did not come in 8000 ms; the wait ended on its bound']);
      expect(waitTable()).to.deep.eq([]);
    });

    it('a quiet bound is an honest schedule and says nothing', async () => {
      const root = openFlowRoot('test');
      const waiting = root.wait(signalled('x', createFlowSignal<void>()), {bound: {ms: 300, quiet: 'a read beat'}});
      clock.advance(300);
      expect((await waiting).status).to.eq('bound');
      expect(warned).to.deep.eq([]);
    });

    it('cancelled: the owner ended — a wait never outlives its scope', async () => {
      const root = openFlowRoot('test');
      const child = root.open('test', 'child');
      const waiting = child.wait(signalled('x', createFlowSignal<void>()), {bound: {ms: 60_000}});
      root.end();
      const result = await waiting;
      expect(result.status).to.eq('cancelled');
      expect(waitTable()).to.deep.eq([]);
      expect(clock.pending()).to.eq(0);
    });

    it('a wait asked of an ended scope is cancelled at once', async () => {
      const scope = openFlowRoot('test');
      scope.end();
      expect((await scope.wait(delay(10), {bound: {ms: 100}})).status).to.eq('cancelled');
    });

    it('the PLAYER may take for ever — but only while something accepts the press', async () => {
      const root = openFlowRoot('test');
      const surface = root.open('test', 'plate');
      const flow = root.open('test', 'flow');
      const press = createFlowSignal<string>();
      const waiting = flow.wait(signalled('A on the plate', press, 'player'), {bound: 'player', accepts: surface});
      clock.advance(3_600_000);
      await flush();
      expect(waitTable().length).to.eq(1);
      surface.end({how: 'cancelled', reason: 'the plate left'});
      const result = await waiting;
      expect(result.status).to.eq('cancelled');
      expect((result as {reason: string}).reason).to.contain('nothing accepts the press any more');
    });

    it('`until` is LEVEL-triggered: true now resolves now — there is no edge to miss', async () => {
      const root = openFlowRoot('test');
      const ready = ref(true);
      const result = await root.wait(until('the zone stands', () => ready.value && 'zone'), {bound: {ms: 1000}});
      expect(result).to.deep.eq({status: 'met', value: 'zone'});
    });

    it('`until` resolves on the reactive change and stops watching', async () => {
      const root = openFlowRoot('test');
      const count = ref(0);
      let reads = 0;
      const waiting = root.wait(until('three', () => {
        reads++;
        return count.value >= 3;
      }), {bound: {ms: 1000}});
      count.value = 1;
      count.value = 3;
      expect((await waiting).status).to.eq('met');
      const readsAtMet = reads;
      count.value = 9;
      expect(reads).to.eq(readsAtMet);
    });

    it('`until` over a source that cannot be reactive is polled, on the kernel\'s clock', async () => {
      const root = openFlowRoot('test');
      let painted = false;
      const waiting = root.wait(until('the node is painted', () => painted, {polledMs: 50}), {bound: {ms: 1000}});
      clock.advance(120);
      painted = true;
      clock.advance(50);
      expect((await waiting).status).to.eq('met');
      expect(clock.pending()).to.eq(0);
    });

    it('a condition that throws reads as «not yet» and is named', async () => {
      const root = openFlowRoot('test');
      const waiting = root.wait(until('broken', () => {
        throw new Error('x');
      }), {bound: {ms: 100, quiet: 'spec'}});
      clock.advance(100);
      expect((await waiting).status).to.eq('bound');
      expect(warned.some((line) => line.includes('the condition «broken» threw'))).to.eq(true);
    });

    it('a MOTION settles when it completes AND when it is killed (the await around a killed tween)', async () => {
      const root = openFlowRoot('test');
      const tween = (() => {
        let interrupt: ((...args: Array<unknown>) => void) | undefined;
        let complete: ((value: unknown) => unknown) | undefined;
        return {
          then: (onFulfilled?: (value: unknown) => unknown) => {
            complete = onFulfilled;
            return Promise.resolve();
          },
          eventCallback: (_type: string, callback?: ((...args: Array<unknown>) => void) | null) => {
            if (callback === undefined) {
              return interrupt;
            }
            interrupt = callback ?? undefined;
            return undefined;
          },
          kill: () => interrupt?.(),
          finish: () => complete?.(undefined),
        };
      })();
      const waiting = root.wait(motion('the card lands', tween), {bound: {ms: 5000}});
      tween.kill();
      expect(await waiting).to.deep.eq({status: 'met', value: {completed: false}});
      const waapi = {finished: Promise.reject(new Error('cancelled'))};
      expect(await root.wait(motion('the fade', waapi), {bound: {ms: 5000}})).to.deep.eq({status: 'met', value: {completed: false}});
      expect(await root.wait(motion('the fade', {finished: Promise.resolve()}), {bound: {ms: 5000}})).to.deep.eq({status: 'met', value: {completed: true}});
    });

    it('a rejected promise is a value — a wait never throws', async () => {
      const root = openFlowRoot('test');
      const result = await root.wait(settled('the fetch', Promise.reject(new Error('offline'))), {bound: {ms: 100}});
      expect(result.status).to.eq('met');
      expect((result as {value: {ok: boolean}}).value.ok).to.eq(false);
    });

    it('`sleep` is true when the span passed and false when the scope ended first', async () => {
      const root = openFlowRoot('test');
      const slept = root.sleep(200);
      clock.advance(200);
      expect(await slept).to.eq(true);
      const cut = root.sleep(200);
      root.end();
      expect(await cut).to.eq(false);
    });
  });

  describe('a mutual wait never stands — its last edge is refused the moment it is asked for', () => {
    it('the chairman quest: conclusion → plate → frame → conclusion', async () => {
      const root = openFlowRoot('test');
      const conclusion = root.open('test', 'conclusion');
      const plate = root.open('test', 'plate');
      const frame = root.open('test', 'frame');
      const results: Record<string, string> = {};
      void conclusion.wait(ended(plate), {bound: {ms: 60_000}}).then((r) => {
        results.conclusion = r.status;
      });
      void plate.wait(ended(frame), {bound: {ms: 60_000}}).then((r) => {
        results.plate = r.status;
      });
      const last = await frame.wait(ended(conclusion), {bound: {ms: 60_000}});
      expect(last.status).to.eq('cycle');
      expect((last as {path: ReadonlyArray<string>}).path).to.deep.eq(['test:frame#4', 'test:conclusion#2', 'test:plate#3', 'test:frame#4']);
      // Refused synchronously: no time passed, and only the two honest edges stand.
      expect(clock.now()).to.eq(1000);
      expect(waitTable().length).to.eq(2);
      expect(flowTraceStats.cycle).to.eq(1);
      expect(warned.some((line) => line.startsWith('[flow] cycle refused test:frame#4 → test:conclusion#2 → test:plate#3 → test:frame#4'))).to.eq(true);
      // …so the asker takes its own way out and the chain unwinds by itself.
      frame.end();
      await flush();
      plate.end();
      await flush();
      expect(results).to.deep.eq({plate: 'met', conclusion: 'met'});
    });

    it('Flooding: the lift waits for the pay-back whose commit waits for the lift — a beat INSIDE the flow closes it', async () => {
      const root = openFlowRoot('test');
      const lift = root.open('test', 'lift');
      const payback = root.open('test', 'payback');
      // The pay-back's own beat (a child task) waits for the lift…
      void payback.run('commit', (scope) => scope.wait(ended(lift), {bound: {ms: 60_000}}));
      await flush();
      // …so the lift may not wait for the pay-back: the edge is in the pay-back's SUBTREE.
      const result = await lift.wait(ended(payback), {bound: {ms: 60_000}});
      expect(result.status).to.eq('cycle');
    });

    it('a scope may not wait for its own ancestor (that end cancels it)', async () => {
      const root = openFlowRoot('test');
      const child = root.open('test', 'child');
      expect((await child.wait(ended(root), {bound: {ms: 100}})).status).to.eq('cycle');
      expect(warned.some((line) => line.includes('LAW') && line.includes('its own ancestor'))).to.eq(true);
    });

    it('a parent JOINS its child freely; `joined` of a stranger is refused', async () => {
      const root = openFlowRoot('test');
      const child = root.open('test', 'child');
      const stranger = openFlowRoot('test', 'stranger');
      const joining = root.wait(joined(child), {bound: {ms: 1000}});
      child.end();
      expect((await joining).status).to.eq('met');
      expect((await root.wait(joined(stranger), {bound: {ms: 1000}})).status).to.eq('cycle');
    });

    it('the KIND TABLE is enforced at run time: a frame may not wait for a story', async () => {
      const session = openFlowRoot('session');
      const frame = session.open('frame', 'hand');
      const story = session.open('story', 'scale step');
      // Erased kinds — the typed form does not compile (see the type test below).
      const result = await (frame as FlowScope).wait(ended(story) as unknown as WaitTarget<ScopeEnd>, {bound: {ms: 100}});
      expect(result.status).to.eq('cycle');
      expect(warned.some((line) => line.includes('«frame» may not wait for the end of «story»'))).to.eq(true);
      // …the other way round is in the table.
      const waiting = story.wait(ended(frame), {bound: {ms: 100}});
      frame.end();
      expect((await waiting).status).to.eq('met');
    });

    it('a task waits by the row of the flow it is a beat of', async () => {
      const session = openFlowRoot('session');
      const frame = session.open('frame', 'hand');
      const submit = session.open('submit');
      const outcome = frame.run('executing', (scope) => scope.wait(ended(submit), {bound: {ms: 1000}}));
      await flush();
      submit.end();
      expect(((await outcome) as {value: {status: string}}).value.status).to.eq('met');
    });

    it('the typed form refuses the pair at compile time', () => {
      const session = openFlowRoot('session');
      const frame = session.open('frame');
      const story = session.open('story');
      const submit = session.open('submit');
      // Never run — the compiler is the judge here (`npm run build:test` type-checks this file).
      const typed = (): void => {
        void frame.wait(ended(submit), {bound: {ms: 1}});
        // @ts-expect-error — `story` is not in WAITS_ON.frame: a decision never waits on a story.
        void frame.wait(ended(story), {bound: {ms: 1}});
        // @ts-expect-error — a wait has a bound.
        void frame.wait(ended(submit), {});
        // @ts-expect-error — a press is waited for only with the surface that accepts it.
        void frame.wait(ended(submit), {bound: 'player'});
      };
      expect(typed).to.be.a('function');
      session.end();
    });
  });

  describe('the structure is the diagnosis', () => {
    it('the tree dump names every standing scope, its state and its waits', async () => {
      const session = openFlowRoot('session', 'g1');
      const frame = session.open('frame', 'hand');
      frame.detail = 'executing';
      const submit = session.open('submit');
      void frame.wait(ended(submit), {bound: {ms: 60_000}});
      clock.advance(1500);
      expect(dumpFlowTree()).to.deep.eq([
        'session:g1#1 1.5s',
        '  frame:hand#1 1.5s executing  ⟵ waits «submit#1 ends» 1.5s/60s',
        '  submit#1 1.5s',
      ]);
    });

    it('the trace records opens, ends with their reason, and waits', async () => {
      const root = openFlowRoot('test', 'r');
      const child = root.open('test', 'c');
      child.end({how: 'cancelled', reason: 'B'});
      root.end();
      expect(flowTrace().map((r) => `${r.kind} ${r.scope} ${r.detail}`.trim())).to.deep.eq([
        'open test:r#1',
        'open test:c#2 in test:r#1',
        'end test:c#2 cancelled (B)',
        'end test:r#1 done',
      ]);
    });

    it('`onEnd` on an ended scope answers at once with how it ended', () => {
      const scope = openFlowRoot('test');
      scope.end({how: 'expired', bound: '5s'});
      let seen: ScopeEnd | undefined;
      scope.onEnd((end) => {
        seen = end;
      });
      expect(seen).to.deep.eq({how: 'expired', bound: '5s'});
    });
  });

  describe('an owned timer (`after`) — a callback that cannot fire into a flow that is gone', () => {
    it('runs once, at its time, in the timer\'s own task — and is a row of the wait table until then', () => {
      const scope = openFlowRoot('test', 'owner');
      const ran: Array<number> = [];
      scope.after(300, 'the next step', () => ran.push(clock.now()));

      expect(waitTable().map((row) => `${row.owner} ${row.family} «${row.what}» ${row.boundMs}`)).to.deep.eq(['test:owner#1 timer «the next step» 300']);
      clock.advance(299);
      expect(ran).to.deep.eq([]);
      clock.advance(1);
      expect(ran).to.deep.eq([1300]);
      expect(waitTable()).to.deep.eq([]);
      clock.advance(10_000);
      expect(ran, 'once').to.deep.eq([1300]);
    });

    it('THE SCOPE ENDED FIRST: the timer is taken back — nothing fires, nothing stands armed', () => {
      const root = openFlowRoot('test', 'root');
      const scene = root.open('test', 'scene');
      let fired = 0;
      scene.after(300, 'a release nobody should depend on', () => fired++);
      expect(clock.pending()).to.equal(1);

      root.end(); // the PARENT ends: the child's timer goes with the child
      expect(clock.pending()).to.equal(0);
      expect(waitTable()).to.deep.eq([]);
      clock.advance(1_000);
      expect(fired).to.equal(0);
    });

    it('the returned cancel takes it back (idempotent); a timer asked of an ended scope is never armed', () => {
      const scope = openFlowRoot('test');
      let fired = 0;
      const cancel = scope.after(100, 'x', () => fired++);
      cancel();
      cancel();
      expect(clock.pending()).to.equal(0);
      expect(waitTable()).to.deep.eq([]);

      scope.end();
      scope.after(100, 'late', () => fired++);
      expect(clock.pending()).to.equal(0);
      clock.advance(1_000);
      expect(fired).to.equal(0);
    });

    it('a callback that throws is said once (`[flow] …`) and does not break the clock\'s other timers', () => {
      const scope = openFlowRoot('test', 'owner');
      const ran: Array<string> = [];
      scope.after(100, 'boom', () => {
        throw new Error('boom');
      });
      scope.after(100, 'fine', () => ran.push('fine'));
      clock.advance(100);
      expect(ran).to.deep.eq(['fine']);
      expect(warned.filter((line) => line.includes('the timer «boom» threw'))).to.have.length(1);
    });

    it('`afterFrame` — the same on the page\'s frames: called after that many frames, never after the scope ended', () => {
      const scope = openFlowRoot('test', 'owner');
      const ran: Array<string> = [];
      scope.afterFrame('measure after the patch painted', () => ran.push('one'));
      scope.afterFrame('the fit has landed', () => ran.push('two'), 2);
      clock.advance(16);
      expect(ran).to.deep.eq(['one']);
      clock.advance(16);
      expect(ran).to.deep.eq(['one', 'two']);

      scope.afterFrame('late', () => ran.push('late'), 3);
      clock.advance(16);
      scope.end();
      expect(clock.pending()).to.equal(0);
      clock.advance(1_000);
      expect(ran, 'a frame callback of a scope that ended is taken back').to.deep.eq(['one', 'two']);
    });

    it('`frames(n)` under a bound — met when the page painted, BOUND when it does not paint (a hidden window)', async () => {
      const scope = openFlowRoot('test', 'owner');
      const painted = scope.wait(frames(2), {bound: {ms: 500, quiet: 'a poll'}});
      clock.advance(32);
      expect((await painted).status).to.equal('met');

      // A window that does not paint: the clock's frames never come — the wait ends on its bound, the poll goes on.
      const real = clock.nextFrame;
      clock.nextFrame = () => () => {};
      try {
        const hidden = scope.wait(frames(), {bound: {ms: 50, quiet: 'a poll'}});
        clock.advance(50);
        expect((await hidden).status).to.equal('bound');
      } finally {
        clock.nextFrame = real;
      }
      expect(waitTable()).to.deep.eq([]);
    });

    it('`guarantee` — a RELEASE: it happens at its time, or when the scope ends first, exactly once; `disarm` withdraws it', async () => {
      const root = openFlowRoot('test', 'root');
      const released: Array<string> = [];

      // …at its time.
      root.guarantee(300, 'the tween\'s promise', () => released.push('on time'));
      clock.advance(300);
      expect(released).to.deep.eq(['on time']);

      // …when the owner ends first — the opposite of `after`, which would have taken it back.
      const scene = root.open('test', 'scene');
      scene.guarantee(5_000, 'the gate somebody awaits', () => released.push('at the end'));
      scene.after(5_000, 'the next step', () => released.push('NEVER'));
      scene.end();
      expect(released).to.deep.eq(['on time', 'at the end']);
      expect(clock.pending(), 'its timer went with it').to.equal(0);
      clock.advance(10_000);
      expect(released, 'once').to.deep.eq(['on time', 'at the end']);

      // …and not at all when what it backs came by itself.
      const disarm = root.guarantee(300, 'x', () => released.push('disarmed'));
      disarm();
      disarm();
      clock.advance(1_000);
      root.end();
      expect(released).to.deep.eq(['on time', 'at the end']);

      // Asked of an owner that is gone, it is not parked: it happens — a microtask later, never inside the call (the
      // caller's `const disarm = …` is not assigned yet).
      root.guarantee(300, 'late', () => released.push('late'));
      const withdrawn = root.guarantee(300, 'late and disarmed', () => released.push('NEVER'));
      withdrawn();
      expect(released, 'not inside the call').to.deep.eq(['on time', 'at the end']);
      await flush();
      expect(released).to.deep.eq(['on time', 'at the end', 'late']);
      expect(waitTable()).to.deep.eq([]);
    });

    it('`everyFrame` — an owned LOOP: one row for its life; it stops when its tick says so, when stopped, when the scope ends', () => {
      const root = openFlowRoot('test', 'root');
      const scene = root.open('test', 'scene');
      let frames = 0;
      scene.everyFrame('the counters', () => {
        frames++;
        return frames < 3; // the third frame is the last
      });
      expect(waitTable().map((row) => row.what)).to.deep.eq(['the counters']);
      clock.advance(16 * 10);
      expect(frames, 'it stopped itself').to.equal(3);
      expect(waitTable()).to.deep.eq([]);
      expect(clock.pending()).to.equal(0);

      let ticks = 0;
      const stop = scene.everyFrame('a driver', () => {
        ticks++;
      });
      clock.advance(32);
      expect(ticks).to.equal(2);
      stop();
      clock.advance(160);
      expect(ticks, 'stopped by its handle').to.equal(2);

      scene.everyFrame('a driver', () => {
        ticks++;
      });
      clock.advance(16);
      root.end(); // the PARENT ends: the loop cannot go on painting a flow that is gone
      clock.advance(160);
      expect(ticks).to.equal(3);
      expect(clock.pending()).to.equal(0);
      expect(waitTable()).to.deep.eq([]);
    });

    it('a timer does not show in the one-line digest (it is not what a flow WAITS for), and the dump names it', () => {
      const root = openFlowRoot('session', 'g');
      const scene = root.open('scene', 'hero');
      scene.after(35_000, 'the ceiling', () => {});
      clock.advance(1_000);
      expect(flowTreeDigest()).to.equal('scene:hero#1');
      expect(dumpFlowTree()).to.deep.eq(['session:g#1 1.0s', '  scene:hero#1 1.0s  ⟵ waits «the ceiling» 1.0s/35s']);
    });
  });
});
