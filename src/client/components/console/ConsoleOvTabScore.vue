<template>
  <!--
    СЧЁТ — the score BOARD (TR69 «ОБЗОР В МАСШТАБЕ»): the places are COLUMNS, each led by the corporation's face, its
    place medal, the name and the total in the score cell's language; the categories are ROWS led by their medallion
    (the dossier's disc and name); every cell is the value with a bar on ONE shared scale, the category's leader
    marked gold. The board fills the opening (the rows share its height — never a 40 % matrix over a dead half). The
    d-pad walks the category rows; the BREAKDOWN of the focused one (РТ / Карты) stands in the same plate, under the
    board, at a fixed height (no layout jump on focus travel). A opens the full per-player breakdown detail.
  -->
  <div class="con-ovs" :style="{'--ov-n': vm.score.ranking.length}">
    <div class="con-ovs__board">
      <!-- THE HEAD ROW — the notes in the corner, the places as faces. -->
      <div class="con-ovs__line con-ovs__line--head">
        <div class="con-ovs__corner">
          <span v-if="vm.score.decisive !== undefined" class="con-ovs__note">
            <span class="con-ovs__note-label">{{ $t('Biggest edge') }}</span>
            <b :class="'con-eg-ink--' + vm.score.decisive.accent">{{ $t(vm.score.decisive.label) }}</b>
            <b class="con-ovs__note-delta">+{{ vm.score.decisive.delta }} {{ $t('VP') }}</b>
          </span>
          <span v-if="vm.score.tieBreak !== undefined" class="con-ovs__note con-ovs__note--tb">{{ $t('Tie on VP — decided on M€') }}</span>
        </div>
        <div v-for="row in vm.score.ranking" :key="row.color"
             class="con-ovs__seat" :class="{'con-ovs__seat--winner': row.isWinner}" :data-ovs-seat="row.color">
          <div class="con-ovs__face">
            <div v-if="row.face !== undefined" class="con-ovs__face-zoom">
              <ConsoleCardFaceLite v-if="row.face.kind === 'card'" :name="row.face.name" />
              <MarsBotCorpFace v-else :id="row.face.id" :resources="0" />
            </div>
            <div v-else class="con-ovs__face-empty" :class="'player_bg_color_' + row.color" aria-hidden="true"></div>
          </div>
          <div class="con-ovs__seat-id">
            <b class="con-ovs__seat-place">{{ row.place }}</b>
            <span class="con-ovs__rdot" :class="'player_bg_color_' + row.color" aria-hidden="true"></span>
            <span class="con-ovs__seat-name">{{ row.name }}</span>
          </div>
          <div class="con-ovs__seat-total">
            <ConsoleVpBadge class="con-ovs__shield" :label="$t('VP')" />
            <b class="con-ovs__seat-vp">{{ row.total }}</b>
          </div>
        </div>
      </div>

      <!-- THE CATEGORY ROWS — one shared scale across every row and player. -->
      <div v-for="(cat, ci) in vm.score.categories" :key="cat.key"
           class="con-ovs__line con-ovs__cat" :class="[{'con-ovs__cat--focused': ui.scoreCat === ci}, 'con-eg-cat--' + cat.accent]"
           :data-ovs-cat="cat.key">
        <div class="con-ovs__cat-head">
          <ConsoleScoreDisc class="con-ovs__disc" :glyph="glyphOf(cat.key)" />
          <span class="con-ovs__cat-name">{{ $t(cat.label) }}</span>
        </div>
        <div v-for="row in vm.score.ranking" :key="row.color" class="con-ovs__cell"
             :class="{'con-ovs__cell--lead': isLeader(cat, row.color), 'con-ovs__cell--zero': (cat.values[row.color] ?? 0) === 0}">
          <b class="con-ovs__cell-val" :class="{'con-ovs__cell-val--neg': (cat.values[row.color] ?? 0) < 0}">{{ fmt(cat.values[row.color] ?? 0) }}</b>
          <span class="con-ovs__pbar-track">
            <span class="con-ovs__pbar-fill"
                  :class="{'con-ovs__pbar-fill--neg': (cat.values[row.color] ?? 0) < 0}"
                  :style="barStyle(cat, row.color)"></span>
          </span>
        </div>
      </div>
    </div>

    <!-- THE BREAKDOWN — the focused category's sources, in the same plate (fixed height: no jump on focus travel). -->
    <div class="con-ovs__context">
      <template v-if="focusedCat !== undefined">
        <div class="con-ovs__ctx-head">
          <ConsoleScoreDisc class="con-ovs__disc con-ovs__disc--sm" :class="'con-eg-cat--' + focusedCat.accent" :glyph="glyphOf(focusedCat.key)" />
          <span class="con-ovs__ctx-title">{{ $t(focusedCat.label) }}</span>
          <span v-if="focusedCat.subs.length > 0" class="con-ovs__ctx-hint">{{ $t('Breakdown') }}</span>
        </div>
        <div v-if="focusedCat.subs.length > 0" class="con-ovs__subs">
          <div v-for="sub in focusedCat.subs" :key="sub.key" class="con-ovs__sub">
            <span class="con-ovs__sub-name">{{ $t(sub.label) }}</span>
            <span v-for="row in vm.score.ranking" :key="row.color" class="con-ovs__sub-val">
              <span class="con-ovs__rdot con-ovs__rdot--sm" :class="'player_bg_color_' + row.color" aria-hidden="true"></span>
              {{ fmt(sub.values[row.color] ?? 0) }}
            </span>
          </div>
        </div>
        <div v-else class="con-ovs__ctx-quiet">{{ $t(quietNote(focusedCat)) }}</div>
      </template>
    </div>

    <!-- NESTED DETAIL — the full per-player breakdown of one category. -->
    <div v-if="detailCat !== undefined" class="con-egov-detail">
      <div class="con-egov-detail__head">
        <ConsoleScoreDisc class="con-ovs__disc con-ovs__disc--sm" :class="'con-eg-cat--' + detailCat.accent" :glyph="glyphOf(detailCat.key)" />
        <span class="con-egov-detail__title">{{ $t(detailCat.label) }}</span>
      </div>
      <div class="con-egov-detail__body con-ovs__dgrid" :style="{'--ov-cols': vm.score.ranking.length}">
        <div class="con-ovs__dcell con-ovs__dcell--head"></div>
        <div v-for="row in vm.score.ranking" :key="'h' + row.color" class="con-ovs__dcell con-ovs__dcell--head">
          <span class="con-ovs__rdot" :class="'player_bg_color_' + row.color" aria-hidden="true"></span>
          <span class="con-ovs__dname">{{ row.name }}</span>
        </div>
        <template v-for="sub in detailSubs" :key="sub.key">
          <div class="con-ovs__dcell con-ovs__dcell--label">{{ $t(sub.label) }}</div>
          <div v-for="row in vm.score.ranking" :key="sub.key + row.color" class="con-ovs__dcell">
            {{ fmt(sub.values[row.color] ?? 0) }}
          </div>
        </template>
        <div class="con-ovs__dcell con-ovs__dcell--label con-ovs__dcell--total">{{ $t('Total') }}</div>
        <div v-for="row in vm.score.ranking" :key="'t' + row.color" class="con-ovs__dcell con-ovs__dcell--total">
          {{ fmt(detailCat.values[row.color] ?? 0) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import type {ConsoleOverviewVm, OvScoreCategory, OvScoreSub} from '@/client/console/endgame/consoleOverviewModel';
import {consoleOverviewUi} from '@/client/console/endgame/consoleOverviewState';
import type {ConsoleEndgameCategoryKey} from '@/client/console/endgame/consoleEndgameModel';
import {DossierGlyph, scoreCategoryGlyph} from '@/client/console/infoDossierModel';
import ConsoleScoreDisc from '@/client/components/console/info/ConsoleScoreDisc.vue';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';

export default defineComponent({
  name: 'ConsoleOvTabScore',
  components: {ConsoleScoreDisc, ConsoleVpBadge, ConsoleCardFaceLite, MarsBotCorpFace},
  props: {
    vm: {type: Object as PropType<ConsoleOverviewVm>, required: true},
  },
  computed: {
    ui() {
      return consoleOverviewUi;
    },
    focusedCat(): OvScoreCategory | undefined {
      return this.vm.score.categories[this.ui.scoreCat];
    },
    detailCat(): OvScoreCategory | undefined {
      const d = this.ui.detail;
      if (d === undefined || d.kind !== 'score-category') {
        return undefined;
      }
      return this.vm.score.categories.find((c) => c.key === d.catKey);
    },
    /** Detail rows: the two-level subs, or the category itself as one row. */
    detailSubs(): ReadonlyArray<OvScoreSub> {
      const cat = this.detailCat;
      if (cat === undefined) {
        return [];
      }
      return cat.subs.length > 0 ? cat.subs : [{key: cat.key, label: cat.label, values: cat.values}];
    },
  },
  methods: {
    fmt(v: number): string {
      return v < 0 ? '−' + Math.abs(v) : String(v);
    },
    /** The category's leader (gold) — every holder of a shared lead, never a zero. */
    isLeader(cat: OvScoreCategory, color: Color): boolean {
      return cat.leaders.includes(color) && (cat.values[color] ?? 0) > 0;
    },
    glyphOf(key: ConsoleEndgameCategoryKey): DossierGlyph {
      return scoreCategoryGlyph(key);
    },
    barStyle(cat: OvScoreCategory, color: Color): Record<string, string> {
      const v = Math.abs(cat.values[color] ?? 0);
      return {width: `${(v / this.vm.score.maxCategoryValue) * 100}%`};
    },
    quietNote(cat: OvScoreCategory): string {
      return cat.penalty ? 'Points lost to penalties' : 'A single-source category';
    },
    // ── pane API ──────────────────────────────────────────────────────────
    nav(dir: NavDirection): void {
      if (this.ui.detail !== undefined) {
        return; // the detail is a static read — B closes it
      }
      if (dir === 'up' || dir === 'down') {
        const n = this.vm.score.categories.length;
        if (n > 0) {
          const delta = dir === 'down' ? 1 : -1;
          this.ui.scoreCat = (this.ui.scoreCat + delta + n) % n;
        }
      }
    },
    primary(): void {
      const cat = this.focusedCat;
      if (cat !== undefined && this.ui.detail === undefined) {
        this.ui.detail = {kind: 'score-category', catKey: cat.key};
      }
    },
  },
});
</script>
