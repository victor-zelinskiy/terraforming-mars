<template>
  <!--
    Premium "what changes" breakdown for an action: the cost/gain chips split into
    two labelled groups — "Будет списано" (costs) and "Вы получите" (gains) — so the
    player reads exactly what they pay and what they get BEFORE confirming. Reuses
    the same ActionEffectChip as the rest of the action UI. Used in the action
    details panel AND the confirmation modal.
  -->
  <div v-if="costs.length > 0 || gains.length > 0" class="action-results">
    <div v-if="costs.length > 0" class="action-results__group action-results__group--cost">
      <span class="action-results__label" v-i18n>To be spent</span>
      <div class="action-results__chips">
        <ActionEffectChip v-for="(e, i) in costs" :key="'c' + i" :effect="e" />
      </div>
    </div>
    <div v-if="gains.length > 0" class="action-results__group action-results__group--gain">
      <span class="action-results__label" v-i18n>You will receive</span>
      <div class="action-results__chips">
        <ActionEffectChip v-for="(e, i) in gains" :key="'g' + i" :effect="e" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';

export default defineComponent({
  name: 'ActionResultsPreview',
  components: {ActionEffectChip},
  props: {
    effects: {
      type: Array as PropType<ReadonlyArray<ActionEffect>>,
      default: () => [],
    },
  },
  computed: {
    costs(): ReadonlyArray<ActionEffect> {
      return this.effects.filter((e) => e.direction === 'cost');
    },
    gains(): ReadonlyArray<ActionEffect> {
      return this.effects.filter((e) => e.direction === 'gain');
    },
  },
});
</script>
