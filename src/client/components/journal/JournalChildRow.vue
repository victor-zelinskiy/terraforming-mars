<template>
  <span class="journal-child-row" :class="'journal-child-row--' + vm.bucket">
    <!-- Tile placement: "Размещение → <tile> · [show on map]". -->
    <template v-if="vm.space !== undefined">
      <span class="journal-child-row__lead">
        <span class="journal-child-row__src" v-i18n>Placement</span>
        <span v-if="vm.player !== undefined"
              class="journal-player journal-child-row__player"
              :class="'player_translucent_bg_color_' + vm.player">
          <span class="journal-player__dot" :class="'player_bg_color_' + vm.player" aria-hidden="true"></span>
          <span class="journal-player__name">{{ playerName(vm.player) }}</span>
        </span>
      </span>
      <span class="journal-child-row__arrow" aria-hidden="true">→</span>
      <span class="journal-child-row__impacts">
        <span v-if="vm.tileLabel" class="journal-child-row__tile journal-em" v-i18n>{{ vm.tileLabel }}</span>
        <button type="button"
                class="journal-token journal-token--space"
                :aria-label="$t('Show on map')"
                @click.stop.prevent="showOnMap(vm.space)">
          <svg class="journal-token--space__pin" width="11" height="13" viewBox="0 0 11 13" aria-hidden="true">
            <path d="M5.5 0C2.46 0 0 2.4 0 5.36 0 9.1 5.5 13 5.5 13S11 9.1 11 5.36C11 2.4 8.54 0 5.5 0Zm0 7.3a1.96 1.96 0 1 1 0-3.92 1.96 1.96 0 0 1 0 3.92Z"/>
          </svg>
          <span v-i18n>Show on map</span>
        </button>
      </span>
    </template>

    <!-- Source → impact. -->
    <template v-else>
      <span class="journal-child-row__lead">
        <JournalCardChip v-if="vm.source.kind === 'card'" :name="vm.source.card" />
        <span v-else-if="vm.source.kind === 'label'" class="journal-child-row__src" v-i18n>{{ vm.source.label }}</span>

        <!-- DISCOUNT badge — a cost reduction reads as a "−N M€" chip, which a
             player could mistake for a charge. The explicit word makes it
             unambiguous that the source SAVED them money, not spent it. -->
        <span v-if="vm.bucket === 'discount'" class="journal-child-row__discount-badge" v-i18n>Discount</span>

        <!-- Recipient — only shown when it differs from the root actor. -->
        <span v-if="vm.player !== undefined"
              class="journal-player journal-child-row__player"
              :class="'player_translucent_bg_color_' + vm.player">
          <span class="journal-player__dot" :class="'player_bg_color_' + vm.player" aria-hidden="true"></span>
          <span class="journal-player__name">{{ playerName(vm.player) }}</span>
        </span>
      </span>

      <span v-if="hasResult" class="journal-child-row__arrow" aria-hidden="true">→</span>
      <span class="journal-child-row__impacts">
        <!-- Copied action: "copied <card>" flows in the result area (NOT the lead)
             so it wraps gracefully instead of squeezing the source column. -->
        <template v-if="vm.copiedCard !== undefined">
          <span class="journal-child-row__copied" v-i18n>copied</span>
          <JournalCardChip :name="vm.copiedCard" />
        </template>
        <span v-for="(chip, i) in vm.chips"
              :key="i"
              class="journal-child-row__chip"
              :class="chipClass(chip)">
          <span class="journal-child-row__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
          <span class="journal-child-row__chip-amt">{{ chip.text }}</span>
        </span>
      </span>
    </template>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {SpaceId} from '@/common/Types';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {JournalChildVM, JournalImpactChip} from '@/client/components/journal/journalEventChild';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {highlightBoardSpace} from '@/client/components/journal/boardCellHighlight';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';

/**
 * Renders ONE grouped journal child as `source → impact · impact`: a card chip
 * or a semantic source label (Cell bonus / Trade income / Payment / …), an
 * optional recipient player chip (only when it differs from the root actor), and
 * the merged factual impact as resource/icon chips. A row is laid out as a
 * 3-column grid (lead · arrow · impacts) so the arrow + impact area sit at a
 * stable position down the feed. Tile placements render with a "show on map"
 * button. Chips are toned by kind — gain / loss / production / saved (discount).
 */
export default defineComponent({
  name: 'JournalChildRow',
  components: {JournalCardChip},
  props: {
    vm: {
      type: Object as PropType<JournalChildVM>,
      required: true,
    },
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
  },
  computed: {
    // Whether the row has a result to point an arrow at (impacts OR a copied card).
    hasResult(): boolean {
      return this.vm.source.kind !== 'none' && (this.vm.chips.length > 0 || this.vm.copiedCard !== undefined);
    },
  },
  methods: {
    playerName(color: Color): string {
      return displayNameForColor(this.players, color);
    },
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    chipClass(chip: JournalImpactChip): Record<string, boolean> {
      return {
        'journal-child-row__chip--prod': chip.production === true,
        'journal-child-row__chip--saved': chip.saved === true,
        'journal-child-row__chip--neg': chip.production !== true && chip.saved !== true && chip.text.startsWith('−'),
        'journal-child-row__chip--pos': chip.production !== true && chip.saved !== true && chip.text.startsWith('+'),
      };
    },
    showOnMap(space: SpaceId): void {
      highlightBoardSpace(space);
    },
  },
});
</script>
