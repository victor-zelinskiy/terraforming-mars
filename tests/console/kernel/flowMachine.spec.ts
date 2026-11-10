import {expect} from 'chai';
import {computed} from 'vue';
import {assign, setup} from 'xstate';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {startFlowActor} from '@/client/console/kernel/flowMachine';
import {dumpFlowTree, openFlowRoot, resetFlowKernel} from '@/client/console/kernel/flowScope';
import {flowTrace, resetFlowTrace} from '@/client/console/kernel/flowTrace';

const funnel = setup({
  types: {context: {} as {sent: number}, events: {} as {type: 'PRESS'} | {type: 'ANSWER'} | {type: 'CLOSE'}},
}).createMachine({
  id: 'funnel',
  initial: 'idle',
  context: {sent: 0},
  states: {
    idle: {tags: ['rest'], on: {PRESS: {target: 'sending', actions: assign({sent: ({context}) => context.sent + 1})}, CLOSE: 'closed'}},
    sending: {tags: ['beat'], meta: {waitsOn: 'the server'}, on: {ANSWER: 'idle'}, after: {60000: 'idle'}},
    closed: {type: 'final'},
  },
});

/**
 * A MACHINE IN A SCOPE — it runs on the kernel's clock (a bound is a unit test), stops with its scope, and its snapshot
 * is the one reactive mirror of its state.
 */
describe('flow kernel · a machine in a scope', () => {
  let clock: ManualFlowClock;
  beforeEach(() => {
    resetFlowKernel();
    resetFlowTrace();
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    resetFlowKernel();
    setFlowClock(undefined);
  });

  it('the snapshot is reactive and written in the same call as the send', () => {
    const scope = openFlowRoot('test', 'funnel');
    const flow = startFlowActor(scope, funnel);
    const busy = computed(() => flow.snapshot.value.matches('sending'));
    expect(busy.value).to.eq(false);
    flow.send({type: 'PRESS'});
    expect(busy.value).to.eq(true);
    expect(flow.snapshot.value.context.sent).to.eq(1);
  });

  it('the bound of a beat fires on the kernel clock', () => {
    const scope = openFlowRoot('test');
    const flow = startFlowActor(scope, funnel);
    flow.send({type: 'PRESS'});
    clock.advance(59_999);
    expect(flow.snapshot.value.value).to.eq('sending');
    clock.advance(1);
    expect(flow.snapshot.value.value).to.eq('idle');
    expect(clock.pending()).to.eq(0);
  });

  it('the machine stops with its scope — its timers go with it, a late send is dropped', () => {
    const scope = openFlowRoot('test');
    const flow = startFlowActor(scope, funnel);
    flow.send({type: 'PRESS'});
    expect(clock.pending()).to.eq(1);
    scope.end({how: 'cancelled', reason: 'the session left'});
    expect(clock.pending()).to.eq(0);
    flow.send({type: 'ANSWER'});
    expect(flow.snapshot.value.value).to.eq('sending');
    expect(flow.actor.getSnapshot().status).to.eq('stopped');
  });

  it('a machine that reaches its end ends its scope', () => {
    const scope = openFlowRoot('test');
    const flow = startFlowActor(scope, funnel);
    flow.send({type: 'CLOSE'});
    expect(scope.ended).to.deep.eq({how: 'done'});
  });

  it('…unless the scope outlives the machine on purpose', () => {
    const scope = openFlowRoot('test');
    const flow = startFlowActor(scope, funnel, {endScopeOnDone: false});
    flow.send({type: 'CLOSE'});
    expect(scope.ended).to.eq(undefined);
  });

  it('every transition is traced and the tree dump carries the state', () => {
    const scope = openFlowRoot('test', 'funnel');
    const flow = startFlowActor(scope, funnel);
    flow.send({type: 'PRESS'});
    expect(flowTrace().filter((r) => r.kind === 'state').map((r) => `${r.scope} ${r.detail}`)).to.deep.eq(['test:funnel#1 idle → sending']);
    expect(dumpFlowTree()).to.deep.eq(['test:funnel#1 0.0s sending']);
  });

  it('a machine started in an ended scope never runs', () => {
    const scope = openFlowRoot('test');
    scope.end();
    const flow = startFlowActor(scope, funnel);
    flow.send({type: 'PRESS'});
    expect(flow.snapshot.value.value).to.eq('idle');
    expect(clock.pending()).to.eq(0);
  });
});
