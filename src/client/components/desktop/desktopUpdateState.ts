import {reactive} from 'vue';

/**
 * Renderer-side desktop update state (Phase 7). Fed over IPC from the Electron main
 * process (electron/update.ts). The `DesktopUpdateState` shape is DUPLICATED from
 * electron/update.ts — keep them in sync (the renderer must not import electron/).
 *
 * On the web there is no `window.desktopBridge`, so everything here is inert and the
 * overlay never renders — the web app never depends on Electron.
 */

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
  /** Runtime platform (from the main process) — drives platform-specific overlay guidance
   *  such as the Linux/Steam Deck "reopen from Steam" instruction. Mirrors electron/update.ts. */
  platform?: string;
  /** True when the app installs AND restarts itself (Windows, or Linux via the restart-loop
   *  wrapper) → "Restart and install"; false → "Install and close". Mirrors electron/update.ts. */
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
   *  `platform-feed` (published, but this platform's package hasn't landed on the feed yet).
   *  Wording only; the lock is identical. Mirrors electron/update.ts. */
  pendingReason?: 'ci-build' | 'platform-feed';
}

/** Steam Deck installer-freshness notice, pulled once from the main process. Mirrors
 *  electron/installerCheck.ts `InstallerNotice`. */
export interface InstallerNotice {
  stale: boolean;
  reason?: 'installer-changed' | 'legacy-wrapper';
  installerUrl?: string;
}

/** Result of the in-app "Add to Steam library" action (mirrors electron/steamShortcut.ts). */
export interface AddToSteamResult {
  ok: boolean;
  reason?: string;
  profiles?: number;
  appId?: number;
}

/** Steam shortcut state pulled from the main process (mirrors electron/main.ts getSteamState). */
export interface SteamState {
  /** The Non-Steam shortcut is already registered in a Steam profile on this machine. */
  added: boolean;
  /** The user chose "Not now" on the first-run prompt — never ask again. */
  dismissed: boolean;
  /** This is the first launch after install (VELOPACK_FIRSTRUN). */
  firstRun: boolean;
}

interface DesktopBridge {
  desktopMode: boolean;
  /** Runtime OS from the main process ('win32' | 'linux' | 'darwin') — OPTIONAL (older shells
   *  predate it; the renderer feature-detects). Gates Windows-only UI like Add-to-Steam. */
  platform?: string;
  getVersion(): Promise<string>;
  openExternal(url: string): Promise<void>;
  getUpdateState(): Promise<DesktopUpdateState | undefined>;
  onUpdateState(cb: (state: DesktopUpdateState) => void): void;
  recheck(): Promise<DesktopUpdateState>;
  quitAndInstall(): Promise<void>;
  openDownload(): Promise<void>;
  // Steam Deck installer-freshness notice — OPTIONAL (older installed shells predate it;
  // the renderer feature-detects and simply shows no warning when absent).
  getInstallerNotice?(): Promise<InstallerNotice | undefined>;
  // In-app "Add to Steam library" (Windows) — OPTIONAL: replaces the removed NSIS finish-page
  // checkbox. Registers the Non-Steam shortcut + artwork for the installed exe. Absent on older
  // shells / the web; the renderer feature-detects and hides the button.
  addToSteam?(): Promise<AddToSteamResult | undefined>;
  // Steam shortcut state (added / dismissed / firstRun) — OPTIONAL, Windows-only. Drives the
  // first-run prompt gate and the button visibility (hidden once added).
  getSteamState?(): Promise<SteamState | undefined>;
  // Persist the "Not now" first-run choice so the prompt never returns. OPTIONAL.
  dismissSteamPrompt?(): Promise<void>;
  // Console-native pre-game shell (P10) — OPTIONAL: an older installed
  // shell may predate them; the renderer feature-detects (runtimeMode.ts)
  // and hides the affordances when absent.
  quitApp?(): Promise<void>;
  setFullscreen?(value: boolean): Promise<void>;
  // TV display-profile diagnostics (TV-3) — OPTIONAL: the Electron view of
  // the display the window sits on (bounds / scaleFactor / physical size /
  // internal-vs-external / fullscreen). The profile heuristic itself runs
  // on renderer signals (works on the web too); this feeds the System-menu
  // diagnostics + the decision log with the authoritative panel data.
  getDisplayInfo?(): Promise<DesktopDisplayInfo | undefined>;
}

export interface DesktopDisplayInfo {
  bounds: {x: number, y: number, width: number, height: number};
  workArea: {x: number, y: number, width: number, height: number};
  scaleFactor: number;
  physicalWidth: number;
  physicalHeight: number;
  internal: boolean;
  label: string;
  fullscreen: boolean;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridge;
  }
}

export function desktopBridge(): DesktopBridge | undefined {
  try {
    return window.desktopBridge;
  } catch {
    return undefined;
  }
}

export function isDesktop(): boolean {
  return desktopBridge()?.desktopMode === true;
}

export const desktopUpdateState = reactive<DesktopUpdateState>({
  mode: 'idle',
  currentVersion: '',
});

let initialized = false;

/** Subscribe to main-process update pushes + pull the current state. Idempotent. */
export function initDesktopUpdates(): void {
  const bridge = desktopBridge();
  if (bridge === undefined || initialized) {
    return;
  }
  initialized = true;
  bridge.onUpdateState((s) => {
    if (s !== undefined && s !== null) {
      Object.assign(desktopUpdateState, s);
    }
  });
  void bridge
    .getUpdateState()
    .then((s) => {
      if (s !== undefined && s !== null) {
        Object.assign(desktopUpdateState, s);
      }
    })
    .catch(() => undefined);
}

/** True while the overlay must COVER the screen (a mandatory update blocks the game). `pending`
 *  covers too: a build in flight means the installed version is ALREADY outdated and would be
 *  force-updated the moment that release lands, so the player waits for it and updates once
 *  instead of starting a session they are about to be kicked out of. Mirrors the main process's
 *  `updateBlocksGame`. */
export function updateOverlayBlocking(mode: DesktopUpdateMode): boolean {
  return (
    mode === 'required' ||
    mode === 'pending' ||
    mode === 'downloading' ||
    mode === 'downloaded' ||
    mode === 'installing' ||
    mode === 'offlineBlocked' ||
    mode === 'manualDownloadRequired' ||
    mode === 'error'
  );
}

/**
 * True while the full-cover desktop-update gate owns the screen. The two
 * console input ROUTERS (GamepadLayer + consoleKeyBridge) read this and route
 * input EXCLUSIVELY to the overlay — never to the pre-game screen behind it
 * (which would otherwise fire a menu item like Continue: the "A applies the
 * update AND triggers Continue" bug). A non-blocking pill never gates.
 */
export function desktopUpdateBlocking(): boolean {
  return isDesktop() && updateOverlayBlocking(desktopUpdateState.mode);
}

/**
 * Click the primary action of the blocking update overlay — the keyboard gate
 * (Steam Input can emulate Enter on the Deck). The gamepad gate goes through
 * the focus engine (ring + click); this is the direct keyboard equivalent.
 */
export function clickDesktopUpdatePrimary(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.querySelector<HTMLElement>('.desktop-update--cover .desktop-update__btn--primary')?.click();
}
