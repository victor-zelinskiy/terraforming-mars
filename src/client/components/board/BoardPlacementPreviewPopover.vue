<template>
  <teleport to="body">
    <transition name="board-preview-fade">
      <div
        v-if="preview !== undefined && anchor !== undefined"
        class="board-preview-host"
        :style="hostStyle">
        <div class="board-preview-host__card">
          <div class="board-preview-host__title" v-i18n>{{ titleKey }}</div>
          <board-placement-preview-content :preview="preview" :viewerColor="viewerColor" :players="players" />
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import BoardPlacementPreviewContent from '@/client/components/board/BoardPlacementPreviewContent.vue';

const KIND_TITLE: Record<string, string> = {
  city: 'Place a city',
  greenery: 'Place a greenery',
  ocean: 'Place an ocean',
  'upgradeable-ocean': 'Place an ocean tile',
  'upgradeable-ocean-new-holland': 'Place an ocean tile',
};

/**
 * Floating preview shown next to a hovered LEGAL board cell during a placement
 * prompt — the consequences before the player clicks (cost / gains / who-gets-
 * what / endgame VP / risk / rules). Anchored by the cell's screen rect (the
 * board is scaled/translated), teleported to body, flips above/below + clamps.
 * The illegal-cell twin is `PlacementReasonPopover`.
 */
export default defineComponent({
  name: 'BoardPlacementPreviewPopover',
  components: {BoardPlacementPreviewContent},
  props: {
    preview: {
      type: Object as PropType<BoardPlacementPreview | undefined>,
      default: undefined,
    },
    anchor: {
      type: Object as PropType<DOMRect | undefined>,
      default: undefined,
    },
    viewerColor: {
      type: String as PropType<Color | undefined>,
      default: undefined,
    },
    players: {
      type: Array as PropType<ReadonlyArray<PublicPlayerModel>>,
      default: () => [],
    },
  },
  computed: {
    titleKey(): string {
      return KIND_TITLE[this.preview?.kind ?? ''] ?? 'Place a tile';
    },
    hostStyle(): Record<string, string> {
      const a = this.anchor;
      if (a === undefined) {
        return {display: 'none'};
      }
      const maxW = 330;
      const margin = 8;
      const cx = a.left + a.width / 2;
      const left = Math.min(
        Math.max(cx, maxW / 2 + margin),
        window.innerWidth - maxW / 2 - margin);
      const above = a.top > 280;
      const top = above ? a.top - 10 : a.bottom + 10;
      return {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        transform: `translate(-50%, ${above ? '-100%' : '0'})`,
      };
    },
  },
});
</script>

<style scoped lang="less">
.board-preview-host {
  position: fixed;
  z-index: 109;
  pointer-events: none;
}
.board-preview-host__card {
  max-width: 330px;
  min-width: 210px;
  padding: 11px 13px;
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(16, 26, 38, 0.98), rgba(12, 19, 30, 0.98));
  border: 1px solid rgba(120, 200, 255, 0.34);
  box-shadow: 0 16px 38px rgba(0, 0, 0, 0.6);
  color: #dfeefa;
}
.board-preview-host__title {
  font-family: 'Prototype', sans-serif;
  font-size: 12.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #eaf4fd;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(120, 200, 255, 0.2);
}
.board-preview-fade-enter-active,
.board-preview-fade-leave-active {
  transition: opacity 120ms ease;
}
.board-preview-fade-enter-from,
.board-preview-fade-leave-to {
  opacity: 0;
}
</style>
