<template>
  <span class="journal-child-row">
    <!-- Tile placement: "Placement: <tile> · [show on map]". -->
    <template v-if="vm.space !== undefined">
      <span class="journal-child-row__src" v-i18n>Placement</span>
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
    </template>

    <!-- Source → impact. -->
    <template v-else>
      <JournalCardChip v-if="vm.source.kind === 'card'" :name="vm.source.card" />
      <span v-else-if="vm.source.kind === 'label'" class="journal-child-row__src" v-i18n>{{ vm.source.label }}</span>

      <template v-if="vm.copiedCard !== undefined">
        <span class="journal-child-row__copied" v-i18n>copied</span>
        <JournalCardChip :name="vm.copiedCard" />
      </template>

      <!-- Recipient — only shown when it differs from the root actor. -->
      <span v-if="vm.player !== undefined"
            class="journal-player journal-child-row__player"
            :class="'player_translucent_bg_color_' + vm.player">
        <span class="journal-player__dot" :class="'player_bg_color_' + vm.player" aria-hidden="true"></span>
        <span class="journal-player__name">{{ playerName(vm.player) }}</span>
      </span>

      <span v-if="vm.chips.length > 0 && vm.source.kind !== 'none'" class="journal-child-row__arrow" aria-hidden="true">→</span>
      <span v-for="(chip, i) in vm.chips"
            :key="i"
            class="journal-child-row__chip"
            :class="{'journal-child-row__chip--prod': chip.production}">
        <span class="journal-child-row__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
        <span class="journal-child-row__chip-amt">{{ chip.text }}</span>
      </span>
    </template>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {JournalChildVM} from '@/client/components/journal/journalEventChild';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {highlightBoardSpace} from '@/client/components/journal/boardCellHighlight';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';

/**
 * Renders ONE event-driven journal child as `source → impact`: a card chip or a
 * semantic source label (Cell bonus / Ocean bonus / …), an optional recipient
 * player chip (only when it differs from the root actor), and the factual impact
 * as resource/icon chips. Tile placements render with a "show on map" button.
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
  methods: {
    playerName(color: Color): string {
      return this.players.find((p) => p.color === color)?.name ?? color;
    },
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    showOnMap(space: SpaceId): void {
      highlightBoardSpace(space);
    },
  },
});
</script>
