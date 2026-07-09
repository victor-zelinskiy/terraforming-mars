<template>
  <div class="cm-deckbody cm-maps">
    <div class="cm-maps__viewport">
      <div class="cm-maps__strip" :style="stripStyle">
        <button
          v-for="(row, i) in rows"
          :key="row.meta.id"
          type="button"
          class="cm-map"
          :class="{
            'cm-map--cursor': i === cursor,
            'cm-row--shake': i === shakeRow,
            'cm-map--selected': row.selected,
            'cm-map--conflict': row.conflict,
          }"
          :style="{'--map-accent': row.meta.accent}"
          @click="$emit('activate', i)"
          @mousemove="$emit('hover', i)"
        >
          <span class="cm-map__thumb">
            <premium-map-fingerprint :map-id="boardId(row.meta)" :random="row.meta.random" :accent="row.meta.accent" variant="card" />
          </span>
          <span class="cm-map__name">{{ $t(row.meta.labelKey) }}</span>
          <span v-if="row.selected" class="cm-map__current">{{ $t('Current map') }}</span>
        </button>
      </div>
    </div>
    <div class="cm-maps__detail">
      <span v-if="cursorRow !== undefined && cursorRow.conflict" class="cm-row__issue">{{ $t(boardBlocker) }}</span>
      <template v-else-if="cursorRow !== undefined">
        <span class="cm-maps__detail-name">{{ $t(cursorRow.meta.labelKey) }}</span>
        <span class="cm-maps__detail-desc">{{ $t(cursorRow.meta.descKey) }}</span>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * MAP deck renderer (console create) — a horizontal map carousel (◄ ►):
 * fingerprint thumbnails slide under a centred cursor, the CURRENT map keeps
 * a gold "current" chip wherever the cursor is, A selects the cursored map.
 * The detail line under the strip describes the cursored map (or the MarsBot
 * board blocker). Pure presentation.
 */
import {defineComponent, PropType} from 'vue';
import {MapRow} from '@/client/console/menu/consoleCreateModel';
import {automaBlockerText} from '@/client/components/create/premium/createGameState';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import {PremiumMapMeta} from '@/client/components/create/premium/createGameMeta';
import {BoardName} from '@/common/boards/BoardName';

/** Card slot width incl. gap — keep in sync with `.cm-map` in console_menu.less. */
const CARD_SLOT_PX = 236;

export default defineComponent({
  name: 'ConsoleMapDeck',
  components: {PremiumMapFingerprint},
  props: {
    rows: {type: Array as PropType<ReadonlyArray<MapRow>>, required: true},
    cursor: {type: Number, required: true},
    shakeRow: {type: Number, default: -1},
  },
  emits: ['activate', 'hover'],
  computed: {
    cursorRow(): MapRow | undefined {
      return this.rows[this.cursor];
    },
    boardBlocker(): string {
      return automaBlockerText('board');
    },
    stripStyle(): Record<string, string> {
      // The strip's left edge is pinned at the viewport centre (CSS left:50%);
      // shift it left by the cursor card's centre so that card lands centred.
      const offset = (this.cursor + 0.5) * CARD_SLOT_PX;
      return {transform: `translateX(-${offset}px)`};
    },
  },
  methods: {
    boardId(meta: PremiumMapMeta): BoardName | undefined {
      return meta.random ? undefined : meta.id as BoardName;
    },
  },
});
</script>
