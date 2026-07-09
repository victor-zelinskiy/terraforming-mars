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
 * Also owns:
 *  - the KEYBOARD fallback: arrows / Enter / Esc / Q,E (bumpers) / X / Y are
 *    synthesized into the same intents, so the screens work identically for
 *    desktop debugging and mouse+keyboard users who forced ?console=1;
 *  - `menuPadState.mounted` — GamepadLayer hides its generic hint bar while a
 *    pre-game console screen renders its own command bar;
 *  - `menuPadState.textEntry` — the ONE sanctioned DOM-input fallback (name
 *    entry). While armed, the keyboard listener goes silent (letters belong
 *    to the input) and pad intents still flow to the screen handler, which
 *    routes them to the entry overlay (A = save, B = cancel).
 */

import {reactive} from 'vue';
import {GamepadIntent, NavDirection, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {registerConsoleIntentHandler} from '@/client/console/consoleRouter';

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

const KEY_NAV: Record<string, NavDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const KEY_PRESS: Record<string, SemanticButton> = {
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Escape: 'back',
  KeyQ: 'bumperL',
  KeyE: 'bumperR',
  BracketLeft: 'bumperL',
  BracketRight: 'bumperR',
  KeyX: 'secondary',
  KeyY: 'inspect',
  KeyR: 'view',
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Claim the console intent slot + keyboard fallback for one screen.
 * Returns the uninstall fn (call in beforeUnmount). The handler contract is
 * the console one: return true when consumed (pre-game screens normally
 * consume everything — there is no surface below them to fall through to).
 */
export function installMenuPad(handler: MenuPadHandler): () => void {
  const offIntent = registerConsoleIntentHandler(handler);
  const onKey = (e: KeyboardEvent) => {
    // Text entry / any real editable element owns the keyboard entirely
    // (the overlay's own @keydown handles Enter/Esc there).
    if (menuPadState.textEntry || isEditableTarget(e.target)) {
      return;
    }
    const nav = KEY_NAV[e.code];
    if (nav !== undefined) {
      if (handler({kind: 'nav', dir: nav, repeat: e.repeat})) {
        e.preventDefault();
      }
      return;
    }
    if (e.repeat) {
      return;
    }
    const button = KEY_PRESS[e.code];
    if (button !== undefined && handler({kind: 'press', button})) {
      e.preventDefault();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKey);
  }
  menuPadState.mountedCount++;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    offIntent();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', onKey);
    }
    menuPadState.mountedCount = Math.max(0, menuPadState.mountedCount - 1);
    menuPadState.textEntry = false;
  };
}
