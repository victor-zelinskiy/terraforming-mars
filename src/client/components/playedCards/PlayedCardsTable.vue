<template>
  <div class="played-table">
    <div class="played-table__head" role="row">
      <button
        v-for="col in columns"
        :key="col.key"
        type="button"
        class="played-table__th"
        :class="['played-table__cell--' + col.key, {'played-table__th--sortable': col.sort !== null, 'played-table__th--active': col.sort !== null && col.sort === sortKey}]"
        :disabled="col.sort === null"
        @click="col.sort !== null && setSort(col.sort)">
        <span v-if="col.label" v-i18n>{{ col.label }}</span>
        <span v-else>#</span>
        <span v-if="col.sort !== null && col.sort === sortKey" class="played-table__sort-ind" aria-hidden="true">{{ sortDir === 1 ? '▲' : '▼' }}</span>
      </button>
    </div>

    <div class="played-table__scroll">
      <PlayedCardsTableRow
        v-for="row in sortedRows"
        :key="row.card.name"
        :card="row.card"
        :accent="row.accent"
        :typeLabel="row.typeLabel"
        :order="row.order"
        @open="$emit('open', $event)"
        @namehover="onNameHover" />
    </div>

    <CardPreviewPopover :name="hoverName" :visible="hoverVisible" :anchor="hoverAnchor" />
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {PlayedGroupKey} from '@/client/components/playedCards/playedCardGroups';
import PlayedCardsTableRow from '@/client/components/playedCards/PlayedCardsTableRow.vue';
import CardPreviewPopover from '@/client/components/journal/CardPreviewPopover.vue';

export type PlayedTableRow = {
  card: import('@/common/models/CardModel').CardModel;
  accent: PlayedGroupKey;
  typeLabel: string;
  order: number;
};

type SortKey = 'order' | 'type' | 'name' | 'cost' | 'vp';
type Column = {key: string; label: string; sort: SortKey | null};

const TYPE_RANK: Record<PlayedGroupKey, number> = {
  corporation: 0, prelude: 1, ceo: 2, active: 3, automated: 4, event: 5,
};

const COLUMNS: ReadonlyArray<Column> = [
  {key: 'order', label: '', sort: 'order'},
  {key: 'type', label: 'Type', sort: 'type'},
  {key: 'name', label: 'Name', sort: 'name'},
  {key: 'tags', label: 'Tags', sort: null},
  {key: 'cost', label: 'Cost', sort: 'cost'},
  {key: 'vp', label: 'VP', sort: 'vp'},
  {key: 'res', label: 'Resources', sort: null},
];

const HOVER_DELAY = 170;

type DataModel = {
  sortKey: SortKey;
  sortDir: 1 | -1;
  hoverName: CardName;
  hoverAnchor: DOMRect | undefined;
  hoverVisible: boolean;
  hoverTimer: number | undefined;
  blockHover: boolean;
  blockTimer: number | undefined;
};

/**
 * Modern data-table view of the played cards (the "ТАБЛИЦА" mode). HUD
 * glass rows, colour-chip per type, sortable headers, a single shared
 * `CardPreviewPopover` on name hover and click-to-fullscreen — NOT a
 * legacy HTML table. Rows derive their own analytic cells; this component
 * owns sorting + the shared hover preview.
 */
export default defineComponent({
  name: 'PlayedCardsTable',
  components: {PlayedCardsTableRow, CardPreviewPopover},
  props: {
    rows: {
      type: Array as PropType<ReadonlyArray<PlayedTableRow>>,
      required: true,
    },
    // True while the overlay's shared fullscreen card is open — suppresses
    // the hover preview (and a phantom mouseenter when the dialog closes).
    zoomOpen: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['open'],
  data(): DataModel {
    return {
      sortKey: 'order',
      sortDir: 1,
      hoverName: '' as CardName,
      hoverAnchor: undefined,
      hoverVisible: false,
      hoverTimer: undefined,
      blockHover: false,
      blockTimer: undefined,
    };
  },
  computed: {
    columns(): ReadonlyArray<Column> {
      return COLUMNS;
    },
    sortedRows(): ReadonlyArray<PlayedTableRow> {
      const rows = this.rows.slice();
      const dir = this.sortDir;
      const key = this.sortKey;
      rows.sort((a, b) => dir * this.compare(a, b, key));
      return rows;
    },
  },
  watch: {
    // When the fullscreen dialog closes, briefly block hover so the phantom
    // mouseenter the browser fires under a stationary cursor can't re-open
    // the preview.
    zoomOpen(open: boolean) {
      if (!open) {
        this.hideHover();
        this.blockHover = true;
        this.clearBlockTimer();
        this.blockTimer = window.setTimeout(() => {
          this.blockHover = false;
          this.blockTimer = undefined;
        }, 250);
      }
    },
  },
  methods: {
    compare(a: PlayedTableRow, b: PlayedTableRow, key: SortKey): number {
      switch (key) {
      case 'order':
        return a.order - b.order;
      case 'type': {
        const t = TYPE_RANK[a.accent] - TYPE_RANK[b.accent];
        return t !== 0 ? t : a.order - b.order;
      }
      case 'name':
        return this.$t(a.card.name.split(':')[0]).localeCompare(this.$t(b.card.name.split(':')[0]));
      case 'cost':
        return (getCard(a.card.name)?.cost ?? -1) - (getCard(b.card.name)?.cost ?? -1);
      case 'vp': {
        const va = this.vpValue(a.card.name);
        const vb = this.vpValue(b.card.name);
        return va - vb;
      }
      }
    },
    vpValue(name: CardName): number {
      const vp = getCard(name)?.victoryPoints;
      if (typeof vp === 'number') {
        return vp;
      }
      // Variable / special VP sort just above "no VP".
      return vp !== undefined ? 0.5 : -1;
    },
    setSort(key: SortKey): void {
      if (this.sortKey === key) {
        this.sortDir = this.sortDir === 1 ? -1 : 1;
      } else {
        this.sortKey = key;
        this.sortDir = 1;
      }
    },
    onNameHover(payload: {name: CardName, rect: DOMRect} | null): void {
      this.clearHoverTimer();
      if (payload === null) {
        this.hoverVisible = false;
        return;
      }
      if (this.blockHover || this.zoomOpen) {
        return;
      }
      this.hoverName = payload.name;
      this.hoverAnchor = payload.rect;
      this.hoverTimer = window.setTimeout(() => {
        this.hoverVisible = true;
      }, HOVER_DELAY);
    },
    hideHover(): void {
      this.clearHoverTimer();
      this.hoverVisible = false;
    },
    clearHoverTimer(): void {
      if (this.hoverTimer !== undefined) {
        window.clearTimeout(this.hoverTimer);
        this.hoverTimer = undefined;
      }
    },
    clearBlockTimer(): void {
      if (this.blockTimer !== undefined) {
        window.clearTimeout(this.blockTimer);
        this.blockTimer = undefined;
      }
    },
  },
  beforeUnmount(): void {
    this.clearHoverTimer();
    this.clearBlockTimer();
  },
});
</script>
