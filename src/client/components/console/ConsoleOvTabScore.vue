<template>
  <!--
    СЧЁТ — the calm score analysis. Not a replay of the ceremony: a category
    COMPARISON MATRIX (one row per category, every player's bar on ONE shared
    scale), the d-pad walks categories, the always-mounted context zone
    explains the focused one (two-level РТ/Карты breakdown, leader, the
    winner's edge). A opens the full per-player breakdown detail.
  -->
  <div class="con-ovs" :style="{'--ov-n': vm.score.ranking.length}">
    <!-- Compact standing header: place · name · total (+tie-break note). -->
    <div class="con-ovs__top">
      <div class="con-ovs__standing">
        <span v-for="row in vm.score.ranking" :key="row.color"
              class="con-ovs__st" :class="{'con-ovs__st--winner': row.isWinner}">
          <b class="con-ovs__st-place">{{ row.place }}</b>
          <span class="con-ovs__rdot" :class="'player_bg_color_' + row.color" aria-hidden="true"></span>
          <span class="con-ovs__st-name">{{ row.name }}</span>
          <b class="con-ovs__st-total">{{ row.total }}</b>
        </span>
      </div>
      <div class="con-ovs__notes">
        <span v-if="vm.score.tieBreak !== undefined" class="con-ovs__note con-ovs__note--tb">{{ $t('Tie on VP — decided on M€') }}</span>
        <span v-if="vm.score.decisive !== undefined" class="con-ovs__note">
          {{ $t('Biggest edge') }}: <b :class="'con-eg-ink--' + vm.score.decisive.accent">{{ $t(vm.score.decisive.label) }}</b> +{{ vm.score.decisive.delta }} {{ $t('VP') }}
        </span>
      </div>
    </div>

    <!-- The category matrix — shared scale across every row and player. -->
    <div class="con-ovs__matrix">
      <div v-for="(cat, ci) in vm.score.categories" :key="cat.key"
           class="con-ovs__cat" :class="[{'con-ovs__cat--focused': ui.scoreCat === ci}, 'con-eg-cat--' + cat.accent]">
        <div class="con-ovs__cat-head">
          <span class="con-ovs__cat-dot" aria-hidden="true"></span>
          <span class="con-ovs__cat-name">{{ $t(cat.label) }}</span>
          <span v-if="leaderOf(cat) !== undefined" class="con-ovs__cat-lead">
            <span class="con-ovs__rdot" :class="'player_bg_color_' + leaderOf(cat)" aria-hidden="true"></span>
          </span>
        </div>
        <div class="con-ovs__cat-bars">
          <div v-for="row in vm.score.ranking" :key="row.color" class="con-ovs__pbar">
            <span class="con-ovs__pbar-track">
              <span class="con-ovs__pbar-fill"
                    :class="{'con-ovs__pbar-fill--neg': (cat.values[row.color] ?? 0) < 0}"
                    :style="barStyle(cat, row.color)"></span>
            </span>
            <span class="con-ovs__pbar-val" :class="{'con-ovs__pbar-val--zero': (cat.values[row.color] ?? 0) === 0}">
              {{ fmt(cat.values[row.color] ?? 0) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- The context zone — ALWAYS mounted (fixed height, no layout jump):
         the focused category's two-level breakdown or its quiet summary. -->
    <div class="con-ovs__context">
      <template v-if="focusedCat !== undefined">
        <div class="con-ovs__ctx-head">
          <span class="con-ovs__cat-dot" :class="'con-eg-cat--' + focusedCat.accent" aria-hidden="true"></span>
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
        <span class="con-ovs__cat-dot" :class="'con-eg-cat--' + detailCat.accent" aria-hidden="true"></span>
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

export default defineComponent({
  name: 'ConsoleOvTabScore',
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
    leaderOf(cat: OvScoreCategory): Color | undefined {
      return cat.leaders.length === 1 ? cat.leaders[0] : undefined;
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
