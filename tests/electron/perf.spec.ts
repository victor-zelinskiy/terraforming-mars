import {expect} from 'chai';
import {applyPerformanceSwitches} from '../../electron/perf';
import {cacheControl} from '../../electron/protocol';

// A minimal App stand-in that records the command-line switches appended.
function fakeApp() {
  const switches: Array<{key: string, value?: string}> = [];
  return {
    switches,
    commandLine: {
      appendSwitch(key: string, value?: string) {
        switches.push(value === undefined ? {key} : {key, value});
      },
    },
  };
}

describe('electron/perf', () => {
  const savedUncap = process.env.TM_ELECTRON_UNCAP_FPS;
  const savedForce = process.env.TM_ELECTRON_FORCE_GPU;
  afterEach(() => {
    if (savedUncap === undefined) {
      delete process.env.TM_ELECTRON_UNCAP_FPS;
    } else {
      process.env.TM_ELECTRON_UNCAP_FPS = savedUncap;
    }
    if (savedForce === undefined) {
      delete process.env.TM_ELECTRON_FORCE_GPU;
    } else {
      process.env.TM_ELECTRON_FORCE_GPU = savedForce;
    }
  });

  it('appends the default GPU + no-throttle switches', () => {
    delete process.env.TM_ELECTRON_UNCAP_FPS;
    delete process.env.TM_ELECTRON_FORCE_GPU;
    const app = fakeApp();
    applyPerformanceSwitches(app as never);
    const keys = app.switches.map((s) => s.key);
    for (const expected of [
      'ignore-gpu-blocklist', 'enable-gpu-rasterization', 'enable-zero-copy',
      'enable-accelerated-2d-canvas', 'force_high_performance_gpu',
      'disable-background-timer-throttling', 'disable-renderer-backgrounding',
      'disable-backgrounding-occluded-windows',
    ]) {
      expect(keys, expected).to.include(expected);
    }
  });

  it('leaves the aggressive switches OFF by default', () => {
    delete process.env.TM_ELECTRON_UNCAP_FPS;
    delete process.env.TM_ELECTRON_FORCE_GPU;
    const app = fakeApp();
    applyPerformanceSwitches(app as never);
    const keys = app.switches.map((s) => s.key);
    expect(keys).to.not.include('disable-frame-rate-limit');
    expect(keys).to.not.include('disable-software-rasterizer');
  });

  it('enables the aggressive switches under their env opt-ins', () => {
    process.env.TM_ELECTRON_UNCAP_FPS = '1';
    process.env.TM_ELECTRON_FORCE_GPU = '1';
    const app = fakeApp();
    applyPerformanceSwitches(app as never);
    const keys = app.switches.map((s) => s.key);
    expect(keys).to.include('disable-frame-rate-limit');
    expect(keys).to.include('disable-software-rasterizer');
  });
});

describe('electron/protocol cacheControl', () => {
  it('caches stable art + fonts (immutable when packaged)', () => {
    expect(cacheControl('/x/mars.webp', true)).to.equal('public, max-age=31536000, immutable');
    expect(cacheControl('/x/card.png', true)).to.match(/immutable/);
    expect(cacheControl('/x/Prototype.ttf', true)).to.match(/immutable/);
  });
  it('uses a modest TTL in dev (not immutable)', () => {
    expect(cacheControl('/x/mars.webp', false)).to.equal('public, max-age=3600');
    expect(cacheControl('/x/card.png', false)).to.not.match(/immutable/);
  });
  it('never caches the shell / build outputs', () => {
    expect(cacheControl('/index.html', true)).to.equal(undefined);
    expect(cacheControl('/styles.css', true)).to.equal(undefined);
    expect(cacheControl('/main.js', true)).to.equal(undefined);
    expect(cacheControl('/x/locales/ru.json', true)).to.equal(undefined);
  });
});
