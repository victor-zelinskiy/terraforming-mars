// Gamepad-driven virtual mouse cursor for the DevTools window (F12) — Steam Machine /
// Steam Deck have no physical mouse, so the detached DevTools window was visible but
// un-navigable from the pad. STRICTLY scoped to DevTools: nothing here touches the game
// renderer, its gamepad layer, or any non-DevTools surface — the module only acts between
// `devtools-opened` and `devtools-closed`, and only on `devToolsWebContents`.
//
// How it works (two halves):
//  1. A tiny script is injected into the DevTools FRONTEND page (chrome-devtools:// is an
//     ordinary web page): it draws a cursor arrow (a pointer-events:none fixed div) and
//     reads `navigator.getGamepads()` IN THE DEVTOOLS CONTEXT — the detached DevTools
//     window is the focused document while the player uses it, so that's where Chromium
//     delivers gamepad input (the game window is blurred and its own pad layer idles —
//     no double-handling by construction).
//  2. The main process runs a ~60 Hz loop: one executeJavaScript round-trip per tick
//     (`__tmPad.frame(x, y)` — draws the cursor at the position main computed, returns the
//     fresh pad state), integrates the stick into a cursor position, and synthesizes REAL
//     input via `devToolsWebContents.sendInputEvent` — trusted events, so hover
//     highlighting, clicks, context menus and wheel scrolling behave exactly like a
//     physical mouse (an injected untrusted DOM event could not scroll natively).
//
// Controls: left stick — move (quadratic curve for precision), A — left click (hold =
// drag), X — right click (DevTools context menus), right stick — scroll under the cursor.
// No gamepad connected → the cursor hides and the loop sends nothing; on Windows with a
// real mouse the module is inert unless a pad actually moves.

import type {BrowserWindow, WebContents} from 'electron';

/** Pad state returned by the injected `__tmPad.frame()` (one tick's readings). */
export interface PadFrame {
  ok: boolean;
  w: number;
  h: number;
  ax?: number;
  ay?: number;
  scroll?: number;
  btnA?: boolean;
  btnX?: boolean;
  /** Monotonic counter — bumped each time the DevTools "Экспорт консоли" button is clicked. */
  exportReq?: number;
}

/** One synthesized input action (the pure step function's output, unit-testable). */
export type PadAction =
  | {type: 'move', x: number, y: number}
  | {type: 'down', x: number, y: number, button: 'left' | 'right'}
  | {type: 'up', x: number, y: number, button: 'left' | 'right'}
  | {type: 'wheel', x: number, y: number, deltaY: number};

export interface PadCursorState {
  x: number;
  y: number;
  aHeld: boolean;
  xHeld: boolean;
}

/** Max cursor speed in px per tick (~60 ticks/s → ~1100 px/s at full deflection). */
const MAX_SPEED = 18;
/** Wheel px per tick at full right-stick deflection. */
const SCROLL_SPEED = 42;
const TICK_MS = 16;

/**
 * PURE per-tick step: integrate the stick into the cursor position (quadratic response
 * curve — precise near the centre, fast at full deflection), clamp to the DevTools
 * viewport, and derive the input events to synthesize (move / click edges / wheel).
 * Kept side-effect-free so the mapping is unit-testable without Electron.
 */
export function padCursorStep(state: PadCursorState, frame: PadFrame): {next: PadCursorState, actions: PadAction[]} {
  const actions: PadAction[] = [];
  if (!frame.ok) {
    // Pad gone mid-hold: release a stuck button so DevTools never keeps a phantom drag.
    if (state.aHeld) {
      actions.push({type: 'up', x: state.x, y: state.y, button: 'left'});
    }
    if (state.xHeld) {
      actions.push({type: 'up', x: state.x, y: state.y, button: 'right'});
    }
    return {next: {...state, aHeld: false, xHeld: false}, actions};
  }
  const curve = (v: number): number => v * Math.abs(v); // quadratic, sign-preserving
  const ax = curve(frame.ax ?? 0);
  const ay = curve(frame.ay ?? 0);
  const x = Math.min(Math.max(state.x + ax * MAX_SPEED, 0), Math.max(frame.w - 1, 0));
  const y = Math.min(Math.max(state.y + ay * MAX_SPEED, 0), Math.max(frame.h - 1, 0));
  const moved = x !== state.x || y !== state.y;
  if (moved) {
    actions.push({type: 'move', x, y});
  }
  const a = frame.btnA === true;
  const xa = frame.btnX === true;
  if (a !== state.aHeld) {
    actions.push({type: a ? 'down' : 'up', x, y, button: 'left'});
  }
  if (xa !== state.xHeld) {
    actions.push({type: xa ? 'down' : 'up', x, y, button: 'right'});
  }
  const scroll = curve(frame.scroll ?? 0);
  if (scroll !== 0) {
    actions.push({type: 'wheel', x, y, deltaY: -scroll * SCROLL_SPEED});
  }
  return {next: {x, y, aHeld: a, xHeld: xa}, actions};
}

// The injected DevTools-side half. Idempotent (a re-open re-injects safely). The deadzone
// lives HERE so a drifting stick costs zero executeJavaScript→sendInputEvent traffic.
// Standard-mapping pad: axes 0/1 = left stick, 3 = right stick Y; buttons 0 = A, 2 = X.
const BOOTSTRAP = `(() => {
  if (window.__tmPad) return true;
  const cur = document.createElement('div');
  cur.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;' +
    'display:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.65));will-change:transform;';
  cur.innerHTML = '<svg width="17" height="24" viewBox="0 0 17 24">' +
    '<path d="M1 1 L1 19 L5.5 15.2 L8.4 22 L11.4 20.6 L8.6 13.9 L14.6 13.4 Z" ' +
    'fill="#f5f7fa" stroke="#1c2733" stroke-width="1.3"/></svg>';
  document.documentElement.appendChild(cur);

  // "Экспорт консоли" button — clicked with the pad cursor (a real, trusted mouse click), so
  // its onclick fires like a mouse would. Bumps a counter the main loop watches; main writes the
  // file and calls __tmExportDone to flash the result on the button.
  window.__tmExportReq = 0;
  const btn = document.createElement('button');
  btn.textContent = '\\u2b07 Экспорт консоли';
  btn.style.cssText = 'position:fixed;top:40px;right:12px;z-index:2147483646;' +
    'font:600 12px system-ui,sans-serif;color:#eaf2ff;background:#1d2c3a;' +
    'border:1px solid #3d566e;border-radius:6px;padding:6px 11px;cursor:pointer;' +
    'box-shadow:0 2px 8px rgba(0,0,0,.5);opacity:.92;';
  btn.onmouseenter = () => { btn.style.background = '#264057'; };
  btn.onmouseleave = () => { btn.style.background = '#1d2c3a'; };
  btn.onclick = () => { window.__tmExportReq = (window.__tmExportReq | 0) + 1; };
  document.documentElement.appendChild(btn);
  let toastTimer = 0;
  window.__tmExportDone = (ok, msg) => {
    btn.textContent = ok ? '\\u2705 ' + (msg || 'Сохранено') : '\\u26a0 ' + (msg || 'Ошибка');
    btn.style.borderColor = ok ? '#3ba55d' : '#c04747';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      btn.textContent = '\\u2b07 Экспорт консоли';
      btn.style.borderColor = '#3d566e';
    }, 4000);
  };

  const DEAD = 0.24;
  const flt = (v) => Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD);
  window.__tmPad = {
    frame(x, y) {
      let p = null;
      try {
        for (const g of navigator.getGamepads()) {
          if (g && g.connected) { p = g; break; }
        }
      } catch (e) { /* gamepad API unavailable */ }
      cur.style.display = p ? 'block' : 'none';
      cur.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      const base = {w: innerWidth, h: innerHeight, exportReq: window.__tmExportReq | 0};
      if (!p) return Object.assign({ok: false}, base);
      return Object.assign({
        ok: true,
        ax: flt(p.axes[0] || 0), ay: flt(p.axes[1] || 0), scroll: flt(p.axes[3] || 0),
        btnA: !!(p.buttons[0] && p.buttons[0].pressed),
        btnX: !!(p.buttons[2] && p.buttons[2].pressed),
      }, base);
    },
  };
  return true;
})()`;

function sendAction(dtc: WebContents, action: PadAction): void {
  switch (action.type) {
  case 'move':
    dtc.sendInputEvent({type: 'mouseMove', x: action.x, y: action.y});
    break;
  case 'down':
    dtc.sendInputEvent({type: 'mouseDown', x: action.x, y: action.y, button: action.button, clickCount: 1});
    break;
  case 'up':
    dtc.sendInputEvent({type: 'mouseUp', x: action.x, y: action.y, button: action.button, clickCount: 1});
    break;
  case 'wheel':
    dtc.sendInputEvent({type: 'mouseWheel', x: action.x, y: action.y, deltaX: 0, deltaY: action.deltaY, canScroll: true});
    break;
  }
}

/** Result of the DevTools "Экспорт консоли" action, echoed back onto the button. */
export interface DevtoolsExportResult {
  ok: boolean;
  path?: string;
  error?: string;
}

export interface DevtoolsPadCursorOptions {
  /** Called when the injected "Экспорт консоли" button is clicked; resolves with the outcome
   *  so the button can flash the saved path / an error. */
  onExport?: () => Promise<DevtoolsExportResult>;
}

/**
 * Wire the pad-cursor to a window's DevTools lifecycle. Call once after the
 * BrowserWindow is created; everything else is self-managed (starts on
 * devtools-opened, stops on devtools-closed / window close).
 */
export function installDevtoolsPadCursor(win: BrowserWindow, options: DevtoolsPadCursorOptions = {}): void {
  let timer: ReturnType<typeof setInterval> | undefined;
  let inFlight = false;
  let lastExportReq = 0;
  let exporting = false;
  let state: PadCursorState = {x: 80, y: 80, aHeld: false, xHeld: false};

  // Basename only — the DevTools toast shows a short label, not the full path.
  const shortPath = (p: string | undefined): string =>
    p === undefined ? 'Сохранено' : (p.split(/[\\/]/).pop() ?? p);

  const stop = (): void => {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
    inFlight = false;
  };

  const start = (): void => {
    stop();
    const dtc = win.webContents.devToolsWebContents;
    if (dtc === null) {
      // devtools-opened can fire a beat before devToolsWebContents materializes.
      setTimeout(() => {
        if (win.webContents.isDevToolsOpened()) {
          start();
        }
      }, 120);
      return;
    }
    state = {x: 80, y: 80, aHeld: false, xHeld: false};
    lastExportReq = 0;
    void dtc.executeJavaScript(BOOTSTRAP).catch(() => {/* frontend not ready — the tick retries */});
    timer = setInterval(() => {
      if (inFlight || dtc.isDestroyed()) {
        if (dtc.isDestroyed()) {
          stop();
        }
        return;
      }
      inFlight = true;
      dtc.executeJavaScript(`window.__tmPad ? __tmPad.frame(${state.x}, ${state.y}) : ${BOOTSTRAP} && null`)
        .then((frame: PadFrame | null) => {
          inFlight = false;
          if (frame === null || typeof frame !== 'object') {
            return;
          }
          const {next, actions} = padCursorStep(state, frame);
          state = next;
          for (const action of actions) {
            sendAction(dtc, action);
          }
          // Export-button edge: the injected counter went up → run the export once and echo
          // the result onto the button. `exporting` guards against a re-trigger while the
          // (async) write is in flight.
          const req = Number(frame.exportReq ?? 0);
          if (req > lastExportReq && options.onExport !== undefined && !exporting) {
            lastExportReq = req;
            exporting = true;
            void options.onExport()
              .then((res) => {
                const label = res.ok ? shortPath(res.path) : (res.error ?? 'Ошибка');
                return dtc.isDestroyed() ? undefined : dtc.executeJavaScript(
                  `window.__tmExportDone && __tmExportDone(${res.ok ? 'true' : 'false'}, ${JSON.stringify(label)})`);
              })
              .catch(() => {/* frontend gone */})
              .finally(() => {
                exporting = false;
              });
          } else if (req > lastExportReq) {
            lastExportReq = req; // no handler wired — swallow so it can't re-fire
          }
        })
        .catch(() => {
          inFlight = false; // frontend navigating / closing — just skip the tick
        });
    }, TICK_MS);
  };

  win.webContents.on('devtools-opened', start);
  win.webContents.on('devtools-closed', stop);
  win.on('closed', stop);
}
