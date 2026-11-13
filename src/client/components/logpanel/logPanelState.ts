/*
 * THE LOG PANEL'S ONE REQUEST IN FLIGHT — module state of `LogPanel.vue`, kept in a module of its own: inside
 * `<script setup>` a top-level `let` is per INSTANCE (docs/claude/vapor/RECIPES.md § R25), and this handle is shared by
 * every panel on the page on purpose (a new generation's request aborts the one before it, whoever asked).
 */
let logAbortController: AbortController | undefined;

/** Abort the pending log request (if any) and open the next one — its controller is the pending one from now on. */
export function replaceLogRequest(): AbortController {
  if (logAbortController) {
    logAbortController.abort();
    logAbortController = undefined;
  }
  const controller = new AbortController();
  logAbortController = controller;
  return controller;
}
