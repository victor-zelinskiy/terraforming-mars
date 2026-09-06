// CURTAIN OVERLAY — a persistent WebContentsView the main process holds above
// the game's webContents for the game-boundary reload.
//
// WHY: the in-page curtain dies with its document. Chromium's paint holding
// freezes the old page's last frame until the new document's first paint, and
// the static #boot-curtain covers the parse→mount window — but both are STILLS
// or main-thread-coupled surfaces. This overlay renders the SAME `.con-load`
// composition (assets/curtain-overlay.html, same styles.css) in its OWN
// renderer process, so the orbital sweep keeps animating through teardown,
// navigation and bundle parse. The renderer director shows it right before
// `location.assign` and drops it at the next page's reveal; because every
// curtain surface computes its orbit phase from the wall clock, the pixels
// above and below agree and both handoffs are invisible.
//
// SAFETY: the overlay is strictly best-effort — every hold is bounded.
//  - show waits for a bounded «painted» ack (the caller also bounds it);
//  - a shown overlay auto-hides on a hard watchdog, on the main frame's
//    did-fail-load and on a renderer crash — the in-page curtain (or its
//    error state) always stands beneath as the honest fallback;
//  - the overlay is never focused; the game webContents keeps input.
//
// The view is created ONCE at startup and kept (hidden) for the whole session:
// a WebContentsView added mid-load flickers before its first paint (electron
// #47351), and a pre-warmed view also keeps fonts/CSS decoded.

import {BrowserWindow, WebContentsView, ipcMain} from 'electron';
import * as path from 'path';

/** A shown overlay with no hide from the renderer is a stall — the in-page
 *  boot watchdog (45 s) has already become the error state by this point. */
const SHOW_WATCHDOG_MS = 60_000;
/** Bounded wait for the overlay's «painted» ack inside the show invoke. */
const PAINT_ACK_MAX_MS = 150;

let owner: BrowserWindow | undefined;
let view: WebContentsView | undefined;
let watchdog: ReturnType<typeof setTimeout> | undefined;
let paintedResolve: (() => void) | undefined;
let lastPayload: unknown;
let ipcRegistered = false;

function alive(): boolean {
  return owner !== undefined && !owner.isDestroyed() && view !== undefined && !view.webContents.isDestroyed();
}

function syncBounds(): void {
  if (!alive()) {
    return;
  }
  const {width, height} = owner!.getContentBounds();
  view!.setBounds({x: 0, y: 0, width, height});
}

function hideOverlay(): void {
  if (watchdog !== undefined) {
    clearTimeout(watchdog);
    watchdog = undefined;
  }
  if (!alive()) {
    return;
  }
  view!.setVisible(false);
  // Tell the page (it parks its text-policy timers, and diagnostics/e2e read
  // this — `document.visibilityState` does NOT track setVisible).
  view!.webContents.send('curtain:visible', false);
  // The game surface must own input again (it was never given away on show,
  // but a stray click on the overlay could have moved focus).
  owner!.webContents.focus();
}

function showOverlay(payload: unknown): Promise<void> {
  if (!alive()) {
    return Promise.resolve();
  }
  lastPayload = payload;
  syncBounds();
  view!.webContents.send('curtain:state', payload);
  view!.webContents.send('curtain:visible', true);
  // Re-adding an existing child moves it to the TOP of the sibling order.
  owner!.contentView.addChildView(view!);
  view!.setVisible(true);
  owner!.webContents.focus();
  if (watchdog !== undefined) {
    clearTimeout(watchdog);
  }
  watchdog = setTimeout(hideOverlay, SHOW_WATCHDOG_MS);
  return new Promise<void>((resolve) => {
    const done = (): void => {
      if (paintedResolve === resolve) {
        paintedResolve = undefined;
      }
      resolve();
    };
    paintedResolve = done;
    setTimeout(done, PAINT_ACK_MAX_MS);
  });
}

/**
 * Create the overlay view for `win` and register its IPC. Call once per main
 * window, after `loadURL` — the overlay loads in parallel with the app.
 */
export function installCurtainOverlay(win: BrowserWindow, overlayUrl: string): void {
  owner = win;
  view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'curtainPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      // The overlay animates precisely while it is the only thing on screen —
      // never let occlusion heuristics throttle it.
      backgroundThrottling: false,
    },
  });
  // Opaque — matches the curtain's deep-space base; the known WebContentsView
  // rendering bugs are all on the TRANSPARENT path, which we never take.
  view.setBackgroundColor('#05070c');
  view.setVisible(false);
  win.contentView.addChildView(view);
  syncBounds();
  void view.webContents.loadURL(overlayUrl);

  // The overlay page re-registers its listener on reload; re-send the last
  // state so a mid-transition recovery still shows the right composition.
  view.webContents.on('did-finish-load', () => {
    if (lastPayload !== undefined) {
      view?.webContents.send('curtain:state', lastPayload);
    }
  });
  view.webContents.on('render-process-gone', () => {
    // Best-effort recovery; if it fails the overlay simply never shows again
    // and the in-page curtain carries every future boundary.
    try {
      view?.webContents.reload();
    } catch {
      // view unusable — leave it hidden
    }
  });
  view.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  view.webContents.on('will-navigate', (event) => event.preventDefault());

  // Geometry follows the window for the overlay's whole life.
  win.on('resize', syncBounds);
  win.on('enter-full-screen', syncBounds);
  win.on('leave-full-screen', syncBounds);

  // Failure funnels — a covered failure surface is worse than a visible one.
  win.webContents.on('did-fail-load', (_event, _code, _desc, _url, isMainFrame) => {
    if (isMainFrame) {
      hideOverlay();
    }
  });
  win.webContents.on('render-process-gone', hideOverlay);
  win.on('closed', () => {
    if (watchdog !== undefined) {
      clearTimeout(watchdog);
      watchdog = undefined;
    }
    owner = undefined;
    view = undefined;
  });

  if (!ipcRegistered) {
    ipcRegistered = true;
    ipcMain.handle('desktop:curtainShow', (event, payload: unknown) => {
      // Only the game surface may drive the curtain.
      if (owner === undefined || event.sender !== owner.webContents) {
        return Promise.resolve();
      }
      return showOverlay(payload);
    });
    ipcMain.handle('desktop:curtainHide', (event) => {
      if (owner === undefined || event.sender !== owner.webContents) {
        return;
      }
      hideOverlay();
    });
    ipcMain.on('curtain:painted', (event) => {
      if (view !== undefined && event.sender === view.webContents) {
        paintedResolve?.();
      }
    });
  }
}
