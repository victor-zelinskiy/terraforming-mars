/*
 * CONSOLE NATIVE SURFACE — the page-level overflow & scroll-lock authority
 * (foundation layer; CONSOLE_FOUNDATION.md §3).
 *
 * A "console-native surface" is a screen that OWNS the whole viewport with
 * state-driven pad navigation (ConsoleShell, the console main menu, the
 * console create-game screen, …). While at least one is mounted:
 *
 *  - `html.console-native` is set → console_foundation.less locks html /
 *    body / #app to `width/height: 100%; overflow: hidden` — a page-level
 *    native scrollbar (horizontal OR vertical) becomes structurally
 *    impossible; content that doesn't fit must live inside a
 *    <ConsoleScrollArea>, never scroll the page;
 *  - the body is additionally scroll-locked via VueUse `useScrollLock`
 *    (belt-and-braces: inline style survives a class-order accident and
 *    suppresses iOS/touch scroll chaining);
 *  - the window scroll position is reset to 0 — a page scrolled BEFORE the
 *    lock would otherwise strand content off-screen under overflow:hidden.
 *
 * Deliberately NOT keyed on `consoleModeState.enabled`: console mode also
 * boosts NOT-yet-migrated desktop lifecycle pages (join / lobby) that still
 * legitimately scroll the window (their scrollbar CHROME is hidden by the
 * P14 block in console.less). Those pages simply don't acquire a surface.
 *
 * Refcounted (mirrors menuPadState.mountedCount) — overlapping mounts during
 * screen switches keep the lock seamless.
 */

import {reactive} from 'vue';
import {tryOnScopeDispose, useScrollLock} from '@vueuse/core';

export const consoleNativeState = reactive({
  /** Number of mounted console-native surfaces (>0 → the policy is ON). */
  surfaces: 0,
});

/** Is the console-native overflow policy active right now? */
export function consoleNativeActive(): boolean {
  return consoleNativeState.surfaces > 0;
}

type ScrollLockRef = {value: boolean};
let bodyLock: ScrollLockRef | undefined;

function sync(): void {
  if (typeof document === 'undefined') {
    return;
  }
  const active = consoleNativeState.surfaces > 0;
  document.documentElement.classList.toggle('console-native', active);
  if (bodyLock === undefined && active) {
    bodyLock = useScrollLock(document.body);
  }
  if (bodyLock !== undefined) {
    bodyLock.value = active;
  }
  // A page scrolled BEFORE the lock would strand content off-screen under
  // overflow:hidden — reset (only when actually scrolled; also keeps JSDOM,
  // which lacks scrollTo, quiet).
  if (active && typeof window !== 'undefined' && (window.scrollX !== 0 || window.scrollY !== 0)) {
    window.scrollTo(0, 0);
  }
}

/**
 * Module-level acquisition (for non-component owners). Returns the
 * idempotent release fn — call it in beforeUnmount.
 */
export function acquireConsoleNativeSurface(): () => void {
  consoleNativeState.surfaces++;
  sync();
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    consoleNativeState.surfaces = Math.max(0, consoleNativeState.surfaces - 1);
    sync();
  };
}

/**
 * Component-facing composable: acquire for the component's lifetime.
 * Call from `setup()` of every console-native SCREEN root (not from inner
 * panels — the screen owns the viewport, its children inherit the policy).
 */
export function useConsoleNativeSurface(): void {
  tryOnScopeDispose(acquireConsoleNativeSurface());
}

/** Test hook — drop everything (module state is bundle-shared in mochapack). */
export function resetConsoleNativeSurfaceForTest(): void {
  consoleNativeState.surfaces = 0;
  sync();
}
