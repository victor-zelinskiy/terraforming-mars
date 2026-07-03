// Electron 43 — Phase 1 preload (the ONLY renderer↔main bridge).
//
// Runs sandboxed (sandbox: true). It may use only `contextBridge` + a narrow
// `ipcRenderer`; it has NO broad Node access and exposes NONE to the renderer.
// It does two things:
//   1. re-publishes window.tmRuntimeConfig so the renderer's existing
//      src/client/utils/runtimeConfig.ts seam picks up apiBase/wsBase/participantId;
//   2. exposes a minimal window.desktopBridge stub (desktopMode/getVersion/openExternal).
//
// The config arrives via process.argv (additionalArguments from main) — the
// standard way to hand data to a sandboxed preload without extra IPC.

import {contextBridge, ipcRenderer} from 'electron';

interface TMRuntimeConfig {
  apiBase?: string;
  wsBase?: string;
  participantId?: string;
}

function readRuntimeConfig(): TMRuntimeConfig {
  const prefix = '--tm-runtime-config=';
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (arg === undefined) {
    return {};
  }
  try {
    return JSON.parse(arg.slice(prefix.length)) as TMRuntimeConfig;
  } catch {
    return {};
  }
}

// Consumed by runtimeConfig.ts (`window.tmRuntimeConfig ?? {}`); stays optional
// so the web app never depends on it.
contextBridge.exposeInMainWorld('tmRuntimeConfig', readRuntimeConfig());

// Narrow desktop bridge. No raw ipcRenderer, no require, no fs/path/shell.
// desktopMode lets the renderer gate desktop-only UI (the update overlay) without
// learning anything else about Electron. The update-* methods are thin
// ipcRenderer.invoke/on wrappers backed by electron/update.ts (Phase 7).
contextBridge.exposeInMainWorld('desktopBridge', {
  desktopMode: true,
  getVersion: (): Promise<string> => ipcRenderer.invoke('desktop:getVersion'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('desktop:openExternal', url),
  // Premium updater (Phase 7).
  getUpdateState: (): Promise<unknown> => ipcRenderer.invoke('desktop:getUpdateState'),
  onUpdateState: (cb: (state: unknown) => void): void => {
    ipcRenderer.on('desktop:update-state', (_event, state) => cb(state));
  },
  recheck: (): Promise<unknown> => ipcRenderer.invoke('desktop:recheck'),
  quitAndInstall: (): Promise<void> => ipcRenderer.invoke('desktop:quitAndInstall'),
  openDownload: (): Promise<void> => ipcRenderer.invoke('desktop:openDownload'),
  // Console-native pre-game shell (P10): the ВЫЙТИ confirm + native
  // fullscreen restore. Thin invoke wrappers — no raw ipcRenderer leaks.
  quitApp: (): Promise<void> => ipcRenderer.invoke('desktop:quitApp'),
  setFullscreen: (value: boolean): Promise<void> => ipcRenderer.invoke('desktop:setFullscreen', value === true),
});
