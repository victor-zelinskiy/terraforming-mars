/*
 * conWsPresenceBridge — the DOM-presence flags that used to be the
 * `.con-root:has(...)` selectors, maintained by ONE MutationObserver instead.
 *
 * WHY NOT `:has()`. The four root-anchored `:has()` rules (`.con-ws`,
 * `.con-ws--dockcover`, `.con-board--pfocus`, `--pfocus-exit`) made Blink
 * re-evaluate the anchor state on subtree mutations and re-apply a
 * WHOLE-SUBTREE style invalidation on `.con-root` — i.e. a full-document
 * style recalc — roughly once per animated frame. Measured on the 100-card
 * «Разыграно» category flight at 1280×800: ~1.2 s of UpdateLayoutTree per
 * episode, collapsing to ~37 ms with the rules keyed on plain classes. Every
 * card cinematic in the console paid this tax; the biggest surfaces paid the
 * most.
 *
 * WHAT IT PRESERVES. The `:has()` semantics exactly: the flag is true while
 * a matching element EXISTS IN THE DOM — including a surface playing its
 * leave transition (Vue removes the element only when the leave ends, which
 * is what kept the rail lifted "automatically through leave transitions").
 * The observer fires as a microtask after the mutation and the reactive
 * write lands in the same frame's Vue flush — never a painted frame of skew.
 *
 * HOW IT'S WIRED. The observer only wakes on childList changes and CLASS
 * attribute changes (a GSAP flight's per-frame inline-style writes never
 * trigger it), coalesces per microtask, and answers each flag with one
 * early-exit `querySelector`. The flags are module-reactive; the shell folds
 * them into `conRootClasses`, so the classes ride the ordinary render and
 * can never fight a direct classList write.
 */
import {reactive} from 'vue';

export const conWsPresence = reactive({
  /** A workspace-family surface (`.con-ws`) is in the DOM (incl. leaving). */
  wsOpen: false,
  /** A full-panel workspace that covers the dock pack (`.con-ws--dockcover`). */
  wsDockcover: false,
  /** The planet-focus board state (incl. its exit beat). */
  planetFocus: false,
});

let observer: MutationObserver | undefined;
let observedRoot: HTMLElement | undefined;
let scanQueued = false;

function scan(): void {
  scanQueued = false;
  const root = observedRoot;
  if (root === undefined) {
    return;
  }
  const wsOpen = root.querySelector('.con-ws') !== null;
  const wsDockcover = wsOpen && root.querySelector('.con-ws--dockcover') !== null;
  const planetFocus = root.querySelector('.con-board--pfocus, .con-board--pfocus-exit') !== null;
  // Write only on change — an untouched reactive field triggers nothing.
  if (conWsPresence.wsOpen !== wsOpen) {
    conWsPresence.wsOpen = wsOpen;
  }
  if (conWsPresence.wsDockcover !== wsDockcover) {
    conWsPresence.wsDockcover = wsDockcover;
  }
  if (conWsPresence.planetFocus !== planetFocus) {
    conWsPresence.planetFocus = planetFocus;
  }
}

function queueScan(): void {
  if (!scanQueued) {
    scanQueued = true;
    queueMicrotask(scan);
  }
}

/**
 * Install on the console root (the shell's own element). Returns a dispose.
 * Safe to call in environments without MutationObserver (JSDOM setups) —
 * the initial scan still runs, the flags just stop tracking.
 */
export function installConWsPresenceBridge(root: HTMLElement): () => void {
  observedRoot = root;
  scan();
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(queueScan);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }
  return () => {
    observer?.disconnect();
    observer = undefined;
    observedRoot = undefined;
    conWsPresence.wsOpen = false;
    conWsPresence.wsDockcover = false;
    conWsPresence.planetFocus = false;
  };
}
