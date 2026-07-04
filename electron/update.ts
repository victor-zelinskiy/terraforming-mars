// Electron 43 — Phase 7/8 auto-update orchestration (main process).
//
// Two mechanisms:
//   1. COMPATIBILITY GATE — GET <serverBase>/api/desktop/version (from the MAIN process,
//      no CORS) decides whether the installed version may still play. Phase 8 hardens
//      this with a last-known-good policy (electron/updatePolicy.ts) persisted to disk
//      (electron/session.ts): a server outage no longer silently unlocks a known-
//      outdated client (→ `offlineBlocked`), while a first-run offline launch still
//      fails open (unless TM_DESKTOP_STRICT_OFFLINE=1).
//   2. DELIVERY — electron-updater (NSIS) downloads the newer installer from the feed
//      baked into app-update.yml. Unreachable/unconfigured feed → manual-download.
//
// Only runs when PACKAGED (`app.isPackaged`); a no-op in dev. State is pushed to the
// renderer over IPC; the premium overlay renders it. The DesktopUpdateState shape is
// DUPLICATED (structurally) in the renderer's desktopUpdateState.ts — keep in sync.

import {app, BrowserWindow, ipcMain, shell} from 'electron';
import * as fs from 'fs';
import {autoUpdater} from 'electron-updater';
import {CompatSnapshot, resolveUpdateDecision} from './updatePolicy';
import {getLastKnownGood, setLastKnownGood} from './session';

export type DesktopUpdateMode =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'required'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'
  | 'offlineBlocked'
  | 'manualDownloadRequired';

export interface DesktopUpdateState {
  mode: DesktopUpdateMode;
  currentVersion: string;
  /** Runtime platform (main-process `process.platform`) so the overlay can show
   *  platform-specific guidance (e.g. the Linux/Steam Deck "reopen from Steam" step). */
  platform?: string;
  /** True when the app can INSTALL AND RESTART itself: Windows (NSIS), or Linux launched by
   *  a restart-loop wrapper (Steam Deck). When false the overlay offers "install and close"
   *  (the player reopens the app). Drives the button label + hint. */
  restartSupported?: boolean;
  latestVersion?: string;
  minSupportedVersion?: string;
  releaseNotes?: Array<string>;
  progress?: {percent: number; transferred: number; total: number; bytesPerSecond: number};
  error?: string;
  downloadUrl?: string;
}

let state: DesktopUpdateState = {
  mode: 'idle',
  currentVersion: app.getVersion(),
  platform: process.platform,
  restartSupported: canRestartAfterUpdate(),
};
let win: BrowserWindow | undefined;
let serverBaseUrl = '';

function push(next: Partial<DesktopUpdateState>): void {
  state = {...state, ...next};
  if (win !== undefined && !win.isDestroyed()) {
    win.webContents.send('desktop:update-state', state);
  }
}

/** True while a mandatory update (or a hard offline block) blocks normal game flow. */
export function updateBlocksGame(): boolean {
  return state.mode === 'required' || state.mode === 'downloading' ||
    state.mode === 'downloaded' || state.mode === 'installing' ||
    state.mode === 'offlineBlocked' || state.mode === 'manualDownloadRequired' ||
    (state.mode === 'error' && state.error !== undefined);
}

/** Update channel (dev/staging/prod/latest). Selects the feed yml + the gate's ?channel=. */
function channel(): string {
  return (process.env.TM_UPDATE_CHANNEL ?? '').trim() || 'latest';
}

function strictOffline(): boolean {
  return process.env.TM_DESKTOP_STRICT_OFFLINE === '1';
}

/** The public GitHub Releases page — the manual-download fallback when the app can't
 *  self-update (a Linux run NOT as an AppImage, or a late auto-update error). This is the
 *  CURRENT public repo, not an old/implicit target. */
const RELEASES_PAGE_URL = 'https://github.com/victor-zelinskiy/terraforming-mars/releases/latest';

/** electron-updater self-updates on Windows (NSIS) and on Linux ONLY when the app is
 *  actually running as an AppImage (AppImageUpdater needs the $APPIMAGE env the AppImage
 *  runtime sets). A Linux build run unpacked / not-as-AppImage can't self-install, so we
 *  surface the premium manual-download fallback instead. macOS is out of scope for now. */
function runningAsAppImage(): boolean {
  return process.platform === 'linux' &&
    typeof process.env.APPIMAGE === 'string' && process.env.APPIMAGE.length > 0;
}

function canAutoUpdate(): boolean {
  return process.platform === 'win32' || runningAsAppImage();
}

/** On Linux, a restart-loop launcher (the Steam Deck wrapper) exports TM_RESTART_SUPPORTED=1
 *  and TM_RESTART_MARKER=<path>. When the app wants to restart after an update it writes the
 *  marker and exits; the wrapper — which Steam/gamescope actually tracks — relaunches the
 *  updated AppImage IN THE SAME session (an in-process/detached relaunch can't rejoin it).
 *  Returns the marker path when that launcher is present, else undefined. */
function linuxRestartMarker(): string | undefined {
  if (process.platform !== 'linux' || process.env.TM_RESTART_SUPPORTED !== '1') {
    return undefined;
  }
  const marker = (process.env.TM_RESTART_MARKER ?? '').trim();
  return marker !== '' ? marker : undefined;
}

/** Whether the app can install AND restart itself: Windows (NSIS) or Linux via the
 *  restart-loop wrapper. Otherwise the overlay offers install-and-close. */
function canRestartAfterUpdate(): boolean {
  return process.platform === 'win32' || linuxRestartMarker() !== undefined;
}

/** One-line status log — provider is GitHub Releases (baked into app-update.yml), plus the
 *  platform / AppImage / version / channel so a support log makes the update path obvious. */
function logUpdate(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(
    `[updater] provider=github platform=${process.platform} appImage=${runningAsAppImage()} ` +
    `current=${app.getVersion()} channel=${channel()} — ${msg}`,
  );
}

async function fetchCompat(base: string, timeoutMs = 8000): Promise<CompatSnapshot | undefined> {
  const b = base.replace(/\/+$/, '');
  const url = `${b}/api/desktop/version?platform=${process.platform}` +
    `&channel=${encodeURIComponent(channel())}&current=${encodeURIComponent(app.getVersion())}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {signal: controller.signal});
    clearTimeout(timer);
    if (!res.ok) {
      return undefined;
    }
    const j = await res.json() as Partial<CompatSnapshot>;
    if (typeof j.latestVersion !== 'string' || typeof j.minSupportedVersion !== 'string') {
      return undefined;
    }
    return {
      latestVersion: j.latestVersion,
      minSupportedVersion: j.minSupportedVersion,
      updateRequired: j.updateRequired === true,
      releaseNotes: Array.isArray(j.releaseNotes) ? j.releaseNotes : undefined,
      downloadUrl: typeof j.downloadUrl === 'string' ? j.downloadUrl : undefined,
    };
  } catch {
    return undefined;
  }
}

/** Run (or re-run) the compatibility check + decision. Returns true when the game is blocked. */
async function runCheck(): Promise<boolean> {
  if (!app.isPackaged) {
    push({mode: 'idle'});
    return false;
  }
  push({mode: 'checking'});
  const fresh = await fetchCompat(serverBaseUrl);
  const cached = getLastKnownGood();
  if (fresh !== undefined) {
    setLastKnownGood(fresh, Date.now());
  }
  const decision = resolveUpdateDecision({fresh, cached, strictOffline: strictOffline()});
  if (decision.info !== undefined) {
    push({
      latestVersion: decision.info.latestVersion,
      minSupportedVersion: decision.info.minSupportedVersion,
      releaseNotes: decision.info.releaseNotes,
      downloadUrl: decision.info.downloadUrl,
    });
  }
  if (decision.mode === 'required') {
    if (canAutoUpdate()) {
      // Windows (NSIS) or Linux-as-AppImage: run the in-app download → the premium overlay
      // shows the progress bar and the Restart-and-install CTA (electron-updater emits
      // download-progress on BOTH platforms, so the Linux experience matches Windows).
      logUpdate('update required — starting in-app download');
      push({mode: 'required', error: undefined});
      beginDownload();
    } else {
      // Linux NOT running as an AppImage (or any run electron-updater can't self-install):
      // never silently fail — show the premium manual-download fallback with a working link
      // (server-provided URL, else the public Releases page).
      logUpdate('update required — self-update unavailable in this run; manual download');
      push({
        mode: 'manualDownloadRequired',
        error: undefined,
        downloadUrl: state.downloadUrl ?? decision.info?.downloadUrl ?? RELEASES_PAGE_URL,
      });
    }
    return true;
  }
  if (decision.mode === 'offlineBlocked') {
    push({mode: 'offlineBlocked', error: 'Cannot reach the update server.'});
    return true;
  }
  push({mode: fresh !== undefined ? 'upToDate' : 'idle', error: undefined});
  return false;
}

/**
 * Startup compatibility check. Returns true when a mandatory update (or hard offline
 * block) blocks the game. Stores the server base + window so a later recheck (retry)
 * can re-run the whole flow.
 */
export async function resolveStartupUpdate(serverBase: string, window: BrowserWindow): Promise<boolean> {
  win = window;
  serverBaseUrl = serverBase;
  return runCheck();
}

function updateOrManual(err: unknown): void {
  const message = String((err as {message?: string})?.message ?? err);
  logUpdate(`error — ${message}`);
  // A genuine auto-update failure: show the error + Try-again, and ALWAYS offer a working
  // manual-download link (server URL, else the public Releases page) so the player is never
  // stuck — especially on Linux where a self-update can fail late in the flow.
  push({mode: 'error', error: message, downloadUrl: state.downloadUrl ?? RELEASES_PAGE_URL});
}

function beginDownload(): void {
  logUpdate('beginDownload — reading the GitHub Releases feed (latest.yml / latest-linux.yml)');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.channel = channel();
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
  // Retry from ANY blocked state: re-runs the whole check (network back → maybe unblock;
  // still required → re-arm the download; feed error → re-attempt).
  ipcMain.handle('desktop:recheck', () => runCheck().then(() => state));
  ipcMain.handle('desktop:quitAndInstall', () => {
    push({mode: 'installing'});
    if (process.platform === 'win32') {
      logUpdate('installing (Windows NSIS) — install + auto-relaunch');
      setImmediate(() => {
        try {
          autoUpdater.quitAndInstall(false, true);
        } catch (err) {
          updateOrManual(err);
        }
      });
      return;
    }
    // Linux/AppImage. We NEVER use electron-updater's own auto-relaunch: it spawns the new
    // AppImage DETACHED with empty args (no --no-sandbox) OUTSIDE gamescope's session, so
    // Steam waits forever on a process it can't show ("infinite loading"). quitAndInstall
    // (true, false) takes the APPIMAGE_EXIT_AFTER_INSTALL path (integrate + exit, no lingering
    // child), replacing the AppImage in place (its custom filename is preserved). Two paths:
    const marker = linuxRestartMarker();
    if (marker !== undefined) {
      // Steam Deck via the restart-loop wrapper: drop the marker, install, exit — the WRAPPER
      // (the process Steam/gamescope tracks) relaunches the updated AppImage in the SAME
      // session. A real install-and-restart with no hang.
      logUpdate('installing (Linux AppImage) — install + restart via the wrapper loop');
      setTimeout(() => {
        try {
          fs.writeFileSync(marker, String(Date.now()));
        } catch (err) {
          logUpdate('could not write restart marker — ' + String(err));
        }
        try {
          autoUpdater.quitAndInstall(true, false);
        } catch (err) {
          updateOrManual(err);
          return;
        }
        setTimeout(() => app.exit(0), 3000);
      }, 500);
      return;
    }
    // No restart-loop wrapper (old wrapper / direct launch): install + quit cleanly and let
    // the player reopen the app (no relaunch child → Steam returns to the library, no hang).
    logUpdate('installing (Linux AppImage) — install WITHOUT relaunch; reopen manually');
    setTimeout(() => {
      try {
        autoUpdater.quitAndInstall(true, false);
      } catch (err) {
        updateOrManual(err);
        return;
      }
      // Hang-proof: if app.quit() is ever blocked by a handler, force-exit so the process
      // can never sit spinning — Steam then cleanly returns to the library.
      setTimeout(() => app.exit(0), 3000);
    }, 900);
  });
  ipcMain.handle('desktop:openDownload', () => {
    if (state.downloadUrl !== undefined) {
      void shell.openExternal(state.downloadUrl);
    }
  });
}
