<template>
  <!--
    ПАРАМЕТРЫ — the planet's own story. A parameter list on ↑/↓ (icon +
    name + final value, only the tracks this game actually has), ONE chart
    with the focused parameter in full ink and the rest as quiet same-hue
    context (indexed to % completion — one honest axis for °C, % and
    counts), ←/→ walks generations with an exact readout, and the
    contribution block names who actually pushed the focused track.
  -->
  <div class="con-ovp">
    <div class="con-ovp__rail">
      <div v-for="(p, i) in vm.parameters.parameters" :key="p.key"
           class="con-ovp__prow"
           :class="[{'con-ovp__prow--focused': i === paramIdx}, 'con-ovp-acc--' + p.accent]">
        <i v-if="paramIcon(p.key) !== undefined" class="wgt-icon con-ovp__picon" :class="paramIcon(p.key)" aria-hidden="true"></i>
        <span v-else class="con-ovp__pdot" aria-hidden="true"></span>
        <span class="con-ovp__pname">{{ $t(p.label) }}</span>
        <span class="con-ovp__pfinal">
          <b>{{ fmtValue(p, p.finalValue) }}</b>
          <i v-if="p.completed" class="con-ovp__pdone">{{ $t('Maxed') }}</i>
        </span>
      </div>
      <div v-if="vm.parameters.parameters.length === 0" class="con-egov-empty con-egov-empty--rail">
        <div class="con-egov-empty__title">{{ $t('No parameter data') }}</div>
      </div>
    </div>

    <div class="con-ovp__main">
      <template v-if="drawable">
        <div class="con-egov-legend">
          <span v-for="(p, i) in vm.parameters.parameters" :key="p.key"
                class="con-egov-legend__item" :class="{'con-egov-legend__item--dim': i !== paramIdx}">
            <span class="con-egov-legend__dot" :style="{background: accentHex(p.accent)}" aria-hidden="true"></span>
            <span class="con-egov-legend__name">{{ $t(p.label) }}</span>
            <b class="con-egov-legend__val">{{ p.finalPct }}%</b>
          </span>
        </div>
        <ConsoleOvChart class="con-ovp__chart"
                        :series="chartSeries" :points="vm.parameters.gens" :max-y="100" unit="%"
                        :cursor="cursor" :reveal="reveal" fill />
        <div class="con-ovp__readout">
          <span class="con-ovp__ro-gen">{{ $t('Generation') }} <b>{{ cursor + 1 }}</b></span>
          <template v-if="focusedParam !== undefined">
            <span class="con-ovp__ro-val" :class="'con-ovp-acc--' + focusedParam.accent">
              <span class="con-ovp__pdot" aria-hidden="true"></span>
              {{ $t(focusedParam.label) }}
              <b>{{ fmtValue(focusedParam, focusedParam.series[cursor] ?? focusedParam.min) }}</b>
              <i class="con-ovp__ro-pct">{{ focusedParam.pct[cursor] ?? 0 }}%</i>
            </span>
          </template>
        </div>
      </template>
      <div v-else class="con-egov-empty">
        <div class="con-egov-empty__title">{{ $t('No parameter history for this game') }}</div>
        <!-- Honest cause: a one-generation party has one data point (no line
             to draw); only a genuinely old save lacks the feed entirely. -->
        <div class="con-egov-empty__note">
          {{ $t(vm.parameters.gens > 0 ? 'The game ended within a single generation.' : 'Older saves carry only the final contribution totals.') }}
        </div>
      </div>

      <!-- WHO PUSHED — the focused parameter's per-player steps. -->
      <div class="con-ovp__push">
        <div class="con-ovp__push-head">{{ $t('Who pushed the planet') }}</div>
        <template v-if="pushRows.length > 0">
          <div v-for="row in pushRows" :key="row.color" class="con-ovp__push-row">
            <span class="con-egov-legend__dot" :class="'player_bg_color_' + row.color" aria-hidden="true"></span>
            <span class="con-ovp__push-name">{{ row.name }}</span>
            <span class="con-ovp__push-track"><span class="con-ovp__push-fill" :style="{width: row.pct + '%', background: focusedHex}"></span></span>
            <b class="con-ovp__push-val">{{ row.steps }}</b>
          </div>
        </template>
        <div v-else class="con-ovp__push-quiet">{{ $t('No steps recorded for this track') }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {GlobalParameter} from '@/common/GlobalParameter';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import type {ConsoleOverviewVm, OvChartSeries, OvParameter} from '@/client/console/endgame/consoleOverviewModel';
import {consoleOverviewUi} from '@/client/console/endgame/consoleOverviewState';
import ConsoleOvChart from '@/client/components/console/ConsoleOvChart.vue';

/** Semantic parameter hues — the console endgame category palette family. */
const ACCENT_HEX: Record<string, string> = {
  temperature: '#e07a4a',
  oxygen: '#4cc07a',
  oceans: '#4f9be0',
  venus: '#d98ad0',
  moon: '#cfd8e6',
};

const PARAM_ICON: Partial<Record<GlobalParameter, string>> = {
  [GlobalParameter.TEMPERATURE]: 'wgt-icon--temperature',
  [GlobalParameter.OXYGEN]: 'wgt-icon--oxygen',
  [GlobalParameter.OCEANS]: 'wgt-icon--ocean',
  [GlobalParameter.VENUS]: 'wgt-icon--venus',
};

export default defineComponent({
  name: 'ConsoleOvTabParams',
  components: {ConsoleOvChart},
  props: {
    vm: {type: Object as PropType<ConsoleOverviewVm>, required: true},
    reveal: {type: Boolean, default: false},
  },
  computed: {
    ui() {
      return consoleOverviewUi;
    },
    paramIdx(): number {
      return Math.min(Math.max(this.ui.paramIdx, 0), Math.max(0, this.vm.parameters.parameters.length - 1));
    },
    focusedParam(): OvParameter | undefined {
      return this.vm.parameters.parameters[this.paramIdx];
    },
    focusedHex(): string {
      return this.focusedParam !== undefined ? this.accentHex(this.focusedParam.accent) : '#8aa4c0';
    },
    drawable(): boolean {
      return this.vm.parameters.gens >= 2 && this.vm.parameters.parameters.length > 0;
    },
    cursor(): number {
      const last = Math.max(0, this.vm.parameters.gens - 1);
      const g = this.ui.paramGen;
      return g >= 0 && g <= last ? g : last;
    },
    chartSeries(): Array<OvChartSeries> {
      return this.vm.parameters.parameters.map((p, i) => ({
        key: p.key,
        hex: this.accentHex(p.accent),
        data: p.pct,
        emphasis: i === this.paramIdx,
        dim: i !== this.paramIdx,
      }));
    },
    pushRows(): Array<{color: string; name: string; steps: number; pct: number}> {
      const p = this.focusedParam;
      if (p === undefined || p.contributions === undefined) {
        return [];
      }
      const c = p.contributions;
      const names = new Map(this.vm.players.players.map((pl) => [pl.color as string, pl.name]));
      return Object.entries(c.values)
        .map(([color, steps]) => ({
          color,
          name: names.get(color) ?? color,
          steps: steps ?? 0,
          pct: c.max > 0 ? ((steps ?? 0) / c.max) * 100 : 0,
        }))
        .filter((r) => r.steps > 0)
        .sort((a, b) => b.steps - a.steps);
    },
  },
  methods: {
    accentHex(accent: string): string {
      return ACCENT_HEX[accent] ?? '#8aa4c0';
    },
    paramIcon(key: GlobalParameter): string | undefined {
      return PARAM_ICON[key];
    },
    fmtValue(p: OvParameter, v: number): string {
      if (p.key === GlobalParameter.OCEANS) {
        return `${v}/${p.max}`;
      }
      return `${v}${p.unit}`;
    },
    // ── pane API ──────────────────────────────────────────────────────────
    nav(dir: NavDirection): void {
      if (dir === 'up' || dir === 'down') {
        const n = this.vm.parameters.parameters.length;
        if (n > 0) {
          const delta = dir === 'down' ? 1 : -1;
          this.ui.paramIdx = (this.paramIdx + delta + n) % n;
        }
        return;
      }
      if (!this.drawable) {
        return;
      }
      const last = this.vm.parameters.gens - 1;
      const delta = dir === 'right' ? 1 : -1;
      this.ui.paramGen = Math.min(Math.max(this.cursor + delta, 0), last);
    },
    primary(): void {
      // The readout already states the exact value — no deeper layer here.
    },
  },
});
</script>
