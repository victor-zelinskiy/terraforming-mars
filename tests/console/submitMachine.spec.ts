import {expect} from 'chai';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {exploreMachine, machineLawViolations} from '@/client/console/kernel/flowLaw';
import {startFlowActor} from '@/client/console/kernel/flowMachine';
import {openFlowRoot, resetFlowKernel} from '@/client/console/kernel/flowScope';
import {
  SUBMIT_NO_RESPONSE_MS, SUBMIT_PRESENT_MAX_MS, SUBMIT_SAMPLE_EVENTS, SUBMIT_STATUSES, submitMachine,
} from '@/client/console/transport/submitMachine';

/**
 * THE SUBMIT'S LIFECYCLE (architecture v2, lifecycle 4) — both of its waits are states with a bound of their own, and
 * every path ends in one of six named statuses. The funnel around it is `gameTransport` (client spec
 * `tests/client/console/gameTransportFunnel.spec.ts`).
 */
describe('submitMachine', () => {
  let clock: ManualFlowClock;
  beforeEach(() => {
    resetFlowKernel();
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    resetFlowKernel();
    setFlowClock(undefined);
  });

  const start = () => startFlowActor(openFlowRoot('test'), submitMachine, {endScopeOnDone: false});

  it('keeps the law — and the explorer reads every state', () => {
    expect(machineLawViolations(submitMachine)).to.deep.eq([]);
    const explored = exploreMachine(submitMachine, {events: SUBMIT_SAMPLE_EVENTS});
    expect(explored.violations).to.deep.eq([]);
    // sending · presenting · the six ends
    expect(explored.states).to.eq(8);
  });

  it('answered → presented: applied', () => {
    const flow = start();
    flow.send({type: 'ANSWERED'});
    expect(flow.snapshot.value.value).to.eq('presenting');
    flow.send({type: 'PRESENTED'});
    expect(flow.snapshot.value.value).to.eq('applied');
    expect(flow.snapshot.value.status).to.eq('done');
    expect(clock.pending(), 'no bound outlives the submit').to.eq(0);
  });

  it('the staged MarsBot pipeline takes the commit: staged', () => {
    const flow = start();
    flow.send({type: 'ANSWERED'});
    flow.send({type: 'STAGED'});
    expect(flow.snapshot.value.value).to.eq('staged');
  });

  it('a refusal and a network failure end it from `sending`', () => {
    const refused = start();
    refused.send({type: 'REFUSED'});
    expect(refused.snapshot.value.value).to.eq('refused');
    const failed = start();
    failed.send({type: 'FAILED'});
    expect(failed.snapshot.value.value).to.eq('failed');
  });

  it('THE SERVER\'S SILENCE is the bound of `sending` — and only of it', () => {
    expect(SUBMIT_NO_RESPONSE_MS, 'a generous minute: a slow server is not a dead one').to.be.at.least(45_000);
    const silent = start();
    clock.advance(SUBMIT_NO_RESPONSE_MS - 1);
    expect(silent.snapshot.value.value).to.eq('sending');
    clock.advance(1);
    expect(silent.snapshot.value.value).to.eq('silent');
    // A server that ANSWERED is never cut by its silence bound, however long its scenes play.
    const answered = start();
    clock.advance(SUBMIT_NO_RESPONSE_MS - 5);
    answered.send({type: 'ANSWERED'});
    clock.advance(SUBMIT_NO_RESPONSE_MS);
    expect(answered.snapshot.value.value).to.eq('presenting');
  });

  it('a presentation that never ends is bounded too: abandoned', () => {
    const flow = start();
    flow.send({type: 'ANSWERED'});
    clock.advance(SUBMIT_PRESENT_MAX_MS - 1);
    expect(flow.snapshot.value.value).to.eq('presenting');
    clock.advance(1);
    expect(flow.snapshot.value.value).to.eq('abandoned');
  });

  it('the supervisor\'s RELEASE ends a standing presentation — and never a request on the wire', () => {
    const wire = start();
    wire.send({type: 'RELEASE'});
    expect(wire.snapshot.value.value, 'left to the network').to.eq('sending');
    const presenting = start();
    presenting.send({type: 'ANSWERED'});
    presenting.send({type: 'RELEASE'});
    expect(presenting.snapshot.value.value).to.eq('abandoned');
  });

  it('a chain that throws while presenting ends it failed', () => {
    const flow = start();
    flow.send({type: 'ANSWERED'});
    flow.send({type: 'FAILED'});
    expect(flow.snapshot.value.value).to.eq('failed');
  });

  it('an ended submit takes nothing more', () => {
    const flow = start();
    flow.send({type: 'REFUSED'});
    flow.send({type: 'ANSWERED'});
    flow.send({type: 'PRESENTED'});
    expect(flow.snapshot.value.value).to.eq('refused');
  });

  it('the statuses are exactly the machine\'s ends', () => {
    const ends = Object.entries(submitMachine.root.states).filter(([, node]) => node.type === 'final').map(([key]) => key).sort();
    expect(ends).to.deep.eq([...SUBMIT_STATUSES].sort());
  });
});
