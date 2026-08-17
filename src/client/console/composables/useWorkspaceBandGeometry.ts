/*
 * THE CENTRAL STAGE'S GEOMETRY MIRROR — the ONE box every modal and every dim
 * is allowed to occupy.
 *
 * THE FRAME IS FOUR HULL MEMBERS AND AN OPENING. The status strip (top), the
 * command bar (bottom), the player rail (left) and the strategy rail (right) are
 * permanent chrome; what they enclose is the CENTRAL STAGE. A decision surface
 * belongs inside that opening and its dim belongs there too — a modal that
 * reaches under a bar, or a shade that greys one out, contradicts the whole
 * point of a cockpit hull (docs/claude/console/hud-frame.md).
 *
 * WHY IT IS MEASURED AND NOT COMPUTED. The tokens (`--con-band-top`,
 * `--con-ws-left`, …) APPROXIMATE the opening from the rail height/width plus
 * the seam, and the approximation was already off vertically by a few px (the
 * strip is content-sized). Horizontally it would be worse than imprecise — it
 * would be WRONG half the time: the strategy rail is `v-show`n on the board home
 * only, so while a workspace SECTION is open the opening genuinely extends to
 * the physical right edge. A rail that is `display: none` measures 0 and this
 * mirror follows it; a token cannot.
 *
 * WHAT IT PUBLISHES — four viewport insets on `<html>`, in px:
 *   --con-stage-t / -b / -l / -r
 * consumed by `.con-ws-band()` and `.con-shade` with the tokens as the
 * pre-mount fallback. Measurement only, never layout: this writes custom
 * properties and nothing reads them back into JS.
 *
 * ⚠️ It observes the RAILS as well as the column. A `v-show` flip changes no
 * box in `.con-main` (the rail simply stops taking part), so the column's own
 * observer never fires for the one event that moves the opening's edge the most.
 */
import {computed, onBeforeUnmount, onMounted, Ref, watch} from 'vue';
import {useResizeObserver} from '@vueuse/core';

/** The four properties this mirror owns — declared once so teardown is exact. */
const STAGE_VARS = ['--con-stage-t', '--con-stage-b', '--con-stage-l', '--con-stage-r'] as const;

/**
 * A host this mirror can measure: a plain element or a COMPONENT INSTANCE (both
 * rails are components, and a template ref on one yields the instance). Resolved
 * here rather than at the call site, so the shell never has to reach for `$el`.
 */
export type StageHost = HTMLElement | {$el?: unknown};

function elementOf(host: StageHost | undefined): HTMLElement | null {
  if (host === undefined || host === null) {
    return null;
  }
  if (host instanceof HTMLElement) {
    return host;
  }
  const el = (host as {$el?: unknown}).$el;
  return el instanceof HTMLElement ? el : null;
}

/** A rail's contribution to the opening's inset: 0 when it is not on screen. */
function railInset(el: Element | null, edge: (rect: DOMRect) => number): number {
  if (el === null) {
    return 0;
  }
  const rect = el.getBoundingClientRect();
  // `display: none` (a `v-show`n rail while a section is open) measures 0×0 —
  // the opening then genuinely reaches the physical edge.
  return rect.width <= 0 || rect.height <= 0 ? 0 : Math.max(0, edge(rect));
}

export type StageGeometryHosts = {
  /** `.con-main` — the band between the two horizontal bars. */
  main: Ref<HTMLElement | undefined>;
  /** The LEFT hull member (`.con-res-host`) — always mounted, may be reskinned. */
  left: Ref<StageHost | undefined>;
  /** The RIGHT hull member (`.con-strat`) — board-home only. */
  right: Ref<StageHost | undefined>;
};

/**
 * Publish the live central-stage box onto the document root.
 *
 * `signal` is an optional reactive read (the shell passes the section/overlay
 * state): a `v-show` flip that hides a rail is a Vue update, not a resize, and
 * on some paths the observer's callback lands a frame later than the surface
 * that is about to open. Re-publishing on the same tick the state changes keeps
 * the first painted frame correct.
 */
export function useWorkspaceBandGeometry(
  hosts: StageGeometryHosts,
  signal?: () => unknown,
): void {
  const publish = (): void => {
    const el = hosts.main.value;
    if (el === undefined || el === null || typeof window === 'undefined') {
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) {
      return;
    }
    // The SEAM between a rail and the opening is the column's own gap — read
    // from the computed style so a profile override needs no second constant.
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const left = railInset(elementOf(hosts.left.value), (r) => r.right);
    const right = railInset(elementOf(hosts.right.value), (r) => window.innerWidth - r.left);
    const style = document.documentElement.style;
    style.setProperty('--con-stage-t', `${Math.round(rect.top)}px`);
    style.setProperty('--con-stage-b', `${Math.round(window.innerHeight - rect.bottom)}px`);
    style.setProperty('--con-stage-l', `${Math.round(left > 0 ? left + gap : 0)}px`);
    style.setProperty('--con-stage-r', `${Math.round(right > 0 ? right + gap : 0)}px`);
  };

  useResizeObserver(hosts.main, publish);
  // The rails arrive as component instances, so the observer takes the resolved
  // ELEMENT (a computed, so it re-observes if a rail ever remounts). A `v-show`
  // flip is reported here too — the box goes to 0×0 rather than disappearing.
  useResizeObserver(computed(() => elementOf(hosts.left.value)), publish);
  useResizeObserver(computed(() => elementOf(hosts.right.value)), publish);
  // The strip above the column can change height without the column resizing
  // (a longer player row wraps) — the window resize covers the profile flip.
  onMounted(() => {
    publish();
    window.addEventListener('resize', publish, {passive: true});
  });
  watch(hosts.main, publish);
  if (signal !== undefined) {
    watch(signal, publish, {flush: 'post'});
  }
  onBeforeUnmount(() => {
    window.removeEventListener('resize', publish);
    // Leave no stale geometry behind for the next shell (the tokens take over).
    for (const name of STAGE_VARS) {
      document.documentElement.style.removeProperty(name);
    }
  });
}
