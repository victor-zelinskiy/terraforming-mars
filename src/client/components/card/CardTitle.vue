<template>
  <div :class="[getMainClasses(), { 'is-corporation': isCorporation() }]">
    <div v-if="isPrelude()" class="prelude-label">prelude</div>
    <div v-if="isCorporation()" class="corporation-label">corporation</div>
    <div v-if="isCeo()" class="ceo-label">CEO</div>
    <CardCorporationLogo v-if="isCorporation()" :title="title"/>
    <div v-else :class="getClasses(title)">{{ getCardTitleWithoutSuffix(title) }}</div>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {CardType} from '@/common/cards/CardType';
import {translateText} from '@/client/directives/i18n';
import CardCorporationLogo from '@/client/components/card/CardCorporationLogo.vue';
import {CardName} from '@/common/cards/CardName';

export default defineComponent({
  name: 'CardTitle',
  props: {
    title: {
      type: String as () => CardName,
      required: true,
    },
    type: {
      type: String as () => CardType,
      required: true,
    },
  },
  components: {
    CardCorporationLogo,
  },
  methods: {
    isCeo(): boolean {
      return this.type === CardType.CEO;
    },
    isCorporation(): boolean {
      return this.type === CardType.CORPORATION;
    },
    isPrelude(): boolean {
      return this.type === CardType.PRELUDE;
    },
    getClasses(title: string): string {
      const classes: Array<String> = ['card-title'];

      if (this.type === CardType.AUTOMATED) {
        classes.push('background-color-automated');
      } else if (this.type === CardType.ACTIVE) {
        classes.push('background-color-active');
      } else if (this.type === CardType.EVENT) {
        classes.push('background-color-events');
      } else if (this.type === CardType.PRELUDE) {
        classes.push('background-color-prelude');
      } else if (this.type === CardType.CEO) {
        classes.push('background-color-ceo');
      } else if (this.type === CardType.STANDARD_PROJECT || this.type === CardType.STANDARD_ACTION) {
        classes.push('background-color-standard-project');
      }

      const localeSpecificTitle = translateText(this.getCardTitleWithoutSuffix(title));

      /*
       * Title sizing — 6 tiers (v35). v34's .title-xs threshold was
       * too generous — 25-26 char Russian names like "Культивирование
       * водорослей" overflowed at 15 px. v35 narrows .title-xs to
       * 20-24 chars only; 25+ drops to .title-xxs (12 px).
       *
       *   length    │ class            │ font-size │ letter-spacing
       *   ──────────┼──────────────────┼───────────┼──────────────
       *   ≤  8      │ (no class)       │ 22 px     │ 1.3 px
       *   9  – 13   │ .title-small     │ 19 px     │ 1.1 px
       *   14 – 19   │ .title-smaller   │ 17 px     │ 0.9 px
       *   20 – 24   │ .title-xs        │ 15 px     │ 0.7 px
       *   25 – 33   │ .title-xxs       │ 12 px     │ 0.3 px
       *   ≥ 34      │ .title-xxxs      │ 11 px     │ 0.2 px
       */
      const len = localeSpecificTitle.length;
      if (len > 33) {
        classes.push('title-xxxs');
      } else if (len > 24) {
        classes.push('title-xxs');
      } else if (len > 19) {
        classes.push('title-xs');
      } else if (len > 13) {
        classes.push('title-smaller');
      } else if (len > 8) {
        classes.push('title-small');
      }

      return classes.join(' ');
    },
    getMainClasses() {
      const classes: Array<String> = ['card-title'];
      if (this.type === CardType.STANDARD_PROJECT || this.type === CardType.STANDARD_ACTION) {
        classes.push('card-title-standard-project');
      }
      return classes.join(' ');
    },
    getCardTitleWithoutSuffix(title: string): string {
      return title.split(':')[0];
    },
  },
});

</script>
