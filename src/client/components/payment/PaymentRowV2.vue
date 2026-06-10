<template>
  <!--
    Premium resource-control row (v2). TWO zones stacked so the stepper always
    has full horizontal room (МАКС. never clips) regardless of container width:
      · MAIN — resource identity (icon + name + rate chip) on the left, the
               −/count/+/МАКС. stepper on the right.
      · META — the planning facts: current → after stock, and this resource's
               M€-equivalent contribution to the cost.
    Shared by the action-confirmation modal AND card-play payment, so it must
    read well at any width — no fixed table columns.
  -->
  <div class="payment-v2-row"
       :class="{
         'payment-v2-row--active': modelValue > 0,
         'payment-v2-row--reserved': reserved,
       }"
       :data-test="unit">
    <div class="payment-v2-row__main">
      <!-- Identity: icon + name + conversion-rate chip -->
      <div class="payment-v2-row__head">
        <i class="resource_icon payment-v2-row__icon" :class="iconClass"></i>
        <div class="payment-v2-row__id">
          <span class="payment-v2-row__label" v-i18n>{{ description }}</span>
          <span v-if="rate !== 1" class="payment-v2-row__rate">×{{ rate }}</span>
        </div>
      </div>

      <!-- Stepper: −, count, +, МАКС. — a single spacious cluster -->
      <div class="payment-v2-row__stepper">
        <button class="payment-v2-step payment-v2-step--minus"
                :disabled="modelValue <= 0"
                @click="$emit('minus')"
                :title="$t('Decrease')"
                aria-label="−">
          <span class="payment-v2-step__glyph">−</span>
        </button>
        <span class="payment-v2-row__count-value">{{ modelValue }}</span>
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
    </div>

    <!-- Planning facts: stock current → after + this row's contribution -->
    <div class="payment-v2-row__meta">
      <span class="payment-v2-row__fact payment-v2-row__stock">
        <span class="payment-v2-row__fact-label" v-i18n>In stock</span>
        <span class="payment-v2-row__stock-cur">{{ available }}</span>
        <span class="payment-v2-row__stock-arrow" aria-hidden="true">→</span>
        <span class="payment-v2-row__stock-after"
              :class="{'payment-v2-row__stock-after--spent': modelValue > 0}">{{ after }}</span>
      </span>
      <span class="payment-v2-row__fact payment-v2-row__contrib"
            :class="{'payment-v2-row__contrib--zero': modelValue === 0}">
        <span class="payment-v2-row__fact-label" v-i18n>Toward cost</span>
        <span class="payment-v2-row__contrib-value">{{ contribution }}</span>
        <i class="resource_icon resource_icon--megacredits payment-v2-row__contrib-coin"></i>
      </span>
      <span v-if="reserved" class="payment-v2-row__reserved" v-i18n>reserved</span>
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
    // Stock remaining AFTER this row's spend — the "current → after" preview.
    after(): number {
      return Math.max(0, this.available - this.modelValue);
    },
    // This row's M€-equivalent contribution to the cost (rate × count).
    contribution(): number {
      return this.modelValue * this.rate;
    },
  },
});
</script>
