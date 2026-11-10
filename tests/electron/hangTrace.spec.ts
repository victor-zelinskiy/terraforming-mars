import {expect} from 'chai';
import * as path from 'path';
import {createHangTrace, HANG_TRACE_CATEGORIES, HANG_TRACE_KEEP, HangTraceDeps, hangTraceName, hangTracesToPrune} from '../../electron/hangTrace';
import {createRendererHangWatch, HangWatchDeps} from '../../electron/rendererHangWatch';

/**
 * THE TRACE OF A RENDERER STOP (architecture v2 · N1) — the hang watch names where the screen stood; the trace says
 * where the FRAME went. It is recorded for the stop's first seconds, written before the renderer is restarted, kept to
 * a handful of files, and nothing about it can break the watch.
 */
describe('hangTrace', () => {
  function recorder(over: Partial<HangTraceDeps> = {}) {
    const log: Array<string> = [];
    const files = ['renderer-hang-20261101-100000.trace.json', 'console-game.log'];
    const deps: HangTraceDeps = {
      startRecording: async (categories) => {
        log.push(`start ${categories.length}`);
      },
      stopRecording: async (file) => {
        log.push(`stop ${path.basename(file)}`);
        return file;
      },
      dir: () => 'logs',
      list: () => files,
      remove: (file) => log.push(`remove ${path.basename(file)}`),
      now: () => new Date(2026, 10, 10, 22, 15, 3).getTime(),
      note: (line) => log.push(`note ${line}`),
      ...over,
    };
    return {trace: createHangTrace(deps), log, files};
  }

  it('records the categories that tell style / layout / paint / raster / compositor / GPU apart — and the samplers', () => {
    for (const category of ['blink', 'cc', 'viz', 'gpu', 'devtools.timeline', 'disabled-by-default-cpu_profiler']) {
      expect(HANG_TRACE_CATEGORIES, category).to.include(category);
    }
  });

  it('start → stop writes one sortable file beside the logs and says where', async () => {
    const r = recorder();
    r.trace.start();
    const file = await r.trace.stop('11s, the page answered again');
    expect(path.basename(file)).to.eq('renderer-hang-20261110-221503.trace.json');
    expect(r.log).to.deep.eq([`start ${HANG_TRACE_CATEGORIES.length}`, 'stop renderer-hang-20261110-221503.trace.json']);
    expect(hangTraceName(new Date(2026, 0, 2, 3, 4, 5).getTime())).to.eq('renderer-hang-20260102-030405.trace.json');
  });

  it('keeps only the last few traces — the oldest go, nothing else in the folder is touched', async () => {
    const names = ['a.log', ...Array.from({length: 7}, (_, i) => `renderer-hang-2026110${i}-000000.trace.json`)];
    expect(hangTracesToPrune(names)).to.deep.eq(names.slice(1, 1 + 7 - (HANG_TRACE_KEEP - 1)));
    expect(hangTracesToPrune(['x.trace.json', 'renderer-hang-1.trace.json'])).to.deep.eq([]);
    const r = recorder({list: () => names});
    r.trace.start();
    await r.trace.stop('x');
    expect(r.log.filter((l) => l.startsWith('remove')).length).to.eq(7 - (HANG_TRACE_KEEP - 1));
  });

  it('a stop with no start writes nothing; a second start while recording is one recording', async () => {
    const r = recorder();
    expect(await r.trace.stop('nothing')).to.eq('');
    r.trace.start();
    r.trace.start();
    await r.trace.stop('x');
    expect(r.log.filter((l) => l.startsWith('start')).length).to.eq(1);
  });

  it('a recorder that cannot start, or cannot write, is SAID and never thrown', async () => {
    const cannotStart = recorder({startRecording: () => Promise.reject(new Error('already tracing'))});
    cannotStart.trace.start();
    expect(await cannotStart.trace.stop('x')).to.eq('');
    expect(cannotStart.log.some((l) => l.includes('the trace could not start'))).to.eq(true);
    const cannotWrite = recorder({stopRecording: () => Promise.reject(new Error('disk full'))});
    cannotWrite.trace.start();
    expect(await cannotWrite.trace.stop('x')).to.eq('');
    expect(cannotWrite.log.some((l) => l.includes('could not be written'))).to.eq(true);
  });

  describe('with the hang watch', () => {
    function harness() {
      let now = 1_000;
      const timers: Array<{fn: () => void, at: number, live: boolean}> = [];
      const notes: Array<string> = [];
      const calls: Array<string> = [];
      let stops = 0;
      const deps: HangWatchDeps = {
        probe: () => Promise.resolve(''),
        note: (l) => notes.push(l),
        post: () => undefined,
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
        trace: {
          start: () => calls.push('trace:start'),
          stop: (label) => {
            calls.push(`trace:stop (${label})`);
            return Promise.resolve(`logs/trace-${++stops}.json`);
          },
        },
      };
      const advance = (ms: number) => {
        now += ms;
        timers.filter((t) => t.live && t.at <= now).forEach((t) => {
          t.live = false;
          t.fn();
        });
      };
      return {watch: createRendererHangWatch(deps, {reloadAfterMs: 30_000, maxReloads: 2, reloadWindowMs: 300_000, traceMaxMs: 8_000}), notes, calls, advance};
    }
    const flush = () => new Promise((r) => setImmediate(r));

    it('the stop is traced from the moment the page stops answering; a short stop ends its trace when the page answers', async () => {
      const h = harness();
      h.watch.onUnresponsive();
      expect(h.calls).to.deep.eq(['trace:start']);
      h.advance(3_000);
      h.watch.onResponsive();
      await flush();
      expect(h.calls).to.deep.eq(['trace:start', 'trace:stop (3s, the page answered again)']);
      expect(h.notes[h.notes.length - 1]).to.contain('[renderer-hang] trace of the stop (3s, the page answered again): logs/trace-1.json');
    });

    it('a long stop is traced for its first seconds only — and the trace is on disk long before the restart', async () => {
      const h = harness();
      h.watch.onUnresponsive();
      h.advance(8_000);
      await flush();
      expect(h.calls).to.deep.eq(['trace:start', 'trace:stop (its first seconds)']);
      h.advance(22_000);
      await flush();
      expect(h.calls, 'the restart does not wait for a trace that is already written').to.deep.eq(['trace:start', 'trace:stop (its first seconds)', 'crash']);
    });

    it('a trace still recording at the restart is written BEFORE the renderer goes', async () => {
      const h = harness();
      // A watch whose trace bound is past its reload bound.
      const long = createRendererHangWatch({
        probe: () => Promise.resolve(''), note: () => undefined, post: () => undefined,
        crash: () => h.calls.push('crash'), reload: () => undefined, now: () => 5,
        setTimer: (fn, ms) => {
          if (ms === 30_000) {
            setImmediate(fn);
          }
          return {};
        },
        clearTimer: () => undefined,
        trace: {start: () => h.calls.push('trace:start'), stop: (label) => {
          h.calls.push(`trace:stop (${label})`);
          return Promise.resolve('f.json');
        }},
      }, {reloadAfterMs: 30_000, maxReloads: 2, reloadWindowMs: 300_000, traceMaxMs: 60_000});
      long.onUnresponsive();
      await flush();
      await flush();
      expect(h.calls).to.deep.eq(['trace:start', 'trace:stop (before the restart)', 'crash']);
    });

    it('a renderer that dies ends the trace of its stop', async () => {
      const h = harness();
      h.watch.onUnresponsive();
      h.watch.onGone('crashed', 9);
      await flush();
      expect(h.calls).to.include('trace:stop (the renderer process went)');
    });
  });
});
