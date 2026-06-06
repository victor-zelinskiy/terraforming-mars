<template>
  <!--
    Two independent filter dimensions for the Actions overlay, both rendered as
    the hand-overlay's premium segmented control (faceted counts + active state):
      • AVAILABILITY — All / Available / Unavailable (rules-doable right now).
      • ACTIVATION   — All / Not activated / Activated (used this generation).
    Default availability=All, activation=Not activated.
  -->
  <div class="actions-filters" role="group" :aria-label="$t('Filter actions')">
    <div class="actions-filters__group">
      <span class="actions-filters__group-label" v-i18n>Availability</span>
      <div class="actions-filters__segment" role="tablist">
        <button
          v-for="chip in availabilityChips"
          :key="chip.value"
          type="button"
          class="hand-seg-btn"
          :class="{'hand-seg-btn--active': chip.active, 'hand-seg-btn--empty': chip.count === 0 && !chip.active}"
          :aria-pressed="chip.active"
          :data-test="'actions-availability-' + chip.value"
          @click="$emit('availability', chip.value)">
          <span class="hand-seg-btn__label" v-i18n>{{ chip.label }}</span>
          <span class="hand-seg-btn__count">{{ chip.count }}</span>
        </button>
      </div>
    </div>

    <span class="actions-filters__divider" aria-hidden="true"></span>

    <div class="actions-filters__group">
      <span class="actions-filters__group-label" v-i18n>Activation</span>
      <div class="actions-filters__segment" role="tablist">
        <button
          v-for="chip in activationChips"
          :key="chip.value"
          type="button"
          class="hand-seg-btn"
          :class="{'hand-seg-btn--active': chip.active, 'hand-seg-btn--empty': chip.count === 0 && !chip.active}"
          :aria-pressed="chip.active"
          :data-test="'actions-activation-' + chip.value"
          @click="$emit('activation', chip.value)">
          <span class="hand-seg-btn__label" v-i18n>{{ chip.label }}</span>
          <span class="hand-seg-btn__count">{{ chip.count }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {AvailabilityChip, ActivationChip} from '@/client/components/actions/actionModel';

export default defineComponent({
  name: 'ActionsFilters',
  props: {
    availabilityChips: {
      type: Array as PropType<ReadonlyArray<AvailabilityChip>>,
      required: true,
    },
    activationChips: {
      type: Array as PropType<ReadonlyArray<ActivationChip>>,
      required: true,
    },
  },
  emits: ['availability', 'activation'],
});
</script>
