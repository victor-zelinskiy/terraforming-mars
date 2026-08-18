<template>
  <div class="pcard__art"
       :class="{
         'pcard__art--loaded': loaded,
         'pcard__art--fallback': onFallback,
         'pcard__art--void': exhausted,
       }"
       aria-hidden="true">
    <img v-if="!exhausted"
         :src="src"
         alt=""
         loading="lazy"
         decoding="async"
         draggable="false"
         @load="loaded = true"
         @error="onError" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CARD_ART_FALLBACK_URL, CardArtTier, cardArtUrlAtTier, PremiumCardArt} from '@/client/cards/cardArt';

/**
 * The art viewport. Failure chain is one-shot per link and can never loop:
 * requested tier (thumb) → per-card full art → shared fallback (-1.webp) →
 * procedural theme body (`pcard__art--void`, no <img> at all). At `tier:
 * 'full'` the first link collapses into the second — exactly the historical
 * chain. A missing thumb (stale checkout, art added without `make:cards`)
 * therefore degrades to the full file, never to a lost picture.
 */
export default defineComponent({
  name: 'PremiumCardArt',
  props: {
    art: {
      type: Object as () => PremiumCardArt,
      required: true,
    },
    /** Which resolution build to paint — see cardArt.ts ART TIERS. */
    tier: {
      type: String as () => CardArtTier,
      required: false,
      default: 'full',
    },
  },
  data() {
    return {
      loaded: false,
      failedThumb: false,
      failedPrimary: false,
      exhausted: false,
    };
  },
  computed: {
    src(): string {
      if (this.tier === 'thumb' && !this.failedThumb) {
        return cardArtUrlAtTier(this.art.url, 'thumb');
      }
      if (!this.failedPrimary) {
        return this.art.url;
      }
      return CARD_ART_FALLBACK_URL;
    },
    onFallback(): boolean {
      return this.art.fallback || this.failedPrimary;
    },
  },
  watch: {
    // A re-pointed keyless card face re-arms the load chain for the new art.
    'art.url'() {
      this.resetChain();
    },
    'tier'() {
      this.resetChain();
    },
  },
  methods: {
    resetChain(): void {
      this.loaded = false;
      this.failedThumb = false;
      this.failedPrimary = false;
      this.exhausted = false;
    },
    onError(): void {
      if (this.tier === 'thumb' && !this.failedThumb) {
        this.failedThumb = true; // retry with the full-res file
        this.loaded = false;
        return;
      }
      if (!this.failedPrimary && !this.art.fallback) {
        this.failedPrimary = true; // retry once with the shared fallback
        this.loaded = false;
        return;
      }
      this.exhausted = true; // even -1.webp failed → procedural body
    },
  },
});
</script>
