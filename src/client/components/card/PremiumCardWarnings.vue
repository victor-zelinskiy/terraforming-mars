<template>
  <!--
    Premium replacement for the legacy red `.card-warning` plaintext inside the
    premium play / action modals. Renders a card's NON-blocking notices — the
    `Warning` flags (maxtemp / removeOwnPlants / pharmacyUnion / …) AND the
    additional-project-cost notes (Reds tax / Think Tank / Aeron Genomics) — as
    compact level-styled notice chips (info / warning / no-effect), each with a
    glyph + accent, in the sci-fi overlay language. Shown ONLY when there is at
    least one notice, so a clean play stays uncluttered.
  -->
  <div v-if="hasNotices" class="card-notices" role="status">
    <!-- Warning flags (maxtemp etc.) — calm "won't apply" / downside notices. -->
    <div v-for="w in warningNotices"
         :key="w.warning"
         class="card-notices__item"
         :class="'card-notices__item--' + w.level">
      <span class="card-notices__glyph" aria-hidden="true">{{ glyph(w.level) }}</span>
      <span class="card-notices__text" v-i18n>{{ w.text }}</span>
    </div>
    <!-- Additional project costs (param messages — built like the legacy widget). -->
    <template v-if="additionalCosts !== undefined">
      <div v-if="additionalCosts.redsCost"
           class="card-notices__item card-notices__item--warning"
           v-i18n="[cn(cardName), additionalCosts.redsCost, $t('Reds')]">
        <span class="card-notices__glyph" aria-hidden="true">⚠</span>
        <span class="card-notices__text">Playing ${0} will cost ${1} M€ more because ${2} are in power</span>
      </div>
      <div v-if="additionalCosts.aeronGenomicsResources"
           class="card-notices__item card-notices__item--warning"
           v-i18n="[cn(cardName), additionalCosts.aeronGenomicsResources, 'animals', $t(aeronGenomics)]">
        <span class="card-notices__glyph" aria-hidden="true">⚠</span>
        <span class="card-notices__text">Playing ${0} consumes ${1} ${2} from ${3}</span>
      </div>
      <div v-if="additionalCosts.thinkTankResources"
           class="card-notices__item card-notices__item--warning"
           v-i18n="[cn(cardName), additionalCosts.thinkTankResources, 'data', $t(thinkTank)]">
        <span class="card-notices__glyph" aria-hidden="true">⚠</span>
        <span class="card-notices__text">Playing ${0} consumes ${1} ${2} from ${3}</span>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Warning} from '@/common/cards/Warning';
import {AdditionalProjectCosts} from '@/common/cards/Types';
import {WarningLevel, warningLevel, warningText} from '@/client/components/card/cardWarnings';
import {translateCardName} from '@/client/directives/i18n';

export default defineComponent({
  name: 'PremiumCardWarnings',
  props: {
    // The card's `Warning` flags (maxtemp, removeOwnPlants, …).
    warnings: {
      type: Array as PropType<ReadonlyArray<Warning>>,
      default: () => [],
    },
    // The predicted extra costs (Reds tax / Think Tank / Aeron Genomics).
    additionalCosts: {
      type: Object as PropType<AdditionalProjectCosts | undefined>,
      default: undefined,
    },
    // The card whose play these costs apply to (for the param messages).
    cardName: {
      type: String as PropType<CardName>,
      default: '' as CardName,
    },
  },
  computed: {
    warningNotices(): ReadonlyArray<{warning: Warning, level: WarningLevel, text: string}> {
      return (this.warnings ?? []).map((w) => ({warning: w, level: warningLevel(w), text: warningText(w)}));
    },
    hasNotices(): boolean {
      if (this.warningNotices.length > 0) {
        return true;
      }
      const c = this.additionalCosts;
      return c !== undefined && ((c.redsCost ?? 0) > 0 || (c.aeronGenomicsResources ?? 0) > 0 || (c.thinkTankResources ?? 0) > 0);
    },
    aeronGenomics(): CardName {
      return CardName.AERON_GENOMICS;
    },
    thinkTank(): CardName {
      return CardName.THINK_TANK;
    },
  },
  methods: {
    // Localized card name for the param messages, tolerating a `Name:variant` id.
    cn(name: CardName): string {
      return translateCardName(name);
    },
    glyph(level: WarningLevel): string {
      switch (level) {
      case 'noEffect': return '⊘';
      case 'info': return 'ℹ';
      default: return '⚠';
      }
    },
  },
});
</script>

<style scoped lang="less">
.card-notices {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 4px 0 2px;
}

.card-notices__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 11px;
  border-radius: 7px;
  font-size: 12.5px;
  line-height: 1.3;
  letter-spacing: 0.2px;
  // Dark glass plate with a left accent bar — matches the overlay chrome instead
  // of the legacy red plaintext.
  background: linear-gradient(180deg, rgba(16, 26, 38, 0.85), rgba(12, 20, 30, 0.78));
  border: 1px solid rgba(120, 160, 200, 0.18);
  border-left-width: 3px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
}

.card-notices__glyph {
  flex: 0 0 auto;
  font-size: 13px;
  line-height: 1;
}

.card-notices__text {
  flex: 1 1 auto;
  color: #d8e4f0;
}

// "Part of the effect won't apply" — calm amber, the lowest-alarm level.
.card-notices__item--noEffect {
  border-left-color: rgba(232, 188, 96, 0.85);
  .card-notices__glyph {
    color: #f0cd7a;
  }
  .card-notices__text {
    color: #e6d3a8;
  }
}

// A real downside to weigh (self-harm, an extra cost) — orange.
.card-notices__item--warning {
  border-left-color: rgba(232, 142, 84, 0.9);
  background: linear-gradient(180deg, rgba(40, 24, 16, 0.82), rgba(30, 18, 12, 0.78));
  .card-notices__glyph {
    color: #ff9d5c;
  }
  .card-notices__text {
    color: #f3d4be;
  }
}

// A neutral heads-up — cyan.
.card-notices__item--info {
  border-left-color: rgba(96, 188, 220, 0.85);
  .card-notices__glyph {
    color: #7ad0ec;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card-notices__item {
    transition: none;
  }
}
</style>
