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
  latestVersion?: string;
  minSupportedVersion?: string;
  releaseNotes?: Array<string>;
  progress?: {percent: number; transferred: number; total: number; bytesPerSecond: number};
  error?: string;
  downloadUrl?: string;
}

interface DesktopBridge {
  desktopMode: boolean;
  getVersion(): Promise<string>;
  openExternal(url: string): Promise<void>;
  getUpdateState(): Promise<DesktopUpdateState | undefined>;
  onUpdateState(cb: (state: DesktopUpdateState) => void): void;
  recheck(): Promise<DesktopUpdateState>;
  quitAndInstall(): Promise<void>;
  openDownload(): Promise<void>;
  // Console-native pre-game shell (P10) — OPTIONAL: an older installed
  // shell may predate them; the renderer feature-detects (runtimeMode.ts)
  // and hides the affordances when absent.
  quitApp?(): Promise<void>;
  setFullscreen?(value: boolean): Promise<void>;
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

/** True while the overlay must COVER the screen (a mandatory update blocks the game). */
export function updateOverlayBlocking(mode: DesktopUpdateMode): boolean {
  return (
    mode === 'required' ||
    mode === 'downloading' ||
    mode === 'downloaded' ||
    mode === 'installing' ||
    mode === 'offlineBlocked' ||
    mode === 'manualDownloadRequired' ||
    mode === 'error'
  );
}
