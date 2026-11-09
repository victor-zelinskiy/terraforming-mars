import {expect} from 'chai';
import {createRendererHangWatch, describeLastScreen, HangWatchDeps} from '../../electron/rendererHangWatch';

/**
 * THE RENDERER HANG WATCH — a stop in native rendering (CI 42626840874: 15 min with the main thread outside JS) is seen
 * only from the main process: it names the last screen, and past the bound restarts the renderer, never forever.
 */
describe('rendererHangWatch', () => {
  function harness(probeAnswer: string | 'never' = JSON.stringify({session: 's1', game: 'g1', player: 'p1',
    beat: {prompt: 'or|actionMenu#18', accepting: true, frames: ['hand:browse'], section: 'board/', quietS: 0, at: 1}})) {
    let now = 1_000;
    const timers: Array<{fn: () => void, at: number, live: boolean}> = [];
    const notes: Array<string> = [];
    const posts: Array<{kind: string, record: object}> = [];
    const calls: Array<string> = [];
    const probes = {count: 0};
    const deps: HangWatchDeps = {
      probe: () => {
        probes.count++;
        return probeAnswer === 'never' ? new Promise<string>(() => undefined) : Promise.resolve(probeAnswer);
      },
      note: (l) => notes.push(l),
      post: (b) => posts.push(b),
      crash: () => calls.push('crash'),
      reload: () => calls.push('reload'),
      now: () => now,
      setTimer: (fn, ms) => {
        const t = {fn, at: now + ms, live: true};
        timers.push(t);
        return t;
      },
      clearTimer: (h) => {
        (h as {live: boolean}).live = false;
      },
    };
    const advance = (ms: number) => {
      now += ms;
      timers.filter((t) => t.live && t.at <= now).forEach((t) => {
        t.live = false;
        t.fn();
      });
    };
    return {watch: createRendererHangWatch(deps, {reloadAfterMs: 30_000, maxReloads: 2, reloadWindowMs: 300_000}), notes, posts, calls, advance, probes};
  }
  const flush = () => new Promise((r) => setImmediate(r));

  it('names the LAST SCREEN when the page stops answering, and how long the stop lasted when it answers again', async () => {
    const h = harness();
    h.watch.probeTick();
    await flush();
    h.advance(4_000);
    h.watch.onUnresponsive();
    expect(h.notes[0]).to.match(/^\[renderer-hang\] the page stopped answering — the last screen \(read 4s before: prompt or\|actionMenu#18, accepting, frames hand:browse/);
    expect(h.posts[0].kind).to.equal('renderer-hang');
    expect(h.posts[0].record).to.include({game: 'g1', player: 'p1', session: 's1'});
    h.advance(11_000);
    h.watch.onResponsive();
    expect(h.notes[1]).to.equal('[renderer-hang] the page answers again after 11s');
    h.advance(60_000);
    expect(h.calls, 'answered in time — never restarted').to.deep.equal([]);
  });

  it('a stop past the bound restarts the renderer; its exit reloads the page once', () => {
    const h = harness();
    h.watch.onUnresponsive();
    h.advance(30_000);
    expect(h.calls).to.deep.equal(['crash']);
    expect(h.notes[1]).to.contain('still not answering after 30s');
    h.watch.onGone('killed', 0);
    expect(h.calls).to.deep.equal(['crash', 'reload']);
    expect(h.notes.filter((l) => l.includes('process is gone')), 'its own crash is not reported as a crash').to.deep.equal([]);
  });

  it('a renderer that dies on its own is named and reloaded; a clean exit is not', () => {
    const h = harness();
    h.watch.onGone('crashed', 133);
    expect(h.calls).to.deep.equal(['reload']);
    expect(h.notes[0]).to.contain('the renderer process is gone (crashed, exit 133)');
    h.watch.onGone('clean-exit', 0);
    expect(h.calls).to.deep.equal(['reload']);
  });

  it('never reloads forever — a page that dies again and again is left after the budget, named', () => {
    const h = harness();
    h.watch.onGone('crashed', 1);
    h.watch.onGone('crashed', 1);
    h.watch.onGone('crashed', 1);
    expect(h.calls).to.deep.equal(['reload', 'reload']);
    expect(h.notes[h.notes.length - 1]).to.contain('NOT reloaded: 2 reloads in 5 min already');
  });

  it('one probe in flight at most — a hung page never piles them up; none while the page is known silent', () => {
    const h = harness('never');
    h.watch.probeTick();
    h.watch.probeTick();
    h.watch.probeTick();
    expect(h.probes.count).to.equal(1);
    expect(describeLastScreen(undefined, 0, 5_000)).to.equal('no heartbeat read yet');
  });
});
