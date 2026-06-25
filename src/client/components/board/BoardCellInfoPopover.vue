<template>
  <teleport to="body">
    <div v-if="shouldShow" class="board-cell-popover" :class="{'board-cell-popover--below': below}" :style="popoverStyle">
      <div class="board-cell-popover__head">
        <span class="board-cell-popover__status" :class="'board-cell-popover__status--' + status.content"></span>
        <span class="board-cell-popover__title" v-i18n>{{ headerTitle }}</span>
        <span v-if="tileName !== undefined" class="board-cell-popover__name">: <span v-i18n>{{ tileName }}</span></span>
        <span v-if="ownerColor !== undefined" class="board-cell-popover__owner-dot" :class="'player_bg_color_' + ownerColor"></span>
        <span v-if="ownerName !== undefined" class="board-cell-popover__owner" v-i18n>{{ ownerName }}</span>
      </div>

      <!-- Passive one-liner (never "Вы получите" — this is hover, not an action). -->
      <div v-if="description !== undefined" class="board-cell-popover__desc" v-i18n>{{ description }}</div>

      <!-- What placing a tile HERE would grant (passive). -->
      <div v-if="placeHereFacts.length > 0" class="board-cell-popover__section">
        <div class="board-cell-popover__section-head" v-i18n>When placing here</div>
        <board-fact-row v-for="fact in placeHereFacts" :key="fact.id" :fact="fact" />
      </div>

      <!-- The neighbour rule (ocean adjacency — an adjacency SOURCE). -->
      <div v-if="adjacentFacts.length > 0" class="board-cell-popover__section">
        <div class="board-cell-popover__section-head" v-i18n>Adjacent placement</div>
        <board-fact-row v-for="fact in adjacentFacts" :key="fact.id" :fact="fact" />
      </div>

      <!-- Endgame scoring, grouped by recipient (ВЫ / opponent name). -->
      <board-fact-groups
        v-if="scoringFacts.length > 0"
        :facts="scoringFacts"
        :viewerColor="cfg.color"
        :players="cfg.players" />

      <!-- Special map zones — Сейчас (status) + Эффект (rule). -->
      <div v-for="fact in zoneFacts" :key="fact.id" class="board-cell-popover__zone">
        <div class="board-cell-popover__zone-head" v-i18n>{{ fact.title }}</div>
        <div v-if="fact.id === 'deflection-zone'" class="board-cell-popover__zone-now">
          <span class="board-cell-popover__zone-label" v-i18n>Now</span>
          <span v-i18n>Does not change placement here.</span>
        </div>
        <div v-if="fact.description !== undefined" class="board-cell-popover__zone-effect">
          <span class="board-cell-popover__zone-label" v-i18n>Effect</span>
          <span v-i18n>{{ fact.description }}</span>
        </div>
      </div>

      <!-- Reserved / restricted — the plain rule line. -->
      <div v-for="fact in reservedFacts" :key="fact.id" class="board-cell-popover__rule" v-i18n>{{ fact.description }}</div>
    </div>
  </teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {boardInfoState} from '@/client/components/board/boardInfoState';
import {BoardCellInfo, BoardCellStatus, BoardFact} from '@/common/boards/BoardInformationFacts';
import {Color} from '@/common/Color';
import BoardFactGroups from '@/client/components/board/BoardFactGroups.vue';
import BoardFactRow from '@/client/components/board/BoardFactRow.vue';

export default defineComponent({
  name: 'BoardCellInfoPopover',
  components: {BoardFactGroups, BoardFactRow},
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
    description(): string | undefined {
      const d = this.info?.description;
      return typeof d === 'string' ? d : undefined;
    },
    // Section partitions — passive framing for placement hints, recipient
    // grouping only for endgame scoring.
    placeHereFacts(): ReadonlyArray<BoardFact> {
      return this.facts.filter((f) => f.category === 'printed-placement-bonus' || f.category === 'placement-effect');
    },
    adjacentFacts(): ReadonlyArray<BoardFact> {
      return this.facts.filter((f) => f.category === 'ocean-adjacency-bonus');
    },
    scoringFacts(): ReadonlyArray<BoardFact> {
      return this.facts.filter((f) => f.category === 'city-greenery-scoring');
    },
    zoneFacts(): ReadonlyArray<BoardFact> {
      return this.facts.filter((f) => f.category === 'map-special-zone');
    },
    reservedFacts(): ReadonlyArray<BoardFact> {
      return this.facts.filter((f) => f.category === 'reserved-area' || f.category === 'restriction');
    },
    shouldShow(): boolean {
      if (this.info === undefined || boardInfoState.spaceId === undefined) {
        return false;
      }
      // A tile-placement prompt owns whole-cell hover (SelectSpace's reason /
      // preview popovers) — don't double up.
      if (typeof document !== 'undefined' && document.querySelector('.board-space--available') !== null) {
        return false;
      }
      // Every cell now carries a header → the inspector is always meaningful.
      return true;
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
    tileName(): string | undefined {
      if (this.status.content !== 'special-tile') {
        return undefined;
      }
      const label = this.status.tileLabel;
      return typeof label === 'string' && label !== '' ? label : undefined;
    },
    headerTitle(): string {
      const h = this.status.header;
      if (typeof h === 'string' && h !== '') {
        return h;
      }
      return 'Empty space';
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
  min-width: 190px;
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
}
.board-cell-popover__head:not(:last-child) {
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
.board-cell-popover__name {
  font-size: 12px;
  color: #cfe6fb;
  text-transform: uppercase;
  letter-spacing: 0.02em;
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
.board-cell-popover__desc {
  font-size: 11.5px;
  color: rgba(200, 222, 240, 0.82);
}
.board-cell-popover__section {
  margin-top: 8px;
}
.board-cell-popover__section-head {
  font-family: 'Prototype', sans-serif;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(150, 192, 224, 0.72);
  margin-bottom: 3px;
  padding-bottom: 3px;
  border-bottom: 1px solid rgba(120, 200, 255, 0.14);
}
.board-cell-popover__zone {
  margin-top: 8px;
}
.board-cell-popover__zone-head {
  font-family: 'Prototype', sans-serif;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(150, 192, 224, 0.72);
  margin-bottom: 4px;
}
.board-cell-popover__zone-now,
.board-cell-popover__zone-effect {
  font-size: 11.5px;
  color: rgba(200, 222, 240, 0.82);
  margin-top: 2px;
}
.board-cell-popover__zone-label {
  display: inline-block;
  margin-right: 5px;
  font-size: 9.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(150, 192, 224, 0.85);
  &::after { content: ':'; }
}
.board-cell-popover__rule {
  margin-top: 6px;
  font-size: 11.5px;
  color: rgba(200, 222, 240, 0.82);
}
</style>
