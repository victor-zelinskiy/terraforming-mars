import {expect} from 'chai';
import fc from 'fast-check';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {
  createFlowSignal, ended, FlowScope, FlowSignal, liveScopeCount, openFlowRoot, resetFlowKernel, signalled, waitTable, WaitResult,
} from '@/client/console/kernel/flowScope';
import {resetFlowTrace} from '@/client/console/kernel/flowTrace';

type Op =
  | {op: 'root'}
  | {op: 'open', parent: number}
  | {op: 'end', scope: number}
  | {op: 'waitEnd', owner: number, target: number, ms: number}
  | {op: 'waitSignal', owner: number, signal: number, ms: number}
  | {op: 'emit', signal: number}
  | {op: 'after', owner: number, ms: number}
  | {op: 'afterFrame', owner: number, frames: number}
  | {op: 'cancelTimer', timer: number}
  | {op: 'everyFrame', owner: number, frames: number}
  | {op: 'guarantee', owner: number, ms: number}
  | {op: 'disarm', guarantee: number}
  | {op: 'advance', ms: number};

const opArb: fc.Arbitrary<Op> = fc.oneof(
  {weight: 1, arbitrary: fc.constant<Op>({op: 'root'})},
  {weight: 5, arbitrary: fc.nat(40).map<Op>((parent) => ({op: 'open', parent}))},
  {weight: 3, arbitrary: fc.nat(40).map<Op>((scope) => ({op: 'end', scope}))},
  {weight: 8, arbitrary: fc.tuple(fc.nat(40), fc.nat(40), fc.integer({min: 1, max: 5000})).map<Op>(([owner, target, ms]) => ({op: 'waitEnd', owner, target, ms}))},
  {weight: 3, arbitrary: fc.tuple(fc.nat(40), fc.nat(3), fc.integer({min: 1, max: 5000})).map<Op>(([owner, signal, ms]) => ({op: 'waitSignal', owner, signal, ms}))},
  {weight: 2, arbitrary: fc.nat(3).map<Op>((signal) => ({op: 'emit', signal}))},
  {weight: 4, arbitrary: fc.tuple(fc.nat(40), fc.integer({min: 0, max: 5000})).map<Op>(([owner, ms]) => ({op: 'after', owner, ms}))},
  {weight: 2, arbitrary: fc.tuple(fc.nat(40), fc.integer({min: 1, max: 4})).map<Op>(([owner, frames]) => ({op: 'afterFrame', owner, frames}))},
  {weight: 1, arbitrary: fc.nat(40).map<Op>((timer) => ({op: 'cancelTimer', timer}))},
  {weight: 2, arbitrary: fc.tuple(fc.nat(40), fc.integer({min: 1, max: 6})).map<Op>(([owner, frames]) => ({op: 'everyFrame', owner, frames}))},
  {weight: 3, arbitrary: fc.tuple(fc.nat(40), fc.integer({min: 0, max: 5000})).map<Op>(([owner, ms]) => ({op: 'guarantee', owner, ms}))},
  {weight: 1, arbitrary: fc.nat(40).map<Op>((guarantee) => ({op: 'disarm', guarantee}))},
  {weight: 3, arbitrary: fc.integer({min: 0, max: 3000}).map<Op>((ms) => ({op: 'advance', ms}))},
);

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

/**
 * THE KERNEL UNDER RANDOM SCHEDULES — the races that show up in e2e only under load, generated in milliseconds.
 * Whatever is opened, awaited, ended and timed, in whatever order:
 *   1. no live scope stands under an ended one;
 *   2. no wait stands whose owner has ended;
 *   3. the wait table is ACYCLIC at every step (judged by an independent walk, not the kernel's own check);
 *   4. every wait settles exactly once, and a wait past its bound has settled;
 *   5. when everything is ended nothing is left: no scope, no row, no timer;
 *   6. an OWNED TIMER (`after` / `afterFrame`) fires at most once, only while its owner lives and it was not cancelled —
 *      and a timer past its time whose owner lived all along HAS fired. It never fires into an owner that is gone;
 *   7. a frame LOOP (`everyFrame`) never ticks into an owner that is gone and never past its own «stop»;
 *   8. a GUARANTEED release happens exactly once unless disarmed first — at its time, or when its owner ends (and a
 *      release asked of an owner already gone still happens); a disarmed one never does.
 */
describe('flow kernel · properties', () => {
  let warn: typeof console.warn;
  beforeEach(() => {
    warn = console.warn;
    console.warn = () => {};
  });
  afterEach(() => {
    console.warn = warn;
    resetFlowKernel();
    setFlowClock(undefined);
  });

  it('holds its invariants under any schedule', async () => {
    await fc.assert(fc.asyncProperty(fc.array(opArb, {minLength: 5, maxLength: 80}), async (ops) => {
      resetFlowKernel();
      resetFlowTrace();
      const clock = createManualClock(0);
      setFlowClock(clock);
      const scopes: Array<FlowScope<'test'>> = [];
      const parentOf = new Map<FlowScope, FlowScope | undefined>();
      const signals: Array<FlowSignal<void>> = [createFlowSignal(), createFlowSignal(), createFlowSignal(), createFlowSignal()];
      const waits: Array<{owner: FlowScope, armedAt: number, ms: number, settles: number, result?: WaitResult<unknown>}> = [];
      const pick = (i: number): FlowScope<'test'> | undefined => (scopes.length === 0 ? undefined : scopes[i % scopes.length]);
      const timers: Array<{owner: FlowScope, dueAt: number, armedAtAdvance: number, fired: number, firedIntoEnded: boolean, cancelled: boolean, ownerEndedAt?: number, cancel: () => void}> = [];
      const loops: Array<{owner: FlowScope, limit: number, ticks: number, tickedIntoEnded: boolean}> = [];
      const guarantees: Array<{owner: FlowScope, dueAt: number, armedAtAdvance: number, released: number, disarmed: boolean, disarm: () => void}> = [];
      /** How many times the clock has been advanced — a manual clock fires nothing between two advances, a 0 ms timer included. */
      let advances = 0;

      const subtreeHas = (root: FlowScope, scope: FlowScope | undefined): boolean => {
        for (let s = scope; s !== undefined; s = parentOf.get(s)) {
          if (s === root) {
            return true;
          }
        }
        return false;
      };
      const byId = (): Map<string, FlowScope> => new Map(scopes.map((s) => [s.id, s]));
      /** An independent judge: a scope is blocked by every scope something in its subtree waits for. */
      const tableHasCycle = (): boolean => {
        const ids = byId();
        const rows = waitTable().filter((row) => row.on !== undefined).map((row) => ({owner: ids.get(row.owner) as FlowScope, on: ids.get(row.on as string) as FlowScope}));
        const live = scopes.filter((s) => s.ended === undefined);
        const blockedBy = (scope: FlowScope): Array<FlowScope> => rows.filter((row) => subtreeHas(scope, row.owner)).map((row) => row.on);
        for (const start of live) {
          const seen = new Set<FlowScope>();
          const stack = blockedBy(start);
          while (stack.length > 0) {
            const at = stack.pop() as FlowScope;
            if (at === start) {
              return true;
            }
            if (!seen.has(at)) {
              seen.add(at);
              stack.push(...blockedBy(at));
            }
          }
        }
        return false;
      };

      for (const step of ops) {
        switch (step.op) {
        case 'root': {
          const root = openFlowRoot('test');
          scopes.push(root);
          parentOf.set(root, undefined);
          break;
        }
        case 'open': {
          const parent = pick(step.parent);
          if (parent !== undefined) {
            const child = parent.open('test');
            scopes.push(child);
            parentOf.set(child, parent);
          }
          break;
        }
        case 'end':
          pick(step.scope)?.end({how: 'cancelled', reason: 'the schedule'});
          break;
        case 'waitEnd': {
          const owner = pick(step.owner);
          const target = pick(step.target);
          if (owner !== undefined && target !== undefined && owner !== target) {
            const record: typeof waits[number] = {owner, armedAt: clock.now(), ms: step.ms, settles: 0};
            waits.push(record);
            void owner.wait(ended(target), {bound: {ms: step.ms}}).then((result) => {
              record.settles++;
              record.result = result;
            });
          }
          break;
        }
        case 'waitSignal': {
          const owner = pick(step.owner);
          if (owner !== undefined) {
            const record: typeof waits[number] = {owner, armedAt: clock.now(), ms: step.ms, settles: 0};
            waits.push(record);
            void owner.wait(signalled('a signal', signals[step.signal]), {bound: {ms: step.ms}}).then((result) => {
              record.settles++;
              record.result = result;
            });
          }
          break;
        }
        case 'emit':
          signals[step.signal].emit();
          break;
        case 'after':
        case 'afterFrame': {
          const owner = pick(step.owner);
          if (owner !== undefined && owner.ended === undefined) {
            const ms = step.op === 'after' ? step.ms : step.frames * 16;
            const record: typeof timers[number] = {owner, dueAt: clock.now() + ms, armedAtAdvance: advances, fired: 0, firedIntoEnded: false, cancelled: false, cancel: () => {}};
            const fire = (): void => {
              record.fired++;
              record.firedIntoEnded = record.firedIntoEnded || owner.ended !== undefined;
            };
            record.cancel = step.op === 'after' ? owner.after(step.ms, 'a step', fire) : owner.afterFrame('a frame', fire, step.frames);
            owner.onEnd(() => {
              record.ownerEndedAt = record.ownerEndedAt ?? clock.now();
            });
            timers.push(record);
          }
          break;
        }
        case 'everyFrame': {
          const owner = pick(step.owner);
          if (owner !== undefined && owner.ended === undefined) {
            const record: typeof loops[number] = {owner, limit: step.frames, ticks: 0, tickedIntoEnded: false};
            owner.everyFrame('a loop', () => {
              record.ticks++;
              record.tickedIntoEnded = record.tickedIntoEnded || owner.ended !== undefined;
              return record.ticks < record.limit;
            });
            loops.push(record);
          }
          break;
        }
        case 'guarantee': {
          const owner = pick(step.owner);
          if (owner !== undefined) {
            const record: typeof guarantees[number] = {owner, dueAt: clock.now() + step.ms, armedAtAdvance: advances, released: 0, disarmed: false, disarm: () => {}};
            record.disarm = owner.guarantee(step.ms, 'a release', () => {
              record.released++;
            });
            guarantees.push(record);
          }
          break;
        }
        case 'disarm': {
          const g = guarantees.length === 0 ? undefined : guarantees[step.guarantee % guarantees.length];
          if (g !== undefined && g.released === 0) {
            g.disarmed = true;
            g.disarm();
          }
          break;
        }
        case 'cancelTimer': {
          const timer = timers.length === 0 ? undefined : timers[step.timer % timers.length];
          if (timer !== undefined && timer.fired === 0) {
            timer.cancelled = true;
            timer.cancel();
          }
          break;
        }
        case 'advance':
          clock.advance(step.ms);
          advances++;
          break;
        }
        await flush();

        // 1. Nothing lives under an ended scope.
        for (const scope of scopes) {
          if (scope.ended === undefined) {
            for (let p = parentOf.get(scope); p !== undefined; p = parentOf.get(p)) {
              expect(p.ended, `${scope.id} lives under ended ${p.id}`).to.eq(undefined);
            }
          }
        }
        // 2. No row belongs to an ended owner.
        const ids = byId();
        for (const row of waitTable()) {
          expect(ids.get(row.owner)?.ended, `a row of ended ${row.owner}`).to.eq(undefined);
        }
        // 3. The table is acyclic.
        expect(tableHasCycle(), 'a cycle stands in the wait table').to.eq(false);
        // 4. Exactly once; and nothing stands past its bound or past its owner.
        for (const wait of waits) {
          expect(wait.settles).to.be.at.most(1);
          if (clock.now() - wait.armedAt >= wait.ms || wait.owner.ended !== undefined) {
            expect(wait.settles, 'a wait past its bound / its owner has settled').to.eq(1);
          }
        }
        // 6. An owned timer: at most once, never cancelled-and-fired, never into an owner that is gone — and on time.
        for (const timer of timers) {
          expect(timer.fired).to.be.at.most(1);
          expect(timer.firedIntoEnded, 'a timer fired into an ended owner').to.eq(false);
          if (timer.cancelled) {
            expect(timer.fired, 'a cancelled timer fired').to.eq(0);
          } else if (timer.ownerEndedAt !== undefined && timer.ownerEndedAt < timer.dueAt) {
            expect(timer.fired, 'a timer fired after its owner ended').to.eq(0);
          } else if (advances > timer.armedAtAdvance && clock.now() >= timer.dueAt && timer.ownerEndedAt === undefined) {
            expect(timer.fired, 'a timer past its time, its owner alive, has fired').to.eq(1);
          }
        }
        // 7. A frame loop: never into an ended owner, never past its own stop.
        for (const loop of loops) {
          expect(loop.tickedIntoEnded, 'a loop ticked into an ended owner').to.eq(false);
          expect(loop.ticks, 'a loop ticked past its own stop').to.be.at.most(loop.limit);
        }
        // 8. A guaranteed release: at most once; never when disarmed; due = happened (its time, or its owner's end).
        for (const g of guarantees) {
          expect(g.released).to.be.at.most(1);
          if (g.disarmed) {
            expect(g.released, 'a disarmed release happened').to.eq(0);
          } else if (g.owner.ended !== undefined || (advances > g.armedAtAdvance && clock.now() >= g.dueAt)) {
            expect(g.released, 'a release that is due has happened').to.eq(1);
          }
        }
      }

      // 5. Everything ended — nothing is left.
      for (const scope of scopes) {
        scope.end();
      }
      await flush();
      expect(liveScopeCount()).to.eq(0);
      expect(waitTable()).to.deep.eq([]);
      expect(clock.pending()).to.eq(0);
      for (const wait of waits) {
        expect(wait.settles).to.eq(1);
      }
      for (const g of guarantees) {
        expect(g.released, 'every release not disarmed has happened by the end').to.eq(g.disarmed ? 0 : 1);
      }
    }), {numRuns: 300});
  });
});
