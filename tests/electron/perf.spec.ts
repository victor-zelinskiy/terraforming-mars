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
  // Every TM_ELECTRON_* knob the switch builder reads — snapshot before the suite, CLEAR before
  // each test (so a leaked value can't bleed across cases), restore after.
  const ENV_KEYS = [
    'TM_ELECTRON_UNCAP_FPS', 'TM_ELECTRON_FORCE_GPU',
    'TM_ELECTRON_GPU', 'TM_ELECTRON_ANGLE', 'TM_ELECTRON_GL', 'TM_ELECTRON_NO_PERF',
    'TM_ELECTRON_FEATURES',
  ] as const;
  const saved: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
  }
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = saved[k];
      }
    }
  });

  // Override process.platform so BOTH the Windows (GPU) and Linux/Steam Deck
  // (software) branches are covered deterministically on ANY CI runner — the
  // switch set is platform-specific, so a bare assertion would pass on one OS
  // and fail on the other (which is exactly what broke Linux CI).
  function withPlatform(platform: string, fn: () => void): void {
    const orig = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', {value: platform, configurable: true});
    try {
      fn();
    } finally {
      if (orig !== undefined) {
        Object.defineProperty(process, 'platform', orig);
      }
    }
  }

  it('Windows: GPU acceleration + no-throttle switches', () => {
    delete process.env.TM_ELECTRON_UNCAP_FPS;
    delete process.env.TM_ELECTRON_FORCE_GPU;
    withPlatform('win32', () => {
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
      expect(keys).to.not.include('disable-gpu');
    });
  });

  it('Linux/Steam Deck: software rendering + background trims + no-throttle switches', () => {
    delete process.env.TM_ELECTRON_UNCAP_FPS;
    delete process.env.TM_ELECTRON_FORCE_GPU;
    withPlatform('linux', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      const keys = app.switches.map((s) => s.key);
      for (const expected of [
        'disable-gpu', 'num-raster-threads', 'disable-background-networking', 'disable-features',
        'disable-background-timer-throttling', 'disable-renderer-backgrounding',
        'disable-backgrounding-occluded-windows',
      ]) {
        expect(keys, expected).to.include(expected);
      }
      expect(keys).to.not.include('ignore-gpu-blocklist');
    });
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

  it('Windows: TM_ELECTRON_GPU=low forces the integrated GPU (not the discrete one)', () => {
    process.env.TM_ELECTRON_GPU = 'low';
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      const keys = app.switches.map((s) => s.key);
      expect(keys).to.include('force_low_power_gpu');
      expect(keys).to.not.include('force_high_performance_gpu');
    });
  });

  it('Windows: TM_ELECTRON_GPU=none forces neither GPU (OS/driver decides)', () => {
    process.env.TM_ELECTRON_GPU = 'none';
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      const keys = app.switches.map((s) => s.key);
      expect(keys).to.not.include('force_low_power_gpu');
      expect(keys).to.not.include('force_high_performance_gpu');
      // still GPU-accelerated — only the SELECTION knob changed
      expect(keys).to.include('enable-gpu-rasterization');
    });
  });

  it('Windows: default (no TM_ELECTRON_GPU) keeps forcing the discrete GPU', () => {
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      const keys = app.switches.map((s) => s.key);
      expect(keys).to.include('force_high_performance_gpu');
      expect(keys).to.not.include('force_low_power_gpu');
    });
  });

  it('Windows: TM_ELECTRON_ANGLE=gl selects the OpenGL ANGLE backend', () => {
    process.env.TM_ELECTRON_ANGLE = 'gl';
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      expect(app.switches).to.deep.include({key: 'use-angle', value: 'gl'});
    });
  });

  it('does not select an ANGLE backend by default', () => {
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      expect(app.switches.map((s) => s.key)).to.not.include('use-angle');
    });
  });

  it('Windows: enables Skia Graphite (+ precompilation) by default', () => {
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      expect(app.switches).to.deep.include({key: 'enable-features', value: 'SkiaGraphite,SkiaGraphitePrecompilation'});
    });
  });

  it('Linux: does NOT enable Skia Graphite (software compositor)', () => {
    withPlatform('linux', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      expect(app.switches.filter((s) => s.key === 'enable-features')).to.have.length(0);
    });
  });

  it('TM_ELECTRON_FEATURES overrides the default feature list', () => {
    process.env.TM_ELECTRON_FEATURES = 'SkiaGraphite,RawDraw';
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      expect(app.switches).to.deep.include({key: 'enable-features', value: 'SkiaGraphite,RawDraw'});
    });
  });

  it('TM_ELECTRON_FEATURES=none rolls Graphite back (no enable-features)', () => {
    process.env.TM_ELECTRON_FEATURES = 'none';
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      expect(app.switches.filter((s) => s.key === 'enable-features')).to.have.length(0);
    });
  });

  it('TM_ELECTRON_NO_PERF=1 appends NO switches (vanilla-Electron baseline)', () => {
    process.env.TM_ELECTRON_NO_PERF = '1';
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      expect(app.switches).to.have.length(0);
    });
    withPlatform('linux', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      expect(app.switches).to.have.length(0);
    });
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
