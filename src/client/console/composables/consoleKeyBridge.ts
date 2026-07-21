/*
 * CONSOLE KEY BRIDGE — the ONE keyboard→intent adapter of the console flow
 * (foundation layer; docs/CONSOLE_FOUNDATION.md §2).
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
import {CONSOLE_KEY_BUTTON, keyboardConsoleIntent} from '@/client/console/composables/consoleActionModel';
import {dispatchConsoleIntent} from '@/client/console/consoleRouter';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {clickDesktopUpdatePrimary, desktopUpdateBlocking} from '@/client/components/desktop/desktopUpdateState';

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
  // MANDATORY UPDATE GATE: while the full-cover update overlay owns the screen
  // (Steam Input can emulate Enter on the Deck), the confirm key applies the
  // update; every other key is SWALLOWED so a native key press can never reach
  // a menu button behind the overlay (the "Continue fires under the update"
  // bug). Never dispatch to the console/menu handler here.
  if (desktopUpdateBlocking()) {
    if (intent.kind === 'press' && intent.button === 'confirm') {
      clickDesktopUpdatePrimary();
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if (dispatchConsoleIntent(intent)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}

/**
 * Keyup → a synthesized RELEASE intent, so keyboard input carries the same
 * press/release edges the gamepad poll model emits — press-and-HOLD verbs
 * (the notification toast's X-hold detail action) work identically on the
 * desktop-fallback keyboard. Mirrors keydown's arbitration: editable targets
 * own the keyboard; consumption gates preventDefault. keydown REPEATS never
 * re-fire a press (keyboardConsoleIntent filters them), so a held key is
 * exactly one press … one release, like a pad button.
 */
function onKeyup(e: KeyboardEvent): void {
  if (menuPadState.textEntry || isEditableTarget(e.target)) {
    return;
  }
  const button = CONSOLE_KEY_BUTTON[e.code];
  if (button === undefined) {
    return;
  }
  if (desktopUpdateBlocking()) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if (dispatchConsoleIntent({kind: 'release', button})) {
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
  const stopDown = useEventListener(window, 'keydown', onKeydown);
  const stopUp = useEventListener(window, 'keyup', onKeyup);
  stop = () => {
    stopDown();
    stopUp();
  };
}

export function uninstallConsoleKeyBridge(): void {
  stop?.();
  stop = undefined;
}

/** Test / diagnostics hook. */
export function consoleKeyBridgeInstalled(): boolean {
  return stop !== undefined;
}
