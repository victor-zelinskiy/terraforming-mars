/*
 * CONSOLE KEY BRIDGE — the ONE keyboard→intent adapter of the console flow
 * (foundation layer; CONSOLE_FOUNDATION.md §2).
 *
 * Installed by GamepadLayer while console mode is ENABLED (watch on
 * `consoleModeState.enabled`), so EVERY console surface — pre-game menu,
 * create game, the in-game shell, its task hosts — gets the same desktop
 * keyboard fallback through the same slot the gamepad already dispatches to
 * (`dispatchConsoleIntent`). Before this bridge the fallback existed only
 * pre-game (consoleMenuPad's private listener); in-game console mode was
 * pad-only.
 *
 * Arbitration rules:
 *  - a real editable element (or the sanctioned text-entry overlay) owns the
 *    keyboard entirely — the bridge stays silent;
 *  - the bridge only preventDefault/stopImmediatePropagation when the console
 *    handler CONSUMED the intent — an unconsumed key (fallback surface on
 *    top, no handler registered) behaves exactly as before, so native dialog
 *    Esc / DOM focus keyboarding on fallback surfaces keeps working;
 *  - `stopImmediatePropagation` on consumption keeps later-registered window
 *    listeners (CardZoomModal etc.) from double-handling a key the console
 *    shell already acted on — in console mode the shell owns input.
 *
 * VueUse: `useEventListener` — called OUTSIDE a component scope on purpose
 * (module-level installation), so cleanup is the returned stop handle, not
 * scope disposal.
 */

import {useEventListener} from '@vueuse/core';
import {keyboardConsoleIntent} from '@/client/console/composables/consoleActionModel';
import {dispatchConsoleIntent} from '@/client/console/consoleRouter';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';

/** A real editable element owns the physical keyboard. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function onKeydown(e: KeyboardEvent): void {
  if (menuPadState.textEntry || isEditableTarget(e.target)) {
    return;
  }
  const intent = keyboardConsoleIntent(e.code, e.repeat);
  if (intent === undefined) {
    return;
  }
  if (dispatchConsoleIntent(intent)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}

let stop: (() => void) | undefined;

/** Idempotent — GamepadLayer installs on console-mode entry. */
export function installConsoleKeyBridge(): void {
  if (stop !== undefined || typeof window === 'undefined') {
    return;
  }
  stop = useEventListener(window, 'keydown', onKeydown);
}

export function uninstallConsoleKeyBridge(): void {
  stop?.();
  stop = undefined;
}

/** Test / diagnostics hook. */
export function consoleKeyBridgeInstalled(): boolean {
  return stop !== undefined;
}
