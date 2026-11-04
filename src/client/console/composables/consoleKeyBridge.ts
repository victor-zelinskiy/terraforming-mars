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
import {installInputEchoProbe, recordInputEcho} from '@/client/console/inputEcho';
import {installInputAbsorbProbe, lastDispatchAbsorbedBy} from '@/client/console/inputAbsorb';
import {installFieldRecorder} from '@/client/console/fieldRecorder';
import {CONSOLE_KEY_BUTTON, CONSOLE_KEY_NAV, keyboardConsoleIntent} from '@/client/console/composables/consoleActionModel';
import {GamepadIntent, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {dispatchConsoleIntent} from '@/client/console/consoleRouter';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {consoleSystemMenuIntent} from '@/client/console/consoleSystemMenuBridge';
import {clickDesktopUpdatePrimary, desktopUpdateBlocking} from '@/client/components/desktop/desktopUpdateState';

/** A real editable element owns the physical keyboard. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** A dispatched key's echo: `absorbed` when a deliberate gate took it (named — `inputAbsorb.ts`), else `consumed`. */
function recordConsumedOrAbsorbed(code: string, kind: string): void {
  const by = lastDispatchAbsorbedBy();
  recordInputEcho(code, kind, by.length > 0 ? 'absorbed' : 'consumed', by);
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
    recordInputEcho(e.code, intent.kind, 'update-gate');
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  // The SYSTEM overlay is asked first: it is owned by GamepadLayer (off the
  // console router), so while it is open it must own the keyboard too —
  // otherwise the arrows would drive the board BEHIND it.
  if (consoleSystemMenuIntent(intent)) {
    recordInputEcho(e.code, intent.kind, 'system');
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if (dispatchConsoleIntent(intent)) {
    recordConsumedOrAbsorbed(e.code, intent.kind);
    e.preventDefault();
    e.stopImmediatePropagation();
  } else {
    recordInputEcho(e.code, intent.kind, 'unconsumed');
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
  // Arrow keyups mirror the pad's directional FALLING edge (`navEnd`) — the
  // quick wheel's press→release slots pair a keyboard hold exactly like a
  // d-pad hold. Unknown codes stay silent (whoever else wants the key).
  const dir = CONSOLE_KEY_NAV[e.code];
  const button = dir === undefined ? CONSOLE_KEY_BUTTON[e.code] : undefined;
  if (dir === undefined && button === undefined) {
    return;
  }
  if (desktopUpdateBlocking()) {
    recordInputEcho(e.code, 'release', 'update-gate');
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  const intent: GamepadIntent = dir !== undefined ?
    {kind: 'navEnd', dir} : {kind: 'release', button: button as SemanticButton};
  if (consoleSystemMenuIntent(intent)) {
    recordInputEcho(e.code, intent.kind, 'system');
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if (dispatchConsoleIntent(intent)) {
    recordConsumedOrAbsorbed(e.code, intent.kind);
    e.preventDefault();
    e.stopImmediatePropagation();
  } else {
    recordInputEcho(e.code, intent.kind, 'unconsumed');
  }
}

let stop: (() => void) | undefined;

/** Idempotent — GamepadLayer installs on console-mode entry. */
export function installConsoleKeyBridge(): void {
  if (stop !== undefined || typeof window === 'undefined') {
    return;
  }
  installInputEchoProbe();
  installInputAbsorbProbe((code) => CONSOLE_KEY_NAV[code] !== undefined ? 'nav' : CONSOLE_KEY_BUTTON[code]);
  // THE FIELD FLIGHT RECORDER (phase 2 of the start director): the console's tagged warnings and the arbiter's
  // heartbeats, kept across a reload and posted to the embedded server beside the saves.
  installFieldRecorder();
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
