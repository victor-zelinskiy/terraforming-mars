<template>
  <!--
    «За партию» — the console rendering of ONE effect's whole-game summary
    (EffectSummaryViewModel — the shared pure model the frozen desktop
    EffectDetailsPanel renders too; an embedded stage may never say LESS than
    the surface it replaces, so the blocks mirror it 1:1: scope caption →
    headline + confidence → trigger count → impact lines → current value →
    breakdown → note → last trigger). Loading shows a quiet skeleton — a
    summary that has not arrived must never read as «ничего не сработало».
  -->
  <div class="con-efx__sum">
    <span class="con-efx__rule-label" v-i18n>This game</span>

    <div v-if="summary === undefined" class="con-efx__sum-skel" aria-hidden="true">
      <span class="con-efx__sum-skel-bar"></span>
      <span class="con-efx__sum-skel-bar con-efx__sum-skel-bar--short"></span>
    </div>

    <template v-else>
      <p v-if="summary.cardScoped === true && !summary.empty" class="con-efx__sum-scope" v-i18n>Some stats are tracked at the card level</p>

      <div v-if="summary.headline !== undefined" class="con-efx__sum-headline">
        <span v-i18n>{{ summary.headline }}</span>
        <span v-if="confidenceLabel !== ''"
              class="con-efx__sum-conf"
              :class="'con-efx__sum-conf--' + summary.confidence"
              v-i18n>{{ confidenceLabel }}</span>
      </div>

      <div v-if="summary.triggerCount > 0" class="con-efx__sum-metric">
        <span class="con-efx__sum-label" v-i18n>Times triggered</span>
        <b>{{ summary.triggerCount }}</b>
      </div>

      <div v-for="(line, i) in summary.lines" :key="i" class="con-efx__sum-line">
        <span v-if="line.icon !== undefined" class="con-efx__sum-icon" :class="iconClassFor(line.icon)" aria-hidden="true"></span>
        <span class="con-efx__sum-label" v-i18n>{{ line.label }}</span>
        <b>{{ line.value }}</b>
      </div>

      <div v-if="summary.currentValue !== undefined" class="con-efx__sum-line con-efx__sum-line--current">
        <span class="con-efx__sum-icon" :class="iconClassFor(summary.currentValue.icon)" aria-hidden="true"></span>
        <span class="con-efx__sum-label" v-i18n>Current</span>
        <b>{{ summary.currentValue.value }}</b>
      </div>

      <div v-if="summary.breakdown !== undefined && summary.breakdown.length > 0" class="con-efx__sum-breakdown">
        <div v-for="(row, i) in summary.breakdown" :key="i" class="con-efx__sum-brow">
          <span v-i18n>{{ row.label }}</span>
          <b>{{ row.value }}</b>
        </div>
      </div>

      <p v-if="summary.note !== undefined" class="con-efx__sum-note" v-i18n>{{ summary.note }}</p>

      <div v-if="summary.lastTrigger !== undefined" class="con-efx__sum-last">
        <span v-i18n>Last triggered</span> · <span v-i18n>Generation</span> {{ summary.lastTrigger.generation }}
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {EffectSummaryViewModel} from '@/client/components/effects/effectSummary';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';

export default defineComponent({
  name: 'ConsoleEffectSummary',
  props: {
    /** undefined = the stats have not arrived — the skeleton renders. */
    summary: {
      type: Object as PropType<EffectSummaryViewModel>,
      default: undefined,
    },
  },
  methods: {
    iconClassFor,
  },
  computed: {
    confidenceLabel(): string {
      switch (this.summary?.confidence) {
      case 'exact': return 'Exact';
      case 'partial': return 'Partial';
      case 'ruleOnly': return 'Rule effect';
      default: return '';
      }
    },
  },
});
</script>
