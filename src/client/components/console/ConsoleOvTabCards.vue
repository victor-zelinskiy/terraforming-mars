<template>
  <!--
    КАРТЫ — the card story of the party, never a wall of thumbnails. A ranked
    impact list (strict PAGES, the album grammar — no scroll container), a
    player filter on ←/→, and ONE premium card face for the focused row in
    the context column (the live tableau CardModel, so stored resources are
    honest). A enlarges the focused card into the nested detail.
  -->
  <div class="con-ovc">
    <!-- Per-player card-VP summary strip + the active filter. -->
    <div class="con-ovc__top">
      <div class="con-ovc__filters">
        <span class="con-ovc__filter" :class="{'con-ovc__filter--on': ui.cardsFilter === -1}">{{ $t('All players') }}</span>
        <span v-for="(p, i) in vm.cards.byPlayer" :key="p.color"
              class="con-ovc__filter" :class="{'con-ovc__filter--on': ui.cardsFilter === i}">
          <span class="con-egov-legend__dot" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>
          <span class="con-ovc__filter-name">{{ p.name }}</span>
          <b class="con-ovc__filter-vp">{{ p.cardsVp }}</b>
        </span>
      </div>
      <div v-if="pageCount > 1" class="con-ovc__pager">{{ $t('Page') }} <b>{{ page + 1 }}</b>/{{ pageCount }}</div>
    </div>

    <div v-if="filteredRows.length > 0" class="con-ovc__body">
      <!-- The impact list — one strict page of rows. -->
      <div class="con-ovc__list">
        <div v-for="(row, i) in pageRows" :key="row.id"
             class="con-ovc__row"
             :class="{'con-ovc__row--focused': page * pageSize + i === focusIdx, 'con-ovc__row--penalty': row.vp < 0}"
             :style="{'--ov-pc': hex(row.owner)}">
          <span class="con-ovc__rank">{{ rankOf(row) }}</span>
          <span class="con-egov-legend__dot" :class="'player_bg_color_' + row.owner" aria-hidden="true"></span>
          <span class="con-ovc__kind" :class="'con-eg-cat--' + kindAccent(row.kind)" aria-hidden="true"></span>
          <span class="con-ovc__name">{{ $t(row.cardName) }}</span>
          <b class="con-ovc__vp" :class="{'con-ovc__vp--neg': row.vp < 0}">{{ row.vp > 0 ? '+' + row.vp : '−' + Math.abs(row.vp) }}</b>
        </div>
      </div>

      <!-- The context column: the focused card, full premium face. -->
      <div class="con-ovc__context">
        <div class="con-ovc__card" :key="focusedRow !== undefined ? focusedRow.id : 'none'">
          <Card v-if="focusedCardModel !== undefined" :card="focusedCardModel" :key="cardKey" lightweight />
        </div>
        <div v-if="focusedRow !== undefined" class="con-ovc__impact">
          <span class="con-ovc__impact-owner">
            <span class="con-egov-legend__dot" :class="'player_bg_color_' + focusedRow.owner" aria-hidden="true"></span>
            {{ focusedRow.ownerName }}
          </span>
          <span class="con-ovc__impact-kind">{{ $t(kindLabel(focusedRow.kind)) }}</span>
          <b class="con-ovc__impact-vp" :class="{'con-ovc__vp--neg': focusedRow.vp < 0}">
            {{ focusedRow.vp > 0 ? '+' + focusedRow.vp : '−' + Math.abs(focusedRow.vp) }} {{ $t('VP') }}
          </b>
        </div>
      </div>
    </div>

    <!-- EMPTY STATE — nobody scored from cards. -->
    <div v-else class="con-egov-empty">
      <div class="con-egov-empty__title">{{ $t('No victory points from cards.') }}</div>
      <div class="con-egov-empty__note">{{ $t('This game was decided on the board and the rating track.') }}</div>
    </div>

    <!-- NESTED DETAIL — the enlarged card. -->
    <div v-if="detailRow !== undefined" class="con-egov-detail con-ovc__detail">
      <div class="con-ovc__detail-card">
        <Card v-if="detailCardModel !== undefined" :card="detailCardModel" :key="'d' + detailRow.id" />
      </div>
      <div class="con-ovc__detail-side">
        <div class="con-egov-detail__title">{{ $t(detailRow.cardName) }}</div>
        <div class="con-ovc__impact-owner">
          <span class="con-egov-legend__dot" :class="'player_bg_color_' + detailRow.owner" aria-hidden="true"></span>
          {{ detailRow.ownerName }}
        </div>
        <div class="con-ovc__impact-kind">{{ $t(kindLabel(detailRow.kind)) }}</div>
        <b class="con-ovc__impact-vp con-ovc__impact-vp--big" :class="{'con-ovc__vp--neg': detailRow.vp < 0}">
          {{ detailRow.vp > 0 ? '+' + detailRow.vp : '−' + Math.abs(detailRow.vp) }} {{ $t('VP') }}
        </b>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardVictoryPointsKind} from '@/common/game/VictoryPointsBreakdown';
import {CardModel} from '@/common/models/CardModel';
import {ViewModel} from '@/common/models/PlayerModel';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import type {ConsoleOverviewVm, OvCardRow} from '@/client/console/endgame/consoleOverviewModel';
import {consoleOverviewUi} from '@/client/console/endgame/consoleOverviewState';
import {useConsoleViewport} from '@/client/console/composables/useConsoleViewport';
import Card from '@/client/components/card/CardFace.vue';

const KIND_ACCENT: Record<CardVictoryPointsKind, string> = {
  resource: 'greenery',
  conditional: 'cards',
  fixed: 'city',
  penalty: 'penalty',
};
const KIND_LABEL: Record<CardVictoryPointsKind, string> = {
  resource: 'Resource cards',
  conditional: 'Conditional cards',
  fixed: 'Fixed VP cards',
  penalty: 'Penalties',
};

export default defineComponent({
  name: 'ConsoleOvTabCards',
  components: {Card},
  props: {
    vm: {type: Object as PropType<ConsoleOverviewVm>, required: true},
    playerView: {type: Object as PropType<ViewModel>, required: true},
  },
  setup() {
    const {isHandheld} = useConsoleViewport();
    return {isHandheld};
  },
  computed: {
    ui() {
      return consoleOverviewUi;
    },
    pageSize(): number {
      return this.isHandheld ? 6 : 9;
    },
    filteredRows(): Array<OvCardRow> {
      const f = this.ui.cardsFilter;
      if (f < 0 || f >= this.vm.cards.byPlayer.length) {
        return [...this.vm.cards.rows];
      }
      const color = this.vm.cards.byPlayer[f].color;
      return this.vm.cards.rows.filter((r) => r.owner === color);
    },
    focusIdx(): number {
      return Math.min(Math.max(this.ui.cardsIdx, 0), Math.max(0, this.filteredRows.length - 1));
    },
    page(): number {
      return this.pageSize > 0 ? Math.floor(this.focusIdx / this.pageSize) : 0;
    },
    pageCount(): number {
      return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize));
    },
    pageRows(): Array<OvCardRow> {
      return this.filteredRows.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize);
    },
    focusedRow(): OvCardRow | undefined {
      return this.filteredRows[this.focusIdx];
    },
    focusedCardModel(): CardModel | undefined {
      return this.focusedRow !== undefined ? this.modelFor(this.focusedRow) : undefined;
    },
    cardKey(): string {
      return this.focusedRow !== undefined ? this.focusedRow.id : 'none';
    },
    detailRow(): OvCardRow | undefined {
      const d = this.ui.detail;
      if (d === undefined || d.kind !== 'card') {
        return undefined;
      }
      return this.vm.cards.rows.find((r) => r.id === d.rowId);
    },
    detailCardModel(): CardModel | undefined {
      return this.detailRow !== undefined ? this.modelFor(this.detailRow) : undefined;
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
    kindAccent(kind: CardVictoryPointsKind): string {
      return KIND_ACCENT[kind];
    },
    kindLabel(kind: CardVictoryPointsKind): string {
      return KIND_LABEL[kind];
    },
    rankOf(row: OvCardRow): number {
      return this.filteredRows.indexOf(row) + 1;
    },
    /** The LIVE tableau model when the card is on the owner's board (stored
     *  resources stay honest); a name-only face otherwise (awards etc.). */
    modelFor(row: OvCardRow): CardModel {
      const owner = this.playerView.players.find((p) => p.color === row.owner);
      const live = owner?.tableau.find((c) => c.name === row.cardName);
      return live ?? {name: row.cardName as CardName};
    },
    // ── pane API ──────────────────────────────────────────────────────────
    nav(dir: NavDirection): void {
      if (this.ui.detail !== undefined) {
        return;
      }
      if (dir === 'up' || dir === 'down') {
        const n = this.filteredRows.length;
        if (n > 0) {
          const delta = dir === 'down' ? 1 : -1;
          this.ui.cardsIdx = Math.min(Math.max(this.focusIdx + delta, 0), n - 1);
        }
        return;
      }
      // ←/→ — the player filter ring (ВСЕ → each player, wrapping).
      const total = this.vm.cards.byPlayer.length + 1;
      const cur = this.ui.cardsFilter + 1; // 0 = all
      const delta = dir === 'right' ? 1 : -1;
      this.ui.cardsFilter = ((cur + delta + total) % total) - 1;
      this.ui.cardsIdx = 0;
    },
    primary(): void {
      if (this.focusedRow !== undefined && this.ui.detail === undefined) {
        this.ui.detail = {kind: 'card', rowId: this.focusedRow.id};
      }
    },
  },
});
</script>
