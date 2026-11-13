<template>
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

<script setup lang="ts">
/*
 * ПАРАМЕТРЫ — the planet's own story. A parameter list on ↑/↓ (icon +
 * name + final value, only the tracks this game actually has), ONE chart
 * with the focused parameter in full ink and the rest as quiet same-hue
 * context (indexed to % completion — one honest axis for °C, % and
 * counts), ←/→ walks generations with an exact readout, and the
 * contribution block names who actually pushed the focused track.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import {$t} from '@/client/directives/i18n';
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

defineOptions({name: 'ConsoleOvTabParams'});
const props = defineProps({
  vm: {type: Object as PropType<ConsoleOverviewVm>, required: true},
  reveal: {type: Boolean, default: false},
});

const ui = consoleOverviewUi;
const paramIdx = computed((): number => {
  return Math.min(Math.max(ui.paramIdx, 0), Math.max(0, props.vm.parameters.parameters.length - 1));
});
const focusedParam = computed((): OvParameter | undefined => {
  return props.vm.parameters.parameters[paramIdx.value];
});
const focusedHex = computed((): string => {
  return focusedParam.value !== undefined ? accentHex(focusedParam.value.accent) : '#8aa4c0';
});
const drawable = computed((): boolean => {
  return props.vm.parameters.gens >= 2 && props.vm.parameters.parameters.length > 0;
});
const cursor = computed((): number => {
  const last = Math.max(0, props.vm.parameters.gens - 1);
  const g = ui.paramGen;
  return g >= 0 && g <= last ? g : last;
});
const chartSeries = computed((): Array<OvChartSeries> => {
  return props.vm.parameters.parameters.map((p, i) => ({
    key: p.key,
    hex: accentHex(p.accent),
    data: p.pct,
    emphasis: i === paramIdx.value,
    dim: i !== paramIdx.value,
  }));
});
const pushRows = computed((): Array<{color: string; name: string; steps: number; pct: number}> => {
  const p = focusedParam.value;
  if (p === undefined || p.contributions === undefined) {
    return [];
  }
  const c = p.contributions;
  const names = new Map(props.vm.players.players.map((pl) => [pl.color as string, pl.name]));
  return Object.entries(c.values)
    .map(([color, steps]) => ({
      color,
      name: names.get(color) ?? color,
      steps: steps ?? 0,
      pct: c.max > 0 ? ((steps ?? 0) / c.max) * 100 : 0,
    }))
    .filter((r) => r.steps > 0)
    .sort((a, b) => b.steps - a.steps);
});
function accentHex(accent: string): string {
  return ACCENT_HEX[accent] ?? '#8aa4c0';
}
function paramIcon(key: GlobalParameter): string | undefined {
  return PARAM_ICON[key];
}
function fmtValue(p: OvParameter, v: number): string {
  if (p.key === GlobalParameter.OCEANS) {
    return `${v}/${p.max}`;
  }
  return `${v}${p.unit}`;
}
// ── pane API ──────────────────────────────────────────────────────────
function nav(dir: NavDirection): void {
  if (dir === 'up' || dir === 'down') {
    const n = props.vm.parameters.parameters.length;
    if (n > 0) {
      const delta = dir === 'down' ? 1 : -1;
      ui.paramIdx = (paramIdx.value + delta + n) % n;
    }
    return;
  }
  if (!drawable.value) {
    return;
  }
  const last = props.vm.parameters.gens - 1;
  const delta = dir === 'right' ? 1 : -1;
  ui.paramGen = Math.min(Math.max(cursor.value + delta, 0), last);
}
function primary(): void {
  // The readout already states the exact value — no deeper layer here.
}

// The pane API — what `ConsoleEndgameOverview` reaches through its `ref="pane"` (`nav` on a d-pad step, `primary`
// on A), and nothing else.
defineExpose({nav, primary});
</script>
