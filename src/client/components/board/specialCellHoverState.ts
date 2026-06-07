import {reactive, watch} from 'vue';
import {SpaceId} from '@/common/Types';

/**
 * Shared hover state for the special-cell info system.
 *
 * Two activation paths feed the single active-state:
 *   - marker hover/focus (small badge in the upper hex sector)
 *   - hex-wide hover (event-delegated in Board.vue so the player doesn't
 *     have to land mouse on the tiny badge — hovering anywhere on the
 *     special cell counts)
 *
 * Both paths route through `setActiveSpecialCell(id, el)`. The marker
 * element is kept so the overlay can recompute its viewport rect on
 * scroll/resize without each marker re-emitting.
 *
 * The hex-wide path uses a per-spaceId marker registry. Markers self-
 * register on mount and unregister on unmount, so when a cell becomes
 * occupied (marker unmounts) the registry empties for that cell and
 * hover does nothing — same effect as marker hiding.
 *
 * Last-mouseenter-wins semantics: only the latest hover sets active;
 * a stale leave (e.g. fast-moved A → B and A's leave fires after B's
 * enter) is ignored because it only clears when the active id matches.
 *
 * Side effects on `document.body` and the active cell's DOM keep CSS
 * rules simple: `body.special-cell-hover-active` powers the cross-marker
 * dim, and `[data_space_id="X"].board-space--special-active` paints the
 * subtle cell hover-highlight.
 */
type State = {
  activeId: string | undefined;            // SpecialCellInfo.id
  activeSpaceId: SpaceId | undefined;      // SpecialCellInfo.spaceId (used by CSS toggle)
  markerEl: HTMLElement | undefined;
};

export const specialCellHoverState: State = reactive({
  activeId: undefined,
  activeSpaceId: undefined,
  markerEl: undefined,
});

type Registered = {
  id: string;
  spaceId: SpaceId;
  el: HTMLElement;
};

const markersBySpaceId = new Map<SpaceId, Registered>();

export function registerSpecialCellMarker(entry: Registered): void {
  markersBySpaceId.set(entry.spaceId, entry);
}

export function unregisterSpecialCellMarker(spaceId: SpaceId): void {
  // Clear active state if the leaving marker is the one currently shown.
  if (specialCellHoverState.activeSpaceId === spaceId) {
    specialCellHoverState.activeId = undefined;
    specialCellHoverState.activeSpaceId = undefined;
    specialCellHoverState.markerEl = undefined;
  }
  markersBySpaceId.delete(spaceId);
}

export function setActiveSpecialCell(id: string, spaceId: SpaceId, el: HTMLElement): void {
  specialCellHoverState.activeId = id;
  specialCellHoverState.activeSpaceId = spaceId;
  specialCellHoverState.markerEl = el;
}

export function clearActiveSpecialCell(id: string): void {
  if (specialCellHoverState.activeId === id) {
    specialCellHoverState.activeId = undefined;
    specialCellHoverState.activeSpaceId = undefined;
    specialCellHoverState.markerEl = undefined;
  }
}

/**
 * Activate by spaceId (used by the hex-wide hover delegate in Board.vue).
 * No-op if no marker is registered for that spaceId — which is the case
 * for ordinary cells and for occupied special cells (marker unmounted).
 */
export function activateSpecialCellBySpaceId(spaceId: SpaceId): void {
  const m = markersBySpaceId.get(spaceId);
  if (m === undefined) {
    return;
  }
  setActiveSpecialCell(m.id, m.spaceId, m.el);
}

export function deactivateSpecialCellBySpaceId(spaceId: SpaceId): void {
  const m = markersBySpaceId.get(spaceId);
  if (m === undefined) {
    return;
  }
  clearActiveSpecialCell(m.id);
}

// ── Side effects on the DOM ───────────────────────────────────────────
//
// The body class powers the cross-marker dim CSS rule (every marker
// except the active one fades out). The cell class paints the subtle
// cyan hover-highlight on the active hex.
//
// Toggled here (rather than in the marker component) so any activation
// path — marker hover, hex-wide hover, programmatic — gets the visuals
// for free.

if (typeof document !== 'undefined') {
  watch(() => specialCellHoverState.activeSpaceId, (spaceId, oldSpaceId) => {
    // Clear previous cell's highlight.
    if (oldSpaceId !== undefined) {
      const prev = document.querySelector(`[data_space_id="${oldSpaceId}"]`);
      if (prev !== null) {
        prev.classList.remove('board-space--special-active');
      }
    }
    if (spaceId !== undefined) {
      const next = document.querySelector(`[data_space_id="${spaceId}"]`);
      if (next !== null) {
        next.classList.add('board-space--special-active');
      }
      document.body.classList.add('special-cell-hover-active');
    } else {
      document.body.classList.remove('special-cell-hover-active');
    }
  });
}
