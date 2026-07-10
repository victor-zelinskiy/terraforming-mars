/*
 * Pre-game console pad bridge — the state-based input spine of the
 * console-native LIFECYCLE screens (main menu / create game / game lists).
 *
 * In console mode the in-game shell (ConsoleShell) registers the single
 * console intent handler; OUTSIDE the game that slot is free and the pre-game
 * screens claim it here. The screens therefore receive the SAME semantic
 * `GamepadIntent` stream GamepadLayer dispatches (Menu/system handled a level
 * above, exactly like in-game), and navigation is pure SCREEN STATE — the DOM
 * focus engine never drives these screens (its fallback only ever sees
 * intents while NO pre-game screen is mounted).
 *
 * KEYBOARD (foundation rework): the desktop fallback no longer lives here —
 * the GLOBAL consoleKeyBridge (installed by GamepadLayer while console mode
 * is on) synthesizes keyboard into the same intent stream and dispatches
 * through the same slot, for pre-game AND in-game screens alike. The one map
 * lives in consoleActionModel.ts. This module keeps owning:
 *  - `menuPadState.mounted` — GamepadLayer hides its generic hint bar while a
 *    pre-game console screen renders its own command bar;
 *  - `menuPadState.textEntry` — the ONE sanctioned DOM-input fallback (name
 *    entry). While armed, the key bridge goes silent (letters belong to the
 *    input) and pad intents still flow to the screen handler, which routes
 *    them to the entry overlay (A = save, B = cancel).
 */

import {reactive} from 'vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {registerConsoleIntentHandler} from '@/client/console/consoleRouter';
import {desktopUpdateBlocking} from '@/client/components/desktop/desktopUpdateState';

export type MenuPadHandler = (intent: GamepadIntent) => boolean;

export const menuPadState = reactive({
  /** >0 while a pre-game console screen owns input (counter — screen switches overlap). */
  mountedCount: 0,
  /** True while the name-entry overlay owns the physical keyboard. */
  textEntry: false,
});

export function menuPadMounted(): boolean {
  return menuPadState.mountedCount > 0;
}

/**
 * Claim the console intent slot for one pre-game screen. Returns the
 * uninstall fn (call in beforeUnmount). The handler contract is the console
 * one: return true when consumed (pre-game screens normally consume
 * everything — there is no surface below them to fall through to).
 * Keyboard arrives through the global consoleKeyBridge — same stream.
 */
export function installMenuPad(handler: MenuPadHandler): () => void {
  // YIELD to an App-level BLOCKING desktop-update gate: while it covers the
  // screen, return false so GamepadLayer falls through to the DOM focus engine
  // (which scopes to `.desktop-update--cover`, driving the update buttons) —
  // otherwise the pre-game handler would eat A and fire a menu item (Continue)
  // behind the overlay. A non-blocking update pill never yields.
  const gated: MenuPadHandler = (intent) => (desktopUpdateBlocking() ? false : handler(intent));
  const offIntent = registerConsoleIntentHandler(gated);
  menuPadState.mountedCount++;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    offIntent();
    menuPadState.mountedCount = Math.max(0, menuPadState.mountedCount - 1);
    menuPadState.textEntry = false;
  };
}
