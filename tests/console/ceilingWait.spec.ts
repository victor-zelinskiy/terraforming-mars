import {expect} from 'chai';
import {beginCeilingWait, ceilingStats, raceCeiling, resetCeilingStats} from '@/client/console/waitGraph/ceilingWait';
import {collectWaitNodes, resetWaitGraph} from '@/client/console/waitGraph/waitGraph';

/*
 * A WAIT WHOSE ONLY WAY OUT IS A CEILING (the owner's field freeze of 2026-11-08 — Flooding's 8 s): a node of the wait
 * graph for its life, and a ceiling that ends it rather than the awaited thing is SAID once — the worklist of hidden
 * mutual waits.
 */
describe('ceilingWait — a ceiling is a node, and a ceiling hit is said', () => {
  const warns: Array<string> = [];
  const original = console.warn;
  beforeEach(() => {
    resetWaitGraph();
    resetCeilingStats();
    warns.splice(0);
    console.warn = (...args: Array<unknown>) => warns.push(args.map(String).join(' '));
  });
  afterEach(() => {
    console.warn = original;
    resetWaitGraph();
    resetCeilingStats();
  });

  it('stands as a node with its ceiling as the bound and its target, numbered by run; met ends it silently', () => {
    const w = beginCeilingWait({id: 'played-hero:payback', owner: 'playedHero', what: 'the play answer', maxMs: 8_000, target: 'server'}, 100);
    const node = collectWaitNodes(200).find((n) => n.id.startsWith('ceiling:played-hero:payback#'));
    expect(node).to.include({family: 'flow', owner: 'playedHero', boundMs: 8_000, since: 100});
    expect(node?.targets).to.deep.eq([{kind: 'server', what: 'the play answer'}]);
    w.met();
    w.ceiling();
    expect(collectWaitNodes(300)).to.deep.eq([]);
    expect(ceilingStats).to.include({met: 1, hits: 0});
    expect(warns).to.deep.eq([]);
  });

  it('a ceiling hit is said ONCE with who waited and for what, counted, and the node is gone', () => {
    const w = beginCeilingWait({id: 'scale-swing:stage', owner: 'scaleSwing', what: 'a watchable stage', maxMs: 6_000, detail: 'temperature'});
    w.ceiling();
    w.ceiling();
    w.met();
    expect(warns).to.have.length(1);
    expect(warns[0]).to.eq('[wait-graph] ceiling scale-swing:stage (scaleSwing: temperature) — «a watchable stage» did not come in 6000 ms — the wait ended on its ceiling');
    expect(ceilingStats.hits).eq(1);
    expect(ceilingStats.met).eq(0);
    expect(collectWaitNodes(1)).to.deep.eq([]);
  });

  it('an abandoned wait ends silently and counts nothing', () => {
    const w = beginCeilingWait({id: 'x', owner: 'o', what: 'w', maxMs: 10});
    w.end();
    w.ceiling();
    expect(warns).to.deep.eq([]);
    expect(ceilingStats).to.include({met: 0, hits: 0});
  });

  it('raceCeiling: the awaited thing first → true, met; the ceiling first → false, said', async () => {
    expect(await raceCeiling({id: 'fast', owner: 'o', what: 'w', maxMs: 1_000}, Promise.resolve())).eq(true);
    expect(await raceCeiling({id: 'slow', owner: 'o', what: 'never', maxMs: 5}, new Promise(() => {}))).eq(false);
    expect(ceilingStats).to.include({met: 1, hits: 1});
    expect(warns.some((w) => w.startsWith('[wait-graph] ceiling slow (o) — «never»'))).eq(true);
  });
});
