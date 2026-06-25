<template>
  <teleport to="body">
    <div v-if="shouldShow" class="board-cell-popover" :class="{'board-cell-popover--below': below}" :style="popoverStyle">
      <div class="board-cell-popover__head">
        <span class="board-cell-popover__status" :class="'board-cell-popover__status--' + status.content"></span>
        <span class="board-cell-popover__title" v-i18n>{{ headerTitle }}</span>
        <span v-if="ownerColor !== undefined" class="board-cell-popover__owner-dot" :class="'player_bg_color_' + ownerColor"></span>
        <span v-if="ownerName !== undefined" class="board-cell-popover__owner" v-i18n>{{ ownerName }}</span>
      </div>
      <board-fact-groups
        v-if="facts.length > 0"
        :facts="facts"
        :viewerColor="cfg.color"
        :players="cfg.players" />
    </div>
  </teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {boardInfoState} from '@/client/components/board/boardInfoState';
import {BoardCellInfo, BoardCellStatus, BoardFact} from '@/common/boards/BoardInformationFacts';
import {Color} from '@/common/Color';
import BoardFactGroups from '@/client/components/board/BoardFactGroups.vue';

export default defineComponent({
  name: 'BoardCellInfoPopover',
  components: {BoardFactGroups},
  data() {
    return {
      boardInfoState,
    };
  },
  computed: {
    info(): BoardCellInfo | undefined {
      return boardInfoState.info;
    },
    cfg() {
      return boardInfoState.cfg;
    },
    status(): BoardCellStatus {
      return this.info?.status ?? {content: 'empty'};
    },
    facts(): ReadonlyArray<BoardFact> {
      return this.info?.facts ?? [];
    },
    shouldShow(): boolean {
      const info = this.info;
      if (info === undefined || boardInfoState.spaceId === undefined) {
        return false;
      }
      // A tile-placement prompt owns whole-cell hover (SelectSpace's reason
      // popover) — don't double up.
      if (typeof document !== 'undefined' && document.querySelector('.board-space--available') !== null) {
        return false;
      }
      const s = info.status;
      return info.facts.length > 0 ||
        s.content !== 'empty' ||
        s.reserved !== undefined ||
        s.ownerColor !== undefined;
    },
    ownerColor(): Color | undefined {
      return this.status.ownerColor;
    },
    ownerName(): string | undefined {
      const color = this.status.ownerColor;
      if (color === undefined) {
        return undefined;
      }
      return this.cfg.players.find((p) => p.color === color)?.name ?? color;
    },
    headerTitle(): string {
      const s = this.status;
      if (s.reserved !== undefined && s.spaceTypeLabel !== undefined) {
        return typeof s.spaceTypeLabel === 'string' ? s.spaceTypeLabel : '';
      }
      switch (s.content) {
      case 'city': return 'City';
      case 'greenery': return 'Greenery';
      case 'ocean': return 'Ocean tile';
      case 'special-tile': return 'Special tile';
      case 'hazard': return 'Hazard';
      case 'empty':
      default:
        return typeof s.spaceTypeLabel === 'string' ? s.spaceTypeLabel : 'Empty space';
      }
    },
    cellRect(): DOMRect | undefined {
      const spaceId = boardInfoState.spaceId;
      if (spaceId === undefined || typeof document === 'undefined') {
        return undefined;
      }
      const el = document.querySelector(`[data_space_id="${spaceId}"]`);
      return el === null ? undefined : el.getBoundingClientRect();
    },
    below(): boolean {
      const rect = this.cellRect;
      return rect !== undefined && rect.top <= 240;
    },
    popoverStyle(): Record<string, string> {
      const rect = this.cellRect;
      if (rect === undefined) {
        return {};
      }
      const vw = window.innerWidth;
      const cx = Math.min(Math.max(rect.left + rect.width / 2, 160), vw - 160);
      if (this.below) {
        return {left: `${cx}px`, top: `${rect.bottom + 10}px`, transform: 'translate(-50%, 0)'};
      }
      return {left: `${cx}px`, top: `${rect.top - 10}px`, transform: 'translate(-50%, -100%)'};
    },
  },
});
</script>

<style scoped lang="less">
.board-cell-popover {
  position: fixed;
  z-index: 109;
  pointer-events: none;
  max-width: 320px;
  min-width: 200px;
  padding: 10px 12px;
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(16, 26, 38, 0.97), rgba(12, 19, 30, 0.97));
  border: 1px solid rgba(120, 200, 255, 0.32);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.4);
  color: #dfeefa;
  font-size: 12.5px;
  line-height: 1.3;
  animation: board-cell-popover-in 120ms ease-out;
}

@keyframes board-cell-popover-in {
  from { opacity: 0; transform: translate(-50%, -100%) scale(0.96); }
}
.board-cell-popover--below {
  animation-name: board-cell-popover-in-below;
}
@keyframes board-cell-popover-in-below {
  from { opacity: 0; transform: translate(-50%, 0) scale(0.96); }
}

.board-cell-popover__head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-bottom: 7px;
  margin-bottom: 7px;
  border-bottom: 1px solid rgba(120, 200, 255, 0.18);
}
.board-cell-popover__status {
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  border-radius: 2px;
  background: rgba(150, 180, 200, 0.6);
  &--ocean { background: #5aa6e0; }
  &--city { background: #d8a23a; }
  &--greenery { background: #5fbf57; }
  &--special-tile { background: #b07ae0; }
  &--hazard { background: #e06a4a; }
}
.board-cell-popover__title {
  font-family: 'Prototype', sans-serif;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  font-size: 12px;
  color: #eaf4fd;
}
.board-cell-popover__owner-dot {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-left: auto;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
}
.board-cell-popover__owner {
  font-size: 11px;
  color: rgba(220, 236, 247, 0.78);
}
</style>
