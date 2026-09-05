/*
 * PRE-GAME ZOOM CARVE-OUT — the menu-side twin of the shell's «the fullscreen
 * viewer owns the pad completely while open» rule (ConsoleShell.handleIntent
 * runs its zoom branch BEFORE any surface routing).
 *
 * Outside a game the console intent slot belongs to a pre-game SCREEN
 * (installMenuPad), and the shared fullscreen viewer is served by the
 * App-level ConsoleMenuZoomHost instead of the shell. The host registers its
 * intent handler here; `installMenuPad` consults this bridge BEFORE the
 * screen's own handler — so no pre-game screen ever needs (or is allowed) a
 * zoom branch of its own. This is what makes «X = осмотреть» one pipeline:
 * a screen calls `openConsoleCardZoom(...)` and input, presentation and the
 * physical lift are somebody else's guaranteed job, exactly like in-game.
 *
 * The handler contract: return true ⇔ the viewer is open and consumed the
 * intent. While no viewer is open the bridge answers false and the screen
 * handler runs untouched.
 */

import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

type MenuZoomHandler = (intent: GamepadIntent) => boolean;

let handler: MenuZoomHandler | undefined;

/** Register the pre-game zoom host's intent handler (single owner). */
export function setMenuZoomIntentHandler(fn: MenuZoomHandler): () => void {
  handler = fn;
  return () => {
    if (handler === fn) {
      handler = undefined;
    }
  };
}

/** True ⇔ the pre-game fullscreen viewer consumed the intent. */
export function menuZoomIntent(intent: GamepadIntent): boolean {
  return handler !== undefined ? handler(intent) : false;
}
