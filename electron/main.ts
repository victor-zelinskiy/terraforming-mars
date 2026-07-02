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
import {registerAppScheme, registerAppProtocolHandler, appUrl, APP_ORIGIN} from './protocol';
import {registerUpdateIpc, resolveStartupUpdate} from './update';
import {originOf, isSameOrigin as sameOrigin, isExternalHttp} from './navGuard';
import {applyPerformanceSwitches, logGpuStatus} from './perf';

// GPU / no-throttle command-line switches MUST be appended before app 'ready';
// module top-level runs well before then. Desktop-only; browser build untouched.
applyPerformanceSwitches(app);

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

function createWindow(): void {
  const cfg = runtimeConfig();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0d1117',
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
    mainWindow = undefined;
  });
}

// Narrow IPC surface backing the preload's desktopBridge. Nothing else is exposed.
ipcMain.handle('desktop:getVersion', () => app.getVersion());
ipcMain.handle('desktop:openExternal', (_event: IpcMainInvokeEvent, url: unknown): Promise<void> => {
  if (typeof url === 'string' && isExternalHttp(url)) {
    return shell.openExternal(url);
  }
  return Promise.resolve();
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

  app.setAppUserModelId('com.vize1215.terraforming-mars');

  void app.whenReady().then(() => {
    if (APP_LOAD) {
      // Immutable art/font caching only in a packaged build; dev uses a short TTL
      // so edited assets still refresh (see protocol.cacheControl).
      registerAppProtocolHandler(app.isPackaged);
    }
    // eslint-disable-next-line no-console
    console.log(`[electron] ${APP_LOAD ? 'Phase 2A (app://)' : 'Phase 1 (server)'} — loading ${initialUrl()}`);
    registerUpdateIpc();
    createWindow();
    // Confirm hardware acceleration is actually live (one line; see perf.ts).
    logGpuStatus(app);
    // Phase 7: packaged builds check the compatibility gate on startup and, if a
    // mandatory update is required, block game flow behind the premium update overlay.
    // No-op in dev (app.isPackaged === false). The renderer pulls the current state on
    // mount + subscribes to live pushes, so a slightly-late window is fine.
    if (mainWindow !== undefined) {
      void resolveStartupUpdate(serverBase(), mainWindow);
    }
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
