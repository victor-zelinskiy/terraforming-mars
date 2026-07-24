import {expect} from 'chai';
import {applyPerformanceSwitches, classifySteamHardware, gpuMemBudgetMb, parseAffinityPref, parseCliEnvOverrides, parseExtraSwitches, pCoreAffinityMask, processPriorityPref, rasterThreadCount} from '../../electron/perf';
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

// appendSwitch REPLACES same-key values in real Electron — the effective value
// of a key is the LAST recorded one.
function effectiveValue(app: ReturnType<typeof fakeApp>, key: string): string | undefined {
  const hits = app.switches.filter((s) => s.key === key);
  return hits.length === 0 ? undefined : hits[hits.length - 1].value;
}

describe('electron/perf', () => {
  // Every env knob the switch builder reads — snapshot before the suite, CLEAR before
  // each test (so a leaked value can't bleed across cases), restore after.
  const ENV_KEYS = [
    'TM_ELECTRON_NO_PERF', 'TM_ELECTRON_SOFTWARE',
    'TM_ELECTRON_FEATURES', 'TM_ELECTRON_SWITCHES',
    'SteamDeck',
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

  // Override process.platform so BOTH the Windows and Linux/Steam Deck branches
  // are covered deterministically on ANY CI runner — the switch set is
  // platform-specific, so a bare assertion would pass on one OS and fail on
  // the other (which is exactly what broke Linux CI).
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

  it('Windows: GPU + presentation + no-throttle defaults', () => {
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      const keys = app.switches.map((s) => s.key);
      for (const expected of [
        'ignore-gpu-blocklist', 'enable-gpu-rasterization', 'enable-zero-copy',
        'enable-accelerated-2d-canvas', 'force_high_performance_gpu',
        'force-gpu-mem-available-mb', 'disable-gpu-process-crash-limit',
        'disable-background-timer-throttling', 'disable-renderer-backgrounding',
        'disable-backgrounding-occluded-windows', 'disable-background-networking',
        'disable-ipc-flooding-protection', 'disable-renderer-accessibility',
        'force-color-profile', 'js-flags',
      ]) {
        expect(keys, expected).to.include(expected);
      }
      expect(keys).to.not.include('disable-gpu');
      // ANGLE-over-Vulkan is the LINUX EGL sidestep — Windows stays on D3D11 ANGLE
      expect(keys).to.not.include('use-angle');
      expect(effectiveValue(app, 'force-gpu-mem-available-mb')).to.equal('6144');
      expect(effectiveValue(app, 'force-color-profile')).to.equal('srgb');
      expect(effectiveValue(app, 'js-flags')).to.equal('--max-semi-space-size=64');
    });
  });

  it('Windows: enables Graphite (pinned to Dawn/D3D11) + precompilation + the waitable swap chain by default', () => {
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      expect(effectiveValue(app, 'enable-features')).to.equal(
        'SkiaGraphite,SkiaGraphitePrecompilation,DXGIWaitableSwapChain:DXGIWaitableSwapChainMaxQueuedFrames/2,DXGISwapChainPresentInterval0');
      // the MEASURED winner on the target box (d3d12 A/B'd worse, 2026-07-14) —
      // pinned so a future Chromium default flip can't silently move us off it
      expect(effectiveValue(app, 'skia-graphite-dawn-backend')).to.equal('d3d11');
      // the Linux-only Graphite bypass switch must NOT leak onto Windows
      // (there Graphite rides the supported FEATURE path)
      expect(app.switches.map((s) => s.key)).to.not.include('enable-skia-graphite');
    });
  });

  it('Linux/Steam Deck: DEFAULTS to the GPU path with the full ANGLE-Vulkan + Graphite recipe', () => {
    withPlatform('linux', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      const keys = app.switches.map((s) => s.key);
      for (const expected of [
        'ignore-gpu-blocklist', 'enable-gpu-rasterization', 'enable-zero-copy',
        'enable-accelerated-2d-canvas', 'force-gpu-mem-available-mb',
        'disable-gpu-process-crash-limit',
      ]) {
        expect(keys, expected).to.include(expected);
      }
      // the ANGLE-Vulkan switch pair (X11/XWayland — NOT native Wayland)
      expect(effectiveValue(app, 'use-gl')).to.equal('angle');
      expect(effectiveValue(app, 'use-angle')).to.equal('vulkan');
      // the FULL recipe: DefaultANGLEVulkan/VulkanFromANGLE were the missing
      // pieces that made ANGLE's EGL config selection use Vulkan. SkiaGraphite
      // must NOT be in the FEATURE list on Linux (platform-blocked "for
      // safety") — it rides the explicit bypass SWITCH instead:
      expect(effectiveValue(app, 'enable-features')).to.equal(
        'Vulkan,DefaultANGLEVulkan,VulkanFromANGLE,SkiaGraphitePrecompilation');
      expect(keys).to.include('enable-skia-graphite');
      expect(effectiveValue(app, 'skia-graphite-dawn-backend')).to.equal('vulkan');
      // the D3D presentation features + dual-GPU preference are Windows-only
      expect(effectiveValue(app, 'enable-features')).to.not.include('DXGI');
      expect(keys).to.not.include('force_high_performance_gpu');
      // NOT native Wayland (Vulkan is incompatible with --ozone-platform=wayland)
      expect(keys).to.not.include('ozone-platform');
      // no software-path leftovers
      expect(keys).to.not.include('disable-gpu');
      expect(keys).to.not.include('num-raster-threads');
    });
  });

  it('TM_ELECTRON_SOFTWARE=1 forces the software path (the rollback) on either platform', () => {
    process.env.TM_ELECTRON_SOFTWARE = '1';
    for (const platform of ['linux', 'win32']) {
      withPlatform(platform, () => {
        const app = fakeApp();
        // Deck-shaped probe (8 logical cores) → the measured-best 4 raster threads.
        applyPerformanceSwitches(app as never, {steamHardware: 'steam-deck', logicalCores: 8});
        const keys = app.switches.map((s) => s.key);
        expect(keys, platform).to.include('disable-gpu');
        expect(effectiveValue(app, 'num-raster-threads'), platform).to.equal('4');
        expect(keys, platform).to.not.include('ignore-gpu-blocklist');
        expect(keys, platform).to.not.include('use-angle');
        expect(keys, platform).to.not.include('enable-features');
        expect(keys, platform).to.not.include('skia-graphite-dawn-backend');
        // the cross-platform trims still apply
        expect(keys, platform).to.include('disable-features');
        expect(keys, platform).to.include('disable-background-timer-throttling');
      });
    }
  });

  it('disables the occlusion tracker / BFCache / overscroll-nav / background services (one merged list, both platforms)', () => {
    for (const platform of ['win32', 'linux']) {
      withPlatform(platform, () => {
        const app = fakeApp();
        applyPerformanceSwitches(app as never);
        const disabled = effectiveValue(app, 'disable-features');
        expect(disabled, platform).to.be.a('string');
        for (const feature of [
          'CalculateNativeWinOcclusion', 'OverscrollHistoryNavigation', 'BackForwardCache',
          'IntensiveWakeUpThrottling', 'MediaRouter', 'DialMediaRouteProvider',
          'OptimizationHints', 'Translate', 'HardwareMediaKeyHandling',
          'SpareRendererForSitePerProcess',
        ]) {
          expect(disabled, `${platform}: ${feature}`).to.include(feature);
        }
        // exactly ONE disable-features append — a second call would REPLACE the first
        expect(app.switches.filter((s) => s.key === 'disable-features')).to.have.length(1);
      });
    }
  });

  it('leaves the uncap / no-fallback switches OFF (expressible via TM_ELECTRON_SWITCHES)', () => {
    for (const platform of ['win32', 'linux']) {
      withPlatform(platform, () => {
        const app = fakeApp();
        applyPerformanceSwitches(app as never);
        const keys = app.switches.map((s) => s.key);
        expect(keys).to.not.include('disable-frame-rate-limit');
        expect(keys).to.not.include('disable-software-rasterizer');
        expect(keys).to.not.include('disable-direct-composition');
        expect(keys).to.not.include('ozone-platform');
      });
    }
  });

  it('TM_ELECTRON_FEATURES overrides the default feature list', () => {
    process.env.TM_ELECTRON_FEATURES = 'SkiaGraphite';
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      expect(effectiveValue(app, 'enable-features')).to.equal('SkiaGraphite');
    });
  });

  it('TM_ELECTRON_FEATURES=none rolls the feature list back (other defaults stay)', () => {
    process.env.TM_ELECTRON_FEATURES = 'none';
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      const keys = app.switches.map((s) => s.key);
      expect(keys).to.not.include('enable-features');
      expect(keys).to.include('disable-features');
      expect(keys).to.include('enable-gpu-rasterization');
    });
  });

  it('TM_ELECTRON_SWITCHES appends extras LAST so they override same-key defaults', () => {
    process.env.TM_ELECTRON_SWITCHES = 'disable-direct-composition;force-color-profile=display-p3';
    withPlatform('win32', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      expect(app.switches.map((s) => s.key)).to.include('disable-direct-composition');
      expect(effectiveValue(app, 'force-color-profile')).to.equal('display-p3');
    });
  });

  it('Linux: TM_ELECTRON_SWITCHES extras ride on top of the GPU default', () => {
    process.env.TM_ELECTRON_SWITCHES = 'disable-gpu-vsync';
    withPlatform('linux', () => {
      const app = fakeApp();
      applyPerformanceSwitches(app as never);
      const keys = app.switches.map((s) => s.key);
      expect(keys).to.include('disable-gpu-vsync');
      // the GPU default is untouched by the extra
      expect(keys).to.include('ignore-gpu-blocklist');
      expect(effectiveValue(app, 'use-angle')).to.equal('vulkan');
      expect(keys).to.not.include('disable-gpu');
    });
  });

  it('TM_ELECTRON_NO_PERF=1 appends NO switches (vanilla-Electron baseline)', () => {
    process.env.TM_ELECTRON_NO_PERF = '1';
    process.env.TM_ELECTRON_SWITCHES = 'disable-direct-composition';
    for (const platform of ['win32', 'linux']) {
      withPlatform(platform, () => {
        const app = fakeApp();
        const applied = applyPerformanceSwitches(app as never);
        expect(app.switches).to.have.length(0);
        expect(applied).to.have.length(0);
      });
    }
  });

  it('returns the applied switches as --key[=value] strings (the renderer-console echo)', () => {
    withPlatform('win32', () => {
      const app = fakeApp();
      const applied = applyPerformanceSwitches(app as never);
      expect(applied).to.have.length(app.switches.length);
      expect(applied).to.include('--force-color-profile=srgb');
      expect(applied).to.include('--ignore-gpu-blocklist');
    });
  });

  describe('hardware-scaled values (Steam Deck vs Steam Machine)', () => {
    it('classifySteamHardware: Jupiter/Galileo → deck, other Valve boxes → machine, non-Valve → generic', () => {
      expect(classifySteamHardware('Valve', 'Jupiter')).to.equal('steam-deck');
      expect(classifySteamHardware('Valve', 'Galileo')).to.equal('steam-deck');
      // the Steam Machine (DMI codename Fremont) — and ANY future non-handheld
      // Valve box — classifies as the machine class without a code change
      expect(classifySteamHardware('Valve', 'Fremont')).to.equal('steam-machine');
      expect(classifySteamHardware('Valve Corporation', 'Something-New')).to.equal('steam-machine');
      expect(classifySteamHardware('ASUSTeK COMPUTER INC.', 'ROG Ally RC71L')).to.equal('generic');
      expect(classifySteamHardware('', '')).to.equal('generic');
    });

    it('gpuMemBudgetMb: conservative 4096 on the shared-UMA Deck, 6144 on dedicated-VRAM Machine / generic', () => {
      expect(gpuMemBudgetMb('steam-deck')).to.equal(4096);
      expect(gpuMemBudgetMb('generic')).to.equal(6144);
      expect(gpuMemBudgetMb('steam-machine')).to.equal(6144);
    });

    it('rasterThreadCount: half the logical cores, clamped 2..8', () => {
      expect(rasterThreadCount(8)).to.equal(4);   // Deck (measured-best value preserved)
      expect(rasterThreadCount(12)).to.equal(6);  // Steam Machine (Zen 4 6C/12T)
      expect(rasterThreadCount(2)).to.equal(2);   // floor
      expect(rasterThreadCount(32)).to.equal(8);  // ceiling
    });

    it('pCoreAffinityMask: derives the P-core mask on a hybrid, undefined on a uniform CPU', () => {
      expect(pCoreAffinityMask(14, 20)).to.equal(0xFFF); // i9-13900H: 6P(+HT)=12 logical + 8E → low 12 bits
      expect(pCoreAffinityMask(14, 20)).to.equal(4095);
      expect(pCoreAffinityMask(12, 16)).to.equal(0xFF);  // i5-13500H: 4P(+HT)=8 logical + 8E → low 8 bits
      expect(pCoreAffinityMask(8, 16)).to.equal(undefined);  // all-HT desktop (no E-cores)
      expect(pCoreAffinityMask(8, 8)).to.equal(undefined);   // no hyper-threading
      expect(pCoreAffinityMask(6, 6)).to.equal(undefined);   // uniform, no HT
    });

    it('parseAffinityPref: auto by default, off disables, an explicit mask overrides', () => {
      expect(parseAffinityPref(undefined)).to.deep.equal({mode: 'auto'});
      expect(parseAffinityPref('')).to.deep.equal({mode: 'auto'});
      expect(parseAffinityPref('auto')).to.deep.equal({mode: 'auto'});
      expect(parseAffinityPref('off')).to.deep.equal({mode: 'off'});
      expect(parseAffinityPref('0')).to.deep.equal({mode: 'off'});
      expect(parseAffinityPref('0xfff')).to.deep.equal({mode: 'mask', mask: 4095});
      expect(parseAffinityPref('4095')).to.deep.equal({mode: 'mask', mask: 4095});
    });

    it('processPriorityPref: HIGH by default, ABOVE opt-in, normal/off leaves the OS default', () => {
      expect(processPriorityPref(undefined)).to.equal('high'); // default (env unset)
      expect(processPriorityPref('')).to.equal('high');
      expect(processPriorityPref(' High ')).to.equal('high');
      expect(processPriorityPref('above')).to.equal('above');
      expect(processPriorityPref('ABOVE_NORMAL')).to.equal('above');
      expect(processPriorityPref('normal')).to.equal(undefined);
      expect(processPriorityPref('off')).to.equal(undefined);
      expect(processPriorityPref('garbage')).to.equal(undefined);
    });

    it('GPU path: the Machine probe raises the GPU memory budget; the Deck probe keeps 4096', () => {
      withPlatform('linux', () => {
        const deck = fakeApp();
        applyPerformanceSwitches(deck as never, {steamHardware: 'steam-deck', logicalCores: 8});
        expect(effectiveValue(deck, 'force-gpu-mem-available-mb')).to.equal('4096');

        const machine = fakeApp();
        applyPerformanceSwitches(machine as never, {steamHardware: 'steam-machine', logicalCores: 12});
        expect(effectiveValue(machine, 'force-gpu-mem-available-mb')).to.equal('6144');
        // the rest of the Linux GPU recipe is hardware-class-independent
        expect(effectiveValue(machine, 'use-angle')).to.equal('vulkan');
      });
    });

    it('Graphite is gated OFF on the Steam Machine (flicker regression) but kept on the Deck', () => {
      withPlatform('linux', () => {
        // Deck (Jupiter/Galileo) — CONFIRMED good on Graphite → keeps the bypass
        // switch + the Vulkan Dawn-backend pin.
        const deck = fakeApp();
        applyPerformanceSwitches(deck as never, {steamHardware: 'steam-deck', logicalCores: 8});
        expect(deck.switches.map((s) => s.key)).to.include('enable-skia-graphite');
        expect(effectiveValue(deck, 'skia-graphite-dawn-backend')).to.equal('vulkan');

        // Steam Machine — Graphite off → Ganesh-Vulkan (still full GPU): no
        // bypass switch, no Dawn-backend pin. use-angle=vulkan stays.
        const machine = fakeApp();
        applyPerformanceSwitches(machine as never, {steamHardware: 'steam-machine', logicalCores: 12});
        const keys = machine.switches.map((s) => s.key);
        expect(keys).to.not.include('enable-skia-graphite');
        expect(keys).to.not.include('skia-graphite-dawn-backend');
        expect(effectiveValue(machine, 'use-angle')).to.equal('vulkan');
        // still GPU, not the software fallback
        expect(keys).to.not.include('disable-gpu');
      });
    });

    it('software path: the Machine probe gets 6 raster threads', () => {
      process.env.TM_ELECTRON_SOFTWARE = '1';
      withPlatform('linux', () => {
        const app = fakeApp();
        applyPerformanceSwitches(app as never, {steamHardware: 'steam-machine', logicalCores: 12});
        expect(effectiveValue(app, 'num-raster-threads')).to.equal('6');
      });
    });

    it('TM_ELECTRON_SWITCHES still overrides the hardware-scaled budget (escape hatch)', () => {
      process.env.TM_ELECTRON_SWITCHES = 'force-gpu-mem-available-mb=2048';
      withPlatform('linux', () => {
        const app = fakeApp();
        applyPerformanceSwitches(app as never, {steamHardware: 'steam-machine', logicalCores: 12});
        expect(effectiveValue(app, 'force-gpu-mem-available-mb')).to.equal('2048');
      });
    });
  });

  describe('parseExtraSwitches', () => {
    it('parses key / key=value tokens, splitting on the FIRST = only', () => {
      expect(parseExtraSwitches('disable-direct-composition;use-angle=vulkan;js-flags=--max-old-space-size=1024'))
        .to.deep.equal([
          {key: 'disable-direct-composition'},
          {key: 'use-angle', value: 'vulkan'},
          {key: 'js-flags', value: '--max-old-space-size=1024'},
        ]);
    });

    it('tolerates whitespace, blank segments and a leading --', () => {
      expect(parseExtraSwitches(' --disable-gpu-vsync ; ;use-gl=egl; ')).to.deep.equal([
        {key: 'disable-gpu-vsync'},
        {key: 'use-gl', value: 'egl'},
      ]);
    });

    it('returns [] for an empty string', () => {
      expect(parseExtraSwitches('')).to.deep.equal([]);
    });
  });

  describe('parseCliEnvOverrides (Steam launch-options bridge)', () => {
    it('maps value flags onto their env vars, splitting on the FIRST =', () => {
      expect(parseCliEnvOverrides(['--tm-switches=show-fps-counter'])).to.deep.equal({
        TM_ELECTRON_SWITCHES: 'show-fps-counter',
      });
      expect(parseCliEnvOverrides(['--tm-switches=js-flags=--max-old-space-size=1024'])).to.deep.equal({
        TM_ELECTRON_SWITCHES: 'js-flags=--max-old-space-size=1024',
      });
      expect(parseCliEnvOverrides(['--tm-priority=above', '--tm-features=none'])).to.deep.equal({
        TM_ELECTRON_PRIORITY: 'above',
        TM_ELECTRON_FEATURES: 'none',
      });
    });

    it('maps boolean flags to "1" and ignores the exe path + Chromium switches', () => {
      expect(parseCliEnvOverrides([
        'C:\\Games\\Terraforming Mars.exe',
        '--tm-software',
        '--tm-devtools',
        '--enable-logging',        // a real Chromium switch — must be ignored
        '--tm-windowed',
      ])).to.deep.equal({
        TM_ELECTRON_SOFTWARE: '1',
        TM_ELECTRON_DEVTOOLS: '1',
        TM_ELECTRON_WINDOWED: '1',
      });
    });

    it('returns {} when no --tm-* flags are present', () => {
      expect(parseCliEnvOverrides(['--enable-features=Foo', 'bar'])).to.deep.equal({});
      expect(parseCliEnvOverrides([])).to.deep.equal({});
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
