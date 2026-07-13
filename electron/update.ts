// Electron 43 — auto-update orchestration (main process). Velopack delivery.
//
// Two mechanisms:
//   1. COMPATIBILITY GATE — GET <serverBase>/api/desktop/version (from the MAIN process,
//      no CORS) decides whether the installed version may still play. A last-known-good
//      policy (electron/updatePolicy.ts) persisted to disk (electron/session.ts) means a
//      server outage no longer silently unlocks a known-outdated client (→ `offlineBlocked`),
//      while a first-run offline launch still fails open (unless TM_DESKTOP_STRICT_OFFLINE=1).
//   2. DELIVERY — Velopack (velopack npm 1.2.0). `UpdateManager` reads the GitHub Releases
//      feed (the vpk-published releases.<channel>.json + full/delta .nupkg), downloads in the
//      background with progress, and applies on the NEXT app exit (Squirrel-style in-place
//      swap: fast, per-user, no UAC). Unreachable/unconfigured feed → manual-download.
//
// Only runs when PACKAGED (`app.isPackaged`); a no-op in dev. State is pushed to the
// renderer over IPC; the premium overlay renders it. The DesktopUpdateState shape is
// DUPLICATED (structurally) in the renderer's desktopUpdateState.ts — keep in sync.

import {app, BrowserWindow, ipcMain, shell} from 'electron';
import * as fs from 'fs';
import {UpdateManager, type UpdateInfo} from 'velopack';
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
  /** True when the app can INSTALL AND RESTART itself: Windows, or Linux launched by
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

// The Velopack update session for this run. Lazily created (only in a packaged build, when a
// download actually starts), then reused. `pendingUpdate` holds the downloaded UpdateInfo the
// quitAndInstall handler applies.
let manager: UpdateManager | undefined;
let pendingUpdate: UpdateInfo | undefined;

/** The GitHub Releases feed the vpk-published packages live in. Velopack's core recognises a
 *  github.com URL and uses its GitHub source (it searches recent releases for the channel's
 *  releases.<channel>.json + the full/delta .nupkg). Public repo → no token needed. */
const FEED_URL = 'https://github.com/victor-zelinskiy/terraforming-mars';

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

/** Update channel label. Selects the gate's ?channel= query. Velopack itself uses the channel
 *  baked into the package at `vpk pack` time (per-OS default), so this only tags the gate. */
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

/** Velopack self-updates on Windows and on Linux ONLY when the app is actually running as an
 *  AppImage (the updater replaces the AppImage in place; it needs the $APPIMAGE env the
 *  AppImage runtime sets). A Linux build run unpacked / not-as-AppImage can't self-install, so
 *  we surface the premium manual-download fallback instead. macOS is out of scope for now. */
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

/** Whether the app can install AND restart itself: Windows, or Linux via the restart-loop
 *  wrapper. Otherwise the overlay offers install-and-close. */
function canRestartAfterUpdate(): boolean {
  return process.platform === 'win32' || linuxRestartMarker() !== undefined;
}

/** One-line status log — provider is the Velopack GitHub feed, plus the platform / AppImage /
 *  version / channel so a support log makes the update path obvious. */
function logUpdate(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(
    `[updater] provider=velopack-github platform=${process.platform} appImage=${runningAsAppImage()} ` +
    `current=${app.getVersion()} channel=${channel()} — ${msg}`,
  );
}

/** Lazily create (and reuse) the Velopack UpdateManager pointed at the GitHub feed. */
function getManager(): UpdateManager {
  if (manager === undefined) {
    manager = new UpdateManager(FEED_URL);
  }
  return manager;
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
      // Windows or Linux-as-AppImage: run the in-app download → the premium overlay shows the
      // progress bar and the Restart-and-install CTA (Velopack reports download progress on
      // BOTH platforms, so the Linux experience matches Windows).
      logUpdate('update required — starting in-app download');
      push({mode: 'required', error: undefined});
      void beginDownload();
    } else {
      // Linux NOT running as an AppImage (or any run Velopack can't self-install): never
      // silently fail — show the premium manual-download fallback with a working link
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

/** Check the Velopack feed, download the newest release with progress, and mark it ready to
 *  apply. The download runs in the background; nothing is applied until quitAndInstall. */
async function beginDownload(): Promise<void> {
  logUpdate('beginDownload — checking the Velopack GitHub feed');
  try {
    const mgr = getManager();
    const info = await mgr.checkForUpdatesAsync();
    if (info === null) {
      // The server gate said "required" but Velopack sees no newer release on the feed yet
      // (feed not published for this channel / OS, or a version mismatch). Never dead-end:
      // offer the manual download instead of spinning forever.
      updateOrManual('No update available on the Velopack feed');
      return;
    }
    push({mode: 'downloading', progress: {percent: 0, transferred: 0, total: 0, bytesPerSecond: 0}});
    await mgr.downloadUpdateAsync(info, (perc) => {
      // Velopack reports a single 0..100 percentage; the overlay renders the bar from it
      // (byte totals / speed aren't exposed by the JS binding — shown as 0, hidden by the UI).
      push({mode: 'downloading', progress: {percent: perc, transferred: 0, total: 0, bytesPerSecond: 0}});
    });
    pendingUpdate = info;
    logUpdate('download complete — ready to apply on restart');
    push({mode: 'downloaded'});
  } catch (err) {
    updateOrManual(err);
  }
}

/** Wire the IPC the preload's desktopBridge calls. Call once, after app ready. */
export function registerUpdateIpc(): void {
  ipcMain.handle('desktop:getUpdateState', () => state);
  // Retry from ANY blocked state: re-runs the whole check (network back → maybe unblock;
  // still required → re-arm the download; feed error → re-attempt).
  ipcMain.handle('desktop:recheck', () => runCheck().then(() => state));
  ipcMain.handle('desktop:quitAndInstall', () => {
    if (pendingUpdate === undefined || manager === undefined) {
      updateOrManual('No downloaded update to install');
      return;
    }
    const mgr = manager;
    const upd = pendingUpdate;
    push({mode: 'installing'});
    // Velopack applies the update by launching its updater, which waits (≤60s) for THIS process
    // to exit, swaps the files in place, then optionally relaunches. So every path must exit the
    // app after calling waitExitThenApplyUpdate. `silent=true` = no updater UI.
    if (process.platform === 'win32') {
      logUpdate('installing (Windows/Velopack) — apply + relaunch');
      setImmediate(() => {
        try {
          mgr.waitExitThenApplyUpdate(upd, true, true);
          app.quit();
        } catch (err) {
          updateOrManual(err);
        }
      });
      return;
    }
    // Linux/AppImage. We NEVER let Velopack relaunch on Linux (restart=false): a relaunch it
    // spawns would start OUTSIDE gamescope's session, so Steam waits forever on a process it
    // can't show ("infinite loading"). The updater still replaces the AppImage in place. Two paths:
    const marker = linuxRestartMarker();
    if (marker !== undefined) {
      // Steam Deck via the restart-loop wrapper: drop the marker, apply (no relaunch), exit — the
      // WRAPPER (the process Steam/gamescope tracks) relaunches the updated AppImage in the SAME
      // session. A real install-and-restart with no hang.
      logUpdate('installing (Linux/Velopack) — apply + restart via the wrapper loop');
      setTimeout(() => {
        try {
          fs.writeFileSync(marker, String(Date.now()));
        } catch (err) {
          logUpdate('could not write restart marker — ' + String(err));
        }
        try {
          mgr.waitExitThenApplyUpdate(upd, true, false);
        } catch (err) {
          updateOrManual(err);
          return;
        }
        app.quit();
        setTimeout(() => app.exit(0), 3000);
      }, 500);
      return;
    }
    // No restart-loop wrapper (old wrapper / direct launch): apply + quit cleanly and let the
    // player reopen the app (no relaunch child → Steam returns to the library, no hang).
    logUpdate('installing (Linux/Velopack) — apply WITHOUT relaunch; reopen manually');
    setTimeout(() => {
      try {
        mgr.waitExitThenApplyUpdate(upd, true, false);
      } catch (err) {
        updateOrManual(err);
        return;
      }
      app.quit();
      // Hang-proof: if quit() is ever blocked by a handler, force-exit so the process can never
      // sit spinning — Steam then cleanly returns to the library.
      setTimeout(() => app.exit(0), 3000);
    }, 900);
  });
  ipcMain.handle('desktop:openDownload', () => {
    if (state.downloadUrl !== undefined) {
      void shell.openExternal(state.downloadUrl);
    }
  });
}
