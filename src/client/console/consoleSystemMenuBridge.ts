/*
 * THE SYSTEM-MENU INPUT SEAM — how the KEYBOARD reaches the console system
 * overlay (Menu button on a pad).
 *
 * The overlay is owned by `GamepadLayer`, which sits on the RAW gamepad intent
 * stream (`onGamepadIntent`) — deliberately, since the Menu button's hold gesture
 * toggles the console ↔ desktop shell. The keyboard fallback, however, flows
 * through `consoleKeyBridge` → `dispatchConsoleIntent`, i.e. the console ROUTER,
 * which GamepadLayer is not part of. The consequence, until this seam existed:
 * a keyboard player in console mode could not open the system overlay at all —
 * so in-game they could reach neither the settings nor «В главное меню».
 *
 * Two halves, and BOTH are needed:
 *  · opening it (the Menu key), and
 *  · owning input WHILE it is open — otherwise the arrows and Enter would fall
 *    through to the board behind the overlay, which is worse than not opening
 *    it. The registered handler answers `true` for everything it consumed, and
 *    the key bridge asks it BEFORE the router.
 *
 * Nothing here touches the gamepad path: pads keep going straight to
 * GamepadLayer, so there is exactly one owner and no double handling.
 */

import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

type SystemMenuInput = (intent: GamepadIntent) => boolean;

let handler: SystemMenuInput | undefined;

/** GamepadLayer registers on mount and clears on unmount (undefined). */
export function setConsoleSystemMenuInput(input: SystemMenuInput | undefined): void {
  handler = input;
}

/** Offer an intent to the system overlay. True = consumed; do not route on. */
export function consoleSystemMenuIntent(intent: GamepadIntent): boolean {
  return handler?.(intent) ?? false;
}
