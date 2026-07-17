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
// The two mechanisms run at DIFFERENT speeds, and the `pending` LOCK is what reconciles them.
// The gate is version-based (it reads the release TAG), while the feed only serves what CI has
// actually packed — so the gate legitimately runs ahead of the feed twice:
//   * a build is still running     → the version it will publish beats everything on the feed;
//   * a build published only SOME  → release.yml creates the tag in the `windows` job and merges
//     channels                       the `linux` channel into it later, so a Linux client can see
//                                    a `latest` its own channel doesn't carry yet.
// In both cases downloading "the newest thing the feed has" is wrong: it either updates twice
// within minutes or 404s. So the client LOCKS in `pending`, polls, and updates ONCE — straight to
// the version CI is publishing — the moment it is actually downloadable for THIS platform.
//
// Only runs when PACKAGED (`app.isPackaged`); a no-op in dev. State is pushed to the
// renderer over IPC; the premium overlay renders it. The DesktopUpdateState shape is
// DUPLICATED (structurally) in the renderer's desktopUpdateState.ts — keep in sync.

import {app, BrowserWindow, ipcMain, shell} from 'electron';
import * as fs from 'fs';
import {UpdateManager, type UpdateInfo} from 'velopack';
import {AppImageIdentity, CompatSnapshot, resolveUpdateDecision, restartMarkerStamp} from './updatePolicy';
import {getLastKnownGood, setLastKnownGood} from './session';

export type DesktopUpdateMode =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'pending'
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
  /** True when the app can INSTALL AND RESTART itself: Windows, or Linux launched by a
   *  restart-loop wrapper (Steam Deck). This is also the AUTO-APPLY gate — a download that comes
   *  back on its own is applied without asking, while one that could only CLOSE the game keeps an
   *  explicit "Install and close" button (an unprompted exit reads as a crash). */
  restartSupported?: boolean;
  latestVersion?: string;
  minSupportedVersion?: string;
  releaseNotes?: Array<string>;
  progress?: {percent: number; transferred: number; total: number; bytesPerSecond: number};
  error?: string;
  downloadUrl?: string;
  /** In `pending` mode: the version being waited for (the one CI is publishing). */
  pendingVersion?: string;
  /** In `pending` mode: WHY we are waiting — `ci-build` (the release is still building) or
   *  `platform-feed` (it is published, but this platform's package hasn't landed on the feed
   *  yet). Drives the overlay's wording; the lock behaves the same either way. */
  pendingReason?: 'ci-build' | 'platform-feed';
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

/** The Velopack update feed. We point at OUR server's PROXY (`/api/desktop/feed`), NOT github.com
 *  directly: the proxy serves the channel manifest and 302-redirects the .nupkg packages to the
 *  GitHub release CDN, so the client never calls the rate-limited GitHub REST API (unauthenticated
 *  60/hr → 403 under load; the JS binding can't send a token). Falls back to the public GitHub repo
 *  if the server base is somehow unknown (Velopack's core then uses its GitHub source directly). */
const GITHUB_FEED_FALLBACK = 'https://github.com/victor-zelinskiy/terraforming-mars';
function feedUrl(): string {
  const base = serverBaseUrl.replace(/\/+$/, '');
  return base !== '' ? `${base}/api/desktop/feed` : GITHUB_FEED_FALLBACK;
}

function push(next: Partial<DesktopUpdateState>): void {
  state = {...state, ...next};
  if (win !== undefined && !win.isDestroyed()) {
    win.webContents.send('desktop:update-state', state);
  }
}

/** True while a mandatory update (or a hard offline block) blocks normal game flow. `pending` is
 *  in here on purpose: a build that will publish a version newer than the installed one makes the
 *  client outdated ALREADY — it would be force-updated the moment that release lands, so it waits
 *  for it rather than starting a session it is about to be kicked out of. */
export function updateBlocksGame(): boolean {
  return state.mode === 'required' || state.mode === 'pending' ||
    state.mode === 'downloading' || state.mode === 'downloaded' || state.mode === 'installing' ||
    state.mode === 'offlineBlocked' || state.mode === 'manualDownloadRequired' ||
    (state.mode === 'error' && state.error !== undefined);
}

/** True once the update flow has TAKEN OVER: a package is downloading, is downloaded and about to
 *  be applied, or is being applied. A re-check must not re-enter it — `beginDownload` would run a
 *  second time and Velopack takes a GLOBAL update lock, so the concurrent call throws and would
 *  surface a bogus error over a perfectly healthy download. There is also nothing left to decide:
 *  the newest package is already in hand. (`error` is deliberately NOT here — retrying out of it
 *  is exactly what Try-again is for.) */
function updateInFlight(): boolean {
  return state.mode === 'downloading' || state.mode === 'downloaded' || state.mode === 'installing';
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

/** stat() the CURRENTLY-running AppImage (the file UpdateNix is about to replace) for the
 *  restart-marker stamp. $APPIMAGE is set by the AppImage runtime; unset / unreadable →
 *  undefined → the stamp degrades to the legacy bare timestamp (wrapper relaunches
 *  immediately, today's behaviour). */
function statRunningAppImage(): AppImageIdentity | undefined {
  const p = (process.env.APPIMAGE ?? '').trim();
  if (p === '') {
    return undefined;
  }
  try {
    const st = fs.statSync(p);
    return {ino: st.ino, mtimeMs: st.mtimeMs};
  } catch {
    return undefined;
  }
}

/** One-line status log — provider is the Velopack GitHub feed, plus the platform / AppImage /
 *  version / channel so a support log makes the update path obvious. */
function logUpdate(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(
    `[updater] provider=velopack-proxy feed=${feedUrl()} platform=${process.platform} ` +
    `appImage=${runningAsAppImage()} current=${app.getVersion()} channel=${channel()} — ${msg}`,
  );
}

/** Lazily create (and reuse) the Velopack UpdateManager pointed at our proxy feed. */
function getManager(): UpdateManager {
  if (manager === undefined) {
    manager = new UpdateManager(feedUrl());
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
      buildInProgress: j.buildInProgress === true,
      pendingVersion: typeof j.pendingVersion === 'string' ? j.pendingVersion : undefined,
    };
  } catch {
    return undefined;
  }
}

/** While we wait, re-check periodically until the release lands (→ the download starts by itself)
 *  or the build finishes without a newer version (→ up to date). This poll IS the auto-start:
 *  every tick re-runs the whole decision, so nothing needs the player to press anything. */
const PENDING_POLL_MS = 25_000;
let pendingTimer: ReturnType<typeof setTimeout> | undefined;
function clearPendingPoll(): void {
  if (pendingTimer !== undefined) {
    clearTimeout(pendingTimer);
    pendingTimer = undefined;
  }
}
function schedulePendingPoll(): void {
  clearPendingPoll();
  pendingTimer = setTimeout(() => {
    void runCheck();
  }, PENDING_POLL_MS);
}

/** Enter (or stay in) the waiting lock and arm the poll that will auto-start the update. */
function lockPending(reason: 'ci-build' | 'platform-feed', version: string | undefined): void {
  push({mode: 'pending', error: undefined, pendingReason: reason, pendingVersion: version});
  schedulePendingPoll();
}

/**
 * Bound for the `platform-feed` wait — see `beginDownload`. The CI-build wait needs no bound: it
 * ends on an authoritative server signal (the workflow run stops being active). This one is an
 * INFERENCE — "the gate wants a version Velopack can't see, so the feed must still be catching
 * up" — and an inference can be wrong (a broken/half-published release, an install Velopack can't
 * update). So it is capped, and on expiry we fall through to the normal error / manual-download
 * fallback rather than locking the player out for good. ~5 min covers the real window: the linux
 * channel is merged before its run completes, leaving only the feed proxy's ~2 min asset cache
 * plus GitHub CDN propagation.
 */
const PLATFORM_FEED_MAX_WAITS = 12;
let platformFeedWaits = 0;

/** Wait for THIS platform's package to appear on the feed, while the budget lasts. Returns false
 *  once it's exhausted → the caller surfaces the honest failure. */
function awaitPlatformFeed(why: string): boolean {
  if (platformFeedWaits >= PLATFORM_FEED_MAX_WAITS) {
    logUpdate(`feed still has no package for this platform after ${platformFeedWaits} checks — giving up (${why})`);
    return false;
  }
  platformFeedWaits++;
  logUpdate(
    `gate wants ${state.latestVersion ?? 'a newer version'} but it isn't on this platform's feed yet ` +
    `(${why}) — waiting ${platformFeedWaits}/${PLATFORM_FEED_MAX_WAITS}`);
  lockPending('platform-feed', state.latestVersion);
  return true;
}

/** Run (or re-run) the compatibility check + decision. Returns true when the game is blocked. */
async function runCheck(): Promise<boolean> {
  // Every run cancels the pending poll; the branches below re-arm it only if still pending.
  clearPendingPoll();
  if (!app.isPackaged) {
    push({mode: 'idle'});
    return false;
  }
  // The update flow already owns this run — see `updateInFlight`. Callers fire freely (the main
  // menu re-checks on a timer), so this guard, not each caller, is what keeps a second download
  // from being started on top of a live one.
  if (updateInFlight()) {
    return true;
  }
  // NEVER drop a gate that is already blocking down to the non-blocking 'checking' pill: this
  // function re-runs on the waiting poll (every PENDING_POLL_MS) and on Try-again, and each of
  // those would otherwise flash the game screen open — interactive — for the length of the fetch.
  // The startup check is unaffected: nothing is blocking yet, so the pill still shows.
  if (!updateBlocksGame()) {
    push({mode: 'checking'});
  }
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
  // A newer release is building on CI. LOCK and wait for it: the client is already outdated
  // (that build is the latest version), and updating to whatever is published right now would
  // just mean a second update minutes later. The poll re-runs this check until the build lands,
  // at which point the branch below starts the download on its own. `resolveUpdateDecision` only
  // returns this for a FRESH fetch — a stale offline snapshot never locks the player out.
  if (decision.mode === 'pending') {
    logUpdate(`build in progress — waiting for ${decision.info?.pendingVersion ?? 'the new release'}`);
    lockPending('ci-build', decision.info?.pendingVersion);
    return true;
  }
  if (decision.mode === 'required') {
    if (canAutoUpdate()) {
      // Windows or Linux-as-AppImage: run the in-app download → the premium overlay shows the
      // progress bar and the Restart-and-install CTA (Velopack reports download progress on
      // BOTH platforms, so the Linux experience matches Windows).
      logUpdate('update required — starting in-app download');
      push({mode: 'required', error: undefined, pendingReason: undefined});
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
  // Nothing to do — and nothing left to wait for, so the feed budget starts fresh next time.
  platformFeedWaits = 0;
  push({
    mode: fresh !== undefined ? 'upToDate' : 'idle',
    error: undefined,
    pendingVersion: undefined,
    pendingReason: undefined,
  });
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

let downloadActive = false;

/** Check the Velopack feed, download the newest release with progress, and mark it ready to
 *  apply. The download runs in the background; nothing is applied until quitAndInstall. */
async function beginDownload(): Promise<void> {
  // ONE download attempt at a time. The MODE cannot stand in for this latch: it stays 'required'
  // from the moment we decide until Velopack answers the feed check — seconds — and a re-check
  // landing in that window (the menu watch and the waiting poll are independent timers, so they
  // do coincide) would start a SECOND download. Velopack takes a global update lock, so that
  // second call throws and would surface a bogus failure over a healthy download.
  if (downloadActive) {
    return;
  }
  downloadActive = true;
  try {
    await runDownload();
  } finally {
    // Always released, including on an unexpected throw: every state this can leave behind
    // (error / pending / downloaded) must remain retryable or advanceable.
    downloadActive = false;
  }
}

async function runDownload(): Promise<void> {
  logUpdate('beginDownload — checking the Velopack GitHub feed');
  let mgr: UpdateManager;
  try {
    mgr = getManager();
  } catch (err) {
    // The manager itself can't be built (e.g. not a Velopack-managed install). No amount of
    // waiting fixes that, so this is NOT a feed lag — hand over the manual download.
    updateOrManual(err);
    return;
  }
  // PHASE 1 — resolve the package. The gate has already told us we're outdated, so "this channel
  // has nothing newer" is not an answer we accept at face value: it is the EXPECTED window in
  // which the gate legitimately runs ahead of the feed. release.yml creates the release tag in
  // the `windows` job (that tag IS what the gate reads as `latest`) and merges the `linux`
  // channel into it only once the linux job has packed — and the feed proxy caches its asset map
  // for ~2 min on top. Both the "no update" and the 404 shape of that window are a WAIT, not a
  // dead-end. Bounded by PLATFORM_FEED_MAX_WAITS: past that it is a real problem and the manual
  // download is the honest answer.
  let info: UpdateInfo | null;
  try {
    info = await mgr.checkForUpdatesAsync();
  } catch (err) {
    const message = String((err as {message?: string})?.message ?? err);
    if (awaitPlatformFeed(`feed check failed — ${message}`)) {
      return;
    }
    updateOrManual(err);
    return;
  }
  if (info === null) {
    if (awaitPlatformFeed('Velopack reports no update on this channel')) {
      return;
    }
    updateOrManual('No update available on the Velopack feed');
    return;
  }
  // PHASE 2 — the package is really there, so the feed has caught up: release its budget, and
  // treat any failure from here on as a genuine download error (the manifest and the .nupkg URLs
  // resolve from the same proxy cache snapshot, so a mid-download 404 is not a publish lag).
  platformFeedWaits = 0;
  try {
    push({mode: 'downloading', pendingReason: undefined, pendingVersion: undefined, progress: {percent: 0, transferred: 0, total: 0, bytesPerSecond: 0}});
    await mgr.downloadUpdateAsync(info, (perc) => {
      // Velopack reports a single 0..100 percentage; the overlay renders the bar from it
      // (byte totals / speed aren't exposed by the JS binding — shown as 0, hidden by the UI).
      push({mode: 'downloading', progress: {percent: perc, transferred: 0, total: 0, bytesPerSecond: 0}});
    });
    pendingUpdate = info;
    logUpdate('download complete — ready to apply on restart');
    push({mode: 'downloaded'});
    // Nothing left to decide, so don't make the player press a button to get what they are
    // already locked behind: apply it. A download only ever starts from `required`, i.e. the
    // blocking gate is on screen and no session is in progress — so this can't interrupt play.
    // ONLY where the app genuinely comes back on its own, though: where it can merely close
    // (see canRestartAfterUpdate) an unprompted exit reads as a crash, so that path keeps its
    // explicit "Install and close" button. The short beat lets "downloaded → installing" be
    // read rather than flashing past.
    if (canRestartAfterUpdate()) {
      logUpdate('auto-applying the update — the app restarts itself');
      setTimeout(() => applyUpdate(), AUTO_APPLY_DELAY_MS);
    }
  } catch (err) {
    updateOrManual(err);
  }
}

/** Beat between "downloaded" and the automatic restart, so the handover is legible. */
const AUTO_APPLY_DELAY_MS = 1200;
/** Applying is one-way (the process is about to exit) — never let the auto-path and a stray
 *  `desktop:quitAndInstall` both fire `waitExitThenApplyUpdate` for the same update. */
let applying = false;

/**
 * Apply the downloaded update and exit. Shared by the automatic path above and the explicit
 * button, so both platforms behave identically no matter which triggered it.
 */
function applyUpdate(): void {
  if (applying) {
    return;
  }
  if (pendingUpdate === undefined || manager === undefined) {
    updateOrManual('No downloaded update to install');
    return;
  }
  applying = true;
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
        applyFailed(err);
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
    // session. A real install-and-restart with no hang. The marker carries the identity of the
    // AppImage we are running RIGHT NOW (`applying <inode> <mtimeSec>`), so the wrapper can wait
    // for UpdateNix to actually swap the file before relaunching — see restartMarkerStamp for
    // the double-apply race this closes.
    logUpdate('installing (Linux/Velopack) — apply + restart via the wrapper loop');
    setTimeout(() => {
      try {
        fs.writeFileSync(marker, restartMarkerStamp(statRunningAppImage()));
      } catch (err) {
        logUpdate('could not write restart marker — ' + String(err));
      }
      try {
        mgr.waitExitThenApplyUpdate(upd, true, false);
      } catch (err) {
        applyFailed(err);
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
      applyFailed(err);
      return;
    }
    app.quit();
    // Hang-proof: if quit() is ever blocked by a handler, force-exit so the process can never
    // sit spinning — Steam then cleanly returns to the library.
    setTimeout(() => app.exit(0), 3000);
  }, 900);
}

/** An apply that never got off the ground. Release the one-way latch as well as showing the
 *  error, otherwise Try-again would download fine and then silently refuse to install. */
function applyFailed(err: unknown): void {
  applying = false;
  updateOrManual(err);
}

/** Wire the IPC the preload's desktopBridge calls. Call once, after app ready. */
export function registerUpdateIpc(): void {
  ipcMain.handle('desktop:getUpdateState', () => state);
  // Retry from ANY blocked state: re-runs the whole check (network back → maybe unblock;
  // still required → re-arm the download; feed error → re-attempt). Also what the main menu
  // calls on entry + on its timer, so a player can pick an update up just by leaving a game.
  ipcMain.handle('desktop:recheck', () => runCheck().then(() => state));
  // The explicit CTA. Restart-capable platforms apply automatically the moment the download
  // lands, so in practice this serves the install-and-close path (and any impatient press).
  ipcMain.handle('desktop:quitAndInstall', () => applyUpdate());
  ipcMain.handle('desktop:openDownload', () => {
    if (state.downloadUrl !== undefined) {
      void shell.openExternal(state.downloadUrl);
    }
  });
}
