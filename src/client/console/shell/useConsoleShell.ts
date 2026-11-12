/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE GAME SCREEN, COMPOSED (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §5 · S-last). The whole
 * `setup()` of `ConsoleShell.vue`: the session, the members, the reactions, the wiring — in that order, which is the
 * order the Options component created them in (setup → the `watch` block → the `mounted` / `beforeUnmount` hooks
 * registered LAST, after every controller's own).
 *
 * Nothing here asks for a component instance: it runs inside whatever effect scope and injection context calls it — a
 * virtual-DOM component's `setup()`, a `<script setup>` / Vapor one, a bare `effectScope()` in a spec.
 */
import {onBeforeUnmount, onMounted} from 'vue';
import {useConsoleNativeSurface} from '@/client/console/composables/consoleNativeSurface';
import {useConsoleSession} from '@/client/console/session/consoleSession';
import {createShellPort} from '@/client/console/shell/shellPort';
import {composeShellMembers, ShellMembers, ShellProps} from '@/client/console/shell/shellMembers';
import {installShellReactions} from '@/client/console/shell/shellReactions';

export function useConsoleShell(props: ShellProps): ShellMembers {
  // Foundation (docs/CONSOLE_FOUNDATION.md): the in-game shell is a
  // console-native SURFACE — page-level scroll is locked for its lifetime
  // (html.console-native + body scroll lock); anything that overflows must
  // live inside a ConsoleScrollArea, never scroll the page.
  useConsoleNativeSurface();
  // THE SESSION — the one root of the console's flow tree (console/session/consoleSession.ts): it stands for this
  // shell's life and ends when the shell is unmounted, taking every flow opened inside it.
  useConsoleSession();
  // THE PORT first (every controller takes it), the members, then the port is BOUND to them.
  const port = createShellPort(props);
  const members = composeShellMembers(port);
  const shell = port.bind(members);
  // THE REACTIONS — the ordered table, created after every controller's own watchers.
  installShellReactions(shell);
  // THE WIRING — the shell's own two hooks, registered after every controller's (they run last, as the Options
  // component's `mounted` / `beforeUnmount` did).
  onMounted(() => shell.shellMounted());
  onBeforeUnmount(() => shell.shellLeaving());
  return members;
}
