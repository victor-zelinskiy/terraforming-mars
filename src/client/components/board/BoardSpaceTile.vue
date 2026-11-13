<template>
  <div :class="klass"
       :style="placementStyle"
       data-test="tile"
       @animationend="onAnimationEnd"/>
</template>

<script setup vapor lang="ts">
/*
 * BRD-2 (docs/PERFORMANCE_AUDIT.md): native :title dropped — it ran $t(description) for
 *       every tile on every board remount, and the fork's design bans native tooltips in
 *       favor of the premium board-cell hover popover (which already shows this info).
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, ref, watch} from 'vue';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType, HAZARD_TILES} from '@/common/TileType';
import {HAZARD_INTENSIFY_MS, hazardIntensifyElapsed} from '@/client/components/board/hazardIntensifyState';
import {hazardCleanupState} from '@/client/components/feedback/hazardCleanupTransition';
import {hazardFxAt} from '@/client/components/feedback/hazardCleanupModel';
import {SpaceHighlight, SpaceModel} from '@/common/models/SpaceModel';
import {TileView} from '@/client/components/board/TileView';
import {
  PlacementKind,
  clearActivePlacement,
  observeTilePlacement,
} from '@/client/components/board/tilePlacementAnimation';
import {placementRenderState} from '@/client/components/board/placementRenderState';
import {isRemoteRevealHeld, heldPrevTileOf, cellVacatedNonce, clearCellVacated} from '@/client/console/tilePlacement/remoteRevealHold';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {tileCssClassOf, tileTypeToCssClass, tileTypeToCssClassAresOverride} from '@/client/components/board/boardSpaceTileModel';

defineOptions({name: 'board-space-tile'});
const props = defineProps({
  space: {
    type: Object as () => SpaceModel,
    required: true,
  },
  aresExtension: {
    type: Boolean,
  },
  tileView: {
    type: String as () => TileView,
    default: 'show',
  },
  // True when this cell is a remove-and-replace placement target (its
  // existing tile is about to be removed): suppress the tile graphic so the
  // placement bonus shows through. See placementRenderState.ts.
  placementCleared: {
    type: Boolean,
    default: false,
  },
  // The art the TOP of the cell wears when it differs from the cell's own
  // tile: a plain city over a special city (a stack — the Capital is the
  // base, underneath; see `common/boards/cityStack.ts`). Art only: the
  // tile's identity (description, hazard state, the placement baseline)
  // stays the cell's own.
  topArt: {
    type: Number as unknown as () => TileType | undefined,
    default: undefined,
  },
});

const flow = useFlowScope('board-space-tile');
const placementKind = ref<PlacementKind | null>(null);
const placementDurationMs = ref(0);
const placementDelayMs = ref(0);
let cancelPlacement: () => void = () => {};
const intensifyDelayMs = ref<number | null>(null);
let cancelIntensify: () => void = () => {};

const tileType = computed((): TileType | undefined => {
  return props.space.tileType;
});
const spaceType = computed((): SpaceType => {
  return props.space.spaceType;
});
const highlight = computed((): SpaceHighlight => {
  return props.space.highlight;
});
const klass = computed((): string => {
  let css = 'board-space';
  // A REMOVAL IN FLIGHT (console remote reveal hold on an EMPTY committed
  // cell — Water Export's ocean, the Reds' action): the tile has already
  // left the model, but the player must see it LIFT, not vanish. Until the
  // departure proxy takes it over the cell keeps painting the tile that
  // stood there — the held previous tile's own art.
  if (tileType.value === undefined && props.placementCleared) {
    const heldPrev = heldPrevTileOf(props.space.id);
    const prevClass = heldPrev === undefined ? '' : tileCssClassOf(heldPrev, props.aresExtension);
    if (prevClass !== '') {
      return css + ' board-space-tile--' + prevClass;
    }
  }
  // …and once the tile HAS lifted, the vacated cell settles once (a one-shot the scene marks).
  if (tileType.value === undefined && cellVacatedNonce(props.space.id) !== undefined) {
    css += ' board-space-tile--vacated';
  }
  if (tileType.value !== undefined) {
    // A held OCEAN COVER (console remote reveal hold with a previous
    // tile): the committed cover tile stays hidden, but the cell must
    // keep painting the WATER it landed on — not a bare hex. Render the
    // previous tile's own art, without the cleared blanking.
    const heldPrev = props.placementCleared ? heldPrevTileOf(props.space.id) : undefined;
    if (heldPrev !== undefined) {
      const prevClass = tileCssClassOf(heldPrev, props.aresExtension);
      if (prevClass !== '') {
        return css + ' board-space-tile--' + prevClass;
      }
    }
    const art = props.topArt ?? tileType.value;
    let cssClass: string | undefined = tileTypeToCssClass[art];
    if (props.aresExtension && tileTypeToCssClassAresOverride.has(art)) {
      cssClass = tileTypeToCssClassAresOverride.get(art);
    }
    // Special case Crashlanding rotation
    if (tileType.value === TileType.CRASHLANDING && props.space.rotated === true) {
      cssClass += '-rotated';
    }
    css += ' board-space-tile--' + cssClass;
    // Remove-and-replace target: hide the doomed tile graphic (the
    // matching CSS rule zeroes background-image and drops the materiality
    // rim) so the placement bonus underneath is what the player reads.
    if (props.placementCleared) {
      css += ' board-space-tile--placement-cleared';
    }
    // A hazard that just intensified (mild → severe) plays a one-shot pulse.
    if (intensifyDelayMs.value !== null) {
      css += ' board-space-tile--intensifying';
    }
  } else {
    switch (spaceType.value) {
    case SpaceType.OCEAN:
      css += ' board-space-type-ocean';
      break;
    case SpaceType.COVE:
      if (highlight.value !== 'volcanic') {
        // Custom for Arabia Terra's space Tikhonarov.
        css += ' board-space-type-cove';
      } else {
        css += ' board-space-type-volcanic-cove';
      }
      break;
    case SpaceType.RESTRICTED:
      break;
    default:
      css += ' board-space-type-land';

      if (highlight.value) {
        css += ` board-space-type-land-${highlight.value}`;
      }
    }
  }
  if (props.tileView !== 'show') {
    css += ' board-hidden-tile';
  }
  /*
   * Placement animation classes. `--placing` triggers the impact +
   * settle keyframes on the tile div itself; `--placing-{kind}`
   * supplies the accent colour CSS variable via a per-kind selector
   * in board_placement_animation.less. We deliberately keep this
   * out of the main `cssClass` switch so the existing tile graphic
   * class stays byte-for-byte identical and any future tile types
   * inherit the placement animation for free.
   */
  if (placementKind.value !== null && props.tileView === 'show') {
    css += ' board-space-tile--placing';
    css += ' board-space-tile--placing-' + placementKind.value;
  }
  return css;
});
/*
 * Inline style binding for the CSS animation duration + delay. A
 * fresh placement uses delay 0 + full duration; a mid-flight
 * remount (rare — happens when something forces a second
 * playerkey++ during the hold window) uses a negative delay so the
 * animation starts already partway through, matching the visual
 * the player was seeing pre-remount.
 */
// The tile-to-tile TRANSITION for a hazard-cleanup on THIS cell, applied to
// the real board tile: BEFORE the swap the hazard fades + recedes (dissolve);
// AFTER the swap the new tile grows + fades IN (materialise). `undefined`
// when this cell isn't in an active cleanup. See hazardCleanupTransition.
const hazardCleanupTileFx = computed((): {opacity: number, scale: number} | undefined => {
  const st = hazardCleanupState;
  if (!st.active || !st.events.some((e) => e.spaceId === props.space.id)) {
    return undefined;
  }
  const fx = hazardFxAt(st.progress);
  if (!st.swapped) {
    // The doomed hazard fades out and recedes slightly as it dissolves.
    return {opacity: fx.hazardOpacity, scale: 1 - fx.dissolve * 0.14};
  }
  // The new tile materialises: grows from 0.74 → 1 and fades in.
  return {opacity: Math.min(1, fx.materialize * 1.25), scale: 0.74 + fx.materialize * 0.26};
});
const placementStyle = computed((): Record<string, string> => {
  const style: Record<string, string> = {};
  if (placementKind.value !== null) {
    style['--placement-duration'] = `${placementDurationMs.value}ms`;
    style['--placement-delay'] = `${placementDelayMs.value}ms`;
  }
  // Negative delay keeps the intensify keyframe continuous across remounts.
  if (intensifyDelayMs.value !== null) {
    style['--hazard-intensify-delay'] = `-${Math.round(intensifyDelayMs.value)}ms`;
  }
  // Tile-to-tile transition for a hazard cleanup: fade/recede the doomed
  // hazard out, then grow/fade the new tile in.
  const hcFx = hazardCleanupTileFx.value;
  if (hcFx !== undefined) {
    style['opacity'] = hcFx.opacity.toFixed(3);
    style['transform'] = `${style['transform'] ?? ''} scale(${hcFx.scale.toFixed(3)})`.trim();
    style['transform-origin'] = 'center center';
  }
  return style;
});

/** The vacated cell's settle ended — the one-shot mark is cleared so it can play again another day. */
function onAnimationEnd(e: AnimationEvent) {
  if (e.animationName === 'board-space-vacated') {
    clearCellVacated(props.space.id);
  }
}
function refreshPlacement() {
  cancelPlacement();
  const result = observeTilePlacement(props.space);
  if (result === null) {
    placementKind.value = null;
    return;
  }
  /*
   * A reveal-held cell (console remote placement / remove-and-replace)
   * must not fire the generic impact chrome — the ring/settle glow are
   * pseudo-element paint, so with the tile art suppressed they would
   * flash over an apparently-EMPTY hex. Read the MODULE state directly
   * (not the `placementCleared` prop): the hold is set in the same
   * synchronous block as the commit, so it is always current here,
   * while the prop's freshness depends on the parent's re-render order
   * within this flush. The observe call above already consumed the
   * transition (baseline updated), so the later reveal (un-holding —
   * no tileType change) can never re-trigger it: the tile paints
   * silently under its flight proxy, exactly like the own hero.
   */
  if (isRemoteRevealHeld(props.space.id) || placementRenderState.hiddenTiles.has(props.space.id)) {
    placementKind.value = null;
    clearActivePlacement(props.space.id);
    return;
  }
  placementKind.value = result.kind;
  placementDurationMs.value = result.durationMs;
  placementDelayMs.value = result.delayMs;
  /*
   * Schedule class removal at the end of the animation. The
   * remaining duration is `durationMs + delayMs` (delay is
   * negative on mid-flight resume, so the sum collapses to the
   * actual remaining window). Add a small buffer (40 ms) so a
   * one-frame paint hiccup doesn't truncate the settle pulse.
   */
  const spaceId = props.space.id;
  const remaining = Math.max(0, result.durationMs + result.delayMs) + 40;
  // PACING, owned by this tile (flow kernel — PLAN §10 · C1): taken back at unmount ON PURPOSE, as the cleared
  // timer was — a placement in flight stays in the module's ledger so the remounted tile resumes it.
  cancelPlacement = flow.after(remaining, 'the tile\'s placement animation ends', () => {
    placementKind.value = null;
    clearActivePlacement(spaceId);
  });
}
/*
 * One-shot hazard-intensify pulse (mild → severe), STATE + timer like the
 * placement classes above — never a cached computed. The old computed froze
 * its first non-negative elapsed forever (its reactive deps never change
 * again), so `--intensifying` + its pinned negative delay stayed on the
 * tile for the rest of the game — and because the console board section is
 * `v-show`n, EVERY workspace round trip (display:none → '') restarted the
 * CSS animation: stationary hazard tiles visibly pulsed/scaled each time a
 * workspace closed. The class must leave the DOM when the pulse ends.
 */
function refreshIntensify() {
  cancelIntensify();
  const elapsed = (tileType.value !== undefined && HAZARD_TILES.has(tileType.value)) ?
    hazardIntensifyElapsed(props.space.id, tileType.value) : -1;
  if (elapsed < 0) {
    intensifyDelayMs.value = null;
    return;
  }
  intensifyDelayMs.value = elapsed;
  const remaining = Math.max(0, HAZARD_INTENSIFY_MS - elapsed) + 40;
  cancelIntensify = flow.after(remaining, 'the hazard\'s intensify pulse ends', () => {
    intensifyDelayMs.value = null;
  });
}

watch(() => props.space.tileType, () => {
  refreshPlacement();
  refreshIntensify();
}, {immediate: true});
</script>
