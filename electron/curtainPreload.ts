// Preload of the CURTAIN OVERLAY page (assets/curtain-overlay.html) — the
// narrowest possible bridge: receive the render recipe, report «painted».
// Sandboxed; exposes nothing else. See electron/curtainOverlay.ts.

import {contextBridge, ipcRenderer} from 'electron';

contextBridge.exposeInMainWorld('curtainHost', {
  onState: (cb: (state: unknown) => void): void => {
    ipcRenderer.on('curtain:state', (_event, state) => cb(state));
  },
  // True on show, false on hide — `document.visibilityState` does NOT track
  // WebContentsView.setVisible, so the page needs the explicit signal (it
  // parks its timers while hidden; diagnostics read it too).
  onVisible: (cb: (visible: boolean) => void): void => {
    ipcRenderer.on('curtain:visible', (_event, visible) => cb(visible === true));
  },
  painted: (): void => {
    ipcRenderer.send('curtain:painted');
  },
});
