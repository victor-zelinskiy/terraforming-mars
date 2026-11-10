/*
 * @console-shared LIVE — console native stands on this file.
 *
 * The types `ConsoleRevealOverlay.vue` shares with the code that drives it. They live in a `.ts` module because a `.ts` module
 * (a shell controller — console/shell/) cannot import a named export of a `.vue` file: plain tsc sees `*.vue` through
 * the shim. The SFC imports and re-exports them, so `import {…} from '…/ConsoleRevealOverlay.vue'` inside another SFC still works.
 */
export type ConsoleRevealMode = 'drawn' | 'result' | 'viewer';
