import {expect} from 'chai';
import {
  collectWaitNodes, declareWait, registerWaitRecovery, registerWaitSource, resetWaitGraph, tickWaitGraph, waitGraphArming, waitGraphCures, waitGraphDigest,
  waitGraphSnapshot, waitGraphStats,
} from '@/client/console/waitGraph/waitGraph';
import {WAIT_GRAPH_CONFIRM_TICKS, WaitWorld} from '@/client/console/waitGraph/waitGraphModel';

/*
 * THE WAIT GRAPH's registry: sources and declarations make ONE snapshot per tick, a node with no `since` is stamped on
 * its first sighting, a confirmed finding is logged ONCE (the shadow — Э2 acts on nothing), and a declaration's handle
 * never touches a newer run of the same id.
 */
describe('waitGraph registry', () => {
  const warns: Array<string> = [];
  const original = console.warn;
  beforeEach(() => {
    resetWaitGraph();
    warns.splice(0);
    console.warn = (...args: Array<unknown>) => warns.push(args.map(String).join(' '));
  });
  afterEach(() => {
    console.warn = original;
    resetWaitGraph();
  });
  const world = (now: number): WaitWorld => ({now, accepting: true, requestInFlight: false, serverOwes: false});

  it('a source node with no since is stamped at its first sighting and keeps that stamp; it is forgotten when gone', () => {
    let present = true;
    registerWaitSource('t', () => (present ? [{id: 'hold:x', family: 'hold', owner: 't', targets: [{kind: 'motion', what: 'm'}], boundMs: 1_000}] : []));
    expect(collectWaitNodes(100)[0].since).eq(100);
    expect(collectWaitNodes(900)[0].since, 'the same wait — the first sighting stands').eq(100);
    present = false;
    expect(collectWaitNodes(1_000)).to.deep.eq([]);
    present = true;
    expect(collectWaitNodes(2_000)[0].since, 'a NEW wait after the gap').eq(2_000);
  });

  it('the field lock: a cycle across two sources is logged ONCE, on its confirming tick, with its members and the yielding one', () => {
    registerWaitSource('shell', () => [
      {id: 'conclusion:parliament', family: 'conclusion', owner: 'shell', targets: [{kind: 'node', id: 'question:chairmanQuest#509'}]},
      {id: 'question:chairmanQuest#509', family: 'question', owner: 'shell', targets: [{kind: 'node', id: 'announce:task#509'}]},
    ]);
    registerWaitSource('gate', () => [
      {id: 'announce:task#509', family: 'announce', owner: 'mandatoryGate', targets: [{kind: 'node', id: 'conclusion:parliament'}], detail: 'plate hidden'},
    ]);
    for (let t = 0; t < WAIT_GRAPH_CONFIRM_TICKS + 3; t++) {
      tickWaitGraph(world(1_000 * (t + 1)));
    }
    const lines = warns.filter((w) => w.startsWith('[wait-graph] cycle'));
    expect(lines).to.have.length(1);
    expect(lines[0]).to.contain('announce:task#509 (mandatoryGate: plate hidden)');
    expect(lines[0]).to.contain('yields: announce:task#509');
    expect(waitGraphStats.confirmed.cycle).eq(1);
    expect(waitGraphSnapshot().nodes).to.have.length(3);
    expect(waitGraphDigest()).to.contain('conclusion:parliament→question:chairmanQuest#509');
  });

  it('a declared wait ends by its own handle; a NEWER declaration of the same id is another run — the old handle cannot end it', () => {
    const first = declareWait({id: 'flow:rally', family: 'flow', owner: 'rally', targets: [{kind: 'motion', what: 'cubes'}], boundMs: 9_000}, 100);
    const second = declareWait({id: 'flow:rally', family: 'flow', owner: 'rally', targets: [{kind: 'motion', what: 'cubes'}], boundMs: 9_000}, 200);
    first.end();
    first.update({detail: 'stale'});
    expect(collectWaitNodes(300).map((n) => `${n.id}@${n.since}:${n.detail ?? ''}`)).to.deep.eq(['flow:rally@200:']);
    second.end();
    expect(collectWaitNodes(400)).to.deep.eq([]);
  });

  it('Э3 — a confirmed cycle is broken at its YIELDING member through that member\'s own door, once; a door with nothing to do hands the turn up the rank', () => {
    const calls: Array<string> = [];
    registerWaitRecovery('plate-door', () => {
      calls.push('plate');
      return '';
    });
    registerWaitRecovery('conclusion-door', (node) => {
      calls.push(node.id);
      return 'opened the question in place';
    });
    registerWaitSource('t', () => [
      {id: 'conclusion:parliament', family: 'conclusion', owner: 'shell', targets: [{kind: 'node', id: 'question:q#1'}], recovery: 'conclusion-door'},
      {id: 'question:q#1', family: 'question', owner: 'server', targets: [{kind: 'node', id: 'announce:q#1'}]},
      {id: 'announce:q#1', family: 'announce', owner: 'gate', targets: [{kind: 'node', id: 'conclusion:parliament'}], recovery: 'plate-door'},
    ]);
    for (let t = 0; t < WAIT_GRAPH_CONFIRM_TICKS + 2; t++) {
      tickWaitGraph(world(1_000 * (t + 1)));
    }
    expect(calls, 'the plate yields first; it had nothing to do — the conclusion\'s door took the turn').to.deep.eq(['plate', 'conclusion:parliament']);
    expect(waitGraphCures.map((c) => `${c.member}:${c.door}`)).to.deep.eq(['conclusion:parliament:conclusion-door']);
    expect(warns.some((w) => w.startsWith('[wait-graph] cure cycle at conclusion:parliament through «conclusion-door» — opened the question in place'))).eq(true);
  });

  it('Э3 — an unarmed class is only a shadow: the finding is logged, no door is called', () => {
    let called = 0;
    registerWaitRecovery('d', () => {
      called++;
      return 'did';
    });
    waitGraphArming.armed = new Set();
    registerWaitSource('t', () => [
      {id: 'a', family: 'flow', owner: 't', targets: [{kind: 'node', id: 'b'}], recovery: 'd'},
      {id: 'b', family: 'flow', owner: 't', targets: [{kind: 'node', id: 'a'}], recovery: 'd'},
    ]);
    for (let t = 0; t < WAIT_GRAPH_CONFIRM_TICKS + 1; t++) {
      tickWaitGraph(world(1_000 * (t + 1)));
    }
    expect(called).eq(0);
    expect(warns.some((w) => w.startsWith('[wait-graph] cycle'))).eq(true);
  });

  it('a DEAD END (armed by default) is cured through the node\'s own door; a dead end with no door is a worklist row', () => {
    const calls: Array<string> = [];
    registerWaitRecovery('question-open', (node) => {
      calls.push(node.id);
      return 'reopened the «projectCard» question in «hand»';
    });
    registerWaitSource('t', () => [
      {id: 'question:projectCard#7', family: 'question', owner: 'server', targets: [{kind: 'player', what: 'answer the question'}], recovery: 'question-open'},
      {id: 'surface:start', family: 'surface', owner: 'workspace:start', targets: [{kind: 'player', what: 'the player browses'}]},
    ]);
    const deaf = (now: number): WaitWorld => ({now, accepting: false, requestInFlight: false, serverOwes: false});
    for (let t = 0; t < WAIT_GRAPH_CONFIRM_TICKS + 2; t++) {
      tickWaitGraph(deaf(1_000 * (t + 1)));
    }
    expect(calls, 'the door called once, on the confirming tick').to.deep.eq(['question:projectCard#7']);
    expect(warns.some((w) => w === '[wait-graph] cure dead-end at question:projectCard#7 through «question-open» — reopened the «projectCard» question in «hand»')).eq(true);
    expect(warns.some((w) => w === '[wait-graph] cure dead-end — surface:start has no door: a worklist row')).eq(true);
  });

  it('OVERDUE acts only on a plate (its bound is the graph\'s own — inventory A1); an overdue hold is left to its own expire', () => {
    const calls: Array<string> = [];
    registerWaitRecovery('announce-serve', (node) => {
      calls.push(node.id);
      return 'lit the beacon of task#9';
    });
    registerWaitRecovery('hold-expire', (node) => {
      calls.push(node.id);
      return 'expired';
    });
    registerWaitSource('t', () => [
      {id: 'announce:task#9', family: 'announce', owner: 'gate', targets: [{kind: 'motion', what: 'the first presentation'}], boundMs: 15_000, since: 0, recovery: 'announce-serve'},
      {id: 'hold:x', family: 'hold', owner: 'h', targets: [{kind: 'motion', what: 'a flight'}], boundMs: 1_000, since: 0, recovery: 'hold-expire'},
    ]);
    for (let t = 0; t < WAIT_GRAPH_CONFIRM_TICKS + 1; t++) {
      tickWaitGraph(world(20_000 + 1_000 * t));
    }
    expect(calls).to.deep.eq(['announce:task#9']);
  });

  it('a source that throws is named and skipped — the graph never dies with it', () => {
    registerWaitSource('bad', () => {
      throw new Error('boom');
    });
    registerWaitSource('good', () => [{id: 'hold:y', family: 'hold', owner: 'g', targets: [{kind: 'motion', what: 'm'}], boundMs: 5_000}]);
    expect(collectWaitNodes(10).map((n) => n.id)).to.deep.eq(['hold:y']);
    expect(waitGraphStats.sourceErrors).eq(1);
    expect(warns.some((w) => w.includes('source «bad» threw'))).eq(true);
  });
});
