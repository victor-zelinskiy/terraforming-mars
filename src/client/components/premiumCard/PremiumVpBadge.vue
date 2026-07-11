<template>
  <div class="pcard__vp" :class="{'pcard__vp--wide': isWide}" :aria-label="ariaText">
    <!-- fixed VP -->
    <span v-if="vp.kind === 'fixed'"
          class="pcard__vp-value"
          :class="{'pcard__vp-value--negative': vp.value < 0}">{{ vp.value }}</span>

    <!-- vermin: −1 / city, engraved compact -->
    <span v-else-if="vp.kind === 'vermin'" class="pcard__vp-dyn">
      <span class="pcard__vp-value pcard__vp-value--negative">−1</span>
      <span class="pcard__vp-slash">/</span>
      <span class="pcard-ic" :style="cityIconStyle"></span>
      <span class="pcard__vp-asterisk">*</span>
    </span>

    <!-- dynamic: N / [icon] -->
    <span v-else class="pcard__vp-dyn">
      <span class="pcard__vp-value" :class="{'pcard__vp-value--negative': vp.points < 0}">{{ pointsText }}</span>
      <template v-if="showTarget">
        <span class="pcard__vp-slash">/</span>
        <span v-if="vp.target !== 1 && vp.target !== 0" class="pcard__vp-value">{{ vp.target }}</span>
      </template>
      <span v-if="itemIconUrl !== undefined" class="pcard-ic" :style="{backgroundImage: `url(${itemIconUrl})`}"></span>
      <span v-if="vp.asterisk || vp.targetOneOrMore" class="pcard__vp-asterisk">*</span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PremiumVpVM} from './premiumCardViewModel';
import {mechItemIcon} from './premiumCardIcons';
import {translateText} from '@/client/directives/i18n';

/**
 * The gold VP badge (bottom-right). Fixed values engrave a large number;
 * dynamic formulas compact to «N/[icon]» (badge widens); the Vermin special
 * keeps its honest −1/city form.
 */
export default defineComponent({
  name: 'PremiumVpBadge',
  props: {
    vp: {
      type: Object as () => PremiumVpVM,
      required: true,
    },
  },
  computed: {
    isWide(): boolean {
      return this.vp.kind !== 'fixed';
    },
    pointsText(): string {
      if (this.vp.kind !== 'dynamic') {
        return '';
      }
      return this.vp.points < 0 ? `−${Math.abs(this.vp.points)}` : String(this.vp.points);
    },
    showTarget(): boolean {
      return this.vp.kind === 'dynamic' && this.vp.target > 1 && !this.vp.targetOneOrMore;
    },
    itemIconUrl(): string | undefined {
      if (this.vp.kind !== 'dynamic' || this.vp.item === undefined) {
        return undefined;
      }
      const icon = mechItemIcon(this.vp.item);
      return icon?.kind === 'img' ? icon.url : undefined;
    },
    cityIconStyle(): Record<string, string> {
      return {backgroundImage: 'url(assets/tiles/city.png)'};
    },
    ariaText(): string {
      return translateText('Victory points');
    },
  },
});
</script>
