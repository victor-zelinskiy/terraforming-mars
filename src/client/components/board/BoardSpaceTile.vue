<template>
  <div :class="klass"
       :style="placementStyle"
       :title="$t(description)"
       data-test="tile"/>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType, tileTypeToString} from '@/common/TileType';
import {SpaceHighlight, SpaceModel} from '@/common/models/SpaceModel';
import {TileView} from '@/client/components/board/TileView';
import {
  PlacementKind,
  clearActivePlacement,
  observeTilePlacement,
} from '@/client/components/board/tilePlacementAnimation';

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
    placementStyle(): Record<string, string> {
      if (this.placementKind === null) {
        return {};
      }
      return {
        '--placement-duration': `${this.placementDurationMs}ms`,
        '--placement-delay': `${this.placementDelayMs}ms`,
      };
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
