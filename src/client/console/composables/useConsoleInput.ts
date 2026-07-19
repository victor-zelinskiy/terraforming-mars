/*
 * useConsoleInput — the component-facing SEMANTIC input composable
 * (foundation layer; docs/CONSOLE_FOUNDATION.md §2).
 *
 * A console-native SCREEN claims the single console intent slot for its
 * lifetime and receives SEMANTIC callbacks — it never touches raw
 * KeyboardEvent (the global consoleKeyBridge synthesizes keyboard into the
 * same intent stream) and, for the common verbs, not raw button names
 * either:
 *
 *   useConsoleInput({
 *     onAction: (action) => { … 'primary' / 'back' / 'inspect' … },
 *     onNav: (dir, repeat) => { … },
 *     overrides: {inspect: 'launch'},          // contextual re-labelling
 *   });
 *
 * Arbitration is the EXISTING single-slot model (consoleRouter): one
 * top-level owner per lifecycle context; inner panels receive delegated
 * intents from their owner (the established `handleIntent` ref pattern) —
 * this composable does NOT introduce a competing handler stack. Screens that
 * are pre-game MENU surfaces should pass `menuSurface: true` so GamepadLayer
 * keeps hiding its generic hint bar (the consoleMenuPad contract).
 *
 * Return `true` from a callback to CONSUME the intent; with
 * `exclusive: true` (the default — console screens swallow input so nothing
 * below reacts) unhandled intents are consumed too. Set `exclusive: false`
 * for surfaces that must let unclaimed intents fall through to the demoted
 * DOM focus engine (the ConsoleShell fallback contract).
 */

import {tryOnScopeDispose} from '@vueuse/core';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {registerConsoleIntentHandler} from '@/client/console/consoleRouter';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {ConsoleAction, ConsoleActionOverrides, consoleActionOf} from '@/client/console/composables/consoleActionModel';

export type ConsoleInputOptions = {
  /** Semantic press actions (see ConsoleAction). Return true = consumed. */
  onAction?: (action: ConsoleAction, intent: GamepadIntent) => boolean | void,
  /** D-pad / left stick navigation. Return true = consumed. */
  onNav?: (dir: NavDirection, repeat: boolean) => boolean | void,
  /** Raw escape hatch (releases, stick scroll, unmapped buttons). Runs FIRST. */
  onIntent?: (intent: GamepadIntent) => boolean | void,
  /** Contextual re-labelling of the default button→action map. */
  overrides?: ConsoleActionOverrides,
  /** Swallow unhandled intents (default true — nothing below should react). */
  exclusive?: boolean,
  /** Pre-game menu surface: hide GamepadLayer's generic hint bar while mounted. */
  menuSurface?: boolean,
};

export function useConsoleInput(options: ConsoleInputOptions): {release: () => void} {
  const exclusive = options.exclusive ?? true;

  const handle = (intent: GamepadIntent): boolean => {
    if (options.onIntent?.(intent) === true) {
      return true;
    }
    if (intent.kind === 'nav' && options.onNav !== undefined) {
      if (options.onNav(intent.dir, intent.repeat) === true) {
        return true;
      }
    }
    if (options.onAction !== undefined) {
      const action = consoleActionOf(intent, options.overrides);
      if (action !== undefined && options.onAction(action, intent) === true) {
        return true;
      }
    }
    return exclusive;
  };

  const offIntent = registerConsoleIntentHandler(handle);
  if (options.menuSurface === true) {
    menuPadState.mountedCount++;
  }

  let released = false;
  const release = (): void => {
    if (released) {
      return;
    }
    released = true;
    offIntent();
    if (options.menuSurface === true) {
      menuPadState.mountedCount = Math.max(0, menuPadState.mountedCount - 1);
      menuPadState.textEntry = false;
    }
  };
  tryOnScopeDispose(release);
  return {release};
}
