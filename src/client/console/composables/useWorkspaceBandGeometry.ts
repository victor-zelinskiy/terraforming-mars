/*
 * THE WORKSPACE BAND'S GEOMETRY MIRROR.
 *
 * Every workspace surface must occupy EXACTLY one box (docs/claude/console/
 * workspace-band.md). Two families reach that box by different routes:
 *  - surfaces INSIDE `.con-main` (the Information Workspace, the Action
 *    Workspace) are absolute children of it — their band IS the main column;
 *  - FIXED band surfaces (`.con-ws-band()`) derive theirs from the
 *    `--con-band-top` / `--con-band-bottom` tokens, which APPROXIMATE the
 *    same box from the root padding + the status strip's nominal height.
 *
 * The approximation was off by a few px (the strip is content-sized), so
 * switching between two workspaces nudged the frame — exactly the kind of
 * micro-jump the family exists to avoid. This composable measures the REAL
 * `.con-main` box and publishes it as `--con-ws-top` / `--con-ws-bottom` on
 * the root, which `.con-ws-band()` consumes ahead of the tokens. Measurement
 * only — never layout: the observer writes two custom properties and nothing
 * reads them back into JS.
 */
import {onBeforeUnmount, onMounted, Ref, watch} from 'vue';
import {useResizeObserver} from '@vueuse/core';

/** Publish the live main-column band onto the console root. */
export function useWorkspaceBandGeometry(main: Ref<HTMLElement | undefined>): void {
  const publish = (): void => {
    const el = main.value;
    if (el === undefined || el === null || typeof window === 'undefined') {
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) {
      return;
    }
    const root = document.documentElement;
    root.style.setProperty('--con-ws-top', `${Math.round(rect.top)}px`);
    root.style.setProperty('--con-ws-bottom', `${Math.round(window.innerHeight - rect.bottom)}px`);
  };

  useResizeObserver(main, publish);
  // The strip above the column can change height without the column resizing
  // (a longer player row wraps) — the window resize covers the profile flip.
  onMounted(() => {
    publish();
    window.addEventListener('resize', publish, {passive: true});
  });
  watch(main, publish);
  onBeforeUnmount(() => {
    window.removeEventListener('resize', publish);
    // Leave no stale geometry behind for the next shell (the tokens take over).
    document.documentElement.style.removeProperty('--con-ws-top');
    document.documentElement.style.removeProperty('--con-ws-bottom');
  });
}
