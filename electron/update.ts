// Electron 43 — Phase 7 premium auto-update orchestration (main process).
//
// Two mechanisms:
//   1. COMPATIBILITY GATE — GET <serverBase>/api/desktop/version tells us whether the
//      installed version is still allowed to play (authoritative "you're too old, must
//      update"). Runs from the MAIN process (no CORS). Drives the update-only boot.
//   2. DELIVERY — electron-updater (NSIS) downloads the newer installer from the feed
//      baked into app-update.yml (electron-builder `publish`). When the feed isn't
//      reachable/configured, we degrade to a manual-download prompt (the server can
//      supply a downloadUrl).
//
// Only runs when the app is PACKAGED (`app.isPackaged`); electron-updater is a no-op /
// throws in an unpacked dev run, so the whole flow is skipped in dev.
//
// State is pushed to the renderer over IPC; the premium overlay (renderer) renders it.
// The type is DUPLICATED (structurally) in the renderer's desktopUpdateState.ts — keep
// them in sync (main stays self-contained: no @/ imports).

import {app, BrowserWindow, ipcMain, shell} from 'electron';
import {autoUpdater} from 'electron-updater';

export type DesktopUpdateMode =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'required'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'
  | 'manualDownloadRequired';

export interface DesktopUpdateState {
  mode: DesktopUpdateMode;
  currentVersion: string;
  latestVersion?: string;
  minSupportedVersion?: string;
  releaseNotes?: Array<string>;
  progress?: {percent: number; transferred: number; total: number; bytesPerSecond: number};
  error?: string;
  downloadUrl?: string;
}

/** The subset of the /api/desktop/version response we read. */
interface CompatResponse {
  latestVersion: string;
  minSupportedVersion: string;
  updateRequired: boolean;
  releaseNotes?: Array<string>;
  downloadUrl?: string;
}

let state: DesktopUpdateState = {mode: 'idle', currentVersion: app.getVersion()};
let win: BrowserWindow | undefined;

function push(next: Partial<DesktopUpdateState>): void {
  state = {...state, ...next};
  if (win !== undefined && !win.isDestroyed()) {
    win.webContents.send('desktop:update-state', state);
  }
}

/** True while a mandatory update blocks normal game flow. */
export function updateBlocksGame(): boolean {
  return state.mode === 'required' || state.mode === 'downloading' ||
    state.mode === 'downloaded' || state.mode === 'installing' ||
    state.mode === 'manualDownloadRequired' ||
    (state.mode === 'error' && state.error !== undefined);
}

async function fetchCompat(serverBase: string, timeoutMs = 8000): Promise<CompatResponse | undefined> {
  const base = serverBase.replace(/\/+$/, '');
  const url = `${base}/api/desktop/version?platform=${process.platform}&current=${encodeURIComponent(app.getVersion())}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {signal: controller.signal});
    clearTimeout(timer);
    if (!res.ok) {
      return undefined;
    }
    return await res.json() as CompatResponse;
  } catch {
    return undefined;
  }
}

/**
 * Startup compatibility check. Returns true when a MANDATORY update blocks the game.
 * Fail-open on a network error (a transient server outage must not brick the app — a
 * stricter offline-block policy is a Phase 8 option).
 */
export async function resolveStartupUpdate(serverBase: string, window: BrowserWindow): Promise<boolean> {
  win = window;
  if (!app.isPackaged) {
    push({mode: 'idle'});
    return false;
  }
  push({mode: 'checking'});
  const compat = await fetchCompat(serverBase);
  if (compat === undefined) {
    push({mode: 'idle'}); // fail-open
    return false;
  }
  push({
    latestVersion: compat.latestVersion,
    minSupportedVersion: compat.minSupportedVersion,
    releaseNotes: compat.releaseNotes,
    downloadUrl: compat.downloadUrl,
  });
  if (!compat.updateRequired) {
    push({mode: 'upToDate'});
    return false;
  }
  push({mode: 'required'});
  beginDownload();
  return true;
}

function updateOrManual(err: unknown): void {
  const message = String((err as {message?: string})?.message ?? err);
  push({mode: state.downloadUrl !== undefined ? 'manualDownloadRequired' : 'error', error: message});
}

function beginDownload(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.removeAllListeners();
  autoUpdater.on('update-available', () => push({mode: 'downloading'}));
  autoUpdater.on('update-not-available', () => updateOrManual('No update available on the feed'));
  autoUpdater.on('download-progress', (p) => push({
    mode: 'downloading',
    progress: {percent: p.percent, transferred: p.transferred, total: p.total, bytesPerSecond: p.bytesPerSecond},
  }));
  autoUpdater.on('update-downloaded', () => push({mode: 'downloaded'}));
  autoUpdater.on('error', (err) => updateOrManual(err));
  autoUpdater.checkForUpdates().catch((err) => updateOrManual(err));
}

/** Wire the IPC the preload's desktopBridge calls. Call once, after app ready. */
export function registerUpdateIpc(): void {
  ipcMain.handle('desktop:getUpdateState', () => state);
  ipcMain.handle('desktop:retryUpdate', () => {
    push({mode: 'required'});
    beginDownload();
    return state;
  });
  ipcMain.handle('desktop:quitAndInstall', () => {
    push({mode: 'installing'});
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(false, true);
      } catch (err) {
        updateOrManual(err);
      }
    });
  });
  ipcMain.handle('desktop:openDownload', () => {
    if (state.downloadUrl !== undefined) {
      void shell.openExternal(state.downloadUrl);
    }
  });
}
