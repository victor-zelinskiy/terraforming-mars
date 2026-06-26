<template>
  <teleport to="body">
    <div v-if="shouldShow" class="board-cell-popover" :class="{'board-cell-popover--below': below}" :style="popoverStyle">
      <!-- Header: a compact TYPE badge + owner on the top row, the NAME on its
           own line below (named special/composite tiles) — never a colon that
           can orphan-wrap. Ordinary cells keep the single-row look. -->
      <div class="board-cell-popover__head" :class="{'board-cell-popover__head--named': tileName !== undefined}">
        <div class="board-cell-popover__head-top">
          <span class="board-cell-popover__status" :class="'board-cell-popover__status--' + status.content"></span>
          <span class="board-cell-popover__title" v-i18n>{{ headerTitle }}</span>
          <span v-if="ownerColor !== undefined" class="board-cell-popover__owner-dot" :class="'player_bg_color_' + ownerColor"></span>
          <span v-if="ownerName !== undefined" class="board-cell-popover__owner" v-i18n>{{ ownerName }}</span>
        </div>
        <div v-if="tileName !== undefined" class="board-cell-popover__name" v-i18n>{{ tileName }}</div>
      </div>

      <!-- Composite-tile rules tag (Capital → city; New Holland → city + ocean). -->
      <div v-if="countsAsLabels.length > 0" class="board-cell-popover__countsas">
        <span class="board-cell-popover__countsas-label" v-i18n>Counts as</span>
        <span v-for="(c, i) in countsAsLabels" :key="c" class="board-cell-popover__countsas-tag">
          <span v-i18n>{{ c }}</span><span v-if="i < countsAsLabels.length - 1">, </span>
        </span>
      </div>

      <!-- Curated named-cell lore (flavour + the real placement rule). Hidden for
           an OCCUPIED off-Mars slot — its "only X can be placed here" text is
           stale once the tile is down; the external-area note explains it. -->
      <div v-if="loreInfo !== undefined && status.external !== true" class="board-cell-popover__lore" v-i18n>{{ loreInfo.description }}</div>

      <!-- Off the Mars surface: why normal adjacency/scoring doesn't apply. -->
      <div v-for="fact in externalFacts" :key="fact.id" class="board-cell-popover__external">
        <div class="board-cell-popover__external-head" v-i18n>{{ fact.title }}</div>
        <div v-if="fact.description !== undefined" class="board-cell-popover__external-desc" v-i18n>{{ fact.description }}</div>
      </div>

      <!-- Passive one-liner (never "Вы получите" — this is hover, not an action). -->
      <div v-if="description !== undefined" class="board-cell-popover__desc" v-i18n>{{ description }}</div>

      <!-- Hazard zone — identity (erosion / dust storm), how to clear it (+TR,
           cleanup cost) and the adjacent-placement production penalty. -->
      <div v-if="hazardFacts.length > 0" class="board-cell-popover__section board-cell-popover__section--hazard">
        <div class="board-cell-popover__section-head" v-i18n>Hazard zone</div>
        <board-fact-row v-for="fact in hazardFacts" :key="fact.id" :fact="fact" />
      </div>

      <!-- Ares adjacency SOURCE — what a neighbour + this tile's owner earn when
           a tile is placed next to it. -->
      <div v-if="adjacencyBonusFacts.length > 0" class="board-cell-popover__section board-cell-popover__section--adjacency">
        <div class="board-cell-popover__section-head" v-i18n>Adjacency bonus</div>
        <board-fact-row v-for="fact in adjacencyBonusFacts" :key="fact.id" :fact="fact" />
      </div>

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

      <!-- Special map zones — the standing rule (+ deflection status block below). -->
      <div v-for="fact in zoneFacts" :key="fact.id" class="board-cell-popover__zone">
        <div class="board-cell-popover__zone-head" v-i18n>{{ fact.title }}</div>
        <div v-if="fact.description !== undefined" class="board-cell-popover__zone-effect">
          <span class="board-cell-popover__zone-label" v-i18n>Effect</span>
          <span v-i18n>{{ fact.description }}</span>
        </div>
      </div>

      <!-- Asteroid Deflection Zone — who is currently protected from plant loss. -->
      <div v-if="zoneProtection !== undefined" class="board-cell-popover__section">
        <div class="board-cell-popover__section-head" v-i18n>Plant protection</div>
        <div v-for="s in zoneProtection.statuses" :key="s.color" class="board-cell-popover__zone-player">
          <span class="board-cell-popover__owner-dot board-cell-popover__zone-dot" :class="'player_bg_color_' + s.color"></span>
          <span class="board-cell-popover__zone-name" v-i18n>{{ playerName(s.color) }}</span>
          <span class="board-cell-popover__zone-badge" :class="statusClass(s.status)" v-i18n>{{ statusLabel(s.status) }}</span>
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
import {getSpecialCellInfo, SpecialCellInfo} from '@/client/components/board/specialCellInfo';
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
      return this.facts.filter((f) => f.category === 'city-greenery-scoring' || f.category === 'future-scoring');
    },
    zoneFacts(): ReadonlyArray<BoardFact> {
      return this.facts.filter((f) => f.category === 'map-special-zone');
    },
    externalFacts(): ReadonlyArray<BoardFact> {
      return this.facts.filter((f) => f.category === 'external-area');
    },
    reservedFacts(): ReadonlyArray<BoardFact> {
      return this.facts.filter((f) => f.category === 'reserved-area' || f.category === 'restriction');
    },
    // Ares hazard facts (identity / cleanup / adjacency penalty) — own section.
    hazardFacts(): ReadonlyArray<BoardFact> {
      return this.facts.filter((f) => f.category === 'hazard-penalty' || f.category === 'hazard-cleanup');
    },
    // Ares adjacency-SOURCE facts (what neighbours / the owner earn) — own section.
    adjacencyBonusFacts(): ReadonlyArray<BoardFact> {
      return this.facts.filter((f) => f.category === 'ares-adjacency-bonus' || f.category === 'tile-owner-benefit');
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
      // Name a SPECIAL / composite tile (Capital, New Holland, volcanoes, …) or a
      // standalone special-tile cell. An ORDINARY city/ocean/greenery (special !==
      // true) stays nameless so the city tooltip reads exactly as before.
      if (this.status.special !== true && this.status.content !== 'special-tile') {
        return undefined;
      }
      const label = this.status.tileLabel;
      return typeof label === 'string' && label !== '' ? label : undefined;
    },
    // What a composite tile counts AS for rules/scoring (Capital → city; New
    // Holland → city + ocean). Empty for an ordinary tile → no "Counts as" line.
    countsAsLabels(): ReadonlyArray<string> {
      const map: Record<string, string> = {city: 'City', ocean: 'Ocean', greenery: 'Greenery'};
      return (this.status.countsAs ?? []).map((c) => map[c]).filter((s) => s !== undefined);
    },
    // Per-player Asteroid-Deflection-Zone plant-protection status.
    zoneProtection() {
      return this.info?.zoneProtection;
    },
    // Curated named-cell lore (volcanoes / Noctis / off-Mars colonies), folded
    // into the unified inspector so a named cell shows BOTH its identity AND its
    // tile bonuses / owner / scoring (instead of a separate lore-only overlay).
    loreInfo(): SpecialCellInfo | undefined {
      const spaceId = boardInfoState.spaceId;
      const boardName = this.cfg.boardName;
      if (spaceId === undefined || boardName === undefined) {
        return undefined;
      }
      return getSpecialCellInfo(spaceId, boardName);
    },
    headerTitle(): string {
      // A named cell's curated title wins the header (e.g. "Гора Аполлинарис") —
      // EXCEPT an OCCUPIED off-Mars slot, where the tile identity (kind badge +
      // name line) replaces the empty-cell "only X can be placed here" lore.
      if (this.loreInfo !== undefined && this.status.external !== true) {
        return this.loreInfo.title;
      }
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
  methods: {
    playerName(color: Color): string {
      return this.cfg.players.find((p) => p.color === color)?.name ?? color;
    },
    statusLabel(status: string): string {
      switch (status) {
      case 'active': return 'Protected';
      case 'inactive-has-tiles-outside': return 'Tiles outside the zone';
      default: return 'No tiles in the zone';
      }
    },
    statusClass(status: string): string {
      return status === 'active' ?
        'board-cell-popover__zone-badge--active' :
        'board-cell-popover__zone-badge--inactive';
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
  flex-direction: column;
  gap: 3px;
}
.board-cell-popover__head:not(:last-child) {
  padding-bottom: 7px;
  margin-bottom: 7px;
  border-bottom: 1px solid rgba(120, 200, 255, 0.18);
}
.board-cell-popover__head-top {
  display: flex;
  align-items: center;
  gap: 7px;
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
// Named special/composite tile: the type label reads as a compact BADGE, the
// name lives on its own line below (wraps cleanly, no orphan colon).
.board-cell-popover__head--named .board-cell-popover__title {
  font-size: 10.5px;
  padding: 1px 7px;
  border-radius: 5px;
  background: rgba(120, 200, 255, 0.12);
  border: 1px solid rgba(120, 200, 255, 0.22);
  color: #cfe6fb;
}
.board-cell-popover__name {
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.18;
  color: #eaf4fd;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
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
.board-cell-popover__lore {
  font-size: 11.5px;
  line-height: 1.35;
  color: rgba(206, 226, 242, 0.78);
}
.board-cell-popover__lore + .board-cell-popover__desc,
.board-cell-popover__lore + .board-cell-popover__section {
  margin-top: 7px;
}
.board-cell-popover__external {
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 7px;
  background: rgba(150, 180, 200, 0.08);
  border: 1px solid rgba(150, 180, 200, 0.18);
}
.board-cell-popover__external-head {
  font-family: 'Prototype', sans-serif;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(170, 200, 224, 0.82);
  margin-bottom: 2px;
}
.board-cell-popover__external-desc {
  font-size: 11.5px;
  line-height: 1.35;
  color: rgba(200, 222, 240, 0.8);
}
.board-cell-popover__section {
  margin-top: 8px;
}
.board-cell-popover__section--hazard .board-cell-popover__section-head {
  color: #f0a085;
  border-bottom-color: rgba(224, 106, 74, 0.3);
}
.board-cell-popover__section--adjacency .board-cell-popover__section-head {
  color: #7fe0c4;
  border-bottom-color: rgba(95, 214, 180, 0.3);
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
.board-cell-popover__countsas {
  margin-top: 5px;
  font-size: 11px;
  color: rgba(206, 226, 242, 0.82);
}
.board-cell-popover__countsas-label {
  margin-right: 5px;
  font-size: 9.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(150, 192, 224, 0.85);
  &::after { content: ':'; }
}
.board-cell-popover__countsas-tag {
  color: #cfe6fb;
}
.board-cell-popover__zone-player {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
}
.board-cell-popover__zone-dot {
  margin-left: 0;
  width: 9px;
  height: 9px;
}
.board-cell-popover__zone-name {
  font-size: 11.5px;
  color: rgba(220, 236, 247, 0.86);
}
.board-cell-popover__zone-badge {
  margin-left: auto;
  font-size: 10px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 1px 7px;
  border-radius: 9px;
  &--active {
    color: #bff7c4;
    background: rgba(95, 191, 87, 0.18);
    border: 1px solid rgba(95, 191, 87, 0.4);
  }
  &--inactive {
    color: rgba(200, 222, 240, 0.6);
    background: rgba(150, 180, 200, 0.1);
    border: 1px solid rgba(150, 180, 200, 0.22);
  }
}
</style>
