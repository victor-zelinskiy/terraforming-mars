import {expect} from 'chai';
import {Color} from '@/common/Color';
import {
  effectStatsFor,
  effectStatsFresh,
  effectStatsVersion,
  ensureEffectStats,
  resetEffectStats,
} from '@/client/console/effectStatsStore';

/**
 * THE EFFECT-STATS STORE — version-keyed (serverDerivedCacheGuard's law), SWR,
 * stale-response-dropping, per-seat retention. The fetch is stubbed; each stub
 * call hands back a controllable promise so landing order can be exercised.
 */
type PendingCall = {
  url: string,
  resolve: (body: unknown) => void,
  reject: (err: Error) => void,
};

describe('effectStatsStore', () => {
  const realFetch = globalThis.fetch;
  let calls: Array<PendingCall> = [];

  beforeEach(() => {
    resetEffectStats();
    calls = [];
    (globalThis as {fetch: unknown}).fetch = (url: string) => {
      return new Promise((resolve, reject) => {
        calls.push({
          url,
          resolve: (body: unknown) => resolve({ok: true, status: 200, json: () => Promise.resolve(body)}),
          reject,
        });
      });
    };
  });

  afterEach(() => {
    (globalThis as {fetch: unknown}).fetch = realFetch;
    resetEffectStats();
  });

  const view = (gameAge: number, id = 'p1') => ({id, game: {gameAge, undoCount: 0}});
  const RED = 'red' as Color;
  const BLUE = 'blue' as Color;
  const statBody = (n: number) => [{sourceKey: `card:S${n}`, triggerCount: n}];
  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  it('stamps the entry by version + seat', () => {
    expect(effectStatsVersion(view(7), RED)).to.eq('p1|a7|u0#red');
    expect(effectStatsVersion(view(7), RED)).to.not.eq(effectStatsVersion(view(8), RED));
    expect(effectStatsVersion(view(7), RED)).to.not.eq(effectStatsVersion(view(7), BLUE));
  });

  it('fetches once per (version, seat) — repeat ensures de-dup', async () => {
    ensureEffectStats(view(7), RED);
    ensureEffectStats(view(7), RED);
    expect(calls).to.have.length(1);
    expect(calls[0].url).to.include('api/game/effect-stats');
    expect(calls[0].url).to.include('color=red');
    calls[0].resolve(statBody(1));
    await flush();
    expect(effectStatsFor(RED)).to.have.length(1);
    expect(effectStatsFresh(view(7), RED)).to.be.true;
    // Cached — a third ensure at the same version asks nothing.
    ensureEffectStats(view(7), RED);
    expect(calls).to.have.length(1);
  });

  it('SWR: a version change re-asks while the stale answer keeps painting', async () => {
    ensureEffectStats(view(7), RED);
    calls[0].resolve(statBody(1));
    await flush();
    ensureEffectStats(view(8), RED);
    expect(calls).to.have.length(2);
    // The old entry still paints while the refetch is on the wire.
    expect(effectStatsFor(RED)).to.deep.eq(statBody(1));
    expect(effectStatsFresh(view(8), RED)).to.be.false;
    calls[1].resolve(statBody(2));
    await flush();
    expect(effectStatsFor(RED)).to.deep.eq(statBody(2));
    expect(effectStatsFresh(view(8), RED)).to.be.true;
  });

  it('drops a stale answer superseded by a newer ask', async () => {
    ensureEffectStats(view(7), RED);
    ensureEffectStats(view(8), RED); // supersedes before the first lands
    expect(calls).to.have.length(2);
    calls[0].resolve(statBody(1)); // the OLD answer lands late
    await flush();
    expect(effectStatsFor(RED), 'the superseded answer is dropped').to.be.undefined;
    calls[1].resolve(statBody(2));
    await flush();
    expect(effectStatsFor(RED)).to.deep.eq(statBody(2));
  });

  it('keeps per-seat entries warm across LB/RB', async () => {
    ensureEffectStats(view(7), RED);
    ensureEffectStats(view(7), BLUE);
    calls[0].resolve(statBody(1));
    calls[1].resolve(statBody(2));
    await flush();
    expect(effectStatsFor(RED)).to.deep.eq(statBody(1));
    expect(effectStatsFor(BLUE)).to.deep.eq(statBody(2));
  });

  it('a failed fetch keeps the stale entry and retries on the next ensure', async () => {
    ensureEffectStats(view(7), RED);
    calls[0].resolve(statBody(1));
    await flush();
    ensureEffectStats(view(8), RED);
    calls[1].reject(new Error('network'));
    await flush();
    expect(effectStatsFor(RED), 'stale entry survives the failure').to.deep.eq(statBody(1));
    // The latch is cleared — the same version can be asked again.
    ensureEffectStats(view(8), RED);
    expect(calls).to.have.length(3);
    calls[2].resolve(statBody(2));
    await flush();
    expect(effectStatsFor(RED)).to.deep.eq(statBody(2));
  });

  it('ignores a viewless ask and resets wholesale', async () => {
    ensureEffectStats({id: '', game: {gameAge: 1, undoCount: 0}}, RED);
    expect(calls).to.have.length(0);
    ensureEffectStats(view(7), RED);
    calls[0].resolve(statBody(1));
    await flush();
    resetEffectStats();
    expect(effectStatsFor(RED)).to.be.undefined;
  });
});
