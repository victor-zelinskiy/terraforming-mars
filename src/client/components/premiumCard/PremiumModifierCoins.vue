<template>
  <!-- THE MODIFIER SEAL (TR49 class): WHO bends a requirement, as coins — each source card's own art in the class's
       mint ring, a one-play effect with the ⚡ pip; several sources overlap into ONE stack (the first on top), past
       `max` a «+N» coin. Purely a statement: no focus stop, no hint of its own (the surfaces around it name the
       sources in words). Sized in `em` — it takes the type size of the line it stands in. -->
  <span v-if="sources.length > 0" class="pcard-mods" role="img" :aria-label="label"
        :data-req-coins="sources.length">
    <span v-for="(s, i) in shown" :key="s.key"
          class="pcard-mod"
          :class="{'pcard-mod--once': s.oneShot, 'pcard-mod--plain': artOf(s) === undefined}"
          :style="coinStyle(s, i)"
          :data-req-coin="s.card ?? s.key"></span>
    <span v-if="more > 0" class="pcard-mod pcard-mod--more" :style="{zIndex: '0'}">+{{ more }}</span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {cardArtUrlAtTier, cardArtUrl} from '@/client/cards/cardArt';
import {translateText} from '@/client/directives/i18n';
import {ModifierSourceVM} from './premiumModifierSources';

export default defineComponent({
  name: 'PremiumModifierCoins',
  props: {
    sources: {type: Array as PropType<ReadonlyArray<ModifierSourceVM>>, required: true},
    /** Coins drawn before the «+N» coin takes the rest. */
    max: {type: Number, default: 3},
  },
  computed: {
    shown(): ReadonlyArray<ModifierSourceVM> {
      return this.sources.length > this.max ? this.sources.slice(0, this.max - 1) : this.sources;
    },
    more(): number {
      return this.sources.length - this.shown.length;
    },
    label(): string {
      return this.sources.map((s) => (s.card !== undefined ? translateText(s.card) : '')).filter((n) => n !== '').join(', ');
    },
  },
  methods: {
    /** The source's REAL art at the thumb tier — never the generic fallback (a coin of nobody reads as a source). */
    artOf(s: ModifierSourceVM): string | undefined {
      const url = s.card === undefined ? undefined : cardArtUrl(s.card);
      return url === undefined ? undefined : cardArtUrlAtTier(url, 'thumb');
    },
    coinStyle(s: ModifierSourceVM, i: number): Record<string, string> {
      const art = this.artOf(s);
      // The FIRST source the server names lies on top of the stack.
      const style: Record<string, string> = {zIndex: String(this.shown.length - i)};
      if (art !== undefined) {
        style.backgroundImage = `url(${art})`;
      }
      return style;
    },
  },
});
</script>
