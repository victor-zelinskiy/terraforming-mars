// Electron 43 — safe desktop shell (main process). Phases 1 + 2A.
//
// Two load modes (env TM_ELECTRON_LOAD), both same safe window + preload:
//   - 'server' (DEFAULT, Phase 1): loadURL the running dev server over http —
//     same-origin, zero adapters. Proves the runtime.
//   - 'app'    (Phase 2A):         loadURL app://bundle/ — the PACKAGED static
//     renderer served by the custom protocol (electron/protocol.ts). REST/WS
//     still target the dev server via injected config; cross-origin CORS is 2B.
//
// Explicitly NOT here (later phases): remote-server CORS + fetch-wrapping (2B),
// electron-builder / electron-updater, premium update UI, game-boundary reset,
// command transport, signing, performance tuning.
//
// Self-contained: imports only from 'electron', Node built-ins, and the sibling
// protocol module — no @/ path-alias rewriting, a plain `tsc -p` compiles it.

import {app, BrowserWindow, shell, ipcMain, type IpcMainInvokeEvent} from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import {registerAppScheme, registerAppProtocolHandler, appUrl, APP_ORIGIN} from './protocol';
import {enforceVersionScopedCache} from './cacheVersion';
import {registerUpdateIpc, resolveStartupUpdate} from './update';
import {registerInstallerCheckIpc, runInstallerCheck} from './installerCheck';
import {originOf, isSameOrigin as sameOrigin, isExternalHttp} from './navGuard';
import {applyPerformanceSwitches, logGpuStatus} from './perf';
import {addToSteam, isAddedToSteam} from './steamShortcut';
import {getSteamPromptDismissed, setSteamPromptDismissed} from './session';
import {VelopackApp} from 'velopack';

// Velopack sets VELOPACK_FIRSTRUN when it launches the app for the FIRST time after install.
// Captured before VelopackApp.run() so the first-run "Add to Steam" prompt fires exactly once.
const VELOPACK_FIRSTRUN = /^(true|1|yes)$/i.test((process.env.VELOPACK_FIRSTRUN ?? '').trim());

// Velopack update framework — MUST be the FIRST thing to run. On an install/update hook launch
// it processes the hook args and exits/restarts the process; on a normal launch (and in dev) it
// no-ops and returns immediately. setAutoApplyOnStartup(false): we apply downloaded updates
// EXPLICITLY via the premium overlay's "Restart and install" (electron/update.ts), never silently
// on startup — this keeps the controlled UX and avoids a surprise relaunch escaping the Steam Deck
// gamescope session. Wrapped defensively so an odd dev/native-load failure can't brick launch.
try {
  VelopackApp.build().setAutoApplyOnStartup(false).run();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[velopack] startup hook failed (continuing normal launch)', err);
}

// GPU / no-throttle command-line switches MUST be appended before app 'ready';
// module top-level runs well before then. Desktop-only; browser build untouched.
// DIAGNOSTIC: a `--tm-no-perf` relaunch arg (F8 hotkey) maps to the perf kill-switch, so the
// vanilla-Electron GPU path can be compared against ours WITHOUT a terminal / env var.
if (process.argv.includes('--tm-no-perf')) {
  process.env.TM_ELECTRON_NO_PERF = '1';
}
// DIAGNOSTIC: a `--tm-gpu-low` relaunch arg (F7 hotkey) renders on the integrated GPU — tests
// whether forcing the discrete dGPU adds a cross-adapter frame copy on this hybrid laptop.
if (process.argv.includes('--tm-gpu-low')) {
  process.env.TM_ELECTRON_GPU = 'low';
}
// DIAGNOSTIC: `--tm-perftest` (F5) renders at 1:1 device scale in a small window — reproduces the
// Steam Deck's PIXEL COUNT (~1280×800) on this 3200×2000 (scale-2) panel to test whether the lag
// is fill-rate / compositing cost at high DPI. Smooth here ⇒ the culprit is the render RESOLUTION
// (Layerize/Paint over 6× the pixels), NOT the GPU or the JS.
const PERFTEST = process.argv.includes('--tm-perftest');
if (PERFTEST) {
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
}
// Skia Graphite is ON BY DEFAULT on Windows now (see perf.ts). These relaunch args let you A/B it
// WITHOUT a terminal: `--tm-graphite` (F4) forces it on, `--tm-no-graphite` (F3) rolls back to the
// legacy Ganesh rasterizer to compare. Confirm `skia_graphite` in the [TM-DIAG] report / chrome://gpu.
if ((process.env.TM_ELECTRON_FEATURES ?? '').trim() === '') {
  if (process.argv.includes('--tm-no-graphite')) {
    process.env.TM_ELECTRON_FEATURES = 'none';
  } else if (process.argv.includes('--tm-graphite-precompile')) {
    // Graphite's built-in shader/pipeline PRECOMPILATION — targets the first-animation stutter
    // (pipelines compiled up front instead of on first use). RawDraw was tried and REMOVED: it is
    // incompatible with GPU rasterization + Graphite (fails shared-image creation → white screen,
    // the ProduceSkia "non-existent mailbox" error).
    process.env.TM_ELECTRON_FEATURES = 'SkiaGraphite,SkiaGraphitePrecompilation';
  } else if (process.argv.includes('--tm-graphite')) {
    process.env.TM_ELECTRON_FEATURES = 'SkiaGraphite';
  }
}
applyPerformanceSwitches(app);

// Steam Deck / SteamOS: the Chromium sandbox can't initialize under gamescope, so the game
// is launched with --no-sandbox by the user's wrapper. Apply it IN-PROCESS on Linux too, so
// the app still starts if it's ever launched WITHOUT those flags — e.g. an updater relaunch
// or a direct double-click. No effect on Windows/macOS.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// A PACKAGED build defaults to the hosted production server; a dev run defaults to the
// local dev server. `TM_SERVER_BASE` overrides either.
const DEFAULT_SERVER_BASE = app.isPackaged
  ? 'https://terraforming-mars-vize-edition-63e52431d8db.herokuapp.com'
  : 'http://localhost:8080';

/**
 * Load the packaged renderer over app:// (Phase 2A/6) vs the dev server (Phase 1).
 * A PACKAGED build (`app.isPackaged`) has no dev server serving the renderer, so it
 * ALWAYS uses app://. In dev, `TM_ELECTRON_LOAD=app` opts in; default is server.
 */
const APP_LOAD = app.isPackaged || (process.env.TM_ELECTRON_LOAD ?? 'server').trim().toLowerCase() === 'app';

/** The server origin the renderer's REST + WebSocket talk to (dev server by default). */
function serverBase(): string {
  const raw = (process.env.TM_SERVER_BASE ?? '').trim();
  return (raw !== '' ? raw : DEFAULT_SERVER_BASE).replace(/\/+$/, '');
}

/** ws:// from http://, wss:// from https://. */
function wsBaseFrom(httpBase: string): string {
  return httpBase.replace(/^http(s?):/i, 'ws$1:');
}

/**
 * The minimal runtime config injected into the renderer via the preload.
 * Shape mirrors src/client/utils/runtimeConfig.ts `TMRuntimeConfig`. apiBase /
 * wsBase point at the dev server in BOTH modes (so app:// mode is set up for the
 * 2B cross-origin work); participantId only when explicitly testing a seat.
 */
interface RuntimeConfig {
  apiBase: string;
  wsBase: string;
  participantId?: string;
}

function runtimeConfig(): RuntimeConfig {
  const base = serverBase();
  const cfg: RuntimeConfig = {apiBase: base, wsBase: wsBaseFrom(base)};
  const pid = (process.env.TM_PARTICIPANT_ID ?? '').trim();
  if (pid !== '') {
    cfg.participantId = pid;
  }
  return cfg;
}

/** The origin the renderer is loaded from — app://bundle in app mode, else the server. */
function rendererOrigin(): string {
  return APP_LOAD ? APP_ORIGIN : (originOf(serverBase()) ?? '');
}

/** The URL to open on launch (direct seat if TM_PARTICIPANT_ID, else the menu). */
function initialUrl(): string {
  const pid = (process.env.TM_PARTICIPANT_ID ?? '').trim();
  const route = pid !== '' ? `player?id=${encodeURIComponent(pid)}` : '';
  if (APP_LOAD) {
    return appUrl(route);
  }
  const base = serverBase();
  return route !== '' ? `${base}/${route}` : `${base}/`;
}

/**
 * The desktop app runs FULLSCREEN by default (immersive play). Set
 * TM_ELECTRON_WINDOWED=1 to run in a normal resizable window (handy for
 * development / debugging).
 */
const FULLSCREEN = process.env.TM_ELECTRON_WINDOWED !== '1';

let mainWindow: BrowserWindow | undefined;

/**
 * DIAGNOSTIC (temporary — remove in the final cleanup). A packaged `.exe` has no visible
 * stdout, so the GPU report is pushed into the RENDERER DevTools console instead, and DevTools
 * is reachable by hotkey even in packaged fullscreen (`before-input-event` fires in the
 * webContents). Non-intrusive for normal play (nothing shows until DevTools is opened):
 *   F12 / Ctrl+Shift+I → toggle DevTools (docked bottom)
 *   F10                → load chrome://gpu (full driver report + "Problems Detected")
 *   F9                 → back to the game
 *   F8                 → relaunch in VANILLA mode (our GPU switches OFF) to compare the GPU path
 *   F7                 → relaunch rendering on the INTEGRATED GPU (tests cross-adapter cost)
 *   F6                 → relaunch back to the default (discrete GPU, all switches on)
 *   F5                 → relaunch small window @ 1:1 scale (Deck-like pixel count → fill-rate test)
 *   F4                 → relaunch forcing Skia Graphite on (it is the Windows DEFAULT now)
 *   F3                 → relaunch with Skia Graphite OFF (legacy Ganesh) to A/B the default
 *   F2                 → relaunch with Graphite + shader PRECOMPILATION (first-lag test)
 */
function installDiagnostics(win: BrowserWindow): void {
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') {
      return;
    }
    const key = input.key.toLowerCase();
    const toggleDevtools = key === 'f12' || ((input.control || input.meta) && input.shift && key === 'i');
    if (toggleDevtools) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({mode: 'bottom'});
      }
    } else if (key === 'f10') {
      void win.loadURL('chrome://gpu');
    } else if (key === 'f9') {
      void win.loadURL(initialUrl());
    } else if (key === 'f8') {
      // Restart the whole app with our performance switches disabled (see the argv check at
      // module top). The next launch's [TM-DIAG] report is the vanilla-Electron baseline.
      app.relaunch({args: ['--tm-no-perf']});
      app.exit(0);
    } else if (key === 'f7') {
      // Restart rendering on the integrated GPU (cross-adapter test).
      app.relaunch({args: ['--tm-gpu-low']});
      app.exit(0);
    } else if (key === 'f6') {
      // Restart clean (default discrete GPU, all switches on).
      app.relaunch({args: []});
      app.exit(0);
    } else if (key === 'f5') {
      // Restart in the small 1:1-scale window (fill-rate / high-DPI test).
      app.relaunch({args: ['--tm-perftest']});
      app.exit(0);
    } else if (key === 'f4') {
      // Restart forcing Skia Graphite ON (it is the default now — explicit for A/B).
      app.relaunch({args: ['--tm-graphite']});
      app.exit(0);
    } else if (key === 'f3') {
      // Restart with Skia Graphite OFF (legacy Ganesh) to compare against the new default.
      app.relaunch({args: ['--tm-no-graphite']});
      app.exit(0);
    } else if (key === 'f2') {
      // Restart with Graphite + shader precompilation (targets the first-animation stutter).
      app.relaunch({args: ['--tm-graphite-precompile']});
      app.exit(0);
    } else if (key === 'f1') {
      // RENDERER-SIDE SCREENSHOT: capturePage() grabs the renderer's composited
      // output BEFORE it travels to the window/DWM. The decisive split for the
      // "zoom stage paints nothing" bug: if the card IS in this PNG, the
      // renderer paints fine and the pixels are lost on the way to the screen
      // (window surface / DWM); if it is NOT, the renderer itself skips it.
      void win.webContents.capturePage().then((img) => {
        const file = path.join(os.tmpdir(), 'tm-zoom-shot.png');
        fs.writeFileSync(file, img.toPNG());
        const line = `[TM-DIAG] capturePage saved → ${file}`;
        // eslint-disable-next-line no-console
        console.log(line);
        void win.webContents
          .executeJavaScript(`console.warn(${JSON.stringify('%c' + line)}, 'color:#22c55e;font-weight:bold')`)
          .catch(() => {/* frame gone */});
      });
    }
  });

  // On each real page load (skip the internal chrome:// report), print the resolved GPU state
  // into the renderer console so a plain exe run can be inspected + screenshotted.
  win.webContents.on('did-finish-load', () => {
    if (win.webContents.getURL().startsWith('chrome://')) {
      return;
    }
    void printGpuDiag(win);
  });
}

async function printGpuDiag(win: BrowserWindow): Promise<void> {
  try {
    const status = app.getGPUFeatureStatus();
    let gpuInfo: unknown;
    try {
      gpuInfo = await app.getGPUInfo('basic');
    } catch {
      // getGPUInfo can reject on some drivers — the feature status alone is still useful.
    }
    const mode = process.env.TM_ELECTRON_NO_PERF === '1'
      ? 'VANILLA (perf switches OFF)'
      : `TUNED (GPU=${process.env.TM_ELECTRON_GPU ?? 'high'})`;
    const diag = {mode, platform: process.platform, version: app.getVersion(), gpuFeatureStatus: status, gpuInfo};
    const payload = JSON.stringify(JSON.stringify(diag));
    const enabled = status.gpu_compositing === 'enabled';
    const verdict = enabled
      ? `console.log('%c✓ GPU compositing ENABLED — hardware acceleration is live','color:#22c55e;font-weight:bold');`
      : `console.warn('%c✗ GPU is on the SOFTWARE path. Press F10 → screenshot the red "Problems Detected" block on chrome://gpu','color:#f59e0b;font-weight:bold;font-size:13px');`;
    await win.webContents.executeJavaScript(
      `console.log('%c[TM-DIAG] hardware acceleration report','color:#38bdf8;font-weight:bold;font-size:14px');` +
      `console.log('Open this object, screenshot it, and send it back →', JSON.parse(${payload}));` +
      verdict,
    );
  } catch {
    // executeJavaScript can throw if the frame is torn down mid-load — ignore.
  }
}

/**
 * Poll the GPU feature status until compositing is actually live, then signal the
 * renderer (window `tm-gpu-ready` event + `__tmGpuReady` flag). The boot warm-up
 * waits for this before rendering its cards, so their Graphite pipelines compile
 * on the ready GPU instead of the software path during GPU-process init. Bounded
 * (~4s cap) and fires exactly once — never hangs the loader.
 */
function signalGpuReadyWhenLive(win: BrowserWindow, attempts = 0): void {
  if (win.isDestroyed()) {
    return;
  }
  let live = false;
  try {
    live = app.getGPUFeatureStatus().gpu_compositing === 'enabled';
  } catch {
    // getGPUFeatureStatus can throw very early — treat as not-ready yet.
  }
  if (live || attempts >= 40) {
    void win.webContents
      .executeJavaScript('window.__tmGpuReady = true; window.dispatchEvent(new Event("tm-gpu-ready"));')
      .catch(() => {/* frame gone */});
    return;
  }
  setTimeout(() => signalGpuReadyWhenLive(win, attempts + 1), 100);
}

function createWindow(): void {
  const cfg = runtimeConfig();

  mainWindow = new BrowserWindow({
    width: PERFTEST ? 1280 : 1440,
    height: PERFTEST ? 800 : 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0d1117',
    autoHideMenuBar: true,
    fullscreen: FULLSCREEN && !PERFTEST,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Never throttle rAF / timers when the fullscreen game is briefly occluded
      // or unfocused — keeps animations smooth on return (pairs with the
      // disable-*-backgrounding switches in perf.ts).
      backgroundThrottling: false,
      // Passed to the sandboxed preload via process.argv (no Node/IPC needed
      // just to read config). apiBase/wsBase are not secrets; participantId is
      // a local dev token only.
      additionalArguments: ['--tm-runtime-config=' + JSON.stringify(cfg)],
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // External links open in the system browser — never as in-window content.
  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    if (isExternalHttp(url)) {
      void shell.openExternal(url);
    }
    return {action: 'deny'};
  });

  // Allow same-origin (SPA) navigation — the game-boundary full reloads to
  // `player?id=…`, `/`, etc. stay within the renderer origin (server origin in
  // server mode, app://bundle in app mode). Anything else → system browser.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!sameOrigin(url, rendererOrigin())) {
      event.preventDefault();
      if (isExternalHttp(url)) {
        void shell.openExternal(url);
      }
    }
  });

  // Keep the desktop app ALWAYS in fullscreen — if it's ever exited (F11 / an OS
  // gesture), immediately re-enter. `setFullScreen(true)` fires enter-full-screen
  // (not leave-full-screen), so there is no loop; the isDestroyed guard avoids
  // fighting window teardown. Alt+Tab / minimize are unaffected (they don't leave
  // fullscreen). Quitting still works normally.
  if (FULLSCREEN && !PERFTEST) {
    mainWindow.on('leave-full-screen', () => {
      if (mainWindow !== undefined && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(true);
      }
    });
  }

  // DIAGNOSTIC: TM_ELECTRON_GPUINFO=1 loads chrome://gpu INSTEAD of the game — the full
  // Chromium GPU report (Graphics Feature Status + "Problems Detected" + the driver /
  // workaround log) that explains WHY hardware acceleration is or isn't live. Read-only
  // internal page; no game flow. Just close the window when done.
  const gpuInfo = process.env.TM_ELECTRON_GPUINFO === '1';
  void mainWindow.loadURL(gpuInfo ? 'chrome://gpu' : initialUrl());

  // Renderer-console GPU report + DevTools/chrome://gpu hotkeys — works from a plain exe.
  installDiagnostics(mainWindow);

  if (process.env.TM_ELECTRON_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({mode: 'detach'});
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

// Narrow IPC surface backing the preload's desktopBridge. Nothing else is exposed.
ipcMain.handle('desktop:getVersion', () => app.getVersion());
// Console-native pre-game shell (P10): the renderer's ВЫЙТИ confirm quits
// through this — never a browser workaround. Safe: quit() runs the normal
// Electron shutdown (will-quit hooks, updater cleanup) and is idempotent.
ipcMain.handle('desktop:quitApp', () => {
  app.quit();
});
// Native window fullscreen — more reliable than the browser Fullscreen API
// inside Electron (no user-activation requirement; survives reloads as a
// WINDOW property). The renderer only ever passes a boolean.
ipcMain.handle('desktop:setFullscreen', (_event: IpcMainInvokeEvent, value: unknown) => {
  if (mainWindow !== undefined && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(value === true);
  }
});
ipcMain.handle('desktop:openExternal', (_event: IpcMainInvokeEvent, url: unknown): Promise<void> => {
  if (typeof url === 'string' && isExternalHttp(url)) {
    return shell.openExternal(url);
  }
  return Promise.resolve();
});
// In-app "Add to Steam library" (Windows). Replaces the old NSIS finish-page checkbox now that
// Velopack's Setup.exe has no installer UI: the renderer offers an explicit, opt-in button that
// registers the Non-Steam shortcut + artwork for the CURRENT installed exe. No-ops off Windows
// (addToSteam guards the platform). Returns the result object so the UI can confirm / report.
ipcMain.handle('desktop:addToSteam', async () => {
  try {
    return await addToSteam();
  } catch (err) {
    return {ok: false, reason: String((err as {message?: string})?.message ?? err)};
  }
});
// Steam shortcut state for the renderer: whether it's already added (checked live against
// shortcuts.vdf), whether the user dismissed the first-run prompt, and whether this is the
// first run after install. Drives the first-run prompt gate + the Add-to-Steam button visibility.
ipcMain.handle('desktop:getSteamState', () => ({
  added: isAddedToSteam(),
  dismissed: getSteamPromptDismissed(),
  firstRun: VELOPACK_FIRSTRUN,
}));
ipcMain.handle('desktop:dismissSteamPrompt', () => {
  setSteamPromptDismissed(true);
});

// The app:// scheme must be registered as privileged BEFORE 'ready'.
if (APP_LOAD) {
  registerAppScheme();
}

// Single-instance: focus the existing window instead of opening a second one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow !== undefined) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.setAppUserModelId('io.github.victor-zelinskiy.terraforming-mars');

  void app.whenReady().then(async () => {
    if (APP_LOAD) {
      // Immutable art/font caching only in a packaged build; dev uses a short TTL
      // so edited assets still refresh (see protocol.cacheControl).
      registerAppProtocolHandler(app.isPackaged);
    }
    if (app.isPackaged) {
      // The immutable asset cache is version-scoped: if this build's version differs
      // from the one that populated the cache, wipe it BEFORE the window loads so
      // rebuilt art/fonts appear instead of the stale immutable-cached bytes. No-op
      // within one version (the fast cache keeps working).
      const cleared = await enforceVersionScopedCache();
      if (cleared) {
        // eslint-disable-next-line no-console
        console.log(`[electron] asset cache cleared for version ${app.getVersion()}`);
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[electron] ${APP_LOAD ? 'Phase 2A (app://)' : 'Phase 1 (server)'} — loading ${initialUrl()}`);
    registerUpdateIpc();
    registerInstallerCheckIpc();
    createWindow();
    // Confirm hardware acceleration is actually live (one line; see perf.ts).
    logGpuStatus(app);
    // Tell the renderer WHEN GPU compositing is actually live, so the boot warm-up
    // renders its cards on the READY GPU (Graphite) — not on the software path
    // during the ~330ms GPU-process init (else the card pipelines would compile
    // only at the first REAL deal, the residual first-deal hitch).
    if (mainWindow !== undefined) {
      signalGpuReadyWhenLive(mainWindow);
    }
    // DIAGNOSTIC: catch a GPU-process exit/crash (the `exit_on_context_lost` workaround makes a
    // lost D3D device kill + relaunch the GPU process — that reads as a periodic freeze). Surface
    // it loudly in the renderer console so a hitch can be correlated with a process restart.
    app.on('child-process-gone', (_event, details) => {
      const line = `[TM-DIAG] child-process-gone → type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`;
      // eslint-disable-next-line no-console
      console.warn(line);
      if (mainWindow !== undefined && !mainWindow.isDestroyed()) {
        void mainWindow.webContents
          .executeJavaScript(`console.warn(${JSON.stringify('%c' + line)}, 'color:#ef4444;font-weight:bold')`)
          .catch(() => {/* frame may be gone */});
      }
    });
    // Phase 7: packaged builds check the compatibility gate on startup and, if a
    // mandatory update is required, block game flow behind the premium update overlay.
    // No-op in dev (app.isPackaged === false). The renderer pulls the current state on
    // mount + subscribes to live pushes, so a slightly-late window is fine.
    if (mainWindow !== undefined) {
      void resolveStartupUpdate(serverBase(), mainWindow);
    }
    // Steam Deck: warn (non-blocking) if the installed launcher wrapper predates the current
    // installer on GitHub — the updater can't rewrite the wrapper, so the user must re-run it.
    void runInstallerCheck();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
