<template>
  <div class="payment-v2-row"
       :class="{
         'payment-v2-row--active': modelValue > 0,
         'payment-v2-row--reserved': reserved,
       }"
       :data-test="unit">
    <!-- Left: icon + descriptive label + optional rate badge -->
    <div class="payment-v2-row__head">
      <i class="resource_icon payment-v2-row__icon" :class="iconClass"></i>
      <div class="payment-v2-row__meta">
        <div class="payment-v2-row__label" v-i18n>{{ description }}</div>
        <div class="payment-v2-row__rate" v-if="rate !== 1">×{{ rate }}</div>
      </div>
    </div>

    <!-- Center: ±/MAX cluster with count -->
    <div class="payment-v2-row__stepper">
      <button class="payment-v2-step payment-v2-step--minus"
              :disabled="modelValue <= 0"
              @click="$emit('minus')"
              :title="$t('Decrease')"
              aria-label="−">
        <span class="payment-v2-step__glyph">−</span>
      </button>
      <div class="payment-v2-row__count">
        <span class="payment-v2-row__count-value">{{ modelValue }}</span>
        <span class="payment-v2-row__count-contrib" v-if="rate !== 1 && modelValue > 0">
          = {{ modelValue * rate }}
        </span>
      </div>
      <button class="payment-v2-step payment-v2-step--plus"
              :disabled="modelValue >= max"
              @click="$emit('plus')"
              :title="$t('Increase')"
              aria-label="+">
        <span class="payment-v2-step__glyph">+</span>
      </button>
      <button class="payment-v2-step payment-v2-step--max"
              :disabled="modelValue >= max"
              @click="$emit('max')"
              :title="$t('Max')"
              v-i18n>MAX</button>
    </div>

    <!-- Right: pool indicator (current / available) + reserved badge -->
    <div class="payment-v2-row__pool">
      <div class="payment-v2-row__pool-line">
        <span class="payment-v2-row__pool-num">{{ modelValue }}</span>
        <span class="payment-v2-row__pool-sep">/</span>
        <span class="payment-v2-row__pool-den">{{ available }}</span>
      </div>
      <div class="payment-v2-row__pool-reserved" v-if="reserved" v-i18n>reserved</div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {SpendableResource} from '@/common/inputs/Spendable';

// Maps each spendable resource to the existing `resource_icon--*` class so
// V2 reuses the same icon assets used everywhere else in the app
// (defined in resources.less). Mirrors PaymentUnit.vue (V1) but as a static
// table for simpler reasoning.
const ICON_CLASS: Record<SpendableResource, string> = {
  megacredits: 'resource_icon--megacredits',
  steel: 'resource_icon--steel',
  titanium: 'resource_icon--titanium',
  heat: 'resource_icon--heat',
  plants: 'resource_icon--plants',
  microbes: 'resource_icon--microbes',
  floaters: 'resource_icon--floaters',
  seeds: 'resource_icon--seed',
  kuiperAsteroids: 'resource_icon--asteroid',
  auroraiData: 'resource_icon--auroraidata',
  spireScience: 'resource_icon--science',
  lunaArchivesScience: 'resource_icon--science',
  graphene: 'resource_icon--graphene',
};

export default defineComponent({
  name: 'PaymentRowV2',
  props: {
    unit: {
      type: String as () => SpendableResource,
      required: true,
    },
    modelValue: {
      type: Number,
      required: true,
    },
    available: {
      type: Number,
      required: true,
    },
    max: {
      type: Number,
      required: true,
    },
    rate: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    reserved: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['plus', 'minus', 'max'],
  computed: {
    iconClass(): string {
      return ICON_CLASS[this.unit];
    },
  },
});
</script>
