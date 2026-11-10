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
  | {op: 'advance', ms: number};

const opArb: fc.Arbitrary<Op> = fc.oneof(
  {weight: 1, arbitrary: fc.constant<Op>({op: 'root'})},
  {weight: 5, arbitrary: fc.nat(40).map<Op>((parent) => ({op: 'open', parent}))},
  {weight: 3, arbitrary: fc.nat(40).map<Op>((scope) => ({op: 'end', scope}))},
  {weight: 8, arbitrary: fc.tuple(fc.nat(40), fc.nat(40), fc.integer({min: 1, max: 5000})).map<Op>(([owner, target, ms]) => ({op: 'waitEnd', owner, target, ms}))},
  {weight: 3, arbitrary: fc.tuple(fc.nat(40), fc.nat(3), fc.integer({min: 1, max: 5000})).map<Op>(([owner, signal, ms]) => ({op: 'waitSignal', owner, signal, ms}))},
  {weight: 2, arbitrary: fc.nat(3).map<Op>((signal) => ({op: 'emit', signal}))},
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
 *   5. when everything is ended nothing is left: no scope, no row, no timer.
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
        case 'advance':
          clock.advance(step.ms);
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
    }), {numRuns: 300});
  });
});
