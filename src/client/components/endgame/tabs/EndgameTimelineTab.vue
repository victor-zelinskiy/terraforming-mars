<template>
  <div class="eg-tab eg-timeline">
    <!-- timeline callouts -->
    <div class="eg-timeline__chips">
      <div class="eg-stat-chip">
        <span class="eg-stat-chip__val">{{ model.generation }}</span>
        <span class="eg-stat-chip__lbl" v-i18n>generations</span>
      </div>
      <div v-if="model.winner !== undefined" class="eg-stat-chip" :style="{'--eg-pc': hex(model.winner.color)}">
        <span class="eg-stat-chip__dot" :class="'player_bg_color_' + model.winner.color"></span>
        <span v-if="model.winnerTookLeadGen !== undefined" class="eg-stat-chip__lbl">
          <span v-i18n>Took the lead in gen</span> {{ model.winnerTookLeadGen }}
        </span>
        <span v-else class="eg-stat-chip__lbl" v-i18n>Led wire to wire</span>
      </div>
    </div>

    <section class="eg-chart-card">
      <h2 class="eg-section-title" v-i18n>Victory points by generation</h2>
      <EndgameLineChart :series="vpSeries" :generations="model.generation" :height="320" :x-label="genLabel" fill />
    </section>

    <section v-if="paramSeries.length > 0" class="eg-chart-card">
      <h2 class="eg-section-title" v-i18n>Global parameter progress</h2>
      <EndgameLineChart :series="paramSeries" :generations="model.generation" :height="300" :fixed-max="100" unit="%" :x-label="genLabel" />
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {ViewModel} from '@/common/models/PlayerModel';
import {GlobalParameter} from '@/common/GlobalParameter';
import {EndgameModel} from '@/client/components/endgame/endgameModel';
import EndgameLineChart, {ChartSeries} from '@/client/components/endgame/EndgameLineChart.vue';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {$t} from '@/client/directives/i18n';

// Completion ranges per parameter (min → max), matching the legacy chart.
const PARAM_RANGE: Partial<Record<GlobalParameter, {min: number; max: number; label: string; color: string}>> = {
  [GlobalParameter.TEMPERATURE]: {min: -30, max: 8, label: 'Temperature', color: '#e8743b'},
  [GlobalParameter.OXYGEN]: {min: 0, max: 14, label: 'Oxygen', color: '#6fc46f'},
  [GlobalParameter.OCEANS]: {min: 0, max: 9, label: 'Oceans', color: '#4f9be0'},
  [GlobalParameter.VENUS]: {min: 0, max: 30, label: 'Venus', color: '#d98ad0'},
  [GlobalParameter.MOON_HABITAT_RATE]: {min: 0, max: 8, label: 'L. Habitat', color: '#b9c4d0'},
  [GlobalParameter.MOON_MINING_RATE]: {min: 0, max: 8, label: 'L. Mining', color: '#cbb68f'},
  [GlobalParameter.MOON_LOGISTIC_RATE]: {min: 0, max: 8, label: 'L. Logistic', color: '#9fb3c8'},
};

export default defineComponent({
  name: 'EndgameTimelineTab',
  components: {EndgameLineChart},
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    view: {type: Object as () => ViewModel, required: true},
    // Declared so the shell's shared props don't fall through (unused here).
    viewerColor: {type: String, required: false, default: undefined},
  },
  computed: {
    genLabel(): string {
      return $t('Generation');
    },
    vpSeries(): Array<ChartSeries> {
      return this.model.players.map((p) => ({
        label: p.name,
        color: p.color,
        data: p.vpByGeneration,
      }));
    },
    paramSeries(): Array<ChartSeries> {
      const expansions = this.view.game.gameOptions.expansions;
      const gpg = this.view.game.globalsPerGeneration;
      if (gpg.length === 0) {
        return [];
      }
      const order: Array<GlobalParameter> = [GlobalParameter.TEMPERATURE, GlobalParameter.OXYGEN, GlobalParameter.OCEANS];
      if (expansions.venus) {
        order.push(GlobalParameter.VENUS);
      }
      if (expansions.moon) {
        order.push(GlobalParameter.MOON_HABITAT_RATE, GlobalParameter.MOON_MINING_RATE, GlobalParameter.MOON_LOGISTIC_RATE);
      }
      const series: Array<ChartSeries> = [];
      for (const param of order) {
        const range = PARAM_RANGE[param];
        if (range === undefined) {
          continue;
        }
        const data = gpg.map((entry) => {
          const val = entry[param] ?? range.min;
          return Math.round((100 * (val - range.min)) / (range.max - range.min));
        });
        series.push({label: $t(range.label), color: range.color, data});
      }
      return series;
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
  },
});
</script>
