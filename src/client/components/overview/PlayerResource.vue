<template>
  <div class="resource_item" :class="mainCSS">
      <div class="resource_item_stock" :data-conversion-cell="conversionAnchor">
          <i class="resource_icon tooltip tooltip-bottom" :class="iconCSS" :data-tooltip="resourceTypeTooltip" :data-conversion-icon="conversionAnchor"></i>
          <div class="resource_item_stock_count" data-test="stock-count">{{ displayCount }}</div>
          <AnimatedMetricValue
            v-if="scopeKey !== ''"
            :value="count"
            :metricKey="stockMetricKey"
            :scopeKey="scopeKey"
            :epoch="epoch"
            variant="resource-stock" />
      </div>
      <div class="resource_item_prod" :class="productionStateClass">
          <span class="resource_item_prod_count tooltip tooltip-bottom" data-test="production" :data-tooltip="productionCountTooltip">{{ productionSign }}{{ production }}</span>
          <div class="shield_parent" data-test="protection-shield"> <!-- Why is this a child of resource_item_prod?-->
            <div v-if="protectionIcon !== ''" :class="protectionIcon"></div>
            <div v-if="showProductionProtectedIcon" class="shield_production_protection"></div>
            <div v-if="showResourceProtectionIcon" class="shield_resource_protection"></div>
          </div>
          <div v-if="showResourceValue()" class="resource_icon--megacredit-value" data-test="resource-value">{{ value }}</div>
      </div>
      <!--
        Production change-feedback chip — MUST live outside .resource_item_prod
        because that element has `overflow: hidden` (production text clipping).
        Anchoring relative to .resource_item (the row) lets the chip extend
        above the row freely. Position controlled in resource_change_feedback.less.
      -->
      <AnimatedMetricValue
        v-if="scopeKey !== ''"
        :value="production"
        :metricKey="productionMetricKey"
        :scopeKey="scopeKey"
        :epoch="epoch"
        variant="resource-production" />
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {DEFAULT_STEEL_VALUE, DEFAULT_TITANIUM_VALUE} from '@/common/constants';
import {Resource} from '@/common/Resource';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {Protection} from '@/common/models/PlayerModel';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import {energyConversionState} from '@/client/components/feedback/energyConversionTransition';

export default defineComponent({
  name: 'PlayerResource',
  components: {AnimatedMetricValue},
  props: {
    type: {
      type: String as () => Resource,
      required: true,
    },
    count: {
      type: Number,
      required: true,
    },
    production: {
      type: Number,
      required: true,
    },
    resourceProtection: {
      type: String as () => Protection,
      required: false,
      default: 'off',
    },
    productionProtection: {
      type: String as () => Protection,
      default: 'off',
    },
    value: {
      type: Number,
      default: 0,
    },
    /*
     * Per-player addressing for the change-feedback system. Empty
     * scopeKey disables feedback entirely — call sites outside the
     * left panel (legacy spectator view, etc.) can opt out by simply
     * not passing scopeKey, which keeps the old presentation
     * untouched while we migrate.
     */
    scopeKey: {
      type: String,
      default: '',
    },
    epoch: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
    };
  },
  methods: {
    showResourceValue(): boolean {
      const learnerModeOn = getPreferences().learner_mode;

      switch (this.type) {
      case Resource.STEEL:
        return learnerModeOn || this.value > DEFAULT_STEEL_VALUE;
      case Resource.TITANIUM:
        return learnerModeOn || this.value > DEFAULT_TITANIUM_VALUE;
      case Resource.HEAT:
        return this.value > 0;
      default:
        return false;
      }
    },
  },
  computed: {
    /*
     * During the energy→heat conversion transition the energy / heat rows of
     * the converting player show an interpolated counter (driven by the
     * controller's rAF) instead of the canonical stock, so the number visibly
     * travels down (energy) / up (heat) in lock-step with the arrow + chips.
     * Returns undefined for every other row / player / non-active state, so the
     * normal `count` is shown. Rounded — counters read as integers.
     *
     * NOTE: AnimatedMetricValue below still binds `:value="count"` (canonical),
     * NOT this override — its baseline/delta logic must track real game state.
     * The override only swaps the displayed text.
     */
    conversionOverride(): number | undefined {
      const s = energyConversionState;
      if (!s.active || s.color === '' || s.color !== this.scopeKey) {
        return undefined;
      }
      if (this.type === Resource.ENERGY) {
        return Math.round(s.displayEnergy);
      }
      if (this.type === Resource.HEAT) {
        return Math.round(s.displayHeat);
      }
      return undefined;
    },
    displayCount(): number {
      return this.conversionOverride ?? this.count;
    },
    // 'source' for the energy row, 'target' for the heat row, '' otherwise —
    // drives the cell highlight + the overlay's anchor lookup.
    conversionRole(): '' | 'source' | 'target' {
      if (this.conversionOverride === undefined) {
        return '';
      }
      return this.type === Resource.ENERGY ? 'source' : 'target';
    },
    // Stable selector the App-level overlay queries to position the arrow +
    // floating chips. Undefined (attribute omitted) when not converting.
    conversionAnchor(): string | undefined {
      if (this.conversionRole === 'source') {
        return 'energy';
      }
      if (this.conversionRole === 'target') {
        return 'heat';
      }
      return undefined;
    },
    mainCSS(): Array<string> {
      const c = ['resource_item--' + this.type];
      if (this.conversionRole !== '') {
        c.push('resource_item--conversion-' + this.conversionRole);
      }
      return c;
    },
    iconCSS(): string {
      return 'resource_icon--' + this.type;
    },
    stockMetricKey(): string {
      return `${this.type}.stock`;
    },
    productionMetricKey(): string {
      return `${this.type}.production`;
    },
    productionSign(): string {
      if (this.production > 0) {
        return '+';
      }
      return '';
    },
    /*
     * Visual sign-class for the production chip in the left sidebar.
     * Lets CSS (.resource_item_prod--zero / --negative in
     * player_home.less :: .resource_items_cont) tint the chip text
     * by sign so the eye can scan production columns at a glance:
     *
     *   + N  → bright amber          (default, no modifier)
     *   0    → muted neutral         (--zero)
     *   - N  → soft coral            (--negative)
     *
     * Defaults to "" so callers outside the sidebar (where the
     * sign-tinted chip isn't styled) keep the original presentation
     * untouched.
     */
    productionStateClass(): string {
      if (this.production < 0) {
        return 'resource_item_prod--negative';
      }
      if (this.production === 0) {
        return 'resource_item_prod--zero';
      }
      return '';
    },
    protectionIcon(): string {
      if (this.resourceProtection === 'on') {
        return 'shield_icon';
      }
      if (this.resourceProtection === 'half') {
        return 'shield_icon_half';
      }
      if (this.productionProtection === 'on') {
        return 'shield_icon';
      }
      return '';
    },
    showProductionProtectedIcon(): boolean {
      return this.productionProtection === 'on';
    },
    showResourceProtectionIcon(): boolean {
      return this.productionProtection === 'on' && this.resourceProtection !== 'off';
    },
    resourceTypeTooltip(): string {
      if (this.type === Resource.MEGACREDITS) {
        return this.$t('MegaCredits (M€)');
      }
      return this.$t(this.type.charAt(0).toUpperCase() + this.type.slice(1));
    },
    productionCountTooltip(): string {
      return this.$t('Production count');
    },
  },
});
</script>
