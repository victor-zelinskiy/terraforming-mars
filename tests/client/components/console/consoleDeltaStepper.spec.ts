import {expect} from 'chai';
import * as taskHostLogic from '@/client/components/console/consoleTaskHostLogic';

/**
 * THE HYDRONETWORK DIVERGENCE STEPPER READS THE SERVER'S OWN LISTS.
 *
 * A standalone `deltaProject` / `deltaStageReward` prompt is the amount
 * family's divergence fallback (a stale repeat plan, a reload mid-prompt).
 * The dial's range comes from the model's `validSteps` / `claimable` — the
 * historical bug read a nonexistent `max` field off the deltaProject model,
 * so the stepper showed «0 – 0», submitted 0, and the server refused every
 * press: a frozen game (Storm Surge Barrier copied by Viron).
 *
 * The lists are SPARSE when a blocked position splits them (`[1, 3]`), so the
 * dial must snap along them — every value it shows is submittable.
 *
 * The host's members (`consoleTaskHostLogic.ts` — the component delegates to
 * them over its port) are exercised against a stub of that port — the point is
 * WHICH numbers they read, not the mount of the whole task host.
 */

type Computeds = Record<string, (self: unknown) => unknown>;
type Methods = Record<string, (self: unknown, ...args: Array<unknown>) => unknown>;

const computeds = taskHostLogic as unknown as Computeds;
const methods = taskHostLogic as unknown as Methods;

function delta(validSteps: ReadonlyArray<number>) {
  const ctx: Record<string, unknown> = {wf: {type: 'deltaProject', validSteps}};
  Object.defineProperty(ctx, 'amountValidValues', {get() {
    return computeds.amountValidValues(this);
  }});
  Object.defineProperty(ctx, 'amountMin', {get() {
    return computeds.amountMin(this);
  }});
  Object.defineProperty(ctx, 'amountMax', {get() {
    return computeds.amountMax(this);
  }});
  return ctx;
}

describe('console delta stepper (server-authoritative validSteps)', () => {
  it('deltaProject range comes from validSteps — never a nonexistent `max` (the 0–0 freeze)', () => {
    const ctx = delta([1]);
    expect(ctx.amountMin).to.eq(1);
    expect(ctx.amountMax).to.eq(1);
  });

  it('a sparse list keeps its true ends', () => {
    const ctx = delta([3, 1]); // unordered on the wire — sorted here
    expect(ctx.amountMin).to.eq(1);
    expect(ctx.amountMax).to.eq(3);
  });

  it('deltaStageReward reads `claimable` through the same road', () => {
    const ctx: Record<string, unknown> = {wf: {type: 'deltaStageReward', claimable: [7, 2]}};
    Object.defineProperty(ctx, 'amountValidValues', {get() {
      return computeds.amountValidValues(this);
    }});
    expect(computeds.amountMin(ctx)).to.eq(2);
    expect(computeds.amountMax(ctx)).to.eq(7);
  });

  it('the dial SNAPS along a sparse list — a step never lands between two legal values', () => {
    const ctx = delta([1, 3]);
    ctx.submitting = false;
    ctx.activeTask = {kind: 'amount', flavor: 'delta'};
    ctx.value = 1;
    methods.adjust(ctx, 1);
    expect(ctx.value, 'up from 1 skips the blocked 2').to.eq(3);
    methods.adjust(ctx, 1);
    expect(ctx.value, 'clamped at the top').to.eq(3);
    methods.adjust(ctx, -1);
    expect(ctx.value, 'down from 3 skips the blocked 2').to.eq(1);
    methods.adjust(ctx, -1);
    expect(ctx.value, 'clamped at the floor').to.eq(1);
  });

  it('a plain amount keeps the min/max clamp untouched', () => {
    const ctx: Record<string, unknown> = {
      wf: {type: 'amount', min: 0, max: 4},
      submitting: false,
      activeTask: {kind: 'amount', flavor: 'generic'},
      value: 4,
    };
    Object.defineProperty(ctx, 'amountValidValues', {get() {
      return computeds.amountValidValues(this);
    }});
    Object.defineProperty(ctx, 'amountMin', {get() {
      return computeds.amountMin(this);
    }});
    Object.defineProperty(ctx, 'amountMax', {get() {
      return computeds.amountMax(this);
    }});
    methods.adjust(ctx, 1);
    expect(ctx.value).to.eq(4);
    methods.adjust(ctx, -1);
    expect(ctx.value).to.eq(3);
  });
});
