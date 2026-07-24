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

import {app, BrowserWindow, Menu, powerSaveBlocker, screen, shell, ipcMain, type IpcMainInvokeEvent} from 'electron';
import * as path from 'path';
import * as os from 'os';
import {registerAppScheme, registerAppProtocolHandler, appUrl, APP_ORIGIN} from './protocol';
import {enforceVersionScopedCache} from './cacheVersion';
import {registerUpdateIpc, resolveStartupUpdate} from './update';
import {registerInstallerCheckIpc, runInstallerCheck} from './installerCheck';
import {originOf, isSameOrigin as sameOrigin, isExternalHttp} from './navGuard';
import {applyPerformanceSwitches, logGpuStatus, parseAffinityPref, parseCliEnvOverrides, pCoreAffinityMask, processPriorityPref} from './perf';
import {execFile} from 'child_process';
import {installDevtoolsPadCursor} from './devtoolsPadCursor';
import {installConsoleCapture} from './consoleExport';
import {addToSteam, isAddedToSteam} from './steamShortcut';
import {readSteamPersonaName} from './steamPersona';
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

// Steam launch-options bridge: fold any `--tm-*` argv flags (Steam passes launch
// options as command-line ARGS on Windows, not env vars) onto the matching
// TM_ELECTRON_* env vars BEFORE anything below reads them — so a launch option
// like `--tm-switches=show-fps-counter` behaves exactly like the env var, and is
// convenient to toggle per-launch from Steam. See perf.ts `parseCliEnvOverrides`.
for (const [envName, value] of Object.entries(parseCliEnvOverrides(process.argv.slice(1)))) {
  process.env[envName] = value;
}

// GPU / no-throttle command-line switches MUST be appended before app 'ready';
// module top-level runs well before then. Desktop-only; browser build untouched.
// The tuned set is the DEFAULT; escape hatches are TM_ELECTRON_NO_PERF /
// TM_ELECTRON_FEATURES / TM_ELECTRON_SWITCHES — see perf.ts. The applied list is
// kept so it can be echoed into the renderer console for on-device verification.
const appliedPerfSwitches = applyPerformanceSwitches(app);

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

// The settled "[TM perf]" payload (applied switches + GPU feature status),
// stringified once when the GPU status settles (signalGpuReadyWhenLive) and
// re-echoed into the renderer console on every page load — game-boundary
// reloads clear the DevTools console, and F12 → Console must show the tuning
// state at any point in the session.
let perfEchoPayload: string | undefined;

// Display power-save blocker, held only while the game window is focused (see
// the focus/blur wiring in createWindow). Module-level so 'closed' can release it.
let displayBlockerId: number | undefined;

function startDisplayBlocker(): void {
  if (displayBlockerId === undefined) {
    displayBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  }
}

function stopDisplayBlocker(): void {
  if (displayBlockerId !== undefined) {
    if (powerSaveBlocker.isStarted(displayBlockerId)) {
      powerSaveBlocker.stop(displayBlockerId);
    }
    displayBlockerId = undefined;
  }
}

/**
 * Poll the GPU feature status until compositing is actually live, then signal the
 * renderer (window `tm-gpu-ready` event + `__tmGpuReady` flag). The boot warm-up
 * waits for this before rendering its cards, so their Graphite pipelines compile
 * on the ready GPU instead of the software path during GPU-process init. Bounded
 * (~4s cap) and fires exactly once — never hangs the loader.
 *
 * The same terminal signal also echoes a `[TM perf]` line into the RENDERER
 * console (main-process stdout is invisible in a packaged build): the applied
 * perf switches + the SETTLED GPU feature status. Deliberately emitted here and
 * not on did-finish-load — an early read during the ~330ms GPU-process init
 * reports a misleading "software" status.
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
    let gpu: unknown;
    try {
      gpu = app.getGPUFeatureStatus();
    } catch {
      gpu = 'unavailable';
    }
    // The EARLY logGpuStatus print at 'ready' can be a STALE pre-init snapshot
    // (a Deck run showed "software" there while gamescope WSI was presenting a
    // live Vulkan swapchain moments later). This SETTLED line — polled until
    // compositing is live or ~4s — is the authoritative one; it lands in the
    // Steam Deck wrapper log, where the renderer-console echo can't be seen.
    // eslint-disable-next-line no-console
    console.log(
      `[electron] GPU feature status (SETTLED${live ? '' : ' — timeout, still not live'} after ~${attempts * 100}ms):`,
      JSON.stringify(gpu));
    perfEchoPayload = JSON.stringify({switches: appliedPerfSwitches, gpu});
    void win.webContents
      .executeJavaScript(
        'window.__tmGpuReady = true; window.dispatchEvent(new Event("tm-gpu-ready"));' +
        `console.info('[TM perf]', ${perfEchoPayload});`)
      .catch(() => {/* frame gone */});
    return;
  }
  setTimeout(() => signalGpuReadyWhenLive(win, attempts + 1), 100);
}

/**
 * Raise the process priority class of the MAIN and RENDERER processes so
 * Windows keeps them on the performance cores at boost clocks (opting out of
 * EcoQoS / E-core parking) — the renderer's main thread runs the per-frame
 * animation JS, so on a hybrid laptop this is the lever that fixes "smooth on
 * the console, janky on the laptop" under an otherwise-light GPU load. See
 * perf.ts `processPriorityPref`. Windows-only (Linux/SteamOS: gamescope owns
 * scheduling and a negative nice needs privileges). Idempotent — re-applied on
 * every load; each call is wrapped so a setPriority failure can never break the
 * window.
 */
function applyProcessPriority(): void {
  if (process.platform !== 'win32') {
    return;
  }
  const pref = processPriorityPref(process.env.TM_ELECTRON_PRIORITY);
  if (pref === undefined) {
    return; // 'normal' / 'off' → leave the OS default
  }
  const value = pref === 'high'
    ? os.constants.priority.PRIORITY_HIGH
    : os.constants.priority.PRIORITY_ABOVE_NORMAL;
  const set = (pid: number, label: string): void => {
    try {
      os.setPriority(pid, value);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[electron] setPriority(${label}=${pid}) failed`, err);
    }
  };
  set(process.pid, 'main');
  const rendererPid = mainWindow?.webContents.getOSProcessId();
  if (rendererPid !== undefined && rendererPid > 0) {
    set(rendererPid, 'renderer');
  }
}

/** Run a PowerShell one-liner, resolve its stdout (rejects on error/non-zero). */
function runPowerShell(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      {windowsHide: true, timeout: 8000},
      (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
}

// Resolved P-core affinity mask (win32): undefined = don't pin; resolved once.
let affinityResolved = false;
let affinityMask: number | undefined;

/**
 * Resolve the P-core affinity mask once. `auto` reads the physical + logical core
 * counts (one PowerShell CIM query) and derives the mask via pCoreAffinityMask;
 * an explicit TM_ELECTRON_AFFINITY mask skips detection; `off` disables.
 */
async function resolveAffinityMask(): Promise<number | undefined> {
  const pref = parseAffinityPref(process.env.TM_ELECTRON_AFFINITY);
  if (pref.mode === 'off') {
    return undefined;
  }
  if (pref.mode === 'mask') {
    return pref.mask;
  }
  try {
    const out = await runPowerShell(
      '$s=Get-CimInstance -ClassName Win32_Processor;' +
      '($s|Measure-Object -Property NumberOfCores -Sum).Sum;' +
      '($s|Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum');
    const nums = out.split(/\s+/).map((t) => parseInt(t, 10)).filter((n) => Number.isInteger(n));
    return pCoreAffinityMask(nums[0], nums[1]);
  } catch {
    return undefined; // detection failed → leave the OS scheduler alone
  }
}

/**
 * Pin the main + renderer processes to the P-cores on a hybrid Intel CPU, so the
 * layout-bound renderer main thread stays on the FAST cores instead of migrating
 * onto the weak E-cores (the "same code, worse than the console" gap). Windows-
 * only, auto-detected, idempotent (re-applied each load); every step wrapped so a
 * failure can never break the window. Disable/override via TM_ELECTRON_AFFINITY.
 * See perf.ts `pCoreAffinityMask`.
 */
async function applyPCoreAffinity(): Promise<void> {
  if (process.platform !== 'win32') {
    return;
  }
  if (!affinityResolved) {
    affinityMask = await resolveAffinityMask();
    affinityResolved = true;
  }
  if (affinityMask === undefined) {
    return; // uniform CPU / disabled / detection failed
  }
  const pids = [process.pid];
  const rendererPid = mainWindow?.webContents.getOSProcessId();
  if (rendererPid !== undefined && rendererPid > 0) {
    pids.push(rendererPid);
  }
  try {
    await runPowerShell(
      `foreach($id in @(${pids.join(',')})){try{(Get-Process -Id $id).ProcessorAffinity=[IntPtr]${affinityMask}}catch{}}`);
    // eslint-disable-next-line no-console
    console.log(`[electron] pinned pids ${pids.join(',')} to P-core affinity 0x${affinityMask.toString(16)}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[electron] set P-core affinity failed', err);
  }
}

function createWindow(): void {
  const cfg = runtimeConfig();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    // Native pre-paint frame colour (shown from window map until the renderer's
    // first paint). Matches the CSS body base (#050812, common.less) so startup
    // — pre-paint frame → loading gap → menu — is one seamless near-black
    // deep-space surface, never a grey flash.
    backgroundColor: '#050812',
    autoHideMenuBar: true,
    fullscreen: FULLSCREEN,
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
      // No editable game field needs the OS spellchecker — it initializes the
      // Windows spellcheck service / loads hunspell dictionaries and adds IPC
      // round-trips on every input field for nothing.
      spellcheck: false,
      // Cache V8 bytecode aggressively (default caches only "hot" scripts): the
      // bundle is large and the game boundary is a FULL reload, so every entry
      // into a game recompiles it — the bytecode cache cuts that main-thread
      // cost. cacheVersion.ts clears this cache on a new build (clearCodeCaches).
      v8CacheOptions: 'bypassHeatCheck',
      // Passed to the sandboxed preload via process.argv (no Node/IPC needed
      // just to read config). apiBase/wsBase are not secrets; participantId is
      // a local dev token only.
      additionalArguments: ['--tm-runtime-config=' + JSON.stringify(cfg)],
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    startDisplayBlocker();
  });

  // Keep the display awake while the game window is focused — a board-game turn
  // can sit idle past the OS display-sleep timeout. Focus-gated so an alt-tabbed
  // session doesn't pin the screen on. (On the Deck gamescope owns the display;
  // the blocker is a harmless no-op there.)
  mainWindow.on('focus', startDisplayBlocker);
  mainWindow.on('blur', stopDisplayBlocker);

  // F12 toggles DevTools even in the packaged fullscreen build — the one
  // accelerator kept after dropping the default application menu. It's how the
  // on-device "[TM perf]" echo and ?perf=1 long-task logs are read.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      event.preventDefault();
      const wc = mainWindow?.webContents;
      if (wc !== undefined) {
        if (wc.isDevToolsOpened()) {
          wc.closeDevTools();
        } else {
          wc.openDevTools({mode: 'detach'});
        }
      }
    }
  });

  // Passive capture of the renderer console (fires whether or not DevTools is open) so the
  // F12 "Экспорт консоли" button can dump it to a file beside the game log.
  const consoleExporter = installConsoleCapture(app, mainWindow);

  // Gamepad-driven mouse cursor INSIDE the DevTools window only (Steam Machine /
  // Deck have no mouse; F12 was visible but un-navigable from the pad) + the export
  // button. Scoped strictly to devToolsWebContents — the game surface is untouched.
  installDevtoolsPadCursor(mainWindow, {onExport: () => consoleExporter.export()});

  // Re-echo the settled "[TM perf]" line on every page load — game-boundary
  // reloads clear the DevTools console, and this keeps the tuning state
  // inspectable mid-session. (Before the GPU status settles the payload is
  // undefined and the first echo comes from signalGpuReadyWhenLive instead.)
  mainWindow.webContents.on('did-finish-load', () => {
    // Re-assert the process priority + P-core affinity on every load — the
    // renderer OS pid is guaranteed spawned here, and a game-boundary reload must
    // not drop back to the OS default. Both idempotent.
    applyProcessPriority();
    void applyPCoreAffinity();
    if (perfEchoPayload !== undefined) {
      void mainWindow?.webContents
        .executeJavaScript(`console.info('[TM perf]', ${perfEchoPayload});`)
        .catch(() => {/* frame gone */});
    }
  });

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
  if (FULLSCREEN) {
    mainWindow.on('leave-full-screen', () => {
      if (mainWindow !== undefined && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(true);
      }
    });
  }

  void mainWindow.loadURL(initialUrl());

  if (process.env.TM_ELECTRON_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({mode: 'detach'});
  }

  mainWindow.on('closed', () => {
    stopDisplayBlocker();
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
// The physical display the window sits on — TV-profile diagnostics (the
// renderer heuristics work from window.screen × devicePixelRatio; this is
// the authoritative Electron view: bounds, scaleFactor, internal-vs-HDMI).
ipcMain.handle('desktop:getDisplayInfo', () => {
  if (mainWindow === undefined || mainWindow.isDestroyed()) {
    return undefined;
  }
  const d = screen.getDisplayMatching(mainWindow.getBounds());
  return {
    bounds: d.bounds,
    workArea: d.workArea,
    scaleFactor: d.scaleFactor,
    physicalWidth: Math.round(d.bounds.width * d.scaleFactor),
    physicalHeight: Math.round(d.bounds.height * d.scaleFactor),
    internal: d.internal,
    label: d.label,
    fullscreen: mainWindow.isFullScreen(),
  };
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
// The DISPLAY name (persona) of the account signed into Steam — cross-platform, read-only,
// best-effort (parses config/loginusers.vdf; no Steamworks SDK). Used ONLY to prefill the player
// name on first launch when no local identity exists yet (Steam Deck / Steam Machine / desktop).
// Returns undefined when Steam / a logged-in account can't be found; never throws.
ipcMain.handle('desktop:getSteamName', () => {
  try {
    return readSteamPersonaName();
  } catch {
    return undefined;
  }
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
    // Drop the default application menu (Windows/Linux): a game shell needs none
    // of its accelerators, and the dangerous ones actively hurt — Ctrl+R is an
    // accidental game-boundary reload mid-game, F11 fights the fullscreen
    // enforcement. DevTools access is re-provided explicitly via F12 (createWindow).
    if (process.platform !== 'darwin') {
      Menu.setApplicationMenu(null);
    }
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
