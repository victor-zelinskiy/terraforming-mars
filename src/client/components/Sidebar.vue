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
         :title="generationTitle"
         :aria-label="generationTitle">
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

    <!-- Persistent FINAL GENERATION marker — appears once this generation is
         authoritatively the game's last (multiplayer: the server's
         isTerraformed; solo: the fixed last solo generation). Compact by
         design: the full wording lives in the aria-label. -->
    <div v-if="finalGenerationActive"
         class="planet-final-gen"
         :aria-label="$t('Final generation')">
      <span v-i18n>Final</span>
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
        <span class="planet-stat-num">{{ temperature }}</span><span class="planet-metric__unit">°C</span>
        <span v-if="temperatureIsMax"
              class="planet-metric__max-badge"
              :title="$t('Completed!')"
              :aria-label="$t('Completed!')">✓</span>
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
        <span class="planet-stat-num">{{ oxygen }}</span><span class="planet-metric__unit">%</span>
        <span v-if="oxygenIsMax"
              class="planet-metric__max-badge"
              :title="$t('Completed!')"
              :aria-label="$t('Completed!')">✓</span>
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
        <span class="planet-stat-num">{{ oceans }}</span><span class="planet-metric__unit">/{{ maxOceans }}</span>
        <span v-if="oceansIsMax"
              class="planet-metric__max-badge"
              :title="$t('Completed!')"
              :aria-label="$t('Completed!')">✓</span>
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
        <span class="planet-stat-num">{{ venus }}</span><span class="planet-metric__unit">%</span>
        <span v-if="venusIsMax"
              class="planet-metric__max-badge"
              :title="$t('Completed!')"
              :aria-label="$t('Completed!')">✓</span>
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
} from '@/common/constants';
import {terraformingProgress, TerraformingProgress} from '@/client/components/gameProgress/terraformingProgress';
import {terraformingCelebrationState} from '@/client/components/gameProgress/terraformingCelebration';
import {motionMs} from '@/client/components/motion/motionTokens';
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
  data() {
    return {
      // One-shot celebration glow on the LIVE terraforming-complete transition
      // (driven by the shared celebration nonce; never re-fires on reload).
      celebrating: false,
      celebrateTimer: undefined as number | undefined,
    };
  },
  watch: {
    celebrationNonce(): void {
      this.celebrating = true;
      if (this.celebrateTimer !== undefined) {
        window.clearTimeout(this.celebrateTimer);
      }
      this.celebrateTimer = window.setTimeout(() => {
        this.celebrating = false;
      }, motionMs(3200));
    },
  },
  beforeUnmount() {
    if (this.celebrateTimer !== undefined) {
      window.clearTimeout(this.celebrateTimer);
    }
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
        (acting ? ' preferences_acting_player' : ' preferences_nonacting_player') +
        (this.progress.complete ? ' planet-sidebar--terraformed' : '') +
        (this.celebrating ? ' planet-sidebar--celebrating' : '');
    },
    // The SHARED terraforming-progress math (also used by the console top-HUD
    // rail) — Temperature + Oxygen + Oceans ONLY; Venus never counts.
    progress(): TerraformingProgress {
      return terraformingProgress({temperature: this.temperature, oxygenLevel: this.oxygen, oceans: this.oceans});
    },
    temperatureProgress(): number {
      return this.progress.temperature;
    },
    oxygenProgress(): number {
      return this.progress.oxygen;
    },
    oceansProgress(): number {
      return this.progress.oceans;
    },
    // Venus keeps its OWN per-axis underline — deliberately separate from the
    // aggregate above.
    venusProgress(): number {
      return Math.max(0, Math.min(1, this.venus / MAX_VENUS_SCALE));
    },
    terraformProgressPercent(): number {
      return this.progress.percent;
    },
    celebrationNonce(): number {
      return terraformingCelebrationState.celebrationNonce;
    },
    // This generation is authoritatively the game's LAST one. Multiplayer:
    // the server's game-end condition (isTerraformed, variant-aware); solo:
    // solo games always run to the fixed last generation.
    finalGenerationActive(): boolean {
      if (this.players.length <= 1) {
        return this.generation >= this.lastSoloGeneration;
      }
      return this.isTerraformed;
    },
    terraformProgressTitle(): string {
      return `${translateText('Terraforming progress')}: ${this.terraformProgressPercent}%`;
    },
    generationTitle(): string {
      return `${translateText('Generation')} ${this.generation}`;
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
