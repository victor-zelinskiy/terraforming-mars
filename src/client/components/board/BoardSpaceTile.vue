<template>
  <!-- BRD-2 (docs/PERFORMANCE_AUDIT.md): native :title dropped — it ran $t(description) for
       every tile on every board remount, and the fork's design bans native tooltips in
       favor of the premium board-cell hover popover (which already shows this info). -->
  <div :class="klass"
       :style="placementStyle"
       data-test="tile"/>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType, tileTypeToString, HAZARD_TILES} from '@/common/TileType';
import {hazardIntensifyElapsed} from '@/client/components/board/hazardIntensifyState';
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
import {isRemoteRevealHeld} from '@/client/console/tilePlacement/remoteRevealHold';

const tileTypeToCssClass: Record<TileType, string> = {
  [TileType.OCEAN]: 'ocean',
  [TileType.CITY]: 'city',
  [TileType.GREENERY]: 'greenery',
  [TileType.COMMERCIAL_DISTRICT]: 'commercial_district',
  [TileType.ECOLOGICAL_ZONE]: 'ecological_zone',
  [TileType.INDUSTRIAL_CENTER]: 'industrial_center',
  [TileType.LAVA_FLOWS]: 'lava_flows',
  [TileType.MINING_AREA]: 'mining_area',
  [TileType.MINING_RIGHTS]: 'mining_rights',
  [TileType.CAPITAL]: 'capital',
  [TileType.MOHOLE_AREA]: 'mohole_area',
  [TileType.NATURAL_PRESERVE]: 'natural_preserve',
  [TileType.NUCLEAR_ZONE]: 'nuclear_zone',
  [TileType.RESTRICTED_AREA]: 'restricted_area',
  [TileType.DEIMOS_DOWN]: 'deimos_down',
  [TileType.GREAT_DAM]: 'great_dam',
  [TileType.MAGNETIC_FIELD_GENERATORS]: 'magnetic_field_generators',
  [TileType.BIOFERTILIZER_FACILITY]: 'biofertilizer-facility',
  [TileType.METALLIC_ASTEROID]: 'metallic-asteroid',
  [TileType.SOLAR_FARM]: 'solar-farm',
  [TileType.OCEAN_CITY]: 'ocean-city',
  [TileType.OCEAN_FARM]: 'ocean-farm',
  [TileType.OCEAN_SANCTUARY]: 'ocean-sanctuary',
  [TileType.DUST_STORM_MILD]: 'dust-storm-mild',
  [TileType.DUST_STORM_SEVERE]: 'dust-storm-severe',
  [TileType.EROSION_MILD]: 'erosion-mild',
  [TileType.EROSION_SEVERE]: 'erosion-severe',
  [TileType.MINING_STEEL_BONUS]: 'mining-steel',
  [TileType.MINING_TITANIUM_BONUS]: 'mining-titanium',
  [TileType.WETLANDS]: 'wetlands',
  [TileType.RED_CITY]: 'red-city',
  [TileType.MARTIAN_NATURE_WONDERS]: 'martian-nature-wonders',
  [TileType.MOON_ROAD]: 'road',
  [TileType.MOON_HABITAT]: 'habitat',
  [TileType.MOON_MINE]: 'mine',
  [TileType.LUNA_TRADE_STATION]: 'luna-trade-station',
  [TileType.LUNA_MINING_HUB]: 'luna-mining-hub',
  [TileType.LUNA_TRAIN_STATION]: 'luna-train-station',
  [TileType.LUNAR_MINE_URBANIZATION]: 'lunar-mine-urbanization',
  [TileType.CRASHLANDING]: 'crashlanding',
  [TileType.MARS_NOMADS]: '', // This never actually renders.
  [TileType.REY_SKYWALKER]: 'martian-nature-wonders', // Use Martian Nature Wonders cube CSS.
  [TileType.MAN_MADE_VOLCANO]: 'man-made-volcano',
  [TileType.NEW_HOLLAND]: 'new-holland',
  [TileType.NEURAL_INSTANCE]: 'neural-instance',
};

const tileTypeToCssClassAresOverride = new Map<TileType, string>([
  [TileType.COMMERCIAL_DISTRICT, 'commercial-district-ares'],
  [TileType.DEIMOS_DOWN, 'deimos-down-ares'],
  [TileType.ECOLOGICAL_ZONE, 'ecological-zone-ares'],
  [TileType.GREAT_DAM, 'great-dam-ares'],
  [TileType.INDUSTRIAL_CENTER, 'industrial-center-ares'],
  [TileType.LAVA_FLOWS, 'lava-flows-ares'],
  [TileType.CAPITAL, 'capital-ares'],
  [TileType.MOHOLE_AREA, 'mohole-area-ares'],
  [TileType.NATURAL_PRESERVE, 'natural-preserve-ares'],
  [TileType.NUCLEAR_ZONE, 'nuclear-zone-ares'],
  [TileType.RESTRICTED_AREA, 'restricted-area-ares'],
  [TileType.MAGNETIC_FIELD_GENERATORS, 'magnetic-field-generators-ares'],
]);

const descriptions: Record<TileType, string> = {
  ...tileTypeToString,
  [TileType.COMMERCIAL_DISTRICT]: 'Commercial District: 1 VP per adjacent city tile',
  [TileType.CITY]: 'City: 1 VP per adjacent greenery',
  [TileType.GREENERY]: 'Greenery: 1 VP',
  [TileType.OCEAN]: 'Ocean: grants 2M€ when players put tiles next to it',
  [TileType.OCEAN_CITY]: 'Ocean City: counts as an ocean and a city.',
  [TileType.DUST_STORM_MILD]: 'Mild Dust Storm: lose 1 production when placing next to it. Pay 8M€ to place over it.',
  [TileType.DUST_STORM_SEVERE]: 'Severe Dust Storm: lose 2 production when placing next to it. Pay 16M€ to place over it.',
  [TileType.EROSION_MILD]: 'Mild Erosion: lose 1 production when placing next to it. Pay 8M€ to place over it.',
  [TileType.EROSION_SEVERE]: 'Severe Erosion: lose 2 production when placing next to it. Pay 16M€ to place over it.',
  [TileType.MINING_STEEL_BONUS]: 'Mining: steel bonus',
  [TileType.MINING_TITANIUM_BONUS]: 'Mining: titanium bonus',
  [TileType.MOON_MINE]: 'Moon Mine: 1 VP per adjacent road',
  [TileType.MOON_HABITAT]: 'Moon Habitat: 1 VP per adjacent road',
  [TileType.MOON_ROAD]: 'Moon Road: 1 VP',
  [TileType.LUNA_TRAIN_STATION]: 'Luna Train Station: 2 VP per adjacent road',
  [TileType.LUNAR_MINE_URBANIZATION]: 'Luna Mine Urbanization: counts as both a colony and a mine tile.',

  [TileType.WETLANDS]: 'Wetlands: counts as an ocean and a greenery. Does not count toward 9 oceans.',
  [TileType.RED_CITY]: 'Red City: 1 VP per empty adjacent area. No greeneries may be placed next to it.',
  [TileType.MARTIAN_NATURE_WONDERS]: 'Martian Nature Wonders: nothing may be placed here',
  [TileType.REY_SKYWALKER]: 'Rey... Skywalker?: nothing may be placed here',

  [TileType.NEW_HOLLAND]: 'New Holland: counts as an ocean and a city',
  [TileType.NEURAL_INSTANCE]: 'Neural Instance: MarsBot gains VP for adjacent non-human spaces',
};

/**
 * The tile-art css suffix (`board-space-tile--<suffix>`) for an EXTERNAL
 * proxy renderer — the console placement hero flies a twin of the real
 * tile art (@console-shared: additive export, desktop behaviour untouched).
 */
export function tileCssClassOf(tileType: TileType, aresExtension: boolean): string {
  let cssClass: string | undefined = tileTypeToCssClass[tileType];
  if (aresExtension && tileTypeToCssClassAresOverride.has(tileType)) {
    cssClass = tileTypeToCssClassAresOverride.get(tileType);
  }
  return cssClass ?? '';
}

type Data = {
  placementKind: PlacementKind | null;
  placementDurationMs: number;
  placementDelayMs: number;
  placementTimer: number | null;
};

export default defineComponent({
  name: 'board-space-tile',
  props: {
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
  },
  data(): Data {
    return {
      placementKind: null,
      placementDurationMs: 0,
      placementDelayMs: 0,
      placementTimer: null,
    };
  },
  computed: {
    tileType(): TileType | undefined {
      return this.space.tileType;
    },
    spaceType(): SpaceType {
      return this.space.spaceType;
    },
    highlight(): SpaceHighlight {
      return this.space.highlight;
    },
    description(): string {
      if (this.tileType === undefined) {
        return '';
      }
      if (this.tileType === TileType.CITY && this.spaceType === SpaceType.COLONY) {
        return 'City in space.';
      }
      return descriptions[this.tileType];
    },
    klass(): string {
      let css = 'board-space';
      if (this.tileType !== undefined) {
        let cssClass: string | undefined = tileTypeToCssClass[this.tileType];
        if (this.aresExtension && tileTypeToCssClassAresOverride.has(this.tileType)) {
          cssClass = tileTypeToCssClassAresOverride.get(this.tileType);
        }
        // Special case Crashlanding rotation
        if (this.tileType === TileType.CRASHLANDING && this.space.rotated === true) {
          cssClass += '-rotated';
        }
        css += ' board-space-tile--' + cssClass;
        // Remove-and-replace target: hide the doomed tile graphic (the
        // matching CSS rule zeroes background-image and drops the materiality
        // rim) so the placement bonus underneath is what the player reads.
        if (this.placementCleared) {
          css += ' board-space-tile--placement-cleared';
        }
        // A hazard that just intensified (mild → severe) plays a one-shot pulse.
        if (this.intensifyElapsed >= 0) {
          css += ' board-space-tile--intensifying';
        }
      } else {
        switch (this.spaceType) {
        case SpaceType.OCEAN:
          css += ' board-space-type-ocean';
          break;
        case SpaceType.COVE:
          if (this.highlight !== 'volcanic') {
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

          if (this.highlight) {
            css += ` board-space-type-land-${this.highlight}`;
          }
        }
      }
      if (this.tileView !== 'show') {
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
      if (this.placementKind !== null && this.tileView === 'show') {
        css += ' board-space-tile--placing';
        css += ' board-space-tile--placing-' + this.placementKind;
      }
      return css;
    },
    /*
     * Inline style binding for the CSS animation duration + delay. A
     * fresh placement uses delay 0 + full duration; a mid-flight
     * remount (rare — happens when something forces a second
     * playerkey++ during the hold window) uses a negative delay so the
     * animation starts already partway through, matching the visual
     * the player was seeing pre-remount.
     */
    // Elapsed ms of an active hazard-intensify pulse for THIS cell (mild → severe),
    // or -1. Module-tracked so the one-shot survives the board remount.
    intensifyElapsed(): number {
      if (this.tileType === undefined || !HAZARD_TILES.has(this.tileType)) {
        return -1;
      }
      return hazardIntensifyElapsed(this.space.id, this.tileType);
    },
    // The tile-to-tile TRANSITION for a hazard-cleanup on THIS cell, applied to
    // the real board tile: BEFORE the swap the hazard fades + recedes (dissolve);
    // AFTER the swap the new tile grows + fades IN (materialise). `undefined`
    // when this cell isn't in an active cleanup. See hazardCleanupTransition.
    hazardCleanupTileFx(): {opacity: number, scale: number} | undefined {
      const st = hazardCleanupState;
      if (!st.active || !st.events.some((e) => e.spaceId === this.space.id)) {
        return undefined;
      }
      const fx = hazardFxAt(st.progress);
      if (!st.swapped) {
        // The doomed hazard fades out and recedes slightly as it dissolves.
        return {opacity: fx.hazardOpacity, scale: 1 - fx.dissolve * 0.14};
      }
      // The new tile materialises: grows from 0.74 → 1 and fades in.
      return {opacity: Math.min(1, fx.materialize * 1.25), scale: 0.74 + fx.materialize * 0.26};
    },
    placementStyle(): Record<string, string> {
      const style: Record<string, string> = {};
      if (this.placementKind !== null) {
        style['--placement-duration'] = `${this.placementDurationMs}ms`;
        style['--placement-delay'] = `${this.placementDelayMs}ms`;
      }
      // Negative delay keeps the intensify keyframe continuous across remounts.
      if (this.intensifyElapsed >= 0) {
        style['--hazard-intensify-delay'] = `-${Math.round(this.intensifyElapsed)}ms`;
      }
      // Tile-to-tile transition for a hazard cleanup: fade/recede the doomed
      // hazard out, then grow/fade the new tile in.
      const hcFx = this.hazardCleanupTileFx;
      if (hcFx !== undefined) {
        style['opacity'] = hcFx.opacity.toFixed(3);
        style['transform'] = `${style['transform'] ?? ''} scale(${hcFx.scale.toFixed(3)})`.trim();
        style['transform-origin'] = 'center center';
      }
      return style;
    },
  },
  watch: {
    'space.tileType': {
      immediate: true,
      handler() {
        this.refreshPlacement();
      },
    },
  },
  beforeUnmount() {
    if (this.placementTimer !== null) {
      clearTimeout(this.placementTimer);
      this.placementTimer = null;
    }
  },
  methods: {
    refreshPlacement() {
      if (this.placementTimer !== null) {
        clearTimeout(this.placementTimer);
        this.placementTimer = null;
      }
      const result = observeTilePlacement(this.space);
      if (result === null) {
        this.placementKind = null;
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
      if (isRemoteRevealHeld(this.space.id) || placementRenderState.hiddenTiles.has(this.space.id)) {
        this.placementKind = null;
        clearActivePlacement(this.space.id);
        return;
      }
      this.placementKind = result.kind;
      this.placementDurationMs = result.durationMs;
      this.placementDelayMs = result.delayMs;
      /*
       * Schedule class removal at the end of the animation. The
       * remaining duration is `durationMs + delayMs` (delay is
       * negative on mid-flight resume, so the sum collapses to the
       * actual remaining window). Add a small buffer (40 ms) so a
       * one-frame paint hiccup doesn't truncate the settle pulse.
       */
      const spaceId = this.space.id;
      const remaining = Math.max(0, result.durationMs + result.delayMs) + 40;
      this.placementTimer = window.setTimeout(() => {
        this.placementKind = null;
        this.placementTimer = null;
        clearActivePlacement(spaceId);
      }, remaining);
    },
  },
});

</script>
