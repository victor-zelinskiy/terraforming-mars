<template>
<div :class="rootClass">
  <!--
    Slim vertical terraforming-progress spine — absolute, 3 px wide
    on the inner-left edge. Pure cosmetic sci-fi gauge: fills bottom-
    up as (temperature + oxygen + oceans) advance. Doesn't take a
    pixel of layout width from the metric stack.
  -->
  <div class="planet-spine" :title="terraformProgressTitle" aria-hidden="true">
    <div class="planet-spine__fill"
         :style="{ height: terraformProgressPercent + '%' }"></div>
    <span class="planet-spine__tick planet-spine__tick--25"></span>
    <span class="planet-spine__tick planet-spine__tick--50"></span>
    <span class="planet-spine__tick planet-spine__tick--75"></span>
  </div>

  <div class="planet-stack">
    <!--
      Each metric block is a horizontal row: icon (or label) on the
      LEFT, value cluster on the RIGHT, with a thin per-axis progress
      underline spanning the full width below the row.

      Generation is special — no icon, the small "ПКН." label takes
      the icon's left slot. Otherwise it shares the exact same
      composition as the parameter rows so the whole stack reads as
      one consistent instrument cluster.
    -->
    <div class="planet-metric planet-metric--generation"
         :title="$t('Generation Marker')">
      <span class="planet-metric__label" v-i18n>Sidebar generation label</span>
      <div class="planet-metric__value">
        <span class="planet-stat-num">{{ generation }}</span>
        <AnimatedMetricValue
          :value="generation"
          metricKey="globals.generation"
          scopeKey="global"
          :epoch="epoch"
          variant="global-parameter" />
      </div>
    </div>

    <div v-if="gameOptions.expansions.turmoil"
         :title="$t('Ruling Party')"
         class="planet-ruling-party">
      <div :class="'party-name party-name-indicator party-name--'+rulingPartyToCss()">
        <span v-i18n>{{ getRulingParty() }}</span>
      </div>
    </div>

    <div class="planet-metric planet-metric--temperature"
         :class="{ 'planet-metric--max': temperatureIsMax }"
         :title="$t('Temperature')">
      <i class="planet-metric__icon temperature-tile"></i>
      <div class="planet-metric__value">
        <template v-if="temperatureIsMax">
          <span class="planet-metric__checkmark" :title="$t('Completed!')">✓</span>
        </template>
        <template v-else>
          <span class="planet-stat-num">{{ temperature }}</span><span class="planet-metric__unit">°C</span>
        </template>
        <AnimatedMetricValue
          :value="temperature"
          metricKey="globals.temperature"
          scopeKey="global"
          :epoch="epoch"
          variant="global-parameter" />
      </div>
      <div class="planet-metric__progress"
           :style="{ '--planet-progress-fill': temperatureProgress * 100 + '%' }"></div>
    </div>

    <div class="planet-metric planet-metric--oxygen"
         :class="{ 'planet-metric--max': oxygenIsMax }"
         :title="$t('Oxygen Level')">
      <i class="planet-metric__icon oxygen-tile"></i>
      <div class="planet-metric__value">
        <template v-if="oxygenIsMax">
          <span class="planet-metric__checkmark" :title="$t('Completed!')">✓</span>
        </template>
        <template v-else>
          <span class="planet-stat-num">{{ oxygen }}</span><span class="planet-metric__unit">%</span>
        </template>
        <AnimatedMetricValue
          :value="oxygen"
          metricKey="globals.oxygen"
          scopeKey="global"
          :epoch="epoch"
          variant="global-parameter" />
      </div>
      <div class="planet-metric__progress"
           :style="{ '--planet-progress-fill': oxygenProgress * 100 + '%' }"></div>
    </div>

    <div class="planet-metric planet-metric--oceans"
         :class="{ 'planet-metric--max': oceansIsMax }"
         :title="$t('Oceans')">
      <i class="planet-metric__icon ocean-tile"></i>
      <div class="planet-metric__value">
        <template v-if="oceansIsMax">
          <span class="planet-metric__checkmark" :title="$t('Completed!')">✓</span>
        </template>
        <template v-else>
          <span class="planet-stat-num">{{ oceans }}</span><span class="planet-metric__unit">/{{ maxOceans }}</span>
        </template>
        <AnimatedMetricValue
          :value="oceans"
          metricKey="globals.oceans"
          scopeKey="global"
          :epoch="epoch"
          variant="global-parameter" />
      </div>
      <div class="planet-metric__progress"
           :style="{ '--planet-progress-fill': oceansProgress * 100 + '%' }"></div>
    </div>

    <div v-if="gameOptions.expansions.venus"
         class="planet-metric planet-metric--venus"
         :class="{ 'planet-metric--max': venusIsMax }"
         :title="$t('Venus Scale')">
      <i class="planet-metric__icon venus-tile"></i>
      <div class="planet-metric__value">
        <template v-if="venusIsMax">
          <span class="planet-metric__checkmark" :title="$t('Completed!')">✓</span>
        </template>
        <template v-else>
          <span class="planet-stat-num">{{ venus }}</span><span class="planet-metric__unit">%</span>
        </template>
        <AnimatedMetricValue
          :value="venus"
          metricKey="globals.venus"
          scopeKey="global"
          :epoch="epoch"
          variant="global-parameter" />
      </div>
      <div class="planet-metric__progress"
           :style="{ '--planet-progress-fill': venusProgress * 100 + '%' }"></div>
    </div>

    <MoonGlobalParameterValue v-if="moonData" :moonData="moonData" />
  </div>

  <!--
    Overall planet-completion readout — sits between the metric stack
    and the legacy-button corner. Anchors the spine ending visually
    and labels what the gauge tracks.
  -->
  <div class="planet-overall" :title="terraformProgressTitle">
    <span class="planet-overall__value">{{ terraformProgressPercent }}%</span>
    <span class="planet-overall__label" v-i18n>Sidebar planet label</span>
  </div>

  <button class="planet-debug-btn"
          :class="{ 'planet-debug-btn--active': legacyUiActive }"
          :title="$t('Show legacy UI')"
          :aria-label="$t('Show legacy UI')"
          @click="$emit('toggle-legacy-ui')">
    <i class="planet-debug-btn__glyph"></i>
  </button>
</div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {TurmoilModel} from '@/common/models/TurmoilModel';
import {PartyName} from '@/common/turmoil/PartyName';
import {GameOptionsModel} from '@/common/models/GameOptionsModel';
import MoonGlobalParameterValue from '@/client/components/moon/MoonGlobalParameterValue.vue';
import {MoonModel} from '@/common/models/MoonModel';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import {
  MAX_OCEAN_TILES,
  MAX_OXYGEN_LEVEL,
  MAX_TEMPERATURE,
  MAX_VENUS_SCALE,
  MIN_TEMPERATURE,
} from '@/common/constants';
import {translateText} from '@/client/directives/i18n';

export default defineComponent({
  name: 'sidebar',
  props: {
    playerNumber: {
      type: Number,
      required: true,
    },
    isTerraformed: {
      type: Boolean,
      required: true,
    },
    gameOptions: {
      type: Object as () => GameOptionsModel,
      required: true,
    },
    acting_player: {
      type: Boolean,
    },
    player_color: {
      type: String as () => Color,
      required: true,
    },
    generation: {
      type: Number,
      required: true,
    },
    coloniesCount: {
      type: Number,
      required: true,
    },
    temperature: {
      type: Number,
      required: true,
    },
    oxygen: {
      type: Number,
      required: true,
    },
    oceans: {
      type: Number,
      required: true,
    },
    venus: {
      type: Number,
      required: true,
    },
    moonData: {
      type: Object as () => MoonModel | undefined,
    },
    turmoil: {
      type: Object as () => TurmoilModel | undefined,
    },
    lastSoloGeneration: {
      type: Number,
      required: true,
    },
    deckSize: {
      type: Number,
      required: true,
    },
    discardPileSize: {
      type: Number,
      required: true,
    },
    players: {
      type: Array as () => Array<PublicPlayerModel>,
      default: () => [],
    },
    legacyUiActive: {
      type: Boolean,
      default: false,
    },
    epoch: {
      type: String,
      default: '',
    },
  },
  emits: ['toggle-legacy-ui'],
  components: {
    MoonGlobalParameterValue,
    AnimatedMetricValue,
  },
  methods: {
    rulingPartyToCss(): string {
      if (this.turmoil?.ruling === undefined) {
        return '';
      }
      return this.turmoil.ruling.toLowerCase().split(' ').join('_');
    },
    getRulingParty(): string {
      const ruling = this.turmoil?.ruling;
      switch (ruling) {
      case PartyName.MARS:
        return 'Mars';
      case PartyName.SCIENTISTS:
        return 'Science';
      case PartyName.KELVINISTS:
        return 'Kelvin';
      case undefined:
        return '???';
      default:
        return ruling;
      }
    },
  },
  computed: {
    rootClass(): string {
      const acting = this.acting_player && getPreferences().hide_animated_sidebar === false;
      return 'sidebar_cont sidebar planet-sidebar' +
        (acting ? ' preferences_acting_player' : ' preferences_nonacting_player');
    },
    temperatureProgress(): number {
      const span = MAX_TEMPERATURE - MIN_TEMPERATURE;
      return Math.max(0, Math.min(1, (this.temperature - MIN_TEMPERATURE) / span));
    },
    oxygenProgress(): number {
      return Math.max(0, Math.min(1, this.oxygen / MAX_OXYGEN_LEVEL));
    },
    oceansProgress(): number {
      return Math.max(0, Math.min(1, this.oceans / MAX_OCEAN_TILES));
    },
    venusProgress(): number {
      return Math.max(0, Math.min(1, this.venus / MAX_VENUS_SCALE));
    },
    terraformProgress(): number {
      return (this.temperatureProgress + this.oxygenProgress + this.oceansProgress) / 3;
    },
    terraformProgressPercent(): number {
      return Math.round(this.terraformProgress * 100);
    },
    terraformProgressTitle(): string {
      return `${translateText('Terraforming progress')}: ${this.terraformProgressPercent}%`;
    },
    temperatureIsMax(): boolean {
      return this.temperature >= MAX_TEMPERATURE;
    },
    oxygenIsMax(): boolean {
      return this.oxygen >= MAX_OXYGEN_LEVEL;
    },
    oceansIsMax(): boolean {
      return this.oceans >= MAX_OCEAN_TILES;
    },
    venusIsMax(): boolean {
      return this.venus >= MAX_VENUS_SCALE;
    },
    maxOceans(): number {
      return MAX_OCEAN_TILES;
    },
  },
});

</script>
