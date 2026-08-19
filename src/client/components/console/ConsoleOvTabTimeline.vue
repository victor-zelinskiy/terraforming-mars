<template>
  <!--
    ХРОНОЛОГИЯ — generations are the axis. One big VP chart (all players,
    one shared scale), an episode strip pinned to generations, and a fixed
    READOUT zone that names exact values at the d-pad cursor — no hover
    anywhere. ←/→ walks generations, ↑/↓ jumps between pinned episodes,
    A opens the generation dossier.
  -->
  <div class="con-ovt">
    <template v-if="drawable">
      <!-- Match-shape chips: the timeline stats worth one line each. -->
      <div class="con-ovt__chips">
        <span class="con-ovt__stat"><b>{{ vm.timeline.stats.generations }}</b> {{ $t('generations') }}</span>
        <span v-if="vm.timeline.stats.tookLeadGen !== undefined" class="con-ovt__stat">
          {{ $t('Took the lead in gen') }} <b>{{ vm.timeline.stats.tookLeadGen }}</b>
        </span>
        <span v-else-if="vm.timeline.stats.wireToWire" class="con-ovt__stat">{{ $t('Led wire to wire') }}</span>
        <span v-if="(vm.timeline.stats.leadChanges ?? 0) >= 2" class="con-ovt__stat">
          <b>{{ vm.timeline.stats.leadChanges }}</b> {{ $t('Lead changes') }}
        </span>
        <span v-if="vm.timeline.stats.finalSurge !== undefined" class="con-ovt__stat">
          {{ $t('Fastest finish') }}: <b>{{ vm.timeline.stats.finalSurge.name }}</b> +{{ vm.timeline.stats.finalSurge.gain }} {{ $t('VP') }}
        </span>
      </div>

      <!-- Legend: identity is text + swatch, never colour alone. -->
      <div class="con-egov-legend">
        <span v-for="s in vm.timeline.series" :key="s.color" class="con-egov-legend__item">
          <span class="con-egov-legend__dot" :class="'player_bg_color_' + s.color" aria-hidden="true"></span>
          <span class="con-egov-legend__name">{{ s.name }}</span>
          <b class="con-egov-legend__val">{{ s.final }}</b>
        </span>
      </div>

      <ConsoleOvChart class="con-ovt__chart"
                      :series="chartSeries" :points="vm.timeline.gens" :max-y="vm.timeline.maxVp"
                      :cursor="cursor" :reveal="reveal" />

      <!-- The episode strip — markers pinned to their generation. -->
      <div class="con-ovt__strip" aria-hidden="true">
        <span v-for="ep in pinnedEpisodes" :key="ep.id"
              class="con-ovt__mark"
              :class="{'con-ovt__mark--major': ep.major, 'con-ovt__mark--hot': ep.generation === cursor + 1}"
              :style="markStyle(ep)"></span>
      </div>

      <!-- The READOUT — the exact values of the cursor generation. -->
      <div class="con-ovt__readout">
        <div class="con-ovt__ro-head">
          <span class="con-ovt__ro-gen">{{ $t('Generation') }} <b>{{ cursor + 1 }}</b></span>
          <span class="con-ovt__ro-range">1–{{ vm.timeline.gens }}</span>
        </div>
        <div class="con-ovt__ro-vals">
          <span v-for="row in readoutRows" :key="row.color" class="con-ovt__ro-val">
            <span class="con-egov-legend__dot" :class="'player_bg_color_' + row.color" aria-hidden="true"></span>
            <span class="con-ovt__ro-name">{{ row.name }}</span>
            <b>{{ row.value }}</b>
            <i v-if="row.delta > 0" class="con-ovt__ro-delta">+{{ row.delta }}</i>
          </span>
        </div>
        <div class="con-ovt__ro-eps">
          <template v-if="cursorEpisodes.length > 0">
            <div v-for="ep in cursorEpisodes" :key="ep.id" class="con-ovt__ro-ep"
                 :style="ep.color !== undefined ? {'--ov-pc': hex(ep.color)} : {}">
              <span class="con-ovt__ro-badge" :class="{'con-ovt__ro-badge--major': ep.major}">{{ $t(ep.badge) }}</span>
              <span class="con-ovt__ro-text"><ConsoleOvRich :sentence="ep.sentence" /></span>
            </div>
          </template>
          <div v-else class="con-ovt__ro-quiet">{{ $t('A quiet generation') }}</div>
        </div>
      </div>

      <!-- NESTED DETAIL — the generation dossier. -->
      <div v-if="detailGen !== undefined" class="con-egov-detail">
        <div class="con-egov-detail__head">
          <span class="con-egov-detail__title">{{ $t('Generation') }} {{ detailGen }}</span>
        </div>
        <div class="con-egov-detail__body con-ovt__dossier">
          <div class="con-ovt__dcol">
            <div class="con-ovt__dcap">{{ $t('Victory points') }}</div>
            <div v-for="row in detailRows" :key="row.color" class="con-ovt__ro-val">
              <span class="con-egov-legend__dot" :class="'player_bg_color_' + row.color" aria-hidden="true"></span>
              <span class="con-ovt__ro-name">{{ row.name }}</span>
              <b>{{ row.value }}</b>
              <i v-if="row.delta > 0" class="con-ovt__ro-delta">+{{ row.delta }}</i>
            </div>
          </div>
          <div class="con-ovt__dcol">
            <div class="con-ovt__dcap">{{ $t('Global parameters') }}</div>
            <div v-for="p in detailParams" :key="p.key" class="con-ovt__dparam" :class="'con-ovp-acc--' + p.accent">
              <span class="con-ovt__dparam-name">{{ $t(p.label) }}</span>
              <b>{{ p.value }}{{ p.unit }}</b>
            </div>
            <div v-if="detailParams.length === 0" class="con-ovt__ro-quiet">{{ $t('No parameter history for this game') }}</div>
          </div>
          <div class="con-ovt__dcol con-ovt__dcol--wide">
            <div class="con-ovt__dcap">{{ $t('Key moments') }}</div>
            <div v-for="ep in detailEpisodes" :key="ep.id" class="con-ovt__ro-ep"
                 :style="ep.color !== undefined ? {'--ov-pc': hex(ep.color)} : {}">
              <span class="con-ovt__ro-badge" :class="{'con-ovt__ro-badge--major': ep.major}">{{ $t(ep.badge) }}</span>
              <span class="con-ovt__ro-text"><ConsoleOvRich :sentence="ep.sentence" /></span>
            </div>
            <div v-if="detailEpisodes.length === 0" class="con-ovt__ro-quiet">{{ $t('A quiet generation') }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- EMPTY STATE — a party too short (or too old) for a chart. -->
    <div v-else class="con-egov-empty">
      <div class="con-egov-empty__title">{{ $t('Too short for a timeline') }}</div>
      <div class="con-egov-empty__note">{{ $t('The score chart needs at least two generations of data.') }}</div>
      <div v-if="vm.timeline.episodes.length > 0" class="con-ovt__ro-eps con-ovt__ro-eps--lone">
        <div v-for="ep in vm.timeline.episodes.slice(0, 3)" :key="ep.id" class="con-ovt__ro-ep"
             :style="ep.color !== undefined ? {'--ov-pc': hex(ep.color)} : {}">
          <span class="con-ovt__ro-badge">{{ $t(ep.badge) }}</span>
          <span class="con-ovt__ro-text"><ConsoleOvRich :sentence="ep.sentence" /></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import type {ConsoleOverviewVm, OvChartSeries, OvEpisode} from '@/client/console/endgame/consoleOverviewModel';
import {consoleOverviewUi} from '@/client/console/endgame/consoleOverviewState';
import ConsoleOvChart from '@/client/components/console/ConsoleOvChart.vue';
import ConsoleOvRich from '@/client/components/console/ConsoleOvRich.vue';

type ReadoutRow = {color: Color; name: string; value: number; delta: number};

export default defineComponent({
  name: 'ConsoleOvTabTimeline',
  components: {ConsoleOvChart, ConsoleOvRich},
  props: {
    vm: {type: Object as PropType<ConsoleOverviewVm>, required: true},
    reveal: {type: Boolean, default: false},
  },
  computed: {
    ui() {
      return consoleOverviewUi;
    },
    drawable(): boolean {
      return this.vm.timeline.gens >= 2 && this.vm.timeline.series.length > 0;
    },
    cursor(): number {
      const last = Math.max(0, this.vm.timeline.gens - 1);
      const g = this.ui.timelineGen;
      return g >= 0 && g <= last ? g : last;
    },
    chartSeries(): Array<OvChartSeries> {
      return this.vm.timeline.series.map((s) => ({
        key: s.color,
        hex: endgamePlayerHex(s.color),
        data: s.data,
      }));
    },
    pinnedEpisodes(): Array<OvEpisode> {
      return this.vm.timeline.episodes.filter((ep) =>
        ep.generation !== undefined && ep.generation >= 1 && ep.generation <= this.vm.timeline.gens);
    },
    cursorEpisodes(): Array<OvEpisode> {
      return this.pinnedEpisodes.filter((ep) => ep.generation === this.cursor + 1).slice(0, 2);
    },
    readoutRows(): Array<ReadoutRow> {
      return this.rowsAt(this.cursor);
    },
    detailGen(): number | undefined {
      const d = this.ui.detail;
      return d !== undefined && d.kind === 'generation' ? d.gen : undefined;
    },
    detailRows(): Array<ReadoutRow> {
      return this.detailGen !== undefined ? this.rowsAt(this.detailGen - 1) : [];
    },
    detailEpisodes(): Array<OvEpisode> {
      return this.pinnedEpisodes.filter((ep) => ep.generation === this.detailGen);
    },
    detailParams(): Array<{key: string; label: string; accent: string; value: number; unit: string}> {
      const gen = this.detailGen;
      if (gen === undefined) {
        return [];
      }
      return this.vm.parameters.parameters
        .filter((p) => gen - 1 < p.series.length)
        .map((p) => ({key: p.key, label: p.label, accent: p.accent, value: p.series[gen - 1], unit: p.unit}));
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
    rowsAt(gen: number): Array<ReadoutRow> {
      const rows = this.vm.timeline.series.map((s) => {
        const value = gen < s.data.length ? s.data[gen] : (s.data.length > 0 ? s.data[s.data.length - 1] : 0);
        const prev = gen > 0 && gen - 1 < s.data.length ? s.data[gen - 1] : 0;
        return {color: s.color, name: s.name, value, delta: gen > 0 ? Math.max(0, value - prev) : 0};
      });
      rows.sort((a, b) => b.value - a.value);
      return rows;
    },
    markStyle(ep: OvEpisode): Record<string, string> {
      const n = this.vm.timeline.gens;
      const gen = (ep.generation ?? 1) - 1;
      const pct = n <= 1 ? 50 : (gen / (n - 1)) * 100;
      const style: Record<string, string> = {left: pct + '%'};
      if (ep.color !== undefined) {
        style['--ov-pc'] = endgamePlayerHex(ep.color);
      }
      return style;
    },
    // ── pane API ──────────────────────────────────────────────────────────
    nav(dir: NavDirection): void {
      if (this.ui.detail !== undefined || !this.drawable) {
        return;
      }
      const last = this.vm.timeline.gens - 1;
      if (dir === 'left' || dir === 'right') {
        const delta = dir === 'right' ? 1 : -1;
        this.ui.timelineGen = Math.min(Math.max(this.cursor + delta, 0), last);
        return;
      }
      // ↑/↓ — jump to the previous/next PINNED episode's generation.
      const gens = [...new Set(this.pinnedEpisodes.map((ep) => (ep.generation ?? 1) - 1))].sort((a, b) => a - b);
      if (gens.length === 0) {
        return;
      }
      if (dir === 'down') {
        this.ui.timelineGen = gens.find((g) => g > this.cursor) ?? gens[0];
      } else {
        this.ui.timelineGen = [...gens].reverse().find((g) => g < this.cursor) ?? gens[gens.length - 1];
      }
    },
    primary(): void {
      if (this.drawable && this.ui.detail === undefined) {
        this.ui.detail = {kind: 'generation', gen: this.cursor + 1};
      }
    },
  },
});
</script>
